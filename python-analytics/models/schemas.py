"""
Pydantic models for all request/response types in the Gotham Financial
analytics engine. Every field is strictly typed for FastAPI automatic validation.
"""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared / reusable models
# ---------------------------------------------------------------------------

class PositionItem(BaseModel):
    """A single position in a portfolio."""
    symbol: str
    shares: float
    avgCost: float
    currentPrice: float


class PriceBar(BaseModel):
    """OHLCV bar — only close/volume are mandatory for most endpoints."""
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: Optional[float] = None


# ---------------------------------------------------------------------------
# Portfolio optimisation
# ---------------------------------------------------------------------------

class OptimizeRequest(BaseModel):
    positions: list[PositionItem]
    riskTolerance: int = Field(ge=1, le=10, default=5)
    riskFreeRate: float = Field(default=0.06, description="Annualised risk-free rate (JA T-bill ~6%)")


class EfficientFrontierPoint(BaseModel):
    volatility: float
    expectedReturn: float
    sharpeRatio: float


class OptimizeResponse(BaseModel):
    optimalWeights: dict[str, float]
    expectedReturn: float
    volatility: float
    sharpeRatio: float
    minVariancePortfolio: dict[str, float]
    maxSharpePortfolio: dict[str, float]
    efficientFrontier: list[EfficientFrontierPoint]


# ---------------------------------------------------------------------------
# Risk metrics
# ---------------------------------------------------------------------------

class RiskMetricsRequest(BaseModel):
    positions: list[PositionItem]
    confidenceLevel: float = Field(default=0.95, ge=0.5, le=0.999)
    horizon: int = Field(default=10, ge=1, le=252, description="Days")
    riskFreeRate: float = 0.06


class MonteCarloPath(BaseModel):
    percentile: int
    values: list[float]


class RiskMetricsResponse(BaseModel):
    parametricVaR: float
    historicalVaR: float
    conditionalVaR: float
    maxDrawdown: float
    beta: float
    sortinoRatio: float
    calmarRatio: float
    monteCarloPercentiles: dict[str, list[float]]
    portfolioValue: float


# ---------------------------------------------------------------------------
# Technical analysis
# ---------------------------------------------------------------------------

class TechnicalAnalysisRequest(BaseModel):
    symbol: str
    prices: list[float]
    volumes: list[float] = []
    highs: list[float] = []
    lows: list[float] = []
    opens: list[float] = []


class IndicatorSignal(BaseModel):
    value: Optional[float] = None
    values: Optional[dict[str, Optional[float]]] = None
    signal: str = "neutral"  # bullish / bearish / neutral


class TechnicalAnalysisResponse(BaseModel):
    trend: dict[str, IndicatorSignal]
    momentum: dict[str, IndicatorSignal]
    volatility: dict[str, IndicatorSignal]
    volume: dict[str, IndicatorSignal]
    overallSignal: str
    bullishCount: int
    bearishCount: int
    neutralCount: int


# ---------------------------------------------------------------------------
# Support / Resistance
# ---------------------------------------------------------------------------

class SupportResistanceRequest(BaseModel):
    symbol: str
    prices: list[float]
    numLevels: int = Field(default=5, ge=2, le=20)


class SupportResistanceResponse(BaseModel):
    supportLevels: list[float]
    resistanceLevels: list[float]
    currentPrice: float
    nearestSupport: Optional[float]
    nearestResistance: Optional[float]
    position: str  # "near_support" / "near_resistance" / "mid_range"


# ---------------------------------------------------------------------------
# Pattern detection
# ---------------------------------------------------------------------------

class PatternDetectionRequest(BaseModel):
    symbol: str
    prices: list[float]
    volumes: list[float] = []


class DetectedPattern(BaseModel):
    pattern: str
    direction: str  # bullish / bearish
    confidence: float
    startIndex: int
    endIndex: int
    priceTarget: Optional[float] = None
    description: str


class PatternDetectionResponse(BaseModel):
    patterns: list[DetectedPattern]
    symbol: str


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

class PredictRequest(BaseModel):
    symbol: str
    prices: list[float]
    volumes: list[float] = []
    horizon: int = Field(default=5, ge=1, le=60)


class PredictionDay(BaseModel):
    day: int
    price: float
    lower68: float
    upper68: float
    lower95: float
    upper95: float


class FeatureImportance(BaseModel):
    feature: str
    importance: float


class PredictResponse(BaseModel):
    predictions: list[PredictionDay]
    featureImportance: list[FeatureImportance]
    modelAgreement: float
    modelBreakdown: dict[str, list[float]]
    lastPrice: float


# ---------------------------------------------------------------------------
# Backtest
# ---------------------------------------------------------------------------

class StrategyParams(BaseModel):
    type: str  # MA_CROSSOVER, RSI_REVERSAL, BOLLINGER_BREAKOUT, MACD_SIGNAL
    params: dict = Field(default_factory=dict)


class BacktestRequest(BaseModel):
    symbol: str
    prices: list[float]
    volumes: list[float] = []
    strategy: StrategyParams
    initialCapital: float = Field(default=1_000_000.0, gt=0)


class TradeRecord(BaseModel):
    day: int
    action: str  # BUY / SELL
    price: float
    shares: float
    value: float


class BacktestResponse(BaseModel):
    totalReturn: float
    annualizedReturn: float
    maxDrawdown: float
    sharpeRatio: float
    winRate: float
    profitFactor: float
    trades: list[TradeRecord]
    equityCurve: list[float]
    buyAndHoldReturn: float
    buyAndHoldEquity: list[float]


# ---------------------------------------------------------------------------
# Screener
# ---------------------------------------------------------------------------

class ScreenerStock(BaseModel):
    symbol: str
    price: float
    pe: Optional[float] = None
    divYield: Optional[float] = None
    volume: Optional[float] = None
    prices: list[float] = []


class ScreenerFilters(BaseModel):
    minPE: Optional[float] = None
    maxPE: Optional[float] = None
    minDivYield: Optional[float] = None
    minVolume: Optional[float] = None
    valueWeight: float = 0.25
    momentumWeight: float = 0.25
    qualityWeight: float = 0.25
    growthWeight: float = 0.25


class ScreenerRequest(BaseModel):
    stocks: list[ScreenerStock]
    filters: ScreenerFilters = Field(default_factory=ScreenerFilters)


class ScoredStock(BaseModel):
    symbol: str
    compositeScore: float
    valueScore: float
    momentumScore: float
    qualityScore: float
    growthScore: float
    price: float
    pe: Optional[float] = None
    divYield: Optional[float] = None


class ScreenerResponse(BaseModel):
    ranked: list[ScoredStock]
    totalScreened: int
    passedFilters: int
