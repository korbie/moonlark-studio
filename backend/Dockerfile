# Moonlark Studio — Medusa v2 backend
# Builds the standalone server output (.medusa/server) and runs migrations
# on start. Works on DigitalOcean App Platform, a droplet, or local Docker.
FROM node:20-alpine

WORKDIR /app

# Install all deps and build
COPY . .
RUN npm install
RUN npm run build

# The build emits a self-contained server in .medusa/server
WORKDIR /app/.medusa/server
RUN npm install --omit=dev

ENV NODE_ENV=production
EXPOSE 9000

# Apply DB migrations, then start. Env vars (DATABASE_URL, etc.) are injected
# at runtime by the platform.
ENTRYPOINT ["sh", "-c", "npx medusa db:migrate && npm run start"]
