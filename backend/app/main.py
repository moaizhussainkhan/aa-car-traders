"""
AA Car Traders — entrypoint.
Creates tables, adds any new columns, seeds the single admin account, default
categories and site settings on startup, and serves the storefront + admin pages.
"""
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import BASE_DIR, settings
from app.database import Base, SessionLocal, engine
from app.demo_content import DEMO_BANNERS
from app.migrate import ensure_columns
from app.models import Banner, Category, Product, SiteSettings, User, UserRole
from app.routers import admin, ai, auth, banners, catalog, categories, media, orders, products, search, whatsapp
from app.routers.categories import DEFAULT_CATEGORIES, slugify
from app.utils.security import hash_password

log = logging.getLogger("aa")

INSECURE_SECRET = "insecure-dev-secret-change-me"
INSECURE_ADMIN_PW = "change-this-strong-password"


def check_production_settings() -> None:
    if settings.ENVIRONMENT.lower() == "production":
        problems = []
        if settings.SECRET_KEY == INSECURE_SECRET or len(settings.SECRET_KEY) < 32:
            problems.append("SECRET_KEY must be a random string of 32+ characters")
        if settings.ADMIN_PASSWORD == INSECURE_ADMIN_PW:
            problems.append("ADMIN_PASSWORD is still the default")
        if problems:
            raise RuntimeError("Refusing to start in production: " + "; ".join(problems))
    elif settings.SECRET_KEY == INSECURE_SECRET:
        log.warning("Using the default SECRET_KEY — fine for local development, NOT for production.")


def seed_initial_data() -> None:
    db = SessionLocal()
    try:
        # --- single admin account (idempotent) ---
        existing_admin = db.query(User).filter(User.is_admin == True).first()  # noqa: E712
        if not existing_admin:
            existing_email = db.query(User).filter(User.email == settings.ADMIN_EMAIL.lower()).first()
            if existing_email:
                existing_email.is_admin = True
                existing_email.role = UserRole.ADMIN
            else:
                db.add(User(
                    name=settings.ADMIN_NAME,
                    email=settings.ADMIN_EMAIL.lower(),
                    hashed_password=hash_password(settings.ADMIN_PASSWORD),
                    role=UserRole.ADMIN,
                    is_admin=True,
                ))
            db.commit()

        # --- default categories ---
        if db.query(Category).count() == 0:
            for name, slug, icon in DEFAULT_CATEGORIES:
                db.add(Category(name=name, slug=slug or slugify(name), icon=icon))
            db.commit()

        # --- site settings row + (first run only) demo hero banners ---
        if not db.query(SiteSettings).first():
            db.add(SiteSettings(
                id=1,
                whatsapp_number=settings.WHATSAPP_NUMBER,
                whatsapp_default_message=settings.WHATSAPP_DEFAULT_MESSAGE,
                contact_phone=settings.CONTACT_PHONE,
                contact_email=settings.CONTACT_EMAIL,
            ))
            if db.query(Banner).count() == 0:
                for b in DEMO_BANNERS:
                    db.add(Banner(**b))
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    check_production_settings()
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    settings.media_path.mkdir(parents=True, exist_ok=True)
    seed_initial_data()
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan,
              docs_url=None if settings.ENVIRONMENT.lower() == "production" else "/docs",
              redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, settings.SITE_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings.media_path.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(settings.media_path)), name="media")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
templates.env.globals.update(use_cdn=settings.USE_TAILWIND_CDN, site_url=settings.SITE_URL.rstrip("/"))

for r in (auth, categories, products, search, whatsapp, orders, ai, media, banners, catalog, admin):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "brand": "AA Car Traders", "tagline": "TRUST | QUALITY | SATISFACTION"}


# ---------------------------------------------------------------------------
# Public pages (what customers see at aacartraders.com)
# ---------------------------------------------------------------------------

def _page(request: Request, name: str, **ctx):
    return templates.TemplateResponse(name, {"request": request, **ctx})


@app.get("/", response_class=HTMLResponse)
def page_home(request: Request):
    return _page(request, "index.html")


@app.get("/products", response_class=HTMLResponse)
def page_products(request: Request):
    return _page(request, "products.html")


@app.get("/products/{slug}", response_class=HTMLResponse)
def page_product_detail(request: Request, slug: str):
    return _page(request, "product_detail.html", slug=slug)


@app.get("/login", response_class=HTMLResponse)
def page_login(request: Request):
    return _page(request, "login.html")


@app.get("/register", response_class=HTMLResponse)
def page_register(request: Request):
    return _page(request, "register.html")


@app.get("/reseller", response_class=HTMLResponse)
def page_reseller(request: Request):
    return _page(request, "reseller.html")


# ---------------------------------------------------------------------------
# Admin pages — a separate, unlinked address: /admin (log in at /admin/login)
# ---------------------------------------------------------------------------

@app.get("/admin/login", response_class=HTMLResponse)
def page_admin_login(request: Request):
    return _page(request, "admin_login.html")


@app.get("/admin", response_class=HTMLResponse)
def page_admin_dashboard(request: Request):
    return _page(request, "admin_dashboard.html")


@app.get("/admin/{rest:path}")
def page_admin_legacy(rest: str):
    # old links (/admin/products/new, /admin/register …) land on the dashboard
    return RedirectResponse("/admin#products" if rest.startswith("products") else "/admin", status_code=307)


# ---------------------------------------------------------------------------
# SEO helpers so Google can find "AA Car Traders"
# ---------------------------------------------------------------------------

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return RedirectResponse("/static/images/favicon.png")


@app.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
def robots():
    base = settings.SITE_URL.rstrip("/")
    return f"User-agent: *\nDisallow: /admin\nDisallow: /api/\nAllow: /\n\nSitemap: {base}/sitemap.xml\n"


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap():
    base = settings.SITE_URL.rstrip("/")
    db = SessionLocal()
    try:
        urls = [f"{base}/", f"{base}/products", f"{base}/reseller"]
        for c in db.query(Category).all():
            urls.append(f"{base}/products?category={c.slug}")
        for p in db.query(Product).filter(Product.is_active == True).all():  # noqa: E712
            urls.append(f"{base}/products/{p.slug}")
    finally:
        db.close()
    today = datetime.utcnow().date().isoformat()
    body = "".join(f"<url><loc>{u.replace('&', '&amp;')}</loc><lastmod>{today}</lastmod></url>" for u in urls)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    return Response(xml, media_type="application/xml")
