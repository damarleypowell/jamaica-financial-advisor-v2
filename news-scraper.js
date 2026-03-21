/**
 * Jamaica News Scraper
 * Scrapes business/financial news from major Jamaican newspapers:
 * - Jamaica Gleaner
 * - Jamaica Observer
 * - Loop Jamaica
 * - RJR News
 */

const axios = require("axios");
const cheerio = require("cheerio");

// Cache to avoid hammering the sites
let newsCache = [];
let lastFetch = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const JSE_KEYWORDS = [
  "JSE", "stock", "shares", "dividend", "earnings", "profit", "revenue",
  "investment", "market", "trading", "financial", "economy", "GDP",
  "Bank of Jamaica", "BOJ", "inflation", "interest rate", "exchange rate",
  "NCB", "Scotia", "Sagicor", "GraceKennedy", "Jamaica Broilers", "Barita",
  "Wisynco", "Seprod", "Caribbean Cement", "JMMB", "Proven", "Mayberry",
  "Carreras", "Derrimon", "Lasco", "Kingston Wharves", "iCreate",
  "Knutsford Express", "Fosrich", "Lumber Depot", "Express Catering",
  "Mailpac", "Sygnus", "Pulse", "Margaritaville", "Access Financial",
  "Productive Business", "Indies Pharma", "Berger Paints",
  "NCBFG", "SGJAM", "SFC", "GK", "JBGL", "BIL", "WISYNCO", "SEP",
  "CCC", "AFS", "PROVEN", "CPJ", "MEEG", "KEX", "ICREATE", "PBS",
  "FOSRICH", "LUMBER", "ECL", "MPC", "SCI", "DERRIMON", "LASC", "LASD",
  "INDIES", "MCGE", "BRG", "CAR", "MJE", "PULS",
  "business", "corporate", "IPO", "bond", "treasury", "fiscal",
  "tourism", "remittance", "export", "import", "trade"
];

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
  "NCBFG": "NCBFG", "SGJAM": "SGJAM", "SFC": "SFC", "GK": "GK",
  "JBGL": "JBGL", "BIL": "BIL",
};

function detectSymbol(text) {
  const upper = text.toUpperCase();
  for (const [keyword, symbol] of Object.entries(SYMBOL_MAP)) {
    if (upper.includes(keyword.toUpperCase())) return symbol;
  }
  return null;
}

