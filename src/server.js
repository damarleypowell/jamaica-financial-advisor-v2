// ══════════════════════════════════════════════════════════════════════════════
// ── Gotham Financial — Investment Platform ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const config = require("./config/env");
const express = require("express");
const path = require("path");
const { fetchAllNews } = require("../news-scraper");

// ── Prisma / DB toggle ───────────────────────────────────────────────────────
let prisma, connectDatabase, disconnectDatabase;
try {
  const db = require("./config/database");
  prisma = db.prisma;
  connectDatabase = db.connectDatabase;
  disconnectDatabase = db.disconnectDatabase;
} catch (_) {
  prisma = null;
  connectDatabase = null;
  disconnectDatabase = null;
}
const USE_DB = !!(process.env.DATABASE_URL && prisma);

// ── Middleware ────────────────────────────────────────────────────────────────
const { securityHeaders, corsMiddleware, csrfProtection } = require("./middleware/security");
const { sanitizeBody } = require("./middleware/validation");
const { auditMiddleware } = require("./services/audit.service");

// ── Route modules ────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth.routes");
const marketRoutes = require("./routes/market.routes");
const aiRoutes = require("./routes/ai.routes");
const orderRoutes = require("./routes/orders.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const usStocksRoutes = require("./routes/us-stocks.routes");
const alertRoutes = require("./routes/alerts.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const adminRoutes = require("./routes/admin.routes");
const paymentRoutes = require("./routes/payment.routes");
const kycRoutes = require("./routes/kyc.routes");

// ── Services ─────────────────────────────────────────────────────────────────
const marketService = require("./services/market.service");
const pythonBridge = require("./services/python-bridge.service");

// ── Interval-driven functions from route modules ─────────────────────────────
const { checkPendingOrders } = require("./routes/orders.routes");
const { checkAlerts } = require("./routes/alerts.routes");

// ══════════════════════════════════════════════════════════════════════════════
// ── Express App ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const app = express();

// Security
app.use(securityHeaders);
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: "5mb" }));

// CSRF protection
app.use(csrfProtection);

// Input sanitization & audit logging
app.use(sanitizeBody);
app.use(auditMiddleware);

// Static files
app.use(express.static(path.join(__dirname, "..", "public")));

// ── Mount routes ─────────────────────────────────────────────────────────────
app.use(authRoutes);
app.use(marketRoutes);
app.use(aiRoutes);
app.use(orderRoutes);
app.use(alertRoutes);
app.use(subscriptionRoutes);
app.use(adminRoutes);
app.use(paymentRoutes);
app.use(kycRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/us", usStocksRoutes);

// Health check
app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    stocks: marketService.livePrices.length,
    database: USE_DB ? "postgresql" : "file-based",
  })
);

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Startup ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

let server; // Hold reference for graceful shutdown

