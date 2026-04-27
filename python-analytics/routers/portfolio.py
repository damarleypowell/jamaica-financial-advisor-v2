"""
Portfolio optimisation and risk analytics router.

Implements Markowitz Mean-Variance Optimisation via scipy.optimize.minimize
and full risk-metric calculations including parametric/historical VaR,
CVaR, Monte Carlo simulation, and drawdown-based ratios.
"""

from __future__ import annotations

import numpy as np
from scipy import optimize, stats
from fastapi import APIRouter, HTTPException

from models.schemas import (
    OptimizeRequest, OptimizeResponse, EfficientFrontierPoint,
    RiskMetricsRequest, RiskMetricsResponse,
)
from services.data_service import (
    calculate_returns, calculate_covariance_matrix, calculate_mean_returns,
    safe_float, fetch_finnhub_candles,
)

router = APIRouter(prefix="/api", tags=["portfolio"])

TRADING_DAYS = 252


# ======================================================================
# helpers
# ======================================================================

async def _build_matrices(positions, price_histories: dict[str, list[float]] | None = None):
    """
    From a list of PositionItem build:
      - symbols list
      - mean annual returns vector  (mu)
      - annual covariance matrix    (Sigma)
      - current weights vector      (w0)

    If *price_histories* is provided (or fetched from Finnhub), uses real
    return statistics.  Falls back to synthetic estimation only when real
    data is unavailable.
    """
    symbols = [p.symbol for p in positions]
    n = len(symbols)

    # Try to fetch real price histories from Finnhub for each symbol
    real_prices: dict[str, list[float]] = price_histories or {}
    data_quality = "real"

    if not real_prices:
        for p in positions:
            candles = await fetch_finnhub_candles(p.symbol, "D")
            if candles and len(candles["close"]) >= 60:
                real_prices[p.symbol] = candles["close"]

    # Check if we have real data for all positions
    have_real = all(s in real_prices and len(real_prices[s]) >= 60 for s in symbols)

    if have_real:
        # Use real covariance and mean returns
        cov, cov_symbols = calculate_covariance_matrix(real_prices)
        mu_arr, mu_symbols = calculate_mean_returns(real_prices)
        # Reorder to match positions order
        sym_to_idx = {s: i for i, s in enumerate(cov_symbols)}
        idx_order = [sym_to_idx[s] for s in symbols]
        mu = mu_arr[idx_order]
        cov = cov[np.ix_(idx_order, idx_order)]
    else:
        # Fallback: synthetic estimation from avgCost -> currentPrice
        data_quality = "synthetic"
        mu = np.array([
            ((p.currentPrice / p.avgCost) - 1.0) if p.avgCost > 0 else 0.0
            for p in positions
        ], dtype=np.float64)

        rng = np.random.default_rng(42)
        daily_mu = mu / TRADING_DAYS
        daily_sigma = (np.abs(mu) + 0.05) / np.sqrt(TRADING_DAYS)
        sim_returns = rng.normal(
            loc=daily_mu, scale=daily_sigma, size=(TRADING_DAYS, n)
        )
        cov = np.cov(sim_returns, rowvar=False) * TRADING_DAYS

    # Regularise to avoid singular matrix
    cov += np.eye(n) * 1e-8

    # Current-weight vector (market-value weighted)
    mv = np.array([p.shares * p.currentPrice for p in positions], dtype=np.float64)
    total = mv.sum()
    w0 = mv / total if total > 0 else np.ones(n) / n

    return symbols, mu, cov, w0, total, data_quality


def _portfolio_stats(w, mu, cov, rf):
    """Return (annualised_return, annualised_vol, sharpe)."""
    ret = float(w @ mu)
    var = float(w @ cov @ w)
    vol = np.sqrt(max(var, 0.0))
    sharpe = (ret - rf) / vol if vol > 1e-12 else 0.0
    return ret, vol, sharpe


# ======================================================================
# POST /api/optimize
# ======================================================================

