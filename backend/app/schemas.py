"""
Pydantic request/response schemas.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import OrderStatus, UserRole


def _blank_to_none(v):
    if isinstance(v, str) and not v.strip():
        return None
    return v.strip() if isinstance(v, str) else v


# ---------- Auth / Users ----------

class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    business_name: Optional[str] = Field(default=None, max_length=160)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=256)
    role: UserRole = UserRole.CUSTOMER  # a client can never self-register as ADMIN


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role: UserRole
    is_admin: bool
    is_active: bool
    is_approved: bool = True
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=256)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


# ---------- Categories ----------

class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None


# ---------- Products ----------

class ProductMediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    url: str
    media_type: str


class ProductCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=1)
    wholesale_price: float = Field(ge=0)
    retail_price: float = Field(ge=0)
    vehicle_make: str = Field(min_length=1, max_length=80)
    vehicle_model: str = Field(min_length=1, max_length=80)
    vehicle_year_from: Optional[int] = None
    vehicle_year_to: Optional[int] = None
    category_id: str
    stock_quantity: int = Field(default=0, ge=0)
    sku: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    whatsapp_number: Optional[str] = None
    whatsapp_message: Optional[str] = Field(default=None, max_length=255)
    search_keywords: Optional[str] = None
    extra_media_urls: list[str] = []
    extra_video_urls: list[str] = []

    _clean = field_validator("sku", "thumbnail_url", "video_url", "whatsapp_number",
                             "whatsapp_message", "search_keywords", mode="before")(_blank_to_none)


class ProductUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = None
    wholesale_price: Optional[float] = Field(default=None, ge=0)
    retail_price: Optional[float] = Field(default=None, ge=0)
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year_from: Optional[int] = None
    vehicle_year_to: Optional[int] = None
    category_id: Optional[str] = None
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    sku: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    whatsapp_number: Optional[str] = None
    whatsapp_message: Optional[str] = Field(default=None, max_length=255)
    search_keywords: Optional[str] = None
    is_active: Optional[bool] = None
    # When present these REPLACE the product's extra media
    extra_media_urls: Optional[list[str]] = None
    extra_video_urls: Optional[list[str]] = None

    _clean = field_validator("sku", "thumbnail_url", "video_url", "whatsapp_number",
                             "whatsapp_message", mode="before")(_blank_to_none)


class ProductOutPublic(BaseModel):
    """What customers/guests see — NO wholesale price, ever."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    slug: str
    description: str
    retail_price: float
    vehicle_make: str
    vehicle_model: str
    vehicle_year_from: Optional[int]
    vehicle_year_to: Optional[int]
    category: CategoryOut
    stock_quantity: int
    thumbnail_url: Optional[str]
    video_url: Optional[str]
    whatsapp_number: Optional[str] = None
    whatsapp_message: Optional[str] = None
    media: list[ProductMediaOut] = []
    is_active: bool
    created_at: Optional[datetime] = None


class ProductOutReseller(ProductOutPublic):
    """What approved resellers/admin see — includes wholesale price + computed margin."""
    wholesale_price: float
    margin: float
    sku: Optional[str] = None


# ---------- WhatsApp / Settings ----------

class SiteSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    whatsapp_number: str
    whatsapp_default_message: str
    contact_phone: str
    contact_email: str
    site_announcement: Optional[str] = None


class SiteSettingsUpdate(BaseModel):
    whatsapp_number: Optional[str] = None
    whatsapp_default_message: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    site_announcement: Optional[str] = None


# ---------- Banners ----------

class BannerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    subtitle: Optional[str] = None
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class BannerIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    subtitle: Optional[str] = Field(default=None, max_length=200)
    cta_text: Optional[str] = Field(default=None, max_length=40)
    cta_link: Optional[str] = Field(default=None, max_length=200)
    image_url: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True

    _clean = field_validator("subtitle", "cta_text", "cta_link", "image_url", mode="before")(_blank_to_none)


# ---------- Orders ----------

class OrderItemCreate(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=999)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=160)
    customer_phone: str = Field(min_length=7, max_length=30)
    customer_address: Optional[str] = Field(default=None, max_length=500)
    is_reseller_order: bool = False
    reseller_margin_percent: float = Field(default=0.0, ge=0, le=500)
    items: list[OrderItemCreate] = Field(min_length=1, max_length=50)


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    product_id: str
    product_title: Optional[str] = None
    quantity: int
    unit_price: float


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_number: str
    customer_name: str
    customer_phone: str
    customer_address: Optional[str] = None
    is_reseller_order: bool = False
    status: OrderStatus
    total_amount: float
    courier_tracking_number: Optional[str] = None
    courier_status: Optional[str] = None
    courier_booked_at: Optional[datetime] = None
    created_at: datetime
    items: list[OrderItemOut]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# ---------- Activity ----------

class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    action: str
    detail: str
    actor: Optional[str] = None
    created_at: datetime


# ---------- AI ----------

class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    session_id: Optional[str] = None


class AIChatResponse(BaseModel):
    reply: str
    recommended_product_ids: list[str] = []
    recommended_products: list[ProductOutPublic] = []


class VisualSearchResponse(BaseModel):
    matches: list[ProductOutPublic]
    note: str
