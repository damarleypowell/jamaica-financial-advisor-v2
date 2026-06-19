"use strict";
// ── Local dev server — imports app.js, runs startup, calls listen ─────────────

const config         = require("./config/env");
const app            = require("./app");
const marketService  = require("./services/market.service");
const { fetchAllNews } = require("../news-scraper");
const { checkPendingOrders } = require("./routes/orders.routes");
const { checkAlerts }        = require("./routes/alerts.routes");

let prisma, connectDatabase, disconnectDatabase;
try {
  const db = require("./config/database");
  prisma = db.prisma; connectDatabase = db.connectDatabase; disconnectDatabase = db.disconnectDatabase;
} catch (_) { prisma = null; connectDatabase = null; disconnectDatabase = null; }
const USE_DB = !!(process.env.DATABASE_URL && prisma);

let server;

async function start() {
  if (USE_DB && connectDatabase) {
    await connectDatabase();
    console.log("[DB] Using PostgreSQL");
  } else {
    console.log("[DB] File-based / in-memory storage");
  }

  await marketService.fetchRealPrices();

  setInterval(() => {
    marketService.fetchRealPrices();
    checkAlerts().catch(e => console.error("[alerts]", e));
    checkPendingOrders().catch(e => console.error("[orders]", e));
  }, config.priceRefreshInterval);

  setInterval(() => marketService.enrichStockDetails(), config.enrichInterval);

  fetchAllNews().catch(e => console.warn("Initial news fetch failed:", e.message));
  setInterval(() => fetchAllNews().catch(() => {}), config.newsRefreshInterval);

  marketService.startSSEBroadcast();

  server = app.listen(config.port, () => {
    console.log(`\n🇯🇲 Gotham running on http://localhost:${config.port}\n`);
  });
}

async function shutdown(signal) {
  console.log(`[shutdown] ${signal}`);
  if (server) server.close();
  if (USE_DB && disconnectDatabase) await disconnectDatabase().catch(() => {});
  setTimeout(() => process.exit(0), 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

start().catch(err => { console.error("Failed to start:", err); process.exit(1); });
