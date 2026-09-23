# aacartraders.com par website live karna

Ye guide step-by-step batati hai ke customers browser mein **aacartraders.com** likhein aur poori website khul jaye.

> Domain kharidna aur server lena aap ke apne account se hota hai (paisay lagte hain) — ye code us ke liye tayyar hai.

## 1) Domain kharidein
- `aacartraders.com` kisi registrar se lein (Namecheap, GoDaddy, Porkbun …). Pehle check karein ke available hai.
- Agar `.com` available nahi to koi aur naam / `.pk` (PKNIC ke registrars) bhi chal sakta hai — bas neeche `aacartraders.com` ki jagah apna domain likhein.

## 2) Server lein (VPS)
- Ubuntu 22.04/24.04 wala chota VPS kaafi hai (1–2 GB RAM): Hetzner, DigitalOcean, Contabo, Vultr …
- Server ka **IP address** note karein.

## 3) DNS set karein (domain ke panel mein)
| Type | Name | Value |
|---|---|---|
| A | `@` | server ka IP |
| A (ya CNAME) | `www` | server ka IP (ya `aacartraders.com`) |

DNS phailne mein 5 minute se kuch ghantay lag sakte hain.

## 4) Server par Docker lagayein
```bash
ssh root@SERVER_IP
curl -fsSL https://get.docker.com | sh
```

## 5) Project server par copy karein
Apne computer se (zip khol kar) folder upload karein, misal:
```bash
scp -r aa-car-traders root@SERVER_IP:/opt/
ssh root@SERVER_IP
cd /opt/aa-car-traders
```

## 6) Production settings banayein
```bash
cp deploy/env.production.example deploy/.env.production
nano deploy/.env.production
```
Ye lines zaroor badlein:
- `SECRET_KEY` → lambi random string. Banane ke liye: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
- `ADMIN_EMAIL` aur `ADMIN_PASSWORD` → aap ki admin login (lambi password bhi theek hai)
- `GROQ_API_KEY` → aap ki Groq key
- `SITE_URL=https://aacartraders.com`

> `ENVIRONMENT=production` mein agar default `SECRET_KEY` / `ADMIN_PASSWORD` rahe to app jaan-boojh kar start hi nahi hoti (security).

Agar domain `aacartraders.com` nahi hai to `deploy/Caddyfile` mein bhi domain badal dein.

## 7) Start karein
```bash
docker compose up -d --build
```
Caddy khud HTTPS certificate (Let's Encrypt) le leta hai. 1–2 minute baad **https://aacartraders.com** kholein.

- Customers ki site: `https://aacartraders.com`
- Admin login (alag link, kahin nazar nahi aata): `https://aacartraders.com/admin/login`

## 8) Google par aane ke liye
1. https://search.google.com/search-console → apna domain add karein.
2. Sitemap submit karein: `https://aacartraders.com/sitemap.xml`
3. Google ko site index karne mein kuch din/hafte lag sakte hain. Lekin jo customer seedha **aacartraders.com** likhe, us ke liye site DNS set hotay hi khul jati hai.

## Roz-marra kaam
```bash
docker compose logs -f app        # logs dekhna
docker compose restart app        # restart
# update: nayi files copy karein, phir
docker compose up -d --build
```
**Backup:** database aur upload ki hui photos Docker volume `app_data` mein hain:
```bash
docker run --rm -v aa-car-traders_app_data:/data -v $PWD:/backup alpine tar czf /backup/aa-backup.tgz /data
```
(volume ka naam `docker volume ls` se check kar lein.)

Bara business ho jaye to `DATABASE_URL` ko PostgreSQL par laga dein (README dekhein).
