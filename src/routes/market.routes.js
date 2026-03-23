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

  let partial = false;

  const comparison = symbols
    .map((sym) => {
      const upperSym = sym.toUpperCase();
      const stock = marketService.livePrices.find(
        (s) => s.symbol === upperSym
      );

      // If not in livePrices, try to build partial data from price history
      if (!stock) {
        const hist = marketService.priceHistory[upperSym] || [];
        if (hist.length > 0) {
          partial = true;
          const lastPrice = hist[hist.length - 1];
          const prices = hist.slice(-30);
          const rsi = marketService.calculateRSI(prices);
          const high30 = Math.max(...prices);
          const low30 = Math.min(...prices);
          return {
            symbol: upperSym,
            name: null,
            price: lastPrice,
            change: null,
            sector: null,
            pe: null,
            divYield: null,
            volume: null,
            marketCap: null,
            high52: null,
            low52: null,
            bid: null,
            ask: null,
            dayHigh: null,
            dayLow: null,
            rsi,
            high30: +high30.toFixed(2),
            low30: +low30.toFixed(2),
          };
        }
        return null;
      }

      const hist = marketService.priceHistory[upperSym] || [];
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
        high52: stock.high52 || null,
        low52: stock.low52 || null,
        bid: stock.bid || null,
        ask: stock.ask || null,
        dayHigh: stock.dayHigh || null,
        dayLow: stock.dayLow || null,
        rsi,
        high30: +high30.toFixed(2),
        low30: +low30.toFixed(2),
      };
    })
    .filter(Boolean);

  res.json({ comparison, partial });
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

// Simple keyword-based sentiment scoring (no external API needed)
function scoreSentiment(text) {
  const t = (text || "").toLowerCase();
  const POSITIVE = [
    "growth", "profit", "surge", "gain", "rally", "record", "strong",
    "upgrade", "dividend", "expansion", "increase", "positive", "recovery",
    "milestone", "success", "outperform", "bullish", "boost", "optimism",
    "revenue", "earnings beat", "up ", "higher", "improved", "breakthrough",
  ];
  const NEGATIVE = [
    "loss", "decline", "drop", "fall", "crash", "risk", "weak",
    "downgrade", "debt", "layoff", "fraud", "bankruptcy", "recession",
    "bearish", "warning", "concern", "default", "plunge", "cut ",
    "lower", "slump", "crisis", "penalty", "lawsuit", "sell-off",
  ];
  let score = 0;
  for (const word of POSITIVE) if (t.includes(word)) score += 1;
  for (const word of NEGATIVE) if (t.includes(word)) score -= 1;
  if (score > 1) return { sentiment: "positive", score };
  if (score < -1) return { sentiment: "negative", score };
  return { sentiment: "neutral", score };
}

router.get("/api/news", async (req, res) => {
  const { sector, symbol } = req.query;
  try {
    let news = await fetchAllNews();
    if (sector) news = news.filter((n) => n.sector === sector);
    if (symbol) news = news.filter((n) => n.symbol === symbol);

    // Add sentiment analysis to each article
    const enriched = news.map((article) => {
      const { sentiment, score } = scoreSentiment(
        `${article.title || ""} ${article.summary || ""} ${article.description || ""}`
      );
      return { ...article, sentiment, sentimentScore: score };
    });

    res.json(enriched);
  } catch (e) {
    console.error("News fetch error:", e.message);
    res.json([]);
  }
});

// ── Currency Impact Analysis ────────────────────────────────────────────────

