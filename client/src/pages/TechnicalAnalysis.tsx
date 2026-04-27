import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStocks, getTechnicals, getStockHistory } from '@/api/market';
import { searchUSStocks, getUSQuote, getUSBars } from '@/api/us-stocks';
import { useSubscription } from '@/hooks/useSubscription';
import PaywallModal from '@/components/common/PaywallModal';
import { fmt, fmtPercent, fmtJMD, fmtUSD, fmtInt, fmtLargeNum, changeColor } from '@/utils/formatters';
import { SkeletonCard } from '@/components/common/LoadingSpinner';
import { createChart, type IChartApi, CrosshairMode } from 'lightweight-charts';

// ── Helper: compute SMA from an array of closes ─────────────────────────────
function computeSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

// ── Helper: compute RSI series ──────────────────────────────────────────────
function computeRSI(closes: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

// ── Helper: compute EMA ─────────────────────────────────────────────────────
function computeEMA(closes: number[], period: number): (number | null)[] {
  const ema: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  ema[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    ema[i] = closes[i] * k + (ema[i - 1] as number) * (1 - k);
  }
  return ema;
}

// ── Helper: compute MACD series ─────────────────────────────────────────────
function computeMACD(closes: number[]): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macdLine: (number | null)[] = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? (ema12[i] as number) - (ema26[i] as number) : null
  );
  // Signal = EMA(9) of MACD line
  const macdVals = macdLine.filter(v => v != null) as number[];
  const signalEma = computeEMA(macdVals, 9);
  const signal: (number | null)[] = new Array(closes.length).fill(null);
  let j = 0;
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] != null) {
      signal[i] = signalEma[j] ?? null;
      j++;
    }
  }
  const histogram: (number | null)[] = closes.map((_, i) =>
    macdLine[i] != null && signal[i] != null ? (macdLine[i] as number) - (signal[i] as number) : null
  );
  return { macd: macdLine, signal, histogram };
}

// ── Experience Levels ────────────────────────────────────────────────────────
type Level = 'beginner' | 'intermediate' | 'expert';
type Market = 'jse' | 'us';

const LEVEL_CONFIG = {
  beginner: {
    label: 'Beginner',
    icon: 'fa-seedling',
    desc: 'Simple view — price trends & key signals',
    chartTypes: ['area', 'line'] as const,
    defaultChart: 'area' as const,
    timeframes: ['1M', '3M', '6M', '1Y'] as const,
    defaultTimeframe: '3M' as const,
    indicators: ['sma20'] as string[],
    showSubPanels: false,
    showIndicatorPanel: false,
    showAllFundamentals: false,
    chartHeight: 350,
  },
  intermediate: {
    label: 'Intermediate',
    icon: 'fa-chart-line',
    desc: 'Candlesticks, common indicators & signals',
    chartTypes: ['candlestick', 'line', 'area'] as const,
    defaultChart: 'candlestick' as const,
    timeframes: ['1D', '5D', '1M', '3M', '6M', '1Y'] as const,
    defaultTimeframe: '1M' as const,
    indicators: ['sma20', 'sma50', 'rsi', 'macd', 'bollingerBands'] as string[],
    showSubPanels: true,
    showIndicatorPanel: true,
    showAllFundamentals: true,
    chartHeight: 400,
  },
  expert: {
    label: 'Expert',
    icon: 'fa-rocket',
    desc: 'Full toolkit — all indicators, sub-panels & advanced analysis',
    chartTypes: ['candlestick', 'line', 'area'] as const,
    defaultChart: 'candlestick' as const,
    timeframes: ['1D', '5D', '1M', '3M', '6M', '1Y'] as const,
    defaultTimeframe: '1M' as const,
    indicators: [] as string[], // all available
    showSubPanels: true,
    showIndicatorPanel: true,
    showAllFundamentals: true,
    chartHeight: 450,
  },
};

