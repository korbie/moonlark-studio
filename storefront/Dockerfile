# Moonlark Studio — Next.js storefront
# Serves on port 8000 (see package.json "start"). Works on DigitalOcean App
# Platform, a droplet, or local Docker.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build-time env. DigitalOcean App Platform passes BUILD_TIME-scoped vars as
# Docker build args, so they must be declared as ARG and promoted to ENV for
# `next build` to see them (NEXT_PUBLIC_* get baked into the client bundle).
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_REGION
ARG NEXT_PUBLIC_STRIPE_KEY
ARG MEDUSA_BACKEND_URL
ARG REVALIDATE_SECRET
ENV NODE_ENV=production \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION \
    NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY \
    MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL \
    REVALIDATE_SECRET=$REVALIDATE_SECRET
RUN npm run build

EXPOSE 8000
CMD ["npm", "run", "start"]
