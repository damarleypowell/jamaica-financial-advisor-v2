require("dotenv").config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

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

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
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
    if (sig !== expected) return null;
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

// ══════════════════════════════════════════════════════════════════════════════
// ── BASE STOCK DATA ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const BASE_STOCKS = [
  { symbol:"NCBFG",   name:"NCB Financial Group",        price:142.50, change:1.68,  volume:1245670, marketCap:"$142.5B", sector:"Financial",    pe:12.4, divYield:2.8,  file:"NCBFG.md"   },
  { symbol:"SGJAM",   name:"Scotia Group Jamaica",        price:47.25,  change:-0.52, volume:654320,  marketCap:"$78.3B",  sector:"Banking",      pe:10.1, divYield:3.5,  file:"SGJAM.md"   },
  { symbol:"SFC",     name:"Sagicor Financial Corp",      price:72.30,  change:2.11,  volume:428900,  marketCap:"$65.4B",  sector:"Insurance",    pe:9.8,  divYield:4.1,  file:"SFC.md"     },
  { symbol:"GK",      name:"GraceKennedy Limited",        price:94.20,  change:1.25,  volume:538210,  marketCap:"$96.8B",  sector:"Conglomerate", pe:14.2, divYield:2.4,  file:"GK.md"      },
  { symbol:"JBGL",    name:"Jamaica Broilers Group",      price:38.50,  change:0.78,  volume:312450,  marketCap:"$42.8B",  sector:"Food",         pe:11.8, divYield:3.2,  file:"JBGL.md"    },
  { symbol:"BIL",     name:"Barita Investments",          price:84.60,  change:3.06,  volume:876320,  marketCap:"$124.8B", sector:"Financial",    pe:15.2, divYield:1.9,  file:"BIL.md"     },
  { symbol:"WISYNCO", name:"Wisynco Group",               price:22.35,  change:1.82,  volume:1562400, marketCap:"$52.4B",  sector:"Beverages",    pe:16.4, divYield:2.6,  file:"WISYNCO.md" },
  { symbol:"SEP",     name:"Seprod Limited",              price:52.80,  change:0.57,  volume:198650,  marketCap:"$38.6B",  sector:"Manufacturing",pe:13.6, divYield:2.1,  file:"SEP.md"     },
  { symbol:"CCC",     name:"Caribbean Cement Company",    price:61.50,  change:-0.81, volume:421850,  marketCap:"$24.1B",  sector:"Construction", pe:10.5, divYield:3.8,  file:"CCC.md"     },
  { symbol:"AFS",     name:"Access Financial Services",   price:42.70,  change:1.19,  volume:256780,  marketCap:"$15.2B",  sector:"Microfinance", pe:12.4, divYield:4.8,  file:"AFS.md"     },
  { symbol:"PROVEN",  name:"Proven Investments",          price:28.40,  change:3.08,  volume:682400,  marketCap:"$42.6B",  sector:"Financial",    pe:13.2, divYield:3.6,  file:"PROVEN.md"  },
  { symbol:"CPJ",     name:"Caribbean Producers Jamaica", price:7.45,   change:2.76,  volume:3812400, marketCap:"$9.86B",  sector:"Food",         pe:14.6, divYield:2.8,  file:"CPJ.md"     },
  { symbol:"MEEG",    name:"Main Event Entertainment",    price:11.20,  change:4.67,  volume:5628400, marketCap:"$4.93B",  sector:"Entertainment",pe:22.4, divYield:0.9,  file:"MEEG.md"    },
  { symbol:"KEX",     name:"Knutsford Express",           price:16.50,  change:0.61,  volume:892100,  marketCap:"$6.08B",  sector:"Transport",    pe:17.2, divYield:1.4,  file:"KEX.md"     },
  { symbol:"ICREATE", name:"iCreate Limited",             price:4.75,   change:5.56,  volume:8924600, marketCap:"$5.70B",  sector:"Technology",   pe:42.0, divYield:0.0,  file:"ICREATE.md" },
  { symbol:"PBS",     name:"Productive Business Solutions",price:5.20,  change:1.96,  volume:2184500, marketCap:"$14.6B",  sector:"Technology",   pe:19.6, divYield:1.2,  file:"PBS.md"     },
  { symbol:"FOSRICH", name:"Fosrich Company",             price:8.60,   change:4.24,  volume:4128200, marketCap:"$8.60B",  sector:"Distribution", pe:20.5, divYield:1.4,  file:"FOSRICH.md" },
  { symbol:"LUMBER",  name:"Lumber Depot",                price:7.20,   change:2.27,  volume:3124800, marketCap:"$5.76B",  sector:"Retail",       pe:15.8, divYield:1.7,  file:"LUMBER.md"  },
  { symbol:"ECL",     name:"Express Catering Limited",    price:7.85,   change:1.29,  volume:2840200, marketCap:"$10.1B",  sector:"Food Service", pe:21.8, divYield:1.1,  file:"ECL.md"     },
  { symbol:"MPC",     name:"Mailpac Group",               price:6.95,   change:2.21,  volume:3482600, marketCap:"$6.95B",  sector:"Logistics",    pe:25.4, divYield:0.7,  file:"MPC.md"     },
  { symbol:"SCI",     name:"Sygnus Credit Investments",   price:17.90,  change:0.56,  volume:1428600, marketCap:"$22.4B",  sector:"Financial",    pe:13.8, divYield:5.2,  file:"SCI.md"     },
  { symbol:"DERRIMON",name:"Derrimon Trading Company",    price:3.45,   change:2.37,  volume:7284800, marketCap:"$10.35B", sector:"Distribution", pe:12.4, divYield:1.7,  file:"DERRIMON.md"},
  { symbol:"LASC",    name:"Lasco Financial Services",    price:5.85,   change:3.54,  volume:3218900, marketCap:"$7.02B",  sector:"Financial",    pe:18.9, divYield:1.8,  file:"LASC.md"    },
  { symbol:"LASD",    name:"Lasco Distributors",          price:5.65,   change:0.89,  volume:2614800, marketCap:"$8.47B",  sector:"Distribution", pe:16.2, divYield:2.8,  file:"LASD.md"    },
  { symbol:"INDIES",  name:"Indies Pharma Jamaica",       price:5.50,   change:2.23,  volume:3824800, marketCap:"$8.80B",  sector:"Healthcare",   pe:18.3, divYield:1.8,  file:"INDIES.md"  },
  { symbol:"MCGE",    name:"Margaritaville Caribbean",    price:9.80,   change:0.51,  volume:1684200, marketCap:"$7.84B",  sector:"Tourism",      pe:18.2, divYield:1.5,  file:"MCGE.md"    },
  { symbol:"BRG",     name:"Berger Paints Jamaica",       price:14.20,  change:0.00,  volume:684200,  marketCap:"$9.94B",  sector:"Manufacturing",pe:12.8, divYield:4.5,  file:"BRG.md"     },
  { symbol:"CAR",     name:"Carreras Group",              price:19.75,  change:-1.24, volume:892400,  marketCap:"$23.7B",  sector:"Manufacturing",pe:8.4,  divYield:9.2,  file:"CAR.md"     },
  { symbol:"MJE",     name:"Mayberry Investments",        price:8.45,   change:-2.08, volume:4218600, marketCap:"$19.4B",  sector:"Financial",    pe:11.8, divYield:3.6,  file:"MJE.md"     },
  { symbol:"PULS",    name:"Pulse Investments",           price:3.80,   change:-1.30, volume:6218400, marketCap:"$3.04B",  sector:"Media",        pe:19.0, divYield:0.0,  file:"PULS.md"    },
];

