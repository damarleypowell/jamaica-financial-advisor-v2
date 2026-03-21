require("dotenv").config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { fetchAllNews } = require("./news-scraper");
const { scrapeAllStocks, scrapeStockDetail, fetchYahooQuote, fetchYahooResearch, formatMarketCap, getYahooSymbol } = require("./jse-scraper");

const app = express();

// ── Security Middleware ──────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Rate limiter (simple in-memory)
const rateLimits = new Map();
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    const entry = rateLimits.get(key) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
    entry.count++;
    rateLimits.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
}

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now > entry.reset) rateLimits.delete(key);
  }
}, 5 * 60 * 1000);

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:;");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Yahoo Finance (optional) ────────────────────────────────────────────────
let yahooFinance = null;
try {
  yahooFinance = require("yahoo-finance2").default;
  console.log("✅ yahoo-finance2 loaded — real market data enabled");
} catch (_) {
  console.warn("⚠️  yahoo-finance2 not installed. Run: npm install yahoo-finance2");
}

// ══════════════════════════════════════════════════════════════════════════════
// ── REAL STOCK DATA — scraped from jseinvestor.com (NO fake data) ───────────
// ══════════════════════════════════════════════════════════════════════════════

let livePrices = []; // populated on boot from jseinvestor.com
const priceHistory = {};
const researchCache = {};
const RESEARCH_TTL = 12 * 60 * 1000;

// Sector mapping for known JSE sectors
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

// ── Primary data fetcher: jseinvestor.com (real JSE data) ──────────────────
let isFetching = false;

async function fetchRealPrices() {
  if (isFetching) return;
  isFetching = true;

  try {
    const scraped = await scrapeAllStocks();
    if (!scraped || scraped.length === 0) {
      console.warn("⚠️  jseinvestor.com returned no data, keeping previous prices");
      isFetching = false;
      return;
    }

    // First boot — build livePrices from scratch
    if (livePrices.length === 0) {
      livePrices = scraped.map(s => ({
        symbol: s.symbol,
        name: s.name,
        sector: "General", // will be enriched by detail scrape
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
      // Init price history
      livePrices.forEach(s => {
        if (!priceHistory[s.symbol]) priceHistory[s.symbol] = [];
        priceHistory[s.symbol].push(s.price);
      });
      console.log(`✅ Loaded ${livePrices.length} real JSE stocks from jseinvestor.com`);

      // Enrich top stocks with detail data (sector, market cap, 52w range, etc.)
      enrichStockDetails();
    } else {
      // Update existing prices with fresh scrape
      let updated = 0;
      scraped.forEach(s => {
        const existing = livePrices.find(lp => lp.symbol === s.symbol);
        if (existing) {
          existing.price = s.price;
          existing.livePrice = s.price;
          existing.liveChange = s.pctChange;
          existing.dollarChange = s.dollarChange;
          existing.volume = s.volume;
          existing.dataSource = "jseinvestor";
          priceHistory[s.symbol] = priceHistory[s.symbol] || [];
          priceHistory[s.symbol].push(s.price);
          if (priceHistory[s.symbol].length > 500) priceHistory[s.symbol].shift();
          updated++;
        } else {
          // New stock appeared
          livePrices.push({
            symbol: s.symbol, name: s.name, sector: "General",
            price: s.price, livePrice: s.price, liveChange: s.pctChange,
            dollarChange: s.dollarChange, volume: s.volume,
            marketCap: "N/A", pe: 0, divYield: 0,
            high52: null, low52: null, eps: null,
            bid: null, ask: null, dayHigh: null, dayLow: null,
            issuedShares: null, currency: s.currency || "JMD",
            dataSource: "jseinvestor",
          });
          priceHistory[s.symbol] = [s.price];
        }
      });
      console.log(`📊 Updated ${updated}/${scraped.length} stock prices (real data)`);
    }
  } catch (e) {
    console.error("fetchRealPrices error:", e.message);
  }

  isFetching = false;
}

// ── Enrich stocks with detail data (sector, market cap, 52w, bid/ask) ──────
async function enrichStockDetails() {
  console.log("📋 Enriching stocks with detail data...");
  // Batch — scrape details for stocks in batches of 5, with delay
  const batchSize = 5;
  let enriched = 0;
  for (let i = 0; i < livePrices.length; i += batchSize) {
    const batch = livePrices.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(async (stock) => {
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
          if (detail.issuedShares) stock.issuedShares = detail.issuedShares;
          if (detail.volumeDetail) stock.volume = detail.volumeDetail;
          enriched++;
        }
      } catch (_) {}
    }));
    // Small delay between batches to be polite to the server
    if (i + batchSize < livePrices.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  console.log(`📋 Enriched ${enriched}/${livePrices.length} stocks with sector/market cap/52w data`);
}

// ── Boot: fetch real prices now, then refresh every 30 seconds ─────────────
// jseinvestor.com is scraped every 30s (polite rate), SSE pushes every 3s
const PRICE_REFRESH_INTERVAL = 30 * 1000; // 30 seconds
fetchRealPrices();
setInterval(fetchRealPrices, PRICE_REFRESH_INTERVAL);

// Re-enrich details every 10 minutes (sector, market cap, 52w data changes slowly)
setInterval(enrichStockDetails, 10 * 60 * 1000);

// ══════════════════════════════════════════════════════════════════════════════
// ── JWT HELPERS ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function createJWT(payload, expiresIn = "7d") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const expMs = expiresIn === "7d" ? 7 * 86400000 : 3600000;
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + expMs, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

// Auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });
  const user = verifyJWT(auth.slice(7));
  if (!user) return res.status(401).json({ error: "Invalid or expired token" });
  req.user = user;
  next();
}

// User storage (file-based)
function getUsersDB() {
  const p = path.join(DATA_DIR, "users.json");
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function saveUsersDB(users) {
  fs.writeFileSync(path.join(DATA_DIR, "users.json"), JSON.stringify(users, null, 2));
}

// ── SSE — push real prices to all connected clients every 3 seconds ────────
const sseClients = new Set();
setInterval(() => {
  if (livePrices.length === 0) return;
  const payload = JSON.stringify(livePrices.map(s => ({
    symbol: s.symbol, price: s.livePrice, change: s.liveChange, volume: s.volume
  })));
  sseClients.forEach(client => { try { client.write(`data: ${payload}\n\n`); } catch(_){} });
}, 3000);

// ══════════════════════════════════════════════════════════════════════════════
// ── AUTH ROUTES ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.post("/api/auth/signup", rateLimit(60000, 5), (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: "Invalid email format" });

  const users = getUsersDB();
  if (users.find(u => u.email === email.toLowerCase())) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const { hash, salt } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    hash, salt,
    createdAt: new Date().toISOString(),
    portfolio: [],
    watchlist: [],
    goals: [],
    chatHistory: [],
    riskProfile: null,
    settings: { theme: "dark", notifications: true },
  };
  users.push(user);
  saveUsersDB(users);

  const token = createJWT({ id: user.id, name: user.name, email: user.email });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, settings: user.settings } });
});

