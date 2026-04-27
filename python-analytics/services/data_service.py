"""
Shared data-processing utilities for the analytics engine.

All heavy financial calculations that are reused across routers live here so
that each router stays thin and focused on request/response logic.
"""

from __future__ import annotations

import os
import time
import numpy as np
import pandas as pd
import httpx
from typing import Optional
from pathlib import Path

# ---------------------------------------------------------------------------
# Finnhub configuration
# ---------------------------------------------------------------------------

FINNHUB_API_KEY = os.getenv("FINNHUB_API", "")
FINNHUB_BASE = "https://finnhub.io/api/v1"
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# Simple in-memory cache for Finnhub candle data
_candle_cache: dict[str, tuple[float, dict]] = {}  # key -> (timestamp, data)
_CANDLE_CACHE_TTL = 300  # 5 minutes


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


# ---------------------------------------------------------------------------
# Finnhub data fetching
# ---------------------------------------------------------------------------

async def fetch_finnhub_candles(
    symbol: str,
    resolution: str = "D",
    from_ts: Optional[int] = None,
    to_ts: Optional[int] = None,
    timeout: float = 15.0,
) -> Optional[dict]:
    """
    Fetch OHLCV candle data from Finnhub for a US stock.

    Returns dict with keys: open, high, low, close, volume, timestamps
    or None if unavailable.
    """
    if not FINNHUB_API_KEY:
        return None

    now = int(time.time())
    if to_ts is None:
        to_ts = now
    if from_ts is None:
        from_ts = now - 365 * 86400  # 1 year default

    cache_key = f"{symbol}:{resolution}:{from_ts}:{to_ts}"
    cached = _candle_cache.get(cache_key)
    if cached and (time.time() - cached[0]) < _CANDLE_CACHE_TTL:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                f"{FINNHUB_BASE}/stock/candle",
                params={
                    "symbol": symbol.upper(),
                    "resolution": resolution,
                    "from": from_ts,
                    "to": to_ts,
                    "token": FINNHUB_API_KEY,
                },
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data.get("s") == "no_data" or not data.get("c"):
                return None

            result = {
                "open": data["o"],
                "high": data["h"],
                "low": data["l"],
                "close": data["c"],
                "volume": data["v"],
                "timestamps": data["t"],
            }
            _candle_cache[cache_key] = (time.time(), result)
            return result
    except Exception:
        return None


async def fetch_finnhub_quote(symbol: str, timeout: float = 10.0) -> Optional[dict]:
    """Fetch real-time quote from Finnhub. Returns {c, d, dp, h, l, o, pc, t}."""
    if not FINNHUB_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                f"{FINNHUB_BASE}/quote",
                params={"symbol": symbol.upper(), "token": FINNHUB_API_KEY},
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("c", 0) > 0:
                    return data
    except Exception:
        pass
    return None


async def fetch_training_data(
    symbols: list[str],
    lookback_days: int = 365,
) -> dict[str, list[float]]:
    """
    Fetch 1 year of daily closing prices for multiple US stocks from Finnhub.
    Returns {symbol: [close_prices]} for symbols that returned data.
    Also caches to CSV in python-analytics/data/.
    """
    now = int(time.time())
    from_ts = now - lookback_days * 86400
    result: dict[str, list[float]] = {}

    for sym in symbols:
        # Check CSV cache first
        csv_path = DATA_DIR / f"{sym}_daily.csv"
        if csv_path.exists():
            try:
                df = pd.read_csv(csv_path)
                # Use cache if less than 1 day old
                if len(df) > 30:
                    file_age = time.time() - csv_path.stat().st_mtime
                    if file_age < 86400:
                        result[sym] = df["close"].tolist()
                        continue
            except Exception:
                pass

        # Fetch from Finnhub
        candles = await fetch_finnhub_candles(sym, "D", from_ts, now)
        if candles and len(candles["close"]) > 30:
            result[sym] = candles["close"]
            # Save CSV cache
            try:
                df = pd.DataFrame({
                    "timestamp": candles["timestamps"],
                    "open": candles["open"],
                    "high": candles["high"],
                    "low": candles["low"],
                    "close": candles["close"],
                    "volume": candles["volume"],
                })
                df.to_csv(csv_path, index=False)
            except Exception:
                pass

    return result


# Default training symbols (diverse US sectors)
DEFAULT_TRAINING_SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
    "JPM", "BAC", "JNJ", "PFE", "XOM",
]
