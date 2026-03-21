"""
Advanced multi-factor stock screener router.

Scores each stock on four factor dimensions — Value, Momentum, Quality,
Growth — then produces a weighted composite score for ranking.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException

from models.schemas import (
    ScreenerRequest, ScreenerResponse, ScoredStock,
)
from services.data_service import calculate_returns, safe_float

router = APIRouter(prefix="/api", tags=["screener"])


def _percentile_rank(values: list[float]) -> list[float]:
    """
    Rank values as percentiles (0-100).  Higher is always "better"
    after the caller handles inversion for metrics where low = good.
    """
    arr = np.array(values, dtype=np.float64)
    n = len(arr)
    if n == 0:
        return []
    order = arr.argsort().argsort()  # double argsort = rank
    return ((order + 1) / n * 100).tolist()


# ======================================================================
# POST /api/advanced-screen
# ======================================================================

@router.post("/advanced-screen", response_model=ScreenerResponse)
async def advanced_screen(req: ScreenerRequest):
    """
    Multi-factor stock screening and ranking.

    Factor definitions
    ------------------
    * **Value** — low P/E ratio + high dividend yield.
      P/E is inverted (lower = better) then percentile-ranked; dividend yield
      is ranked directly.  Equal weight within factor.
    * **Momentum** — RSI(14) proximity to 50-70 sweet-spot + price relative
      to 20-day SMA.
    * **Quality** — low return volatility + consistency of positive returns
      (fraction of up-days in last N bars).
    * **Growth** — second derivative of price (acceleration); positive
      acceleration = stronger uptrend.

    Composite = weighted sum of factor z-scores, rescaled 0-100.
    """
    if not req.stocks:
        raise HTTPException(400, "Stock list cannot be empty.")

    f = req.filters

    # --- Apply hard filters first ---
    filtered = []
    for s in req.stocks:
        if f.minPE is not None and (s.pe is None or s.pe < f.minPE):
            continue
        if f.maxPE is not None and (s.pe is None or s.pe > f.maxPE):
            continue
        if f.minDivYield is not None and (s.divYield is None or s.divYield < f.minDivYield):
            continue
        if f.minVolume is not None and (s.volume is None or s.volume < f.minVolume):
            continue
        filtered.append(s)

    if not filtered:
        return ScreenerResponse(ranked=[], totalScreened=len(req.stocks), passedFilters=0)

    # --- Compute raw factor values ---
    value_scores_raw: list[float] = []
    momentum_scores_raw: list[float] = []
    quality_scores_raw: list[float] = []
    growth_scores_raw: list[float] = []

    for s in filtered:
        # VALUE: inverse P/E + dividend yield
        inv_pe = 1.0 / s.pe if s.pe and s.pe > 0 else 0.0
        dy = s.divYield if s.divYield else 0.0
        value_scores_raw.append(inv_pe * 100 + dy)

        # MOMENTUM (needs prices)
        if len(s.prices) >= 20:
            prices = np.asarray(s.prices, dtype=np.float64)
            rets = calculate_returns(prices, log=False)

            # RSI(14)
            delta = np.diff(prices)
            gain = np.where(delta > 0, delta, 0.0)
            loss = np.where(delta < 0, -delta, 0.0)
            avg_gain = pd.Series(gain).rolling(14, min_periods=1).mean().iloc[-1]
            avg_loss = pd.Series(loss).rolling(14, min_periods=1).mean().iloc[-1]
            rs = avg_gain / (avg_loss + 1e-10)
            rsi = 100 - 100 / (1 + rs)

            # RSI score: optimal around 60; penalise extremes
            rsi_score = max(0, 100 - abs(rsi - 60) * 2)

            # Price vs SMA(20)
            sma20 = float(pd.Series(prices).rolling(20, min_periods=1).mean().iloc[-1])
            price_vs_sma = (prices[-1] / sma20 - 1) * 100 if sma20 > 0 else 0

            momentum_scores_raw.append(rsi_score + max(price_vs_sma, 0))
        else:
            momentum_scores_raw.append(50.0)

        # QUALITY: low vol + up-day fraction
        if len(s.prices) >= 10:
            prices = np.asarray(s.prices, dtype=np.float64)
            rets = calculate_returns(prices, log=True)
            vol = float(np.std(rets)) if len(rets) > 1 else 1.0
            up_frac = float(np.mean(rets > 0)) if len(rets) > 0 else 0.5
            # Lower vol is better -> invert
            quality_scores_raw.append(up_frac * 100 + (1.0 / (vol + 1e-6)) * 0.01)
        else:
            quality_scores_raw.append(50.0)

        # GROWTH: price acceleration (2nd derivative)
        if len(s.prices) >= 10:
            prices = np.asarray(s.prices, dtype=np.float64)
            first_deriv = np.diff(prices)
            second_deriv = np.diff(first_deriv)
            accel = float(np.mean(second_deriv[-min(10, len(second_deriv)):]))
            # Normalise by price level
            growth_scores_raw.append(accel / (prices[-1] + 1e-8) * 1000)
        else:
            growth_scores_raw.append(0.0)

    # --- Percentile-rank each factor ---
    value_pct = _percentile_rank(value_scores_raw)
    momentum_pct = _percentile_rank(momentum_scores_raw)
    quality_pct = _percentile_rank(quality_scores_raw)
    growth_pct = _percentile_rank(growth_scores_raw)

    # --- Composite ---
    wv = f.valueWeight
    wm = f.momentumWeight
    wq = f.qualityWeight
    wg = f.growthWeight
    total_w = wv + wm + wq + wg
    if total_w <= 0:
        total_w = 1.0

    ranked: list[ScoredStock] = []
    for i, s in enumerate(filtered):
        composite = (
            wv * value_pct[i] +
            wm * momentum_pct[i] +
            wq * quality_pct[i] +
            wg * growth_pct[i]
        ) / total_w
        ranked.append(ScoredStock(
            symbol=s.symbol,
            compositeScore=round(safe_float(composite), 2),
            valueScore=round(safe_float(value_pct[i]), 2),
            momentumScore=round(safe_float(momentum_pct[i]), 2),
            qualityScore=round(safe_float(quality_pct[i]), 2),
            growthScore=round(safe_float(growth_pct[i]), 2),
            price=s.price,
            pe=s.pe,
            divYield=s.divYield,
        ))

    ranked.sort(key=lambda x: x.compositeScore, reverse=True)

    return ScreenerResponse(
        ranked=ranked,
        totalScreened=len(req.stocks),
        passedFilters=len(filtered),
    )
