# AA Car Traders

**TRUST | QUALITY | SATISFACTION**

Car-accessories & modification-parts store — **100% Python** (FastAPI + Jinja2 + vanilla JS, no Node needed to run it).
Storefront for customers, a separate hidden admin panel, a reseller portal with wholesale tools, an AI parts adviser
(chat + voice + photo) and direct WhatsApp ordering.

- Phone: 03154448835 · Email: aacartrad3rs@gmail.com  (both editable in Admin → Settings)

## Quick start (local)

```bash
cd backend
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                # then edit: SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
python seed_demo_data.py            # optional: demo products (remove later with --clear)
```

Open **http://localhost:8000**

| Who | Address | Notes |
|---|---|---|
| Customers | `/` | No login needed to browse, search or order (Cash on Delivery). |
| Customer / reseller login | `/login`, `/register` | Resellers wait for admin approval before they see wholesale prices. |
| Reseller portal | `/reseller` | Profit calculator, bulk ZIP downloader, wholesale catalog. |
| **Admin** | **`/admin/login`** | Separate, not linked anywhere on the public site. Login = `ADMIN_EMAIL` + `ADMIN_PASSWORD` from `.env`. |

> Changed `ADMIN_EMAIL` / `ADMIN_PASSWORD` after the first start? Run `python reset_admin.py` to apply them to the existing account.

## What's in the admin panel (`/admin`)

- **Products** – the posting screen: title, category + car-model dropdown, wholesale/retail price, description,
  drag-and-drop HD photo/video upload with progress bars, per-product WhatsApp number + pre-filled message,
  posted products grouped by category (sort by date/price, edit, hide, delete) and a live Activity Feed.
  Whatever you post appears on the storefront immediately.
- **Dashboard** – revenue, pending orders, low stock, recent activity.
- **Orders** – status updates, invoice PDF, one-tap WhatsApp to the customer, and **Book with Leopards Courier**
  (generates a tracking number, moves the order to *Shipped*, and lets you re-check live status — runs in a
  mock mode with a fake `MOCK-` tracking number until you add real `LEOPARDS_API_KEY`/`LEOPARDS_API_PASSWORD`
  in `.env`, so you can test the whole flow before your merchant account is approved).
- **Customers** – approve / revoke resellers, disable accounts.
- **Analytics** – 14-day revenue chart, best sellers, orders by status.
- **Settings** – WhatsApp & contact details, announcement bar, homepage hero banners, change password.

## Storefront features

Search bar, *Shop by Model* menu, Modifications / Interior & Exterior groups, hero slider (managed in Settings),
product cards with **Visual Search · Buy on WhatsApp · Wholesale Details · Place Order**, cart + checkout with
WhatsApp order confirmation, Reseller Tools, and the floating **AI Adviser** (English / اردو, voice input, read-aloud, photo upload).

## Project layout

```
backend/
  app/                 FastAPI app: models, schemas, routers (auth, products, orders, media, banners, admin, ai …)
  app/utils/leopards.py  Leopards Courier booking + tracking (mock mode if no API keys set)
  templates/           Jinja2 pages (base, header/footer partials, storefront, admin)
  static/css/          tailwind.css (pre-built) + style.css (custom)
  static/js/           api.js · shop-ui.js (cart/checkout) · navbar.js · product-card.js · home.js · products.js
                       product-detail.js · reseller.js · calculator.js · auth-forms.js · ai-widget.js · admin.js
  static/images/       logo.png (header) · logo-full.jpg (original) · favicon.png · placeholder.svg
  media/               uploaded product photos/videos (created automatically)
  tests/smoke_test.py  end-to-end API test:  python tests/smoke_test.py
  seed_demo_data.py    demo products/banners (--clear removes them)
  reset_admin.py       re-apply ADMIN_EMAIL / ADMIN_PASSWORD
deploy/                Caddyfile + production env template
Dockerfile, docker-compose.yml   one-command production stack with automatic HTTPS
DEPLOY.md              step-by-step: put the site on aacartraders.com
```

## Editing the design

The site uses a **pre-built** Tailwind stylesheet (`static/css/tailwind.css`), so it loads fast and needs no internet CDN.
If you change templates/JS and use a Tailwind class that isn't already in the site, either:

1. set `USE_TAILWIND_CDN=true` in `.env` (quick, works without Node), **or**
2. rebuild the CSS (needs Node once): `cd backend && npx tailwindcss@3 -c tailwind.config.js -i static/css/input.css -o static/css/tailwind.css --minify`

## Notes

- **Photos:** the demo photos are Unsplash placeholders. Post your real products with your own photos from Admin → Products.
- **AI Adviser:** uses Groq (`GROQ_MODEL` in `.env` — change it if Groq retires a model). Without a key it falls back to catalog matching.
  *Visual search* currently matches by the make/model you type next to the photo — true image recognition needs a vision model (future upgrade).
- **Security built in:** wholesale prices never leave the server for non-approved users, guests can't order at wholesale price,
  uploads are type/size-checked, admin login is rate-limited, production mode refuses default secrets.
- **Delivery:** *Book with Leopards Courier* on any order (Admin → Orders) books a shipment and tracks it. See
  `LEOPARDS_*` in `.env.example` — mock mode works out of the box; add real credentials from your Leopards
  merchant account when you have them.

### Before going live — checklist

1. Set a real, random `SECRET_KEY` (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) and a strong
   `ADMIN_PASSWORD` — production mode already refuses to start with the placeholder values.
2. Set `ENVIRONMENT=production` in `.env`.
3. Serve the site over **HTTPS** (see `DEPLOY.md` / `docker-compose.yml` for the Caddy-based automatic-HTTPS setup).
4. Switch `DATABASE_URL` to Postgres if you expect meaningful traffic/order volume.
5. Confirm your real `WHATSAPP_NUMBER` is an active WhatsApp account (test it directly in WhatsApp first).
6. Add real `LEOPARDS_API_KEY` / `LEOPARDS_API_PASSWORD` once your Leopards merchant account is approved.
7. New reseller sign-ups start **unapproved** (`is_approved=False`) — approve them from Admin → Customers before
   they should see wholesale pricing.
