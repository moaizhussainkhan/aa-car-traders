"""
Builds pre-filled 'Buy on WhatsApp' deep links (wa.me) for product cards,
using the number/message configured in SiteSettings.
"""
from urllib.parse import quote

from app.models import Product, SiteSettings


def build_product_whatsapp_link(product: Product, settings_row: SiteSettings, page_url: str) -> str:
    number = "".join(ch for ch in settings_row.whatsapp_number if ch.isdigit())
    text = (
        f"{settings_row.whatsapp_default_message}\n\n"
        f"*{product.title}*\n"
        f"Price: PKR {product.retail_price:,.0f}\n"
        f"Category: {product.category.name if product.category else ''}\n"
        f"Fits: {product.vehicle_make} {product.vehicle_model}\n"
        f"Link: {page_url}"
    )
    return f"https://wa.me/{number}?text={quote(text)}"
