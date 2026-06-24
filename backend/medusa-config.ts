import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

/**
 * Cost-minimized stack notes
 * --------------------------------------------------------------------------
 * DATABASE_URL   -> Neon free Postgres (remember `?sslmode=require`)
 * REDIS_URL      -> Upstash free Redis (rediss://...). OPTIONAL: if unset,
 *                   Medusa uses in-memory cache/event-bus/workflow engine,
 *                   which is fine for a single small instance. Set it once
 *                   you scale past one instance or want jobs to survive
 *                   restarts.
 * S3_* (file)    -> Cloudflare R2 (S3-compatible). Stores product images so
 *                   they don't bloat the database.
 * STRIPE_*       -> Stripe payments.
 * --------------------------------------------------------------------------
 */

const REDIS_URL = process.env.REDIS_URL
const isProd = process.env.NODE_ENV === "production"
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM = process.env.RESEND_FROM

// Email notifications via Resend. Only registered when RESEND_API_KEY is set;
// without it Medusa runs with no email provider (orders still complete, the
// order-placed subscriber just logs a warning).
const notificationModules = RESEND_API_KEY
  ? [
      {
        resolve: "@medusajs/medusa/notification",
        options: {
          providers: [
            {
              resolve: "./src/modules/resend",
              id: "resend",
              options: {
                channels: ["email"],
                api_key: RESEND_API_KEY,
                from: RESEND_FROM,
              },
            },
          ],
        },
      },
    ]
  : []

// Redis-backed infra modules are only registered when REDIS_URL is provided.
// Without them, Medusa falls back to its default in-memory implementations.
const redisModules = REDIS_URL
  ? [
      {
        resolve: "@medusajs/medusa/cache-redis",
        options: { redisUrl: REDIS_URL },
      },
      {
        resolve: "@medusajs/medusa/event-bus-redis",
        options: { redisUrl: REDIS_URL },
      },
      {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: { redis: { url: REDIS_URL } },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Neon (and most managed Postgres) require SSL in production.
    databaseDriverOptions: isProd
      ? { connection: { ssl: { rejectUnauthorized: false } } }
      : {},
    redisUrl: REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    // --- Product image storage: Cloudflare R2 (S3-compatible) -------------
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-s3",
            id: "s3",
            options: {
              file_url: process.env.S3_FILE_URL,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION || "auto",
              bucket: process.env.S3_BUCKET,
              endpoint: process.env.S3_ENDPOINT,
              // R2 requires path-style addressing.
              additional_client_config: {
                forcePathStyle: true,
              },
            },
          },
        ],
      },
    },
    // --- Payments: Stripe -------------------------------------------------
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            },
          },
        ],
      },
    },
    // --- Email notifications: Resend (only when RESEND_API_KEY is set) -----
    ...notificationModules,
    // --- Optional Redis infra (only when REDIS_URL is set) ----------------
    ...redisModules,
  ],
})
