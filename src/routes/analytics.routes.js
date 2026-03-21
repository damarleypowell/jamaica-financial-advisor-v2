/**
 * Analytics API Routes
 * Exposes technical analysis, portfolio optimization, ML predictions,
 * financial planning, and backtesting to the frontend.
 *
 * Uses local Node.js analytics for fast computations and
 * proxies to Python FastAPI for heavy ML/optimization tasks.
 */

"use strict";

const express = require("express");
const router = express.Router();

const analytics = require("../services/analytics.service");
const pythonBridge = require("../services/python-bridge.service");
const marketService = require("../services/market.service");

// ─── Technical Analysis ──────────────────────────────────

/**
 * GET /api/analytics/technical/:symbol
 * Full technical indicator suite for a stock
 */
router.get("/technical/:symbol", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const stock = marketService.livePrices.find(s => s.symbol === symbol);

  if (!stock) {
    return res.status(404).json({ error: `Stock ${symbol} not found` });
  }

  const history = marketService.priceHistory[symbol] || [];
  if (history.length < 5) {
    return res.status(400).json({ error: "Insufficient price history for analysis" });
  }

  const prices = history.map(h => h.price);
  const volumes = history.map(h => h.volume || 0);

  // Local Node.js computation (fast)
  const indicators = analytics.calculateAllIndicators(prices, volumes, prices, prices, prices);
  const summary = analytics.generateSignalSummary(indicators);
  const supportResistance = analytics.findSupportResistance(prices);

  res.json({
    symbol,
    name: stock.name,
    currentPrice: stock.price,
    dataPoints: prices.length,
    indicators,
    summary,
    supportResistance,
  });
});

/**
 * GET /api/analytics/technical/:symbol/advanced
 * Advanced analysis via Python service (ML patterns, clustering)
 */
router.get("/technical/:symbol/advanced", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const history = marketService.priceHistory[symbol] || [];

  if (history.length < 20) {
    return res.status(400).json({ error: "Need at least 20 data points for advanced analysis" });
  }

  const prices = history.map(h => h.price);
  const volumes = history.map(h => h.volume || 0);

  const [techResult, srResult, patternResult] = await Promise.all([
    pythonBridge.fullTechnicalAnalysis(symbol, prices, volumes, prices, prices),
    pythonBridge.detectSupportResistance(symbol, prices),
    pythonBridge.detectPatterns(symbol, prices, prices, prices),
  ]);

  res.json({
    symbol,
    dataPoints: prices.length,
    technicalAnalysis: techResult,
    supportResistance: srResult,
    patterns: patternResult,
    pythonAvailable: !techResult.fallback,
  });
});

/**
 * POST /api/analytics/indicator
 * Calculate a single indicator with custom parameters
 * Body: { name: "rsi", params: { values: [...], period: 14 } }
 */