router.get("/api/currency-impact", async (req, res) => {
  try {
    const yf = require("yahoo-finance2").default;

    // Get current and historical JMD/USD rate
    const jmdQuote = await yf.quote("JMDUSD=X").catch(() => null);
    const currentRate = jmdQuote?.regularMarketPrice || null;

    // Get historical rates for trend analysis (30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    let historicalRates = [];
    try {
      const hist = await yf.chart("JMDUSD=X", {
        period1: startDate,
        period2: endDate,
        interval: "1d",
      });
      historicalRates = (hist?.quotes || [])
        .filter((q) => q.close)
        .map((q) => ({
          date: new Date(q.date).toISOString().split("T")[0],
          rate: q.close,
        }));
    } catch (_) {
      // Fallback: no historical data
    }

    // Categorize JSE stocks by currency sensitivity
    const stocks = marketService.livePrices;
    const importSensitive = []; // Companies that import heavily (hurt by JMD weakness)
    const exportBeneficiaries = []; // Companies that earn USD (benefit from JMD weakness)
    const neutral = [];

    // Known sector classifications for currency impact
    const EXPORT_SECTORS = ["tourism", "mining", "bauxite", "manufacturing"];
    const IMPORT_SECTORS = ["retail", "distribution", "energy", "motor"];

    for (const stock of stocks) {
      const sector = (stock.sector || "").toLowerCase();
      const name = (stock.name || "").toLowerCase();
      const isExport =
        EXPORT_SECTORS.some((s) => sector.includes(s) || name.includes(s)) ||
        name.includes("grace") ||
        name.includes("seprod");
      const isImport =
        IMPORT_SECTORS.some((s) => sector.includes(s) || name.includes(s)) ||
        name.includes("progressive") ||
        name.includes("fontana");

      const entry = {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.livePrice,
        change: stock.liveChange,
        sector: stock.sector,
      };

      if (isExport) exportBeneficiaries.push({ ...entry, impact: "positive" });
      else if (isImport) importSensitive.push({ ...entry, impact: "negative" });
      else neutral.push({ ...entry, impact: "neutral" });
    }

    // Calculate rate of change
    let rateChange30d = null;
    let rateChange90d = null;
    if (historicalRates.length >= 2) {
      const latest = historicalRates[historicalRates.length - 1].rate;
      const thirtyDaysAgo =
        historicalRates.length > 30
          ? historicalRates[historicalRates.length - 31]?.rate
          : historicalRates[0].rate;
      const ninetyDaysAgo = historicalRates[0].rate;
      if (thirtyDaysAgo) rateChange30d = ((latest - thirtyDaysAgo) / thirtyDaysAgo) * 100;
      if (ninetyDaysAgo) rateChange90d = ((latest - ninetyDaysAgo) / ninetyDaysAgo) * 100;
    }

    res.json({
      currentRate,
      rateChange30d: rateChange30d ? +rateChange30d.toFixed(2) : null,
      rateChange90d: rateChange90d ? +rateChange90d.toFixed(2) : null,
      historicalRates: historicalRates.slice(-30),
      exportBeneficiaries,
      importSensitive,
      neutral: neutral.slice(0, 10),
      analysis: {
        jmdStrengthening: rateChange30d > 0,
        summary: currentRate
          ? `JMD is currently trading at ${(1 / currentRate).toFixed(2)} per 1 USD. ${
              rateChange30d > 0
                ? `The dollar has strengthened ${Math.abs(rateChange30d).toFixed(1)}% over the past 30 days, which benefits importers.`
                : rateChange30d < 0
                  ? `The dollar has weakened ${Math.abs(rateChange30d).toFixed(1)}% over the past 30 days, which benefits exporters and USD earners.`
                  : "The exchange rate has been stable over the past 30 days."
            }`
          : "Exchange rate data currently unavailable.",
      },
    });
  } catch (e) {
    console.error("[currency-impact] Error:", e.message);
    res.status(500).json({ error: "Failed to load currency impact data" });
  }
});

// ── Dividend Calendar ───────────────────────────────────────────────────────

