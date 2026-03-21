/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ── Analytics Service ─────────────────────────────────────────────────────────
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Comprehensive financial analytics service for the Jamaica Stock Exchange
 * Investment & Trading Platform. Provides technical indicator computation,
 * portfolio math, financial planning tools, and support/resistance detection.
 *
 * All computations are LOCAL (no network calls). The Python microservice
 * handles heavier ML workloads.
 *
 * @module services/analytics
 */

"use strict";

// ── Technical Indicator Imports ─────────────────────────────────────────────
const {
  RSI,
  MACD,
  BollingerBands,
  SMA,
  EMA,
  Stochastic,
  WilliamsR,
  ADX,
  CCI,
  ATR,
  OBV,
  VWAP,
  IchimokuCloud,
  PSAR,
} = require("technicalindicators");

// ── Financial Library Imports ───────────────────────────────────────────────
const { irr, npv, pmt, fv, pv } = require("financial");

// ── Jamaica T-bill rate (risk-free rate for Sharpe / Sortino) ───────────────
const RISK_FREE_RATE = 0.06;

// ── Trading days in a year (for annualization) ──────────────────────────────
const TRADING_DAYS_PER_YEAR = 252;

// ═══════════════════════════════════════════════════════════════════════════════
// ── Helpers ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Safely coerce a value to a finite number. Returns `fallback` for NaN,
 * Infinity, undefined, or null inputs.
 *
 * @param {*} val - The value to coerce.
 * @param {number} [fallback=0] - Fallback when the value is not a finite number.
 * @returns {number}
 */
