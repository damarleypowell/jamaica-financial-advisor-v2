/**
 * Python Analytics Bridge
 * Proxies requests to the FastAPI microservice at localhost:8000
 * Falls back gracefully when Python service is unavailable
 */

"use strict";

const PYTHON_BASE_URL = process.env.PYTHON_ANALYTICS_URL || "http://localhost:8000";
const TIMEOUT_MS = 30000; // 30s for ML operations

let _pythonAvailable = null; // null = unknown, true/false after first check
let _lastCheck = 0;
const CHECK_INTERVAL = 60000; // re-check availability every 60s

/**
 * Check if the Python analytics service is running
 */
async function isPythonAvailable() {
  const now = Date.now();
  if (_pythonAvailable !== null && now - _lastCheck < CHECK_INTERVAL) {
    return _pythonAvailable;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${PYTHON_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    _pythonAvailable = res.ok;
  } catch {
    _pythonAvailable = false;
  }
  _lastCheck = now;
  return _pythonAvailable;
}

/**
 * Make a POST request to the Python service
 */
async function pythonPost(path, body) {
  const available = await isPythonAvailable();
  if (!available) {
    return { error: "Python analytics service unavailable", fallback: true };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${PYTHON_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      return { error: `Python service error: ${res.status} — ${errText}`, fallback: true };
    }

    return await res.json();
  } catch (err) {
    return { error: `Python bridge error: ${err.message}`, fallback: true };
  }
}

// ─── Portfolio Optimization (Markowitz) ──────────────────

/**
 * Markowitz mean-variance portfolio optimization
 * @param {Array} positions - [{symbol, shares, avgCost, currentPrice}]
 * @param {number} riskTolerance - 1-10 scale
 * @param {Object} priceHistories - {symbol: number[]} historical prices
 */
async function optimizePortfolio(positions, riskTolerance, priceHistories) {
  return pythonPost("/api/optimize", {
    positions: positions.map(p => ({
      symbol: p.symbol,
      shares: p.shares,
      avg_cost: p.avgCost,
      current_price: p.currentPrice,
    })),
    risk_tolerance: riskTolerance,
    price_histories: priceHistories || {},
  });
}

// ─── Risk Metrics (VaR, CVaR, Monte Carlo) ───────────────

/**
 * Full risk analysis with VaR, CVaR, Monte Carlo simulation
 * @param {Array} positions - [{symbol, shares, avgCost, currentPrice}]
 * @param {Object} priceHistories - {symbol: number[]}
 * @param {number} confidenceLevel - 0.95 or 0.99
 */
async function calculateAdvancedRisk(positions, priceHistories, confidenceLevel = 0.95) {
  return pythonPost("/api/risk-metrics", {
    positions: positions.map(p => ({
      symbol: p.symbol,
      shares: p.shares,
      avg_cost: p.avgCost,
      current_price: p.currentPrice,
    })),
    price_histories: priceHistories || {},
    confidence_level: confidenceLevel,
  });
}

// ─── Technical Analysis (Full Suite via ta library) ──────

/**
 * Full technical indicator suite from Python ta library
 * @param {string} symbol
 * @param {number[]} prices - close prices
 * @param {number[]} volumes
 * @param {number[]} highs
 * @param {number[]} lows
 */
async function fullTechnicalAnalysis(symbol, prices, volumes, highs, lows) {
  return pythonPost("/api/technical-analysis", {
    symbol,
    prices,
    volumes: volumes || prices.map(() => 0),
    highs: highs || prices,
    lows: lows || prices,
  });
}

/**
 * Support/Resistance detection with KMeans clustering
 */
async function detectSupportResistance(symbol, prices) {
  return pythonPost("/api/support-resistance", {
    symbol,
    prices,
  });
}

/**
 * Chart pattern recognition (Head & Shoulders, Double Top, etc.)
 */
async function detectPatterns(symbol, prices, highs, lows) {
  return pythonPost("/api/pattern-detection", {
    symbol,
    prices,
    highs: highs || prices,
    lows: lows || prices,
  });
}

// ─── ML Predictions ─────────────────────────────────────

/**
 * ML price prediction (Linear Regression, Random Forest, ARIMA ensemble)
 * @param {string} symbol
 * @param {number[]} prices
 * @param {number[]} volumes
 * @param {number} horizon - days to predict
 */
async function predictPrice(symbol, prices, volumes, horizon = 5) {
  return pythonPost("/api/predict", {
    symbol,
    prices,
    volumes: volumes || prices.map(() => 0),
    horizon,
  });
}

/**
 * Strategy backtesting
 * @param {string} symbol
 * @param {number[]} prices
 * @param {Object} strategy - {type: "MA_CROSSOVER"|"RSI_REVERSAL"|"BOLLINGER_BREAKOUT"|"MACD_SIGNAL", params: {}}
 * @param {number} initialCapital
 */
async function backtest(symbol, prices, strategy, initialCapital = 1000000) {
  return pythonPost("/api/backtest", {
    symbol,
    prices,
    strategy,
    initial_capital: initialCapital,
  });
}

// ─── Advanced Screener ──────────────────────────────────

/**
 * Multi-factor stock screening with composite scoring
 */
async function advancedScreen(stocks, filters = {}, weights = {}) {
  return pythonPost("/api/advanced-screen", {
    stocks: stocks.map(s => ({
      symbol: s.symbol,
      price: s.price,
      pe: s.pe || 0,
      div_yield: s.divYield || 0,
      volume: s.volume || 0,
      prices: s.prices || [],
    })),
    filters,
    weights,
  });
}

module.exports = {
  isPythonAvailable,
  optimizePortfolio,
  calculateAdvancedRisk,
  fullTechnicalAnalysis,
  detectSupportResistance,
  detectPatterns,
  predictPrice,
  backtest,
  advancedScreen,
};
