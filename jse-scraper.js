/**
 * JSE Real Stock Data Scraper
 * Primary source: jseinvestor.com (real-time JSE data, no auth required)
 * Secondary: Yahoo Finance for fundamentals
 * All data is REAL — no fake/hardcoded prices
 */

const axios = require("axios");
const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

// ── Cache ──────────────────────────────────────────────────────────────────
let allStocksCache = null;
let lastAllStocksFetch = 0;
const ALL_STOCKS_TTL = 30 * 1000; // 30 seconds — real-time feel

let detailCache = {};
const DETAIL_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Scrape ALL stock prices from jseinvestor.com main page
 * Returns array of { symbol, name, price, dollarChange, pctChange, volume }
 */
async function scrapeAllStocks() {
  const now = Date.now();
  if (allStocksCache && now - lastAllStocksFetch < ALL_STOCKS_TTL) {
    return allStocksCache;
  }

  console.log("📊 Scraping real JSE stock prices from jseinvestor.com...");
  const stocks = [];

  // Try jamstockex.com first (official JSE), then jseinvestor.com
  try {
    const { data } = await axios.get("https://www.jamstockex.com/trading/trade-summary/", {
      timeout: 15000,
      headers: HEADERS,
    }).catch(() => axios.get("https://www.jseinvestor.com/", {
      timeout: 15000,
      headers: HEADERS,
    }));
    const $ = cheerio.load(data);

    // First pass: build a name map from the full links like "BIL - BARITA INVESTMENTS LIMITED"
    const nameMap = {};
    $('a[href*="stock-details"]').each((_, el) => {
      const text = $(el).text().trim();
      const match = text.match(/^([A-Z0-9]+)\s*-\s*(.+)$/i);
      if (match) {
        const sym = match[1].trim().toUpperCase();
        const fullName = match[2].trim()
          .replace(/\bLIMITED\b/gi, "").replace(/\bLTD\b/gi, "")
          .replace(/\s+/g, " ").replace(/\.$/, "").trim();
        // Title case, but keep acronyms like "NCB", "AMG" uppercase
        nameMap[sym] = fullName.split(" ").map(w => {
          if (w.length <= 3 && w === w.toUpperCase()) return w; // acronym
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        }).join(" ");
      }
    });

    // Second pass: scrape the price table
    $("table tr").each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length < 5) return;

      const symbol = $(cells[0]).text().trim().toUpperCase();
      if (!symbol || /^symbol$/i.test(symbol)) return;

      const priceStr = $(cells[1]).text().trim().replace(/[,$\s]/g, "");
      const dollarChangeStr = $(cells[2]).text().trim().replace(/[+$\s]/g, "");
      const pctChangeStr = $(cells[3]).text().trim().replace(/[+%\s]/g, "");
      const volumeStr = $(cells[4]).text().trim().replace(/[,\s]/g, "");

      const link = $(cells[0]).find("a");
      const detailUrl = link.attr("href") || "";
      const currency = detailUrl.match(/currency=(\w+)/)?.[1] || "JMD";

      const price = parseFloat(priceStr);
      if (isNaN(price) || price <= 0) return;

      const dollarChange = parseFloat(dollarChangeStr) || 0;
      let pctChange = parseFloat(pctChangeStr) || 0;
      // jseinvestor.com % column is often 0 — calculate from dollar change
      if (pctChange === 0 && dollarChange !== 0 && price > 0) {
        const prevPrice = price - dollarChange;
        if (prevPrice > 0) pctChange = +((dollarChange / prevPrice) * 100).toFixed(2);
      }

      stocks.push({
        symbol,
        name: nameMap[symbol] || symbol,
        price,
        dollarChange,
        pctChange,
        volume: parseInt(volumeStr) || 0,
        currency,
        dataSource: "jseinvestor",
      });
    });

    if (stocks.length > 0) {
      allStocksCache = stocks;
      lastAllStocksFetch = now;
      console.log(`📊 Scraped ${stocks.length} real JSE stocks from jseinvestor.com`);
    }
  } catch (e) {
    console.error("jseinvestor.com scrape error:", e.message?.slice(0, 100));
  }

  // Fallback: if scraping failed, try Yahoo Finance for known JSE symbols
  if (stocks.length === 0) {
    console.log("📊 Falling back to Yahoo Finance for JSE data...");
    try {
      const yf = require("yahoo-finance2").default;
      const symbols = Object.values(YAHOO_MAP);
      const reverseMap = {};
      Object.entries(YAHOO_MAP).forEach(([jse, yh]) => { reverseMap[yh] = jse; });

      const results = await Promise.allSettled(
        symbols.map(s => yf.quote(s).catch(() => null))
      );

      results.forEach((r) => {
        if (r.status !== "fulfilled" || !r.value) return;
        const q = r.value;
        if (!q.regularMarketPrice) return;
        const yahooSym = q.symbol;
        const jseSym = reverseMap[yahooSym] || yahooSym.replace(".JM", "");
        stocks.push({
          symbol: jseSym,
          name: (q.longName || q.shortName || jseSym)
            .replace(/\bLimited\b/gi, "").replace(/\bLtd\b/gi, "").trim(),
          price: q.regularMarketPrice,
          dollarChange: q.regularMarketChange || 0,
          pctChange: +(q.regularMarketChangePercent || 0).toFixed(2),
          volume: q.regularMarketVolume || 0,
          currency: q.currency === "USD" ? "USD" : "JMD",
          dataSource: "yahoo-finance",
        });
      });

      if (stocks.length > 0) {
        allStocksCache = stocks;
        lastAllStocksFetch = now;
        console.log(`📊 Loaded ${stocks.length} JSE stocks via Yahoo Finance fallback`);
      }
    } catch (e2) {
      console.error("Yahoo Finance fallback error:", e2.message?.slice(0, 100));
    }
  }

  // Final fallback: return cached data even if stale
  if (stocks.length === 0 && allStocksCache) {
    console.log("📊 Using stale cached data");
    return allStocksCache;
  }

  return stocks;
}