router.get("/api/dividends", async (req, res) => {
  try {
    const yf = require("yahoo-finance2").default;
    const stocks = marketService.livePrices;
    const dividends = [];

    // Fetch dividend data for each stock that has a dividend yield
    const withDivs = stocks.filter(
      (s) => s.divYield && parseFloat(s.divYield) > 0
    );

    // Batch fetch — process 3 at a time with delay
    for (let i = 0; i < withDivs.length; i += 3) {
      const batch = withDivs.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(async (stock) => {
          // Try Yahoo Finance YAHOO_MAP or direct symbol
          const YAHOO_MAP = {
            NCBFG: "NCBFG.JM", GK: "GK.JM", SJ: "SJ.JM",
            JMMBGL: "JMMBGL.JM", WIG: "WIG.JM", SVL: "SVL.JM",
            SEP: "SEP.JM", LASD: "LASD.JM", CCC: "CCC.JM",
            DTL: "DTL.JM", BILS: "BILS.JM", MIL: "MIL.JM",
          };
          const yahooSym = YAHOO_MAP[stock.symbol] || `${stock.symbol}.JM`;

          try {
            const quote = await yf.quoteSummary(yahooSym, {
              modules: ["calendarEvents", "summaryDetail"],
            });

            const calendar = quote?.calendarEvents;
            const summary = quote?.summaryDetail;

            return {
              symbol: stock.symbol,
              name: stock.name,
              price: stock.livePrice,
              divYield: summary?.dividendYield
                ? (summary.dividendYield * 100).toFixed(2)
                : stock.divYield,
              annualDiv: summary?.dividendRate || null,
              exDivDate: calendar?.exDividendDate
                ? new Date(calendar.exDividendDate).toISOString().split("T")[0]
                : null,
              divDate: calendar?.dividendDate
                ? new Date(calendar.dividendDate).toISOString().split("T")[0]
                : null,
              payoutRatio: summary?.payoutRatio
                ? (summary.payoutRatio * 100).toFixed(1)
                : null,
              sector: stock.sector,
            };
          } catch (_) {
            // Fallback: use what we have from livePrices
            return {
              symbol: stock.symbol,
              name: stock.name,
              price: stock.livePrice,
              divYield: stock.divYield,
              annualDiv: null,
              exDivDate: null,
              divDate: null,
              payoutRatio: null,
              sector: stock.sector,
            };
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) dividends.push(r.value);
      }

      // Rate limit protection
      if (i + 3 < withDivs.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Sort: stocks with upcoming ex-div dates first, then by yield
    dividends.sort((a, b) => {
      if (a.exDivDate && !b.exDivDate) return -1;
      if (!a.exDivDate && b.exDivDate) return 1;
      if (a.exDivDate && b.exDivDate) return a.exDivDate.localeCompare(b.exDivDate);
      return parseFloat(b.divYield || 0) - parseFloat(a.divYield || 0);
    });

    res.json({ dividends });
  } catch (e) {
    console.error("[dividends] Error:", e.message);
    res.status(500).json({ error: "Failed to load dividend data" });
  }
});

// ── Paper Trading Leaderboard ───────────────────────────────────────────────

let prisma;
try {
  prisma = require("../config/database").prisma;
} catch (_) {
  prisma = null;
}
const USE_DB = !!(process.env.DATABASE_URL && prisma);

router.get("/api/leaderboard", async (req, res) => {
  if (!USE_DB) {
    return res.json({ leaderboard: [], message: "Leaderboard requires database" });
  }

  try {
    // Get all users with paper trading positions and wallets
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        wallets: {
          where: { currency: "JMD" },
          select: { balance: true, heldBalance: true },
        },
        portfolioPositions: {
          where: { isPaper: true },
          select: { symbol: true, shares: true, avgCost: true },
        },
      },
    });

    const leaderboard = users
      .map((user) => {
        // Cash balance
        const wallet = user.wallets[0];
        const cashBalance = wallet
          ? parseFloat(wallet.balance) + parseFloat(wallet.heldBalance)
          : 0;

        // Portfolio value at current prices
        let portfolioValue = 0;
        let totalInvested = 0;
        for (const pos of user.portfolioPositions) {
          const shares = parseFloat(pos.shares);
          const avgCost = parseFloat(pos.avgCost);
          const stock = marketService.livePrices.find(
            (s) => s.symbol === pos.symbol
          );
          const currentPrice = stock?.livePrice || avgCost;
          portfolioValue += shares * currentPrice;
          totalInvested += shares * avgCost;
        }

        const totalValue = cashBalance + portfolioValue;
        const startingBalance = 1000000; // J$1M paper trading start
        const totalReturn = ((totalValue - startingBalance) / startingBalance) * 100;

        return {
          // Anonymize: show first name + last initial
          name: user.name
            ? user.name.split(" ")[0] +
              (user.name.split(" ")[1]
                ? " " + user.name.split(" ")[1][0] + "."
                : "")
            : "Trader",
          joinedAt: user.createdAt,
          cashBalance: +cashBalance.toFixed(2),
          portfolioValue: +portfolioValue.toFixed(2),
          totalValue: +totalValue.toFixed(2),
          totalReturn: +totalReturn.toFixed(2),
          positionCount: user.portfolioPositions.length,
        };
      })
      .filter((u) => u.totalValue !== 0) // Only show active traders
      .sort((a, b) => b.totalReturn - a.totalReturn)
      .slice(0, 50); // Top 50

    // Add rank
    leaderboard.forEach((entry, i) => {
      entry.rank = i + 1;
    });

    res.json({ leaderboard });
  } catch (e) {
    console.error("[leaderboard] Error:", e.message);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Technical Analysis Indicators ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

let ti;
try {
  ti = require("technicalindicators");
} catch (_) {
  console.warn("technicalindicators not installed");
}

router.get("/api/technicals/:symbol", async (req, res) => {
  const sym = req.params.symbol.toUpperCase();

  // First try Yahoo Finance candles for OHLCV data
  let candles = [];
  let fundamentals = null;

  const cache = marketService.researchCache;
  if (cache[sym] && Date.now() - cache[sym].ts < marketService.RESEARCH_TTL) {
    candles = cache[sym].data.candles || [];
    fundamentals = cache[sym].data.fundamentals || null;
  } else if (marketService.yahooFinance) {
    const yfSym = marketService.getYahooSymbol(sym);
    try {
      const period1 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const [quoteResult, histResult] = await Promise.allSettled([
        marketService.yahooFinance.quoteSummary(yfSym, {
          modules: ["summaryDetail", "financialData", "defaultKeyStatistics"],
          validateResult: false,
        }),
        marketService.yahooFinance.historical(yfSym, { period1, interval: "1d" }),
      ]);

      const q = quoteResult.status === "fulfilled" ? quoteResult.value : null;
      const rawHist = histResult.status === "fulfilled" ? histResult.value : [];

      candles = rawHist
        .filter((b) => b.open > 0 && b.close > 0 && b.high > 0 && b.low > 0)
        .map((b) => ({
          time: Math.floor(new Date(b.date).getTime() / 1000),
          open: +b.open.toFixed(2),
          high: +b.high.toFixed(2),
          low: +b.low.toFixed(2),
          close: +b.close.toFixed(2),
          volume: b.volume || 0,
        }));

      if (q) {
        fundamentals = {
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
          recommendation: q.financialData?.recommendationKey?.toUpperCase() ?? null,
          revenueGrowth: q.financialData?.revenueGrowth ?? null,
          earningsGrowth: q.financialData?.earningsGrowth ?? null,
          beta: q.defaultKeyStatistics?.beta ?? null,
        };
      }
    } catch (_) {}
  }

  // Fallback: use in-memory price history as simple close prices
  if (candles.length === 0) {
    const hist = marketService.priceHistory[sym];
    if (!hist || hist.length < 5) {
      // Check if the stock exists in livePrices at all
      const knownStock = marketService.livePrices?.find((s) => s.symbol === sym);
      if (knownStock) {
        return res.status(404).json({
          error: `${sym} is listed but has insufficient historical data for technical analysis. Current price: $${knownStock.livePrice || knownStock.price || "N/A"}`,
          symbol: sym,
          name: knownStock.name || sym,
          price: knownStock.livePrice || knownStock.price || null,
        });
      }
      return res.status(404).json({
        error: `No data found for symbol "${sym}". It may not be a valid JSE stock, or data is temporarily unavailable. Try Yahoo Finance symbol: ${sym}.JM`,
        symbol: sym,
      });
    }
    const now = Math.floor(Date.now() / 1000);
    candles = hist.map((p, i) => ({
      time: now - (hist.length - i) * 86400,
      open: p,
      high: p * 1.005,
      low: p * 0.995,
      close: p,
      volume: 0,
    }));
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  // Compute indicators using technicalindicators library
  const indicators = {};

  if (ti) {
    // Moving Averages
    indicators.sma20 = ti.SMA.calculate({ period: 20, values: closes });
    indicators.sma50 = ti.SMA.calculate({ period: 50, values: closes });
    indicators.sma200 = ti.SMA.calculate({ period: 200, values: closes });
    indicators.ema12 = ti.EMA.calculate({ period: 12, values: closes });
    indicators.ema26 = ti.EMA.calculate({ period: 26, values: closes });
    indicators.ema50 = ti.EMA.calculate({ period: 50, values: closes });

    // RSI
    indicators.rsi = ti.RSI.calculate({ period: 14, values: closes });

    // MACD
    indicators.macd = ti.MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    // Bollinger Bands
    indicators.bollinger = ti.BollingerBands.calculate({
      period: 20,
      values: closes,
      stdDev: 2,
    });

    // Stochastic
    if (highs.length >= 14) {
      indicators.stochastic = ti.Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
        signalPeriod: 3,
      });
    }

    // ADX
    if (candles.length >= 14) {
      indicators.adx = ti.ADX.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      });
    }

    // ATR
    if (candles.length >= 14) {
      indicators.atr = ti.ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      });
    }

    // OBV (On Balance Volume)
    if (volumes.some((v) => v > 0)) {
      indicators.obv = ti.OBV.calculate({ close: closes, volume: volumes });
    }

    // VWAP
    if (volumes.some((v) => v > 0)) {
      indicators.vwap = ti.VWAP.calculate({
        high: highs,
        low: lows,
        close: closes,
        volume: volumes,
      });
    }

    // Williams %R
    if (candles.length >= 14) {
      indicators.williamsR = ti.WilliamsR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      });
    }

    // CCI
    if (candles.length >= 20) {
      indicators.cci = ti.CCI.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 20,
      });
    }

    // Ichimoku Cloud
    if (candles.length >= 52) {
      indicators.ichimoku = ti.IchimokuCloud.calculate({
        high: highs,
        low: lows,
        conversionPeriod: 9,
        basePeriod: 26,
        spanPeriod: 52,
        displacement: 26,
      });
    }

    // Fibonacci Retracement from 90-day high/low
    const recent = candles.slice(-90);
    const recentHighs = recent.map((c) => c.high);
    const recentLows = recent.map((c) => c.low);
    const fibHigh = Math.max(...recentHighs);
    const fibLow = Math.min(...recentLows);
    const fibDiff = fibHigh - fibLow;
    indicators.fibonacci = {
      high: +fibHigh.toFixed(2),
      low: +fibLow.toFixed(2),
      levels: {
        0: +fibHigh.toFixed(2),
        0.236: +(fibHigh - fibDiff * 0.236).toFixed(2),
        0.382: +(fibHigh - fibDiff * 0.382).toFixed(2),
        0.5: +(fibHigh - fibDiff * 0.5).toFixed(2),
        0.618: +(fibHigh - fibDiff * 0.618).toFixed(2),
        0.786: +(fibHigh - fibDiff * 0.786).toFixed(2),
        1: +fibLow.toFixed(2),
      },
    };

    // Candlestick pattern recognition
    if (candles.length >= 5) {
      const last5 = candles.slice(-5);
      const patternInput = {
        open: last5.map((c) => c.open),
        high: last5.map((c) => c.high),
        low: last5.map((c) => c.low),
        close: last5.map((c) => c.close),
      };
      const patterns = [];
      const patternChecks = [
        ["doji", ti.doji],
        ["bullishEngulfing", ti.bullishengulfingpattern],
        ["bearishEngulfing", ti.bearishengulfingpattern],
        ["hammer", ti.hammerpattern],
        ["hangingMan", ti.hangingman],
        ["shootingStar", ti.shootingstar],
        ["morningstar", ti.morningstar],
        ["eveningstar", ti.eveningstar],
        ["threeWhiteSoldiers", ti.threewhitesoldiers],
        ["threeBlackCrows", ti.threeblackcrows],
        ["bullishHarami", ti.bullishharami],
        ["bearishHarami", ti.bearishharami],
        ["darkCloudCover", ti.darkcloudcover],
        ["piercingLine", ti.piercingline],
        ["tweezertop", ti.tweezertop],
        ["tweezerbottom", ti.tweezerbottom],
      ];
      for (const [name, fn] of patternChecks) {
        try {
          if (fn && fn(patternInput)) patterns.push(name);
        } catch (_) {}
      }
      indicators.patterns = patterns;
    }
  }

  // Generate buy/sell signal summary
  const signals = generateSignalSummary(closes, indicators);

  // Stock info
  const stock = marketService.livePrices.find((s) => s.symbol === sym);

  res.json({
    symbol: sym,
    name: stock?.name || sym,
    price: stock?.livePrice || closes[closes.length - 1],
    change: stock?.liveChange || 0,
    volume: stock?.volume || 0,
    sector: stock?.sector || null,
    marketCap: stock?.marketCap || null,
    candles,
    indicators,
    signals,
    fundamentals,
  });
});

