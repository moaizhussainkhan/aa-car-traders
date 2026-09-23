"""
Demo banners + products used on first run and by seed_demo_data.py.

The photos are hot-linked from Unsplash (free to use). They are placeholders so the
storefront looks alive on day one — replace them with your own real product photos
from Admin → Products (drag & drop upload), or remove all demo items with:
    python seed_demo_data.py --clear
Demo products carry an SKU starting with "DEMO-".
"""
U = "https://images.unsplash.com/{}?auto=format&fit=crop&w={}&q=75"


def img(photo_id: str, w: int = 900) -> str:
    return U.format(photo_id, w)


DEMO_BANNERS = [
    dict(title="Latest Uplift Kits", subtitle="Customised body kits & lift kits for SUVs and sedans — fitted to your exact model.",
         cta_text="Shop Body Kits", cta_link="/products?category=body-kits", image_url=img("photo-1533473359331-0135ef1b58bf", 1600), sort_order=1),
    dict(title="Sequential LED Lighting", subtitle="Matrix headlights, tail lights & DRLs with a genuine OEM-fit finish.",
         cta_text="Shop LED Lights", cta_link="/products?category=led-lights", image_url=img("photo-1492144534655-ae79c964c9d7", 1600), sort_order=2),
    dict(title="GT Spoilers & Aero", subtitle="Carbon-look spoilers, lips and side skirts that change the whole stance.",
         cta_text="Shop Spoilers", cta_link="/products?category=spoilers", image_url=img("photo-1494976388531-d1058494cdd8", 1600), sort_order=3),
]

# (title, category_slug, make, model, year_from, year_to, wholesale, retail, stock, photo_id, description)
DEMO_PRODUCTS = [
    ("Carbon Fiber Front Lip Body Kit", "body-kits", "Honda", "Civic", 2016, 2021, 28000, 39500, 6, "photo-1503376780353-7e6692767b70",
     "Full carbon-fiber front lip kit, direct bolt-on, aggressive track-ready styling."),
    ("Wide Body Kit — Sports Package", "body-kits", "Toyota", "Camry", 2018, 2024, 64000, 89000, 3, "photo-1555215695-3004980ad54e",
     "Front bumper, side skirts and rear diffuser package with paint-ready finish."),
    ("Sequential LED Matrix Headlights", "led-lights", "Toyota", "Corolla", 2019, 2024, 22000, 32000, 10, "photo-1492144534655-ae79c964c9d7",
     "Full LED matrix headlight set with sequential turn signals and DRL."),
    ("Smoked LED Tail Light Set", "led-lights", "Honda", "City", 2017, 2023, 14500, 21900, 8, "photo-1542362567-b07e54358753",
     "Dark-smoke LED tail lights with dynamic sweeping indicators."),
    ("GT Style Rear Carbon Spoiler", "spoilers", "Suzuki", "Swift", 2018, 2024, 15000, 23500, 14, "photo-1493238792000-8113da705763",
     "Lightweight GT-style rear spoiler in real carbon weave finish."),
    ("Duckbill Trunk Spoiler", "spoilers", "Honda", "Civic", 2016, 2021, 9000, 14500, 12, "photo-1552519507-da3b142c6e3d",
     "ABS duckbill spoiler with 3M tape mounting — no drilling needed."),
    ("Premium Alcantara Steering Wheel Cover", "interior", "Universal", "Universal", None, None, 4500, 7900, 25, "photo-1600661653561-629509216228",
     "Hand-stitched Alcantara steering wheel wrap with red centre stripe."),
    ("Gloss Black Side Skirts Set", "exterior", "Honda", "City", 2017, 2023, 9500, 15500, 8, "photo-1533473359331-0135ef1b58bf",
     "OEM-fit gloss black side skirt extensions, paint-matchable."),
    ("18-inch Forged Alloy Wheel Set", "alloy-wheels", "Toyota", "Yaris", 2020, 2024, 85000, 118000, 4, "photo-1626668893632-6f3a4466d22f",
     "Lightweight 18-inch forged alloy wheels, set of 4, multiple finishes."),
]
