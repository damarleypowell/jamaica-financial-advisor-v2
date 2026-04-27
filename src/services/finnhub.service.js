/**
 * Finnhub Market Data Service
 *
 * Provides real US stock data: quotes, OHLCV candles, forex rates,
 * company fundamentals, technical indicators, news, and symbol search.
 *
 * Rate-limited to 60 requests/min (free tier). Includes in-memory
 * caching with configurable TTLs per data type.
 */

"use strict";

const axios = require("axios");

// ─── Configuration ──────────────────────────────────────────

const API_KEY = process.env.FINNHUB_API || "";
const BASE_URL = "https://finnhub.io/api/v1";

function isConfigured() {
  return !!API_KEY;
}

// ─── Rate Limiter (token bucket: 60 req/min) ───────────────

const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000; // 1 minute in ms
const requestTimestamps = [];

async function waitForSlot() {
  const now = Date.now();
  // Purge timestamps older than the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_WINDOW) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT) {
    const oldest = requestTimestamps[0];
    const waitMs = oldest + RATE_WINDOW - now + 50; // +50ms buffer
    await new Promise((r) => setTimeout(r, waitMs));
    return waitForSlot(); // re-check after wait
  }
  requestTimestamps.push(Date.now());
}

// ─── Cache ──────────────────────────────────────────────────

const cache = new Map();

const TTL = {
  quote: 30_000,       // 30s
  candles: 300_000,    // 5min
  fundamentals: 3600_000, // 1hr
  forex: 60_000,       // 1min
  news: 300_000,       // 5min
  profile: 3600_000,   // 1hr
  search: 3600_000,    // 1hr
  indicator: 300_000,  // 5min
};

function cached(key, ttlKey) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < (TTL[ttlKey] || 300_000)) {
    return entry.data;
  }
  return null;
}

function setCache(key, data, ttlKey) {
  cache.set(key, { data, ts: Date.now() });
  // Evict old entries periodically
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > 3600_000) cache.delete(k);
    }
  }
}

// ─── HTTP Client ────────────────────────────────────────────

async function finnhubGet(path, params = {}) {
  if (!API_KEY) {
    throw new Error("Finnhub API key not configured. Set FINNHUB_API in .env");
  }
  await waitForSlot();
  const resp = await axios.get(`${BASE_URL}${path}`, {
    params: { ...params, token: API_KEY },
    timeout: 15_000,
  });
  return resp.data;
}

// ─── Quote ──────────────────────────────────────────────────

async function getQuote(symbol) {
  const key = `quote:${symbol}`;
  const hit = cached(key, "quote");
  if (hit) return hit;

  const data = await finnhubGet("/quote", { symbol: symbol.toUpperCase() });
  const result = {
    symbol: symbol.toUpperCase(),
    current: data.c,
    change: data.d,
    changePercent: data.dp,
    high: data.h,
    low: data.l,
    open: data.o,
    previousClose: data.pc,
    timestamp: data.t,
  };
  setCache(key, result, "quote");
  return result;
}

// ─── Stock Candles (OHLCV) ─────────────────────────────────

async function getCandles(symbol, resolution = "D", from, to) {
  const key = `candles:${symbol}:${resolution}:${from}:${to}`;
  const hit = cached(key, "candles");
  if (hit) return hit;

  const data = await finnhubGet("/stock/candle", {
    symbol: symbol.toUpperCase(),
    resolution,
    from,
    to,
  });

  if (data.s === "no_data" || !data.c) {
    return { symbol: symbol.toUpperCase(), candles: [], noData: true };
  }

  const candles = data.c.map((_, i) => ({
    time: data.t[i],
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close: data.c[i],
    volume: data.v[i],
  }));

  const result = { symbol: symbol.toUpperCase(), candles };
  setCache(key, result, "candles");
  return result;
}

// ─── Forex Rates ────────────────────────────────────────────

async function getForexRates() {
  const key = "forex:rates";
  const hit = cached(key, "forex");
  if (hit) return hit;

  const data = await finnhubGet("/forex/rates", { base: "USD" });
  setCache(key, data, "forex");
  return data;
}

