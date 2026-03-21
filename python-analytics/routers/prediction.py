"""
ML-based price prediction and strategy backtesting router.

Models used:
  - Linear Regression (baseline)
  - Random Forest (sklearn)
  - ARIMA + GARCH (statsmodels)
Ensemble via weighted average with inverse-MSE weighting.
"""

from __future__ import annotations

import warnings
import numpy as np
import pandas as pd
from scipy import stats as sp_stats
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from fastapi import APIRouter, HTTPException

from models.schemas import (
    PredictRequest, PredictResponse, PredictionDay, FeatureImportance,
    BacktestRequest, BacktestResponse, TradeRecord,
)
from services.data_service import calculate_returns, safe_float

router = APIRouter(prefix="/api", tags=["prediction"])

warnings.filterwarnings("ignore")  # suppress statsmodels convergence noise

TRADING_DAYS = 252


# ======================================================================
# Feature engineering
# ======================================================================

def _build_features(prices: np.ndarray, volumes: np.ndarray | None = None) -> tuple[np.ndarray, list[str]]:
    """
    Create a feature matrix from price (and optional volume) series.

    Features:
      - Lagged log-returns (1, 2, 3, 5, 10 days)
      - MA ratios: price / SMA(5), price / SMA(20)
      - RSI(14)
      - Realised volatility (10-day, 20-day)
      - Volume ratio (current / SMA(20)) — if volumes provided
    Returns (X, feature_names) where each row aligns with the price at that index.
    """
    n = len(prices)
    log_ret = np.zeros(n)
    log_ret[1:] = np.diff(np.log(prices))

    feats: dict[str, np.ndarray] = {}

    for lag in [1, 2, 3, 5, 10]:
        shifted = np.zeros(n)
        shifted[lag:] = log_ret[:-lag] if lag < n else 0
        feats[f"ret_lag{lag}"] = shifted

    for window in [5, 20]:
        sma = pd.Series(prices).rolling(window, min_periods=1).mean().values
        feats[f"price_sma{window}_ratio"] = prices / np.where(sma > 0, sma, 1)

    # RSI(14)
    delta = np.zeros(n)
    delta[1:] = np.diff(prices)
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    avg_gain = pd.Series(gain).rolling(14, min_periods=1).mean().values
    avg_loss = pd.Series(loss).rolling(14, min_periods=1).mean().values
    rs = avg_gain / np.where(avg_loss > 0, avg_loss, 1e-10)
    feats["rsi14"] = 100 - 100 / (1 + rs)

    # Realised volatility
    for window in [10, 20]:
        rv = pd.Series(log_ret).rolling(window, min_periods=1).std().values
        feats[f"vol_{window}d"] = rv

    # Volume ratio
    if volumes is not None and len(volumes) == n and np.sum(volumes) > 0:
        vol_sma = pd.Series(volumes).rolling(20, min_periods=1).mean().values
        feats["volume_ratio"] = volumes / np.where(vol_sma > 0, vol_sma, 1)

    names = list(feats.keys())
    X = np.column_stack([feats[k] for k in names])
    return X, names


# ======================================================================
# POST /api/predict
# ======================================================================

