# ══════════════════════════════════════════════════════════════════════════════
# Gotham Financial — Multi-stage Docker Build
# ══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm install
RUN npm run build

# ── Stage 2: Node.js backend dependencies ────────────────────────────────────
FROM node:20-slim AS node-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ── Stage 3: Prisma generate ─────────────────────────────────────────────────
FROM node:20-slim AS prisma
WORKDIR /app
COPY --from=node-deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npx prisma generate

# ── Stage 4: Production image ────────────────────────────────────────────────
FROM node:20-slim AS production

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip python3-venv curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend
COPY --from=prisma /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

# Built React frontend → public-react/ (where Express serves it from)
COPY --from=frontend-build /app/frontend/dist ./public-react

# Python analytics
RUN python3 -m venv /app/python-analytics/.venv && \
    /app/python-analytics/.venv/bin/pip install --no-cache-dir -r python-analytics/requirements.txt

ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_ANALYTICS_URL=http://localhost:8000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

RUN printf '#!/bin/sh\n\
/app/python-analytics/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir /app/python-analytics &\n\
exec node src/server.js\n' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