app.post("/api/auth/login", rateLimit(60000, 10), (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const users = getUsersDB();
  const user = users.find(u => u.email === email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const { hash } = hashPassword(password, user.salt);
  if (hash !== user.hash) return res.status(401).json({ error: "Invalid email or password" });

  const token = createJWT({ id: user.id, name: user.name, email: user.email });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, settings: user.settings } });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const users = getUsersDB();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    id: user.id, name: user.name, email: user.email,
    portfolio: user.portfolio, watchlist: user.watchlist,
    goals: user.goals, riskProfile: user.riskProfile, settings: user.settings,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── PORTFOLIO ROUTES (AUTH) ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.get("/api/user/portfolio", authMiddleware, (req, res) => {
  const users = getUsersDB();
  const user = users.find(u => u.id === req.user.id);
  res.json(user?.portfolio || []);
});

app.put("/api/user/portfolio", authMiddleware, (req, res) => {
  const { portfolio } = req.body;
  if (!Array.isArray(portfolio)) return res.status(400).json({ error: "Portfolio must be an array" });
  const users = getUsersDB();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.portfolio = portfolio;
  saveUsersDB(users);
  res.json({ ok: true, portfolio });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── WATCHLIST ROUTES (AUTH) ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.get("/api/user/watchlist", authMiddleware, (req, res) => {
  const users = getUsersDB();
  const user = users.find(u => u.id === req.user.id);
  res.json(user?.watchlist || []);
});

app.put("/api/user/watchlist", authMiddleware, (req, res) => {
  const { watchlist } = req.body;
  if (!Array.isArray(watchlist)) return res.status(400).json({ error: "Watchlist must be an array" });
  const users = getUsersDB();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.watchlist = watchlist;
  saveUsersDB(users);
  res.json({ ok: true, watchlist });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── FINANCIAL GOALS ROUTES (AUTH) ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.get("/api/user/goals", authMiddleware, (req, res) => {
  const users = getUsersDB();
  const user = users.find(u => u.id === req.user.id);
  res.json(user?.goals || []);
});

app.put("/api/user/goals", authMiddleware, (req, res) => {
  const { goals } = req.body;
  if (!Array.isArray(goals)) return res.status(400).json({ error: "Goals must be an array" });
  const users = getUsersDB();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.goals = goals;
  saveUsersDB(users);
  res.json({ ok: true, goals });
});

// Risk profile
app.put("/api/user/risk-profile", authMiddleware, (req, res) => {
  const { riskProfile } = req.body;
  const users = getUsersDB();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.riskProfile = riskProfile;
  saveUsersDB(users);
  res.json({ ok: true, riskProfile });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── AI CHAT ROUTE ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.post("/api/chat", rateLimit(60000, 20), async (req, res) => {
  const { messages, context } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: "Messages array required" });

  // Build market context
  const topGainers = [...livePrices].sort((a, b) => b.liveChange - a.liveChange).slice(0, 5);
  const topLosers = [...livePrices].sort((a, b) => a.liveChange - b.liveChange).slice(0, 5);
  const marketContext = `
Current JSE Market Data (live):
Top Gainers: ${topGainers.map(s => `${s.symbol}(+${s.liveChange}%,$${s.livePrice})`).join(", ")}
Top Losers: ${topLosers.map(s => `${s.symbol}(${s.liveChange}%,$${s.livePrice})`).join(", ")}
Total Stocks: ${livePrices.length}
${context ? `\nUser Context: ${context}` : ""}`;

  const systemPrompt = `You are JSE Advisor, a friendly and knowledgeable Jamaica Stock Exchange financial assistant. You help users understand investing, financial concepts, and the Jamaican stock market.

${marketContext}

Guidelines:
- Explain financial terms in clear, accessible language
- Reference actual JSE-listed companies and current market data when relevant
- Provide balanced perspectives on investment decisions
- Always include disclaimers that this is not financial advice
- Be conversational and supportive
- If asked about a specific stock, reference the live market data provided
- For complex financial planning, suggest consulting a licensed financial advisor
- You can discuss: stock analysis, portfolio strategy, financial literacy, market trends, risk management, retirement planning, savings strategies
- Format responses with markdown for readability`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    res.json({ reply: text });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return res.status(401).json({ error: "Invalid API key" });
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Rate limit reached" });
    res.status(500).json({ error: "Chat failed" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── AI FINANCIAL PLANNER ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.post("/api/financial-plan", rateLimit(60000, 5), async (req, res) => {
  const { goals, riskTolerance, currentSavings, monthlyContribution, timeHorizon, portfolio } = req.body;

  const marketData = livePrices.map(s =>
    `${s.symbol}(${s.sector},P/E:${s.pe}x,Div:${s.divYield}%,$${s.livePrice},${s.liveChange >= 0 ? "+" : ""}${s.liveChange}%)`
  ).join(" | ");

  const prompt = `Create a comprehensive Jamaica Stock Exchange investment plan.

INVESTOR PROFILE:
- Goals: ${goals || "Grow wealth"}
- Risk Tolerance: ${riskTolerance || "Moderate"}
- Current Savings: $${currentSavings || 0} JMD
- Monthly Contribution: $${monthlyContribution || 0} JMD
- Time Horizon: ${timeHorizon || "5 years"}
${portfolio ? `- Current Portfolio: ${JSON.stringify(portfolio)}` : "- No existing portfolio"}

AVAILABLE JSE STOCKS (live data):
${marketData}

You MUST respond with ONLY valid JSON:
{
  "planName": "Descriptive plan name",
  "summary": "2-3 sentence plan overview",
  "riskLevel": "Conservative|Moderate|Aggressive",
  "projectedReturn": { "annual": "8-12%", "total": "50-80%" },
  "allocations": [
    { "symbol": "NCBFG", "name": "NCB Financial", "weight": 20, "reasoning": "why" }
  ],
  "milestones": [
    { "year": 1, "target": 100000, "description": "what to expect" }
  ],
  "monthlyStrategy": "How to deploy monthly contributions",
  "riskMitigation": ["strategy 1", "strategy 2"],
  "rebalancingSchedule": "When and how to rebalance",
  "taxConsiderations": "Jamaica-specific tax notes",
  "actionItems": ["step 1", "step 2", "step 3"]
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
      system: "You are an expert Jamaican financial planner. Create detailed, actionable investment plans based on JSE stocks. Always respond with valid JSON only.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(jsonStr);
      res.json({ plan: parsed, structured: true });
    } catch {
      res.json({ plan: raw, structured: false });
    }
  } catch (error) {
    console.error("Financial plan error:", error.message);
    if (error instanceof Anthropic.AuthenticationError)
      return res.status(401).json({ error: "AI service authentication failed" });
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." });
    res.status(500).json({ error: "Financial planning failed. Please try again." });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── AUTO-INVEST AI (Autonomous Portfolio Management) ─────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.post("/api/auto-invest", rateLimit(60000, 3), async (req, res) => {
  const { holdings, goals, riskTolerance, timeHorizon } = req.body;
  if (!holdings || !Array.isArray(holdings))
    return res.status(400).json({ error: "Holdings array required" });

  // Enrich holdings with live data
  const enriched = holdings.map(h => {
    const stock = livePrices.find(s => s.symbol === h.symbol);
    if (!stock) return null;
    const hist = priceHistory[h.symbol] || [];
    const prices = hist.slice(-30);
    let rsi = 50;
    if (prices.length >= 15) {
      let g = 0, l = 0;
      for (let i = prices.length - 14; i < prices.length; i++) {
        const d = prices[i] - prices[i - 1];
        if (d > 0) g += d; else l -= d;
      }
      const ag = g / 14, al = l / 14;
      rsi = al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(1);
    }
    return {
      symbol: h.symbol, name: stock.name, qty: h.qty,
      avgPrice: h.avgPrice, currentPrice: stock.livePrice,
      currentValue: +(stock.livePrice * h.qty).toFixed(2),
      costBasis: +(h.avgPrice * h.qty).toFixed(2),
      sector: stock.sector, pe: stock.pe, divYield: stock.divYield,
      change: stock.liveChange, rsi, marketCap: stock.marketCap,
    };
  }).filter(Boolean);

  const totalValue = enriched.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = enriched.reduce((s, h) => s + h.costBasis, 0);

  const owned = new Set(enriched.map(h => h.symbol));
  const otherStocks = livePrices.filter(s => !owned.has(s.symbol))
    .map(s => `${s.symbol}(${s.sector},P/E:${s.pe}x,Yield:${s.divYield}%,Change:${s.liveChange >= 0 ? "+" : ""}${s.liveChange}%,RSI:${(() => {
      const hist = priceHistory[s.symbol] || [];
      const prices = hist.slice(-30);
      if (prices.length < 15) return 50;
      let g = 0, l = 0;
      for (let i = prices.length - 14; i < prices.length; i++) {
        const d = prices[i] - prices[i - 1];
        if (d > 0) g += d; else l -= d;
      }
      const ag = g / 14, al = l / 14;
      return al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(1);
    })()})`)
    .join(" | ");

  const prompt = `You are an autonomous AI portfolio manager for the Jamaica Stock Exchange. Your job is to make SPECIFIC trade decisions to optimize this portfolio toward the investor's goals.

INVESTOR PROFILE:
- Goal: ${goals || "Maximum sustainable growth"}
- Risk Tolerance: ${riskTolerance || "Moderate"}
- Time Horizon: ${timeHorizon || "5 years"}
- Portfolio Value: $${totalValue.toFixed(2)} JMD (Cost: $${totalCost.toFixed(2)})

CURRENT HOLDINGS:
${enriched.map(h => `${h.symbol}: ${h.qty}sh@$${h.avgPrice.toFixed(2)}, now $${h.currentPrice.toFixed(2)} (${((h.currentValue - h.costBasis) / h.costBasis * 100).toFixed(1)}%), RSI:${h.rsi}, ${h.sector}`).join("\n")}

ALL AVAILABLE JSE STOCKS:
${otherStocks}

You MUST respond with ONLY valid JSON:
{
  "decisions": [
    {
      "action": "BUY|SELL|HOLD|REDUCE",
      "symbol": "SYMBOL",
      "name": "Company Name",
      "shares": 100,
      "reasoning": "Data-driven reasoning with specific metrics",
      "confidence": 85,
      "urgency": "IMMEDIATE|THIS_WEEK|THIS_MONTH"
    }
  ],
  "portfolioScore": 7,
  "marketOutlook": "Brief JSE market outlook",
  "nextReview": "When to review next",
  "projectedGrowth": "+X% over Y period",
  "keyRisks": ["risk 1", "risk 2"],
  "executionPlan": "Step-by-step execution order"
}
All decisions must be based ONLY on the live data provided. Be specific with share quantities.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
      system: "You are an expert autonomous JSE portfolio manager. Make precise, data-driven trade decisions. Respond with valid JSON only.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(jsonStr);
      res.json({ result: parsed, structured: true, metrics: { totalValue, totalCost, holdings: enriched } });
    } catch {
      res.json({ result: raw, structured: false });
    }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Rate limit reached" });
    res.status(500).json({ error: "Auto-invest failed" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── STOCK SCREENER ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.post("/api/screener", (req, res) => {
  const { minPE, maxPE, minDiv, maxDiv, sectors, minChange, maxChange, sortBy, sortDir } = req.body;

  let results = livePrices.map(s => ({
    symbol: s.symbol, name: s.name, price: s.livePrice, change: s.liveChange,
    volume: s.volume, marketCap: s.marketCap, sector: s.sector, pe: s.pe, divYield: s.divYield,
  }));

  if (minPE != null) results = results.filter(s => s.pe >= minPE);
  if (maxPE != null) results = results.filter(s => s.pe <= maxPE);
  if (minDiv != null) results = results.filter(s => s.divYield >= minDiv);
  if (maxDiv != null) results = results.filter(s => s.divYield <= maxDiv);
  if (sectors && sectors.length > 0) results = results.filter(s => sectors.includes(s.sector));
  if (minChange != null) results = results.filter(s => s.change >= minChange);
  if (maxChange != null) results = results.filter(s => s.change <= maxChange);

  if (sortBy) {
    const dir = sortDir === "desc" ? -1 : 1;
    results.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      if (typeof av === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  res.json({ results, total: results.length });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── NEWS & MARKET INSIGHTS (Real scraped from Jamaican newspapers) ───────────
// ══════════════════════════════════════════════════════════════════════════════

// Pre-fetch news on startup
fetchAllNews().catch(e => console.warn("Initial news fetch failed:", e.message));
// Refresh news every 10 minutes
setInterval(() => fetchAllNews().catch(() => {}), 10 * 60 * 1000);

app.get("/api/news", async (req, res) => {
  const { sector, symbol } = req.query;
  try {
    let news = await fetchAllNews();
    if (sector) news = news.filter(n => n.sector === sector);
    if (symbol) news = news.filter(n => n.symbol === symbol);
    res.json(news);
  } catch (e) {
    console.error("News fetch error:", e.message);
    res.json([]);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── SECTOR PERFORMANCE ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.get("/api/sectors", (_req, res) => {
  const sectorMap = {};
  livePrices.forEach(s => {
    if (!sectorMap[s.sector]) sectorMap[s.sector] = { stocks: [], totalChange: 0, totalVolume: 0, totalMarketCap: 0 };
    sectorMap[s.sector].stocks.push(s.symbol);
    sectorMap[s.sector].totalChange += s.liveChange;
    sectorMap[s.sector].totalVolume += s.volume;
  });

  const sectors = Object.entries(sectorMap).map(([name, data]) => ({
    name,
    avgChange: +(data.totalChange / data.stocks.length).toFixed(2),
    stockCount: data.stocks.length,
    totalVolume: data.totalVolume,
    stocks: data.stocks,
    performance: data.totalChange / data.stocks.length > 1 ? "bullish" :
                 data.totalChange / data.stocks.length < -1 ? "bearish" : "neutral",
  })).sort((a, b) => b.avgChange - a.avgChange);

  res.json(sectors);
});

// ══════════════════════════════════════════════════════════════════════════════
// ── STOCK COMPARISON ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.post("/api/compare", (req, res) => {
  const { symbols } = req.body;
  if (!symbols || !Array.isArray(symbols) || symbols.length < 2)
    return res.status(400).json({ error: "At least 2 symbols required" });

  const comparison = symbols.map(sym => {
    const stock = livePrices.find(s => s.symbol === sym.toUpperCase());
    if (!stock) return null;
    const hist = priceHistory[sym.toUpperCase()] || [];
    const prices = hist.slice(-30);
    let rsi = 50;
    if (prices.length >= 15) {
      let g = 0, l = 0;
      for (let i = prices.length - 14; i < prices.length; i++) {
        const d = prices[i] - prices[i - 1];
        if (d > 0) g += d; else l -= d;
      }
      const ag = g / 14, al = l / 14;
      rsi = al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(1);
    }
    const high30 = prices.length ? Math.max(...prices) : stock.livePrice;
    const low30 = prices.length ? Math.min(...prices) : stock.livePrice;

    return {
      symbol: stock.symbol, name: stock.name, price: stock.livePrice,
      change: stock.liveChange, sector: stock.sector, pe: stock.pe,
      divYield: stock.divYield, volume: stock.volume, marketCap: stock.marketCap,
      rsi, high30: +high30.toFixed(2), low30: +low30.toFixed(2),
    };
  }).filter(Boolean);

  res.json({ comparison });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── EXISTING ROUTES (preserved) ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

app.get("/api/research/:symbol", async (req, res) => {
  if (!yahooFinance) {
    return res.status(503).json({ error: "Yahoo Finance not available", fallback: true });
  }

  const sym = req.params.symbol.toUpperCase();
  const stock = livePrices.find(s => s.symbol === sym);
  if (!stock) return res.status(404).json({ error: "Symbol not found" });

  if (researchCache[sym] && Date.now() - researchCache[sym].ts < RESEARCH_TTL) {
    return res.json(researchCache[sym].data);
  }

  const yfSym = getYahooSymbol(sym);
  const period1 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    const [quoteResult, histResult] = await Promise.allSettled([
      yahooFinance.quoteSummary(yfSym, {
        modules: ["summaryDetail", "financialData", "defaultKeyStatistics"],
        validateResult: false,
      }),
      yahooFinance.historical(yfSym, { period1, interval: "1d" }),
    ]);

    const q = quoteResult.status === "fulfilled" ? quoteResult.value : null;
    const rawHist = histResult.status === "fulfilled" ? histResult.value : [];

    if (!q && rawHist.length === 0) {
      return res.status(404).json({ error: "No market data for this symbol on Yahoo Finance", fallback: true });
    }

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
      enterpriseValue: q.defaultKeyStatistics?.enterpriseValue ?? null,
      evToEbitda: q.defaultKeyStatistics?.enterpriseToEbitda ?? null,
    } : null;

    const candles = rawHist
      .filter(b => b.open > 0 && b.close > 0 && b.high > 0 && b.low > 0)
      .map(b => ({
        time: Math.floor(new Date(b.date).getTime() / 1000),
        open: +b.open.toFixed(2), high: +b.high.toFixed(2),
        low: +b.low.toFixed(2), close: +b.close.toFixed(2),
        volume: b.volume || 0,
      }));

    const closes = candles.map(c => c.close);
    let rsi14 = null;
    if (closes.length >= 15) {
      let gains = 0, losses = 0;
      for (let i = closes.length - 14; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        if (d > 0) gains += d; else losses -= d;
      }
      const avgG = gains / 14, avgL = losses / 14;
      rsi14 = avgL === 0 ? 100 : +(100 - 100 / (1 + avgG / avgL)).toFixed(1);
    }

    let annVol = null;
    if (closes.length >= 20) {
      const rets = closes.slice(1).map((p, i) => Math.log(p / closes[i]));
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
      annVol = +(Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(1);
    }

    const allHighs = candles.map(c => c.high);
    const allLows = candles.map(c => c.low);
    const high90 = allHighs.length ? +Math.max(...allHighs).toFixed(2) : null;
    const low90 = allLows.length ? +Math.min(...allLows).toFixed(2) : null;
    const avgClose = closes.length ? +(closes.reduce((a, b) => a + b, 0) / closes.length).toFixed(2) : null;

    const data = {
      symbol: sym, realData: true, fundamentals, candles,
      derived: { rsi14, annVol, high90, low90, avgClose, candleCount: candles.length },
    };

    researchCache[sym] = { data, ts: Date.now() };
    res.json(data);
  } catch (e) {
    console.warn(`Yahoo Finance error [${sym}]:`, e.message?.slice(0, 120));
    res.status(502).json({ error: "Research data temporarily unavailable", fallback: true });
  }
});

app.get("/api/stream/prices", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const initial = JSON.stringify(livePrices.map(s => ({
    symbol: s.symbol, price: s.livePrice, change: s.liveChange, volume: s.volume
  })));
  res.write(`data: ${initial}\n\n`);
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

app.get("/api/stocks", (_req, res) => {
  res.json(livePrices.map(s => ({
    symbol: s.symbol, name: s.name, price: s.livePrice, change: s.liveChange,
    volume: s.volume, marketCap: s.marketCap, sector: s.sector, pe: s.pe, divYield: s.divYield
  })));
});

app.get("/api/stocks/:symbol", (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  const stock = livePrices.find(s => s.symbol === sym);
  if (!stock) return res.status(404).json({ error: "Stock not found" });

  // Generate real-time summary from live data (no fake markdown files)
  const hist = priceHistory[sym] || [];
  const prices = hist.slice(-30);
  let rsi = null;
  if (prices.length >= 15) {
    let g = 0, l = 0;
    for (let i = prices.length - 14; i < prices.length; i++) {
      const d = prices[i] - prices[i - 1];
      if (d > 0) g += d; else l -= d;
    }
    const ag = g / 14, al = l / 14;
    rsi = al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(1);
  }
  const high30 = prices.length ? +Math.max(...prices).toFixed(2) : null;
  const low30 = prices.length ? +Math.min(...prices).toFixed(2) : null;

  res.json({
    symbol: stock.symbol, name: stock.name, price: stock.livePrice, change: stock.liveChange,
    volume: stock.volume, marketCap: stock.marketCap, sector: stock.sector,
    pe: stock.pe, divYield: stock.divYield,
    high52: stock.high52, low52: stock.low52, eps: stock.eps,
    high30, low30, rsi,
    dataSource: stock.dataSource,
    history: hist,
  });
});

app.get("/api/market-overview", (_req, res) => {
  const gainers = livePrices.filter(s => s.liveChange > 0).length;
  const losers = livePrices.filter(s => s.liveChange < 0).length;
  const sorted = [...livePrices].sort((a, b) => b.liveChange - a.liveChange);
  const topGainer = sorted[0];
  const topLoser = sorted[sorted.length - 1];
  const totalVolume = livePrices.reduce((sum, s) => sum + s.volume, 0);

  res.json({
    gainers, losers, unchanged: livePrices.length - gainers - losers,
    topGainer: { symbol: topGainer.symbol, change: topGainer.liveChange },
    topLoser: { symbol: topLoser.symbol, change: topLoser.liveChange },
    totalVolume, totalStocks: livePrices.length
  });
});

app.get("/api/history/:symbol", (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  const hist = priceHistory[sym];
  if (!hist) return res.status(404).json({ error: "Not found" });
  res.json({ symbol: sym, history: hist });
});

// ── ElevenLabs TTS ──────────────────────────────────────────────────────────
const VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // Daniel — deep, clear, professional British voice

app.post("/api/speak", rateLimit(60000, 10), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY === "your_elevenlabs_api_key_here") {
    return res.status(503).json({ error: "ElevenLabs API key not configured. Add ELEVENLABS_API_KEY to .env" });
  }

  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!elRes.ok) {
      await elRes.text();
      return res.status(502).json({ error: "Text-to-speech service error. Please try again." });
    }

    const buffer = await elRes.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("ElevenLabs error:", e);
    res.status(500).json({ error: "TTS request failed" });
  }
});

// ── Voice Chat: Speech → AI Research → ElevenLabs Voice Response ────────────
app.post("/api/voice-chat", rateLimit(60000, 10), async (req, res) => {
  const { text, context } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  // Step 1: Get AI response with full market context
  const topGainers = [...livePrices].sort((a, b) => b.liveChange - a.liveChange).slice(0, 5);
  const topLosers = [...livePrices].sort((a, b) => a.liveChange - b.liveChange).slice(0, 5);

  // Detect if user is asking about a specific stock
  const inputUpper = text.toUpperCase();
  const detectedStock = livePrices.find(s =>
    inputUpper.includes(s.symbol) ||
    text.toLowerCase().includes(s.name.toLowerCase().split(" ").slice(0, 2).join(" "))
  );

  let stockContext = "";
  if (detectedStock) {
    const hist = priceHistory[detectedStock.symbol] || [];
    const prices = hist.slice(-30);
    let rsi = 50;
    if (prices.length >= 15) {
      let g = 0, l = 0;
      for (let i = prices.length - 14; i < prices.length; i++) {
        const d = prices[i] - prices[i - 1];
        if (d > 0) g += d; else l -= d;
      }
      const ag = g / 14, al = l / 14;
      rsi = al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(1);
    }
    stockContext = `\n\nDETAILED DATA for ${detectedStock.symbol}:
Company: ${detectedStock.name} | Sector: ${detectedStock.sector}
Price: $${detectedStock.livePrice} JMD | Change: ${detectedStock.liveChange >= 0 ? "+" : ""}${detectedStock.liveChange}%
Volume: ${detectedStock.volume.toLocaleString()} | Market Cap: ${detectedStock.marketCap}
P/E: ${detectedStock.pe}x | Dividend Yield: ${detectedStock.divYield}% | RSI(14): ${rsi}`;
  }

  // Get recent news for context
  let newsContext = "";
  try {
    const news = await fetchAllNews();
    const relevant = detectedStock
      ? news.filter(n => n.symbol === detectedStock.symbol || n.title.toLowerCase().includes(detectedStock.name.toLowerCase().split(" ")[0].toLowerCase())).slice(0, 3)
      : news.slice(0, 5);
    if (relevant.length > 0) {
      newsContext = "\n\nRECENT NEWS:\n" + relevant.map(n => `- ${n.title} (${n.source}, ${n.sentiment})`).join("\n");
    }
  } catch (_) {}

  const marketContext = `
Current JSE Market Data (live):
Top Gainers: ${topGainers.map(s => `${s.symbol}(+${s.liveChange}%,$${s.livePrice})`).join(", ")}
Top Losers: ${topLosers.map(s => `${s.symbol}(${s.liveChange}%,$${s.livePrice})`).join(", ")}
Total Stocks: ${livePrices.length}${stockContext}${newsContext}
${context ? `\nUser Context: ${context}` : ""}`;

  const systemPrompt = `You are JSE Advisor, a friendly and knowledgeable Jamaica Stock Exchange financial assistant speaking to the user via voice.

${marketContext}

IMPORTANT: Your response will be read aloud via text-to-speech. Keep it:
- Conversational and natural-sounding (as if speaking, not writing)
- Concise but informative (2-4 sentences for simple questions, up to 6 for detailed analysis)
- Avoid markdown, bullet points, or formatting — use plain spoken English
- Include specific numbers and data when available
- Reference actual JSE companies and market data
- Always mention it's not financial advice when giving recommendations
- Be warm, professional, and Jamaican-friendly in tone`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    });

    const aiText = response.content.filter(b => b.type === "text").map(b => b.text).join("\n");

    // Step 2: Convert to speech via ElevenLabs
    if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY === "your_elevenlabs_api_key_here") {
      // No ElevenLabs key — return text only, frontend will use browser TTS
      return res.json({ reply: aiText, audio: false });
    }

    try {
      const elRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
          },
          body: JSON.stringify({
            text: aiText,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (elRes.ok) {
        const buffer = await elRes.arrayBuffer();
        const audioBase64 = Buffer.from(buffer).toString("base64");
        return res.json({ reply: aiText, audio: true, audioData: audioBase64 });
      } else {
        // ElevenLabs failed, return text only
        return res.json({ reply: aiText, audio: false });
      }
    } catch (ttsErr) {
      console.warn("ElevenLabs TTS error:", ttsErr.message);
      return res.json({ reply: aiText, audio: false });
    }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return res.status(401).json({ error: "Invalid API key" });
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Rate limit reached" });
    res.status(500).json({ error: "Voice chat failed" });
  }
});

// ── AI Analysis ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  Beginner: `You are a friendly Jamaica Stock Exchange (JSE) financial advisor for beginners.
Explain everything in simple everyday language. No jargon. Use plain analogies a first-time investor would understand.
You MUST respond with ONLY valid JSON — no markdown, no backticks, no extra text before or after.
Use exactly this structure:
{
  "company": "Company name",
  "overview": "2-3 sentence plain-language summary of what the company does",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4"],
  "recommendation": "BUY | HOLD | SELL",
  "verdict": "1-2 sentence plain verdict",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "riskScore": 7
}
riskScore: integer 1-10 (1=very low risk, 10=very high risk) derived from the actual data provided.`,

  Intermediate: `You are a knowledgeable Jamaica Stock Exchange (JSE) financial advisor for intermediate investors.
Use standard financial terminology. Reference P/E ratios, dividend yield, EPS, ROI, and market cap where relevant.
You MUST respond with ONLY valid JSON — no markdown, no backticks, no extra text before or after.
Use exactly this structure:
{
  "company": "Company name",
  "overview": "2-3 sentence summary referencing key fundamentals",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4"],
  "recommendation": "BUY | HOLD | SELL",
  "verdict": "1-2 sentence verdict referencing P/E or yield",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "riskScore": 7,
  "technicalSummary": {
    "trend": "bullish | bearish | neutral",
    "ma20Signal": "above | below | at",
    "volumeTrend": "increasing | decreasing | stable",
    "relativeStrength": "strong | average | weak",
    "priceTarget": 0.00
  },
  "fundamentals": {
    "peAssessment": "undervalued | fairly valued | overvalued",
    "dividendQuality": "excellent | good | fair | poor",
    "sectorOutlook": "positive | neutral | negative"
  }
}
riskScore: integer 1-10 from actual data. priceTarget: realistic 12-month JMD price target.`,

  Advanced: `You are an expert Jamaica Stock Exchange (JSE) quantitative analyst for sophisticated investors.
Provide deep technical analysis: valuation multiples, technical indicators, DCF, beta/volatility, liquidity, risk-adjusted returns.
You MUST respond with ONLY valid JSON — no markdown, no backticks, no extra text before or after.
Use exactly this structure:
{
  "company": "Company name",
  "overview": "2-3 sentence quantitative summary with valuation context",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4"],
  "recommendation": "BUY | HOLD | SELL",
  "verdict": "1-2 sentence verdict with price target and thesis",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "riskScore": 7,
  "technicalIndicators": {
    "rsiEstimate": 50,
    "trend": "bullish | bearish | neutral",
    "support": 0.00,
    "resistance": 0.00,
    "bollingerPosition": "upper | middle | lower",
    "macdSignal": "bullish | bearish | neutral"
  },
  "quantMetrics": {
    "annualizedVolatility": "0.0%",
    "momentumScore": 5,
    "liquidityRating": "high | moderate | low",
    "fairValueEstimate": 0.00,
    "marginOfSafety": "0%"
  },
  "catalysts": ["catalyst 1", "catalyst 2"],
  "hedgeStrategy": "Brief hedging recommendation"
}
All numeric values derived from real data provided.`,
};

app.post("/analyze", rateLimit(60000, 10), async (req, res) => {
  const { user_input, experience_level } = req.body;
  if (!user_input || !experience_level)
    return res.status(400).json({ error: "Missing required fields" });

  const validLevels = ["Beginner", "Intermediate", "Advanced"];
  if (!validLevels.includes(experience_level))
    return res.status(400).json({ error: `experience_level must be one of: ${validLevels.join(", ")}` });

  const inputUpper = user_input.toUpperCase();
  const detectedStock = livePrices.find(s =>
    inputUpper.includes(s.symbol) ||
    user_input.toLowerCase().includes(s.name.toLowerCase().split(" ").slice(0, 2).join(" "))
  );

  let enrichedInput = user_input;

  if (detectedStock) {
    const hist = priceHistory[detectedStock.symbol] || [];
    const prices = hist.slice(-30);
    let simSection = "";
    if (prices.length > 1) {
      const high = Math.max(...prices).toFixed(2);
      const low = Math.min(...prices).toFixed(2);
      const avg = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
      const rets = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
      const vol = (Math.sqrt(rets.reduce((a, b) => a + b * b, 0) / rets.length) * Math.sqrt(252) * 100).toFixed(1);
      const ma20 = prices.length >= 20
        ? (prices.slice(-20).reduce((a, b) => a + b, 0) / 20).toFixed(2) : avg;
      let rsi = 50;
      if (prices.length >= 15) {
        let gains = 0, losses = 0;
        for (let i = prices.length - 14; i < prices.length; i++) {
          const d = prices[i] - prices[i - 1];
          if (d > 0) gains += d; else losses -= d;
        }
        const avgG = gains / 14, avgL = losses / 14;
        rsi = avgL === 0 ? 100 : +(100 - 100 / (1 + avgG / avgL)).toFixed(1);
      }

      simSection = `
--- LIVE MARKET DATA (${detectedStock.symbol}) ---
Company:               ${detectedStock.name}
Current Price:         $${detectedStock.livePrice.toFixed(2)} JMD
Today's Change:        ${detectedStock.liveChange >= 0 ? "+" : ""}${detectedStock.liveChange}%
Volume:                ${detectedStock.volume.toLocaleString()} shares
Market Cap:            ${detectedStock.marketCap}
Sector:                ${detectedStock.sector}
P/E Ratio:             ${detectedStock.pe}x
Dividend Yield:        ${detectedStock.divYield}%
30-Day High:           $${high} JMD
30-Day Low:            $${low} JMD
30-Day Average:        $${avg} JMD
20-Day MA:             $${ma20} JMD (price is ${detectedStock.livePrice > parseFloat(ma20) ? "ABOVE" : "BELOW"} MA)
RSI (14):              ${rsi}
Annualized Volatility: ${vol}%
Last 15 prices:        ${hist.slice(-15).map(p => `$${p.toFixed(2)}`).join(", ")}`;
    }

    let realSection = "";
    const cached = researchCache[detectedStock.symbol];
    if (cached && Date.now() - cached.ts < RESEARCH_TTL && cached.data.realData) {
      const { fundamentals: f, derived: d } = cached.data;
      if (f) {
        realSection = `

--- REAL YAHOO FINANCE FUNDAMENTALS (${detectedStock.symbol}.JM) ---
P/E (TTM):             ${f.pe != null ? f.pe.toFixed(2) + "x" : "N/A"}
Forward P/E:           ${f.forwardPE != null ? f.forwardPE.toFixed(2) + "x" : "N/A"}
Price/Book:            ${f.pb != null ? f.pb.toFixed(2) + "x" : "N/A"}
EPS (TTM):             ${f.eps != null ? "$" + f.eps.toFixed(2) + " JMD" : "N/A"}
Dividend Yield:        ${f.dividendYield != null ? (f.dividendYield * 100).toFixed(2) + "%" : "N/A"}
Market Cap:            ${f.marketCap != null ? "$" + (f.marketCap / 1e9).toFixed(2) + "B JMD" : "N/A"}
Revenue:               ${f.revenue != null ? "$" + (f.revenue / 1e9).toFixed(2) + "B JMD" : "N/A"}
Profit Margin:         ${f.profitMargin != null ? (f.profitMargin * 100).toFixed(2) + "%" : "N/A"}
Return on Equity:      ${f.roe != null ? (f.roe * 100).toFixed(2) + "%" : "N/A"}
Debt/Equity:           ${f.debtToEquity != null ? f.debtToEquity.toFixed(2) : "N/A"}
Beta:                  ${f.beta != null ? f.beta.toFixed(2) : "N/A"}
EV/EBITDA:             ${f.evToEbitda != null ? f.evToEbitda.toFixed(2) + "x" : "N/A"}
Revenue Growth (YoY):  ${f.revenueGrowth != null ? (f.revenueGrowth * 100).toFixed(2) + "%" : "N/A"}
Earnings Growth (YoY): ${f.earningsGrowth != null ? (f.earningsGrowth * 100).toFixed(2) + "%" : "N/A"}
Analyst Target Price:  ${f.targetPrice != null ? "$" + f.targetPrice.toFixed(2) + " JMD" : "N/A"}
Analyst Recommendation:${f.recommendation || "N/A"}`;
      }
      if (d) {
        realSection += `

--- REAL TECHNICAL DATA (90-Day Daily OHLCV) ---
90-Day High:           ${d.high90 != null ? "$" + d.high90 + " JMD" : "N/A"}
90-Day Low:            ${d.low90 != null ? "$" + d.low90 + " JMD" : "N/A"}
90-Day Avg Close:      ${d.avgClose != null ? "$" + d.avgClose + " JMD" : "N/A"}
RSI (14, real):        ${d.rsi14 != null ? d.rsi14 : "N/A"}
Annualized Volatility: ${d.annVol != null ? d.annVol + "%" : "N/A"}
Trading Days in Data:  ${d.candleCount}`;
      }
    }

    enrichedInput += simSection + realSection + "\n--- Base your entire analysis on this data ---";
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPTS[experience_level],
      messages: [{ role: "user", content: enrichedInput }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    let parsed;
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!jsonStr) throw new Error("no JSON");
      parsed = JSON.parse(jsonStr);
      if (!parsed.company || !parsed.recommendation) throw new Error("incomplete");
    } catch {
      return res.json({ analysis: raw, structured: false, symbol: detectedStock?.symbol || null, level: experience_level });
    }
    res.json({ analysis: parsed, structured: true, symbol: detectedStock?.symbol || null, level: experience_level });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return res.status(401).json({ error: "Invalid API key" });
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Rate limit reached" });
    if (error instanceof Anthropic.APIError)
      return res.status(502).json({ error: `Claude API error: ${error.message}` });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Portfolio Optimizer (legacy) ────────────────────────────────────────────
app.post("/api/portfolio/optimize", rateLimit(60000, 5), async (req, res) => {
  const { holdings } = req.body;
  if (!holdings || !Array.isArray(holdings) || holdings.length === 0)
    return res.status(400).json({ error: "Holdings array required" });

  const enriched = holdings.map(h => {
    const stock = livePrices.find(s => s.symbol === h.symbol);
    if (!stock) return null;
    const hist = priceHistory[h.symbol] || [];
    const prices = hist.slice(-30);
    let rsi = 50;
    if (prices.length >= 15) {
      let g = 0, l = 0;
      for (let i = prices.length - 14; i < prices.length; i++) {
        const d = prices[i] - prices[i - 1];
        if (d > 0) g += d; else l -= d;
      }
      const ag = g / 14, al = l / 14;
      rsi = al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(1);
    }
    const currentValue = +(stock.livePrice * h.qty).toFixed(2);
    const costBasis = +(h.avgPrice * h.qty).toFixed(2);
    return {
      symbol: h.symbol, name: stock.name, qty: h.qty,
      avgPrice: h.avgPrice, currentPrice: stock.livePrice,
      currentValue, costBasis,
      gainLoss: +(currentValue - costBasis).toFixed(2),
      gainLossPct: +((currentValue - costBasis) / costBasis * 100).toFixed(2),
      sector: stock.sector, pe: stock.pe, divYield: stock.divYield,
      change: stock.liveChange, rsi, marketCap: stock.marketCap,
    };
  }).filter(Boolean);

  if (!enriched.length) return res.status(400).json({ error: "No valid holdings" });

  const totalValue = enriched.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = enriched.reduce((s, h) => s + h.costBasis, 0);
  const totalGainLoss = +(totalValue - totalCost).toFixed(2);
  const totalReturn = +((totalGainLoss / totalCost) * 100).toFixed(2);

  const sectorMap = {};
  enriched.forEach(h => { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue; });
  const sectorAlloc = Object.entries(sectorMap).map(([s, v]) => `${s}: ${((v / totalValue) * 100).toFixed(1)}%`).join(", ");

  const owned = new Set(enriched.map(h => h.symbol));
  const otherStocks = livePrices.filter(s => !owned.has(s.symbol))
    .map(s => `${s.symbol}(${s.sector},P/E:${s.pe}x,Yield:${s.divYield}%,Today:${s.liveChange >= 0 ? "+" : ""}${s.liveChange}%)`)
    .join(" | ");

  const holdingsSummary = enriched.map(h =>
    `${h.symbol}: ${h.qty}sh@$${h.avgPrice} avg, now $${h.currentPrice} (${h.gainLoss >= 0 ? "+" : ""}${h.gainLossPct}%), RSI:${h.rsi}, Sector:${h.sector}, P/E:${h.pe}x, Div:${h.divYield}%`
  ).join("\n");

  const userPrompt = `Optimize this JSE investment portfolio for maximum sustained growth.

PORTFOLIO: Total Value $${totalValue.toFixed(2)} JMD | Cost $${totalCost.toFixed(2)} JMD | Return ${totalReturn}%
Sector exposure: ${sectorAlloc}

HOLDINGS:
${holdingsSummary}

OTHER JSE STOCKS NOT YET HELD:
${otherStocks}

Provide specific, data-driven portfolio optimization. Rank actions by priority.`;

  const systemPrompt = `You are a top Jamaica Stock Exchange portfolio optimizer. You MUST respond with ONLY valid JSON:
{
  "portfolioScore": 7,
  "healthSummary": "2-3 sentence assessment",
  "strengths": ["strength 1"],
  "weaknesses": ["weakness 1"],
  "actions": [{"type":"INCREASE|DECREASE|EXIT|ADD|HOLD","symbol":"SYM","name":"Name","priority":"HIGH|MEDIUM|LOW","reasoning":"reason","suggestedAction":"action"}],
  "riskAssessment": "risk summary",
  "targetReturn": "+8% to +15%",
  "diversificationScore": 6,
  "rebalancingPlan": "instructions"
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(jsonStr);
      res.json({ optimization: parsed, structured: true, metrics: { totalValue, totalCost, totalGainLoss, totalReturn, sectorMap, holdings: enriched } });
    } catch {
      res.json({ optimization: raw, structured: false });
    }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return res.status(401).json({ error: "Invalid API key" });
    if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Rate limit reached" });
    res.status(500).json({ error: "Portfolio optimization failed" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🇯🇲 JSE Live Dashboard v2.0 running on http://localhost:${PORT}\n`);
  console.log(`  API Routes:`);
  console.log(`  GET  /api/stocks              — all stocks`);
  console.log(`  GET  /api/stocks/:symbol      — stock detail + markdown`);
  console.log(`  GET  /api/research/:symbol    — Yahoo Finance data`);
  console.log(`  GET  /api/market-overview     — market summary`);
  console.log(`  GET  /api/stream/prices       — SSE real-time prices`);
  console.log(`  GET  /api/sectors             — sector performance`);
  console.log(`  GET  /api/news                — market news`);
  console.log(`  POST /api/screener            — stock screener`);
  console.log(`  POST /api/compare             — stock comparison`);
  console.log(`  POST /analyze                 — AI stock analysis`);
  console.log(`  POST /api/chat                — AI chat assistant`);
  console.log(`  POST /api/financial-plan      — AI financial planner`);
  console.log(`  POST /api/auto-invest         — AI autonomous investing`);
  console.log(`  POST /api/portfolio/optimize  — AI portfolio optimizer`);
  console.log(`  POST /api/auth/signup         — user registration`);
  console.log(`  POST /api/auth/login          — user login`);
  console.log(`  GET  /api/auth/me             — user profile`);
  console.log(`  GET  /api/user/portfolio      — user portfolio`);
  console.log(`  GET  /api/user/watchlist      — user watchlist`);
  console.log(`  GET  /api/user/goals          — financial goals`);
  console.log(`  PUT  /api/user/risk-profile   — risk profile\n`);
});