// ── Live Price State ────────────────────────────────────────────────────────
let livePrices = BASE_STOCKS.map(s => ({ ...s, livePrice: s.price, liveChange: s.change }));

const priceHistory = {};
BASE_STOCKS.forEach(s => {
  const hist = [];
  let p = s.price * 0.95;
  for (let i = 0; i < 60; i++) {
    p = p * (1 + (Math.random() - 0.48) * 0.004);
    hist.push(Math.round(p * 100) / 100);
  }
  priceHistory[s.symbol] = hist;
});

// ── Yahoo Finance Real Data Fetching ────────────────────────────────────────
// Maps local symbols to Yahoo Finance tickers (JSE stocks use .JM suffix)
const YAHOO_SYMBOL_MAP = {};
BASE_STOCKS.forEach(s => {
  YAHOO_SYMBOL_MAP[s.symbol] = s.symbol + ".JM";
});

let lastYahooFetch = 0;
const YAHOO_FETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchRealPrices() {
  if (!yahooFinance) {
    console.log("⚠️  yahoo-finance2 not available — using simulated prices");
    return;
  }

  console.log("📡 Fetching real prices from Yahoo Finance...");
  let successCount = 0;
  let failCount = 0;

  // Fetch in small batches with delays to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < BASE_STOCKS.length; i += batchSize) {
    const batch = BASE_STOCKS.slice(i, i + batchSize);
    const promises = batch.map(async (stock) => {
      const yahooSymbol = YAHOO_SYMBOL_MAP[stock.symbol];
      try {
        const quote = await yahooFinance.quote(yahooSymbol);
        if (quote && quote.regularMarketPrice) {
          const realPrice = quote.regularMarketPrice;
          const realChange = quote.regularMarketChangePercent || 0;
          const realVolume = quote.regularMarketVolume || stock.volume;
          const realMarketCap = quote.marketCap ? formatMarketCap(quote.marketCap) : stock.marketCap;
          const realPE = quote.trailingPE || quote.forwardPE || stock.pe;
          const realDivYield = quote.dividendYield ? +(quote.dividendYield * 100).toFixed(2) : stock.divYield;

          const liveStock = livePrices.find(s => s.symbol === stock.symbol);
          if (liveStock) {
            liveStock.price = realPrice;
            liveStock.livePrice = realPrice;
            liveStock.liveChange = +realChange.toFixed(2);
            liveStock.volume = realVolume;
            liveStock.marketCap = realMarketCap;
            liveStock.pe = +realPE.toFixed(1);
            liveStock.divYield = realDivYield;
            priceHistory[stock.symbol].push(realPrice);
            if (priceHistory[stock.symbol].length > 120) priceHistory[stock.symbol].shift();
          }
          successCount++;
        }
      } catch (e) {
        failCount++;
      }
    });
    await Promise.all(promises);
    // Wait between batches to avoid rate limiting
    if (i + batchSize < BASE_STOCKS.length) await sleep(2000);
  }

  lastYahooFetch = Date.now();
  console.log(`✅ Yahoo Finance: ${successCount} stocks updated, ${failCount} failed (of ${BASE_STOCKS.length})`);
  if (failCount > 0 && successCount === 0) {
    console.log("⚠️  All Yahoo requests failed — likely rate limited. Will retry in 5 minutes. Using simulated data in the meantime.");
  }
}