// ── Indicator Definitions ────────────────────────────────────────────────────
const INDICATORS = [
  { key: 'sma20', label: 'SMA 20', group: 'Trend', level: 'beginner' as Level, hint: 'Shows the 20-day average price — if price is above, trend is up' },
  { key: 'sma50', label: 'SMA 50', group: 'Trend', level: 'intermediate' as Level, hint: 'Medium-term trend direction' },
  { key: 'sma200', label: 'SMA 200', group: 'Trend', level: 'expert' as Level, hint: 'Long-term trend — institutional investors watch this' },
  { key: 'ema12', label: 'EMA 12', group: 'Trend', level: 'expert' as Level, hint: 'Fast-reacting exponential average' },
  { key: 'ema26', label: 'EMA 26', group: 'Trend', level: 'expert' as Level, hint: 'Slow exponential average — used in MACD calculation' },
  { key: 'bollingerBands', label: 'Bollinger Bands', group: 'Volatility', level: 'intermediate' as Level, hint: 'Volatility bands — price near upper band = overbought' },
  { key: 'rsi', label: 'RSI', group: 'Momentum', level: 'intermediate' as Level, hint: 'Below 30 = oversold (buy signal), above 70 = overbought (sell signal)' },
  { key: 'macd', label: 'MACD', group: 'Momentum', level: 'intermediate' as Level, hint: 'Trend momentum — histogram above 0 = bullish' },
  { key: 'stochastic', label: 'Stochastic', group: 'Momentum', level: 'expert' as Level, hint: 'Compares closing price to range — K below 20 = oversold' },
  { key: 'adx', label: 'ADX', group: 'Trend', level: 'expert' as Level, hint: 'Measures trend strength — above 25 = strong trend' },
  { key: 'cci', label: 'CCI', group: 'Momentum', level: 'expert' as Level, hint: 'Cyclical indicator — above +100 = overbought' },
  { key: 'williamsR', label: 'Williams %R', group: 'Momentum', level: 'expert' as Level, hint: 'Like RSI but inverted — below -80 = oversold' },
  { key: 'obv', label: 'OBV', group: 'Volume', level: 'expert' as Level, hint: 'On-balance volume — rising OBV confirms price trend' },
  { key: 'vwap', label: 'VWAP', group: 'Volume', level: 'expert' as Level, hint: 'Volume-weighted average price — institutional benchmark' },
  { key: 'atr', label: 'ATR', group: 'Volatility', level: 'expert' as Level, hint: 'Average True Range — measures daily price volatility' },
  { key: 'ichimoku', label: 'Ichimoku Cloud', group: 'Trend', level: 'expert' as Level, hint: 'Japanese technique — cloud shows support/resistance' },
  { key: 'fibonacci', label: 'Fibonacci', group: 'Support/Resistance', level: 'expert' as Level, hint: 'Key retracement levels: 23.6%, 38.2%, 50%, 61.8%' },
];

const LEVEL_ORDER: Record<Level, number> = { beginner: 0, intermediate: 1, expert: 2 };

