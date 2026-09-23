"""
Category CRUD. Reads are public; writes are admin-only.
Categories drive the 'Shop by Category' sections and product auto-sorting.
"""
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import Category, User
from app.schemas import CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])

DEFAULT_CATEGORIES = [
    ("Body Kits", "body-kits", "Layers"),
    ("LED Lights", "led-lights", "Lightbulb"),
    ("Spoilers", "spoilers", "Wind"),
    ("Interior", "interior", "Armchair"),
    ("Exterior", "exterior", "Car"),
    ("Alloy Wheels", "alloy-wheels", "Disc"),
    ("Audio Systems", "audio-systems", "Speaker"),
]


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(name: str, description: str | None = None, icon: str | None = None,
                     db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    slug = slugify(name)
    if db.query(Category).filter(Category.slug == slug).first():
        raise HTTPException(status_code=400, detail="Category already exists")
    cat = Category(name=name, slug=slug, description=description, icon=icon)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
