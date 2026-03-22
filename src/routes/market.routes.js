const { Router } = require("express");
const { fetchAllNews } = require("../../news-scraper");
const marketService = require("../services/market.service");

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// ── Stock Data Routes ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/stocks", (_req, res) => {
  res.json(
    marketService.livePrices.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      price: s.livePrice,
      change: s.liveChange,
      volume: s.volume,
      marketCap: s.marketCap,
      sector: s.sector,
      pe: s.pe,
      divYield: s.divYield,
    }))
  );
});

router.get("/api/stocks/:symbol", (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  const stock = marketService.livePrices.find((s) => s.symbol === sym);
  if (!stock) return res.status(404).json({ error: "Stock not found" });

  const hist = marketService.priceHistory[sym] || [];
  const prices = hist.slice(-30);
  const rsi = marketService.calculateRSI(prices);
  const high30 = prices.length ? +Math.max(...prices).toFixed(2) : null;
  const low30 = prices.length ? +Math.min(...prices).toFixed(2) : null;

  res.json({
    symbol: stock.symbol,
    name: stock.name,
    price: stock.livePrice,
    change: stock.liveChange,
    volume: stock.volume,
    marketCap: stock.marketCap,
    sector: stock.sector,
    pe: stock.pe,
    divYield: stock.divYield,
    high52: stock.high52,
    low52: stock.low52,
    eps: stock.eps,
    high30,
    low30,
    rsi,
    dataSource: stock.dataSource,
    history: hist,
  });
});

router.get("/api/market-overview", (_req, res) => {
  const lp = marketService.livePrices;
  const gainers = lp.filter((s) => s.liveChange > 0).length;
  const losers = lp.filter((s) => s.liveChange < 0).length;
  const sorted = [...lp].sort((a, b) => b.liveChange - a.liveChange);
  const topGainer = sorted[0];
  const topLoser = sorted[sorted.length - 1];
  const totalVolume = lp.reduce((sum, s) => sum + s.volume, 0);

  res.json({
    gainers,
    losers,
    unchanged: lp.length - gainers - losers,
    topGainer: topGainer
      ? { symbol: topGainer.symbol, change: topGainer.liveChange }
      : null,
    topLoser: topLoser
      ? { symbol: topLoser.symbol, change: topLoser.liveChange }
      : null,
    totalVolume,
    totalStocks: lp.length,
  });
});

router.get("/api/history/:symbol", (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  const hist = marketService.priceHistory[sym];
  if (!hist) return res.status(404).json({ error: "Not found" });
  res.json({ symbol: sym, history: hist });
});

// ── SSE — push real prices to connected clients ─────────────────────────────

router.get("/api/stream/prices", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const initial = JSON.stringify(
    marketService.livePrices.map((s) => ({
      symbol: s.symbol,
      price: s.livePrice,
      change: s.liveChange,
      volume: s.volume,
    }))
  );
  res.write(`data: ${initial}\n\n`);
  marketService.sseClients.add(res);
  req.on("close", () => marketService.sseClients.delete(res));
});

// ── Sectors ─────────────────────────────────────────────────────────────────

router.get("/api/sectors", (_req, res) => {
  const sectorMap = {};
  marketService.livePrices.forEach((s) => {
    if (!sectorMap[s.sector])
      sectorMap[s.sector] = { stocks: [], totalChange: 0, totalVolume: 0 };
    sectorMap[s.sector].stocks.push(s.symbol);
    sectorMap[s.sector].totalChange += s.liveChange;
    sectorMap[s.sector].totalVolume += s.volume;
  });

  const sectors = Object.entries(sectorMap)
    .map(([name, data]) => ({
      name,
      avgChange: +(data.totalChange / data.stocks.length).toFixed(2),
      stockCount: data.stocks.length,
      totalVolume: data.totalVolume,
      stocks: data.stocks,
      performance:
        data.totalChange / data.stocks.length > 1
          ? "bullish"
          : data.totalChange / data.stocks.length < -1
          ? "bearish"
          : "neutral",
    }))
    .sort((a, b) => b.avgChange - a.avgChange);

  res.json(sectors);
});

// ── Stock Screener ──────────────────────────────────────────────────────────

