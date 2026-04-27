/**
 * US Stocks Routes (Alpaca Markets)
 * Paper + live trading for US equities
 */

"use strict";

const { Router } = require("express");
const alpaca = require("../services/alpaca.service");
const finnhub = require("../services/finnhub.service");
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

/** GET /api/us/bars/:symbol — Historical OHLCV bars (Alpaca primary, Finnhub fallback) */
router.get("/bars/:symbol", rateLimit(60000, 30), async (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  const { timeframe = "1Day", limit = "100" } = req.query;

  // Try Alpaca first
  try {
    const bars = await alpaca.getUSStockBars(sym, timeframe, parseInt(limit));
    if (bars && bars.length > 0) {
      return res.json({ symbol: sym, bars, source: "alpaca" });
    }
  } catch (err) {
    console.warn(`Alpaca bars failed for ${sym}, trying Finnhub:`, err.message);
  }

  // Fallback to Finnhub candles
  if (finnhub.isConfigured()) {
    try {
      // Map Alpaca timeframes to Finnhub resolutions
      const resMap = { "1Min": "1", "5Min": "5", "15Min": "15", "30Min": "30", "1Hour": "60", "1Day": "D", "1Week": "W", "1Month": "M" };
      const resolution = resMap[timeframe] || "D";
      const now = Math.floor(Date.now() / 1000);
      const from = now - parseInt(limit) * (resolution === "D" ? 86400 : resolution === "W" ? 604800 : 86400);
      const data = await finnhub.getCandles(sym, resolution, from, now);
      if (data.candles && data.candles.length > 0) {
        const bars = data.candles.map(c => ({
          timestamp: new Date(c.time * 1000).toISOString(),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          vwap: 0,
        }));
        return res.json({ symbol: sym, bars, source: "finnhub" });
      }
    } catch (err2) {
      console.warn(`Finnhub bars also failed for ${sym}:`, err2.message);
    }
  }

  res.status(502).json({ error: "No bar data available from any source" });
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

/** GET /api/us/profile/:symbol — Company profile from Finnhub */
router.get("/profile/:symbol", rateLimit(60000, 30), async (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  if (!finnhub.isConfigured()) {
    return res.status(503).json({ error: "Finnhub not configured" });
  }
  try {
    const [profile, metrics] = await Promise.all([
      finnhub.getCompanyProfile(sym),
      finnhub.getFinancials(sym),
    ]);
    const m = metrics.metric || {};
    res.json({
      symbol: sym,
      name: profile.name || sym,
      logo: profile.logo || null,
      industry: profile.finnhubIndustry || null,
      exchange: profile.exchange || null,
      marketCap: profile.marketCapitalization || null,
      ipo: profile.ipo || null,
      weburl: profile.weburl || null,
      fundamentals: {
        pe: m["peBasicExclExtraTTM"] || null,
        pb: m["pbAnnual"] || null,
        eps: m["epsBasicExclExtraItemsTTM"] || null,
        dividendYield: m["dividendYieldIndicatedAnnual"] || null,
        revenue: m["revenuePerShareTTM"] || null,
        roe: m["roeTTM"] || null,
        beta: m["beta"] || null,
        week52High: m["52WeekHigh"] || null,
        week52Low: m["52WeekLow"] || null,
      },
    });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch company profile" });
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