function safeNumber(val, fallback = 0) {
  if (val === undefined || val === null) return fallback;
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

/**
 * Return the last element of an array, or `fallback` when the array is empty
 * or undefined.
 *
 * @param {Array} arr
 * @param {*} [fallback=undefined]
 * @returns {*}
 */
function last(arr, fallback = undefined) {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  return arr[arr.length - 1];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Technical Indicators ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute ALL standard technical indicators for a given price series.
 *
 * The returned object groups indicators into four categories:
 *   - **trend** : SMA(20,50,200), EMA(12,26), MACD(12,26,9), ADX(14),
 *                 Ichimoku Cloud, Parabolic SAR
 *   - **momentum** : RSI(14), Stochastic(14,3,3), Williams %R(14), CCI(20)
 *   - **volatility** : Bollinger Bands(20,2), ATR(14)
 *   - **volume** : OBV, VWAP
 *
 * Every indicator also includes a `signal` field:
 *   `"bullish"` | `"bearish"` | `"neutral"`
 *
 * @param {number[]} prices  - Close prices (legacy/convenience alias).
 * @param {number[]} volumes - Volume per period.
 * @param {number[]} highs   - High prices per period.
 * @param {number[]} lows    - Low prices per period.
 * @param {number[]} closes  - Close prices per period (preferred over `prices`).
 * @returns {object} Grouped indicator results.
 */
function calculateAllIndicators(prices, volumes, highs, lows, closes) {
  // Allow callers to pass closes as the 5th arg or fall back to prices
  const c = Array.isArray(closes) && closes.length > 0 ? closes : prices;
  const h = Array.isArray(highs) && highs.length > 0 ? highs : c;
  const l = Array.isArray(lows) && lows.length > 0 ? lows : c;
  const v = Array.isArray(volumes) && volumes.length > 0 ? volumes : [];

  if (!Array.isArray(c) || c.length === 0) {
    return { trend: {}, momentum: {}, volatility: {}, volume: {} };
  }

  const latestClose = last(c, 0);

  // ── Trend Indicators ────────────────────────────────────────────────────

  // SMA
  const sma20 = SMA.calculate({ period: 20, values: c });
  const sma50 = SMA.calculate({ period: 50, values: c });
  const sma200 = SMA.calculate({ period: 200, values: c });

  // EMA
  const ema12 = EMA.calculate({ period: 12, values: c });
  const ema26 = EMA.calculate({ period: 26, values: c });

  // MACD
  const macdResult = MACD.calculate({
    values: c,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  // ADX
  let adxResult = [];
  if (h.length === l.length && l.length === c.length && c.length >= 15) {
    try {
      adxResult = ADX.calculate({
        high: h,
        low: l,
        close: c,
        period: 14,
      });
    } catch (_) {
      /* insufficient data */
    }
  }

  // Ichimoku Cloud
  let ichimokuResult = [];
  if (h.length === l.length && c.length >= 52) {
    try {
      ichimokuResult = IchimokuCloud.calculate({
        high: h,
        low: l,
        conversionPeriod: 9,
        basePeriod: 26,
        spanPeriod: 52,
        displacement: 26,
      });
    } catch (_) {
      /* insufficient data */
    }
  }

  // Parabolic SAR
  let psarResult = [];
  if (h.length === l.length && h.length >= 2) {
    try {
      psarResult = PSAR.calculate({
        high: h,
        low: l,
        step: 0.02,
        max: 0.2,
      });
    } catch (_) {
      /* insufficient data */
    }
  }

  // ── Momentum Indicators ─────────────────────────────────────────────────

  const rsiResult = RSI.calculate({ values: c, period: 14 });

  let stochResult = [];
  if (h.length === l.length && l.length === c.length && c.length >= 14) {
    try {
      stochResult = Stochastic.calculate({
        high: h,
        low: l,
        close: c,
        period: 14,
        signalPeriod: 3,
      });
    } catch (_) {
      /* insufficient data */
    }
  }

  let williamsResult = [];
  if (h.length === l.length && l.length === c.length && c.length >= 14) {
    try {
      williamsResult = WilliamsR.calculate({
        high: h,
        low: l,
        close: c,
        period: 14,
      });
    } catch (_) {
      /* insufficient data */
    }
  }

  let cciResult = [];
  if (h.length === l.length && l.length === c.length && c.length >= 20) {
    try {
      cciResult = CCI.calculate({
        high: h,
        low: l,
        close: c,
        period: 20,
      });
    } catch (_) {
      /* insufficient data */
    }
  }

  // ── Volatility Indicators ───────────────────────────────────────────────

  const bbResult = BollingerBands.calculate({
    period: 20,
    values: c,
    stdDev: 2,
  });

  let atrResult = [];
  if (h.length === l.length && l.length === c.length && c.length >= 15) {
    try {
      atrResult = ATR.calculate({
        high: h,
        low: l,
        close: c,
        period: 14,
      });
    } catch (_) {
      /* insufficient data */
    }
  }

  // ── Volume Indicators ───────────────────────────────────────────────────

  let obvResult = [];
  if (v.length > 0 && v.length === c.length) {
    try {
      obvResult = OBV.calculate({ close: c, volume: v });
    } catch (_) {
      /* insufficient data */
    }
  }

  let vwapResult = [];
  if (
    v.length > 0 &&
    h.length === l.length &&
    l.length === c.length &&
    v.length === c.length
  ) {
    try {
      vwapResult = VWAP.calculate({
        high: h,
        low: l,
        close: c,
        volume: v,
      });
    } catch (_) {
      /* insufficient data */
    }
  }

  // ── Build Result Object with Signals ────────────────────────────────────

  const latestSma20 = safeNumber(last(sma20));
  const latestSma50 = safeNumber(last(sma50));
  const latestSma200 = safeNumber(last(sma200));
  const latestEma12 = safeNumber(last(ema12));
  const latestEma26 = safeNumber(last(ema26));
  const latestMacd = last(macdResult);
  const latestAdx = last(adxResult);
  const latestIchimoku = last(ichimokuResult);
  const latestPsar = safeNumber(last(psarResult));
  const latestRsi = safeNumber(last(rsiResult), 50);
  const latestStoch = last(stochResult);
  const latestWilliams = safeNumber(last(williamsResult), -50);
  const latestCci = safeNumber(last(cciResult));
  const latestBb = last(bbResult);
  const latestAtr = safeNumber(last(atrResult));
  const latestObv = safeNumber(last(obvResult));
  const latestVwap = safeNumber(last(vwapResult));

  return {
    trend: {
      sma20: {
        value: latestSma20,
        series: sma20,
        signal: latestSma20 > 0 && latestClose > latestSma20 ? "bullish" : latestSma20 > 0 && latestClose < latestSma20 ? "bearish" : "neutral",
      },
      sma50: {
        value: latestSma50,
        series: sma50,
        signal: latestSma50 > 0 && latestClose > latestSma50 ? "bullish" : latestSma50 > 0 && latestClose < latestSma50 ? "bearish" : "neutral",
      },
      sma200: {
        value: latestSma200,
        series: sma200,
        signal: latestSma200 > 0 && latestClose > latestSma200 ? "bullish" : latestSma200 > 0 && latestClose < latestSma200 ? "bearish" : "neutral",
      },
      ema12: {
        value: latestEma12,
        series: ema12,
        signal: latestEma12 > 0 && latestClose > latestEma12 ? "bullish" : latestEma12 > 0 && latestClose < latestEma12 ? "bearish" : "neutral",
      },
      ema26: {
        value: latestEma26,
        series: ema26,
        signal: latestEma26 > 0 && latestClose > latestEma26 ? "bullish" : latestEma26 > 0 && latestClose < latestEma26 ? "bearish" : "neutral",
      },
      macd: {
        value: latestMacd || null,
        series: macdResult,
        signal: latestMacd
          ? latestMacd.histogram > 0
            ? "bullish"
            : latestMacd.histogram < 0
              ? "bearish"
              : "neutral"
          : "neutral",
      },
      adx: {
        value: latestAdx || null,
        series: adxResult,
        signal: latestAdx
          ? latestAdx.adx > 25 && latestAdx.pdi > latestAdx.mdi
            ? "bullish"
            : latestAdx.adx > 25 && latestAdx.mdi > latestAdx.pdi
              ? "bearish"
              : "neutral"
          : "neutral",
      },
      ichimoku: {
        value: latestIchimoku || null,
        series: ichimokuResult,
        signal: latestIchimoku
          ? latestClose > latestIchimoku.spanA && latestClose > latestIchimoku.spanB
            ? "bullish"
            : latestClose < latestIchimoku.spanA && latestClose < latestIchimoku.spanB
              ? "bearish"
              : "neutral"
          : "neutral",
      },
      psar: {
        value: latestPsar,
        series: psarResult,
        signal: latestPsar > 0 && latestClose > latestPsar ? "bullish" : latestPsar > 0 && latestClose < latestPsar ? "bearish" : "neutral",
      },
    },

    momentum: {
      rsi: {
        value: latestRsi,
        series: rsiResult,
        signal: latestRsi < 30 ? "bullish" : latestRsi > 70 ? "bearish" : "neutral",
      },
      stochastic: {
        value: latestStoch || null,
        series: stochResult,
        signal: latestStoch
          ? latestStoch.k < 20
            ? "bullish"
            : latestStoch.k > 80
              ? "bearish"
              : "neutral"
          : "neutral",
      },
      williamsR: {
        value: latestWilliams,
        series: williamsResult,
        signal: latestWilliams < -80 ? "bullish" : latestWilliams > -20 ? "bearish" : "neutral",
      },
      cci: {
        value: latestCci,
        series: cciResult,
        signal: latestCci > 100 ? "bullish" : latestCci < -100 ? "bearish" : "neutral",
      },
    },

    volatility: {
      bollingerBands: {
        value: latestBb || null,
        series: bbResult,
        signal: latestBb
          ? latestClose <= latestBb.lower
            ? "bullish"
            : latestClose >= latestBb.upper
              ? "bearish"
              : "neutral"
          : "neutral",
      },
      atr: {
        value: latestAtr,
        series: atrResult,
        signal: "neutral", // ATR measures magnitude, not direction
      },
    },

    volume: {
      obv: {
        value: latestObv,
        series: obvResult,
        signal:
          obvResult.length >= 2
            ? obvResult[obvResult.length - 1] > obvResult[obvResult.length - 2]
              ? "bullish"
              : obvResult[obvResult.length - 1] < obvResult[obvResult.length - 2]
                ? "bearish"
                : "neutral"
            : "neutral",
      },
      vwap: {
        value: latestVwap,
        series: vwapResult,
        signal: latestVwap > 0 && latestClose > latestVwap ? "bullish" : latestVwap > 0 && latestClose < latestVwap ? "bearish" : "neutral",
      },
    },
  };
}

/**
 * Calculate a single technical indicator by name with custom parameters.
 *
 * @param {string} name   - Indicator name (case-insensitive). Supported:
 *   `"RSI"`, `"MACD"`, `"BollingerBands"`, `"SMA"`, `"EMA"`, `"Stochastic"`,
 *   `"WilliamsR"`, `"ADX"`, `"CCI"`, `"ATR"`, `"OBV"`, `"VWAP"`,
 *   `"IchimokuCloud"`, `"PSAR"`.
 * @param {object} params - Indicator-specific input parameters passed directly
 *   to the underlying `technicalindicators` library `.calculate()` method.
 * @returns {Array} Array of computed values.
 * @throws {Error} If the indicator name is not recognized.
 */
function calculateIndicator(name, params) {
  const indicators = {
    rsi: RSI,
    macd: MACD,
    bollingerbands: BollingerBands,
    sma: SMA,
    ema: EMA,
    stochastic: Stochastic,
    williamsr: WilliamsR,
    adx: ADX,
    cci: CCI,
    atr: ATR,
    obv: OBV,
    vwap: VWAP,
    ichimokucloud: IchimokuCloud,
    psar: PSAR,
  };

  const key = (name || "").toLowerCase().replace(/[\s_-]/g, "");
  const IndicatorClass = indicators[key];

  if (!IndicatorClass) {
    throw new Error(
      `Unknown indicator "${name}". Supported: ${Object.keys(indicators).join(", ")}`
    );
  }

  try {
    return IndicatorClass.calculate(params);
  } catch (err) {
    throw new Error(`Failed to calculate ${name}: ${err.message}`);
  }
}

/**
 * Generate an overall signal summary from a complete indicator result set
 * (as returned by `calculateAllIndicators`).
 *
 * Tallies bullish, bearish, and neutral signals across every indicator,
 * then returns an overall recommendation:
 *   - `"STRONG_BUY"`  : bullish ratio >= 75%
 *   - `"BUY"`         : bullish ratio >= 55%
 *   - `"NEUTRAL"`     : neither side dominates
 *   - `"SELL"`        : bearish ratio >= 55%
 *   - `"STRONG_SELL"` : bearish ratio >= 75%
 *
 * @param {object} indicators - Output of `calculateAllIndicators`.
 * @returns {{ bullish: number, bearish: number, neutral: number, total: number, recommendation: string }}
 */
function generateSignalSummary(indicators) {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;

  if (!indicators || typeof indicators !== "object") {
    return { bullish: 0, bearish: 0, neutral: 0, total: 0, recommendation: "NEUTRAL" };
  }

  // Walk every category -> every indicator -> read its signal
  for (const category of Object.values(indicators)) {
    if (!category || typeof category !== "object") continue;
    for (const indicator of Object.values(category)) {
      if (!indicator || typeof indicator !== "object" || !indicator.signal) continue;
      switch (indicator.signal) {
        case "bullish":
          bullish++;
          break;
        case "bearish":
          bearish++;
          break;
        default:
          neutral++;
      }
    }
  }

  const total = bullish + bearish + neutral;
  let recommendation = "NEUTRAL";

  if (total > 0) {
    const bullishRatio = bullish / total;
    const bearishRatio = bearish / total;

    if (bullishRatio >= 0.75) {
      recommendation = "STRONG_BUY";
    } else if (bullishRatio >= 0.55) {
      recommendation = "BUY";
    } else if (bearishRatio >= 0.75) {
      recommendation = "STRONG_SELL";
    } else if (bearishRatio >= 0.55) {
      recommendation = "SELL";
    }
  }

  return { bullish, bearish, neutral, total, recommendation };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Portfolio Math ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute portfolio-level and per-position metrics.
 *
 * @param {Array<{ symbol: string, shares: number, avgCost: number, currentPrice: number }>} positions
 * @returns {{
 *   totalValue: number,
 *   totalCost: number,
 *   totalGainLoss: number,
 *   totalReturnPct: number,
 *   positions: Array<{
 *     symbol: string,
 *     shares: number,
 *     avgCost: number,
 *     currentPrice: number,
 *     value: number,
 *     cost: number,
 *     gainLoss: number,
 *     gainLossPct: number,
 *     weight: number
 *   }>,
 *   diversificationScore: number
 * }}
 */
function calculatePortfolioMetrics(positions) {
  if (!Array.isArray(positions) || positions.length === 0) {
    return {
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
      totalReturnPct: 0,
      positions: [],
      diversificationScore: 0,
    };
  }

  let totalValue = 0;
  let totalCost = 0;

  // First pass — compute raw values
  const enriched = positions.map((pos) => {
    const shares = safeNumber(pos.shares);
    const avgCost = safeNumber(pos.avgCost);
    const currentPrice = safeNumber(pos.currentPrice);

    const value = shares * currentPrice;
    const cost = shares * avgCost;
    const gainLoss = value - cost;
    const gainLossPct = cost !== 0 ? (gainLoss / cost) * 100 : 0;

    totalValue += value;
    totalCost += cost;

    return {
      symbol: pos.symbol || "UNKNOWN",
      shares,
      avgCost,
      currentPrice,
      value,
      cost,
      gainLoss,
      gainLossPct: safeNumber(gainLossPct),
      weight: 0, // filled in second pass
    };
  });

  // Second pass — compute weight (% of portfolio) and Herfindahl index
  let herfindahl = 0;
  for (const pos of enriched) {
    pos.weight = totalValue !== 0 ? (pos.value / totalValue) * 100 : 0;
    herfindahl += (pos.weight / 100) ** 2;
  }

  // Diversification score: 1 = perfectly concentrated, 0 = perfectly spread.
  // We invert so that higher = more diversified (1 - HHI normalised).
  // For N positions, minimum HHI = 1/N. Score = (1 - HHI) / (1 - 1/N).
  const n = enriched.length;
  const minHHI = 1 / n;
  const diversificationScore =
    n > 1 ? safeNumber((1 - herfindahl) / (1 - minHHI)) : 0;

  const totalGainLoss = totalValue - totalCost;
  const totalReturnPct = totalCost !== 0 ? (totalGainLoss / totalCost) * 100 : 0;

  return {
    totalValue: safeNumber(totalValue),
    totalCost: safeNumber(totalCost),
    totalGainLoss: safeNumber(totalGainLoss),
    totalReturnPct: safeNumber(totalReturnPct),
    positions: enriched,
    diversificationScore: safeNumber(diversificationScore),
  };
}

/**
 * Calculate risk metrics from an array of daily (or periodic) returns.
 *
 * Uses the Jamaica T-bill rate (6%) as the risk-free rate.
 *
 * @param {number[]} returns - Array of periodic returns (e.g. 0.01 = 1%).
 * @returns {{
 *   annualizedReturn: number,
 *   annualizedVolatility: number,
 *   sharpeRatio: number,
 *   maxDrawdown: number,
 *   sortinoRatio: number,
 *   calmarRatio: number
 * }}
 */
function calculateRiskMetrics(returns) {
  if (!Array.isArray(returns) || returns.length === 0) {
    return {
      annualizedReturn: 0,
      annualizedVolatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
    };
  }

  const n = returns.length;

  // Mean daily return
  const meanReturn = returns.reduce((sum, r) => sum + safeNumber(r), 0) / n;

  // Standard deviation of returns
  const variance =
    returns.reduce((sum, r) => sum + (safeNumber(r) - meanReturn) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Annualized metrics
  const annualizedReturn = meanReturn * TRADING_DAYS_PER_YEAR;
  const annualizedVolatility = stdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);

  // Sharpe Ratio = (annualized return - risk-free rate) / annualized volatility
  const sharpeRatio =
    annualizedVolatility !== 0
      ? (annualizedReturn - RISK_FREE_RATE) / annualizedVolatility
      : 0;

  // Max Drawdown — largest peak-to-trough decline
  let peak = 1;
  let cumulative = 1;
  let maxDrawdown = 0;
  for (const r of returns) {
    cumulative *= 1 + safeNumber(r);
    if (cumulative > peak) peak = cumulative;
    const drawdown = (peak - cumulative) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Sortino Ratio — uses downside deviation only
  const downsideReturns = returns.filter((r) => safeNumber(r) < 0);
  const downsideVariance =
    downsideReturns.length > 0
      ? downsideReturns.reduce((sum, r) => sum + safeNumber(r) ** 2, 0) /
        downsideReturns.length
      : 0;
  const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const sortinoRatio =
    downsideDev !== 0
      ? (annualizedReturn - RISK_FREE_RATE) / downsideDev
      : 0;

  // Calmar Ratio = annualized return / max drawdown
  const calmarRatio = maxDrawdown !== 0 ? annualizedReturn / maxDrawdown : 0;

  return {
    annualizedReturn: safeNumber(annualizedReturn),
    annualizedVolatility: safeNumber(annualizedVolatility),
    sharpeRatio: safeNumber(sharpeRatio),
    maxDrawdown: safeNumber(maxDrawdown),
    sortinoRatio: safeNumber(sortinoRatio),
    calmarRatio: safeNumber(calmarRatio),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Financial Planning ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Project compound growth month-by-month.
 *
 * @param {number} principal           - Initial investment (lump sum).
 * @param {number} monthlyContribution - Amount added each month.
 * @param {number} annualRate          - Annual interest rate (decimal, e.g. 0.08 = 8%).
 * @param {number} years               - Investment horizon in years.
 * @returns {{
 *   schedule: Array<{ month: number, contribution: number, interest: number, balance: number }>,
 *   totalContributed: number,
 *   totalInterest: number,
 *   finalBalance: number
 * }}
 */
function calculateCompoundGrowth(principal, annualRate, monthlyContribution, years) {
  principal = safeNumber(principal);
  monthlyContribution = safeNumber(monthlyContribution);
  annualRate = safeNumber(annualRate);
  years = safeNumber(years, 1);

  const monthlyRate = annualRate / 12;
  const totalMonths = Math.round(years * 12);
  const schedule = [];

  let balance = principal;
  let totalContributed = principal;
  let totalInterest = 0;

  for (let month = 1; month <= totalMonths; month++) {
    const interest = balance * monthlyRate;
    balance += interest + monthlyContribution;
    totalContributed += monthlyContribution;
    totalInterest += interest;

    schedule.push({
      month,
      contribution: monthlyContribution,
      interest: safeNumber(interest),
      balance: safeNumber(balance),
    });
  }

  return {
    schedule,
    totalContributed: safeNumber(totalContributed),
    totalInterest: safeNumber(totalInterest),
    finalBalance: safeNumber(balance),
  };
}

/**
 * Estimate retirement funding needs.
 *
 * Calculates how much one needs at retirement to sustain a given monthly
 * expense (adjusted for inflation) for the expected retirement duration,
 * and the required monthly savings to reach that target.
 *
 * @param {number} currentAge      - Current age.
 * @param {number} retirementAge   - Target retirement age.
 * @param {number} monthlyExpenses - Desired monthly spending in today's dollars.
 * @param {number} inflationRate   - Annual inflation rate (decimal, e.g. 0.05 = 5%).
 * @param {number} [lifeExpectancy=85]   - Expected lifespan.
 * @param {number} [expectedReturn=0.08] - Expected annual return on investments.
 * @returns {{
 *   yearsToRetirement: number,
 *   yearsInRetirement: number,
 *   inflationAdjustedMonthly: number,
 *   totalNeededAtRetirement: number,
 *   monthlyContributionNeeded: number
 * }}
 */
function calculateRetirementNeeds(
  currentAge,
  retirementAge,
  monthlyExpenses,
  inflationRate,
  lifeExpectancy = 85,
  expectedReturn = 0.08
) {
  currentAge = safeNumber(currentAge, 30);
  retirementAge = safeNumber(retirementAge, 65);
  monthlyExpenses = safeNumber(monthlyExpenses);
  inflationRate = safeNumber(inflationRate, 0.05);
  lifeExpectancy = safeNumber(lifeExpectancy, 85);
  expectedReturn = safeNumber(expectedReturn, 0.08);

  const yearsToRetirement = Math.max(retirementAge - currentAge, 1);
  const yearsInRetirement = Math.max(lifeExpectancy - retirementAge, 1);

  // Inflation-adjusted monthly expenses at retirement
  const inflationAdjustedMonthly =
    monthlyExpenses * Math.pow(1 + inflationRate, yearsToRetirement);

  // Total nest egg needed at retirement (present value of annuity).
  // We use the real return during retirement: (1+nominal)/(1+inflation) - 1
  const realReturnMonthly =
    ((1 + expectedReturn) / (1 + inflationRate) - 1) / 12;
  const retirementMonths = yearsInRetirement * 12;

  let totalNeededAtRetirement;
  if (realReturnMonthly === 0) {
    totalNeededAtRetirement = inflationAdjustedMonthly * retirementMonths;
  } else {
    // PV of annuity: PMT * [(1 - (1 + r)^-n) / r]
    totalNeededAtRetirement =
      inflationAdjustedMonthly *
      ((1 - Math.pow(1 + realReturnMonthly, -retirementMonths)) /
        realReturnMonthly);
  }

  // Monthly contribution needed during working years to hit the target.
  // FV of annuity: FV = PMT * [((1 + r)^n - 1) / r]
  const growthRateMonthly = expectedReturn / 12;
  const savingMonths = yearsToRetirement * 12;

  let monthlyContributionNeeded;
  if (growthRateMonthly === 0) {
    monthlyContributionNeeded = totalNeededAtRetirement / savingMonths;
  } else {
    // PMT = FV * r / ((1 + r)^n - 1)
    monthlyContributionNeeded =
      (totalNeededAtRetirement * growthRateMonthly) /
      (Math.pow(1 + growthRateMonthly, savingMonths) - 1);
  }

  return {
    yearsToRetirement,
    yearsInRetirement,
    inflationAdjustedMonthly: safeNumber(inflationAdjustedMonthly),
    totalNeededAtRetirement: safeNumber(totalNeededAtRetirement),
    monthlyContributionNeeded: safeNumber(monthlyContributionNeeded),
  };
}

/**
 * Calculate loan payment details using the PMT formula from the `financial`
 * library.
 *
 * @param {number} principal  - Loan amount.
 * @param {number} annualRate - Annual interest rate (decimal).
 * @param {number} years      - Loan term in years.
 * @returns {{
 *   monthlyPayment: number,
 *   totalPayment: number,
 *   totalInterest: number,
 *   amortization: Array<{ month: number, payment: number, principal: number, interest: number, balance: number }>
 * }}
 */
function calculateLoanPayment(principal, annualRate, years) {
  principal = safeNumber(principal);
  annualRate = safeNumber(annualRate);
  years = safeNumber(years, 1);

  const monthlyRate = annualRate / 12;
  const nper = Math.round(years * 12);

  // pmt(rate, nper, pv, fv?, when?) — returns negative (cash outflow)
  let monthlyPayment;
  if (monthlyRate === 0) {
    monthlyPayment = principal / nper;
  } else {
    monthlyPayment = Math.abs(pmt(monthlyRate, nper, principal, 0));
  }

  // Build amortization schedule
  const amortization = [];
  let balance = principal;

  for (let month = 1; month <= nper; month++) {
    const interestPortion = balance * monthlyRate;
    const principalPortion = monthlyPayment - interestPortion;
    balance = Math.max(balance - principalPortion, 0);

    amortization.push({
      month,
      payment: safeNumber(monthlyPayment),
      principal: safeNumber(principalPortion),
      interest: safeNumber(interestPortion),
      balance: safeNumber(balance),
    });
  }

  const totalPayment = monthlyPayment * nper;
  const totalInterest = totalPayment - principal;

  return {
    monthlyPayment: safeNumber(monthlyPayment),
    totalPayment: safeNumber(totalPayment),
    totalInterest: safeNumber(totalInterest),
    amortization,
  };
}

/**
 * Compute the Internal Rate of Return for a series of cash flows. If `dates`
 * are provided, an XIRR (time-weighted IRR) is approximated using
 * Newton-Raphson; otherwise the standard periodic IRR from the `financial`
 * library is used.
 *
 * @param {number[]} cashflows - Array of cash flows (negative = investment, positive = return).
 * @param {Date[]}   [dates]   - Optional array of dates corresponding to each cash flow for XIRR.
 * @returns {{ irr: number, xirr: number|null }}
 */
function calculateInvestmentReturn(cashflows, dates) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) {
    return { irr: 0, xirr: null };
  }

  // Standard periodic IRR
  let irrValue;
  try {
    irrValue = safeNumber(irr(cashflows));
  } catch (_) {
    irrValue = 0;
  }

  // XIRR — if dates are provided, use Newton-Raphson on the NPV equation
  let xirrValue = null;
  if (Array.isArray(dates) && dates.length === cashflows.length) {
    xirrValue = _computeXIRR(cashflows, dates);
  }

  return {
    irr: irrValue,
    xirr: xirrValue,
  };
}

/**
 * Newton-Raphson XIRR solver.
 *
 * Finds the rate r such that:
 *   SUM[ cashflow_i / (1+r)^((date_i - date_0) / 365) ] = 0
 *
 * @private
 * @param {number[]} cashflows
 * @param {Date[]} dates
 * @param {number} [guess=0.1]
 * @param {number} [tol=1e-6]
 * @param {number} [maxIter=1000]
 * @returns {number|null} The XIRR or null if convergence fails.
 */
function _computeXIRR(cashflows, dates, guess = 0.1, tol = 1e-6, maxIter = 1000) {
  // Convert all dates to ms timestamps
  const d0 = new Date(dates[0]).getTime();
  const dayFractions = dates.map(
    (d) => (new Date(d).getTime() - d0) / (365.25 * 24 * 60 * 60 * 1000)
  );

  let rate = guess;

  for (let i = 0; i < maxIter; i++) {
    let npvVal = 0;
    let dnpv = 0; // derivative

    for (let j = 0; j < cashflows.length; j++) {
      const t = dayFractions[j];
      const disc = Math.pow(1 + rate, t);
      if (!Number.isFinite(disc) || disc === 0) return null;
      npvVal += cashflows[j] / disc;
      dnpv -= (t * cashflows[j]) / (disc * (1 + rate));
    }

    if (Math.abs(npvVal) < tol) {
      return safeNumber(rate);
    }

    if (dnpv === 0) return null;

    const newRate = rate - npvVal / dnpv;
    if (!Number.isFinite(newRate)) return null;
    rate = newRate;
  }

  return null; // did not converge
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Support / Resistance ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Identify support and resistance levels from a price series using a rolling
 * window to detect local minima (support) and maxima (resistance), then
 * cluster nearby levels.
 *
 * @param {number[]} prices          - Array of prices (typically closes).
 * @param {number}   [window=20]     - Rolling window size for local extrema detection.
 * @param {number}   [clusterPct=0.02] - Percentage threshold to merge nearby levels (2% default).
 * @returns {{ support: number[], resistance: number[] }}
 */
function findSupportResistance(prices, window = 20, clusterPct = 0.02) {
  if (!Array.isArray(prices) || prices.length < window) {
    return { support: [], resistance: [] };
  }

  const halfWin = Math.floor(window / 2);
  const localMins = [];
  const localMaxs = [];

  // Find local minima and maxima
  for (let i = halfWin; i < prices.length - halfWin; i++) {
    const slice = prices.slice(i - halfWin, i + halfWin + 1);
    const minVal = Math.min(...slice);
    const maxVal = Math.max(...slice);

    if (prices[i] === minVal) {
      localMins.push(prices[i]);
    }
    if (prices[i] === maxVal) {
      localMaxs.push(prices[i]);
    }
  }

  /**
   * Cluster nearby price levels. Merges values within `pct` of each other
   * and returns the average of each cluster, sorted ascending.
   *
   * @param {number[]} levels
   * @param {number} pct
   * @returns {number[]}
   */
  function clusterLevels(levels, pct) {
    if (levels.length === 0) return [];

    const sorted = [...levels].sort((a, b) => a - b);
    const clusters = [[sorted[0]]];

    for (let i = 1; i < sorted.length; i++) {
      const lastCluster = clusters[clusters.length - 1];
      const clusterAvg =
        lastCluster.reduce((s, v) => s + v, 0) / lastCluster.length;

      if (Math.abs(sorted[i] - clusterAvg) / clusterAvg <= pct) {
        lastCluster.push(sorted[i]);
      } else {
        clusters.push([sorted[i]]);
      }
    }

    return clusters
      .map((cl) => {
        const avg = cl.reduce((s, v) => s + v, 0) / cl.length;
        return safeNumber(parseFloat(avg.toFixed(4)));
      })
      .sort((a, b) => a - b);
  }

  return {
    support: clusterLevels(localMins, clusterPct),
    resistance: clusterLevels(localMaxs, clusterPct),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Enhanced Financial Calculators ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compound growth with year-by-year breakdown.
 *
 * @param {number} principal          - Initial lump sum.
 * @param {number} monthlyContribution - Amount added each month.
 * @param {number} annualRate         - Annual rate as decimal (0.08 = 8%).
 * @param {number} years              - Investment horizon.
 * @returns {{ finalValue, totalContributed, totalInterest, yearByYear }}
 */
function calculateCompoundGrowthDetailed(principal, monthlyContribution, annualRate, years) {
  principal = safeNumber(principal);
  monthlyContribution = safeNumber(monthlyContribution);
  annualRate = safeNumber(annualRate);
  years = safeNumber(years, 1);
  if (years <= 0) years = 1;

  const monthlyRate = annualRate / 12;
  const totalMonths = Math.round(years * 12);
  const yearByYear = [];

  let balance = principal;
  let totalContributed = principal;
  let totalInterest = 0;

  for (let month = 1; month <= totalMonths; month++) {
    const interest = balance * monthlyRate;
    balance += interest + monthlyContribution;
    totalContributed += monthlyContribution;
    totalInterest += interest;

    // Snapshot at end of each year
    if (month % 12 === 0) {
      yearByYear.push({
        year: month / 12,
        balance: +balance.toFixed(2),
        contributed: +totalContributed.toFixed(2),
        interest: +totalInterest.toFixed(2),
      });
    }
  }

  // If years is fractional and last month wasn't captured, add final snapshot
  if (totalMonths % 12 !== 0) {
    yearByYear.push({
      year: +(totalMonths / 12).toFixed(2),
      balance: +balance.toFixed(2),
      contributed: +totalContributed.toFixed(2),
      interest: +totalInterest.toFixed(2),
    });
  }

  return {
    finalValue: +balance.toFixed(2),
    totalContributed: +totalContributed.toFixed(2),
    totalInterest: +totalInterest.toFixed(2),
    yearByYear,
  };
}

/**
 * Retirement planner with year-by-year projection.
 *
 * @param {object} opts
 * @param {number} opts.currentAge
 * @param {number} opts.retirementAge
 * @param {number} opts.currentSavings
 * @param {number} opts.monthlyContribution
 * @param {number} opts.expectedReturn     - Annual return as decimal.
 * @param {number} opts.inflationRate      - Annual inflation as decimal.
 * @param {number} opts.desiredMonthlyIncome - Monthly income needed in today's dollars.
 * @returns {{ projectedSavings, monthlyIncomeAtRetirement, yearsOfIncome, shortfall, yearByYear }}
 */
function calculateRetirementDetailed({
  currentAge,
  retirementAge,
  currentSavings,
  monthlyContribution,
  expectedReturn,
  inflationRate,
  desiredMonthlyIncome,
}) {
  currentAge = safeNumber(currentAge, 30);
  retirementAge = safeNumber(retirementAge, 65);
  currentSavings = safeNumber(currentSavings);
  monthlyContribution = safeNumber(monthlyContribution);
  expectedReturn = safeNumber(expectedReturn, 0.08);
  inflationRate = safeNumber(inflationRate, 0.05);
  desiredMonthlyIncome = safeNumber(desiredMonthlyIncome, 100000);

  if (retirementAge <= currentAge) retirementAge = currentAge + 1;

  const monthlyReturn = expectedReturn / 12;
  const yearsToRetirement = retirementAge - currentAge;
  const yearByYear = [];

  // Accumulation phase — grow savings month by month, snapshot each year
  let balance = currentSavings;
  for (let year = 1; year <= yearsToRetirement; year++) {
    for (let m = 0; m < 12; m++) {
      const interest = balance * monthlyReturn;
      balance += interest + monthlyContribution;
    }
    yearByYear.push({
      age: currentAge + year,
      balance: +balance.toFixed(2),
    });
  }

  const projectedSavings = +balance.toFixed(2);

  // Inflation-adjusted desired income at retirement
  const inflationAdjustedMonthly =
    desiredMonthlyIncome * Math.pow(1 + inflationRate, yearsToRetirement);

  // Real return during retirement (nominal - inflation, approximated)
  const realReturn = ((1 + expectedReturn) / (1 + inflationRate)) - 1;
  const realMonthlyReturn = realReturn / 12;

  // How many years the savings can sustain withdrawals
  let yearsOfIncome;
  if (realMonthlyReturn <= 0) {
    // No real growth — simple division
    yearsOfIncome = +(balance / (inflationAdjustedMonthly * 12)).toFixed(1);
  } else {
    // Solve for n in PV-of-annuity: balance = PMT * [(1 - (1+r)^-n) / r]
    // n = -ln(1 - balance*r/PMT) / ln(1+r)
    const ratio = (balance * realMonthlyReturn) / inflationAdjustedMonthly;
    if (ratio >= 1) {
      yearsOfIncome = Infinity; // Savings can sustain forever (perpetuity)
    } else {
      const months = -Math.log(1 - ratio) / Math.log(1 + realMonthlyReturn);
      yearsOfIncome = +(months / 12).toFixed(1);
    }
  }

  // Monthly income the projected savings can actually provide (25-year horizon)
  const retirementHorizonMonths = 25 * 12;
  let monthlyIncomeAtRetirement;
  if (realMonthlyReturn === 0) {
    monthlyIncomeAtRetirement = +(balance / retirementHorizonMonths).toFixed(2);
  } else {
    // PMT = PV * r / (1 - (1+r)^-n)
    monthlyIncomeAtRetirement = +(
      (balance * realMonthlyReturn) /
      (1 - Math.pow(1 + realMonthlyReturn, -retirementHorizonMonths))
    ).toFixed(2);
  }

  // Shortfall: how much MORE total savings you'd need to match desired income
  let neededAtRetirement;
  if (realMonthlyReturn === 0) {
    neededAtRetirement = inflationAdjustedMonthly * retirementHorizonMonths;
  } else {
    neededAtRetirement =
      inflationAdjustedMonthly *
      ((1 - Math.pow(1 + realMonthlyReturn, -retirementHorizonMonths)) /
        realMonthlyReturn);
  }
  const shortfall = +(Math.max(neededAtRetirement - balance, 0)).toFixed(2);

  return {
    projectedSavings,
    monthlyIncomeAtRetirement,
    yearsOfIncome: yearsOfIncome === Infinity ? "perpetual" : yearsOfIncome,
    shortfall,
    inflationAdjustedMonthlyExpense: +inflationAdjustedMonthly.toFixed(2),
    yearByYear,
  };
}

/**
 * Loan / mortgage calculator with extra-payment support and full amortization.
 *
 * @param {number} principal    - Loan amount.
 * @param {number} annualRate   - Annual interest rate (decimal).
 * @param {number} termYears    - Loan term in years.
 * @param {number} extraPayment - Additional monthly payment toward principal.
 * @returns {{ monthlyPayment, totalPaid, totalInterest, payoffMonths, amortization }}
 */
function calculateLoanDetailed(principal, annualRate, termYears, extraPayment) {
  principal = safeNumber(principal);
  annualRate = safeNumber(annualRate);
  termYears = safeNumber(termYears, 1);
  extraPayment = safeNumber(extraPayment);
  if (termYears <= 0) termYears = 1;

  const monthlyRate = annualRate / 12;
  const nper = Math.round(termYears * 12);

  // Standard monthly payment (without extra)
  let monthlyPayment;
  if (monthlyRate === 0) {
    monthlyPayment = principal / nper;
  } else {
    monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, nper)) /
      (Math.pow(1 + monthlyRate, nper) - 1);
  }

  // Build amortization with extra payments
  const amortization = [];
  let balance = principal;
  let totalPaid = 0;
  let totalInterest = 0;

  for (let month = 1; month <= nper && balance > 0.005; month++) {
    const interestPortion = balance * monthlyRate;
    let principalPortion = monthlyPayment - interestPortion + extraPayment;

    // Don't overpay
    if (principalPortion > balance) {
      principalPortion = balance;
    }

    const actualPayment = interestPortion + principalPortion;
    balance = Math.max(balance - principalPortion, 0);
    totalPaid += actualPayment;
    totalInterest += interestPortion;

    amortization.push({
      month,
      payment: +actualPayment.toFixed(2),
      principal: +principalPortion.toFixed(2),
      interest: +interestPortion.toFixed(2),
      balance: +balance.toFixed(2),
    });

    if (balance <= 0) break;
  }

  return {
    monthlyPayment: +monthlyPayment.toFixed(2),
    totalPaid: +totalPaid.toFixed(2),
    totalInterest: +totalInterest.toFixed(2),
    payoffMonths: amortization.length,
    interestSaved: extraPayment > 0
      ? +((monthlyPayment * nper) - principal - totalInterest).toFixed(2)
      : 0,
    amortization,
  };
}

/**
 * Investment return calculator accepting [{amount, date}] cashflow objects.
 * Computes IRR, XIRR, totalInvested, totalReturned, netProfit.
 *
 * @param {Array<{amount: number, date: string}>} cashflows
 * @returns {{ irr, xirr, totalInvested, totalReturned, netProfit }}
 */
function calculateInvestmentReturnDetailed(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) {
    return { irr: 0, xirr: null, totalInvested: 0, totalReturned: 0, netProfit: 0 };
  }

  const amounts = cashflows.map((cf) => safeNumber(cf.amount));
  const dates = cashflows.map((cf) => cf.date);

  let totalInvested = 0;
  let totalReturned = 0;
  for (const amt of amounts) {
    if (amt < 0) totalInvested += Math.abs(amt);
    else totalReturned += amt;
  }
  const netProfit = totalReturned - totalInvested;

  // Standard periodic IRR
  let irrValue;
  try {
    irrValue = safeNumber(irr(amounts));
    // irr() can return weird values if cashflows don't converge
    if (!Number.isFinite(irrValue) || Math.abs(irrValue) > 100) irrValue = null;
  } catch (_) {
    irrValue = null;
  }

  // XIRR if dates are present
  let xirrValue = null;
  const hasDates = dates.every((d) => d != null && !isNaN(new Date(d).getTime()));
  if (hasDates) {
    xirrValue = _computeXIRR(amounts, dates);
  }

  return {
    irr: irrValue != null ? +(irrValue * 100).toFixed(4) : null,
    xirr: xirrValue != null ? +(xirrValue * 100).toFixed(4) : null,
    totalInvested: +totalInvested.toFixed(2),
    totalReturned: +totalReturned.toFixed(2),
    netProfit: +netProfit.toFixed(2),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Exports ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Helpers
  safeNumber,

  // Technical Indicators
  calculateAllIndicators,
  calculateIndicator,
  generateSignalSummary,

  // Portfolio Math
  calculatePortfolioMetrics,
  calculateRiskMetrics,

  // Financial Planning
  calculateCompoundGrowth,
  calculateRetirementNeeds,
  calculateLoanPayment,
  calculateInvestmentReturn,

  // Enhanced Financial Calculators
  calculateCompoundGrowthDetailed,
  calculateRetirementDetailed,
  calculateLoanDetailed,
  calculateInvestmentReturnDetailed,

  // Support / Resistance
  findSupportResistance,
};