@router.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """
    Ensemble price prediction using Linear Regression, Random Forest, and ARIMA.

    Confidence intervals are derived from the ensemble residual standard
    deviation:  CI = predicted +/- z * sigma_residual * sqrt(day).
    """
    prices = np.asarray(req.prices, dtype=np.float64)
    if len(prices) < 60:
        raise HTTPException(400, "At least 60 price points are required for prediction.")

    volumes = np.asarray(req.volumes, dtype=np.float64) if req.volumes and len(req.volumes) == len(prices) else None
    horizon = req.horizon
    last_price = float(prices[-1])

    X, feat_names = _build_features(prices, volumes)
    # Target: next-day log return
    y = np.zeros(len(prices))
    y[:-1] = np.diff(np.log(prices))
    y[-1] = y[-2]  # placeholder for last row

    # Train/test split — use last 20% as validation for weighting
    split = max(30, int(len(prices) * 0.8))
    X_train, X_val = X[20:split], X[split:]
    y_train, y_val = y[20:split], y[split:]

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_val_s = scaler.transform(X_val)
    X_last_s = scaler.transform(X[-1:])

    # -- Linear Regression --
    lr = LinearRegression()
    lr.fit(X_train_s, y_train)
    lr_val_pred = lr.predict(X_val_s)
    lr_mse = float(np.mean((lr_val_pred - y_val) ** 2)) + 1e-10

    # -- Random Forest --
    rf = RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1)
    rf.fit(X_train_s, y_train)
    rf_val_pred = rf.predict(X_val_s)
    rf_mse = float(np.mean((rf_val_pred - y_val) ** 2)) + 1e-10

    # Feature importance from RF
    importances = rf.feature_importances_
    fi = [FeatureImportance(feature=feat_names[i], importance=round(float(importances[i]), 6))
          for i in np.argsort(importances)[::-1]]

    # -- ARIMA (statsmodels) --
    arima_preds_val = np.zeros(len(y_val))
    arima_mse = 1e-2  # fallback
    try:
        from statsmodels.tsa.arima.model import ARIMA
        log_returns = np.diff(np.log(prices[:split]))
        model = ARIMA(log_returns, order=(2, 0, 2))
        fit = model.fit()
        arima_forecast = fit.forecast(steps=len(y_val))
        arima_preds_val = np.asarray(arima_forecast)
        arima_mse = float(np.mean((arima_preds_val - y_val) ** 2)) + 1e-10
    except Exception:
        arima_preds_val = np.full(len(y_val), np.mean(y_train))
        arima_mse = float(np.mean((arima_preds_val - y_val) ** 2)) + 1e-10

    # -- Inverse-MSE ensemble weights --
    inv = np.array([1 / lr_mse, 1 / rf_mse, 1 / arima_mse])
    w = inv / inv.sum()

    # -- Multi-step forecast --
    lr_preds: list[float] = []
    rf_preds: list[float] = []
    arima_preds: list[float] = []

    current_features = X[-1:].copy()
    log_price = np.log(last_price)

    # ARIMA forecast for full horizon
    try:
        from statsmodels.tsa.arima.model import ARIMA
        log_rets_full = np.diff(np.log(prices))
        arima_model = ARIMA(log_rets_full, order=(2, 0, 2))
        arima_fit = arima_model.fit()
        arima_horizon = arima_fit.forecast(steps=horizon)
    except Exception:
        arima_horizon = np.full(horizon, float(np.mean(y_train)))

    for d in range(horizon):
        cur_s = scaler.transform(current_features)
        lr_r = float(lr.predict(cur_s)[0])
        rf_r = float(rf.predict(cur_s)[0])
        ar_r = float(arima_horizon[d]) if d < len(arima_horizon) else float(np.mean(y_train))

        lr_preds.append(lr_r)
        rf_preds.append(rf_r)
        arima_preds.append(ar_r)

        # Advance features simplistically: shift lags
        next_feat = current_features.copy()
        # Update lagged returns
        ensemble_r = w[0] * lr_r + w[1] * rf_r + w[2] * ar_r
        for i, lag in enumerate([1, 2, 3, 5, 10]):
            if i < next_feat.shape[1]:
                next_feat[0, i] = ensemble_r if lag == 1 else current_features[0, max(0, i - 1)]
        current_features = next_feat

    # Build prediction output
    ensemble_rets = w[0] * np.array(lr_preds) + w[1] * np.array(rf_preds) + w[2] * np.array(arima_preds)

    # Residual std from validation
    val_ensemble = w[0] * lr_val_pred + w[1] * rf_val_pred + w[2] * arima_preds_val
    residual_std = float(np.std(val_ensemble - y_val)) if len(y_val) > 1 else 0.01

    predictions: list[PredictionDay] = []
    cum_log_ret = 0.0
    for d in range(horizon):
        cum_log_ret += ensemble_rets[d]
        pred_price = last_price * np.exp(cum_log_ret)
        day_std = residual_std * np.sqrt(d + 1) * last_price
        predictions.append(PredictionDay(
            day=d + 1,
            price=round(safe_float(pred_price), 4),
            lower68=round(safe_float(pred_price - day_std), 4),
            upper68=round(safe_float(pred_price + day_std), 4),
            lower95=round(safe_float(pred_price - 1.96 * day_std), 4),
            upper95=round(safe_float(pred_price + 1.96 * day_std), 4),
        ))

    # Model agreement = 1 - normalised std of model predictions (last day)
    model_final = np.array([
        last_price * np.exp(np.sum(lr_preds)),
        last_price * np.exp(np.sum(rf_preds)),
        last_price * np.exp(np.sum(arima_preds)),
    ])
    model_spread = float(np.std(model_final) / np.mean(model_final)) if np.mean(model_final) > 0 else 0
    agreement = round(max(0.0, 1.0 - model_spread * 5), 4)

    return PredictResponse(
        predictions=predictions,
        featureImportance=fi,
        modelAgreement=agreement,
        modelBreakdown={
            "linearRegression": [round(last_price * np.exp(sum(lr_preds[:d + 1])), 4) for d in range(horizon)],
            "randomForest": [round(last_price * np.exp(sum(rf_preds[:d + 1])), 4) for d in range(horizon)],
            "arima": [round(last_price * np.exp(sum(arima_preds[:d + 1])), 4) for d in range(horizon)],
        },
        lastPrice=last_price,
    )


