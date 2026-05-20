/**
 * Financial News Scraper
 * Caribbean/Jamaica sources + International RSS feeds
 */

const axios = require("axios");
const cheerio = require("cheerio");

let newsCache = [];
let lastFetch = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const SYMBOL_MAP = {
  "NCB": "NCBFG", "Scotia": "SGJAM", "Sagicor": "SFC", "GraceKennedy": "GK",
  "Jamaica Broilers": "JBGL", "Barita": "BIL", "Wisynco": "WISYNCO",
  "Seprod": "SEP", "Caribbean Cement": "CCC", "Access Financial": "AFS",
  "Proven": "PROVEN", "Caribbean Producers": "CPJ", "Main Event": "MEEG",
  "Knutsford": "KEX", "iCreate": "ICREATE", "Productive Business": "PBS",
  "Fosrich": "FOSRICH", "Lumber Depot": "LUMBER", "Express Catering": "ECL",
  "Mailpac": "MPC", "Sygnus": "SCI", "Derrimon": "DERRIMON",
  "Lasco Financial": "LASC", "Lasco Distributors": "LASD",
  "Indies Pharma": "INDIES", "Margaritaville": "MCGE",
  "Berger Paints": "BRG", "Carreras": "CAR", "Mayberry": "MJE", "Pulse": "PULS",
};

const POSITIVE_WORDS = [
  "record","growth","profit","surge","gain","rise","boost","strong","expand",
  "increase","high","dividend","rally","bullish","recovery","improve","upgrade",
  "exceed","positive","outperform","beat","optimism","revenue","milestone","soar",
  "climb","rebound","advance","jump","higher","breakthrough","approval","deal",
];
const NEGATIVE_WORDS = [
  "loss","decline","drop","fall","crash","weak","concern","risk","debt","downturn",
  "bearish","cut","reduce","downgrade","warning","deficit","slump","default","layoff",
  "close","sell-off","plunge","contraction","recession","crisis","sanction","war",
  "lawsuit","penalty","fraud","bankruptcy","below","miss","lower","fears","threat",
];

function detectSymbol(text) {
  const upper = text.toUpperCase();
  for (const [keyword, symbol] of Object.entries(SYMBOL_MAP)) {
    if (upper.includes(keyword.toUpperCase())) return symbol;
  }
  return null;
}

function detectSentiment(text) {
  const lower = (text || "").toLowerCase();
  let score = 0;
  POSITIVE_WORDS.forEach(w => { if (lower.includes(w)) score++; });
  NEGATIVE_WORDS.forEach(w => { if (lower.includes(w)) score--; });
  if (score > 0) return { sentiment: "positive", score };
  if (score < 0) return { sentiment: "negative", score };
  return { sentiment: "neutral", score: 0 };
}

function detectSector(text) {
  if (/bank|financial|ncb|scotia|barita|jmmb|mayberry|sygnus|access financial|proven|lasco financial/i.test(text)) return "Financial";
  if (/insurance|sagicor/i.test(text)) return "Insurance";
  if (/tourism|hotel|margaritaville|resort/i.test(text)) return "Tourism";
  if (/technology|icreate|productive business|tech|ai|nvidia|apple|microsoft|google|chip|semiconductor/i.test(text)) return "Technology";
  if (/food|broilers|seprod|caribbean producers|derrimon|lasco dist/i.test(text)) return "Food";
  if (/cement|construction|lumber|fosrich/i.test(text)) return "Construction";
  if (/beverages|wisynco/i.test(text)) return "Beverages";
  if (/pharma|health|indies|drug|fda/i.test(text)) return "Healthcare";
  if (/transport|knutsford|express catering|mailpac|airline|shipping/i.test(text)) return "Transport";
  if (/gracekennedy|conglomerate/i.test(text)) return "Conglomerate";
  if (/media|pulse|entertainment|main event/i.test(text)) return "Entertainment";
  if (/oil|crude|opec|energy|gas|petroleum|brent|wti/i.test(text)) return "Energy";
  if (/gold|silver|precious metal|bullion|commodity/i.test(text)) return "Commodities";
  if (/bitcoin|crypto|ethereum|blockchain|digital asset/i.test(text)) return "Crypto";
  if (/real estate|property|housing|mortgage|reit/i.test(text)) return "Real Estate";
  if (/boj|central bank|interest rate|inflation|gdp|economy|fiscal|imf|fed|federal reserve|treasury/i.test(text)) return "Economy";
  if (/jse|stock exchange|market|trading|index|nasdaq|s&p|dow/i.test(text)) return "Market";
  return "General";
}

function relTime(pubDate) {
  if (!pubDate) return "Today";
  const diff = Date.now() - new Date(pubDate).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  if (m < 2880) return "Yesterday";
  return `${Math.floor(m / 1440)}d ago`;
}

const HTTP = { timeout: 12000, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } };

// ── Caribbean sources ──────────────────────────────────────────────────────────

