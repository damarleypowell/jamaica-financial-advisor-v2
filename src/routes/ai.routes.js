const { Router } = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const config = require("../config/env");
const rateLimit = require("../middleware/rateLimit");
const { authMiddleware } = require("../middleware/auth");
const marketService = require("../services/market.service");
const analytics = require("../services/analytics.service");
const { fetchAllNews } = require("../../news-scraper");

const router = Router();

const client = new Anthropic({ apiKey: config.anthropicApiKey });
const VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // Daniel — deep, clear, professional British voice

// ══════════════════════════════════════════════════════════════════════════════
// ── AI Chat ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post("/api/chat", rateLimit(60000, 20), async (req, res) => {
  const { messages, context } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: "Messages array required" });

  const topGainers = [...marketService.livePrices]
    .sort((a, b) => b.liveChange - a.liveChange)
    .slice(0, 5);
  const topLosers = [...marketService.livePrices]
    .sort((a, b) => a.liveChange - b.liveChange)
    .slice(0, 5);
  const marketContext = `
Current JSE Market Data (live):
Top Gainers: ${topGainers.map((s) => `${s.symbol}(+${s.liveChange}%,$${s.livePrice})`).join(", ")}
Top Losers: ${topLosers.map((s) => `${s.symbol}(${s.liveChange}%,$${s.livePrice})`).join(", ")}
Total Stocks: ${marketService.livePrices.length}
${context ? `\nUser Context: ${context}` : ""}`;

  const systemPrompt = `You are Gotham Financial Advisor, a friendly and knowledgeable financial assistant. You help users understand investing, financial concepts, and the Jamaican stock market.

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
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
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
// ── AI Financial Planner ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post("/api/financial-plan", rateLimit(60000, 5), async (req, res) => {
  const {
    goals,
    riskTolerance,
    currentSavings,
    monthlyContribution,
    timeHorizon,
    portfolio,
  } = req.body;

  const marketData = marketService.livePrices
    .map(
      (s) =>
        `${s.symbol}(${s.sector},P/E:${s.pe}x,Div:${s.divYield}%,$${s.livePrice},${s.liveChange >= 0 ? "+" : ""}${s.liveChange}%)`
    )
    .join(" | ");

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
      system:
        "You are an expert Jamaican financial planner. Create detailed, actionable investment plans based on JSE stocks. Always respond with valid JSON only.",
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
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
      return res
        .status(401)
        .json({ error: "AI service authentication failed" });
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({
        error: "Rate limit reached. Please wait a moment and try again.",
      });
    res
      .status(500)
      .json({ error: "Financial planning failed. Please try again." });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Auto-Invest AI ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post("/api/auto-invest", rateLimit(60000, 3), async (req, res) => {
  const { holdings, goals, riskTolerance, timeHorizon } = req.body;
  if (!holdings || !Array.isArray(holdings))
    return res.status(400).json({ error: "Holdings array required" });

  const enriched = holdings
    .map((h) => {
      const stock = marketService.livePrices.find(
        (s) => s.symbol === h.symbol
      );
      if (!stock) return null;
      const hist = marketService.priceHistory[h.symbol] || [];
      const prices = hist.slice(-30);
      const rsi = marketService.calculateRSI(prices);
      return {
        symbol: h.symbol,
        name: stock.name,
        qty: h.qty,
        avgPrice: h.avgPrice,
        currentPrice: stock.livePrice,
        currentValue: +(stock.livePrice * h.qty).toFixed(2),
        costBasis: +(h.avgPrice * h.qty).toFixed(2),
        sector: stock.sector,
        pe: stock.pe,
        divYield: stock.divYield,
        change: stock.liveChange,
        rsi,
        marketCap: stock.marketCap,
      };
    })
    .filter(Boolean);

  const totalValue = enriched.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = enriched.reduce((s, h) => s + h.costBasis, 0);

  const owned = new Set(enriched.map((h) => h.symbol));
  const otherStocks = marketService.livePrices
    .filter((s) => !owned.has(s.symbol))
    .map((s) => {
      const rsi = marketService.calculateRSI(
        (marketService.priceHistory[s.symbol] || []).slice(-30)
      );
      return `${s.symbol}(${s.sector},P/E:${s.pe}x,Yield:${s.divYield}%,Change:${s.liveChange >= 0 ? "+" : ""}${s.liveChange}%,RSI:${rsi})`;
    })
    .join(" | ");

  const prompt = `You are an autonomous AI portfolio manager for the Jamaica Stock Exchange. Your job is to make SPECIFIC trade decisions to optimize this portfolio toward the investor's goals.

