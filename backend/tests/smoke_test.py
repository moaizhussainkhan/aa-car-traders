"""
End-to-end smoke test of the API (uses a throw-away SQLite DB).
Run from the backend folder:   python tests/smoke_test.py
"""
import io
import os
import sys
import tempfile
import zipfile

tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{tmp}/test.db"
os.environ["MEDIA_DIR"] = f"{tmp}/media"
os.environ["ADMIN_EMAIL"] = "boss@example.com"
os.environ["ADMIN_PASSWORD"] = "A" * 150 + "!ورڈ"          # very long, non-ASCII
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402

ok = True


def check(label, cond, extra=""):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + label + (f"  {extra}" if extra and not cond else ""))


def png_bytes():
    b = io.BytesIO()
    Image.new("RGB", (40, 30), (200, 20, 20)).save(b, "PNG")
    return b.getvalue()


with TestClient(app) as c:
    check("health", c.get("/api/health").status_code == 200)

    # ---- pages render ----
    for path in ["/", "/products", "/products/x", "/login", "/register", "/reseller", "/admin/login", "/admin",
                 "/robots.txt", "/sitemap.xml"]:
        r = c.get(path)
        check(f"page {path}", r.status_code == 200, r.text[:200])
    check("legacy admin link redirects", c.get("/admin/products/new", follow_redirects=False).status_code == 307)

    # ---- auth separation ----
    r = c.post("/api/auth/admin-login", json={"email": "boss@example.com", "password": os.environ["ADMIN_PASSWORD"]})
    check("admin logs in (150+ char password)", r.status_code == 200, r.text)
    A = {"Authorization": "Bearer " + r.json()["access_token"]}
    check("admin blocked on public login", c.post("/api/auth/login", json={"email": "boss@example.com", "password": os.environ["ADMIN_PASSWORD"]}).status_code == 401)
    check("wrong admin password rejected", c.post("/api/auth/admin-login", json={"email": "boss@example.com", "password": "nope"}).status_code == 401)

    r = c.post("/api/auth/register", json={"name": "Cust", "email": "cust@x.com", "password": "p" * 120, "role": "customer"})
    check("customer register (120-char pw)", r.status_code == 201, r.text)
    check("customer cannot use admin-login", c.post("/api/auth/admin-login", json={"email": "cust@x.com", "password": "p" * 120}).status_code == 401)
    r = c.post("/api/auth/login", json={"email": "cust@x.com", "password": "p" * 120})
    check("customer login", r.status_code == 200)
    CU = {"Authorization": "Bearer " + r.json()["access_token"]}
    r = c.post("/api/auth/register", json={"name": "Reseller", "email": "rs@x.com", "password": "reseller-pass", "role": "reseller", "business_name": "RS Traders"})
    check("reseller register", r.status_code == 201 and r.json()["is_approved"] is False, r.text)
    r = c.post("/api/auth/register", json={"name": "Hax", "email": "hax@x.com", "password": "hackerpass1", "role": "admin"})
    check("cannot self-register as admin", r.status_code in (201, 422) and (r.status_code == 422 or r.json()["role"] != "admin"), r.text)
    RS = {"Authorization": "Bearer " + c.post("/api/auth/login", json={"email": "rs@x.com", "password": "reseller-pass"}).json()["access_token"]}

    # ---- upload ----
    r = c.post("/api/media/upload", files={"file": ("a.png", png_bytes(), "image/png")}, headers=A)
    check("admin uploads image", r.status_code == 200, r.text)
    img_url = r.json()["url"]
    check("uploaded file served", c.get(img_url).status_code == 200)
    check("customer cannot upload", c.post("/api/media/upload", files={"file": ("a.png", png_bytes(), "image/png")}, headers=CU).status_code == 403)
    check("fake image rejected", c.post("/api/media/upload", files={"file": ("a.png", b"not an image", "image/png")}, headers=A).status_code == 400)
    check("svg/exe rejected", c.post("/api/media/upload", files={"file": ("a.svg", b"<svg/>", "image/svg+xml")}, headers=A).status_code == 400)
    r = c.post("/api/media/upload", files={"file": ("v.mp4", b"\x00\x00\x00\x18ftypmp42" + b"0" * 100, "video/mp4")}, headers=A)
    check("admin uploads video", r.status_code == 200 and r.json()["media_type"] == "video", r.text)
    vid_url = r.json()["url"]

    # ---- products ----
    cats = c.get("/api/categories").json()
    check("categories seeded", len(cats) >= 5)
    body = {"title": "Test Body Kit", "description": "desc", "wholesale_price": 1000, "retail_price": 1500,
            "vehicle_make": "Toyota", "vehicle_model": "Camry", "category_id": cats[0]["id"], "stock_quantity": 5,
            "thumbnail_url": img_url, "video_url": vid_url, "extra_media_urls": [img_url],
            "whatsapp_number": "923001112223", "whatsapp_message": "Hello {title}", "sku": ""}
    r = c.post("/api/products", json=body, headers=A)
    check("admin creates product", r.status_code == 201, r.text)
    pid, slug = r.json()["id"], r.json()["slug"]
    check("customer cannot create product", c.post("/api/products", json=body, headers=CU).status_code == 403)
    check("guest cannot create product", c.post("/api/products", json=body).status_code == 401)

    pub = c.get(f"/api/products/{slug}").json()
    check("public view hides wholesale", "wholesale_price" not in pub)
    check("per-product whatsapp saved", pub["whatsapp_number"] == "923001112223")
    check("unapproved reseller cannot see wholesale", "wholesale_price" not in c.get(f"/api/products/{slug}", headers=RS).json())
    check("unapproved reseller blocked from zip", c.get(f"/api/products/{pid}/media.zip", headers=RS).status_code == 403)
    users = c.get("/api/admin/users", headers=A).json()
    rs_id = next(u["id"] for u in users if u["email"] == "rs@x.com")
    check("admin approves reseller", c.patch(f"/api/admin/users/{rs_id}", json={"is_approved": True}, headers=A).status_code == 200)
    check("approved reseller sees wholesale", c.get(f"/api/products/{slug}", headers=RS).json().get("wholesale_price") == 1000)

    z = c.get(f"/api/products/{pid}/media.zip", headers=RS)
    names = zipfile.ZipFile(io.BytesIO(z.content)).namelist() if z.status_code == 200 else []
    check("product ZIP has details + images", z.status_code == 200 and any(n.endswith("details.txt") for n in names) and any(n.endswith(".png") for n in names), str(names))
    z = c.get("/api/products/bulk/media.zip", headers=RS)
    check("bulk ZIP works", z.status_code == 200 and zipfile.is_zipfile(io.BytesIO(z.content)))

    r = c.put(f"/api/products/{pid}", json={"retail_price": 1600, "extra_media_urls": [], "is_active": True}, headers=A)
    check("admin edits product + replaces media", r.status_code == 200 and r.json()["retail_price"] == 1600 and not any(m["media_type"] == "image" for m in r.json()["media"]), r.text)
    check("search finds it", any(p["id"] == pid for p in c.get("/api/search", params={"q": "camry"}).json()))

    # ---- orders ----
    o = {"customer_name": "Ali Khan", "customer_phone": "03001234567", "customer_address": "Lahore", "items": [{"product_id": pid, "quantity": 2}]}
    r = c.post("/api/orders", json=o)
    check("guest order", r.status_code == 201 and r.json()["total_amount"] == 3200, r.text)
    oid = r.json()["id"]
    r = c.post("/api/orders", json={**o, "is_reseller_order": True, "reseller_margin_percent": 20})
    check("guest cannot get wholesale pricing", r.status_code == 201 and r.json()["total_amount"] == 3200 and not r.json()["is_reseller_order"], r.text)
    r = c.post("/api/orders", json={**o, "items": [{"product_id": pid, "quantity": 1}], "is_reseller_order": True, "reseller_margin_percent": 20}, headers=RS)
    check("approved reseller wholesale+margin", r.status_code == 201 and r.json()["total_amount"] == 1200, r.text)
    r = c.post("/api/orders", json={**o, "items": [{"product_id": pid, "quantity": 99}]})
    check("over-stock order rejected", r.status_code == 400, r.text)
    check("invoice pdf", c.get(f"/api/orders/{oid}/invoice.pdf").headers["content-type"] == "application/pdf")
    check("customer cannot list orders", c.get("/api/orders", headers=CU).status_code == 403)
    lst = c.get("/api/orders", headers=A).json()
    check("admin lists orders w/ product titles", lst and lst[0]["items"][0]["product_title"] == "Test Body Kit")
    r = c.patch(f"/api/orders/{oid}/status", json={"status": "cancelled"}, headers=A)
    # stock: 5 - 2 (guest) - 2 (guest, forced retail) - 1 (reseller) = 0, cancelling the first order gives 2 back
    check("admin cancels order (stock restored)", r.status_code == 200 and c.get(f"/api/products/{pid}", headers=A).json()["stock_quantity"] == 2, r.text)

    # ---- admin data ----
    st = c.get("/api/admin/stats", headers=A)
    check("admin stats", st.status_code == 200 and st.json()["orders_total"] >= 3 and len(st.json()["revenue_by_day"]) == 14, st.text)
    act = c.get("/api/admin/activity", headers=A).json()
    check("activity feed records actions", any(a["action"] == "product_posted" for a in act) and any(a["action"] == "order_placed" for a in act))
    check("customer cannot read stats", c.get("/api/admin/stats", headers=CU).status_code == 403)

    # ---- banners / settings / password ----
    check("public banners", c.get("/api/banners").status_code == 200 and len(c.get("/api/banners").json()) >= 1)
    r = c.post("/api/banners", json={"title": "T", "image_url": img_url}, headers=A)
    check("admin adds banner", r.status_code == 201)
    check("customer cannot add banner", c.post("/api/banners", json={"title": "T"}, headers=CU).status_code == 403)
    check("whatsapp config public", c.get("/api/whatsapp/config").json()["whatsapp_number"])
    r = c.put("/api/whatsapp/config", json={"whatsapp_number": "923009998887"}, headers=A)
    check("admin updates whatsapp config", r.status_code == 200 and r.json()["whatsapp_number"] == "923009998887")
    check("car models list", c.get("/api/catalog/car-models").json()["makes"])
    r = c.post("/api/auth/change-password", json={"current_password": "wrong", "new_password": "newpassword1"}, headers=CU)
    check("change-password checks current pw", r.status_code == 400)
    r = c.post("/api/auth/change-password", json={"current_password": "p" * 120, "new_password": "q" * 100}, headers=CU)
    check("change-password ok", r.status_code == 200 and c.post("/api/auth/login", json={"email": "cust@x.com", "password": "q" * 100}).status_code == 200)

    # ---- AI fallback ----
    r = c.post("/api/ai/chat", json={"message": "body kit for camry"})
    check("AI chat (no key -> catalog fallback)", r.status_code == 200 and r.json()["recommended_products"], r.text)

    # ---- delete with order history -> archived ----
    r = c.delete(f"/api/products/{pid}", headers=A)
    check("delete product with orders archives it", r.status_code == 200 and r.json()["archived"] is True, r.text)

print("\nALL PASSED" if ok else "\nSOME CHECKS FAILED")
sys.exit(0 if ok else 1)
