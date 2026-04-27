"""
Technical analysis router — indicator computation, support/resistance
detection, and chart-pattern recognition.

All indicator maths is delegated to the ``ta`` library where possible;
support/resistance uses scipy.signal and sklearn clustering; pattern
detection uses numpy peak analysis.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.signal import argrelextrema
from sklearn.cluster import KMeans
from fastapi import APIRouter, HTTPException

import ta
from ta.trend import (
    SMAIndicator, EMAIndicator, MACD, ADXIndicator,
    IchimokuIndicator, PSARIndicator,
)
from ta.momentum import (
    RSIIndicator, StochRSIIndicator, StochasticOscillator,
    WilliamsRIndicator, ROCIndicator,
)
from ta.volatility import (
    BollingerBands, AverageTrueRange, KeltnerChannel, DonchianChannel,
)
from ta.volume import (
    OnBalanceVolumeIndicator, AccDistIndexIndicator,
    ChaikinMoneyFlowIndicator, MFIIndicator,
)

from models.schemas import (
    TechnicalAnalysisRequest, TechnicalAnalysisResponse, IndicatorSignal,
    SupportResistanceRequest, SupportResistanceResponse,
    PatternDetectionRequest, PatternDetectionResponse, DetectedPattern,
)
from services.data_service import prices_to_dataframe, safe_float

router = APIRouter(prefix="/api", tags=["technical"])


def _sig(val, lower, upper) -> str:
    """Map a numeric value to bullish/bearish/neutral."""
    if val is None or np.isnan(val):
        return "neutral"
    if val < lower:
        return "bearish"
    if val > upper:
        return "bullish"
    return "neutral"


def _last(series: pd.Series):
    """Return last non-NaN float or None."""
    s = series.dropna()
    return safe_float(s.iloc[-1]) if len(s) > 0 else None


# ======================================================================
# POST /api/technical-analysis
# ======================================================================

@router.post("/technical-analysis", response_model=TechnicalAnalysisResponse)
async def technical_analysis(req: TechnicalAnalysisRequest):
    """Compute a full suite of technical indicators and interpret signals."""
    if len(req.prices) < 30:
        raise HTTPException(400, "At least 30 price points are required.")

    df = prices_to_dataframe(req.prices, req.volumes, req.highs, req.lows, req.opens)
    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]
    last_close = float(close.iloc[-1])

    trend: dict[str, IndicatorSignal] = {}
    momentum: dict[str, IndicatorSignal] = {}
    volatility_ind: dict[str, IndicatorSignal] = {}
    vol_ind: dict[str, IndicatorSignal] = {}

    # ---- TREND ----
    sma20 = _last(SMAIndicator(close, window=20).sma_indicator())
    sma50 = _last(SMAIndicator(close, window=50).sma_indicator())
    sma200 = _last(SMAIndicator(close, window=200).sma_indicator()) if len(close) >= 200 else None

    trend["SMA"] = IndicatorSignal(
        values={"SMA20": sma20, "SMA50": sma50, "SMA200": sma200},
        signal="bullish" if (sma20 and sma50 and sma20 > sma50) else
                "bearish" if (sma20 and sma50 and sma20 < sma50) else "neutral",
    )

    ema12 = _last(EMAIndicator(close, window=12).ema_indicator())
    ema26 = _last(EMAIndicator(close, window=26).ema_indicator())
    trend["EMA"] = IndicatorSignal(
        values={"EMA12": ema12, "EMA26": ema26},
        signal="bullish" if (ema12 and ema26 and ema12 > ema26) else
                "bearish" if (ema12 and ema26 and ema12 < ema26) else "neutral",
    )

    macd_obj = MACD(close, window_slow=26, window_fast=12, window_sign=9)
    macd_val = _last(macd_obj.macd())
    macd_sig = _last(macd_obj.macd_signal())
    macd_hist = _last(macd_obj.macd_diff())
    trend["MACD"] = IndicatorSignal(
        values={"macd": macd_val, "signal": macd_sig, "histogram": macd_hist},
        signal="bullish" if (macd_hist and macd_hist > 0) else
                "bearish" if (macd_hist and macd_hist < 0) else "neutral",
    )

    adx_obj = ADXIndicator(high, low, close, window=14)
    adx_val = _last(adx_obj.adx())
    plus_di = _last(adx_obj.adx_pos())
    minus_di = _last(adx_obj.adx_neg())
    trend["ADX"] = IndicatorSignal(
        values={"ADX": adx_val, "+DI": plus_di, "-DI": minus_di},
        signal="bullish" if (plus_di and minus_di and plus_di > minus_di) else
                "bearish" if (plus_di and minus_di and plus_di < minus_di) else "neutral",
    )

    ichi = IchimokuIndicator(high, low, window1=9, window2=26, window3=52)
    ichi_a = _last(ichi.ichimoku_a())
    ichi_b = _last(ichi.ichimoku_b())
    trend["Ichimoku"] = IndicatorSignal(
        values={"senkou_a": ichi_a, "senkou_b": ichi_b},
        signal="bullish" if (ichi_a and ichi_b and last_close > max(ichi_a, ichi_b)) else
                "bearish" if (ichi_a and ichi_b and last_close < min(ichi_a, ichi_b)) else "neutral",
    )

    psar = PSARIndicator(high, low, close)
    psar_val = _last(psar.psar())
    trend["ParabolicSAR"] = IndicatorSignal(
        value=psar_val,
        signal="bullish" if (psar_val and last_close > psar_val) else
                "bearish" if (psar_val and last_close < psar_val) else "neutral",
    )

    # VWAP (cumulative) — placed in trend section
    if volume.sum() > 0:
        cum_vol = volume.cumsum()
        cum_tp_vol = ((high + low + close) / 3 * volume).cumsum()
        vwap_val = safe_float(float(cum_tp_vol.iloc[-1] / cum_vol.iloc[-1])) if cum_vol.iloc[-1] > 0 else None
    else:
        vwap_val = None
    trend["VWAP"] = IndicatorSignal(
        value=vwap_val,
        signal="bullish" if (vwap_val and last_close > vwap_val) else
                "bearish" if (vwap_val and last_close < vwap_val) else "neutral",
    )

    # ---- MOMENTUM ----
    rsi_val = _last(RSIIndicator(close, window=14).rsi())
    momentum["RSI"] = IndicatorSignal(
        value=rsi_val,
        signal="bearish" if (rsi_val and rsi_val > 70) else
                "bullish" if (rsi_val and rsi_val < 30) else "neutral",
    )

    stoch = StochasticOscillator(high, low, close, window=14, smooth_window=3)
    stoch_k = _last(stoch.stoch())
    stoch_d = _last(stoch.stoch_signal())
    momentum["Stochastic"] = IndicatorSignal(
        values={"%K": stoch_k, "%D": stoch_d},
        signal="bearish" if (stoch_k and stoch_k > 80) else
                "bullish" if (stoch_k and stoch_k < 20) else "neutral",
    )

    wr = _last(WilliamsRIndicator(high, low, close, lbp=14).williams_r())
    momentum["WilliamsR"] = IndicatorSignal(
        value=wr,
        signal="bearish" if (wr and wr > -20) else
                "bullish" if (wr and wr < -80) else "neutral",
    )

    # CCI via ta.trend
    from ta.trend import CCIIndicator
    cci_val = _last(CCIIndicator(high, low, close, window=20).cci())
    momentum["CCI"] = IndicatorSignal(
        value=cci_val,
        signal="bullish" if (cci_val and cci_val > 100) else
                "bearish" if (cci_val and cci_val < -100) else "neutral",
    )

    roc_val = _last(ROCIndicator(close, window=12).roc())
    momentum["ROC"] = IndicatorSignal(
        value=roc_val,
        signal="bullish" if (roc_val and roc_val > 0) else
                "bearish" if (roc_val and roc_val < 0) else "neutral",
    )

    if volume.sum() > 0:
        mfi_val = _last(MFIIndicator(high, low, close, volume, window=14).money_flow_index())
    else:
        mfi_val = None
    momentum["MFI"] = IndicatorSignal(
        value=mfi_val,
        signal="bearish" if (mfi_val and mfi_val > 80) else
                "bullish" if (mfi_val and mfi_val < 20) else "neutral",
    )

    # ---- VOLATILITY ----
    bb = BollingerBands(close, window=20, window_dev=2)
    bb_upper = _last(bb.bollinger_hband())
    bb_lower = _last(bb.bollinger_lband())
    bb_mid = _last(bb.bollinger_mavg())
    volatility_ind["BollingerBands"] = IndicatorSignal(
        values={"upper": bb_upper, "middle": bb_mid, "lower": bb_lower},
        signal="bearish" if (bb_upper and last_close > bb_upper) else
                "bullish" if (bb_lower and last_close < bb_lower) else "neutral",
    )

    atr_val = _last(AverageTrueRange(high, low, close, window=14).average_true_range())
    volatility_ind["ATR"] = IndicatorSignal(value=atr_val, signal="neutral")

    kc = KeltnerChannel(high, low, close, window=20)
    kc_upper = _last(kc.keltner_channel_hband())
    kc_lower = _last(kc.keltner_channel_lband())
    volatility_ind["KeltnerChannels"] = IndicatorSignal(
        values={"upper": kc_upper, "lower": kc_lower},
        signal="bearish" if (kc_upper and last_close > kc_upper) else
                "bullish" if (kc_lower and last_close < kc_lower) else "neutral",
    )

    dc = DonchianChannel(high, low, close, window=20)
    dc_upper = _last(dc.donchian_channel_hband())
    dc_lower = _last(dc.donchian_channel_lband())
    volatility_ind["DonchianChannels"] = IndicatorSignal(
        values={"upper": dc_upper, "lower": dc_lower},
        signal="bullish" if (dc_upper and last_close >= dc_upper) else
                "bearish" if (dc_lower and last_close <= dc_lower) else "neutral",
    )

    # ---- VOLUME ----
    if volume.sum() > 0:
        obv_val = _last(OnBalanceVolumeIndicator(close, volume).on_balance_volume())
        ad_val = _last(AccDistIndexIndicator(high, low, close, volume).acc_dist_index())
        cmf_val = _last(ChaikinMoneyFlowIndicator(high, low, close, volume, window=20).chaikin_money_flow())
    else:
        obv_val = ad_val = cmf_val = None

    vol_ind["OBV"] = IndicatorSignal(value=obv_val, signal="neutral")
    vol_ind["VWAP"] = IndicatorSignal(value=vwap_val, signal="neutral")
    vol_ind["AccumulationDistribution"] = IndicatorSignal(value=ad_val, signal="neutral")
    vol_ind["ChaikinMoneyFlow"] = IndicatorSignal(
        value=cmf_val,
        signal="bullish" if (cmf_val and cmf_val > 0.05) else
                "bearish" if (cmf_val and cmf_val < -0.05) else "neutral",
    )

    # ---- FIBONACCI RETRACEMENT ----
    # Use swing high/low from the price series with ATR-adaptive tolerance
    swing_high = float(high.max())
    swing_low = float(low.min())
    fib_diff = swing_high - swing_low
    fib_levels = {
        "0%": round(swing_high, 4),
        "23.6%": round(swing_high - 0.236 * fib_diff, 4),
        "38.2%": round(swing_high - 0.382 * fib_diff, 4),
        "50%": round(swing_high - 0.5 * fib_diff, 4),
        "61.8%": round(swing_high - 0.618 * fib_diff, 4),
        "78.6%": round(swing_high - 0.786 * fib_diff, 4),
        "100%": round(swing_low, 4),
    }
    # Signal: bullish if price near support levels (61.8%+), bearish if near resistance (23.6%-)
    fib_position = (swing_high - last_close) / fib_diff if fib_diff > 0 else 0.5
    fib_signal = "bullish" if fib_position > 0.618 else "bearish" if fib_position < 0.236 else "neutral"
    trend["Fibonacci"] = IndicatorSignal(
        values=fib_levels,
        signal=fib_signal,
    )

    # Aggregate signal count
    all_signals = (
        [v.signal for v in trend.values()]
        + [v.signal for v in momentum.values()]
        + [v.signal for v in volatility_ind.values()]
        + [v.signal for v in vol_ind.values()]
    )
    bull = sum(1 for s in all_signals if s == "bullish")
    bear = sum(1 for s in all_signals if s == "bearish")
    neut = sum(1 for s in all_signals if s == "neutral")
    overall = "bullish" if bull > bear + neut * 0.5 else "bearish" if bear > bull + neut * 0.5 else "neutral"

    return TechnicalAnalysisResponse(
        trend=trend,
        momentum=momentum,
        volatility=volatility_ind,
        volume=vol_ind,
        overallSignal=overall,
        bullishCount=bull,
        bearishCount=bear,
        neutralCount=neut,
    )


# ======================================================================
# POST /api/support-resistance
# ======================================================================

@router.post("/support-resistance", response_model=SupportResistanceResponse)
async def support_resistance(req: SupportResistanceRequest):
    """
    Detect support and resistance levels using local extrema (scipy) and
    KMeans clustering (sklearn) to consolidate nearby levels.
    """
    prices = np.asarray(req.prices, dtype=np.float64)
    if len(prices) < 20:
        raise HTTPException(400, "At least 20 price points are required.")

    current = float(prices[-1])
    order = max(5, len(prices) // 20)

    # Find local minima (supports) and maxima (resistances)
    local_min_idx = argrelextrema(prices, np.less_equal, order=order)[0]
    local_max_idx = argrelextrema(prices, np.greater_equal, order=order)[0]

    local_mins = prices[local_min_idx] if len(local_min_idx) > 0 else np.array([prices.min()])
    local_maxs = prices[local_max_idx] if len(local_max_idx) > 0 else np.array([prices.max()])

    def _cluster_levels(values: np.ndarray, n_clusters: int) -> list[float]:
        n_clusters = min(n_clusters, len(values))
        if n_clusters < 1:
            return []
        if n_clusters == 1:
            return [float(np.mean(values))]
        km = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
        km.fit(values.reshape(-1, 1))
        return sorted(float(c) for c in km.cluster_centers_.flatten())

    n_sup = min(req.numLevels, len(local_mins))
    n_res = min(req.numLevels, len(local_maxs))

    supports = _cluster_levels(local_mins, n_sup)
    resistances = _cluster_levels(local_maxs, n_res)

    # Filter: supports below current, resistances above current
    supports = sorted([s for s in supports if s < current], reverse=True)
    resistances = sorted([r for r in resistances if r > current])

    # If nothing qualified, take nearest from raw
    if not supports:
        supports = [float(local_mins.min())]
    if not resistances:
        resistances = [float(local_maxs.max())]

    nearest_sup = supports[0] if supports else None
    nearest_res = resistances[0] if resistances else None

    # Determine position
    if nearest_sup and nearest_res:
        range_size = nearest_res - nearest_sup
        if range_size > 0:
            pct = (current - nearest_sup) / range_size
            position = "near_support" if pct < 0.33 else "near_resistance" if pct > 0.67 else "mid_range"
        else:
            position = "mid_range"
    elif nearest_sup:
        position = "near_support"
    else:
        position = "near_resistance"

    return SupportResistanceResponse(
        supportLevels=[round(s, 4) for s in supports],
        resistanceLevels=[round(r, 4) for r in resistances],
        currentPrice=round(current, 4),
        nearestSupport=round(nearest_sup, 4) if nearest_sup else None,
        nearestResistance=round(nearest_res, 4) if nearest_res else None,
        position=position,
    )


# ======================================================================
# POST /api/pattern-detection
# ======================================================================

def _find_peaks_troughs(prices: np.ndarray, order: int = 5):
    """Return (peak_indices, trough_indices) using scipy."""
    peaks = argrelextrema(prices, np.greater_equal, order=order)[0]
    troughs = argrelextrema(prices, np.less_equal, order=order)[0]
    return peaks, troughs


@router.post("/pattern-detection", response_model=PatternDetectionResponse)
async def pattern_detection(req: PatternDetectionRequest):
    """
    Detect classic chart patterns via geometric analysis of peaks/troughs.

    Patterns detected:
      - Head & Shoulders / Inverse
      - Double Top / Double Bottom
      - Ascending / Descending / Symmetric Triangle
      - Cup & Handle
      - Flag / Pennant
    """
    prices = np.asarray(req.prices, dtype=np.float64)
    if len(prices) < 30:
        raise HTTPException(400, "At least 30 price points required for pattern detection.")

    detected: list[DetectedPattern] = []
    order = max(3, len(prices) // 30)
    peaks, troughs = _find_peaks_troughs(prices, order=order)

    tol = 0.02  # 2% tolerance for "equal" levels

    # --- Double Top ---
    if len(peaks) >= 2:
        p1, p2 = peaks[-2], peaks[-1]
        v1, v2 = prices[p1], prices[p2]
        if abs(v1 - v2) / max(v1, 1e-8) < tol and p2 > p1:
            neckline = prices[p1:p2 + 1].min()
            target = neckline - (v1 - neckline)
            detected.append(DetectedPattern(
                pattern="Double Top",
                direction="bearish",
                confidence=round(1.0 - abs(v1 - v2) / max(v1, 1e-8) / tol, 3),
                startIndex=int(p1),
                endIndex=int(p2),
                priceTarget=round(float(target), 4),
                description=f"Two peaks near {v1:.2f} with neckline at {neckline:.2f}.",
            ))

    # --- Double Bottom ---
    if len(troughs) >= 2:
        t1, t2 = troughs[-2], troughs[-1]
        v1, v2 = prices[t1], prices[t2]
        if abs(v1 - v2) / max(v1, 1e-8) < tol and t2 > t1:
            neckline = prices[t1:t2 + 1].max()
            target = neckline + (neckline - v1)
            detected.append(DetectedPattern(
                pattern="Double Bottom",
                direction="bullish",
                confidence=round(1.0 - abs(v1 - v2) / max(v1, 1e-8) / tol, 3),
                startIndex=int(t1),
                endIndex=int(t2),
                priceTarget=round(float(target), 4),
                description=f"Two troughs near {v1:.2f} with neckline at {neckline:.2f}.",
            ))

    # --- Head & Shoulders ---
    if len(peaks) >= 3 and len(troughs) >= 2:
        lp, hp, rp = peaks[-3], peaks[-2], peaks[-1]
        lv, hv, rv = prices[lp], prices[hp], prices[rp]
        # Head must be higher than both shoulders; shoulders roughly equal
        if hv > lv and hv > rv and abs(lv - rv) / max(lv, 1e-8) < tol * 2:
            # Neckline from two troughs between the shoulders
            between_troughs = troughs[(troughs > lp) & (troughs < rp)]
            if len(between_troughs) >= 1:
                neckline = float(prices[between_troughs].mean())
                target = neckline - (hv - neckline)
                detected.append(DetectedPattern(
                    pattern="Head and Shoulders",
                    direction="bearish",
                    confidence=round(min(0.95, (hv - max(lv, rv)) / max(hv, 1e-8) * 5), 3),
                    startIndex=int(lp),
                    endIndex=int(rp),
                    priceTarget=round(target, 4),
                    description=f"Head at {hv:.2f}, shoulders at {lv:.2f}/{rv:.2f}, neckline {neckline:.2f}.",
                ))

    # --- Inverse Head & Shoulders ---
    if len(troughs) >= 3 and len(peaks) >= 2:
        lt, ht, rt = troughs[-3], troughs[-2], troughs[-1]
        lv, hv, rv = prices[lt], prices[ht], prices[rt]
        if hv < lv and hv < rv and abs(lv - rv) / max(lv, 1e-8) < tol * 2:
            between_peaks = peaks[(peaks > lt) & (peaks < rt)]
            if len(between_peaks) >= 1:
                neckline = float(prices[between_peaks].mean())
                target = neckline + (neckline - hv)
                detected.append(DetectedPattern(
                    pattern="Inverse Head and Shoulders",
                    direction="bullish",
                    confidence=round(min(0.95, (min(lv, rv) - hv) / max(min(lv, rv), 1e-8) * 5), 3),
                    startIndex=int(lt),
                    endIndex=int(rt),
                    priceTarget=round(target, 4),
                    description=f"Head at {hv:.2f}, shoulders at {lv:.2f}/{rv:.2f}.",
                ))

    # --- Triangles (ascending / descending / symmetric) ---
    if len(peaks) >= 3 and len(troughs) >= 3:
        recent_peaks = peaks[-3:]
        recent_troughs = troughs[-3:]
        peak_vals = prices[recent_peaks]
        trough_vals = prices[recent_troughs]

        peak_slope = np.polyfit(np.arange(len(peak_vals)), peak_vals, 1)[0]
        trough_slope = np.polyfit(np.arange(len(trough_vals)), trough_vals, 1)[0]

        flat_threshold = 0.005 * prices.mean()
        start_idx = int(min(recent_peaks[0], recent_troughs[0]))
        end_idx = int(max(recent_peaks[-1], recent_troughs[-1]))

        if abs(peak_slope) < flat_threshold and trough_slope > flat_threshold:
            pattern_type = "Ascending Triangle"
            direction = "bullish"
            confidence = 0.7
        elif peak_slope < -flat_threshold and abs(trough_slope) < flat_threshold:
            pattern_type = "Descending Triangle"
            direction = "bearish"
            confidence = 0.7
        elif peak_slope < -flat_threshold and trough_slope > flat_threshold:
            pattern_type = "Symmetric Triangle"
            direction = "neutral"
            confidence = 0.6
        else:
            pattern_type = None

        if pattern_type:
            height = float(peak_vals.max() - trough_vals.min())
            breakout = float(prices[-1])
            target = breakout + height if direction != "bearish" else breakout - height
            detected.append(DetectedPattern(
                pattern=pattern_type,
                direction=direction if direction != "neutral" else "bullish",
                confidence=round(confidence, 3),
                startIndex=start_idx,
                endIndex=end_idx,
                priceTarget=round(target, 4),
                description=f"{pattern_type} detected over indices {start_idx}-{end_idx}.",
            ))

    # --- Cup & Handle ---
    if len(prices) >= 40:
        # Look for U-shape in last 60% of data
        segment = prices[len(prices) // 3:]
        mid = len(segment) // 2
        left_max = segment[:mid].max()
        right_max = segment[mid:].max()
        cup_bottom = segment[:mid].min()
        if (left_max > cup_bottom * 1.05 and right_max > cup_bottom * 1.05
                and abs(left_max - right_max) / max(left_max, 1e-8) < 0.05):
            detected.append(DetectedPattern(
                pattern="Cup and Handle",
                direction="bullish",
                confidence=0.6,
                startIndex=len(prices) // 3,
                endIndex=len(prices) - 1,
                priceTarget=round(float(right_max + (right_max - cup_bottom)), 4),
                description=f"Cup bottom at {cup_bottom:.2f}, rim ~{left_max:.2f}.",
            ))

    # --- Flag / Pennant ---
    if len(prices) >= 20:
        # Detect strong move followed by consolidation
        lookback = min(30, len(prices) // 2)
        seg = prices[-lookback:]
        first_half = seg[: lookback // 3]
        second_half = seg[lookback // 3:]
        trend_move = first_half[-1] - first_half[0]
        consol_range = second_half.max() - second_half.min()
        trend_range = abs(trend_move)
        if trend_range > 0 and consol_range / trend_range < 0.5 and trend_range / max(first_half[0], 1e-8) > 0.03:
            direction = "bullish" if trend_move > 0 else "bearish"
            detected.append(DetectedPattern(
                pattern="Flag",
                direction=direction,
                confidence=round(min(0.85, 1.0 - consol_range / trend_range), 3),
                startIndex=len(prices) - lookback,
                endIndex=len(prices) - 1,
                priceTarget=round(float(prices[-1] + trend_move), 4),
                description=f"{'Bull' if direction == 'bullish' else 'Bear'} flag — "
                            f"move of {trend_move:.2f} then consolidation range {consol_range:.2f}.",
            ))

    return PatternDetectionResponse(
        patterns=detected,
        symbol=req.symbol,
    )