INVESTOR PROFILE:
- Goal: ${goals || "Maximum sustainable growth"}
- Risk Tolerance: ${riskTolerance || "Moderate"}
- Time Horizon: ${timeHorizon || "5 years"}
- Portfolio Value: $${totalValue.toFixed(2)} JMD (Cost: $${totalCost.toFixed(2)})

CURRENT HOLDINGS:
${enriched.map((h) => `${h.symbol}: ${h.qty}sh@$${h.avgPrice.toFixed(2)}, now $${h.currentPrice.toFixed(2)} (${(((h.currentValue - h.costBasis) / h.costBasis) * 100).toFixed(1)}%), RSI:${h.rsi}, ${h.sector}`).join("\n")}

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
      system:
        "You are an expert autonomous JSE portfolio manager. Make precise, data-driven trade decisions. Respond with valid JSON only.",
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(jsonStr);
      res.json({
        result: parsed,
        structured: true,
        metrics: { totalValue, totalCost, holdings: enriched },
      });
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
// ── AI Stock Analysis ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

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

router.post("/analyze", rateLimit(60000, 10), async (req, res) => {
  const { user_input, experience_level } = req.body;
  if (!user_input || !experience_level)
    return res.status(400).json({ error: "Missing required fields" });

  const validLevels = ["Beginner", "Intermediate", "Advanced"];
  if (!validLevels.includes(experience_level))
    return res.status(400).json({
      error: `experience_level must be one of: ${validLevels.join(", ")}`,
    });

  const inputUpper = user_input.toUpperCase();
  const detectedStock = marketService.livePrices.find(
    (s) =>
      inputUpper.includes(s.symbol) ||
      user_input
        .toLowerCase()
        .includes(
          s.name.toLowerCase().split(" ").slice(0, 2).join(" ")
        )
  );

  let enrichedInput = user_input;

  if (detectedStock) {
    const hist = marketService.priceHistory[detectedStock.symbol] || [];
    const rawPrices = hist.map(h => typeof h === "number" ? h : h.price || h);
    const prices = rawPrices.slice(-30);
    let simSection = "";
    if (prices.length > 1) {
      const high = Math.max(...prices).toFixed(2);
      const low = Math.min(...prices).toFixed(2);
      const avg = (
        prices.reduce((a, b) => a + b, 0) / prices.length
      ).toFixed(2);
      const rets = prices
        .slice(1)
        .map((p, i) => (p - prices[i]) / prices[i]);
      const vol = (
        Math.sqrt(rets.reduce((a, b) => a + b * b, 0) / rets.length) *
        Math.sqrt(252) *
        100
      ).toFixed(1);

      // ── Real Technical Indicators (from technicalindicators library) ──
      const allPrices = rawPrices.length > 0 ? rawPrices : prices;
      const indicators = analytics.calculateAllIndicators(allPrices, [], allPrices, allPrices, allPrices);
      const signalSummary = analytics.generateSignalSummary(indicators);
      const sr = analytics.findSupportResistance(allPrices);

      // Extract key indicator values
      const rsiVal = indicators.momentum?.rsi?.value || "N/A";
      const rsiSignal = indicators.momentum?.rsi?.signal || "neutral";
      const macdVal = indicators.trend?.macd?.value;
      const macdSignal = indicators.trend?.macd?.signal || "neutral";
      const sma20 = indicators.trend?.sma20?.value;
      const sma50 = indicators.trend?.sma50?.value;
      const ema12 = indicators.trend?.ema12?.value;
      const bb = indicators.volatility?.bollingerBands?.value;
      const stoch = indicators.momentum?.stochastic?.value;
      const adx = indicators.trend?.adx?.value;
      const cci = indicators.momentum?.cci?.value;
      const williamsR = indicators.momentum?.williamsR?.value;

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
Annualized Volatility: ${vol}%

--- TECHNICAL INDICATORS (computed via technicalindicators library) ---
RSI (14):              ${rsiVal} [${rsiSignal}]
MACD:                  ${macdVal ? `Line: ${macdVal.MACD?.toFixed(2)}, Signal: ${macdVal.signal?.toFixed(2)}, Histogram: ${macdVal.histogram?.toFixed(2)}` : "N/A"} [${macdSignal}]
SMA (20):              ${sma20 ? "$" + sma20.toFixed(2) : "N/A"} [${indicators.trend?.sma20?.signal}]
SMA (50):              ${sma50 ? "$" + sma50.toFixed(2) : "N/A"} [${indicators.trend?.sma50?.signal}]
EMA (12):              ${ema12 ? "$" + ema12.toFixed(2) : "N/A"} [${indicators.trend?.ema12?.signal}]
Bollinger Bands:       ${bb ? `Upper: $${bb.upper?.toFixed(2)}, Mid: $${bb.middle?.toFixed(2)}, Lower: $${bb.lower?.toFixed(2)}` : "N/A"} [${indicators.volatility?.bollingerBands?.signal}]
Stochastic (14,3):     ${stoch ? `%K: ${stoch.k?.toFixed(1)}, %D: ${stoch.d?.toFixed(1)}` : "N/A"} [${indicators.momentum?.stochastic?.signal}]
ADX (14):              ${adx ? `ADX: ${adx.adx?.toFixed(1)}, +DI: ${adx.pdi?.toFixed(1)}, -DI: ${adx.mdi?.toFixed(1)}` : "N/A"} [${indicators.trend?.adx?.signal}]
CCI (20):              ${cci || "N/A"} [${indicators.momentum?.cci?.signal}]
Williams %R (14):      ${williamsR || "N/A"} [${indicators.momentum?.williamsR?.signal}]
ATR (14):              ${indicators.volatility?.atr?.value || "N/A"}
OBV:                   ${indicators.volume?.obv?.value || "N/A"} [${indicators.volume?.obv?.signal}]
VWAP:                  ${indicators.volume?.vwap?.value || "N/A"} [${indicators.volume?.vwap?.signal}]

--- SIGNAL SUMMARY ---
Bullish: ${signalSummary.bullish}, Bearish: ${signalSummary.bearish}, Neutral: ${signalSummary.neutral}
Overall: ${signalSummary.recommendation} (${signalSummary.total} indicators analyzed)

--- SUPPORT & RESISTANCE ---
Support Levels:        ${sr.support.length > 0 ? sr.support.map(s => "$" + s).join(", ") : "N/A"}
Resistance Levels:     ${sr.resistance.length > 0 ? sr.resistance.map(r => "$" + r).join(", ") : "N/A"}

Last 15 prices:        ${rawPrices.slice(-15).map((p) => `$${Number(p).toFixed(2)}`).join(", ")}`;
    }

    let realSection = "";
    const cached = marketService.researchCache[detectedStock.symbol];
    if (
      cached &&
      Date.now() - cached.ts < marketService.RESEARCH_TTL &&
      cached.data.realData
    ) {
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

    enrichedInput +=
      simSection +
      realSection +
      "\n--- Base your entire analysis on this data ---";
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPTS[experience_level],
      messages: [{ role: "user", content: enrichedInput }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    let parsed;
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!jsonStr) throw new Error("no JSON");
      parsed = JSON.parse(jsonStr);
      if (!parsed.company || !parsed.recommendation)
        throw new Error("incomplete");
    } catch {
      return res.json({
        analysis: raw,
        structured: false,
        symbol: detectedStock?.symbol || null,
        level: experience_level,
      });
    }
    res.json({
      analysis: parsed,
      structured: true,
      symbol: detectedStock?.symbol || null,
      level: experience_level,
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return res.status(401).json({ error: "Invalid API key" });
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Rate limit reached" });
    if (error instanceof Anthropic.APIError)
      return res
        .status(502)
        .json({ error: `Claude API error: ${error.message}` });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Text-to-Speech ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Convert text to speech-friendly format (TTS reads "$675 JMD" awkwardly)
function speechFriendly(raw) {
  return raw
    // "$1,234.56 JMD" → "1,234 point 56 Jamaican dollars"
    .replace(/\$\s*([\d,]+(?:\.\d+)?)\s*JMD/gi, '$1 Jamaican dollars')
    // "$1,234.56 USD" → "1,234 point 56 US dollars"
    .replace(/\$\s*([\d,]+(?:\.\d+)?)\s*USD/gi, '$1 US dollars')
    // "J$675" or "J$ 675" → "675 Jamaican dollars"
    .replace(/J\$\s*([\d,]+(?:\.\d+)?)/gi, '$1 Jamaican dollars')
    // "$675" standalone → "675 dollars"
    .replace(/\$([\d,]+(?:\.\d+)?)/g, '$1 dollars')
    // "JMD" standalone → "Jamaican dollars"
    .replace(/\bJMD\b/g, 'Jamaican dollars')
    // "USD" standalone → "US dollars"
    .replace(/\bUSD\b/g, 'US dollars')
    // Clean up markdown artifacts that TTS reads literally
    .replace(/[*#_`]/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

router.post("/api/speak", rateLimit(60000, 10), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  if (
    !config.elevenLabsApiKey ||
    config.elevenLabsApiKey === "your_elevenlabs_api_key_here"
  ) {
    return res
      .status(503)
      .json({ error: "ElevenLabs API key not configured" });
  }

  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": config.elevenLabsApiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: speechFriendly(text),
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!elRes.ok) {
      await elRes.text();
      return res
        .status(502)
        .json({ error: "Text-to-speech service error. Please try again." });
    }

    const buffer = await elRes.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("ElevenLabs error:", e);
    res.status(500).json({ error: "TTS request failed" });
  }
});

