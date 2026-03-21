/**
 * US Stocks Routes (Alpaca Markets)
 * Paper + live trading for US equities
 */

"use strict";

const { Router } = require("express");
const alpaca = require("../services/alpaca.service");
const rateLimit = require("../middleware/rateLimit");

const router = Router();

// ─── Middleware: check Alpaca is configured ──────────────

function requireAlpaca(req, res, next) {
  if (!alpaca.isConfigured()) {
    return res.status(503).json({
      error: "US stock trading not configured",
      setup: "Set ALPACA_API_KEY and ALPACA_SECRET_KEY in .env",
      docs: "https://alpaca.markets/docs/trading/getting-started/",
    });
  }
  next();
}

router.use(requireAlpaca);

// ─── Account ─────────────────────────────────────────────

/** GET /api/us/account — Alpaca account info */
router.get("/account", async (req, res) => {
  try {
    const account = await alpaca.getAccount();
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/us/clock — Market hours */
router.get("/clock", async (req, res) => {
  try {
    const clock = await alpaca.getMarketClock();
    res.json(clock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Market Data ─────────────────────────────────────────

/** GET /api/us/quote/:symbol — Real-time US stock quote */
router.get("/quote/:symbol", rateLimit(60000, 60), async (req, res) => {
  try {
    const quote = await alpaca.getUSStockQuote(req.params.symbol);
    res.json(quote);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

/** GET /api/us/bars/:symbol — Historical OHLCV bars */
router.get("/bars/:symbol", rateLimit(60000, 30), async (req, res) => {
  try {
    const { timeframe = "1Day", limit = "100" } = req.query;
    const bars = await alpaca.getUSStockBars(req.params.symbol, timeframe, parseInt(limit));
    res.json({ symbol: req.params.symbol.toUpperCase(), bars });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

/** POST /api/us/quotes — Multiple stock quotes */
router.post("/quotes", rateLimit(60000, 20), async (req, res) => {
  const { symbols } = req.body;
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({ error: "symbols array required" });
  }
  if (symbols.length > 50) {
    return res.status(400).json({ error: "Max 50 symbols per request" });
  }
  try {
    const quotes = await alpaca.getMultipleQuotes(symbols);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/us/search?q=apple — Search US stocks */
router.get("/search", rateLimit(60000, 20), async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) {
    return res.status(400).json({ error: "Search query required (?q=...)" });
  }
  try {
    const results = await alpaca.searchAssets(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Orders ──────────────────────────────────────────────

/** POST /api/us/orders — Place a US stock order */
router.post("/orders", rateLimit(60000, 30), async (req, res) => {
  const { symbol, qty, side, type, timeInForce, limitPrice, stopPrice } = req.body;

  if (!symbol || !qty || !side) {
    return res.status(400).json({ error: "symbol, qty, and side required" });
  }
  if (!["buy", "sell"].includes(side)) {
    return res.status(400).json({ error: "side must be 'buy' or 'sell'" });
  }
  if (qty <= 0) {
    return res.status(400).json({ error: "qty must be positive" });
  }

  try {
    const order = await alpaca.placeOrder({ symbol, qty, side, type, timeInForce, limitPrice, stopPrice });
    res.json(order);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

/** GET /api/us/orders — List orders */
router.get("/orders", async (req, res) => {
  try {
    const { status = "open" } = req.query;
    const orders = await alpaca.getOrders(status);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/us/orders/:id — Get specific order */
router.get("/orders/:id", async (req, res) => {
  try {
    const order = await alpaca.getOrder(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

/** DELETE /api/us/orders/:id — Cancel order */
router.delete("/orders/:id", async (req, res) => {
  try {
    const result = await alpaca.cancelOrder(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

/** DELETE /api/us/orders — Cancel all orders */
router.delete("/orders", async (req, res) => {
  try {
    const result = await alpaca.cancelAllOrders();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Positions ───────────────────────────────────────────

/** GET /api/us/positions — All US positions */
router.get("/positions", async (req, res) => {
  try {
    const positions = await alpaca.getPositions();
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/us/positions/:symbol — Close a position */
router.delete("/positions/:symbol", async (req, res) => {
  try {
    const result = await alpaca.closePosition(req.params.symbol);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