/**
 * Scrape detailed stock info from jseinvestor.com stock detail page
 * Returns { bid, ask, dayLow, dayHigh, low52, high52, volume, trades, sector, tradeValue, issuedShares, marketCap }
 */
async function scrapeStockDetail(symbol) {
  const now = Date.now();
  const cached = detailCache[symbol];
  if (cached && now - cached.ts < DETAIL_TTL) {
    return cached.data;
  }

  try {
    const url = `https://www.jseinvestor.com/public-stock-details.php?ids=${encodeURIComponent(symbol)}&currency=JMD`;
    const { data } = await axios.get(url, { timeout: 15000, headers: HEADERS });
    const $ = cheerio.load(data);

    const detail = { symbol, dataSource: "jseinvestor-detail" };

    // Extract all table cells as key-value pairs
    $("table tr").each((_, row) => {
      const cells = $(row).find("td, th");
      for (let i = 0; i < cells.length - 1; i += 2) {
        const label = $(cells[i]).text().trim().toLowerCase().replace(/\s+/g, " ");
        const value = $(cells[i + 1]).text().trim();

        if (label.includes("bid")) detail.bid = parseFloat(value.replace(/[$,]/g, "")) || null;
        if (label.includes("ask")) detail.ask = parseFloat(value.replace(/[$,]/g, "")) || null;
        if (label.includes("days low") || label.includes("day low")) detail.dayLow = parseFloat(value.replace(/[$,]/g, "")) || null;
        if (label.includes("days high") || label.includes("day high")) detail.dayHigh = parseFloat(value.replace(/[$,]/g, "")) || null;
        if (label.includes("52 week low") || label.includes("52 w low")) detail.low52 = parseFloat(value.replace(/[$,]/g, "")) || null;
        if (label.includes("52 week high") || label.includes("52 w high")) detail.high52 = parseFloat(value.replace(/[$,]/g, "")) || null;
        if (label.includes("volume")) detail.volumeDetail = parseVolume(value);
        if (label.includes("trade") && label.includes("val")) detail.tradeValue = value;
        if (label.includes("sector")) detail.sector = value;
        if (label.includes("issued") || label.includes("iss.")) detail.issuedShares = parseVolume(value);
        if (label.includes("market cap") || label.includes("mkt.")) detail.marketCap = value;
        if (label.includes("# of trade") || label.includes("trades")) detail.trades = parseInt(value.replace(/[,\s]/g, "")) || null;
      }
    });

    // Get the current price and change from the page header
    const priceText = $("table tr:first-child").text();
    const priceMatch = priceText.match(/\$(\d+[\d,.]*)/);
    if (priceMatch) detail.currentPrice = parseFloat(priceMatch[1].replace(/,/g, ""));

    const changeMatch = priceText.match(/([+-]?\d+\.?\d*)\s*\(/);
    if (changeMatch) detail.dollarChange = parseFloat(changeMatch[1]);

    const pctMatch = priceText.match(/\(([+-]?\d+\.?\d*)%\)/);
    if (pctMatch) detail.pctChange = parseFloat(pctMatch[1]);

    // Get the date
    const dateMatch = priceText.match(/As at\s+(\w+ \d+ \d+)/i);
    if (dateMatch) detail.asAtDate = dateMatch[1];

    detailCache[symbol] = { data: detail, ts: now };
    return detail;
  } catch (e) {
    console.warn(`Detail scrape error [${symbol}]:`, e.message?.slice(0, 80));
    return null;
  }
}

function parseVolume(str) {
  if (!str) return null;
  str = str.replace(/[$,\s]/g, "").toUpperCase();
  if (str.endsWith("K")) return parseFloat(str) * 1000;
  if (str.endsWith("M")) return parseFloat(str) * 1000000;
  if (str.endsWith("B")) return parseFloat(str) * 1000000000;
  return parseFloat(str) || null;
}

/**
 * Fetch Yahoo Finance quote for a single stock
 */
async function fetchYahooQuote(yahooFinance, yahooSymbol) {
  if (!yahooFinance) return null;
  try {
    const quote = await yahooFinance.quote(yahooSymbol);
    if (quote && quote.regularMarketPrice) {
      return {
        price: quote.regularMarketPrice,
        change: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        marketCap: quote.marketCap || null,
        pe: quote.trailingPE || quote.forwardPE || null,
        divYield: quote.dividendYield ? +(quote.dividendYield * 100).toFixed(2) : null,
        high52: quote.fiftyTwoWeekHigh || null,
        low52: quote.fiftyTwoWeekLow || null,
        eps: quote.epsTrailingTwelveMonths || null,
        dayHigh: quote.regularMarketDayHigh || null,
        dayLow: quote.regularMarketDayLow || null,
        prevClose: quote.regularMarketPreviousClose || null,
        open: quote.regularMarketOpen || null,
      };
    }
  } catch (_) {}
  return null;
}

/**
 * Fetch detailed research data from Yahoo Finance (historical candles + fundamentals)
 */
async function fetchYahooResearch(yahooFinance, yahooSymbol) {
  if (!yahooFinance) return null;
  try {
    const period1 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const [quoteResult, histResult] = await Promise.allSettled([
      yahooFinance.quoteSummary(yahooSymbol, {
        modules: ["summaryDetail", "financialData", "defaultKeyStatistics"],
        validateResult: false,
      }),
      yahooFinance.historical(yahooSymbol, { period1, interval: "1d" }),
    ]);

    const q = quoteResult.status === "fulfilled" ? quoteResult.value : null;
    const rawHist = histResult.status === "fulfilled" ? histResult.value : [];

    const fundamentals = q ? {
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
    } : null;

    const candles = (rawHist || [])
      .filter(b => b.open > 0 && b.close > 0)
      .map(b => ({
        time: Math.floor(new Date(b.date).getTime() / 1000),
        open: +b.open.toFixed(2), high: +b.high.toFixed(2),
        low: +b.low.toFixed(2), close: +b.close.toFixed(2),
        volume: b.volume || 0,
      }));

    return { fundamentals, candles };
  } catch (_) {}
  return null;
}

function formatMarketCap(n) {
  if (!n) return "N/A";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n}`;
}

// Yahoo symbol mapping for JSE stocks
const YAHOO_MAP = {
  "NCBFG": "NCBFG.JM", "SGJAM": "SGFG.JM", "SFC": "SFC.JM", "GK": "GK.JM",
  "JBGL": "JBGL.JM", "BIL": "BIL.JM", "WISYNCO": "WISYNCO.JM", "SEP": "SEP.JM",
  "CCC": "CCC.JM", "AFS": "AFS.JM", "PROVEN": "PROVEN.JM", "CPJ": "CPJ.JM",
  "MEEG": "MEEG.JM", "KEX": "KEX.JM", "ICREATE": "ICREATE.JM", "PBS": "PBS.JM",
  "FOSRICH": "FOSRICH.JM", "LUMBER": "LUMBER.JM", "ECL": "ECL.JM", "MPC": "MPC.JM",
  "SCI": "SCI.JM", "DERRIMON": "DTL.JM", "LASC": "LASC.JM", "LASD": "LASD.JM",
  "INDIES": "INDIES.JM", "MCGE": "MCGE.JM", "BRG": "BRG.JM", "CAR": "CAR.JM",
  "MJE": "MJE.JM", "PULS": "PULS.JM",
};

function getYahooSymbol(symbol) {
  return YAHOO_MAP[symbol] || `${symbol}.JM`;
}

module.exports = {
  scrapeAllStocks,
  scrapeStockDetail,
  fetchYahooQuote,
  fetchYahooResearch,
  formatMarketCap,
  getYahooSymbol,
  YAHOO_MAP,
};