@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_portfolio(req: OptimizeRequest):
    """
    Markowitz Mean-Variance Optimisation.

    The objective switches between minimum variance and maximum Sharpe
    depending on *riskTolerance* (1 = conservative, 10 = aggressive).
    We also trace the efficient frontier by sweeping target returns.
    """
    if len(req.positions) < 2:
        raise HTTPException(400, "At least 2 positions are required for optimisation.")

    symbols, mu, cov, w0, total_value, data_quality = await _build_matrices(req.positions)
    n = len(symbols)
    rf = req.riskFreeRate

    # --- constraints & bounds (long-only, weights sum to 1) ---
    bounds = [(0.0, 1.0)] * n
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    # --- Minimum-variance portfolio ---
    res_minvar = optimize.minimize(
        fun=lambda w: float(w @ cov @ w),
        x0=np.ones(n) / n,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-12},
    )
    w_minvar = res_minvar.x if res_minvar.success else np.ones(n) / n

    # --- Maximum-Sharpe portfolio (neg-Sharpe minimisation) ---
    def neg_sharpe(w):
        ret, vol, _ = _portfolio_stats(w, mu, cov, rf)
        return -(ret - rf) / vol if vol > 1e-12 else 1e6

    res_maxsharpe = optimize.minimize(
        fun=neg_sharpe,
        x0=np.ones(n) / n,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-12},
    )
    w_maxsharpe = res_maxsharpe.x if res_maxsharpe.success else np.ones(n) / n

    # --- Blend based on risk tolerance (1->minvar, 10->maxsharpe) ---
    alpha = (req.riskTolerance - 1) / 9.0  # 0..1
    w_opt = (1 - alpha) * w_minvar + alpha * w_maxsharpe
    w_opt = np.clip(w_opt, 0, None)
    w_opt /= w_opt.sum()

    ret_opt, vol_opt, sharpe_opt = _portfolio_stats(w_opt, mu, cov, rf)

    # --- Efficient frontier (20 points) ---
    ret_minvar = float(w_minvar @ mu)
    ret_maxsharpe = float(w_maxsharpe @ mu)
    target_range = np.linspace(
        min(ret_minvar, mu.min()), max(ret_maxsharpe, mu.max()), 20
    )
    frontier: list[EfficientFrontierPoint] = []
    for target_ret in target_range:
        cons = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1.0},
            {"type": "eq", "fun": lambda w, tr=target_ret: float(w @ mu) - tr},
        ]
        res = optimize.minimize(
            fun=lambda w: float(w @ cov @ w),
            x0=np.ones(n) / n,
            method="SLSQP",
            bounds=bounds,
            constraints=cons,
            options={"maxiter": 500, "ftol": 1e-10},
        )
        if res.success:
            r, v, s = _portfolio_stats(res.x, mu, cov, rf)
            frontier.append(EfficientFrontierPoint(
                volatility=safe_float(v),
                expectedReturn=safe_float(r),
                sharpeRatio=safe_float(s),
            ))

    return OptimizeResponse(
        optimalWeights={s: round(float(w), 6) for s, w in zip(symbols, w_opt)},
        expectedReturn=safe_float(ret_opt),
        volatility=safe_float(vol_opt),
        sharpeRatio=safe_float(sharpe_opt),
        minVariancePortfolio={s: round(float(w), 6) for s, w in zip(symbols, w_minvar)},
        maxSharpePortfolio={s: round(float(w), 6) for s, w in zip(symbols, w_maxsharpe)},
        efficientFrontier=frontier,
        dataQuality=data_quality,
    )


# ======================================================================
# POST /api/risk-metrics
# ======================================================================

