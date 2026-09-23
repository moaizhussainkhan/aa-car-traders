"""
WhatsApp configuration (admin-editable) + per-product deep-link generator
used by the 'Buy on WhatsApp' button and the floating icon.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.utils.activity import log_activity
from app.models import SiteSettings, Product, User
from app.schemas import SiteSettingsOut, SiteSettingsUpdate
from app.utils.whatsapp import build_product_whatsapp_link
from app.config import settings as env_settings

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


def _get_or_create_settings(db: Session) -> SiteSettings:
    row = db.query(SiteSettings).first()
    if not row:
        row = SiteSettings(
            id=1,
            whatsapp_number=env_settings.WHATSAPP_NUMBER,
            whatsapp_default_message=env_settings.WHATSAPP_DEFAULT_MESSAGE,
            contact_phone=env_settings.CONTACT_PHONE,
            contact_email=env_settings.CONTACT_EMAIL,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/config", response_model=SiteSettingsOut)
def get_config(db: Session = Depends(get_db)):
    return _get_or_create_settings(db)


@router.put("/config", response_model=SiteSettingsOut)
def update_config(payload: SiteSettingsUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    row = _get_or_create_settings(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    log_activity(db, "settings_updated", "WhatsApp / contact settings updated", admin)
    db.commit()
    db.refresh(row)
    return row


@router.get("/link/{product_id}")
def get_product_whatsapp_link(product_id: str, page_url: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    row = _get_or_create_settings(db)
    return {"whatsapp_link": build_product_whatsapp_link(product, row, page_url)}