// ── Voice Chat: Speech → AI → ElevenLabs Voice Response ─────────────────────

router.post("/api/voice-chat", rateLimit(60000, 10), async (req, res) => {
  const { text, context } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const topGainers = [...marketService.livePrices]
    .sort((a, b) => b.liveChange - a.liveChange)
    .slice(0, 5);
  const topLosers = [...marketService.livePrices]
    .sort((a, b) => a.liveChange - b.liveChange)
    .slice(0, 5);

  const inputUpper = text.toUpperCase();
  const detectedStock = marketService.livePrices.find(
    (s) =>
      inputUpper.includes(s.symbol) ||
      text
        .toLowerCase()
        .includes(
          s.name.toLowerCase().split(" ").slice(0, 2).join(" ")
        )
  );

  let stockContext = "";
  if (detectedStock) {
    const rsi = marketService.calculateRSI(
      (marketService.priceHistory[detectedStock.symbol] || []).slice(-30)
    );
    stockContext = `\n\nDETAILED DATA for ${detectedStock.symbol}:
Company: ${detectedStock.name} | Sector: ${detectedStock.sector}
Price: $${detectedStock.livePrice} JMD | Change: ${detectedStock.liveChange >= 0 ? "+" : ""}${detectedStock.liveChange}%
Volume: ${detectedStock.volume.toLocaleString()} | Market Cap: ${detectedStock.marketCap}
P/E: ${detectedStock.pe}x | Dividend Yield: ${detectedStock.divYield}% | RSI(14): ${rsi}`;
  }

  let newsContext = "";
  try {
    const news = await fetchAllNews();
    const relevant = detectedStock
      ? news
          .filter(
            (n) =>
              n.symbol === detectedStock.symbol ||
              n.title
                .toLowerCase()
                .includes(
                  detectedStock.name
                    .toLowerCase()
                    .split(" ")[0]
                    .toLowerCase()
                )
          )
          .slice(0, 3)
      : news.slice(0, 5);
    if (relevant.length > 0) {
      newsContext =
        "\n\nRECENT NEWS:\n" +
        relevant
          .map((n) => `- ${n.title} (${n.source}, ${n.sentiment})`)
          .join("\n");
    }
  } catch (_) {}

  const marketContext = `
Current JSE Market Data (live):
Top Gainers: ${topGainers.map((s) => `${s.symbol}(+${s.liveChange}%,$${s.livePrice})`).join(", ")}
Top Losers: ${topLosers.map((s) => `${s.symbol}(${s.liveChange}%,$${s.livePrice})`).join(", ")}
Total Stocks: ${marketService.livePrices.length}${stockContext}${newsContext}
${context ? `\nUser Context: ${context}` : ""}`;

  const systemPrompt = `You are Gotham Financial Advisor, a friendly and knowledgeable financial assistant speaking to the user via voice.

${marketContext}

IMPORTANT: Your response will be read aloud via text-to-speech. Keep it:
- Conversational and natural-sounding (as if speaking, not writing)
- Concise but informative (2-4 sentences for simple questions, up to 6 for detailed analysis)
- Avoid markdown, bullet points, or formatting — use plain spoken English
- Include specific numbers and data when available
- Reference actual JSE companies and market data
- Always mention it's not financial advice when giving recommendations
- Be warm, professional, and Jamaican-friendly in tone
- CRITICAL: Never write dollar signs or currency codes. Say "675 Jamaican dollars" not "$675 JMD" or "J$675". Say "50 US dollars" not "$50 USD". This is because text-to-speech reads symbols awkwardly.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    });

    const aiText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (
      !config.elevenLabsApiKey ||
      config.elevenLabsApiKey === "your_elevenlabs_api_key_here"
    ) {
      return res.json({ reply: aiText, audio: false });
    }

    try {
      const elRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": config.elevenLabsApiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: speechFriendly(aiText),
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (elRes.ok) {
        const buffer = await elRes.arrayBuffer();
        const audioBase64 = Buffer.from(buffer).toString("base64");
        return res.json({
          reply: aiText,
          audio: true,
          audioData: audioBase64,
        });
      } else {
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

// ══════════════════════════════════════════════════════════════════════════════
// ── Portfolio Optimizer (legacy) ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  "/api/portfolio/optimize",
  rateLimit(60000, 5),
  async (req, res) => {
    const { holdings } = req.body;
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0)
      return res.status(400).json({ error: "Holdings array required" });

    const enriched = holdings
      .map((h) => {
        const stock = marketService.livePrices.find(
          (s) => s.symbol === h.symbol
        );
        if (!stock) return null;
        const rsi = marketService.calculateRSI(
          (marketService.priceHistory[h.symbol] || []).slice(-30)
        );
        const currentValue = +(stock.livePrice * h.qty).toFixed(2);
        const costBasis = +(h.avgPrice * h.qty).toFixed(2);
        return {
          symbol: h.symbol,
          name: stock.name,
          qty: h.qty,
          avgPrice: h.avgPrice,
          currentPrice: stock.livePrice,
          currentValue,
          costBasis,
          gainLoss: +(currentValue - costBasis).toFixed(2),
          gainLossPct: +(
            ((currentValue - costBasis) / costBasis) *
            100
          ).toFixed(2),
          sector: stock.sector,
          pe: stock.pe,
          divYield: stock.divYield,
          change: stock.liveChange,
          rsi,
          marketCap: stock.marketCap,
        };
      })
      .filter(Boolean);

    if (!enriched.length)
      return res.status(400).json({ error: "No valid holdings" });

    const totalValue = enriched.reduce((s, h) => s + h.currentValue, 0);
    const totalCost = enriched.reduce((s, h) => s + h.costBasis, 0);
    const totalGainLoss = +(totalValue - totalCost).toFixed(2);
    const totalReturn = +(
      (totalGainLoss / totalCost) *
      100
    ).toFixed(2);

    const sectorMap = {};
    enriched.forEach((h) => {
      sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue;
    });
    const sectorAlloc = Object.entries(sectorMap)
      .map(
        ([s, v]) =>
          `${s}: ${((v / totalValue) * 100).toFixed(1)}%`
      )
      .join(", ");

    const owned = new Set(enriched.map((h) => h.symbol));
    const otherStocks = marketService.livePrices
      .filter((s) => !owned.has(s.symbol))
      .map(
        (s) =>
          `${s.symbol}(${s.sector},P/E:${s.pe}x,Yield:${s.divYield}%,Today:${s.liveChange >= 0 ? "+" : ""}${s.liveChange}%)`
      )
      .join(" | ");

    const holdingsSummary = enriched
      .map(
        (h) =>
          `${h.symbol}: ${h.qty}sh@$${h.avgPrice} avg, now $${h.currentPrice} (${h.gainLoss >= 0 ? "+" : ""}${h.gainLossPct}%), RSI:${h.rsi}, Sector:${h.sector}, P/E:${h.pe}x, Div:${h.divYield}%`
      )
      .join("\n");

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
      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      try {
        const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
        const parsed = JSON.parse(jsonStr);
        res.json({
          optimization: parsed,
          structured: true,
          metrics: {
            totalValue,
            totalCost,
            totalGainLoss,
            totalReturn,
            sectorMap,
            holdings: enriched,
          },
        });
      } catch {
        res.json({ optimization: raw, structured: false });
      }
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError)
        return res.status(401).json({ error: "Invalid API key" });
      if (error instanceof Anthropic.RateLimitError)
        return res.status(429).json({ error: "Rate limit reached" });
      res.status(500).json({ error: "Portfolio optimization failed" });
    }
  }
);

module.exports = router;
