"""
Real-time search: keyword + car-model filtering across the catalog.
Simple, fast SQL LIKE search — swappable later for Postgres full-text or a vector DB.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.models import Product, Category, User
from app.routers.products import _serialize
from app.schemas import ProductOutPublic, ProductOutReseller

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=list[ProductOutPublic | ProductOutReseller])
def search_products(
    q: str = Query(..., min_length=1, description="Keyword, car model, or part name"),
    limit: int = 30,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    like = f"%{q}%"
    results = (
        db.query(Product)
        .join(Category)
        .options(joinedload(Product.category), joinedload(Product.media))
        .filter(Product.is_active == True)  # noqa: E712
        .filter(
            or_(
                Product.title.ilike(like),
                Product.description.ilike(like),
                Product.vehicle_make.ilike(like),
                Product.vehicle_model.ilike(like),
                Product.search_keywords.ilike(like),
                Category.name.ilike(like),
            )
        )
        .order_by(Product.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize(p, user) for p in results]