export default function TechnicalAnalysis() {
  const { hasTier, showPaywall, requiredTier, closePaywall, requireTier } = useSubscription();
  const [level, setLevel] = useState<Level>('beginner');
  const [market, setMarket] = useState<Market>('jse');
  const [symbol, setSymbol] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const config = LEVEL_CONFIG[level];

  const [timeframe, setTimeframe] = useState<string>(config.defaultTimeframe);
  const [chartType, setChartType] = useState<string>(config.defaultChart);
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set(config.indicators));
  const [hoveredIndicator, setHoveredIndicator] = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // ── JSE Data ────────────────────────────────────────────────────────────
  const { data: stocks = [] } = useQuery({ queryKey: ['stocks'], queryFn: getStocks });

  // ── US Stock Search ────────────────────────────────────────────────────
  const [usSearchQuery, setUsSearchQuery] = useState('');
  const { data: usSearchResults = [] } = useQuery({
    queryKey: ['us-search-ta', usSearchQuery],
    queryFn: () => searchUSStocks(usSearchQuery),
    enabled: market === 'us' && usSearchQuery.length >= 1,
  });

  // ── US Quote ───────────────────────────────────────────────────────────
  const { data: usQuote } = useQuery({
    queryKey: ['us-quote-ta', symbol],
    queryFn: () => getUSQuote(symbol),
    enabled: market === 'us' && !!symbol,
    refetchInterval: 15_000,
  });

  // ── US Bars (OHLCV) — Alpaca primary, Finnhub fallback ──────────────
  const usBarsTimeframe = timeframe === '1D' ? '1Hour' : timeframe === '5D' ? '1Hour' : '1Day';
  const usBarsLimit = timeframe === '1D' ? 24 : timeframe === '5D' ? 120 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '6M' ? 180 : 365;
  const { data: usBars } = useQuery({
    queryKey: ['us-bars-ta', symbol, usBarsTimeframe, usBarsLimit],
    queryFn: () => getUSBars(symbol, usBarsTimeframe, usBarsLimit),
    enabled: market === 'us' && !!symbol,
  });

  // Finnhub candles fallback for US stocks
  const finnhubResolution = timeframe === '1D' ? '60' : timeframe === '5D' ? '60' : 'D';
  const finnhubDays = timeframe === '1D' ? 1 : timeframe === '5D' ? 5 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '6M' ? 180 : 365;
  const { data: finnhubCandles } = useQuery({
    queryKey: ['finnhub-candles-ta', symbol, finnhubResolution, finnhubDays],
    queryFn: () => {
      const now = Math.floor(Date.now() / 1000);
      return getStockHistory(symbol, finnhubResolution, now - finnhubDays * 86400, now);
    },
    enabled: market === 'us' && !!symbol,
  });

  const activeSymbol = symbol || (market === 'jse' ? (stocks[0]?.symbol || '') : '');

  const { data: technicals, isLoading: techLoading } = useQuery({
    queryKey: ['technicals', activeSymbol],
    queryFn: () => getTechnicals(activeSymbol),
    enabled: !!activeSymbol && market === 'jse',
  });

  const selectedStock = market === 'jse' ? stocks.find(s => s.symbol === activeSymbol) : null;

  useEffect(() => { requireTier('PRO'); }, [requireTier]);
  const isPro = hasTier('PRO');

  // When level changes, reset chart type and indicators to level defaults
  useEffect(() => {
    const cfg = LEVEL_CONFIG[level];
    setChartType(cfg.defaultChart);
    setTimeframe(cfg.defaultTimeframe);
    if (level !== 'expert') {
      setActiveIndicators(new Set(cfg.indicators));
    }
  }, [level]);

  // When market changes, reset symbol
  useEffect(() => {
    setSymbol('');
    setSymbolSearch('');
    setUsSearchQuery('');
  }, [market]);

  // Available indicators for current level
  const availableIndicators = useMemo(() => {
    if (level === 'expert') return INDICATORS;
    return INDICATORS.filter(ind => LEVEL_ORDER[ind.level] <= LEVEL_ORDER[level]);
  }, [level]);

  // ── Chart Data ────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (market === 'us') {
      // Try Alpaca bars first
      const alpacaBars = usBars
        ? (Array.isArray(usBars) ? usBars : (usBars as Record<string, unknown>).bars as Array<Record<string, unknown>> || [])
        : [];

      if (alpacaBars.length > 0) {
        return alpacaBars.map((b: Record<string, unknown>) => ({
          time: (typeof b.t === 'string' ? Math.floor(new Date(b.t as string).getTime() / 1000)
            : typeof b.timestamp === 'string' ? Math.floor(new Date(b.timestamp as string).getTime() / 1000)
            : b.t) as unknown as string,
          open: (b.o as number) || (b.open as number) || 0,
          high: (b.h as number) || (b.high as number) || 0,
          low: (b.l as number) || (b.low as number) || 0,
          close: (b.c as number) || (b.close as number) || 0,
        }));
      }

      // Fallback: Finnhub candles
      if (finnhubCandles?.candles && finnhubCandles.candles.length > 0) {
        return finnhubCandles.candles.map(c => ({
          time: c.time as unknown as string,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
      }

      return [];
    }

    // JSE — synthetic chart (JSE historical API coming soon)
    // Uses seeded pseudo-random for deterministic rendering
    if (!selectedStock) return [];
    const now = Math.floor(Date.now() / 1000);
    const days = timeframe === '1D' ? 1 : timeframe === '5D' ? 5 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '6M' ? 180 : 365;
    const points = Math.min(days, 200);
    const data = [];
    const base = selectedStock.previousClose || selectedStock.price * 0.95;
    // Seeded PRNG for deterministic charts (no flickering on re-render)
    let seed = selectedStock.symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const seededRandom = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed & 0x7fffffff) / 0x7fffffff; };
    for (let i = 0; i < points; i++) {
      const time = now - (points - i) * 86400;
      const progress = i / points;
      const trend = base + (selectedStock.price - base) * progress;
      const volatility = selectedStock.price * 0.015;
      const open = trend + (seededRandom() - 0.5) * volatility;
      const close = trend + (seededRandom() - 0.5) * volatility;
      const high = Math.max(open, close) + seededRandom() * volatility * 0.5;
      const low = Math.min(open, close) - seededRandom() * volatility * 0.5;
      data.push({ time: time as unknown as string, open, high, low, close });
    }
    return data;
  }, [selectedStock, timeframe, market, usBars, finnhubCandles]);

  // ── Main Chart ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0 || !isPro) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: config.chartHeight,
      layout: { background: { color: 'transparent' }, textColor: '#8892a0' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: level === 'beginner' ? CrosshairMode.Magnet : CrosshairMode.Normal,
        vertLine: { labelBackgroundColor: '#111822' },
        horzLine: { labelBackgroundColor: '#111822' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', autoScale: true },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, rightOffset: 5 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    // Determine price direction
    const isUp = market === 'us'
      ? (usQuote?.changePercent ?? 0) >= 0
      : (selectedStock?.change ?? 0) >= 0;

    // Price series
    if (chartType === 'candlestick') {
      const series = chart.addCandlestickSeries({
        upColor: '#00c853', downColor: '#ff1744',
        borderUpColor: '#00c853', borderDownColor: '#ff1744',
        wickUpColor: '#00c85380', wickDownColor: '#ff174480',
      });
      series.setData(chartData);
    } else if (chartType === 'area') {
      const series = chart.addAreaSeries({
        topColor: isUp ? 'rgba(0,200,83,0.25)' : 'rgba(255,23,68,0.25)',
        bottomColor: 'transparent',
        lineColor: isUp ? '#00c853' : '#ff1744',
        lineWidth: 2,
      });
      series.setData(chartData.map(d => ({ time: d.time, value: d.close })));
    } else {
      const series = chart.addLineSeries({ color: '#00c853', lineWidth: 2 });
      series.setData(chartData.map(d => ({ time: d.time, value: d.close })));
    }

    // Overlay indicators — computed from actual chart close data
    if (chartData.length > 0) {
      const closes = chartData.map(d => d.close);

      if (activeIndicators.has('sma20')) {
        const sma20 = computeSMA(closes, 20);
        const sma = chart.addLineSeries({ color: '#00b0ff', lineWidth: 1, title: 'SMA20' });
        sma.setData(chartData.filter((_, i) => sma20[i] != null).map((d, i) => {
          const idx = chartData.indexOf(d);
          return { time: d.time, value: sma20[idx] as number };
        }));
      }
      if (activeIndicators.has('sma50') && closes.length >= 50) {
        const sma50 = computeSMA(closes, 50);
        const sma = chart.addLineSeries({ color: '#ffd600', lineWidth: 1, title: 'SMA50' });
        sma.setData(chartData.filter((_, i) => sma50[i] != null).map(d => {
          const idx = chartData.indexOf(d);
          return { time: d.time, value: sma50[idx] as number };
        }));
      }
      if (activeIndicators.has('sma200') && closes.length >= 200) {
        const sma200 = computeSMA(closes, 200);
        const sma = chart.addLineSeries({ color: '#bb86fc', lineWidth: 1, title: 'SMA200' });
        sma.setData(chartData.filter((_, i) => sma200[i] != null).map(d => {
          const idx = chartData.indexOf(d);
          return { time: d.time, value: sma200[idx] as number };
        }));
      }
      if (activeIndicators.has('bollingerBands') && closes.length >= 20) {
        const sma20 = computeSMA(closes, 20);
        const up = chart.addLineSeries({ color: 'rgba(187,134,252,0.4)', lineWidth: 1, title: 'BB Upper' });
        const lo = chart.addLineSeries({ color: 'rgba(187,134,252,0.4)', lineWidth: 1, title: 'BB Lower' });
        const bbData = chartData.map((d, i) => {
          if (sma20[i] == null || i < 19) return null;
          const slice = closes.slice(i - 19, i + 1);
          const mean = sma20[i] as number;
          const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length);
          return { time: d.time, upper: mean + 2 * std, lower: mean - 2 * std };
        }).filter(Boolean) as { time: string; upper: number; lower: number }[];
        up.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
        lo.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
      }
      if (activeIndicators.has('vwap') && technicals?.vwap) {
        // VWAP is a cumulative intraday indicator — use SMA as proxy for daily data
        const vwapSeries = chart.addLineSeries({ color: '#ff9100', lineWidth: 1, lineStyle: 2, title: 'VWAP' });
        const vwap20 = computeSMA(closes, 20);
        vwapSeries.setData(chartData.filter((_, i) => vwap20[i] != null).map(d => {
          const idx = chartData.indexOf(d);
          return { time: d.time, value: vwap20[idx] as number };
        }));
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); chartRef.current = null; };
  }, [chartData, chartType, activeIndicators, technicals, isPro, level, config.chartHeight, selectedStock, market, usQuote]);

  // ── RSI Sub-panel (computed from chart close data) ──────────────────────
  useEffect(() => {
    if (!rsiContainerRef.current || !activeIndicators.has('rsi') || !isPro || !config.showSubPanels) return;
    if (chartData.length < 15) return;
    const chart = createChart(rsiContainerRef.current, {
      width: rsiContainerRef.current.clientWidth, height: 130,
      layout: { background: { color: 'transparent' }, textColor: '#8892a0' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { visible: false },
      handleScroll: false, handleScale: false,
    });
    const series = chart.addLineSeries({ color: '#bb86fc', lineWidth: 2 });
    const ob = chart.addLineSeries({ color: 'rgba(255,23,68,0.2)', lineWidth: 1, lineStyle: 2 });
    const os = chart.addLineSeries({ color: 'rgba(0,200,83,0.2)', lineWidth: 1, lineStyle: 2 });
    const closes = chartData.map(d => d.close);
    const rsiValues = computeRSI(closes);
    const rsiData = chartData
      .map((d, i) => rsiValues[i] != null ? { time: d.time, value: rsiValues[i] as number } : null)
      .filter(Boolean) as { time: string; value: number }[];
    series.setData(rsiData);
    ob.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
    os.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [chartData, activeIndicators, isPro, config.showSubPanels]);

  // ── MACD Sub-panel (computed from chart close data) ─────────────────────
  useEffect(() => {
    if (!macdContainerRef.current || !activeIndicators.has('macd') || !isPro || !config.showSubPanels) return;
    if (chartData.length < 26) return;
    const chart = createChart(macdContainerRef.current, {
      width: macdContainerRef.current.clientWidth, height: 130,
      layout: { background: { color: 'transparent' }, textColor: '#8892a0' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { visible: false },
      handleScroll: false, handleScale: false,
    });
    const histSeries = chart.addHistogramSeries({});
    const macdLineSeries = chart.addLineSeries({ color: '#00b0ff', lineWidth: 1 });
    const signalLineSeries = chart.addLineSeries({ color: '#ff9100', lineWidth: 1 });
    const closes = chartData.map(d => d.close);
    const { macd: macdVals, signal: sigVals, histogram: histVals } = computeMACD(closes);
    const histData = chartData
      .map((d, i) => histVals[i] != null ? {
        time: d.time, value: histVals[i] as number,
        color: (histVals[i] as number) >= 0 ? 'rgba(0,200,83,0.5)' : 'rgba(255,23,68,0.5)',
      } : null)
      .filter(Boolean) as { time: string; value: number; color: string }[];
    histSeries.setData(histData);
    macdLineSeries.setData(chartData
      .map((d, i) => macdVals[i] != null ? { time: d.time, value: macdVals[i] as number } : null)
      .filter(Boolean) as { time: string; value: number }[]);
    signalLineSeries.setData(chartData
      .map((d, i) => sigVals[i] != null ? { time: d.time, value: sigVals[i] as number } : null)
      .filter(Boolean) as { time: string; value: number }[]);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [chartData, activeIndicators, isPro, config.showSubPanels]);

  // ── Signal Summary ────────────────────────────────────────────────────────
  const signalSummary = useMemo(() => {
    if (!technicals || market === 'us') return null;
    let buy = 0, sell = 0, neutral = 0;
    if (technicals.rsi) { if (technicals.rsi < 30) buy++; else if (technicals.rsi > 70) sell++; else neutral++; }
    if (technicals.macd) { if (technicals.macd.histogram > 0) buy++; else sell++; }
    if (technicals.stochastic) { if (technicals.stochastic.k < 20) buy++; else if (technicals.stochastic.k > 80) sell++; else neutral++; }
    if (technicals.adx) { if (technicals.adx > 25) buy++; else neutral++; }
    if (technicals.cci) { if (technicals.cci < -100) buy++; else if (technicals.cci > 100) sell++; else neutral++; }
    if (technicals.williamsR) { if (technicals.williamsR < -80) buy++; else if (technicals.williamsR > -20) sell++; else neutral++; }
    const total = buy + sell + neutral;
    const signal = buy > sell ? 'BUY' : sell > buy ? 'SELL' : 'HOLD';
    return { buy, sell, neutral, total, signal };
  }, [technicals, market]);

  // Beginner-friendly signal explanation
  const signalExplanation = useMemo(() => {
    if (!signalSummary) return '';
    const name = activeSymbol;
    if (signalSummary.signal === 'BUY') return `Technical indicators suggest ${name} may be undervalued. ${signalSummary.buy} out of ${signalSummary.total} signals point to a potential buying opportunity. However, always do your own research before investing.`;
    if (signalSummary.signal === 'SELL') return `Technical indicators suggest ${name} may be overvalued. ${signalSummary.sell} out of ${signalSummary.total} signals suggest caution. Consider reviewing your position if you hold this stock.`;
    return `Technical indicators for ${name} are mixed. The stock is currently in a neutral zone with no strong directional bias.`;
  }, [signalSummary, activeSymbol]);

  const toggleIndicator = useCallback((key: string) => {
    setActiveIndicators(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }, []);

  // JSE symbol filtering
  const filteredSymbols = symbolSearch
    ? stocks.filter(s => s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) || s.name.toLowerCase().includes(symbolSearch.toLowerCase())).slice(0, 8)
    : [];

  // US symbol filtering
  const filteredUSSymbols = usSearchResults.slice(0, 8);

  // Price display values
  const displayPrice = market === 'us' && usQuote ? usQuote.price : selectedStock?.price;
  const displayChange = market === 'us' && usQuote ? usQuote.change : selectedStock?.change;
  const displayChangePct = market === 'us' && usQuote ? usQuote.changePercent : selectedStock?.changePercent;
  const formatPrice = market === 'us' ? fmtUSD : fmtJMD;

  if (showPaywall) return <PaywallModal requiredTier={requiredTier} onClose={closePaywall} />;
  if (!isPro) return null;

  return (
    <div className="space-y-4">
      {/* ── Experience Level Toggle ──────────────────────────────────────────── */}
      <div className="glass-card p-1.5">
        <div className="grid grid-cols-3 gap-1">
          {(['beginner', 'intermediate', 'expert'] as Level[]).map(l => {
            const cfg = LEVEL_CONFIG[l];
            const active = level === l;
            return (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`relative py-3 px-4 rounded-lg text-center transition-all ${
                  active
                    ? 'bg-gradient-to-br from-gf-green/20 to-gf-green/5 border border-gf-green/30 shadow-lg shadow-gf-green/5'
                    : 'hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <i className={`fas ${cfg.icon} text-sm ${active ? 'text-gf-green' : 'text-text-muted'} mb-1 block`} />
                <p className={`text-xs font-bold ${active ? 'text-gf-green' : 'text-text-primary'}`}>{cfg.label}</p>
                <p className="text-[10px] text-text-muted mt-0.5 hidden sm:block">{cfg.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Controls Bar ─────────────────────────────────────────────────────── */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Market Toggle */}
          <div className="flex gap-0.5 bg-white/[0.03] rounded-lg p-0.5">
            <button
              onClick={() => setMarket('jse')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                market === 'jse' ? 'bg-gf-green/20 text-gf-green shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <span className="text-xs">🇯🇲</span> JSE
            </button>
            <button
              onClick={() => setMarket('us')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                market === 'us' ? 'bg-gf-blue/20 text-gf-blue shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <span className="text-xs">🇺🇸</span> US
            </button>
          </div>

          {/* Symbol Search */}
          <div className="relative min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
            {market === 'jse' ? (
              <>
                <input
                  type="text"
                  value={symbol || symbolSearch || activeSymbol}
                  onChange={e => { setSymbolSearch(e.target.value); setSymbol(''); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Search JSE symbol..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                />
                {showDropdown && filteredSymbols.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-bg3 border border-white/10 rounded-lg max-h-48 overflow-y-auto custom-scrollbar shadow-xl">
                    {filteredSymbols.map(s => (
                      <button key={s.symbol} onMouseDown={() => { setSymbol(s.symbol); setSymbolSearch(''); setShowDropdown(false); }}
                        className="w-full px-3 py-2.5 flex justify-between hover:bg-white/5 text-left text-xs border-b border-white/[0.03] last:border-0">
                        <div>
                          <span className="font-semibold text-text-primary">{s.symbol}</span>
                          <span className="text-text-muted ml-2">{s.name}</span>
                        </div>
                        <span className={`font-num ${changeColor(s.changePercent)}`}>{fmtPercent(s.changePercent)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={symbol || usSearchQuery}
                  onChange={e => { setUsSearchQuery(e.target.value); setSymbol(''); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Search US stock (e.g. AAPL, TSLA)..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-blue/50 focus:outline-none"
                />
                {showDropdown && filteredUSSymbols.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-bg3 border border-white/10 rounded-lg max-h-48 overflow-y-auto custom-scrollbar shadow-xl">
                    {filteredUSSymbols.map(s => (
                      <button key={s.symbol} onMouseDown={() => { setSymbol(s.symbol); setUsSearchQuery(''); setShowDropdown(false); }}
                        className="w-full px-3 py-2.5 flex justify-between hover:bg-white/5 text-left text-xs border-b border-white/[0.03] last:border-0">
                        <span className="font-semibold text-text-primary">{s.symbol}</span>
                        <span className="text-text-muted">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Timeframe */}
          <div className="flex gap-0.5 bg-white/[0.03] rounded-lg p-0.5">
            {(config.timeframes as readonly string[]).map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                  timeframe === tf ? 'bg-gf-green/20 text-gf-green shadow-sm' : 'text-text-muted hover:text-text-secondary'
                }`}>{tf}</button>
            ))}
          </div>

          {/* Chart Type */}
          <div className="flex gap-0.5 bg-white/[0.03] rounded-lg p-0.5">
            {(config.chartTypes as readonly string[]).map(ct => (
              <button key={ct} onClick={() => setChartType(ct)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-all ${
                  chartType === ct ? 'bg-gf-green/20 text-gf-green shadow-sm' : 'text-text-muted hover:text-text-secondary'
                }`}>
                <i className={`fas ${ct === 'candlestick' ? 'fa-chart-bar' : ct === 'area' ? 'fa-mountain' : 'fa-chart-line'} mr-1 text-[10px]`} />
                {ct}
              </button>
            ))}
          </div>

          {/* Price Display */}
          {displayPrice != null && (
            <div className="ml-auto flex items-baseline gap-2">
              <span className="text-xl font-bold text-text-primary font-num">{formatPrice(displayPrice)}</span>
              <span className={`text-sm font-num font-semibold px-2 py-0.5 rounded ${
                (displayChange ?? 0) >= 0 ? 'bg-gf-green/10 text-gf-green' : 'bg-red-500/10 text-red-400'
              }`}>
                {(displayChange ?? 0) >= 0 ? '+' : ''}{fmt(displayChange)} ({fmtPercent(displayChangePct)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-1 ${config.showIndicatorPanel && market === 'jse' ? 'lg:grid-cols-4' : ''} gap-4`}>
        {/* Indicator Panel (JSE + Intermediate/Expert only) */}
        {config.showIndicatorPanel && market === 'jse' && (
          <div className="glass-card p-4 lg:order-first">
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Indicators
              <span className="text-[10px] text-text-muted font-normal ml-2">({activeIndicators.size} active)</span>
            </h3>
            {['Trend', 'Momentum', 'Volatility', 'Volume', 'Support/Resistance'].map(group => {
              const items = availableIndicators.filter(i => i.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{group}</p>
                  <div className="space-y-0.5">
                    {items.map(ind => {
                      const isActive = activeIndicators.has(ind.key);
                      return (
                        <div key={ind.key} className="relative"
                          onMouseEnter={() => setHoveredIndicator(ind.key)}
                          onMouseLeave={() => setHoveredIndicator(null)}>
                          <button
                            onClick={() => toggleIndicator(ind.key)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all ${
                              isActive ? 'bg-gf-green/10 text-gf-green' : 'hover:bg-white/5 text-text-secondary'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-gf-green' : 'bg-white/10'}`} />
                              <span>{ind.label}</span>
                            </div>
                            {isActive && <i className="fas fa-check text-[9px]" />}
                          </button>
                          {hoveredIndicator === ind.key && (
                            <div className="absolute left-full ml-2 top-0 z-30 w-48 p-2.5 rounded-lg bg-bg2 border border-white/10 shadow-xl pointer-events-none">
                              <p className="text-[10px] text-text-secondary leading-relaxed">{ind.hint}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chart + Sub-panels */}
        <div className={`${config.showIndicatorPanel && market === 'jse' ? 'lg:col-span-3' : ''} space-y-4`}>
          {/* Main Chart */}
          <div className="glass-card p-4">
            {market === 'us' && !symbol && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <i className="fas fa-search text-3xl text-text-muted mb-3" />
                <p className="text-sm text-text-secondary">Search for a US stock above to view its chart</p>
                <p className="text-[10px] text-text-muted mt-1">Try AAPL, MSFT, TSLA, AMZN, GOOGL...</p>
              </div>
            )}
            {(market === 'jse' || (market === 'us' && symbol)) && (
              <>
                {level === 'beginner' && (
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <i className="fas fa-info-circle text-gf-blue text-xs" />
                    <p className="text-[10px] text-text-muted">
                      Scroll to zoom, drag to pan. {market === 'jse' ? 'The blue line is the 20-day average — it smooths out daily noise to show the trend.' : 'Viewing real market data from US exchanges.'}
                    </p>
                  </div>
                )}
                {techLoading && market === 'jse' ? <SkeletonCard /> : <div ref={chartContainerRef} className="w-full" />}
                {market === 'us' && chartData.length === 0 && symbol && (
                  <div className="py-12 text-center text-text-muted text-xs">Loading chart data for {symbol}...</div>
                )}
              </>
            )}
          </div>

          {/* RSI Sub-panel (JSE only) */}
          {config.showSubPanels && activeIndicators.has('rsi') && market === 'jse' && (
            <div className="glass-card p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-primary">RSI (14)</span>
                  {level === 'intermediate' && (
                    <span className="text-[10px] text-text-muted">Below 30 = Oversold | Above 70 = Overbought</span>
                  )}
                </div>
                {technicals?.rsi && (
                  <span className={`text-sm font-num font-bold px-2 py-0.5 rounded ${
                    technicals.rsi < 30 ? 'bg-gf-green/10 text-gf-green' : technicals.rsi > 70 ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-text-secondary'
                  }`}>
                    {fmt(technicals.rsi, 1)}
                  </span>
                )}
              </div>
              <div ref={rsiContainerRef} className="w-full" />
            </div>
          )}

          {/* MACD Sub-panel (JSE only) */}
          {config.showSubPanels && activeIndicators.has('macd') && market === 'jse' && (
            <div className="glass-card p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-primary">MACD</span>
                  {level === 'intermediate' && (
                    <span className="text-[10px] text-text-muted">Green bars = Bullish momentum | Red = Bearish</span>
                  )}
                </div>
                {technicals?.macd && (
                  <span className={`text-sm font-num font-bold px-2 py-0.5 rounded ${
                    technicals.macd.histogram >= 0 ? 'bg-gf-green/10 text-gf-green' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {fmt(technicals.macd.histogram, 3)}
                  </span>
                )}
              </div>
              <div ref={macdContainerRef} className="w-full" />
            </div>
          )}

          {/* ── Signal + Fundamentals Row ──────────────────────────────────────── */}
          <div className={`grid grid-cols-1 ${level !== 'beginner' ? 'md:grid-cols-2' : ''} gap-4`}>
            {/* Signal Summary (JSE only) */}
            {market === 'jse' && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3">
                  {level === 'beginner' ? 'What Do the Numbers Say?' : 'Signal Summary'}
                </h3>
                {signalSummary ? (
                  <div>
                    <div className={`text-center py-4 rounded-xl mb-4 ${
                      signalSummary.signal === 'BUY' ? 'bg-gradient-to-br from-gf-green/15 to-gf-green/5 border border-gf-green/20' :
                      signalSummary.signal === 'SELL' ? 'bg-gradient-to-br from-red-500/15 to-red-500/5 border border-red-500/20' :
                      'bg-gradient-to-br from-gf-gold/15 to-gf-gold/5 border border-gf-gold/20'
                    }`}>
                      <p className={`text-3xl font-black ${
                        signalSummary.signal === 'BUY' ? 'text-gf-green' : signalSummary.signal === 'SELL' ? 'text-red-400' : 'text-gf-gold'
                      }`}>{signalSummary.signal}</p>
                      <p className="text-[10px] text-text-muted mt-1">{signalSummary.total} indicators analyzed</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                      <div className="bg-gf-green/10 rounded-lg p-2.5">
                        <p className="text-lg font-bold text-gf-green">{signalSummary.buy}</p>
                        <p className="text-[10px] text-text-muted">Buy</p>
                      </div>
                      <div className="bg-gf-gold/10 rounded-lg p-2.5">
                        <p className="text-lg font-bold text-gf-gold">{signalSummary.neutral}</p>
                        <p className="text-[10px] text-text-muted">Neutral</p>
                      </div>
                      <div className="bg-red-500/10 rounded-lg p-2.5">
                        <p className="text-lg font-bold text-red-400">{signalSummary.sell}</p>
                        <p className="text-[10px] text-text-muted">Sell</p>
                      </div>
                    </div>
                    {level === 'beginner' && signalExplanation && (
                      <div className="bg-white/[0.03] rounded-lg p-3 mb-3">
                        <p className="text-xs text-text-secondary leading-relaxed">{signalExplanation}</p>
                        <p className="text-[10px] text-text-muted mt-2 italic">
                          Switch to Intermediate or Expert mode for detailed indicator breakdown.
                        </p>
                      </div>
                    )}
                    {level !== 'beginner' && (
                      <div className="space-y-1.5">
                        {technicals?.rsi != null && <IndicatorRow label="RSI (14)" value={fmt(technicals.rsi, 1)} signal={technicals.rsi < 30 ? 'Buy' : technicals.rsi > 70 ? 'Sell' : 'Neutral'} />}
                        {technicals?.macd && <IndicatorRow label="MACD" value={fmt(technicals.macd.histogram, 3)} signal={technicals.macd.histogram > 0 ? 'Buy' : 'Sell'} />}
                        {technicals?.stochastic && <IndicatorRow label="Stochastic" value={`${fmt(technicals.stochastic.k, 1)}/${fmt(technicals.stochastic.d, 1)}`} signal={technicals.stochastic.k < 20 ? 'Buy' : technicals.stochastic.k > 80 ? 'Sell' : 'Neutral'} />}
                        {level === 'expert' && technicals?.adx != null && <IndicatorRow label="ADX" value={fmt(technicals.adx, 1)} signal={technicals.adx > 25 ? 'Strong' : 'Weak'} />}
                        {level === 'expert' && technicals?.cci != null && <IndicatorRow label="CCI" value={fmt(technicals.cci, 0)} signal={technicals.cci < -100 ? 'Buy' : technicals.cci > 100 ? 'Sell' : 'Neutral'} />}
                        {level === 'expert' && technicals?.williamsR != null && <IndicatorRow label="Williams %R" value={fmt(technicals.williamsR, 1)} signal={technicals.williamsR < -80 ? 'Buy' : technicals.williamsR > -20 ? 'Sell' : 'Neutral'} />}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted text-center py-4">No technical data available</p>
                )}
              </div>
            )}

            {/* US Stock Quote Details */}
            {market === 'us' && usQuote && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Quote Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <FundRow label="Price" value={fmtUSD(usQuote.price)} />
                  <FundRow label="Change" value={fmtPercent(usQuote.changePercent)} className={changeColor(usQuote.changePercent)} />
                  <FundRow label="Open" value={fmtUSD(usQuote.open)} />
                  <FundRow label="Prev Close" value={fmtUSD(usQuote.previousClose)} />
                  <FundRow label="High" value={fmtUSD(usQuote.high)} />
                  <FundRow label="Low" value={fmtUSD(usQuote.low)} />
                  <FundRow label="Volume" value={fmtLargeNum(usQuote.volume)} />
                  <FundRow label="Market Cap" value={fmtLargeNum(usQuote.marketCap)} />
                </div>
              </div>
            )}

            {/* Fundamentals (JSE, Intermediate/Expert) */}
            {config.showAllFundamentals && market === 'jse' && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Fundamentals</h3>
                {selectedStock ? (
                  <div className="grid grid-cols-2 gap-3">
                    <FundRow label="Price" value={fmtJMD(selectedStock.price)} />
                    <FundRow label="Change" value={fmtPercent(selectedStock.changePercent)} className={changeColor(selectedStock.changePercent)} />
                    <FundRow label="Volume" value={fmtInt(selectedStock.volume)} />
                    <FundRow label="Market Cap" value={fmtLargeNum(selectedStock.marketCap)} />
                    <FundRow label="P/E Ratio" value={selectedStock.peRatio ? fmt(selectedStock.peRatio, 1) : '—'} />
                    <FundRow label="Div Yield" value={selectedStock.dividendYield ? fmtPercent(selectedStock.dividendYield) : '—'} />
                    <FundRow label="52w High" value={fmtJMD(selectedStock.week52High)} />
                    <FundRow label="52w Low" value={fmtJMD(selectedStock.week52Low)} />
                    <FundRow label="Open" value={fmtJMD(selectedStock.open)} />
                    <FundRow label="Prev Close" value={fmtJMD(selectedStock.previousClose)} />
                    {level === 'expert' && technicals?.vwap && <FundRow label="VWAP" value={fmtJMD(technicals.vwap)} />}
                    {level === 'expert' && technicals?.atr && <FundRow label="ATR" value={fmt(technicals.atr, 2)} />}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted text-center py-4">Select a stock</p>
                )}
              </div>
            )}
          </div>

          {/* Beginner: Key Stats (simplified fundamentals) */}
          {level === 'beginner' && market === 'jse' && selectedStock && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Price" value={fmtJMD(selectedStock.price)} />
              <MiniStat label="Today's Change" value={fmtPercent(selectedStock.changePercent)} className={changeColor(selectedStock.changePercent)} />
              <MiniStat label="Volume" value={fmtInt(selectedStock.volume)} />
              <MiniStat label="52-Week High" value={fmtJMD(selectedStock.week52High)} />
            </div>
          )}

          {level === 'beginner' && market === 'us' && usQuote && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Price" value={fmtUSD(usQuote.price)} />
              <MiniStat label="Today's Change" value={fmtPercent(usQuote.changePercent)} className={changeColor(usQuote.changePercent)} />
              <MiniStat label="Volume" value={fmtLargeNum(usQuote.volume)} />
              <MiniStat label="Market Cap" value={fmtLargeNum(usQuote.marketCap)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function IndicatorRow({ label, value, signal }: { label: string; value: string; signal: string }) {
  const isPositive = ['Buy', 'Strong'].includes(signal);
  const isNegative = signal === 'Sell';
  const color = isPositive ? 'text-gf-green' : isNegative ? 'text-red-400' : 'text-gf-gold';
  const bg = isPositive ? 'bg-gf-green/10' : isNegative ? 'bg-red-500/10' : 'bg-gf-gold/10';
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-text-primary font-num font-semibold">{value}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${color}`}>{signal}</span>
      </div>
    </div>
  );
}

function FundRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-white/[0.02] rounded-lg p-2">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p className={`text-xs font-num font-semibold ${className || 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="glass-card p-3">
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold font-num mt-0.5 ${className || 'text-text-primary'}`}>{value}</p>
    </div>
  );
}
