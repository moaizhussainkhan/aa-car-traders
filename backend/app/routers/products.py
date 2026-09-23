"""
Product CRUD with auto-categorization/auto-sorting + reseller media ZIP downloads.

- Anyone can list/read products (read-only for non-admins).
- Only the admin (require_admin) can create, edit, delete, or restock.
- On create/update, the product is automatically attached to its Category and becomes
  instantly filterable by category and by vehicle make/model ("Shop by Model").
- Wholesale price is stripped from every response unless the caller is the admin or an
  APPROVED reseller (see _serialize / deps.can_see_wholesale).
"""
import io
import re
import uuid
import zipfile
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import can_see_wholesale, get_current_user, require_admin, require_reseller_or_admin
from app.models import Category, Product, ProductMedia, User
from app.schemas import ProductCreate, ProductOutPublic, ProductOutReseller, ProductUpdate
from app.utils.activity import log_activity

router = APIRouter(prefix="/api/products", tags=["products"])


def slugify(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "product"
    return f"{base[:80]}-{uuid.uuid4().hex[:6]}"


def _serialize(product: Product, user: User | None):
    if can_see_wholesale(user):
        return ProductOutReseller(
            **ProductOutPublic.model_validate(product).model_dump(),
            wholesale_price=product.wholesale_price,
            margin=product.margin(),
            sku=product.sku,
        )
    return ProductOutPublic.model_validate(product)


def _replace_media(db: Session, product: Product, images: list[str] | None, videos: list[str] | None):
    if images is not None:
        db.query(ProductMedia).filter(ProductMedia.product_id == product.id, ProductMedia.media_type == "image").delete()
        for url in dict.fromkeys(u.strip() for u in images if u and u.strip()):
            db.add(ProductMedia(product_id=product.id, url=url, media_type="image"))
    if videos is not None:
        db.query(ProductMedia).filter(ProductMedia.product_id == product.id, ProductMedia.media_type == "video").delete()
        for url in dict.fromkeys(u.strip() for u in videos if u and u.strip()):
            db.add(ProductMedia(product_id=product.id, url=url, media_type="video"))


def _base_query(db: Session):
    return db.query(Product).options(joinedload(Product.category), joinedload(Product.media))


# ---------------------------------------------------------------------------
# Listing / reading
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ProductOutPublic | ProductOutReseller])
def list_products(
    category_slug: str | None = None,
    vehicle_make: str | None = None,
    vehicle_model: str | None = None,
    include_inactive: bool = False,
    limit: int = Query(60, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    q = _base_query(db)
    if not (include_inactive and user and user.is_admin):  # only the admin may see hidden products
        q = q.filter(Product.is_active == True)  # noqa: E712
    if category_slug:
        q = q.join(Category).filter(Category.slug == category_slug)
    if vehicle_make:
        q = q.filter(Product.vehicle_make.ilike(f"%{vehicle_make}%"))
    if vehicle_model:
        q = q.filter(Product.vehicle_model.ilike(f"%{vehicle_model}%"))
    products = q.order_by(Product.created_at.desc()).offset(offset).limit(limit).all()
    return [_serialize(p, user) for p in products]


# ---------------------------------------------------------------------------
# ZIP media kits (approved resellers + admin). Declared BEFORE "/{product_id}".
# ---------------------------------------------------------------------------

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 400 * 1024 * 1024


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")[:60] or "item"


def _read_media_bytes(url: str, client: httpx.Client) -> bytes | None:
    """Local /media file -> read from disk. http(s) URL -> download (size-capped)."""
    try:
        if url.startswith("/media/"):
            path = (settings.media_path / url[len("/media/"):]).resolve()
            if settings.media_path.resolve() in path.parents and path.is_file() and path.stat().st_size <= MAX_FILE_BYTES:
                return path.read_bytes()
            return None
        if url.startswith(("http://", "https://")):
            with client.stream("GET", url) as r:
                r.raise_for_status()
                buf = bytearray()
                for chunk in r.iter_bytes():
                    buf.extend(chunk)
                    if len(buf) > MAX_FILE_BYTES:
                        return None
                return bytes(buf)
    except Exception:
        return None
    return None


def _product_details_text(p: Product) -> str:
    fits = f"{p.vehicle_make} {p.vehicle_model}" + (
        f" ({p.vehicle_year_from}-{p.vehicle_year_to or ''})" if p.vehicle_year_from else "")
    return "\n".join([
        "AA CAR TRADERS — PRODUCT DETAILS", "=" * 34,
        f"Title: {p.title}",
        f"Category: {p.category.name if p.category else ''}",
        f"Fits: {fits}",
        f"Retail price: PKR {p.retail_price:,.0f}",
        f"Wholesale price: PKR {p.wholesale_price:,.0f}",
        f"Stock: {p.stock_quantity}",
        "", "Description:", p.description,
        "", f"Product page: {settings.SITE_URL.rstrip('/')}/products/{p.slug}",
    ])


def _zip_products(products: list[Product], filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    total = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf, httpx.Client(timeout=12, follow_redirects=True) as client:
        for idx, p in enumerate(products, 1):
            folder = f"{idx:02d}_{_safe(p.title)}"
            zf.writestr(f"{folder}/details.txt", _product_details_text(p))
            urls = ([p.thumbnail_url] if p.thumbnail_url else []) + [m.url for m in p.media]
            if p.video_url:
                urls.append(p.video_url)
            missed = []
            for n, url in enumerate(dict.fromkeys(urls), 1):
                if total > MAX_TOTAL_BYTES:
                    missed.append(url)
                    continue
                data = _read_media_bytes(url, client)
                if data is None:
                    missed.append(url)
                    continue
                total += len(data)
                ext = Path(url.split("?")[0]).suffix.lower() or ".jpg"
                zf.writestr(f"{folder}/{n:02d}{ext}", data)
            if missed:
                zf.writestr(f"{folder}/_could_not_download.txt", "\n".join(missed))
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/bulk/media.zip")
def bulk_media_zip(category_slug: str | None = None, db: Session = Depends(get_db),
                   _u: User = Depends(require_reseller_or_admin)):
    q = _base_query(db).filter(Product.is_active == True)  # noqa: E712
    if category_slug:
        q = q.join(Category).filter(Category.slug == category_slug)
    products = q.order_by(Product.created_at.desc()).limit(200).all()
    if not products:
        raise HTTPException(status_code=404, detail="No products to export yet.")
    return _zip_products(products, f"aa-car-traders-{category_slug or 'all'}-media.zip")


@router.get("/{product_id}/media.zip")
def product_media_zip(product_id: str, db: Session = Depends(get_db), _u: User = Depends(require_reseller_or_admin)):
    p = _base_query(db).filter((Product.id == product_id) | (Product.slug == product_id)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return _zip_products([p], f"{_safe(p.title)}-media.zip")


@router.get("/{product_id}", response_model=ProductOutPublic | ProductOutReseller)
def get_product(product_id: str, db: Session = Depends(get_db), user: User | None = Depends(get_current_user)):
    product = _base_query(db).filter((Product.id == product_id) | (Product.slug == product_id)).first()
    if not product or (not product.is_active and not (user and user.is_admin)):
        raise HTTPException(status_code=404, detail="Product not found")
    return _serialize(product, user)


# ---------------------------------------------------------------------------
# Admin writes
# ---------------------------------------------------------------------------

@router.post("", response_model=ProductOutReseller, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="Invalid category")
    if payload.sku and db.query(Product).filter(Product.sku == payload.sku).first():
        raise HTTPException(status_code=400, detail="That SKU is already used by another product")

    data = payload.model_dump(exclude={"extra_media_urls", "extra_video_urls", "search_keywords"})
    product = Product(
        **data,
        slug=slugify(payload.title),
        search_keywords=payload.search_keywords
        or f"{payload.title} {payload.vehicle_make} {payload.vehicle_model} {category.name}",
    )
    if not product.thumbnail_url and payload.extra_media_urls:
        product.thumbnail_url = payload.extra_media_urls[0]
    db.add(product)
    db.flush()
    _replace_media(db, product, payload.extra_media_urls, payload.extra_video_urls)
    log_activity(db, "product_posted", f"Posted “{product.title}” in {category.name}", admin)
    db.commit()
    db.refresh(product)
    return _serialize(product, admin)


@router.put("/{product_id}", response_model=ProductOutReseller)
def update_product(product_id: str, payload: ProductUpdate, db: Session = Depends(get_db),
                   admin: User = Depends(require_admin)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    data = payload.model_dump(exclude_unset=True)
    images = data.pop("extra_media_urls", None)
    videos = data.pop("extra_video_urls", None)

    if data.get("category_id") and not db.query(Category).filter(Category.id == data["category_id"]).first():
        raise HTTPException(status_code=400, detail="Invalid category")
    if data.get("sku") and db.query(Product).filter(Product.sku == data["sku"], Product.id != product.id).first():
        raise HTTPException(status_code=400, detail="That SKU is already used by another product")

    was_active = product.is_active
    for field, value in data.items():
        setattr(product, field, value)
    _replace_media(db, product, images, videos)
    if "title" in data or "vehicle_make" in data or "vehicle_model" in data or "category_id" in data:
        db.flush()
        db.refresh(product)
        product.search_keywords = f"{product.title} {product.vehicle_make} {product.vehicle_model} {product.category.name}"

    if "is_active" in data and data["is_active"] != was_active:
        log_activity(db, "product_visibility", f"{'Activated' if product.is_active else 'Hid'} “{product.title}”", admin)
    else:
        log_activity(db, "product_updated", f"Updated “{product.title}”", admin)
    db.commit()
    db.refresh(product)
    return _serialize(product, admin)


@router.patch("/{product_id}/stock", response_model=ProductOutReseller)
def update_stock(product_id: str, quantity: int = Query(ge=0), db: Session = Depends(get_db),
                 admin: User = Depends(require_admin)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.stock_quantity = quantity
    log_activity(db, "stock_updated", f"Stock of “{product.title}” set to {quantity}", admin)
    db.commit()
    db.refresh(product)
    return _serialize(product, admin)


@router.delete("/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    title = product.title
    if product.order_items:
        # Keep order history intact: hide instead of hard-deleting.
        product.is_active = False
        log_activity(db, "product_archived", f"Archived “{title}” (has past orders)", admin)
        db.commit()
        return {"deleted": False, "archived": True}
    log_activity(db, "product_deleted", f"Deleted “{title}”", admin)
    db.delete(product)
    db.commit()
    return {"deleted": True, "archived": False}
