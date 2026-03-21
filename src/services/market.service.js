const {
  scrapeAllStocks,
  scrapeStockDetail,
  fetchYahooQuote,
  fetchYahooResearch,
  formatMarketCap,
  getYahooSymbol,
} = require("../../jse-scraper");

// ══════════════════════════════════════════════════════════════════════════════
// ── Market Data Service ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

let livePrices = [];
const priceHistory = {};
const researchCache = {};
const RESEARCH_TTL = 12 * 60 * 1000;

// SSE connected clients
const sseClients = new Set();

// ── Yahoo Finance (optional) ────────────────────────────────────────────────
let yahooFinance = null;
try {
  yahooFinance = require("yahoo-finance2").default;
  console.log("yahoo-finance2 loaded - real market data enabled");
} catch (_) {
  console.warn("yahoo-finance2 not installed. Run: npm install yahoo-finance2");
}

// ── Sector normalization ────────────────────────────────────────────────────
function normalizeSector(raw) {
  if (!raw || raw === "0" || raw.trim() === "") return "General";
  const s = raw.toUpperCase();
  if (/FINANC|BANK|INVEST|CREDIT/.test(s)) return "Financial";
  if (/INSUR/.test(s)) return "Insurance";
  if (/MANUFACTUR|CEMENT|PAINT|TOBACCO/.test(s)) return "Manufacturing";
  if (/FOOD|BEVERAGE|AGRI/.test(s)) return "Food";
  if (/CONGLOM/.test(s)) return "Conglomerate";
  if (/TECH|IT|SOFTWARE/.test(s)) return "Technology";
  if (/TOUR|HOTEL|ENTERTAIN/.test(s)) return "Tourism";
  if (/DISTRIB|RETAIL|TRADE/.test(s)) return "Distribution";
  if (/TRANSPORT|LOGIST|SHIPPING/.test(s)) return "Transport";
  if (/HEALTH|PHARMA/.test(s)) return "Healthcare";
  if (/ENERGY|OIL|UTIL/.test(s)) return "Energy";
  if (/CONSTRUCT|PROPERTY|REAL/.test(s)) return "Construction";
  if (/MEDIA|COMMUN/.test(s)) return "Media";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

// ── Primary data fetcher ────────────────────────────────────────────────────
let isFetching = false;

async function fetchRealPrices() {
  if (isFetching) return;
  isFetching = true;

  try {
    const scraped = await scrapeAllStocks();
    if (!scraped || scraped.length === 0) {
      console.warn("jseinvestor.com returned no data, keeping previous prices");
      isFetching = false;
      return;
    }

    if (livePrices.length === 0) {
      livePrices = scraped.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        sector: "General",
        price: s.price,
        livePrice: s.price,
        liveChange: s.pctChange,
        dollarChange: s.dollarChange,
        volume: s.volume,
        marketCap: "N/A",
        pe: 0,
        divYield: 0,
        high52: null,
        low52: null,
        eps: null,
        bid: null,
        ask: null,
        dayHigh: null,
        dayLow: null,
        issuedShares: null,
        currency: s.currency || "JMD",
        dataSource: "jseinvestor",
      }));
      livePrices.forEach((s) => {
        if (!priceHistory[s.symbol]) priceHistory[s.symbol] = [];
        priceHistory[s.symbol].push(s.price);
        if (priceHistory[s.symbol].length > 500) priceHistory[s.symbol].shift();
      });
      console.log(
        `Loaded ${livePrices.length} real JSE stocks from jseinvestor.com`
      );
      enrichStockDetails();
    } else {
      let updated = 0;
      scraped.forEach((s) => {
        const existing = livePrices.find((lp) => lp.symbol === s.symbol);
        if (existing) {
          existing.price = s.price;
          existing.livePrice = s.price;
          existing.liveChange = s.pctChange;
          existing.dollarChange = s.dollarChange;
          existing.volume = s.volume;
          existing.dataSource = "jseinvestor";
          priceHistory[s.symbol] = priceHistory[s.symbol] || [];
          priceHistory[s.symbol].push(s.price);
          if (priceHistory[s.symbol].length > 500)
            priceHistory[s.symbol].shift();
          updated++;
        } else {
          livePrices.push({
            symbol: s.symbol,
            name: s.name,
            sector: "General",
            price: s.price,
            livePrice: s.price,
            liveChange: s.pctChange,
            dollarChange: s.dollarChange,
            volume: s.volume,
            marketCap: "N/A",
            pe: 0,
            divYield: 0,
            high52: null,
            low52: null,
            eps: null,
            bid: null,
            ask: null,
            dayHigh: null,
            dayLow: null,
            issuedShares: null,
            currency: s.currency || "JMD",
            dataSource: "jseinvestor",
          });
          priceHistory[s.symbol] = [s.price];
        }
      });
      console.log(
        `Updated ${updated}/${scraped.length} stock prices (real data)`
      );
    }
  } catch (e) {
    console.error("fetchRealPrices error:", e.message);
  }

  isFetching = false;
}

// ── Enrich stocks with detail data ──────────────────────────────────────────
async function enrichStockDetails() {
  console.log("Enriching stocks with detail data...");
  const batchSize = 5;
  let enriched = 0;
  for (let i = 0; i < livePrices.length; i += batchSize) {
    const batch = livePrices.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (stock) => {
        try {
          const detail = await scrapeStockDetail(stock.symbol);
          if (detail) {
            if (detail.sector) stock.sector = normalizeSector(detail.sector);
            if (detail.marketCap) stock.marketCap = detail.marketCap;
            if (detail.high52) stock.high52 = detail.high52;
            if (detail.low52) stock.low52 = detail.low52;
            if (detail.bid) stock.bid = detail.bid;
            if (detail.ask) stock.ask = detail.ask;
            if (detail.dayHigh) stock.dayHigh = detail.dayHigh;
            if (detail.dayLow) stock.dayLow = detail.dayLow;
            if (detail.issuedShares)
              stock.issuedShares = detail.issuedShares;
            if (detail.volumeDetail) stock.volume = detail.volumeDetail;
            enriched++;
          }
        } catch (_) {}
      })
    );
    if (i + batchSize < livePrices.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  console.log(
    `Enriched ${enriched}/${livePrices.length} stocks with sector/market cap/52w data`
  );
}

// ── SSE broadcast interval ──────────────────────────────────────────────────
function startSSEBroadcast() {
  setInterval(() => {
    if (livePrices.length === 0) return;
    const payload = JSON.stringify(
      livePrices.map((s) => ({
        symbol: s.symbol,
        price: s.livePrice,
        change: s.liveChange,
        volume: s.volume,
      }))
    );
    sseClients.forEach((client) => {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (_) {}
    });
  }, 3000);
}

// ── RSI calculator (reusable) ───────────────────────────────────────────────
function calculateRSI(prices) {
  if (prices.length < 15) return 50;
  let g = 0,
    l = 0;
  for (let i = prices.length - 14; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) g += d;
    else l -= d;
  }
  const ag = g / 14,
    al = l / 14;
  return al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(1);
}

module.exports = {
  // Data
  get livePrices() {
    return livePrices;
  },
  get priceHistory() {
    return priceHistory;
  },
  get researchCache() {
    return researchCache;
  },
  RESEARCH_TTL,
  sseClients,
  yahooFinance,

  // Functions
  fetchRealPrices,
  enrichStockDetails,
  normalizeSector,
  startSSEBroadcast,
  calculateRSI,
  getYahooSymbol,
};
