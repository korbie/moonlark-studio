# Moonlark Studio — Launch Status & Runbook

**🟢 LIVE at https://moonlarkstudio.com** (custom domain + HTTPS, on DigitalOcean
App Platform). Not yet taking real payments (Stripe still in TEST mode).

Living checklist. **No secrets here** — all real credentials (DB URL, API keys,
tokens, prod admin password, DO app ID) live in gitignored `.localdev/CREDENTIALS.md`.

_Last updated: 2026-06-24._

## Architecture (recap)
One DigitalOcean App Platform app, two services sharing one domain:
- `storefront/` — Next.js (port 8000), serves `/`
- `backend/` — Medusa v2 (port 9000), serves `/store /admin /auth /hooks /health /app`
External free tiers: **Neon** (Postgres), **Cloudflare R2** (images), **Resend**
(email). **Stripe** for payments. Redis optional (in-memory fallback for now).

## Status

| Area | Status | Notes |
|------|--------|-------|
| Domain | ✅ Registered | `moonlarkstudio.com` via Cloudflare (DNS on Cloudflare) |
| Neon Postgres (prod) | ✅ Done | PG 18.4, migrated + seeded; prod admin created |
| Cloudflare R2 | ✅ Done | bucket `moonlark-media`, public domain `images.moonlarkstudio.com`, token tested |
| Resend (email) | ✅ Done | provider `backend/src/modules/resend` + `order.placed` subscriber; domain verified; from `orders@moonlarkstudio.com` |
| Stripe | 🟡 Test only | TEST keys wired; live keys + webhook pending (go-live) |
| GitHub | ✅ Done | `github.com/korbie/moonlark-studio` (`main`), SSH deploy key |
| DigitalOcean app | ✅ Live | app `6d8be906...`; `deploy_on_push` auto-deploys |
| Custom domain on app | ✅ Live | `moonlarkstudio.com` (PRIMARY) + `www`, HTTPS issued; Cloudflare CNAMEs (DNS only) |
| Storefront pages | ✅ Working | home/store/product/category all 200; thumbnails load |
| Auto-revalidation | ✅ Done | catalog reads revalidate every 30s (admin edits show w/o redeploy) |
| Real products/photos | ⬜ Todo | add via admin (uploads to R2) |
| Test purchase | ⬜ Todo | end-to-end with Stripe |

## Remaining steps (in order)
1. **Stripe go-live:** activate Stripe account (business/bank/tax) → swap test keys for `pk_live_`/`sk_live_` (in `.localdev/app.deploy.yaml` + `app.yaml`) → `doctl apps update` → create webhook at `https://moonlarkstudio.com/hooks/payment/stripe_stripe` → set `STRIPE_WEBHOOK_SECRET` → enable Stripe on the region in admin.
2. **Real catalog:** replace seeded sample products; upload real photos (→ R2); set inventory + shipping rates; sales-tax decision. (Inventory: enable "Manage inventory" on a product **variant** — Medusa auto-creates/links the inventory item; don't create standalone inventory items.)
3. **Test purchase** with a real card, then refund. Verify order email + inventory decrement.
4. Optional: legal/policy pages, analytics, DB backup habit; in-person POS (Square/Stripe Tap to Pay) for craft fairs.

## Deploy issues already fixed (don't reintroduce)
- Storefront `Dockerfile` declares `ARG`/`ENV` for build-time vars (DO passes them as build args).
- product/category/collection pages are `force-dynamic` and their `generateStaticParams` fail soft (backend unreachable at build).
- Backend ingress rules use `preserve_path_prefix: true` (DO strips the prefix otherwise → 404s).
- `next.config.js` image allowlist includes `images.moonlarkstudio.com` + `moonlarkstudio.com`.
- Catalog reads revalidate every 30s via `getCacheOptions` in `storefront/src/lib/data/cookies.ts`.

## How deploys work (day-to-day)
- **Content** (products, photos, prices, inventory): in the admin at `/app` — no deploy.
- **Code**: `git commit` + `git push origin main` → DigitalOcean auto-builds & rolling-deploys (`deploy_on_push: true`). Zero downtime; failed builds don't affect the live site; previous deployments are one-click rollbacks.
- **Config/secrets**: edit the gitignored deploy spec `.localdev/app.deploy.yaml` then `doctl apps update <APP_ID> --spec .localdev/app.deploy.yaml`, or change in the DO dashboard.

## Local development
Requires **Node 20** (`nvm use 20`; machine default is 18). Uses an embedded
Postgres (no install). Local admin: `admin@moonlark.test` (see CREDENTIALS.md).
```
node .localdev/start-db.mjs                  # Postgres on :5433
cd backend    && nvm use 20 && npm run dev   # Medusa  :9000 (admin /app)
cd storefront && nvm use 20 && npm run dev   # Next.js :8000
```

## Deploy mechanics / gotchas (learned the hard way)
- **Deploy spec:** committed `.do/app.yaml` has PLACEHOLDER secrets; the real one
  used to create the app is the gitignored `.localdev/app.deploy.yaml`.
- **doctl auth:** `export DIGITALOCEAN_ACCESS_TOKEN=$(cat .localdev/.do-token)` before doctl commands.
- **Storefront Dockerfile** must declare `ARG`/`ENV` for build-time vars — DO passes
  build-time env as Docker build args (fixed).
- **First-deploy build** can't reach the backend, so `generateStaticParams` in
  products/collections/categories pages must fail soft (return `[]`) — fixed.
- **next/image** allowlist (`next.config.js`) includes `images.moonlarkstudio.com`
  and `moonlarkstudio.com` for product photos.
- First deploy uses DO's `${APP_URL}` for `MEDUSA_BACKEND_URL` / `NEXT_PUBLIC_BASE_URL` /
  CORS so it's self-consistent before the custom domain exists.