async function scrapeGleaner() {
  const articles = [];
  try {
    for (const url of ["https://jamaica-gleaner.com/business", "https://jamaica-gleaner.com/latest"]) {
      try {
        const { data } = await axios.get(url, HTTP);
        const $ = cheerio.load(data);
        const sels = ["article h2 a","article h3 a",".views-row h2 a",".views-row h3 a",".field-content a","h2.node-title a",".teaser h2 a",".teaser h3 a"];
        for (const sel of sels) {
          $(sel).each((_, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr("href");
            if (title && title.length > 20) {
              const { sentiment, score } = detectSentiment(title);
              articles.push({ title, source: "Jamaica Gleaner", url: link?.startsWith("http") ? link : `https://jamaica-gleaner.com${link}`, sector: detectSector(title), symbol: detectSymbol(title), sentiment, sentimentScore: score, region: "caribbean" });
            }
          });
          if (articles.length > 0) break;
        }
      } catch (_) {}
      if (articles.length > 0) break;
    }
  } catch (e) { console.warn("Gleaner:", e.message?.slice(0, 60)); }
  return articles;
}

async function scrapeObserver() {
  const articles = [];
  try {
    for (const url of ["https://www.jamaicaobserver.com/business/","https://www.jamaicaobserver.com/latest-news/"]) {
      try {
        const { data } = await axios.get(url, HTTP);
        const $ = cheerio.load(data);
        const sels = ["article h2 a","article h3 a",".post-title a",".entry-title a",".card-title a",".article-card h2 a"];
        for (const sel of sels) {
          $(sel).each((_, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr("href");
            if (title && title.length > 20) {
              const { sentiment, score } = detectSentiment(title);
              articles.push({ title, source: "Jamaica Observer", url: link?.startsWith("http") ? link : `https://www.jamaicaobserver.com${link}`, sector: detectSector(title), symbol: detectSymbol(title), sentiment, sentimentScore: score, region: "caribbean" });
            }
          });
          if (articles.length > 0) break;
        }
      } catch (_) {}
      if (articles.length > 0) break;
    }
  } catch (e) { console.warn("Observer:", e.message?.slice(0, 60)); }
  return articles;
}

async function scrapeLoopJamaica() {
  const articles = [];
  try {
    const { data } = await axios.get("https://jamaica.loopnews.com/category/business", HTTP);
    const $ = cheerio.load(data);
    $("article h2 a, article h3 a, .card-title a, .loop-card-title a, h2 a, h3 a").each((_, el) => {
      const title = $(el).text().trim();
      const link = $(el).attr("href");
      if (title && title.length > 20) {
        const { sentiment, score } = detectSentiment(title);
        articles.push({ title, source: "Loop Jamaica", url: link?.startsWith("http") ? link : `https://jamaica.loopnews.com${link}`, sector: detectSector(title), symbol: detectSymbol(title), sentiment, sentimentScore: score, region: "caribbean" });
      }
    });
  } catch (e) { console.warn("Loop Jamaica:", e.message?.slice(0, 60)); }
  return articles;
}

async function scrapeRJRNews() {
  const articles = [];
  try {
    const { data } = await axios.get("https://radiojamaicanewsonline.com/business", HTTP);
    const $ = cheerio.load(data);
    $("article h2 a, article h3 a, .post-title a, .entry-title a, h2 a, h3 a, .card-title a").each((_, el) => {
      const title = $(el).text().trim();
      const link = $(el).attr("href");
      if (title && title.length > 20) {
        const { sentiment, score } = detectSentiment(title);
        articles.push({ title, source: "RJR News", url: link?.startsWith("http") ? link : `https://radiojamaicanewsonline.com${link}`, sector: detectSector(title), symbol: detectSymbol(title), sentiment, sentimentScore: score, region: "caribbean" });
      }
    });
  } catch (e) { console.warn("RJR:", e.message?.slice(0, 60)); }
  return articles;
}

