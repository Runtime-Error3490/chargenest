# ============================================================================
# ChargeNest - Production Dockerfile
# ============================================================================
# Multi-stage build: React frontend + Express API in a single container.
# Optimized for Render, Railway, Fly.io, or any Docker host.
#
# USAGE:
#   docker build -t chargenest .
#   docker run -p 4000:4000 --env-file backend/.env chargenest
#
# REQUIRED ENV VARS (runtime):
#   DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
#   (plus PAYPAL_*, TOTP_ENCRYPTION_KEY, AI key when NODE_ENV=production)
#
# SCALABILITY:
#   ✓ Horizontal scaling: Stateless API, use external Redis for sessions if needed
#   ✓ Database: Use managed PostgreSQL (Render, Supabase, RDS) with connection pooling
#   ✓ File uploads: Use S3/Cloudflare R2 instead of local disk for multi-instance
#   ✓ Load balancing: Works behind nginx, Cloudflare, or cloud load balancers
#
# BEST PRACTICES FOLLOWED:
#   ✓ Multi-stage builds (smaller final image)
#   ✓ Non-root user (security)
#   ✓ .dockerignore for build context
#   ✓ npm ci for reproducible builds
#   ✓ Layer caching optimization
#   ✓ Health checks for orchestrators
#   ✓ Proper signal handling (node, not npm)
# ============================================================================

# ---------- Stage 1: Build Frontend ----------
FROM node:20-alpine AS frontend-builder

# Alpine is smaller than slim for build stage
WORKDIR /app/frontend

# Copy package files first for better layer caching
COPY frontend/package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY frontend/ ./

# Build-time environment variables (Vite inlines these)
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

# ---------- Stage 2: Production Runtime ----------
FROM node:20-slim AS runtime

# Install only what's needed for Prisma and HTTPS
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       openssl \
       ca-certificates \
       curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app/backend

# Set production environment
ENV NODE_ENV=production

# Copy package files and install dependencies
COPY backend/package*.json ./

# Include dev deps for Prisma CLI (needed for migrations at startup)
# Use npm ci for reproducible builds
RUN npm ci --include=dev \
    && npm cache clean --force

# Copy backend source
COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# ---------- Runtime Configuration ----------

# Serve frontend from Express
ENV FRONTEND_DIST=/app/frontend/dist

# Trust proxy headers (required for Render, Railway, etc.)
ENV TRUST_PROXY=1

# Default port (can be overridden)
ENV PORT=4000

# Create uploads directory with correct permissions
# NOTE: For horizontal scaling, use S3/R2 instead of local storage
RUN mkdir -p uploads/chargers \
    && chown -R node:node /app/backend/uploads

# Run as non-root user (security best practice)
USER node

# Expose the port
EXPOSE 4000

# Health check for container orchestrators (Kubernetes, Docker Swarm, Render)
# Checks /health endpoint every 30s, allows 30s startup time
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-4000}/health || exit 1

# ---------- Startup Command ----------
# 1. Apply pending database migrations
# 2. Optionally seed demo data (SEED_DEMO_DATA=true)
# 3. Start the API server
#
# Using 'node' directly (not 'npm start') ensures proper signal handling for graceful shutdown
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$SEED_DEMO_DATA\" = \"true\" ]; then node prisma/seed.js; fi && node src/index.js"]
