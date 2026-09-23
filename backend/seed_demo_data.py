"""
Optional demo content so the storefront has products/banners to show immediately.

    python seed_demo_data.py            # add demo products (+ hero banners if you have none)
    python seed_demo_data.py --clear    # remove every demo product again

Demo products have an SKU starting with "DEMO-". Their photos are Unsplash placeholders —
post your real products (with real photos) from the admin panel.
"""
import sys

from app.database import Base, SessionLocal, engine
from app.demo_content import DEMO_BANNERS, DEMO_PRODUCTS, img
from app.migrate import ensure_columns
from app.models import Banner, Category, Product

Base.metadata.create_all(bind=engine)
ensure_columns()
db = SessionLocal()

if "--clear" in sys.argv:
    removed = archived = 0
    for p in db.query(Product).filter(Product.sku.like("DEMO-%")).all():
        if p.order_items:
            p.is_active = False
            archived += 1
        else:
            db.delete(p)
            removed += 1
    db.commit()
    print(f"Removed {removed} demo products ({archived} hidden because they have orders).")
    raise SystemExit

cat_map = {c.slug: c for c in db.query(Category).all()}
if not cat_map:
    raise SystemExit("Run the server once first (it creates the categories), then re-run this script.")

added = 0
for i, (title, cat, make, model, y1, y2, wholesale, retail, stock, photo, desc) in enumerate(DEMO_PRODUCTS, 1):
    if db.query(Product).filter(Product.title == title).first() or cat not in cat_map:
        continue
    db.add(Product(
        title=title, slug=f"{title.lower().replace(' ', '-').replace('—', '')}-{i}", description=desc,
        wholesale_price=wholesale, retail_price=retail, vehicle_make=make, vehicle_model=model,
        vehicle_year_from=y1, vehicle_year_to=y2, category_id=cat_map[cat].id, stock_quantity=stock,
        sku=f"DEMO-{i:03d}", thumbnail_url=img(photo, 900),
        search_keywords=f"{title} {make} {model} {cat_map[cat].name}",
    ))
    added += 1

if db.query(Banner).count() == 0:
    for b in DEMO_BANNERS:
        db.add(Banner(**b))

db.commit()
print(f"Seeded {added} demo products (skipped any that already exist).")
db.close()