async function scrapeGoogleNewsRSS(queries, region) {
  const articles = [];
  const gl = region === "caribbean" ? "JM" : "US";
  const hl = region === "caribbean" ? "en-JM" : "en-US";
  const ceid = region === "caribbean" ? "JM:en" : "US:en";
  for (const query of queries) {
    try {
      const { data } = await axios.get(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`, { ...HTTP, headers: { ...HTTP.headers, Accept: "application/rss+xml,application/xml,text/xml" } });
      const $ = cheerio.load(data, { xmlMode: true });
      $("item").each((_, el) => {
        const title = $(el).find("title").text().trim();
        const link = $(el).find("link").text().trim();
        const pubDate = $(el).find("pubDate").text().trim();
        const sourceEl = $(el).find("source").text().trim();
        const desc = $(el).find("description").text().trim().replace(/<[^>]+>/g, "").slice(0, 200);
        if (title && title.length > 20) {
          const { sentiment, score } = detectSentiment(title + " " + desc);
          articles.push({ title, source: sourceEl || "Google News", url: link, sector: detectSector(title), symbol: detectSymbol(title), sentiment, sentimentScore: score, summary: desc || undefined, time: relTime(pubDate), publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined, region });
        }
      });
    } catch (e) { console.warn("Google News RSS:", e.message?.slice(0, 60)); }
  }
  return articles;
}

// ── International RSS feeds ────────────────────────────────────────────────────

async function scrapeRSSFeed(url, sourceName) {
  const articles = [];
  try {
    const { data } = await axios.get(url, { ...HTTP, headers: { ...HTTP.headers, Accept: "application/rss+xml,application/xml,text/xml,*/*" } });
    const $ = cheerio.load(data, { xmlMode: true });
    $("item").each((_, el) => {
      const title = ($("title", el).first().text() || $(el).find("title").text()).trim();
      const link = ($("link", el).first().text() || $(el).find("link").text() || $(el).find("guid").text()).trim();
      const pubDate = $(el).find("pubDate").text().trim() || $(el).find("dc\\:date").text().trim();
      const desc = $(el).find("description").text().trim().replace(/<[^>]+>/g, "").slice(0, 300);
      if (title && title.length > 15 && link) {
        const { sentiment, score } = detectSentiment(title + " " + desc);
        articles.push({ title, source: sourceName, url: link, sector: detectSector(title), symbol: null, sentiment, sentimentScore: score, summary: desc || undefined, time: relTime(pubDate), publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined, region: "international" });
      }
    });
  } catch (e) { console.warn(`RSS ${sourceName}:`, e.message?.slice(0, 60)); }
  return articles;
}

async function scrapeInternationalNews() {
  const feeds = [
    // Reuters
    { url: "https://feeds.reuters.com/reuters/businessNews",            name: "Reuters" },
    { url: "https://feeds.reuters.com/reuters/financialsNews",          name: "Reuters" },
    // BBC Business
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml",           name: "BBC Business" },
    // The Guardian
    { url: "https://www.theguardian.com/business/rss",                  name: "The Guardian" },
    // CNBC
    { url: "https://search.cnbc.com/rs/search/combinedcombined/combinedcombined.xml?partnerId=wrss01&id=100727362", name: "CNBC" },
    { url: "https://search.cnbc.com/rs/search/combinedcombined/combinedcombined.xml?partnerId=wrss01&id=10000664",  name: "CNBC Markets" },
    // MarketWatch
    { url: "https://feeds.marketwatch.com/marketwatch/topstories/",     name: "MarketWatch" },
    { url: "https://feeds.marketwatch.com/marketwatch/marketpulse/",    name: "MarketWatch" },
    // Investing.com
    { url: "https://www.investing.com/rss/news_25.rss",                 name: "Investing.com" },
    { url: "https://www.investing.com/rss/news_14.rss",                 name: "Investing.com" },
    // Yahoo Finance
    { url: "https://finance.yahoo.com/news/rssindex",                   name: "Yahoo Finance" },
    // FXStreet (Forex)
    { url: "https://www.fxstreet.com/rss/news",                        name: "FXStreet" },
    // Caribbean Business
    { url: "https://caribbeanbusiness.com/feed/",                       name: "Caribbean Business" },
  ];

  const results = await Promise.allSettled(feeds.map(f => scrapeRSSFeed(f.url, f.name)));
  let all = [];
  results.forEach(r => { if (r.status === "fulfilled") all = all.concat(r.value); });
  return all;
}

// ── Deduplication ──────────────────────────────────────────────────────────────

function deduplicate(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main export ────────────────────────────────────────────────────────────────

async function fetchAllNews() {
  const now = Date.now();
  if (newsCache.length > 0 && now - lastFetch < CACHE_TTL) return newsCache;

  console.log("📰 Fetching news from all sources...");

  const [gleaner, observer, loop, rjr, caribbeanGoogle, intlGoogle, intlRSS] = await Promise.allSettled([
    scrapeGleaner(),
    scrapeObserver(),
    scrapeLoopJamaica(),
    scrapeRJRNews(),
    scrapeGoogleNewsRSS(
      ["Jamaica stock exchange", "Jamaica business economy", "JSE Jamaica financial", "Caribbean finance investment"],
      "caribbean"
    ),
    scrapeGoogleNewsRSS(
      ["global stock market", "US Federal Reserve interest rates", "forex currency markets", "oil price OPEC", "S&P 500 Nasdaq earnings"],
      "international"
    ),
    scrapeInternationalNews(),
  ]);

  let all = [];
  [gleaner, observer, loop, rjr, caribbeanGoogle, intlGoogle, intlRSS].forEach(r => {
    if (r.status === "fulfilled" && r.value?.length) all = all.concat(r.value);
  });

  all = deduplicate(all);

  all = all.map((a, i) => ({
    id: i + 1,
    ...a,
    time: a.time || "Today",
    scrapedAt: new Date().toISOString(),
  }));

  const stats = {};
  all.forEach(a => { stats[a.source] = (stats[a.source] || 0) + 1; });
  const caribCount = all.filter(a => a.region === "caribbean").length;
  const intlCount = all.filter(a => a.region === "international").length;
  console.log(`📰 ${all.length} articles (${caribCount} Caribbean, ${intlCount} International):`, stats);

  if (all.length > 0) { newsCache = all; lastFetch = now; }
  return all;
}

module.exports = { fetchAllNews };
