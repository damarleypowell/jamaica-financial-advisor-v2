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
 * Scrape ALL stock prices from JSE data sources
 * Primary: jseinvestor.com (reliable, no Cloudflare)
 * Secondary: jamstockex.com (official JSE, has company names, but intermittent 403s)
 * Fallback: Yahoo Finance for any missing stocks
 * Returns array of { symbol, name, price, dollarChange, pctChange, volume }
 */
async function scrapeAllStocks() {
  const now = Date.now();
  if (allStocksCache && now - lastAllStocksFetch < ALL_STOCKS_TTL) {
    return allStocksCache;
  }

  console.log("📊 Scraping real JSE stock prices...");
  const seen = new Set(); // dedup by symbol
  const nameMap = {}; // symbol → company name (populated by jamstockex)

  // ── Fetch both sources in parallel for speed + resilience ──
  const [jseinvestorResult, jamstockexResult] = await Promise.allSettled([
    scrapeJSEInvestor(),
    scrapeJamStockEx(),
  ]);

  // Extract results
  const jseinvestorStocks = jseinvestorResult.status === "fulfilled" ? jseinvestorResult.value.stocks : [];
  const jamstockexStocks = jamstockexResult.status === "fulfilled" ? jamstockexResult.value.stocks : [];
  const jamstockexNames = jamstockexResult.status === "fulfilled" ? jamstockexResult.value.nameMap : {};

  if (jseinvestorResult.status === "rejected") {
    console.error("jseinvestor.com scrape error:", jseinvestorResult.reason?.message?.slice(0, 100));
  }
  if (jamstockexResult.status === "rejected") {
    console.error("jamstockex.com scrape error:", jamstockexResult.reason?.message?.slice(0, 100));
  }

  // Merge: prefer jamstockex (has company names), then supplement with jseinvestor
  let stocks = [];

  for (const s of jamstockexStocks) {
    if (seen.has(s.symbol)) continue;
    seen.add(s.symbol);
    stocks.push(s);
  }
  console.log(`📊 ${stocks.length} stocks from jamstockex.com`);

  for (const s of jseinvestorStocks) {
    if (seen.has(s.symbol)) continue;
    seen.add(s.symbol);
    // Enrich with company name from jamstockex if available
    if (jamstockexNames[s.symbol] && s.name === s.symbol) {
      s.name = jamstockexNames[s.symbol];
    }
    stocks.push(s);
  }
  console.log(`📊 ${stocks.length} total stocks after jseinvestor.com merge`);

  if (stocks.length > 0) {
    allStocksCache = stocks;
    lastAllStocksFetch = now;
  }

  // Fallback: if scraping failed or returned too few stocks, supplement with Yahoo Finance
  if (stocks.length < 15) {
    console.log(`📊 Only ${stocks.length} stocks from scrapers — supplementing with Yahoo Finance...`);
    try {
      const yf = require("yahoo-finance2").default;
      const existingSymbols = new Set(stocks.map(s => s.symbol));
      const allEntries = Object.entries(YAHOO_MAP).filter(([jse]) => !existingSymbols.has(jse));
      const reverseMap = {};
      Object.entries(YAHOO_MAP).forEach(([jse, yh]) => { reverseMap[yh] = jse; });

      // Batch 5 at a time with 400ms delay to avoid rate limiting
      for (let i = 0; i < allEntries.length; i += 5) {
        const batch = allEntries.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(([, yh]) => yf.quote(yh).catch(() => null))
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

        // Delay between batches
        if (i + 5 < allEntries.length) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (stocks.length > 0) {
        allStocksCache = stocks;
        lastAllStocksFetch = now;
        console.log(`📊 Total: ${stocks.length} JSE stocks (scrapers + Yahoo Finance)`);
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
 * Scrape jseinvestor.com — primary source (reliable, no Cloudflare)
 * Table: #dataTable-alerts with 6 cols: Symbol | Price($) | ($)+/- | (%)+/- | Vol | hidden
 */
async function scrapeJSEInvestor() {
  const { data } = await axios.get("https://www.jseinvestor.com/", {
    timeout: 15000,
    headers: HEADERS,
  });
  const $ = cheerio.load(data);
  const stocks = [];

  // Target the specific data table by ID
  const table = $("#dataTable-alerts");
  const rows = table.length ? table.find("tbody tr") : $("table tr");

  rows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return;

    const symbol = $(cells[0]).text().trim().toUpperCase();
    if (!symbol || /^symbol$/i.test(symbol)) return;

    // jseinvestor layout: Symbol(0), Price(1), Change$(2), Change%(3), Volume(4), hidden(5)
    const priceStr = $(cells[1]).text().trim().replace(/[,$\s]/g, "");
    const dollarChangeStr = $(cells[2]).text().trim().replace(/[+$\s]/g, "");
    const pctChangeStr = $(cells[3]).text().trim().replace(/[+%\s]/g, "");
    const volumeStr = $(cells[4]).text().trim().replace(/[,\s]/g, "");

    const link = $(cells[0]).find("a");
    const detailUrl = link.attr("href") || "";
    const currency = detailUrl.match(/currency=(\w+)/)?.[1] || "JMD";

    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) return;

    let dollarChange = parseFloat(dollarChangeStr) || 0;
    let pctChange = parseFloat(pctChangeStr) || 0;
    if (pctChange === 0 && dollarChange !== 0 && price > 0) {
      const prevPrice = price - dollarChange;
      if (prevPrice > 0) pctChange = +((dollarChange / prevPrice) * 100).toFixed(2);
    }

    stocks.push({
      symbol,
      name: symbol, // jseinvestor doesn't show company names in the table
      price,
      dollarChange,
      pctChange,
      volume: parseInt(volumeStr) || 0,
      currency: currency || "JMD",
      dataSource: "jseinvestor",
    });
  });

  console.log(`📊 Scraped ${stocks.length} stocks from jseinvestor.com`);
  return { stocks };
}

/**
 * Scrape jamstockex.com — secondary source (official JSE, has company names)
 * Uses Tailwind CSS tables with 6 cols: Symbol | Security | Volume | Closing Price ($) | Price Change ($) | Change (%)
 * Has duplicate mobile/desktop tables — dedup handled by caller
 */
async function scrapeJamStockEx() {
  const { data } = await axios.get("https://www.jamstockex.com/trading/trade-summary/", {
    timeout: 15000,
    headers: HEADERS,
  });
  const $ = cheerio.load(data);
  const stocks = [];
  const nameMap = {}; // symbol → cleaned company name
  const seen = new Set();

  // jamstockex has duplicate tables (mobile + desktop per section) — dedup here
  $("table").each((_, table) => {
    $(table).find("tbody tr, tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 4) return; // need at least symbol, name, volume, price

      const symbol = $(cells[0]).text().trim().toUpperCase();
      if (!symbol || /^symbol$/i.test(symbol) || seen.has(symbol)) return;

      // Detect column layout: 6 cols = full (with change), 4 cols = no-change
      let price, dollarChange, pctChange, volume, name;

      if (cells.length >= 6) {
        // Full layout: Symbol(0), Security(1), Volume(2), Price(3), Change$(4), Change%(5)
        name = $(cells[1]).text().trim();
        volume = $(cells[2]).text().trim().replace(/[,\s]/g, "");
        price = $(cells[3]).text().trim().replace(/[,$\s]/g, "");
        dollarChange = $(cells[4]).text().trim().replace(/[+$\s]/g, "");
        pctChange = $(cells[5]).text().trim().replace(/[+%\s]/g, "");
      } else {
        // Short layout: Symbol(0), Security(1), Volume(2), Price(3)
        name = $(cells[1]).text().trim();
        volume = $(cells[2]).text().trim().replace(/[,\s]/g, "");
        price = $(cells[3]).text().trim().replace(/[,$\s]/g, "");
        dollarChange = "0";
        pctChange = "0";
      }

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) return;

      // Detect USD market from section heading
      const isUSD = $(row).closest("table").prevAll("h2, h3, h4").first().text().toLowerCase().includes("usd");

      // Clean company name
      const cleanName = cleanCompanyName(name || symbol);

      // Store in nameMap for enriching jseinvestor data
      if (name && name !== symbol) {
        nameMap[symbol] = cleanName;
      }

      seen.add(symbol);
      stocks.push({
        symbol,
        name: cleanName || symbol,
        price: priceNum,
        dollarChange: parseFloat(dollarChange) || 0,
        pctChange: parseFloat(pctChange) || 0,
        volume: parseInt(volume) || 0,
        currency: isUSD ? "USD" : "JMD",
        dataSource: "jamstockex",
      });
    });
  });

  console.log(`📊 Scraped ${stocks.length} stocks from jamstockex.com`);
  return { stocks, nameMap };
}

