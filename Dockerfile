# ══════════════════════════════════════════════════════════════════════════════
# Gotham Financial — Multi-stage Docker Build
# Serves Node.js API + Python Analytics in a single container
# ══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Node.js dependencies ────────────────────────────────────────────
FROM node:20-slim AS node-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Prisma generate ─────────────────────────────────────────────────
FROM node:20-slim AS prisma
WORKDIR /app
COPY --from=node-deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npx prisma generate

# ── Stage 3: Production image ────────────────────────────────────────────────
FROM node:20-slim AS production

# Install Python 3 for analytics service
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip python3-venv curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Node.js app
COPY --from=prisma /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

# Install Python dependencies in a virtual environment
RUN python3 -m venv /app/python-analytics/.venv && \
    /app/python-analytics/.venv/bin/pip install --no-cache-dir -r python-analytics/requirements.txt

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_ANALYTICS_URL=http://localhost:8000

# Expose ports
EXPOSE 3000 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start both services
# Use a simple shell script to run Node + Python concurrently
RUN printf '#!/bin/sh\n\
/app/python-analytics/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir /app/python-analytics &\n\
exec node src/server.js\n' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
