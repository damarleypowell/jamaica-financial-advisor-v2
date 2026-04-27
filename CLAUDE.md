# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gotham Financial** — an AI-powered investment and trading platform focused on the Jamaica Stock Exchange (JSE), with US stock trading via Alpaca Markets. The platform has three tiers: FREE, BASIC, PRO, and ENTERPRISE.

## Development Commands

### Backend (Node.js/Express — run from `jamaica-financial-advisor/`)
```bash
npm run dev          # Start API server with hot-reload (port 3000)
npm start            # Start API server (production)
npm run frontend:dev # Start static frontend server (port 3001)
```

### Frontend (React/Vite — run from `jamaica-financial-advisor/frontend/`)
```bash
npm run dev    # Vite dev server on port 3001 (proxies /api → localhost:8080)
npm run build  # TypeScript check + Vite build → outputs to ../public-react/
npm run lint   # ESLint check
```

> **Important:** The Vite dev proxy points to port `8080`, but the backend runs on port `3000`. If using Vite dev mode, either change the proxy in `frontend/vite.config.ts` to `http://localhost:3000`, or run the backend on port 8080.

### Python Analytics Microservice (run from `jamaica-financial-advisor/python-analytics/`)
```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Database
```bash
npx prisma migrate dev   # Apply migrations (requires DATABASE_URL)
npx prisma generate      # Regenerate Prisma client after schema changes
node scripts/seed-admin.js         # Seed an admin user
node scripts/migrate-json-to-pg.js # Migrate legacy JSON data to PostgreSQL
```

## Architecture

The system has three services that work together:

```
┌─────────────────────────────────────┐
│  Frontend (React/Vite)              │  port 3001 (dev) or served from /public
│  frontend/src/                      │
└──────────────┬──────────────────────┘
               │ HTTP / SSE
┌──────────────▼──────────────────────┐
│  API Server (Node/Express)          │  port 3000
│  src/server.js                      │
└──────────────┬──────────────────────┘
               │ HTTP proxy
┌──────────────▼──────────────────────┐
│  Python Analytics (FastAPI)         │  port 8000 (optional)
│  python-analytics/main.py           │
└─────────────────────────────────────┘
```

### Backend (`src/`)

- **`src/server.js`** — Express app entry point. Mounts all routes, starts background intervals (price refresh every 30s, stock enrichment every 10m, news refresh every 10m), and starts SSE broadcast.
- **`src/config/env.js`** — Single config object loaded from `.env`. Only `ANTHROPIC_API_KEY` is required to start. All other keys (DB, email, Alpaca, Stripe, etc.) enable optional features.
- **`src/config/database.js`** — Prisma client. The backend toggles between PostgreSQL (when `DATABASE_URL` is set) and in-memory/file-based storage throughout every route and service via the `USE_DB` pattern.
- **`src/services/market.service.js`** — Core market data layer. Holds `livePrices` array in memory. Fetches real JSE prices by scraping `jseinvestor.com` and `jamstockex.com` via `jse-scraper.js`. Enriches stocks with Yahoo Finance data and broadcasts via SSE.
- **`src/services/python-bridge.service.js`** — HTTP proxy to the Python FastAPI service. Checks availability every 60s and fails gracefully when Python is down.
- **`src/routes/`** — One file per domain area. Routes directly export functions like `checkAlerts` and `checkPendingOrders` that are called on the market refresh interval.

### Frontend (`frontend/src/`)

- **State management:** Zustand stores in `stores/` — `market.ts` (stocks + SSE connection), `auth.ts` (JWT + user), `ui.ts` (theme/layout).
- **Data fetching:** TanStack Query with 30s stale time. API calls go directly to `/api/...` (proxied in dev).
- **Real-time:** `useSSE.ts` hook and `market.ts` store manage the SSE connection to `/api/stream/prices`. On mount, App connects SSE and loads the user.
- **Routing and access control:** `ProtectedRoute` component enforces subscription tiers. Routes in `App.tsx` are grouped as FREE, BASIC+, PRO+, and admin (ENTERPRISE).
- **Features:** Each page lives in `features/<name>/`. All route components are lazy-loaded.

### Python Analytics (`python-analytics/`)

FastAPI microservice providing quantitative analytics the Node.js server can't do efficiently: portfolio optimization (Markowitz), VaR/CVaR/Monte Carlo, ML price prediction, technical indicators (`ta` library), strategy backtesting, and multi-factor screening.

### Subscription Tiers

Enforced by `src/middleware/subscription.js`. Tiers: FREE → BASIC → PRO → ENTERPRISE. The `TIER_ORDER` array defines hierarchy. Frontend enforces via `ProtectedRoute`; backend enforces via `requireTier()` middleware on protected API routes.

### Authentication

Custom JWT implementation in `src/middleware/auth.js` (no jsonwebtoken library for verification — uses `crypto.createHmac`). Tokens are stored in `localStorage` as `jse_token`. JWT includes optional IP binding for audit purposes. 2FA via `otplib` is supported.

### Data Sources

| Source | What |
|--------|------|
| `jseinvestor.com` + `jamstockex.com` | JSE stock prices (scraped via Cheerio in `jse-scraper.js`) |
| Yahoo Finance (`yahoo-finance2`) | Enriched stock details, research data |
| Alpaca Markets | US stock quotes, orders, and positions (`src/services/alpaca.service.js`) |
| Finnhub | Alternative market data (`FINNHUB_API` env var) |
| ElevenLabs | Text-to-speech for voice features |
| Stripe | Subscription payments |

### Key `.env` Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | AI chat, analysis, financial planning |
| `DATABASE_URL` | No | PostgreSQL (Neon). Falls back to in-memory if absent |
| `JWT_SECRET` | No | Randomly generated on startup if absent |
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | No | US stock trading |
| `ELEVENLABS_API_KEY` | No | Voice features |
| `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` | No | SMTP for email verification/alerts |
| `ADMIN_EMAILS` | No | Comma-separated list of admin email addresses |
