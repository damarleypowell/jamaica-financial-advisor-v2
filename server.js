require("dotenv").config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");
const fs = require("fs");

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Yahoo Finance (optional — graceful fallback if not installed) ─────────────
let yahooFinance = null;
try {
  yahooFinance = require("yahoo-finance2").default;
  console.log("✅ yahoo-finance2 loaded — real market data enabled");
} catch (_) {
  console.warn("⚠️  yahoo-finance2 not installed. Run: npm install yahoo-finance2");
}

// ── Base Stock Data ──────────────────────────────────────────────────────────
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

// ── Live Price State ─────────────────────────────────────────────────────────
let livePrices = BASE_STOCKS.map(s => ({ ...s, livePrice: s.price, liveChange: s.change }));

// Generate simulated price history (last 60 ticks = ~2min each)
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

// ── Real-time Simulation ─────────────────────────────────────────────────────
function simulatePrices() {
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

// ── SSE Clients ──────────────────────────────────────────────────────────────
const sseClients = new Set();

setInterval(() => {
  simulatePrices();
  const payload = JSON.stringify(livePrices.map(s => ({
    symbol: s.symbol, price: s.livePrice, change: s.liveChange, volume: s.volume
  })));
  sseClients.forEach(client => { try { client.write(`data: ${payload}\n\n`); } catch(_){} });
}, 2000);

// ── Yahoo Finance Research Cache ──────────────────────────────────────────────
const researchCache = {};
const RESEARCH_TTL = 12 * 60 * 1000; // 12 minutes

// ── Research API ─────────────────────────────────────────────────────────────
app.get("/api/research/:symbol", async (req, res) => {
  if (!yahooFinance) {
    return res.status(503).json({ error: "Yahoo Finance not available", fallback: true });
  }

  const sym = req.params.symbol.toUpperCase();
  const stock = BASE_STOCKS.find(s => s.symbol === sym);
  if (!stock) return res.status(404).json({ error: "Symbol not found" });

  // Return cached
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
      pe:             q.summaryDetail?.trailingPE         ?? null,
      forwardPE:      q.summaryDetail?.forwardPE          ?? null,
      pb:             q.defaultKeyStatistics?.priceToBook ?? null,
      eps:            q.defaultKeyStatistics?.trailingEps ?? null,
      dividendYield:  q.summaryDetail?.dividendYield      ?? null,
      marketCap:      q.summaryDetail?.marketCap          ?? null,
      revenue:        q.financialData?.totalRevenue       ?? null,
      profitMargin:   q.financialData?.profitMargins      ?? null,
      roe:            q.financialData?.returnOnEquity     ?? null,
      currentRatio:   q.financialData?.currentRatio       ?? null,
      debtToEquity:   q.financialData?.debtToEquity       ?? null,
      targetPrice:    q.financialData?.targetMeanPrice    ?? null,
      recommendation: q.financialData?.recommendationKey?.toUpperCase() ?? null,
      revenueGrowth:  q.financialData?.revenueGrowth      ?? null,
      earningsGrowth: q.financialData?.earningsGrowth     ?? null,
      beta:           q.defaultKeyStatistics?.beta        ?? null,
      enterpriseValue:q.defaultKeyStatistics?.enterpriseValue ?? null,
      evToEbitda:     q.defaultKeyStatistics?.enterpriseToEbitda ?? null,
    } : null;

    const candles = rawHist
      .filter(b => b.open > 0 && b.close > 0 && b.high > 0 && b.low > 0)
      .map(b => ({
        time:   Math.floor(new Date(b.date).getTime() / 1000),
        open:   +b.open.toFixed(2),
        high:   +b.high.toFixed(2),
        low:    +b.low.toFixed(2),
        close:  +b.close.toFixed(2),
        volume: b.volume || 0,
      }));

    // Derive closes array for technical calculations
    const closes = candles.map(c => c.close);

    // RSI(14)
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

    // Annualized volatility
    let annVol = null;
    if (closes.length >= 20) {
      const rets = closes.slice(1).map((p, i) => Math.log(p / closes[i]));
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
      annVol = +(Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(1);
    }

    // 52-week high/low from candles
    const allHighs  = candles.map(c => c.high);
    const allLows   = candles.map(c => c.low);
    const high90    = allHighs.length ? +Math.max(...allHighs).toFixed(2) : null;
    const low90     = allLows.length  ? +Math.min(...allLows).toFixed(2)  : null;
    const avgClose  = closes.length   ? +(closes.reduce((a, b) => a + b, 0) / closes.length).toFixed(2) : null;

    const data = {
      symbol: sym, realData: true,
      fundamentals, candles,
      derived: { rsi14, annVol, high90, low90, avgClose, candleCount: candles.length },
    };

    researchCache[sym] = { data, ts: Date.now() };
    res.json(data);
  } catch (e) {
    console.warn(`Yahoo Finance error [${sym}]:`, e.message?.slice(0, 120));
    res.status(502).json({ error: "Research data temporarily unavailable", fallback: true });
  }
});