router.post("/indicator", (req, res) => {
  const { name, params } = req.body;
  if (!name || !params) {
    return res.status(400).json({ error: "name and params required" });
  }

  try {
    const result = analytics.calculateIndicator(name, params);
    res.json({ name, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Portfolio Analysis ──────────────────────────────────

/**
 * POST /api/analytics/portfolio
 * Portfolio metrics and risk analysis
 * Body: { positions: [{symbol, shares, avgCost, currentPrice}] }
 */
router.post("/portfolio", (req, res) => {
  const { positions } = req.body;
  if (!Array.isArray(positions) || positions.length === 0) {
    return res.status(400).json({ error: "positions array required" });
  }

  // Enrich positions with live prices if currentPrice not provided
  const enriched = positions.map(p => {
    if (!p.currentPrice) {
      const stock = marketService.livePrices.find(s => s.symbol === p.symbol);
      if (stock) p.currentPrice = stock.price;
    }
    return p;
  });

  const metrics = analytics.calculatePortfolioMetrics(enriched);

  // Calculate risk metrics from price history
  const allReturns = [];
  for (const pos of enriched) {
    const history = marketService.priceHistory[pos.symbol] || [];
    if (history.length >= 2) {
      for (let i = 1; i < history.length; i++) {
        allReturns.push((history[i].price - history[i - 1].price) / history[i - 1].price);
      }
    }
  }

  const risk = analytics.calculateRiskMetrics(allReturns);

  res.json({ metrics, risk });
});

/**
 * POST /api/analytics/portfolio/optimize
 * Markowitz optimization via Python service
 * Body: { positions: [...], riskTolerance: 5 }
 */
router.post("/portfolio/optimize", async (req, res) => {
  const { positions, riskTolerance = 5 } = req.body;
  if (!Array.isArray(positions) || positions.length === 0) {
    return res.status(400).json({ error: "positions array required" });
  }

  // Build price histories for each position
  const priceHistories = {};
  for (const pos of positions) {
    const history = marketService.priceHistory[pos.symbol] || [];
    priceHistories[pos.symbol] = history.map(h => h.price);
  }

  const result = await pythonBridge.optimizePortfolio(positions, riskTolerance, priceHistories);

  if (result.fallback) {
    // Fallback: return basic Node.js metrics
    const enriched = positions.map(p => {
      if (!p.currentPrice) {
        const stock = marketService.livePrices.find(s => s.symbol === p.symbol);
        if (stock) p.currentPrice = stock.price;
      }
      return p;
    });
    const metrics = analytics.calculatePortfolioMetrics(enriched);
    return res.json({
      ...metrics,
      note: "Advanced optimization unavailable — showing basic metrics. Start Python service for Markowitz optimization.",
    });
  }

  res.json(result);
});

/**
 * POST /api/analytics/portfolio/risk
 * Advanced risk metrics (VaR, CVaR, Monte Carlo) via Python
 * Body: { positions: [...], confidenceLevel: 0.95 }
 */
router.post("/portfolio/risk", async (req, res) => {
  const { positions, confidenceLevel = 0.95 } = req.body;
  if (!Array.isArray(positions) || positions.length === 0) {
    return res.status(400).json({ error: "positions array required" });
  }

  const priceHistories = {};
  for (const pos of positions) {
    const history = marketService.priceHistory[pos.symbol] || [];
    priceHistories[pos.symbol] = history.map(h => h.price);
  }

  const result = await pythonBridge.calculateAdvancedRisk(positions, priceHistories, confidenceLevel);

  if (result.fallback) {
    // Fallback: basic risk from Node.js
    const allReturns = [];
    for (const pos of positions) {
      const history = marketService.priceHistory[pos.symbol] || [];
      for (let i = 1; i < history.length; i++) {
        allReturns.push((history[i].price - history[i - 1].price) / history[i - 1].price);
      }
    }
    const risk = analytics.calculateRiskMetrics(allReturns);
    return res.json({
      ...risk,
      note: "Monte Carlo & VaR unavailable — showing basic risk metrics. Start Python service for advanced analysis.",
    });
  }

  res.json(result);
});

// ─── ML Predictions ─────────────────────────────────────

/**
 * GET /api/analytics/predict/:symbol
 * ML price prediction for a stock
 * Query: ?horizon=5
 */
router.get("/predict/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const horizon = parseInt(req.query.horizon) || 5;
  const history = marketService.priceHistory[symbol] || [];

  if (history.length < 30) {
    return res.status(400).json({ error: "Need at least 30 data points for prediction" });
  }

  const prices = history.map(h => h.price);
  const volumes = history.map(h => h.volume || 0);

  const result = await pythonBridge.predictPrice(symbol, prices, volumes, horizon);

  if (result.fallback) {
    // Simple fallback: linear extrapolation
    const recentPrices = prices.slice(-20);
    const avgChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices.length;
    const lastPrice = prices[prices.length - 1];
    const predictions = [];
    for (let d = 1; d <= horizon; d++) {
      predictions.push({
        day: d,
        predicted: +(lastPrice + avgChange * d).toFixed(2),
        confidence: "low",
      });
    }
    return res.json({
      symbol,
      predictions,
      note: "ML service unavailable — showing linear extrapolation. Start Python service for ML predictions.",
    });
  }

  res.json({ symbol, ...result });
});

// ─── Backtesting ────────────────────────────────────────

/**
 * POST /api/analytics/backtest
 * Strategy backtesting via Python service
 * Body: { symbol, strategy: { type: "MA_CROSSOVER", params: { fast: 10, slow: 30 } }, initialCapital: 1000000 }
 */
router.post("/backtest", async (req, res) => {
  const { symbol, strategy, initialCapital = 1000000 } = req.body;

  if (!symbol || !strategy || !strategy.type) {
    return res.status(400).json({ error: "symbol and strategy.type required" });
  }

  const history = marketService.priceHistory[symbol.toUpperCase()] || [];
  if (history.length < 50) {
    return res.status(400).json({ error: "Need at least 50 data points for backtesting" });
  }

  const prices = history.map(h => h.price);
  const result = await pythonBridge.backtest(symbol.toUpperCase(), prices, strategy, initialCapital);

  if (result.fallback) {
    return res.json({
      symbol,
      error: "Backtesting requires Python service. Run: cd python-analytics && pip install -r requirements.txt && uvicorn main:app --port 8000",
    });
  }

  res.json({ symbol, ...result });
});

// ─── Advanced Screener ──────────────────────────────────

/**
 * POST /api/analytics/screener
 * Multi-factor stock screening
 * Body: { filters: { minDivYield: 2, maxPE: 15 }, weights: { value: 0.3, momentum: 0.3, quality: 0.2, growth: 0.2 } }
 */
router.post("/screener", async (req, res) => {
  const { filters = {}, weights = {} } = req.body;

  // Build stock data from live prices + history
  const stocks = marketService.livePrices
    .filter(s => s.price > 0)
    .map(s => ({
      symbol: s.symbol,
      price: s.price,
      pe: s.pe || 0,
      divYield: s.dividendYield || 0,
      volume: s.volume || 0,
      prices: (marketService.priceHistory[s.symbol] || []).map(h => h.price),
    }));

  const result = await pythonBridge.advancedScreen(stocks, filters, weights);

  if (result.fallback) {
    // Fallback: basic screening in Node.js
    let filtered = stocks;
    if (filters.minDivYield) filtered = filtered.filter(s => s.divYield >= filters.minDivYield);
    if (filters.maxPE) filtered = filtered.filter(s => s.pe > 0 && s.pe <= filters.maxPE);
    if (filters.minVolume) filtered = filtered.filter(s => s.volume >= filters.minVolume);

    return res.json({
      stocks: filtered.slice(0, 20).map(s => ({ symbol: s.symbol, price: s.price, pe: s.pe, divYield: s.divYield })),
      note: "Basic filtering only. Start Python service for multi-factor scoring.",
    });
  }

  res.json(result);
});

// ─── Financial Planning (Public Calculators — no auth required) ─────────────

/**
 * POST /api/analytics/compound-growth
 * Compound interest calculator with year-by-year breakdown.
 * Body: { principal, monthlyContribution, annualRate, years }
 */
router.post("/compound-growth", (req, res) => {
  const { principal, monthlyContribution, annualRate, years } = req.body;

  // Validation
  const errors = [];
  if (principal == null || isNaN(Number(principal)) || Number(principal) < 0) {
    errors.push("principal must be a non-negative number");
  }
  if (monthlyContribution != null && (isNaN(Number(monthlyContribution)) || Number(monthlyContribution) < 0)) {
    errors.push("monthlyContribution must be a non-negative number");
  }
  if (annualRate != null && (isNaN(Number(annualRate)) || Number(annualRate) < 0 || Number(annualRate) > 1)) {
    errors.push("annualRate must be a decimal between 0 and 1 (e.g. 0.08 for 8%)");
  }
  if (years == null || isNaN(Number(years)) || Number(years) <= 0) {
    errors.push("years must be a positive number");
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const result = analytics.calculateCompoundGrowthDetailed(
    Number(principal) || 0,
    Number(monthlyContribution) || 0,
    Number(annualRate) || 0,
    Number(years) || 1
  );
  res.json(result);
});

/**
 * POST /api/analytics/retirement
 * Retirement planner with year-by-year projection.
 * Body: { currentAge, retirementAge, currentSavings, monthlyContribution,
 *         expectedReturn, inflationRate, desiredMonthlyIncome }
 */
router.post("/retirement", (req, res) => {
  const {
    currentAge,
    retirementAge,
    currentSavings,
    monthlyContribution,
    expectedReturn,
    inflationRate,
    desiredMonthlyIncome,
  } = req.body;

  // Validation
  const errors = [];
  if (currentAge == null || isNaN(Number(currentAge)) || Number(currentAge) < 0) {
    errors.push("currentAge is required and must be a non-negative number");
  }
  if (retirementAge == null || isNaN(Number(retirementAge))) {
    errors.push("retirementAge is required");
  }
  if (currentAge != null && retirementAge != null && Number(retirementAge) <= Number(currentAge)) {
    errors.push("retirementAge must be greater than currentAge");
  }
  if (desiredMonthlyIncome == null || isNaN(Number(desiredMonthlyIncome)) || Number(desiredMonthlyIncome) <= 0) {
    errors.push("desiredMonthlyIncome is required and must be positive");
  }
  if (expectedReturn != null && (isNaN(Number(expectedReturn)) || Number(expectedReturn) < 0 || Number(expectedReturn) > 1)) {
    errors.push("expectedReturn must be a decimal between 0 and 1");
  }
  if (inflationRate != null && (isNaN(Number(inflationRate)) || Number(inflationRate) < 0 || Number(inflationRate) > 1)) {
    errors.push("inflationRate must be a decimal between 0 and 1");
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const result = analytics.calculateRetirementDetailed({
    currentAge: Number(currentAge),
    retirementAge: Number(retirementAge),
    currentSavings: Number(currentSavings) || 0,
    monthlyContribution: Number(monthlyContribution) || 0,
    expectedReturn: Number(expectedReturn) || 0.08,
    inflationRate: Number(inflationRate) || 0.05,
    desiredMonthlyIncome: Number(desiredMonthlyIncome),
  });
  res.json(result);
});

/**
 * POST /api/analytics/loan
 * Loan / mortgage calculator with extra-payment support.
 * Body: { principal, annualRate, termYears, extraPayment }
 */
router.post("/loan", (req, res) => {
  const { principal, annualRate, termYears, extraPayment } = req.body;

  // Validation
  const errors = [];
  if (principal == null || isNaN(Number(principal)) || Number(principal) <= 0) {
    errors.push("principal is required and must be positive");
  }
  if (annualRate == null || isNaN(Number(annualRate)) || Number(annualRate) < 0) {
    errors.push("annualRate is required and must be non-negative (decimal, e.g. 0.07 for 7%)");
  }
  if (termYears == null || isNaN(Number(termYears)) || Number(termYears) <= 0) {
    errors.push("termYears is required and must be positive");
  }
  if (extraPayment != null && (isNaN(Number(extraPayment)) || Number(extraPayment) < 0)) {
    errors.push("extraPayment must be a non-negative number");
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const result = analytics.calculateLoanDetailed(
    Number(principal),
    Number(annualRate),
    Number(termYears),
    Number(extraPayment) || 0
  );

  res.json({
    monthlyPayment: result.monthlyPayment,
    totalPaid: result.totalPaid,
    totalInterest: result.totalInterest,
    payoffMonths: result.payoffMonths,
    interestSaved: result.interestSaved,
    amortization: result.amortization,
  });
});

/**
 * POST /api/analytics/irr
 * Investment return calculator (IRR / XIRR).
 * Body: { cashflows: [{ amount, date }] }
 *   - Negative amount = outflow (investment), positive = inflow (return).
 */
router.post("/irr", (req, res) => {
  const { cashflows } = req.body;

  // Validation
  if (!Array.isArray(cashflows) || cashflows.length < 2) {
    return res.status(400).json({
      error: "cashflows array with at least 2 entries required. Each entry: { amount: number, date: string (optional) }",
    });
  }

  // Support both [{amount, date}] and plain number arrays for backward compat
  let normalized;
  if (typeof cashflows[0] === "object" && cashflows[0] !== null) {
    // Validate each entry
    const errors = [];
    for (let i = 0; i < cashflows.length; i++) {
      const cf = cashflows[i];
      if (cf.amount == null || isNaN(Number(cf.amount))) {
        errors.push(`cashflows[${i}].amount must be a number`);
      }
      if (cf.date != null && isNaN(new Date(cf.date).getTime())) {
        errors.push(`cashflows[${i}].date is not a valid date`);
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    normalized = cashflows;
  } else {
    // Plain number array — wrap into objects without dates
    normalized = cashflows.map((amt, i) => ({ amount: Number(amt), date: null }));
  }

  // Verify there's at least one negative and one positive cashflow
  const hasNeg = normalized.some((cf) => Number(cf.amount) < 0);
  const hasPos = normalized.some((cf) => Number(cf.amount) > 0);
  if (!hasNeg || !hasPos) {
    return res.status(400).json({
      error: "cashflows must contain at least one negative (investment) and one positive (return) entry",
    });
  }

  const result = analytics.calculateInvestmentReturnDetailed(normalized);
  res.json(result);
});

// ─── Python Service Status ──────────────────────────────

/**
 * GET /api/analytics/status
 * Check which analytics services are available
 */
router.get("/status", async (req, res) => {
  const pythonUp = await pythonBridge.isPythonAvailable();
  res.json({
    nodeAnalytics: true,
    pythonAnalytics: pythonUp,
    features: {
      technicalIndicators: true,
      portfolioMetrics: true,
      riskMetrics: true,
      financialPlanning: true,
      supportResistance: true,
      markowitzOptimization: pythonUp,
      monteCarloSimulation: pythonUp,
      mlPredictions: pythonUp,
      patternDetection: pythonUp,
      backtesting: pythonUp,
      advancedScreener: pythonUp,
    },
  });
});

module.exports = router;
