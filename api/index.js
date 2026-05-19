"use strict";
// Vercel serverless entry — wraps the Express app

const path = require("path");

// Ensure working directory is the project root (where src/, frontend/ etc. live)
process.chdir(path.join(__dirname, ".."));

// Load .env for local testing; Vercel injects real env vars in production
try { require("dotenv").config(); } catch (_) {}

// Tell app.js to skip static file serving — Vercel CDN handles that
process.env.VERCEL = "1";

const marketService = require("../src/services/market.service");
const { checkPendingOrders } = require("../src/routes/orders.routes");
const { checkAlerts }        = require("../src/routes/alerts.routes");

let db;
try { db = require("../src/config/database"); } catch (_) {}

let started = false;

async function startup() {
  if (started) return;
  started = true;

  if (process.env.DATABASE_URL && db?.connectDatabase) {
    await db.connectDatabase().catch(() => {});
  }

  await marketService.fetchRealPrices().catch(() => {});
  marketService.startSSEBroadcast();

  try {
    const { fetchAllNews } = require("../news-scraper");
    fetchAllNews().catch(() => {});
  } catch (_) {}

  const interval = parseInt(process.env.PRICE_REFRESH_INTERVAL) || 30000;
  setInterval(() => {
    marketService.fetchRealPrices().catch(() => {});
    checkAlerts().catch(() => {});
    checkPendingOrders().catch(() => {});
  }, interval);
}

// Fire startup — reuses warm container between invocations
startup().catch(console.error);

module.exports = require("../src/app");
