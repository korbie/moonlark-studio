# Moonlark Studio

E-commerce site for selling handmade crochet items — **[moonlarkstudio.com](https://moonlarkstudio.com)** (domain not yet owned).

This is a custom store built on the **cost-minimized stack**: a Medusa v2
commerce backend + a Next.js storefront, deployed to DigitalOcean App Platform,
using free external tiers for the database, cache, and image storage.

> ⚠️ **Everything is placeholders.** No domain, DigitalOcean app, database,
> Stripe account, or image bucket exists yet. This repo is the scaffold; the
> steps below provision the real services and fill in the blanks.

---

## Architecture

```
                 moonlarkstudio.com  (DigitalOcean App Platform)
                 ┌─────────────────────────────────────────────┐
   visitors ───► │  storefront (Next.js, :8000)  ── "/"         │
                 │  backend   (Medusa v2, :9000) ── /store /admin│
                 └─────────────────────────────────────────────┘
                          │            │              │
                          ▼            ▼              ▼
                   Neon Postgres   Upstash Redis   Cloudflare R2
                    (free, DB)    (free, optional)  (free, images)
                                       │
                                       ▼
                                    Stripe (payments)
```

| Concern         | Service                         | Cost                         |
|-----------------|---------------------------------|------------------------------|
| App hosting     | DigitalOcean App Platform       | ~$5–17/mo (2 small services) |
| Database        | Neon Postgres (free tier)       | $0                           |
| Cache/events    | Upstash Redis (free, optional)  | $0                           |
| Product images  | Cloudflare R2 (free tier)       | $0                           |
| Payments        | Stripe                          | per-sale fees only           |
| Domain          | your registrar                  | ~$12–15/yr                   |

**In-person sales (markets/events):** the store includes a free **Local
Pickup** checkout option, but a website can't run a card reader. For card
payments at craft fairs, pair this with **Square** (free POS app + ~$10 reader)
or **Stripe Tap to Pay** on your phone, and reconcile inventory afterward.

---

## Repository layout

```
moonlark-studio/
├── backend/        # Medusa v2 commerce backend + admin (port 9000)
│   ├── medusa-config.ts     # R2 file storage, Stripe, optional Redis
│   ├── src/scripts/seed.ts  # Moonlark sample data (crochet products)
│   ├── .env.template        # backend env placeholders
│   └── Dockerfile
├── storefront/     # Next.js storefront (port 8000)
│   ├── .env.template        # storefront env placeholders
│   └── Dockerfile
├── .do/app.yaml    # DigitalOcean App Platform spec
└── README.md
```

---

## Prerequisites

- **Node.js 20+** (this machine has Node 18 — Medusa v2 requires 20+).
  Install via [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20`.
- A **Neon** account (database) — https://neon.tech
- A **Cloudflare** account (R2 image storage) — https://cloudflare.com
- A **Stripe** account (payments) — https://stripe.com
- *(Optional)* an **Upstash** account (Redis) — https://upstash.com
- A **DigitalOcean** account + `doctl` CLI — for deploy
- A registrar for **moonlarkstudio.com** (Namecheap, Cloudflare, Porkbun, etc.)

---

## Local development

### 1. Database (Neon free tier)
1. Create a Neon project, copy the connection string (keep `?sslmode=require`).
2. You can use one Neon branch for local dev and the main branch for prod.

### 2. Backend
```bash
cd backend
cp .env.template .env
# Edit .env: set DATABASE_URL (Neon). Leave REDIS_URL blank for now.
# Set placeholder S3_* and STRIPE_* — the app boots without real values,
# you just can't upload images or take payments until they're real.
npm install
npx medusa db:migrate     # create tables
npm run seed              # load sample crochet products + Local Pickup
npx medusa user -e you@example.com -p somepassword   # create an admin user
npm run dev               # http://localhost:9000 ; admin at /app
```
After `npm run seed`, copy the printed **publishable API key** (`pk_...`).

### 3. Storefront
```bash
cd storefront
cp .env.template .env.local
# Edit .env.local: paste the pk_... key into NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
npm install
npm run dev               # http://localhost:8000
```

You now have a working store locally. Add real products and photos in the
admin (`http://localhost:9000/app`).

---

## Provisioning the free services

### Cloudflare R2 (product images)
1. Cloudflare dashboard → R2 → create bucket `moonlark-media`.
2. Enable public access (r2.dev dev URL) or connect a custom domain
   (e.g. `images.moonlarkstudio.com`).
3. R2 → Manage API Tokens → create token (Object Read & Write). Fill the
   backend `S3_*` vars:
   - `S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_FILE_URL` = your public bucket / custom domain URL
   - `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` = the token's keys

### Stripe (payments)
1. Get test API keys (Developers → API keys). Set `STRIPE_API_KEY` (backend)
   and `NEXT_PUBLIC_STRIPE_KEY` (storefront).
2. After deploy, add a webhook → endpoint
   `https://moonlarkstudio.com/hooks/payment/stripe_stripe`, copy the signing
   secret into `STRIPE_WEBHOOK_SECRET`.
3. Switch test → live keys when you're ready to launch.

### Upstash Redis (optional)
Only needed when you scale past one instance or want jobs to survive restarts.
Create a Redis DB, copy the `rediss://` TLS URL into `REDIS_URL`.

---

## Deploying to DigitalOcean

1. Push this repo to GitHub, and edit `.do/app.yaml` → set `repo:` to your
   `user/moonlark-studio` and fill the env values (or set SECRETs in the
   dashboard after creating the app).
2. Create the app:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```
3. First deploy runs DB migrations automatically (see `backend/Dockerfile`).
   Then seed once and create an admin user against the production DB:
   ```bash
   # locally, with DATABASE_URL pointed at the prod Neon branch:
   cd backend && npm run seed
   npx medusa user -e you@moonlarkstudio.com -p <password>
   ```
4. Update the publishable key in the storefront env and redeploy.

### Domain
1. Register **moonlarkstudio.com**.
2. In the DO app → Settings → Domains, add `moonlarkstudio.com` (already in
   `app.yaml`). DO provisions HTTPS automatically.
3. At your registrar/Cloudflare, point DNS at the app (DO shows the exact
   records — typically a CNAME/ALIAS to the app's `ondigitalocean.app` host).

> **Tip:** launch first on the free `*.ondigitalocean.app` URL (remove the
> `domains:` block in `app.yaml`), confirm everything works, then add the
> custom domain.

---

## Cost summary

- **~$5–17/mo** infrastructure (App Platform; backend ~$12 + storefront ~$5).
- **$0** for database, image storage, and Redis on free tiers.
- **Stripe** fees only when you make a sale.
- **~$12–15/yr** for the domain.

Free tiers have limits (Neon: 0.5 GB storage / auto-suspend when idle;
Upstash: 256 MB / 500k commands/mo; R2: 10 GB) — comfortable for a small shop,
and each upgrades to paid without re-architecting.

---

## Customizing for your brand

- **Storefront look:** `storefront/src/` (Tailwind). Update colors in
  `storefront/tailwind.config.js`, logo/nav in `storefront/src/modules/layout`.
- **Products:** add via the admin, or edit `backend/src/scripts/seed.ts`.
- **Custom orders:** the seed includes a "Made to Order" product with deposit
  tiers; buyers describe their request in the checkout order notes.

Built from the official Medusa v2 starters
([backend](https://github.com/medusajs/medusa-starter-default),
[storefront](https://github.com/medusajs/nextjs-starter-medusa)).
