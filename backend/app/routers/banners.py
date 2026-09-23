"""Homepage hero carousel. Public read, admin write."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import Banner, User
from app.schemas import BannerIn, BannerOut
from app.utils.activity import log_activity

router = APIRouter(prefix="/api/banners", tags=["banners"])


@router.get("", response_model=list[BannerOut])
def list_active(db: Session = Depends(get_db)):
    return db.query(Banner).filter(Banner.is_active == True).order_by(Banner.sort_order, Banner.created_at).all()  # noqa: E712


@router.get("/all", response_model=list[BannerOut])
def list_all(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(Banner).order_by(Banner.sort_order, Banner.created_at).all()


@router.post("", response_model=BannerOut, status_code=201)
def create_banner(payload: BannerIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    b = Banner(**payload.model_dump())
    db.add(b)
    log_activity(db, "banner_added", f"Banner added: {payload.title}", admin)
    db.commit()
    db.refresh(b)
    return b


@router.put("/{banner_id}", response_model=BannerOut)
def update_banner(banner_id: str, payload: BannerIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    b = db.query(Banner).filter(Banner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")
    for k, v in payload.model_dump().items():
        setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return b


@router.delete("/{banner_id}", status_code=204)
def delete_banner(banner_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    b = db.query(Banner).filter(Banner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")
    log_activity(db, "banner_removed", f"Banner removed: {b.title}", admin)
    db.delete(b)
    db.commit()
