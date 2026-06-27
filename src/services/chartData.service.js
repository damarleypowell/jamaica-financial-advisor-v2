// ══════════════════════════════════════════════════════════════════════════════
// Chart data service
// ──────────────────────────────────────────────────────────────────────────────
// Two concerns live here:
//   1. fetchYahooChart()   — real OHLC for US equities/ETFs/indices/FX via Yahoo's
//      v8 chart API. We hit it directly (browser UA) because yahoo-finance2's
//      `historical()` uses the retired /v7/finance/download CSV endpoint, which now
//      returns 429/401 and silently breaks every US chart.
//   2. syntheticDailyHistory() — JSE has no free historical OHLC feed (Yahoo 404s
//      `.JM`, jseinvestor's graph data is frozen at 2024-10), so we render a
//      deterministic daily series ANCHORED to the real, freshly-scraped live price.
//      Same symbol+price always yields the same shape, so it is stable across
//      requests and server restarts. Always labelled `source: "indicative"`.
// ══════════════════════════════════════════════════════════════════════════════

const https = require("https");

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MAX_BYTES = 8 * 1024 * 1024; // hard ceiling so a hostile/huge body can't OOM us

// Minimal JSON GET. Yahoo rejects non-browser User-Agents, so we always send one.
function getJSON(url, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = "";
        let bytes = 0;
        res.on("data", (c) => {
          bytes += c.length;
          if (bytes > MAX_BYTES) { req.destroy(new Error("response too large")); return; }
          data += c;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (_) {
            reject(new Error("invalid json response"));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
  });
}

const YF_INTERVAL = {
  1: "1m", 5: "5m", 15: "15m", 30: "30m", 60: "60m",
  D: "1d", W: "1wk", M: "1mo",
};

// Real OHLC from Yahoo Finance v8 chart API → normalized candle objects.
// Each candle carries both `value` (close) and full OHLC so the same payload
// renders an area line or a candlestick series without reshaping on the client.
async function fetchYahooChart(symbol, resolution = "D") {
  const interval = YF_INTERVAL[resolution] || "1d";
  const range = interval.endsWith("m") ? "1mo" : "1y";
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&range=${range}&includePrePost=false`;

  const json = await getJSON(url);
  const result = json && json.chart && json.chart.result && json.chart.result[0];
  if (!result || !result.timestamp) return [];

  const ts = result.timestamp;
  const q = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open && q.open[i];
    const h = q.high && q.high[i];
    const l = q.low && q.low[i];
    const c = q.close && q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      time: ts[i],
      value: +c,
      open: +o,
      high: +h,
      low: +l,
      close: +c,
      volume: (q.volume && q.volume[i]) || 0,
    });
  }
  return candles;
}

// ── Deterministic synthetic JSE history ─────────────────────────────────────
// FNV-1a hash → seed, mulberry32 → stable PRNG. Keyed by symbol so the walk is
// identical every time (no flicker between refreshes / no reset on redeploy).
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Most-recent `days` weekday timestamps, oldest → newest. Anchored to the
// Jamaican trading day (UTC−5, no DST) so the last candle matches the local
// session the live price came from, then expressed back in UTC-midnight seconds.
const JM_OFFSET_SEC = 5 * 3600;
function recentWeekdayStamps(days) {
  const stamps = [];
  const d = new Date(Date.now() - JM_OFFSET_SEC * 1000);
  d.setUTCHours(0, 0, 0, 0);
  while (stamps.length < days) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) stamps.push(Math.floor(d.getTime() / 1000));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return stamps.reverse();
}

// Build a daily OHLC series that ENDS on the real current price and (when known)
// stays inside the real 52-week band. Returns candle objects shaped like
// fetchYahooChart() so both data paths are interchangeable on the client.
function syntheticDailyHistory(symbol, livePrice, dayChangePct = 0, opts = {}) {
  const price = Number(livePrice);
  if (!Number.isFinite(price) || price <= 0) return [];

  const days = Math.max(20, Math.min(opts.days || 90, 260));
  let high52 = Number(opts.high52) || null;
  let low52 = Number(opts.low52) || null;
  // The JSE scrape occasionally yields incoherent 52-week figures (e.g. a low
  // sitting ABOVE the live price). Only honour a band that actually brackets the
  // current price — otherwise clamping pins the whole series flat against a bad
  // bound and leaves a phantom cliff at the most recent candle.
  if (!(low52 && high52 && low52 < price && price < high52)) {
    high52 = null;
    low52 = null;
  }

  const rnd = mulberry32(hashStr(String(symbol).toUpperCase()));
  const dailyVol = 0.012 + rnd() * 0.012; // 1.2–2.4% per-symbol daily volatility

  // Walk backwards from today's real price.
  const closes = new Array(days);
  closes[days - 1] = price;
  closes[days - 2] = dayChangePct
    ? price / (1 + dayChangePct / 100)
    : price * (1 + (rnd() - 0.5) * dailyVol);
  for (let i = days - 3; i >= 0; i--) {
    let c = closes[i + 1] / (1 + (rnd() * 2 - 1) * dailyVol);
    if (high52 && c > high52) c = high52;
    if (low52 && c < low52) c = low52;
    closes[i] = c;
  }

  const stamps = recentWeekdayStamps(days);
  const out = [];
  for (let i = 0; i < days; i++) {
    const c = +closes[i].toFixed(2);
    const o = +(i > 0 ? closes[i - 1] : c * (1 + (rnd() - 0.5) * 0.01)).toFixed(2);
    const hi = +(Math.max(o, c) * (1 + rnd() * 0.006)).toFixed(2);
    const lo = +(Math.min(o, c) * (1 - rnd() * 0.006)).toFixed(2);
    out.push({
      time: stamps[i],
      value: c,
      open: o,
      high: hi,
      low: lo,
      close: c,
      volume: Math.round(40000 + rnd() * 220000),
    });
  }
  return out;
}

module.exports = { fetchYahooChart, syntheticDailyHistory };
