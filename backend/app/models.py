"""
SQLAlchemy ORM models: Users, Categories, Products, Vehicle Compatibility,
Product Media, Orders, and WhatsApp/Site Settings.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    ADMIN = "admin"          # exactly one row may hold this role
    RESELLER = "reseller"    # sees wholesale prices + margin tools
    CUSTOMER = "customer"    # public, read-only, retail prices only


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(120), nullable=False)
    email = Column(String(180), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER, nullable=False)

    # Strict RBAC flag. Only ONE row in the whole table may ever have this True;
    # enforced in app/routers/auth.py at account-creation/promotion time.
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    # Resellers register as unapproved; wholesale prices stay hidden until the admin approves them.
    is_approved = Column(Boolean, default=True, nullable=False)

    phone = Column(String(30), nullable=True)
    business_name = Column(String(160), nullable=True)  # for resellers
    created_at = Column(DateTime, default=datetime.utcnow)

    orders = relationship("Order", back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(80), unique=True, nullable=False)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    icon = Column(String(50), nullable=True)  # lucide-react icon name for UI

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String(200), nullable=False, index=True)
    slug = Column(String(220), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)

    # Pricing
    wholesale_price = Column(Float, nullable=False)   # reseller-only, never public
    retail_price = Column(Float, nullable=False)      # shown to everyone

    # Vehicle compatibility (simple denormalized fields for fast filtering)
    vehicle_make = Column(String(80), nullable=False, index=True)
    vehicle_model = Column(String(80), nullable=False, index=True)
    vehicle_year_from = Column(Integer, nullable=True)
    vehicle_year_to = Column(Integer, nullable=True)

    category_id = Column(String, ForeignKey("categories.id"), nullable=False)
    category = relationship("Category", back_populates="products")

    stock_quantity = Column(Integer, default=0, nullable=False)
    sku = Column(String(60), unique=True, nullable=True)

    thumbnail_url = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=True)

    # Optional per-product WhatsApp overrides (fall back to the site-wide settings)
    whatsapp_number = Column(String(20), nullable=True)
    whatsapp_message = Column(String(255), nullable=True)

    # Simple vector-ish text blob used by the AI visual-search / RAG stub
    search_keywords = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    media = relationship("ProductMedia", back_populates="product", cascade="all, delete-orphan")
    order_items = relationship("OrderItem", back_populates="product")

    def margin(self) -> float:
        return round(self.retail_price - self.wholesale_price, 2)


class ProductMedia(Base):
    """Extra HD images for the bulk media downloader."""
    __tablename__ = "product_media"

    id = Column(String, primary_key=True, default=gen_uuid)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    url = Column(String(500), nullable=False)
    media_type = Column(String(20), default="image")  # image | video

    product = relationship("Product", back_populates="media")


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    order_number = Column(String(30), unique=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)  # null for guest checkout

    customer_name = Column(String(160), nullable=False)
    customer_phone = Column(String(30), nullable=False)
    customer_address = Column(Text, nullable=True)

    is_reseller_order = Column(Boolean, default=False)
    reseller_margin_percent = Column(Float, default=0.0)  # applied on top of wholesale

    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    total_amount = Column(Float, default=0.0)

    # Leopards Courier booking — populated once the admin books a shipment.
    courier_tracking_number = Column(String(60), nullable=True)
    courier_status = Column(String(60), nullable=True)
    courier_booked_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, default=gen_uuid)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)

    quantity = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False)  # price actually charged (retail or wholesale+margin)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

    @property
    def product_title(self) -> str | None:
        return self.product.title if self.product else None


class SiteSettings(Base):
    """Single-row table the Admin Dashboard edits (WhatsApp number, brand toggles, etc)."""
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True, default=1)
    whatsapp_number = Column(String(20), default="923154448835")
    whatsapp_default_message = Column(String(255), default="Hi AA Car Traders, I'm interested in this product:")
    contact_phone = Column(String(30), default="03154448835")
    contact_email = Column(String(120), default="aacartrad3rs@gmail.com")
    site_announcement = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActivityLog(Base):
    """Admin 'Activity Feed' — who did what, newest first."""
    __tablename__ = "activity_log"

    id = Column(String, primary_key=True, default=gen_uuid)
    action = Column(String(40), nullable=False)      # product_posted, order_placed, ...
    detail = Column(String(300), nullable=False)
    actor = Column(String(160), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Banner(Base):
    """Homepage hero carousel slides, managed from Admin → Settings."""
    __tablename__ = "banners"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String(120), nullable=False)
    subtitle = Column(String(200), nullable=True)
    cta_text = Column(String(40), nullable=True)
    cta_link = Column(String(200), nullable=True)
    image_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
