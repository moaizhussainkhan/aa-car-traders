"""
Orders + automated PDF invoice/shipping-label generation.

Reseller orders are billed at wholesale_price * (1 + margin%) — the PDF invoice shows
only that final unit price, never the underlying wholesale figure, so resellers can
safely forward it to their own customers.
"""
import io
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session, joinedload

from app.config import settings as env
from app.database import get_db
from app.deps import can_see_wholesale, get_current_user, require_admin
from app.models import Order, OrderItem, OrderStatus, Product, SiteSettings, User
from app.schemas import OrderCreate, OrderOut, OrderStatusUpdate
from app.utils.activity import log_activity
from app.utils.leopards import LeopardsError, book_shipment, track_shipment

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _price_for_item(product: Product, is_reseller_order: bool, margin_percent: float) -> float:
    if is_reseller_order:
        return round(product.wholesale_price * (1 + margin_percent / 100), 2)
    return product.retail_price


@router.post("", response_model=OrderOut, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db), user: User | None = Depends(get_current_user)):
    # Wholesale billing is only for the admin / approved resellers. Anyone else is always billed retail.
    is_reseller_order = payload.is_reseller_order and can_see_wholesale(user)

    # Merge duplicate lines, validate stock BEFORE writing anything.
    wanted: dict[str, int] = {}
    for it in payload.items:
        wanted[it.product_id] = wanted.get(it.product_id, 0) + it.quantity
    products: dict[str, Product] = {}
    for pid, qty in wanted.items():
        product = db.query(Product).filter(Product.id == pid, Product.is_active == True).first()  # noqa: E712
        if not product:
            raise HTTPException(status_code=400, detail="One of the products is no longer available.")
        if product.stock_quantity < qty:
            left = max(product.stock_quantity, 0)
            raise HTTPException(status_code=400, detail=f"Only {left} left in stock for “{product.title}”.")
        products[pid] = product

    order = Order(
        order_number=f"AACT-{uuid.uuid4().hex[:8].upper()}",
        user_id=user.id if user else None,
        customer_name=payload.customer_name.strip(),
        customer_phone=payload.customer_phone.strip(),
        customer_address=payload.customer_address,
        is_reseller_order=is_reseller_order,
        reseller_margin_percent=payload.reseller_margin_percent if is_reseller_order else 0.0,
    )
    db.add(order)
    db.flush()

    total = 0.0
    for pid, qty in wanted.items():
        product = products[pid]
        unit_price = _price_for_item(product, is_reseller_order, order.reseller_margin_percent)
        total += unit_price * qty
        product.stock_quantity -= qty
        db.add(OrderItem(order_id=order.id, product_id=product.id, quantity=qty, unit_price=unit_price))

    order.total_amount = round(total, 2)
    log_activity(db, "order_placed", f"New order {order.order_number} from {order.customer_name} — PKR {order.total_amount:,.0f}",
                 user.name if user else "Guest")
    db.commit()
    db.refresh(order)
    return order