async function start() {
  // Connect to PostgreSQL if DATABASE_URL is configured
  if (USE_DB && connectDatabase) {
    await connectDatabase();
    console.log("[DB] Using PostgreSQL for persistence");
  } else {
    console.log("[DB] No DATABASE_URL set — using file-based / in-memory storage");
  }

  // Fetch initial stock data
  await marketService.fetchRealPrices();

  // Schedule recurring data fetches + alert/order checks
  setInterval(() => {
    marketService.fetchRealPrices();
    // Run alert and order checks after each price refresh
    checkAlerts().catch((err) =>
      console.error("[alerts] Scheduled checkAlerts error:", err)
    );
    checkPendingOrders().catch((err) =>
      console.error("[orders] Scheduled checkPendingOrders error:", err)
    );
  }, config.priceRefreshInterval);

  setInterval(
    () => marketService.enrichStockDetails(),
    config.enrichInterval
  );

  // Pre-fetch news
  fetchAllNews().catch((e) =>
    console.warn("Initial news fetch failed:", e.message)
  );
  setInterval(
    () => fetchAllNews().catch(() => {}),
    config.newsRefreshInterval
  );

  // Start SSE broadcast
  marketService.startSSEBroadcast();

  // Listen
  server = app.listen(config.port, () => {
    console.log(
      `\n🇯🇲 Gotham Financial Platform running on http://localhost:${config.port}\n`
    );
    console.log(`  API Routes:`);
    console.log(`  ── Market Data ──`);
    console.log(`  GET  /api/stocks              — all stocks`);
    console.log(`  GET  /api/stocks/:symbol      — stock detail`);
    console.log(`  GET  /api/research/:symbol    — Yahoo Finance data`);
    console.log(`  GET  /api/market-overview     — market summary`);
    console.log(`  GET  /api/stream/prices       — SSE real-time prices`);
    console.log(`  GET  /api/sectors             — sector performance`);
    console.log(`  GET  /api/news                — market news`);
    console.log(`  POST /api/screener            — stock screener`);
    console.log(`  POST /api/compare             — stock comparison`);
    console.log(`  ── AI Services ──`);
    console.log(`  POST /analyze                 — AI stock analysis`);
    console.log(`  POST /api/chat                — AI chat assistant`);
    console.log(`  POST /api/financial-plan      — AI financial planner`);
    console.log(`  POST /api/auto-invest         — AI autonomous investing`);
    console.log(`  POST /api/portfolio/optimize  — AI portfolio optimizer`);
    console.log(`  POST /api/speak               — text-to-speech`);
    console.log(`  POST /api/voice-chat          — voice conversation`);
    console.log(`  ── Trading ──`);
    console.log(`  POST /api/orders              — place order`);
    console.log(`  GET  /api/orders              — list orders`);
    console.log(`  GET  /api/orders/:id          — order detail`);
    console.log(`  DEL  /api/orders/:id          — cancel order`);
    console.log(`  GET  /api/portfolio/positions  — trading positions`);
    console.log(`  GET  /api/portfolio/history    — transaction history`);
    console.log(`  GET  /api/wallet/balance       — wallet balances`);
    console.log(`  POST /api/wallet/deposit       — deposit funds`);
    console.log(`  POST /api/wallet/withdraw      — withdraw funds`);
    console.log(`  ── Price Alerts ──`);
    console.log(`  POST /api/alerts              — create alert`);
    console.log(`  GET  /api/alerts              — list alerts`);
    console.log(`  DEL  /api/alerts/:id          — delete alert`);
    console.log(`  GET  /api/notifications       — list notifications`);
    console.log(`  PUT  /api/notifications/:id/read — mark read`);
    console.log(`  PUT  /api/notifications/read-all — mark all read`);
    console.log(`  ── Analytics ──`);
    console.log(`  GET  /api/analytics/status             — service status`);
    console.log(`  GET  /api/analytics/technical/:symbol  — technical indicators`);
    console.log(`  GET  /api/analytics/technical/:s/advanced — ML patterns`);
    console.log(`  POST /api/analytics/portfolio          — portfolio metrics`);
    console.log(`  POST /api/analytics/portfolio/optimize — Markowitz optimization`);
    console.log(`  POST /api/analytics/portfolio/risk     — VaR/CVaR/Monte Carlo`);
    console.log(`  GET  /api/analytics/predict/:symbol    — ML price prediction`);
    console.log(`  POST /api/analytics/backtest           — strategy backtesting`);
    console.log(`  POST /api/analytics/screener           — multi-factor screening`);
    console.log(`  POST /api/analytics/compound-growth    — growth projection`);
    console.log(`  POST /api/analytics/retirement         — retirement calculator`);
    console.log(`  POST /api/analytics/loan               — loan calculator`);
    console.log(`  POST /api/analytics/irr                — IRR/XIRR calculator`);
    console.log(`  ── US Stocks (Alpaca) ──`);
    console.log(`  GET  /api/us/account            — Alpaca account`);
    console.log(`  GET  /api/us/clock              — market hours`);
    console.log(`  GET  /api/us/quote/:symbol      — real-time quote`);
    console.log(`  GET  /api/us/bars/:symbol       — OHLCV history`);
    console.log(`  POST /api/us/quotes             — batch quotes`);
    console.log(`  GET  /api/us/search?q=          — search stocks`);
    console.log(`  POST /api/us/orders             — place order`);
    console.log(`  GET  /api/us/orders             — list orders`);
    console.log(`  DEL  /api/us/orders/:id         — cancel order`);
    console.log(`  GET  /api/us/positions           — all positions`);
    console.log(`  DEL  /api/us/positions/:symbol   — close position`);
    console.log(`  ── Auth ──`);
    console.log(`  POST /api/auth/signup           — register`);
    console.log(`  POST /api/auth/login            — login`);
    console.log(`  GET  /api/auth/me               — profile`);
    console.log(`  POST /api/auth/reset-password   — password reset`);
    console.log(`  POST /api/auth/verify-email     — email verification\n`);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Graceful Shutdown ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function shutdown(signal) {
  console.log(`\n[shutdown] Received ${signal}. Shutting down gracefully...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log("[shutdown] HTTP server closed");
    });
  }

  // Disconnect Prisma
  if (USE_DB && disconnectDatabase) {
    try {
      await disconnectDatabase();
    } catch (err) {
      console.error("[shutdown] Error disconnecting database:", err);
    }
  }

  // Give in-flight requests up to 10s to finish
  setTimeout(() => {
    console.log("[shutdown] Forcing exit after timeout");
    process.exit(0);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── Start the server ─────────────────────────────────────────────────────────

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