function formatMarketCap(n) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n}`;
}

// Fetch real prices on startup and every 5 minutes
fetchRealPrices();
setInterval(fetchRealPrices, YAHOO_FETCH_INTERVAL);

function simulatePrices() {
  // Between Yahoo fetches, add small random micro-movements for real-time feel
  livePrices = livePrices.map(stock => {
    const vol = 0.0015 + Math.random() * 0.002;
    const drift = stock.liveChange > 0 ? 0.0001 : -0.0001;
    const delta = drift + (Math.random() - 0.5) * vol;
    const newPrice = Math.max(+(stock.livePrice * (1 + delta)).toFixed(2), 0.01);
    const pctChange = +((newPrice - stock.price) / stock.price * 100).toFixed(2);
    priceHistory[stock.symbol].push(newPrice);
    if (priceHistory[stock.symbol].length > 120) priceHistory[stock.symbol].shift();
    return { ...stock, livePrice: newPrice, liveChange: pctChange };
  });
}

// ── SSE ─────────────────────────────────────────────────────────────────────
const sseClients = new Set();
setInterval(() => {
  simulatePrices();
  const payload = JSON.stringify(livePrices.map(s => ({
    symbol: s.symbol, price: s.livePrice, change: s.liveChange, volume: s.volume
  })));
  sseClients.forEach(client => { try { client.write(`data: ${payload}\n\n`); } catch(_){} });
}, 2000);

// ── Research Cache ──────────────────────────────────────────────────────────
const researchCache = {};
const RESEARCH_TTL = 12 * 60 * 1000;

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
      model: "claude-opus-4-6",
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
      model: "claude-opus-4-6",
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
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Rate limit reached" });
    res.status(500).json({ error: "Planning failed" });
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
      model: "claude-opus-4-6",
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
// ── NEWS & MARKET INSIGHTS (simulated) ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const NEWS_HEADLINES = [
  { id: 1, title: "NCB Financial Group Reports Record Q3 Earnings", source: "Jamaica Gleaner", sector: "Financial", symbol: "NCBFG", time: "2h ago", sentiment: "positive" },
  { id: 2, title: "Scotia Group Jamaica Announces Dividend Increase", source: "Jamaica Observer", sector: "Banking", symbol: "SGJAM", time: "4h ago", sentiment: "positive" },
  { id: 3, title: "GraceKennedy Expands Into New Caribbean Markets", source: "Loop Jamaica", sector: "Conglomerate", symbol: "GK", time: "6h ago", sentiment: "positive" },
  { id: 4, title: "BOJ Holds Policy Rate Steady at 7%", source: "Jamaica Gleaner", sector: "Market", symbol: null, time: "8h ago", sentiment: "neutral" },
  { id: 5, title: "Wisynco Group Partners with Major US Distributor", source: "Jamaica Observer", sector: "Beverages", symbol: "WISYNCO", time: "10h ago", sentiment: "positive" },
  { id: 6, title: "Caribbean Cement Faces Rising Input Costs", source: "Loop Jamaica", sector: "Construction", symbol: "CCC", time: "12h ago", sentiment: "negative" },
  { id: 7, title: "Barita Investments Launches New Wealth Management Product", source: "Jamaica Gleaner", sector: "Financial", symbol: "BIL", time: "1d ago", sentiment: "positive" },
  { id: 8, title: "Sagicor Reports Strong Insurance Premium Growth", source: "Jamaica Observer", sector: "Insurance", symbol: "SFC", time: "1d ago", sentiment: "positive" },
  { id: 9, title: "JSE Main Index Hits 52-Week High", source: "Loop Jamaica", sector: "Market", symbol: null, time: "1d ago", sentiment: "positive" },
  { id: 10, title: "iCreate Limited Secures Major Government Contract", source: "Jamaica Gleaner", sector: "Technology", symbol: "ICREATE", time: "2d ago", sentiment: "positive" },
  { id: 11, title: "Jamaican Dollar Strengthens Against USD", source: "Jamaica Observer", sector: "Economy", symbol: null, time: "2d ago", sentiment: "positive" },
  { id: 12, title: "Tourism Sector Recovery Boosts Margaritaville Revenue", source: "Loop Jamaica", sector: "Tourism", symbol: "MCGE", time: "2d ago", sentiment: "positive" },
];

app.get("/api/news", (req, res) => {
  const { sector, symbol } = req.query;
  let news = [...NEWS_HEADLINES];
  if (sector) news = news.filter(n => n.sector === sector);
  if (symbol) news = news.filter(n => n.symbol === symbol);
  res.json(news);
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
  const stock = BASE_STOCKS.find(s => s.symbol === sym);
  if (!stock) return res.status(404).json({ error: "Symbol not found" });

  if (researchCache[sym] && Date.now() - researchCache[sym].ts < RESEARCH_TTL) {
    return res.json(researchCache[sym].data);
  }

  const yfSym = `${sym}.JM`;
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

  const mdPath = path.join(__dirname, "public", "data", "stocks", stock.file);
  let markdown = `# ${stock.name} (${stock.symbol})\n\nNo detailed data available.`;
  try { markdown = fs.readFileSync(mdPath, "utf8"); } catch (_) {}

  res.json({
    symbol: stock.symbol, name: stock.name, price: stock.livePrice, change: stock.liveChange,
    volume: stock.volume, marketCap: stock.marketCap, sector: stock.sector,
    pe: stock.pe, divYield: stock.divYield, markdown,
    history: priceHistory[stock.symbol] || []
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
const ADAM_VOICE_ID = "YSHdItX2XGJ5fnOyjbbq";

app.post("/api/speak", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ADAM_VOICE_ID}`,
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
      const err = await elRes.text();
      return res.status(502).json({ error: `ElevenLabs error: ${err}` });
    }

    const buffer = await elRes.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("ElevenLabs error:", e);
    res.status(500).json({ error: "TTS request failed" });
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
      model: "claude-opus-4-6",
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
      model: "claude-opus-4-6",
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