function detectSentiment(text) {
  const lower = text.toLowerCase();
  const positive = ["record", "growth", "profit", "surge", "gain", "rise", "boost",
    "strong", "expand", "increase", "high", "dividend", "rally", "bullish", "recovery",
    "improve", "upgrade", "exceed", "positive", "outperform"];
  const negative = ["loss", "decline", "drop", "fall", "crash", "weak", "concern",
    "risk", "debt", "downturn", "bearish", "cut", "reduce", "downgrade", "warning",
    "deficit", "slump", "default", "layoff", "close"];

  let score = 0;
  positive.forEach(w => { if (lower.includes(w)) score++; });
  negative.forEach(w => { if (lower.includes(w)) score--; });

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function detectSector(text) {
  const lower = text.toLowerCase();
  if (/bank|financial|ncb|scotia|barita|jmmb|mayberry|sygnus|access financial|proven|lasco financial/i.test(text)) return "Financial";
  if (/insurance|sagicor/i.test(text)) return "Insurance";
  if (/tourism|hotel|margaritaville|resort/i.test(text)) return "Tourism";
  if (/technology|icreate|productive business|tech/i.test(text)) return "Technology";
  if (/food|broilers|seprod|caribbean producers|derrimon|lasco dist/i.test(text)) return "Food";
  if (/cement|construction|lumber|fosrich/i.test(text)) return "Construction";
  if (/beverages|wisynco/i.test(text)) return "Beverages";
  if (/pharma|health|indies/i.test(text)) return "Healthcare";
  if (/transport|knutsford|express catering|mailpac/i.test(text)) return "Transport";
  if (/gracekennedy|conglomerate/i.test(text)) return "Conglomerate";
  if (/media|pulse|entertainment|main event/i.test(text)) return "Entertainment";
  if (/boj|central bank|interest rate|inflation|gdp|economy|fiscal|imf/i.test(text)) return "Economy";
  if (/jse|stock exchange|market|trading|index/i.test(text)) return "Market";
  return "General";
}

async function scrapeGleaner() {
  const articles = [];
  try {
    const urls = [
      "https://jamaica-gleaner.com/business",
      "https://jamaica-gleaner.com/latest"
    ];
    for (const url of urls) {
      try {
        const { data } = await axios.get(url, {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
        });
        const $ = cheerio.load(data);

        // Try various selector patterns for Gleaner
        const selectors = [
          "article h2 a", "article h3 a", ".views-row h2 a", ".views-row h3 a",
          ".node-article h2 a", ".field-content a", "h2.node-title a", "h3.node-title a",
          ".view-content .views-row a", ".article-title a", ".teaser h2 a", ".teaser h3 a"
        ];

        for (const sel of selectors) {
          $(sel).each((_, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr("href");
            if (title && title.length > 15) {
              articles.push({
                title,
                source: "Jamaica Gleaner",
                url: link?.startsWith("http") ? link : `https://jamaica-gleaner.com${link}`,
                sector: detectSector(title),
                symbol: detectSymbol(title),
                sentiment: detectSentiment(title),
              });
            }
          });
          if (articles.length > 0) break;
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn("Gleaner scrape error:", e.message?.slice(0, 80));
  }
  return articles;
}

async function scrapeObserver() {
  const articles = [];
  try {
    const urls = [
      "https://www.jamaicaobserver.com/business/",
      "https://www.jamaicaobserver.com/latest-news/"
    ];
    for (const url of urls) {
      try {
        const { data } = await axios.get(url, {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
        });
        const $ = cheerio.load(data);

        const selectors = [
          "article h2 a", "article h3 a", ".post-title a", ".entry-title a",
          ".article-list h2 a", ".article-list h3 a", "h2.title a", "h3.title a",
          ".article-item h2 a", ".article-item h3 a", ".card-title a",
          ".article-card h2 a", ".article-card h3 a"
        ];

        for (const sel of selectors) {
          $(sel).each((_, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr("href");
            if (title && title.length > 15) {
              articles.push({
                title,
                source: "Jamaica Observer",
                url: link?.startsWith("http") ? link : `https://www.jamaicaobserver.com${link}`,
                sector: detectSector(title),
                symbol: detectSymbol(title),
                sentiment: detectSentiment(title),
              });
            }
          });
          if (articles.length > 0) break;
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn("Observer scrape error:", e.message?.slice(0, 80));
  }
  return articles;
}

async function scrapeLoopJamaica() {
  const articles = [];
  try {
    const urls = [
      "https://jamaica.loopnews.com/category/business",
      "https://jamaica.loopnews.com/loopjamaica"
    ];
    for (const url of urls) {
      try {
        const { data } = await axios.get(url, {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
        });
        const $ = cheerio.load(data);

        const selectors = [
          "article h2 a", "article h3 a", ".card-title a", ".entry-title a",
          ".news-card h2 a", ".news-card h3 a", "h2 a", "h3 a",
          ".article-card h2 a", ".article-title a", ".loop-card-title a"
        ];

        for (const sel of selectors) {
          $(sel).each((_, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr("href");
            if (title && title.length > 15) {
              articles.push({
                title,
                source: "Loop Jamaica",
                url: link?.startsWith("http") ? link : `https://jamaica.loopnews.com${link}`,
                sector: detectSector(title),
                symbol: detectSymbol(title),
                sentiment: detectSentiment(title),
              });
            }
          });
          if (articles.length > 0) break;
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn("Loop Jamaica scrape error:", e.message?.slice(0, 80));
  }
  return articles;
}

async function scrapeRJRNews() {
  const articles = [];
  try {
    const { data } = await axios.get("https://radiojamaicanewsonline.com/business", {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const $ = cheerio.load(data);

    const selectors = [
      "article h2 a", "article h3 a", ".post-title a", ".entry-title a",
      "h2 a", "h3 a", ".card-title a"
    ];

    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const title = $(el).text().trim();
        const link = $(el).attr("href");
        if (title && title.length > 15) {
          articles.push({
            title,
            source: "RJR News",
            url: link?.startsWith("http") ? link : `https://radiojamaicanewsonline.com${link}`,
            sector: detectSector(title),
            symbol: detectSymbol(title),
            sentiment: detectSentiment(title),
          });
        }
      });
      if (articles.length > 0) break;
    }
  } catch (e) {
    console.warn("RJR scrape error:", e.message?.slice(0, 80));
  }
  return articles;
}

async function scrapeJSEWebsite() {
  const articles = [];
  try {
    const { data } = await axios.get("https://www.jamstockex.com/", {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const $ = cheerio.load(data);

    $("a").each((_, el) => {
      const title = $(el).text().trim().replace(/\s+/g, " ");
      const link = $(el).attr("href");
      // Filter out index data rows (they contain "Vol" and numbers), nav links, and short text
      if (title && title.length > 25 && title.length < 200
        && !/ Vol\n/i.test($(el).text())
        && !/^\d/.test(title)
        && !/^(Start|Login|Register|Home|About|Contact|Search)/i.test(title)
        && /[a-zA-Z]{4,}/.test(title)
        && /stock|market|trading|jse|index|dividend|announcement|investor|company|report|quarter/i.test(title)) {
        articles.push({
          title,
          source: "JSE",
          url: link?.startsWith("http") ? link : `https://www.jamstockex.com${link}`,
          sector: "Market",
          symbol: detectSymbol(title),
          sentiment: detectSentiment(title),
        });
      }
    });
  } catch (e) {
    console.warn("JSE website scrape error:", e.message?.slice(0, 80));
  }
  return articles;
}

// Google News RSS feed for Jamaica business/finance news (very reliable)
async function scrapeGoogleNewsRSS() {
  const articles = [];
  const queries = [
    "Jamaica+stock+exchange",
    "Jamaica+business+economy",
    "JSE+Jamaica+financial",
  ];

  for (const query of queries) {
    try {
      const { data } = await axios.get(
        `https://news.google.com/rss/search?q=${query}&hl=en-JM&gl=JM&ceid=JM:en`,
        {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml",
          },
        }
      );
      const $ = cheerio.load(data, { xmlMode: true });

      $("item").each((_, el) => {
        const title = $(el).find("title").text().trim();
        const link = $(el).find("link").text().trim();
        const pubDate = $(el).find("pubDate").text().trim();
        const sourceEl = $(el).find("source").text().trim();

        if (title && title.length > 15) {
          // Calculate relative time
          let time = "Today";
          if (pubDate) {
            const diff = Date.now() - new Date(pubDate).getTime();
            const hours = Math.floor(diff / 3600000);
            if (hours < 1) time = "Just now";
            else if (hours < 24) time = `${hours}h ago`;
            else if (hours < 48) time = "Yesterday";
            else time = `${Math.floor(hours / 24)}d ago`;
          }

          articles.push({
            title,
            source: sourceEl || "Google News",
            url: link,
            sector: detectSector(title),
            symbol: detectSymbol(title),
            sentiment: detectSentiment(title),
            time,
          });
        }
      });
    } catch (e) {
      console.warn("Google News RSS error:", e.message?.slice(0, 80));
    }
  }
  return articles;
}

// Deduplicate by title similarity
function deduplicateNews(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchAllNews() {
  const now = Date.now();
  if (newsCache.length > 0 && now - lastFetch < CACHE_TTL) {
    return newsCache;
  }

  console.log("📰 Scraping Jamaican news sources...");

  // Scrape all sources in parallel
  const results = await Promise.allSettled([
    scrapeGleaner(),
    scrapeObserver(),
    scrapeLoopJamaica(),
    scrapeRJRNews(),
    scrapeJSEWebsite(),
    scrapeGoogleNewsRSS(),
  ]);

  let allArticles = [];
  results.forEach(result => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      allArticles = allArticles.concat(result.value);
    }
  });

  // Deduplicate
  allArticles = deduplicateNews(allArticles);

  // Add IDs and timestamps
  allArticles = allArticles.map((a, i) => ({
    id: i + 1,
    ...a,
    time: "Today",
    scrapedAt: new Date().toISOString(),
  }));

  // Limit to 50 most relevant
  allArticles = allArticles.slice(0, 50);

  const sourceStats = {};
  allArticles.forEach(a => { sourceStats[a.source] = (sourceStats[a.source] || 0) + 1; });
  console.log(`📰 Scraped ${allArticles.length} articles:`, sourceStats);

  if (allArticles.length > 0) {
    newsCache = allArticles;
    lastFetch = now;
  }

  return allArticles;
}

module.exports = { fetchAllNews };
