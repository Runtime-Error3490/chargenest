# ChargeNest - single container: Express API + built React frontend.
# Made for Render (Docker web service), works anywhere Docker runs.
#
#   docker build -t chargenest .
#   docker run -p 4000:4000 --env-file backend/.env chargenest
#
# Required env at runtime: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
# (plus PAYPAL_*, TOTP_ENCRYPTION_KEY and an AI key when NODE_ENV=production; see backend/.env.example).

# ---------- 1. Build the frontend ----------
FROM node:20-slim AS frontend
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# The API is served from the same origin, so the app calls /api.
# Vite inlines VITE_* at build time: pass them as build args (Render: set them as env vars).
ARG VITE_API_URL=/api
ARG VITE_PAYPAL_CLIENT_ID=
ARG VITE_DEFAULT_LAT=12.9716
ARG VITE_DEFAULT_LNG=77.5946
ARG VITE_DEFAULT_ZOOM=12
ENV VITE_API_URL=$VITE_API_URL \
    VITE_PAYPAL_CLIENT_ID=$VITE_PAYPAL_CLIENT_ID \
    VITE_DEFAULT_LAT=$VITE_DEFAULT_LAT \
    VITE_DEFAULT_LNG=$VITE_DEFAULT_LNG \
    VITE_DEFAULT_ZOOM=$VITE_DEFAULT_ZOOM
RUN npm run build

# ---------- 2. Backend runtime ----------
FROM node:20-slim AS runtime
# Prisma's query engine needs OpenSSL
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
ENV NODE_ENV=production

COPY backend/package*.json ./
# Dev deps are kept on purpose: the `prisma` CLI is needed to run migrations at start-up.
RUN npm ci --include=dev && npm cache clean --force

COPY backend/ ./
RUN npx prisma generate

COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Serve the frontend from Express; trust Render's proxy for https URLs and client IPs
ENV FRONTEND_DIST=/app/frontend/dist \
    TRUST_PROXY=1 \
    PORT=4000

# Uploaded charger photos. Container disks are wiped on redeploy:
# attach a persistent disk at this path (Render: Disks) to keep them.
RUN mkdir -p uploads/chargers && chown -R node:node /app/backend/uploads

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending DB migrations, then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