# ======================================================================
# POST /api/backtest
# ======================================================================

def _ma_crossover_signals(prices: np.ndarray, params: dict) -> list[int]:
    """Return +1 (buy), -1 (sell), 0 (hold) for each bar."""
    fast = params.get("fast", 10)
    slow = params.get("slow", 30)
    sma_fast = pd.Series(prices).rolling(fast, min_periods=1).mean().values
    sma_slow = pd.Series(prices).rolling(slow, min_periods=1).mean().values
    signals = [0] * len(prices)
    for i in range(1, len(prices)):
        if sma_fast[i] > sma_slow[i] and sma_fast[i - 1] <= sma_slow[i - 1]:
            signals[i] = 1
        elif sma_fast[i] < sma_slow[i] and sma_fast[i - 1] >= sma_slow[i - 1]:
            signals[i] = -1
    return signals


def _rsi_reversal_signals(prices: np.ndarray, params: dict) -> list[int]:
    """RSI oversold/overbought reversal."""
    period = params.get("period", 14)
    oversold = params.get("oversold", 30)
    overbought = params.get("overbought", 70)
    delta = np.diff(prices, prepend=prices[0])
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    avg_gain = pd.Series(gain).rolling(period, min_periods=1).mean().values
    avg_loss = pd.Series(loss).rolling(period, min_periods=1).mean().values
    rs = avg_gain / np.where(avg_loss > 0, avg_loss, 1e-10)
    rsi = 100 - 100 / (1 + rs)
    signals = [0] * len(prices)
    for i in range(1, len(prices)):
        if rsi[i] > oversold and rsi[i - 1] <= oversold:
            signals[i] = 1
        elif rsi[i] < overbought and rsi[i - 1] >= overbought:
            signals[i] = -1
    return signals


def _bollinger_breakout_signals(prices: np.ndarray, params: dict) -> list[int]:
    """Buy on lower-band touch, sell on upper-band touch."""
    window = params.get("window", 20)
    num_std = params.get("numStd", 2.0)
    sma = pd.Series(prices).rolling(window, min_periods=1).mean().values
    std = pd.Series(prices).rolling(window, min_periods=1).std().fillna(0).values
    upper = sma + num_std * std
    lower = sma - num_std * std
    signals = [0] * len(prices)
    for i in range(1, len(prices)):
        if prices[i] <= lower[i]:
            signals[i] = 1
        elif prices[i] >= upper[i]:
            signals[i] = -1
    return signals


def _macd_signal_signals(prices: np.ndarray, params: dict) -> list[int]:
    """MACD line crossing signal line."""
    fast = params.get("fast", 12)
    slow = params.get("slow", 26)
    signal_w = params.get("signal", 9)
    ema_fast = pd.Series(prices).ewm(span=fast, adjust=False).mean().values
    ema_slow = pd.Series(prices).ewm(span=slow, adjust=False).mean().values
    macd_line = ema_fast - ema_slow
    signal_line = pd.Series(macd_line).ewm(span=signal_w, adjust=False).mean().values
    signals = [0] * len(prices)
    for i in range(1, len(prices)):
        if macd_line[i] > signal_line[i] and macd_line[i - 1] <= signal_line[i - 1]:
            signals[i] = 1
        elif macd_line[i] < signal_line[i] and macd_line[i - 1] >= signal_line[i - 1]:
            signals[i] = -1
    return signals