router.post("/api/screener", (req, res) => {
  const {
    minPE,
    maxPE,
    minDiv,
    maxDiv,
    sectors,
    minChange,
    maxChange,
    sortBy,
    sortDir,
  } = req.body;

  let results = marketService.livePrices.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    price: s.livePrice,
    change: s.liveChange,
    volume: s.volume,
    marketCap: s.marketCap,
    sector: s.sector,
    pe: s.pe,
    divYield: s.divYield,
  }));

  if (minPE != null) results = results.filter((s) => s.pe >= minPE);
  if (maxPE != null) results = results.filter((s) => s.pe <= maxPE);
  if (minDiv != null) results = results.filter((s) => s.divYield >= minDiv);
  if (maxDiv != null) results = results.filter((s) => s.divYield <= maxDiv);
  if (sectors && sectors.length > 0)
    results = results.filter((s) => sectors.includes(s.sector));
  if (minChange != null) results = results.filter((s) => s.change >= minChange);
  if (maxChange != null) results = results.filter((s) => s.change <= maxChange);

  if (sortBy) {
    const dir = sortDir === "desc" ? -1 : 1;
    results.sort((a, b) => {
      const av = a[sortBy],
        bv = b[sortBy];
      if (typeof av === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  res.json({ results, total: results.length });
});

// ── Stock Comparison ────────────────────────────────────────────────────────

router.post("/api/compare", (req, res) => {
  const { symbols } = req.body;
  if (!symbols || !Array.isArray(symbols) || symbols.length < 2)
    return res.status(400).json({ error: "At least 2 symbols required" });

  const comparison = symbols
    .map((sym) => {
      const stock = marketService.livePrices.find(
        (s) => s.symbol === sym.toUpperCase()
      );
      if (!stock) return null;
      const hist = marketService.priceHistory[sym.toUpperCase()] || [];
      const prices = hist.slice(-30);
      const rsi = marketService.calculateRSI(prices);
      const high30 = prices.length ? Math.max(...prices) : stock.livePrice;
      const low30 = prices.length ? Math.min(...prices) : stock.livePrice;

      return {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.livePrice,
        change: stock.liveChange,
        sector: stock.sector,
        pe: stock.pe,
        divYield: stock.divYield,
        volume: stock.volume,
        marketCap: stock.marketCap,
        rsi,
        high30: +high30.toFixed(2),
        low30: +low30.toFixed(2),
      };
    })
    .filter(Boolean);

  res.json({ comparison });
});

// ── Research (Yahoo Finance) ────────────────────────────────────────────────

router.get("/api/research/:symbol", async (req, res) => {
  if (!marketService.yahooFinance) {
    return res
      .status(503)
      .json({ error: "Yahoo Finance not available", fallback: true });
  }

  const sym = req.params.symbol.toUpperCase();
  const stock = marketService.livePrices.find((s) => s.symbol === sym);
  if (!stock) return res.status(404).json({ error: "Symbol not found" });

  const cache = marketService.researchCache;
  if (cache[sym] && Date.now() - cache[sym].ts < marketService.RESEARCH_TTL) {
    return res.json(cache[sym].data);
  }

  const yfSym = marketService.getYahooSymbol(sym);
  const period1 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  try {
    const [quoteResult, histResult] = await Promise.allSettled([
      marketService.yahooFinance.quoteSummary(yfSym, {
        modules: [
          "summaryDetail",
          "financialData",
          "defaultKeyStatistics",
        ],
        validateResult: false,
      }),
      marketService.yahooFinance.historical(yfSym, {
        period1,
        interval: "1d",
      }),
    ]);

    const q =
      quoteResult.status === "fulfilled" ? quoteResult.value : null;
    const rawHist =
      histResult.status === "fulfilled" ? histResult.value : [];

    if (!q && rawHist.length === 0) {
      return res.status(404).json({
        error: "No market data for this symbol on Yahoo Finance",
        fallback: true,
      });
    }

    const fundamentals = q
      ? {
          pe: q.summaryDetail?.trailingPE ?? null,
          forwardPE: q.summaryDetail?.forwardPE ?? null,
          pb: q.defaultKeyStatistics?.priceToBook ?? null,
          eps: q.defaultKeyStatistics?.trailingEps ?? null,
          dividendYield: q.summaryDetail?.dividendYield ?? null,
          marketCap: q.summaryDetail?.marketCap ?? null,
          revenue: q.financialData?.totalRevenue ?? null,
          profitMargin: q.financialData?.profitMargins ?? null,
          roe: q.financialData?.returnOnEquity ?? null,
          currentRatio: q.financialData?.currentRatio ?? null,
          debtToEquity: q.financialData?.debtToEquity ?? null,
          targetPrice: q.financialData?.targetMeanPrice ?? null,
          recommendation:
            q.financialData?.recommendationKey?.toUpperCase() ?? null,
          revenueGrowth: q.financialData?.revenueGrowth ?? null,
          earningsGrowth: q.financialData?.earningsGrowth ?? null,
          beta: q.defaultKeyStatistics?.beta ?? null,
          enterpriseValue:
            q.defaultKeyStatistics?.enterpriseValue ?? null,
          evToEbitda:
            q.defaultKeyStatistics?.enterpriseToEbitda ?? null,
        }
      : null;

    const candles = rawHist
      .filter(
        (b) => b.open > 0 && b.close > 0 && b.high > 0 && b.low > 0
      )
      .map((b) => ({
        time: Math.floor(new Date(b.date).getTime() / 1000),
        open: +b.open.toFixed(2),
        high: +b.high.toFixed(2),
        low: +b.low.toFixed(2),
        close: +b.close.toFixed(2),
        volume: b.volume || 0,
      }));

    const closes = candles.map((c) => c.close);
    let rsi14 = null;
    if (closes.length >= 15) {
      let gains = 0,
        losses = 0;
      for (let i = closes.length - 14; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        if (d > 0) gains += d;
        else losses -= d;
      }
      const avgG = gains / 14,
        avgL = losses / 14;
      rsi14 =
        avgL === 0 ? 100 : +(100 - 100 / (1 + avgG / avgL)).toFixed(1);
    }

    let annVol = null;
    if (closes.length >= 20) {
      const rets = closes
        .slice(1)
        .map((p, i) => Math.log(p / closes[i]));
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance =
        rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
      annVol = +(Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(1);
    }

    const allHighs = candles.map((c) => c.high);
    const allLows = candles.map((c) => c.low);
    const high90 = allHighs.length
      ? +Math.max(...allHighs).toFixed(2)
      : null;
    const low90 = allLows.length
      ? +Math.min(...allLows).toFixed(2)
      : null;
    const avgClose = closes.length
      ? +(closes.reduce((a, b) => a + b, 0) / closes.length).toFixed(2)
      : null;

    const data = {
      symbol: sym,
      realData: true,
      fundamentals,
      candles,
      derived: {
        rsi14,
        annVol,
        high90,
        low90,
        avgClose,
        candleCount: candles.length,
      },
    };

    cache[sym] = { data, ts: Date.now() };
    res.json(data);
  } catch (e) {
    console.warn(
      `Yahoo Finance error [${sym}]:`,
      e.message?.slice(0, 120)
    );
    res.status(502).json({
      error: "Research data temporarily unavailable",
      fallback: true,
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Forex Rates ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const FOREX_PAIRS = [
  { pair: "JMDUSD=X", from: "JMD", to: "USD", name: "Jamaican Dollar / US Dollar" },
  { pair: "USDGBP=X", from: "USD", to: "GBP", name: "US Dollar / British Pound" },
  { pair: "USDEUR=X", from: "USD", to: "EUR", name: "US Dollar / Euro" },
  { pair: "USDJPY=X", from: "USD", to: "JPY", name: "US Dollar / Japanese Yen" },
  { pair: "USDCAD=X", from: "USD", to: "CAD", name: "US Dollar / Canadian Dollar" },
  { pair: "USDCHF=X", from: "USD", to: "CHF", name: "US Dollar / Swiss Franc" },
  { pair: "USDAUD=X", from: "USD", to: "AUD", name: "US Dollar / Australian Dollar" },
  { pair: "USDTTD=X", from: "USD", to: "TTD", name: "US Dollar / Trinidad Dollar" },
  { pair: "USDBBD=X", from: "USD", to: "BBD", name: "US Dollar / Barbados Dollar" },
  { pair: "BTCUSD=X", from: "BTC", to: "USD", name: "Bitcoin / US Dollar" },
  { pair: "ETHUSD=X", from: "ETH", to: "USD", name: "Ethereum / US Dollar" },
];

let forexCache = null;
let forexCacheTime = 0;
const FOREX_TTL = 60 * 1000; // 1 minute

// Helper: fetch multiple Yahoo quotes in small batches with delay
async function batchYahooQuotes(symbols) {
  const yf = marketService.yahooFinance;
  if (!yf) return {};
  const results = {};
  const batchSize = 3;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(s => yf.quote(s).catch(() => null)));
    settled.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value?.regularMarketPrice) {
        results[batch[j]] = r.value;
      }
    });
    if (i + batchSize < symbols.length) await new Promise(r => setTimeout(r, 500));
  }
  return results;
}

router.get("/api/forex", async (_req, res) => {
  const now = Date.now();
  if (forexCache && now - forexCacheTime < FOREX_TTL) return res.json(forexCache);

  if (!marketService.yahooFinance) {
    return res.status(503).json({ error: "Yahoo Finance not available" });
  }

  try {
    const quotes = await batchYahooQuotes(FOREX_PAIRS.map(p => p.pair));

    const rates = FOREX_PAIRS.map(p => {
      const q = quotes[p.pair];
      if (!q) return null;
      return {
        pair: `${p.from}/${p.to}`,
        name: p.name,
        rate: q.regularMarketPrice,
        change: q.regularMarketChangePercent ? +q.regularMarketChangePercent.toFixed(4) : null,
        dayHigh: q.regularMarketDayHigh || null,
        dayLow: q.regularMarketDayLow || null,
        prevClose: q.regularMarketPreviousClose || null,
      };
    }).filter(Boolean);

    forexCache = { rates, updatedAt: new Date().toISOString() };
    forexCacheTime = now;
    res.json(forexCache);
  } catch (e) {
    console.error("Forex fetch error:", e.message);
    res.status(500).json({ error: "Failed to fetch forex rates" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Global Market Indices ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const GLOBAL_INDICES = [
  { symbol: "^DJI", name: "Dow Jones", market: "US" },
  { symbol: "^GSPC", name: "S&P 500", market: "US" },
  { symbol: "^IXIC", name: "NASDAQ", market: "US" },
  { symbol: "^RUT", name: "Russell 2000", market: "US" },
  { symbol: "^FTSE", name: "FTSE 100", market: "UK" },
  { symbol: "^N225", name: "Nikkei 225", market: "Japan" },
  { symbol: "^HSI", name: "Hang Seng", market: "Hong Kong" },
  { symbol: "^GDAXI", name: "DAX", market: "Germany" },
  { symbol: "GC=F", name: "Gold", market: "Commodity" },
  { symbol: "SI=F", name: "Silver", market: "Commodity" },
  { symbol: "CL=F", name: "Crude Oil", market: "Commodity" },
  { symbol: "BTC-USD", name: "Bitcoin", market: "Crypto" },
  { symbol: "ETH-USD", name: "Ethereum", market: "Crypto" },
];

let indicesCache = null;
let indicesCacheTime = 0;
const INDICES_TTL = 60 * 1000;

router.get("/api/global-markets", async (_req, res) => {
  const now = Date.now();
  if (indicesCache && now - indicesCacheTime < INDICES_TTL) return res.json(indicesCache);

  if (!marketService.yahooFinance) {
    return res.status(503).json({ error: "Yahoo Finance not available" });
  }

  try {
    const quotes = await batchYahooQuotes(GLOBAL_INDICES.map(idx => idx.symbol));

    const indices = GLOBAL_INDICES.map(idx => {
      const q = quotes[idx.symbol];
      if (!q) return null;
      return {
        symbol: idx.symbol,
        name: idx.name,
        market: idx.market,
        price: q.regularMarketPrice,
        change: q.regularMarketChangePercent ? +q.regularMarketChangePercent.toFixed(2) : null,
        dollarChange: q.regularMarketChange ? +q.regularMarketChange.toFixed(2) : null,
        dayHigh: q.regularMarketDayHigh || null,
        dayLow: q.regularMarketDayLow || null,
        prevClose: q.regularMarketPreviousClose || null,
        volume: q.regularMarketVolume || null,
      };
    }).filter(Boolean);

    indicesCache = { indices, updatedAt: new Date().toISOString() };
    indicesCacheTime = now;
    res.json(indicesCache);
  } catch (e) {
    console.error("Global markets fetch error:", e.message);
    res.status(500).json({ error: "Failed to fetch global market data" });
  }
});

// ── News ────────────────────────────────────────────────────────────────────

router.get("/api/news", async (req, res) => {
  const { sector, symbol } = req.query;
  try {
    let news = await fetchAllNews();
    if (sector) news = news.filter((n) => n.sector === sector);
    if (symbol) news = news.filter((n) => n.symbol === symbol);
    res.json(news);
  } catch (e) {
    console.error("News fetch error:", e.message);
    res.json([]);
  }
});

module.exports = router;