/**
 * Clean company name: remove "LIMITED"/"LTD", title-case
 */
function cleanCompanyName(name) {
  return (name || "")
    .replace(/\bLIMITED\b/gi, "").replace(/\bLTD\.?\b/gi, "")
    .replace(/\s+/g, " ").replace(/\.$/, "").trim()
    .split(" ").map(w => {
      if (w.length <= 3 && w === w.toUpperCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(" ");
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
  // Main Market
  "NCBFG": "NCBFG.JM", "GK": "GK.JM", "JMMBGL": "JMMBGL.JM",
  "SJ": "SJ.JM", "SVL": "SVL.JM", "WISYNCO": "WISYNCO.JM",
  "SEP": "SEP.JM", "SGJAM": "SGFG.JM", "SFC": "SFC.JM",
  "CCC": "CCC.JM", "AFS": "AFS.JM", "BIL": "BIL.JM",
  "JBGL": "JBGL.JM", "PROVEN": "PROVEN.JM", "CPJ": "CPJ.JM",
  "KEX": "KEX.JM", "LASD": "LASD.JM", "LASC": "LASC.JM",
  "ECL": "ECL.JM", "MPC": "MPC.JM", "SCI": "SCI.JM",
  "GHL": "GHL.JM", "BPOW": "BPOW.JM", "PJX": "PJX.JM",
  "JPS": "JPS.JM", "CARG": "CARG.JM", "RCORP": "RCORP.JM",
  // Junior Market
  "MEEG": "MEEG.JM", "ICREATE": "ICREATE.JM", "PBS": "PBS.JM",
  "FOSRICH": "FOSRICH.JM", "LUMBER": "LUMBER.JM", "DERRIMON": "DTL.JM",
  "INDIES": "INDIES.JM", "MCGE": "MCGE.JM", "BRG": "BRG.JM",
  "CAR": "CAR.JM", "MJE": "MJE.JM", "PULS": "PULS.JM",
  "GENAC": "GENAC.JM", "EPLY": "EPLY.JM", "MAILPAC": "MAILPAC.JM",
  "FTNA": "FTNA.JM", "KREMI": "KREMI.JM", "ISP": "ISP.JM",
  "EXPRESS": "EXPRESS.JM", "HONBUN": "HONBUN.JM", "CATL": "CATL.JM",
  "JAMT": "JAMT.JM", "KLE": "KLE.JM", "BEET": "BEET.JM",
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