@router.post("/risk-metrics", response_model=RiskMetricsResponse)
async def risk_metrics(req: RiskMetricsRequest):
    """
    Compute VaR, CVaR, Monte Carlo, drawdown, beta, Sortino, and Calmar.

    VaR methodology
    ---------------
    * **Parametric**: assumes normal returns; VaR = -mu + z * sigma
    * **Historical**: empirical quantile of portfolio return distribution
    * **CVaR (Expected Shortfall)**: mean of losses exceeding VaR
    """
    if not req.positions:
        raise HTTPException(400, "At least 1 position is required.")

    symbols, mu, cov, w0, total_value, data_quality = await _build_matrices(req.positions)
    n = len(symbols)
    rf = req.riskFreeRate
    alpha = 1 - req.confidenceLevel  # e.g. 0.05

    # Portfolio daily stats
    daily_mu_port = float(w0 @ (mu / TRADING_DAYS))
    daily_var_port = float(w0 @ (cov / TRADING_DAYS) @ w0)
    daily_sigma_port = np.sqrt(max(daily_var_port, 0.0))

    # --- Parametric VaR (1-day then scaled to horizon) ---
    z = stats.norm.ppf(1 - alpha)
    parametric_var_1d = -(daily_mu_port - z * daily_sigma_port) * total_value
    parametric_var = parametric_var_1d * np.sqrt(req.horizon)

    # --- Historical VaR via simulated daily P&L ---
    rng = np.random.default_rng(42)
    sim_daily = rng.multivariate_normal(
        mu / TRADING_DAYS, cov / TRADING_DAYS, size=10000
    )
    port_daily_returns = sim_daily @ w0
    # Horizon returns (sum of daily)
    horizon_returns = np.array([
        port_daily_returns[i: i + req.horizon].sum()
        for i in range(len(port_daily_returns) - req.horizon)
    ])
    historical_var = -float(np.percentile(horizon_returns, alpha * 100)) * total_value

    # --- CVaR (Expected Shortfall) ---
    var_threshold = np.percentile(horizon_returns, alpha * 100)
    tail = horizon_returns[horizon_returns <= var_threshold]
    cvar = -float(np.mean(tail)) * total_value if len(tail) > 0 else historical_var

    # --- Monte Carlo simulation (10 000 paths) ---
    mc_paths = 10000
    mc_days = req.horizon
    daily_drift = (mu / TRADING_DAYS) - 0.5 * np.diag(cov / TRADING_DAYS)
    L = np.linalg.cholesky(cov / TRADING_DAYS + np.eye(n) * 1e-10)
    portfolio_values = np.zeros((mc_paths, mc_days + 1))
    portfolio_values[:, 0] = total_value

    for t in range(1, mc_days + 1):
        z_rand = rng.standard_normal((mc_paths, n))
        daily_ret = daily_drift + z_rand @ L.T
        port_ret = daily_ret @ w0
        portfolio_values[:, t] = portfolio_values[:, t - 1] * np.exp(port_ret)

    mc_percentiles = {}
    for pct in [5, 25, 50, 75, 95]:
        mc_percentiles[str(pct)] = [
            safe_float(np.percentile(portfolio_values[:, t], pct))
            for t in range(mc_days + 1)
        ]

    # --- Max drawdown (from MC median path) ---
    median_path = np.percentile(portfolio_values, 50, axis=0)
    running_max = np.maximum.accumulate(median_path)
    drawdowns = (median_path - running_max) / running_max
    max_drawdown = safe_float(float(np.min(drawdowns)))

    # --- Beta vs market (equally-weighted proxy) ---
    market_w = np.ones(n) / n
    market_daily = sim_daily @ market_w
    port_daily = sim_daily @ w0
    cov_pm = np.cov(port_daily, market_daily)
    beta = safe_float(cov_pm[0, 1] / cov_pm[1, 1]) if cov_pm[1, 1] > 1e-12 else 1.0

    # --- Sortino ratio ---
    annual_ret = float(w0 @ mu)
    downside = port_daily_returns[port_daily_returns < 0]
    downside_std = float(np.std(downside)) * np.sqrt(TRADING_DAYS) if len(downside) > 0 else 1e-6
    sortino = safe_float((annual_ret - rf) / downside_std)

    # --- Calmar ratio (return / |max drawdown|) ---
    calmar = safe_float(annual_ret / abs(max_drawdown)) if abs(max_drawdown) > 1e-12 else 0.0

    return RiskMetricsResponse(
        parametricVaR=safe_float(parametric_var),
        historicalVaR=safe_float(historical_var),
        conditionalVaR=safe_float(cvar),
        maxDrawdown=max_drawdown,
        beta=beta,
        sortinoRatio=sortino,
        calmarRatio=calmar,
        monteCarloPercentiles=mc_percentiles,
        portfolioValue=safe_float(total_value),
    )