async function getForexCandles(pair, resolution = "D", from, to) {
  const key = `forex:candles:${pair}:${resolution}:${from}:${to}`;
  const hit = cached(key, "candles");
  if (hit) return hit;

  const data = await finnhubGet("/forex/candle", {
    symbol: pair,
    resolution,
    from,
    to,
  });

  if (data.s === "no_data" || !data.c) {
    return { pair, candles: [], noData: true };
  }

  const candles = data.c.map((_, i) => ({
    time: data.t[i],
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close: data.c[i],
    volume: data.v[i],
  }));

  const result = { pair, candles };
  setCache(key, result, "candles");
  return result;
}

// ─── Company Profile ────────────────────────────────────────

async function getCompanyProfile(symbol) {
  const key = `profile:${symbol}`;
  const hit = cached(key, "profile");
  if (hit) return hit;

  const data = await finnhubGet("/stock/profile2", { symbol: symbol.toUpperCase() });
  setCache(key, data, "profile");
  return data;
}

// ─── Financials / Metrics ───────────────────────────────────

async function getFinancials(symbol) {
  const key = `financials:${symbol}`;
  const hit = cached(key, "fundamentals");
  if (hit) return hit;

  const data = await finnhubGet("/stock/metric", {
    symbol: symbol.toUpperCase(),
    metric: "all",
  });
  setCache(key, data, "fundamentals");
  return data;
}

// ─── Technical Indicator (server-side) ──────────────────────

async function getTechnicalIndicator(symbol, resolution, from, to, indicator) {
  const key = `indicator:${symbol}:${resolution}:${indicator}:${from}:${to}`;
  const hit = cached(key, "indicator");
  if (hit) return hit;

  const data = await finnhubGet("/indicator", {
    symbol: symbol.toUpperCase(),
    resolution,
    from,
    to,
    indicator,
  });
  setCache(key, data, "indicator");
  return data;
}

// ─── Pattern Recognition ────────────────────────────────────

async function getPatternRecognition(symbol, resolution = "D") {
  const key = `pattern:${symbol}:${resolution}`;
  const hit = cached(key, "indicator");
  if (hit) return hit;

  const data = await finnhubGet("/scan/pattern", {
    symbol: symbol.toUpperCase(),
    resolution,
  });
  setCache(key, data, "indicator");
  return data;
}

// ─── News ───────────────────────────────────────────────────

async function getNews(category = "general", minId = 0) {
  const key = `news:${category}:${minId}`;
  const hit = cached(key, "news");
  if (hit) return hit;

  const data = await finnhubGet("/news", { category, minId });
  setCache(key, data, "news");
  return data;
}

async function getCompanyNews(symbol, from, to) {
  const key = `companynews:${symbol}:${from}:${to}`;
  const hit = cached(key, "news");
  if (hit) return hit;

  const data = await finnhubGet("/company-news", {
    symbol: symbol.toUpperCase(),
    from,
    to,
  });
  setCache(key, data, "news");
  return data;
}

// ─── Earnings ───────────────────────────────────────────────

async function getEarnings(symbol) {
  const key = `earnings:${symbol}`;
  const hit = cached(key, "fundamentals");
  if (hit) return hit;

  const data = await finnhubGet("/stock/earnings", { symbol: symbol.toUpperCase() });
  setCache(key, data, "fundamentals");
  return data;
}

// ─── Symbol Search ──────────────────────────────────────────

async function searchSymbol(query) {
  const key = `search:${query}`;
  const hit = cached(key, "search");
  if (hit) return hit;

  const data = await finnhubGet("/search", { q: query });
  setCache(key, data, "search");
  return data;
}

// ─── Exports ────────────────────────────────────────────────

module.exports = {
  isConfigured,
  getQuote,
  getCandles,
  getForexRates,
  getForexCandles,
  getCompanyProfile,
  getFinancials,
  getTechnicalIndicator,
  getPatternRecognition,
  getNews,
  getCompanyNews,
  getEarnings,
  searchSymbol,
};
