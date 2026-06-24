# Moonlark Studio — Launch Status & Runbook

Living checklist of getting moonlarkstudio.com live. **No secrets here** — all
real credentials (DB URL, API keys, tokens, prod admin password, DO app ID) live
in the gitignored `.localdev/CREDENTIALS.md`.

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
| DigitalOcean app | 🟡 Deploying | app created; first build iterating (see below) |
| Custom domain on app | ⬜ Todo | add `moonlarkstudio.com` after first deploy is green |
| Real products/photos | ⬜ Todo | add via admin (uploads to R2) |
| Test purchase | ⬜ Todo | end-to-end with Stripe |

## Remaining steps (in order)
1. **First DO deploy ACTIVE** on the `*.ondigitalocean.app` URL; smoke-test storefront + `/app` admin.
2. **Custom domain:** add `moonlarkstudio.com` (+`www`) to the DO app; add the CNAME/ALIAS DO shows to Cloudflare DNS; DO auto-provisions HTTPS. Then the `${APP_URL}`-based env vars resolve to the real domain on redeploy.
3. **Stripe go-live:** activate Stripe account (business/bank/tax) → swap test keys for `pk_live_`/`sk_live_` → create webhook at `https://moonlarkstudio.com/hooks/payment/stripe_stripe` → set `STRIPE_WEBHOOK_SECRET` → enable Stripe on the region in admin.
4. **Real catalog:** replace seeded sample products; upload real photos (go to R2); set inventory + shipping rates; sales-tax decision.
5. **Test purchase** with a real card, then refund. Verify order email + inventory decrement.
6. Optional: legal/policy pages, analytics, DB backup habit; in-person POS (Square/Stripe Tap to Pay) for craft fairs.

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
