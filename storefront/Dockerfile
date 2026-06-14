# Moonlark Studio — Next.js storefront
# Serves on port 8000 (see package.json "start"). Works on DigitalOcean App
# Platform, a droplet, or local Docker.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build-time env: the storefront reads NEXT_PUBLIC_* at build time, so these
# must be present during `next build`. App Platform injects build-time vars.
ENV NODE_ENV=production
RUN npm run build

EXPOSE 8000
CMD ["npm", "run", "start"]
