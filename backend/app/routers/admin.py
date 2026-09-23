"""Admin-only dashboard data: stats/analytics, activity feed, customers list."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import (ActivityLog, Category, Order, OrderItem, OrderStatus, Product, User, UserRole)
from app.schemas import ActivityOut
from app.utils.activity import log_activity

router = APIRouter(prefix="/api/admin", tags=["admin"])

LOW_STOCK = 3


@router.get("/stats")
def stats(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    products_total = db.query(func.count(Product.id)).scalar() or 0
    products_active = db.query(func.count(Product.id)).filter(Product.is_active == True).scalar() or 0  # noqa: E712
    low_stock = (db.query(Product).filter(Product.is_active == True, Product.stock_quantity <= LOW_STOCK)  # noqa: E712
                 .order_by(Product.stock_quantity).limit(8).all())

    live_orders = db.query(Order).filter(Order.status != OrderStatus.CANCELLED)
    orders_total = db.query(func.count(Order.id)).scalar() or 0
    orders_pending = db.query(func.count(Order.id)).filter(Order.status == OrderStatus.PENDING).scalar() or 0
    revenue = live_orders.with_entities(func.coalesce(func.sum(Order.total_amount), 0.0)).scalar() or 0.0

    customers = db.query(func.count(User.id)).filter(User.role == UserRole.CUSTOMER).scalar() or 0
    resellers = db.query(func.count(User.id)).filter(User.role == UserRole.RESELLER).scalar() or 0
    pending_resellers = (db.query(func.count(User.id))
                         .filter(User.role == UserRole.RESELLER, User.is_approved == False).scalar() or 0)  # noqa: E712

    # last 14 days revenue / orders
    since = datetime.utcnow().date() - timedelta(days=13)
    rows = (db.query(Order).filter(Order.status != OrderStatus.CANCELLED, Order.created_at >= datetime.combine(since, datetime.min.time())).all())
    by_day = {(since + timedelta(days=i)).isoformat(): {"date": (since + timedelta(days=i)).isoformat(), "revenue": 0.0, "orders": 0} for i in range(14)}
    for o in rows:
        d = o.created_at.date().isoformat()
        if d in by_day:
            by_day[d]["revenue"] += o.total_amount
            by_day[d]["orders"] += 1

    top = (db.query(Product.title, func.sum(OrderItem.quantity).label("units"))
           .join(OrderItem, OrderItem.product_id == Product.id)
           .join(Order, Order.id == OrderItem.order_id).filter(Order.status != OrderStatus.CANCELLED)
           .group_by(Product.id).order_by(func.sum(OrderItem.quantity).desc()).limit(5).all())

    status_rows = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    cat_rows = (db.query(Category.name, func.count(Product.id)).outerjoin(Product, Product.category_id == Category.id)
                .group_by(Category.id).order_by(func.count(Product.id).desc()).all())

    return {
        "products_total": products_total, "products_active": products_active,
        "orders_total": orders_total, "orders_pending": orders_pending, "revenue": float(revenue),
        "customers": customers, "resellers": resellers, "pending_resellers": pending_resellers,
        "low_stock": [{"id": p.id, "title": p.title, "stock": p.stock_quantity} for p in low_stock],
        "revenue_by_day": list(by_day.values()),
        "top_products": [{"title": t, "units": int(u or 0)} for t, u in top],
        "orders_by_status": {(s.value if hasattr(s, "value") else str(s)): c for s, c in status_rows},
        "products_by_category": [{"name": n, "count": c} for n, c in cat_rows],
    }


@router.get("/activity", response_model=list[ActivityOut])
def activity(limit: int = 30, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(min(limit, 100)).all()


@router.get("/users")
def users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    counts = dict(db.query(Order.user_id, func.count(Order.id)).filter(Order.user_id.isnot(None)).group_by(Order.user_id).all())
    rows = db.query(User).filter(User.is_admin == False).order_by(User.created_at.desc()).all()  # noqa: E712
    return [{
        "id": u.id, "name": u.name, "email": u.email, "phone": u.phone, "business_name": u.business_name,
        "role": u.role.value, "is_active": u.is_active, "is_approved": u.is_approved,
        "orders": counts.get(u.id, 0), "created_at": u.created_at,
    } for u in rows]


class UserPatch(BaseModel):
    is_active: bool | None = None
    is_approved: bool | None = None


@router.patch("/users/{user_id}")
def patch_user(user_id: str, payload: UserPatch, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id, User.is_admin == False).first()  # noqa: E712
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.is_active is not None:
        u.is_active = payload.is_active
        log_activity(db, "user_status", f"{'Enabled' if u.is_active else 'Disabled'} account: {u.name}", admin)
    if payload.is_approved is not None:
        u.is_approved = payload.is_approved
        log_activity(db, "user_approval", f"{'Approved' if u.is_approved else 'Un-approved'} reseller: {u.name}", admin)
    db.commit()
    return {"ok": True}