/**
 * Generate a composite buy/sell/hold signal from all indicators
 */
function generateSignalSummary(closes, ind) {
  const signals = [];
  const price = closes[closes.length - 1];

  // --- Moving Average Signals ---
  if (ind.sma20?.length) {
    const sma20 = ind.sma20[ind.sma20.length - 1];
    signals.push({ name: "SMA 20", signal: price > sma20 ? "BUY" : "SELL", value: +sma20.toFixed(2) });
  }
  if (ind.sma50?.length) {
    const sma50 = ind.sma50[ind.sma50.length - 1];
    signals.push({ name: "SMA 50", signal: price > sma50 ? "BUY" : "SELL", value: +sma50.toFixed(2) });
  }
  if (ind.sma200?.length) {
    const sma200 = ind.sma200[ind.sma200.length - 1];
    signals.push({ name: "SMA 200", signal: price > sma200 ? "BUY" : "SELL", value: +sma200.toFixed(2) });
  }
  if (ind.ema12?.length) {
    const ema12 = ind.ema12[ind.ema12.length - 1];
    signals.push({ name: "EMA 12", signal: price > ema12 ? "BUY" : "SELL", value: +ema12.toFixed(2) });
  }
  if (ind.ema26?.length) {
    const ema26 = ind.ema26[ind.ema26.length - 1];
    signals.push({ name: "EMA 26", signal: price > ema26 ? "BUY" : "SELL", value: +ema26.toFixed(2) });
  }

  // --- RSI ---
  if (ind.rsi?.length) {
    const rsi = ind.rsi[ind.rsi.length - 1];
    let sig = "NEUTRAL";
    if (rsi < 30) sig = "BUY";
    else if (rsi > 70) sig = "SELL";
    signals.push({ name: "RSI (14)", signal: sig, value: +rsi.toFixed(1) });
  }

  // --- MACD ---
  if (ind.macd?.length) {
    const m = ind.macd[ind.macd.length - 1];
    if (m.MACD != null && m.signal != null) {
      signals.push({ name: "MACD", signal: m.MACD > m.signal ? "BUY" : "SELL", value: +m.histogram?.toFixed(4) || 0 });
    }
  }

  // --- Stochastic ---
  if (ind.stochastic?.length) {
    const s = ind.stochastic[ind.stochastic.length - 1];
    let sig = "NEUTRAL";
    if (s.k < 20) sig = "BUY";
    else if (s.k > 80) sig = "SELL";
    signals.push({ name: "Stochastic", signal: sig, value: +s.k?.toFixed(1) || 0 });
  }

  // --- ADX ---
  if (ind.adx?.length) {
    const a = ind.adx[ind.adx.length - 1];
    let sig = "NEUTRAL";
    if (a.pdi > a.mdi && a.adx > 25) sig = "BUY";
    else if (a.mdi > a.pdi && a.adx > 25) sig = "SELL";
    signals.push({ name: "ADX", signal: sig, value: +a.adx?.toFixed(1) || 0 });
  }

  // --- Bollinger ---
  if (ind.bollinger?.length) {
    const b = ind.bollinger[ind.bollinger.length - 1];
    let sig = "NEUTRAL";
    if (price <= b.lower) sig = "BUY";
    else if (price >= b.upper) sig = "SELL";
    signals.push({ name: "Bollinger Bands", signal: sig, value: `${(+b.lower).toFixed(2)} - ${(+b.upper).toFixed(2)}` });
  }

  // --- Williams %R ---
  if (ind.williamsR?.length) {
    const w = ind.williamsR[ind.williamsR.length - 1];
    let sig = "NEUTRAL";
    if (w < -80) sig = "BUY";
    else if (w > -20) sig = "SELL";
    signals.push({ name: "Williams %R", signal: sig, value: +w.toFixed(1) });
  }

  // --- CCI ---
  if (ind.cci?.length) {
    const c = ind.cci[ind.cci.length - 1];
    let sig = "NEUTRAL";
    if (c < -100) sig = "BUY";
    else if (c > 100) sig = "SELL";
    signals.push({ name: "CCI (20)", signal: sig, value: +c.toFixed(1) });
  }

  // Tally
  const buys = signals.filter((s) => s.signal === "BUY").length;
  const sells = signals.filter((s) => s.signal === "SELL").length;
  const neutrals = signals.filter((s) => s.signal === "NEUTRAL").length;
  const total = signals.length || 1;

  let overall = "NEUTRAL";
  if (buys / total >= 0.6) overall = "STRONG BUY";
  else if (buys > sells) overall = "BUY";
  else if (sells / total >= 0.6) overall = "STRONG SELL";
  else if (sells > buys) overall = "SELL";

  return { signals, buys, sells, neutrals, overall };
}

module.exports = router;