// ── API Routes ───────────────────────────────────────────────────────────────

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
  const losers  = livePrices.filter(s => s.liveChange < 0).length;
  const sorted  = [...livePrices].sort((a, b) => b.liveChange - a.liveChange);
  const topGainer = sorted[0];
  const topLoser  = sorted[sorted.length - 1];
  const totalVolume = livePrices.reduce((sum, s) => sum + s.volume, 0);

  res.json({
    gainers, losers, unchanged: livePrices.length - gainers - losers,
    topGainer: { symbol: topGainer.symbol, change: topGainer.liveChange },
    topLoser:  { symbol: topLoser.symbol,  change: topLoser.liveChange  },
    totalVolume, totalStocks: livePrices.length
  });
});

app.get("/api/history/:symbol", (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  const hist = priceHistory[sym];
  if (!hist) return res.status(404).json({ error: "Not found" });
  res.json({ symbol: sym, history: hist });
});

// ── ElevenLabs TTS (Adam voice) ──────────────────────────────────────────────
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

// ── AI Analysis ──────────────────────────────────────────────────────────────
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
Discuss company fundamentals, sector performance, and JSE market comparisons.
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
riskScore: integer 1-10 from actual data. priceTarget: realistic 12-month JMD price target based on the data.`,

  Advanced: `You are an expert Jamaica Stock Exchange (JSE) quantitative analyst for sophisticated investors.
Provide deep technical analysis: valuation multiples (P/E, P/B, EV/EBITDA), technical indicators, DCF, beta/volatility, liquidity, risk-adjusted returns, sector correlation.
Reference JMD/USD dynamics, BOJ policy, and macroeconomic factors.
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
  "hedgeStrategy": "Brief hedging or position-sizing recommendation"
}
riskScore: integer 1-10. rsiEstimate: integer 1-100. momentumScore: integer 1-10. All numeric values derived from the real data provided. fairValueEstimate and support/resistance in JMD.`,
};

app.post("/analyze", async (req, res) => {
  const { user_input, experience_level } = req.body;
  if (!user_input || !experience_level)
    return res.status(400).json({ error: "Missing required fields: user_input, experience_level" });

  const validLevels = ["Beginner", "Intermediate", "Advanced"];
  if (!validLevels.includes(experience_level))
    return res.status(400).json({ error: `experience_level must be one of: ${validLevels.join(", ")}` });

  // ── Detect stock ────────────────────────────────────────────────────────────
  const inputUpper = user_input.toUpperCase();
  const detectedStock = livePrices.find(s =>
    inputUpper.includes(s.symbol) ||
    user_input.toLowerCase().includes(s.name.toLowerCase().split(" ").slice(0, 2).join(" "))
  );

  let enrichedInput = user_input;

  if (detectedStock) {
    // ── Simulated price metrics ─────────────────────────────────────────────
    const hist   = priceHistory[detectedStock.symbol] || [];
    const prices = hist.slice(-30);
    let simSection = "";
    if (prices.length > 1) {
      const high = Math.max(...prices).toFixed(2);
      const low  = Math.min(...prices).toFixed(2);
      const avg  = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
      const rets = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
      const vol  = (Math.sqrt(rets.reduce((a, b) => a + b * b, 0) / rets.length) * Math.sqrt(252) * 100).toFixed(1);
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

    // ── Real Yahoo Finance data (if cached) ─────────────────────────────────
    let realSection = "";
    const cached = researchCache[detectedStock.symbol];
    if (cached && Date.now() - cached.ts < RESEARCH_TTL && cached.data.realData) {
      const { fundamentals: f, derived: d } = cached.data;
      if (f) {
        realSection = `