STRATEGY_MAP = {
    "MA_CROSSOVER": _ma_crossover_signals,
    "RSI_REVERSAL": _rsi_reversal_signals,
    "BOLLINGER_BREAKOUT": _bollinger_breakout_signals,
    "MACD_SIGNAL": _macd_signal_signals,
}


@router.post("/backtest", response_model=BacktestResponse)
async def backtest(req: BacktestRequest):
    """
    Backtest a trading strategy on historical price data.

    Simulates a simple long/flat strategy: buy signal -> go 100% long,
    sell signal -> exit to cash.  Computes standard performance metrics
    and compares against buy-and-hold.
    """
    prices = np.asarray(req.prices, dtype=np.float64)
    if len(prices) < 30:
        raise HTTPException(400, "At least 30 price points required for backtest.")

    strategy_fn = STRATEGY_MAP.get(req.strategy.type.upper())
    if strategy_fn is None:
        raise HTTPException(400, f"Unknown strategy type: {req.strategy.type}. "
                                 f"Choose from {list(STRATEGY_MAP.keys())}.")

    signals = strategy_fn(prices, req.strategy.params)
    capital = req.initialCapital
    cash = capital
    shares = 0.0
    position_open = False
    trades: list[TradeRecord] = []
    equity_curve = [capital]

    for i in range(1, len(prices)):
        sig = signals[i]
        price = float(prices[i])

        if sig == 1 and not position_open:
            # Buy
            shares = cash / price
            cash = 0.0
            position_open = True
            trades.append(TradeRecord(day=i, action="BUY", price=price, shares=round(shares, 4),
                                      value=round(shares * price, 2)))
        elif sig == -1 and position_open:
            # Sell
            cash = shares * price
            trades.append(TradeRecord(day=i, action="SELL", price=price, shares=round(shares, 4),
                                      value=round(cash, 2)))
            shares = 0.0
            position_open = False

        equity = cash + shares * price
        equity_curve.append(round(equity, 2))

    # Final equity
    final_equity = cash + shares * float(prices[-1])
    total_return = (final_equity / capital) - 1
    n_days = len(prices) - 1
    ann_return = (1 + total_return) ** (TRADING_DAYS / max(n_days, 1)) - 1 if total_return > -1 else -1.0

    # Max drawdown
    eq = np.array(equity_curve)
    running_max = np.maximum.accumulate(eq)
    dd = (eq - running_max) / np.where(running_max > 0, running_max, 1)
    max_dd = float(np.min(dd))

    # Sharpe (from daily equity returns)
    eq_returns = np.diff(eq) / np.where(eq[:-1] > 0, eq[:-1], 1)
    sharpe = float(np.mean(eq_returns) / (np.std(eq_returns) + 1e-10)) * np.sqrt(TRADING_DAYS)

    # Win rate & profit factor
    profits = []
    losses = []
    for j in range(0, len(trades) - 1, 2):
        if j + 1 < len(trades):
            pnl = trades[j + 1].value - trades[j].value
            if pnl >= 0:
                profits.append(pnl)
            else:
                losses.append(abs(pnl))
    total_trades = len(profits) + len(losses)
    win_rate = len(profits) / total_trades if total_trades > 0 else 0.0
    profit_factor = sum(profits) / (sum(losses) + 1e-10) if losses else float("inf") if profits else 0.0
    profit_factor = min(profit_factor, 999.99)

    # Buy & hold
    bh_return = float(prices[-1] / prices[0]) - 1
    bh_equity = [round(capital * prices[i] / prices[0], 2) for i in range(len(prices))]

    return BacktestResponse(
        totalReturn=round(safe_float(total_return), 6),
        annualizedReturn=round(safe_float(ann_return), 6),
        maxDrawdown=round(safe_float(max_dd), 6),
        sharpeRatio=round(safe_float(sharpe), 4),
        winRate=round(safe_float(win_rate), 4),
        profitFactor=round(safe_float(profit_factor), 4),
        trades=trades,
        equityCurve=equity_curve,
        buyAndHoldReturn=round(safe_float(bh_return), 6),
        buyAndHoldEquity=bh_equity,
    )