@router.get("", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return (db.query(Order).options(joinedload(Order.items).joinedload(OrderItem.product))
            .order_by(Order.created_at.desc()).limit(500).all())


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_status(order_id: str, payload: OrderStatusUpdate, db: Session = Depends(get_db),
                  admin: User = Depends(require_admin)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    old, new = order.status, payload.status
    if old != new:
        # cancelling puts the stock back; un-cancelling takes it out again
        if new == OrderStatus.CANCELLED:
            for item in order.items:
                if item.product:
                    item.product.stock_quantity += item.quantity
        elif old == OrderStatus.CANCELLED:
            for item in order.items:
                if item.product:
                    item.product.stock_quantity = max(0, item.product.stock_quantity - item.quantity)
        order.status = new
        log_activity(db, "order_status", f"Order {order.order_number} → {new.value}", admin)
        db.commit()
        db.refresh(order)
    return order


@router.post("/{order_id}/book-courier", response_model=OrderOut)
async def book_courier(order_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Books this order with Leopards Courier and moves it to SHIPPED. Admin-only.
    Runs in mock mode (fake local tracking number) until LEOPARDS_API_KEY/PASSWORD are set in .env."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.courier_tracking_number:
        raise HTTPException(status_code=400, detail="This order already has a courier tracking number.")
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Can't book a courier for a cancelled order.")

    try:
        result = await book_shipment(order)
    except LeopardsError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    order.courier_tracking_number = result["tracking_number"]
    order.courier_status = result["status"]
    order.courier_booked_at = datetime.utcnow()
    order.status = OrderStatus.SHIPPED
    log_activity(db, "order_status",
                 f"Order {order.order_number} booked with Leopards Courier — tracking {result['tracking_number']}"
                 + (" (mock)" if result.get("mock") else ""), admin)
    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}/track")
async def track_courier(order_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Live status check against Leopards Courier for this order's tracking number."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.courier_tracking_number:
        raise HTTPException(status_code=400, detail="This order hasn't been booked with a courier yet.")

    try:
        result = await track_shipment(order.courier_tracking_number)
    except LeopardsError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    order.courier_status = result["status"]
    db.commit()
    return {"tracking_number": order.courier_tracking_number, "status": result["status"]}


@router.get("/{order_id}/invoice.pdf")
def download_invoice(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    site = db.query(SiteSettings).first()
    phone = site.contact_phone if site else env.CONTACT_PHONE
    email = site.contact_email if site else env.CONTACT_EMAIL

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A5)
    width, height = A5
    y = height - 20 * mm

    c.setFillColorRGB(0.898, 0.035, 0.078)  # crimson #E50914
    c.setFont("Helvetica-Bold", 16)
    c.drawString(15 * mm, y, "AA CAR TRADERS")
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawString(15 * mm, y - 6 * mm, "TRUST | QUALITY | SATISFACTION")
    c.drawString(15 * mm, y - 11 * mm, f"Ph: {phone}  |  {email}")

    y -= 22 * mm
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(15 * mm, y, f"Invoice / Shipping Label — {order.order_number}")
    y -= 7 * mm
    c.setFont("Helvetica", 9)
    c.drawString(15 * mm, y, f"Ship to: {order.customer_name}")
    y -= 5 * mm
    c.drawString(15 * mm, y, f"Phone: {order.customer_phone}")
    y -= 5 * mm
    c.drawString(15 * mm, y, f"Address: {(order.customer_address or '-')[:70]}")
    y -= 5 * mm
    c.drawString(15 * mm, y, f"Date: {order.created_at.strftime('%Y-%m-%d')}")
    if order.courier_tracking_number:
        y -= 5 * mm
        c.drawString(15 * mm, y, f"Leopards Courier Tracking #: {order.courier_tracking_number}")

    y -= 10 * mm
    c.setFont("Helvetica-Bold", 9)
    c.drawString(15 * mm, y, "Item")
    c.drawString(85 * mm, y, "Qty")
    c.drawString(100 * mm, y, "Unit Price")  # unit_price already includes reseller margin, never wholesale
    y -= 4 * mm
    c.line(15 * mm, y, width - 15 * mm, y)
    y -= 5 * mm

    c.setFont("Helvetica", 8)
    for item in order.items:
        name = item.product.title if item.product else "Item"
        c.drawString(15 * mm, y, name[:40])
        c.drawString(85 * mm, y, str(item.quantity))
        c.drawString(100 * mm, y, f"PKR {item.unit_price:,.0f}")
        y -= 5 * mm

    y -= 3 * mm
    c.line(15 * mm, y, width - 15 * mm, y)
    y -= 6 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(15 * mm, y, f"Total: PKR {order.total_amount:,.0f}  (Cash on Delivery)")

    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={order.order_number}.pdf"},
    )
