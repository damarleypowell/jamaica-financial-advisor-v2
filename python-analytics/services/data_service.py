"""
Shared data-processing utilities for the analytics engine.

All heavy financial calculations that are reused across routers live here so
that each router stays thin and focused on request/response logic.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import httpx
from typing import Optional


# ---------------------------------------------------------------------------
# Return / covariance helpers
# ---------------------------------------------------------------------------

def calculate_returns(prices: np.ndarray | list[float], log: bool = True) -> np.ndarray:
    """
    Compute period-over-period returns from a 1-D price series.

    Parameters
    ----------
    prices : array-like
        Closing prices ordered oldest -> newest.
    log : bool
        If True return ln(P_t / P_{t-1}); otherwise simple (P_t/P_{t-1} - 1).

    Returns
    -------
    np.ndarray of length len(prices) - 1
    """
    arr = np.asarray(prices, dtype=np.float64)
    if len(arr) < 2:
        return np.array([], dtype=np.float64)
    if log:
        return np.diff(np.log(arr))
    return np.diff(arr) / arr[:-1]


def calculate_covariance_matrix(
    price_matrix: dict[str, list[float]],
    annualize: bool = True,
    trading_days: int = 252,
) -> tuple[np.ndarray, list[str]]:
    """
    Build an annualised covariance matrix from a dict of {symbol: prices[]}.

    Returns (cov_matrix, ordered_symbols).
    """
    symbols = sorted(price_matrix.keys())
    returns_list: list[np.ndarray] = []
    min_len = min(len(price_matrix[s]) for s in symbols)
    for s in symbols:
        p = np.asarray(price_matrix[s][-min_len:], dtype=np.float64)
        returns_list.append(calculate_returns(p))

    # Align lengths (returns have len-1 elements)
    min_ret_len = min(len(r) for r in returns_list)
    mat = np.column_stack([r[-min_ret_len:] for r in returns_list])
    cov = np.cov(mat, rowvar=False)
    if annualize:
        cov *= trading_days
    return cov, symbols


def calculate_mean_returns(
    price_matrix: dict[str, list[float]],
    annualize: bool = True,
    trading_days: int = 252,
) -> tuple[np.ndarray, list[str]]:
    """Annualised mean log-returns for each symbol."""
    symbols = sorted(price_matrix.keys())
    means = []
    for s in symbols:
        r = calculate_returns(price_matrix[s])
        m = float(np.mean(r)) if len(r) > 0 else 0.0
        if annualize:
            m *= trading_days
        means.append(m)
    return np.array(means), symbols


def prices_to_dataframe(prices: list[float], volumes: list[float] | None = None,
                        highs: list[float] | None = None,
                        lows: list[float] | None = None,
                        opens: list[float] | None = None) -> pd.DataFrame:
    """
    Build a pandas DataFrame suitable for the ``ta`` library from raw arrays.
    Columns: open, high, low, close, volume.
    """
    n = len(prices)
    df = pd.DataFrame({
        "close": np.asarray(prices, dtype=np.float64),
    })
    df["open"] = np.asarray(opens if opens and len(opens) == n else prices, dtype=np.float64)
    df["high"] = np.asarray(highs if highs and len(highs) == n else prices, dtype=np.float64)
    df["low"] = np.asarray(lows if lows and len(lows) == n else prices, dtype=np.float64)
    df["volume"] = np.asarray(volumes if volumes and len(volumes) == n else [0.0] * n, dtype=np.float64)
    return df


# ---------------------------------------------------------------------------
# External data fetch (calls back to the Node.js server)
# ---------------------------------------------------------------------------

async def fetch_prices_from_node(
    symbol: str,
    base_url: str = "http://localhost:3000",
    timeout: float = 10.0,
) -> Optional[list[float]]:
    """
    Attempt to pull price history for *symbol* from the Express API.
    Returns None if the upstream is unreachable or returns an error.
    """
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(f"{base_url}/api/stocks/{symbol}/prices")
            if resp.status_code == 200:
                data = resp.json()
                # Normalise: the Express API may return {prices: [...]} or [...]
                if isinstance(data, list):
                    return [float(p) for p in data]
                if isinstance(data, dict) and "prices" in data:
                    return [float(p) for p in data["prices"]]
    except Exception:
        pass
    return None


def safe_float(value, default: float = 0.0) -> float:
    """Convert a value to float, returning *default* on failure."""
    try:
        v = float(value)
        if np.isnan(v) or np.isinf(v):
            return default
        return v
    except (TypeError, ValueError):
        return default