--- REAL YAHOO FINANCE FUNDAMENTALS (${detectedStock.symbol}.JM) ---
P/E (TTM):             ${f.pe    != null ? f.pe.toFixed(2)    + "x" : "N/A"}
Forward P/E:           ${f.forwardPE != null ? f.forwardPE.toFixed(2) + "x" : "N/A"}
Price/Book:            ${f.pb   != null ? f.pb.toFixed(2)    + "x" : "N/A"}
EPS (TTM):             ${f.eps  != null ? "$" + f.eps.toFixed(2) + " JMD" : "N/A"}
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
90-Day Low:            ${d.low90  != null ? "$" + d.low90  + " JMD" : "N/A"}
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

    const raw = response.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    let parsed;
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!jsonStr) throw new Error("no JSON object found");
      parsed = JSON.parse(jsonStr);
      if (!parsed.company || !parsed.recommendation) throw new Error("incomplete JSON");
    } catch (_) {
      console.warn("JSON parse failed, raw:", raw.slice(0, 200));
      return res.json({ analysis: raw, structured: false, symbol: detectedStock?.symbol || null, level: experience_level });
    }

    res.json({ analysis: parsed, structured: true, symbol: detectedStock?.symbol || null, level: experience_level });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return res.status(401).json({ error: "Invalid API key. Check your ANTHROPIC_API_KEY." });
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Rate limit reached. Please try again shortly." });
    if (error instanceof Anthropic.APIError)
      return res.status(502).json({ error: `Claude API error: ${error.message}` });
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Portfolio AI Optimizer ────────────────────────────────────────────────────
app.post("/api/portfolio/optimize", async (req, res) => {
  const { holdings } = req.body;
  if (!holdings || !Array.isArray(holdings) || holdings.length === 0)
    return res.status(400).json({ error: "Holdings array required" });

  const enriched = holdings.map(h => {
    const stock = livePrices.find(s => s.symbol === h.symbol);
    if (!stock) return null;
    const hist   = priceHistory[h.symbol] || [];
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
    const costBasis    = +(h.avgPrice * h.qty).toFixed(2);
    return {
      symbol: h.symbol, name: stock.name, qty: h.qty,
      avgPrice: h.avgPrice, currentPrice: stock.livePrice,
      currentValue, costBasis,
      gainLoss:    +(currentValue - costBasis).toFixed(2),
      gainLossPct: +((currentValue - costBasis) / costBasis * 100).toFixed(2),
      sector: stock.sector, pe: stock.pe, divYield: stock.divYield,
      change: stock.liveChange, rsi, marketCap: stock.marketCap,
    };
  }).filter(Boolean);

  if (!enriched.length) return res.status(400).json({ error: "No valid holdings found" });

  const totalValue    = enriched.reduce((s, h) => s + h.currentValue, 0);
  const totalCost     = enriched.reduce((s, h) => s + h.costBasis, 0);
  const totalGainLoss = +(totalValue - totalCost).toFixed(2);
  const totalReturn   = +((totalGainLoss / totalCost) * 100).toFixed(2);

  const sectorMap = {};
  enriched.forEach(h => { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue; });
  const sectorAlloc = Object.entries(sectorMap)
    .map(([s, v]) => `${s}: ${((v / totalValue) * 100).toFixed(1)}%`).join(", ");

  const owned = new Set(enriched.map(h => h.symbol));
  const otherStocks = livePrices.filter(s => !owned.has(s.symbol))
    .map(s => `${s.symbol}(${s.sector},P/E:${s.pe}x,Yield:${s.divYield}%,Today:${s.liveChange >= 0 ? "+" : ""}${s.liveChange}%)`)
    .join(" | ");

  const holdingsSummary = enriched.map(h =>
    `${h.symbol}: ${h.qty}sh@$${h.avgPrice} avg, now $${h.currentPrice} (${h.gainLoss >= 0 ? "+" : ""}${h.gainLossPct}%), RSI:${h.rsi}, Sector:${h.sector}, P/E:${h.pe}x, Div:${h.divYield}%`
  ).join("\n");

  const userPrompt = `Optimize this JSE investment portfolio for maximum sustained growth.

PORTFOLIO: Total Value $${totalValue.toFixed(2)} JMD | Cost $${totalCost.toFixed(2)} JMD | Return ${totalReturn}% ($${totalGainLoss >= 0 ? "+" : ""}${totalGainLoss} JMD)
Sector exposure: ${sectorAlloc}

HOLDINGS:
${holdingsSummary}

OTHER JSE STOCKS NOT YET HELD:
${otherStocks}

Provide specific, data-driven portfolio optimization to ensure consistent growth. Rank actions by priority.`;

  const systemPrompt = `You are a top Jamaica Stock Exchange portfolio optimizer. Analyze portfolios and return precise optimization recommendations. You MUST respond with ONLY valid JSON — no markdown, no backticks, no extra text.
Use exactly this structure:
{
  "portfolioScore": 7,
  "healthSummary": "2-3 sentence overall portfolio assessment",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "actions": [
    {"type":"INCREASE|DECREASE|EXIT|ADD|HOLD","symbol":"SYMBOL","name":"Company Name","priority":"HIGH|MEDIUM|LOW","reasoning":"specific data-based reason","suggestedAction":"e.g. Buy 200 more shares at market"}
  ],
  "riskAssessment": "Overall portfolio risk summary",
  "targetReturn": "Expected 12-month return range e.g. +8% to +15%",
  "diversificationScore": 6,
  "rebalancingPlan": "Concise step-by-step rebalancing instructions"
}
portfolioScore and diversificationScore: integers 1-10. All recommendations MUST be based on the live data provided.`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    let parsed;
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!jsonStr) throw new Error("no JSON");
      parsed = JSON.parse(jsonStr);
    } catch (_) {
      return res.json({ optimization: raw, structured: false });
    }
    res.json({
      optimization: parsed, structured: true,
      metrics: { totalValue, totalCost, totalGainLoss, totalReturn, sectorMap, holdings: enriched },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return res.status(401).json({ error: "Invalid API key" });
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Rate limit reached. Try again shortly." });
    if (error instanceof Anthropic.APIError)
      return res.status(502).json({ error: `Claude API error: ${error.message}` });
    res.status(500).json({ error: "Portfolio optimization failed" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`JSE Live Dashboard running on http://localhost:${PORT}`);
  console.log(`GET  /api/stocks              — all stocks`);
  console.log(`GET  /api/research/:symbol    — real Yahoo Finance data + OHLCV`);
  console.log(`GET  /api/stocks/:symbol      — stock detail + markdown`);
  console.log(`GET  /api/market-overview     — market summary`);
  console.log(`GET  /api/stream/prices       — SSE real-time prices`);
  console.log(`POST /analyze                 — AI stock analysis`);
  console.log(`POST /api/portfolio/optimize  — AI portfolio auto-tune`);
});
