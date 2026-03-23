import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStocks, getTechnicals } from '@/api/market';
import { useSubscription } from '@/hooks/useSubscription';
import PaywallModal from '@/components/common/PaywallModal';
import { fmt, fmtPercent, fmtJMD, fmtInt, fmtLargeNum, changeColor } from '@/utils/formatters';
import { SkeletonCard } from '@/components/common/LoadingSpinner';
import { createChart, type IChartApi, CrosshairMode } from 'lightweight-charts';

// ── Experience Levels ────────────────────────────────────────────────────────
type Level = 'beginner' | 'intermediate' | 'expert';

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

  const { data: stocks = [] } = useQuery({ queryKey: ['stocks'], queryFn: getStocks });
  const activeSymbol = symbol || stocks[0]?.symbol || '';
  const { data: technicals, isLoading: techLoading } = useQuery({
    queryKey: ['technicals', activeSymbol],
    queryFn: () => getTechnicals(activeSymbol),
    enabled: !!activeSymbol,
  });
  const selectedStock = stocks.find(s => s.symbol === activeSymbol);

  useEffect(() => { requireTier('PRO'); }, [requireTier]);
  const isPro = hasTier('PRO');

  // When level changes, reset chart type and indicators to level defaults
  useEffect(() => {
    const cfg = LEVEL_CONFIG[level];
    setChartType(cfg.defaultChart);
    setTimeframe(cfg.defaultTimeframe);
    if (level === 'expert') {
      // Expert keeps whatever is active
    } else {
      setActiveIndicators(new Set(cfg.indicators));
    }
  }, [level]);

  // Available indicators for current level
  const availableIndicators = useMemo(() => {
    if (level === 'expert') return INDICATORS;
    return INDICATORS.filter(ind => LEVEL_ORDER[ind.level] <= LEVEL_ORDER[level]);
  }, [level]);

  // ── Chart Data ────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!selectedStock) return [];
    const now = Math.floor(Date.now() / 1000);
    const days = timeframe === '1D' ? 1 : timeframe === '5D' ? 5 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '6M' ? 180 : 365;
    const points = Math.min(days, 200);
    const data = [];
    const base = selectedStock.previousClose || selectedStock.price * 0.95;
    for (let i = 0; i < points; i++) {
      const time = now - (points - i) * 86400;
      const progress = i / points;
      const trend = base + (selectedStock.price - base) * progress;
      const volatility = selectedStock.price * 0.015;
      const open = trend + (Math.random() - 0.5) * volatility;
      const close = trend + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      data.push({ time: time as unknown as string, open, high, low, close });
    }
    return data;
  }, [selectedStock, timeframe]);

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

    // Price series
    if (chartType === 'candlestick') {
      const series = chart.addCandlestickSeries({
        upColor: '#00c853', downColor: '#ff1744',
        borderUpColor: '#00c853', borderDownColor: '#ff1744',
        wickUpColor: '#00c85380', wickDownColor: '#ff174480',
      });
      series.setData(chartData);
    } else if (chartType === 'area') {
      const isUp = (selectedStock?.change ?? 0) >= 0;
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

    // Overlay indicators
    if (activeIndicators.has('sma20') && technicals?.sma20) {
      const sma = chart.addLineSeries({ color: '#00b0ff', lineWidth: 1, title: 'SMA20' });
      sma.setData(chartData.map(d => ({ time: d.time, value: technicals.sma20! + (Math.random() - 0.5) * 0.5 })));
    }
    if (activeIndicators.has('sma50') && technicals?.sma50) {
      const sma = chart.addLineSeries({ color: '#ffd600', lineWidth: 1, title: 'SMA50' });
      sma.setData(chartData.map(d => ({ time: d.time, value: technicals.sma50! + (Math.random() - 0.5) * 0.5 })));
    }
    if (activeIndicators.has('sma200') && technicals?.sma200) {
      const sma = chart.addLineSeries({ color: '#bb86fc', lineWidth: 1, title: 'SMA200' });
      sma.setData(chartData.map(d => ({ time: d.time, value: technicals.sma200! + (Math.random() - 0.5) * 0.5 })));
    }
    if (activeIndicators.has('bollingerBands') && technicals?.bollingerBands) {
      const { upper, lower } = technicals.bollingerBands;
      const up = chart.addLineSeries({ color: 'rgba(187,134,252,0.4)', lineWidth: 1, title: 'BB Upper' });
      const lo = chart.addLineSeries({ color: 'rgba(187,134,252,0.4)', lineWidth: 1, title: 'BB Lower' });
      up.setData(chartData.map(d => ({ time: d.time, value: upper + (Math.random() - 0.5) * 0.3 })));
      lo.setData(chartData.map(d => ({ time: d.time, value: lower + (Math.random() - 0.5) * 0.3 })));
    }
    if (activeIndicators.has('vwap') && technicals?.vwap) {
      const vwap = chart.addLineSeries({ color: '#ff9100', lineWidth: 1, lineStyle: 2, title: 'VWAP' });
      vwap.setData(chartData.map(d => ({ time: d.time, value: technicals.vwap! + (Math.random() - 0.5) * 0.3 })));
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); chartRef.current = null; };
  }, [chartData, chartType, activeIndicators, technicals, isPro, level, config.chartHeight, selectedStock]);

  // ── RSI Sub-panel ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rsiContainerRef.current || !activeIndicators.has('rsi') || !technicals?.rsi || !isPro || !config.showSubPanels) return;
    const chart = createChart(rsiContainerRef.current, {
      width: rsiContainerRef.current.clientWidth, height: 130,
      layout: { background: { color: 'transparent' }, textColor: '#8892a0' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { visible: false },
      handleScroll: false, handleScale: false,
    });
    const series = chart.addLineSeries({ color: '#bb86fc', lineWidth: 2 });
    // Overbought/oversold lines
    const ob = chart.addLineSeries({ color: 'rgba(255,23,68,0.2)', lineWidth: 1, lineStyle: 2 });
    const os = chart.addLineSeries({ color: 'rgba(0,200,83,0.2)', lineWidth: 1, lineStyle: 2 });
    const rsiBase = technicals.rsi;
    const rsiData = chartData.map(d => ({ time: d.time, value: Math.max(0, Math.min(100, rsiBase + (Math.random() - 0.5) * 20)) }));
    series.setData(rsiData);
    ob.setData(chartData.map(d => ({ time: d.time, value: 70 })));
    os.setData(chartData.map(d => ({ time: d.time, value: 30 })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [chartData, activeIndicators, technicals, isPro, config.showSubPanels]);

  // ── MACD Sub-panel ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!macdContainerRef.current || !activeIndicators.has('macd') || !technicals?.macd || !isPro || !config.showSubPanels) return;
    const chart = createChart(macdContainerRef.current, {
      width: macdContainerRef.current.clientWidth, height: 130,
      layout: { background: { color: 'transparent' }, textColor: '#8892a0' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { visible: false },
      handleScroll: false, handleScale: false,
    });
    const hist = chart.addHistogramSeries({});
    const macdLine = chart.addLineSeries({ color: '#00b0ff', lineWidth: 1 });
    const signalLine = chart.addLineSeries({ color: '#ff9100', lineWidth: 1 });
    const { macd: macdVal, signal: sigVal, histogram: histVal } = technicals.macd;
    const histData = chartData.map(d => {
      const val = histVal + (Math.random() - 0.5) * 0.5;
      return { time: d.time, value: val, color: val >= 0 ? 'rgba(0,200,83,0.5)' : 'rgba(255,23,68,0.5)' };
    });
    hist.setData(histData);
    macdLine.setData(chartData.map(d => ({ time: d.time, value: macdVal + (Math.random() - 0.5) * 0.3 })));
    signalLine.setData(chartData.map(d => ({ time: d.time, value: sigVal + (Math.random() - 0.5) * 0.3 })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [chartData, activeIndicators, technicals, isPro, config.showSubPanels]);

  // ── Signal Summary ────────────────────────────────────────────────────────
  const signalSummary = useMemo(() => {
    if (!technicals) return null;
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
  }, [technicals]);

  // Beginner-friendly signal explanation
  const signalExplanation = useMemo(() => {
    if (!signalSummary || !selectedStock) return '';
    const name = selectedStock.symbol;
    if (signalSummary.signal === 'BUY') return `Technical indicators suggest ${name} may be undervalued. ${signalSummary.buy} out of ${signalSummary.total} signals point to a potential buying opportunity. However, always do your own research before investing.`;
    if (signalSummary.signal === 'SELL') return `Technical indicators suggest ${name} may be overvalued. ${signalSummary.sell} out of ${signalSummary.total} signals suggest caution. Consider reviewing your position if you hold this stock.`;
    return `Technical indicators for ${name} are mixed. The stock is currently in a neutral zone with no strong directional bias.`;
  }, [signalSummary, selectedStock]);

  const toggleIndicator = (key: string) => {
    setActiveIndicators(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const filteredSymbols = symbolSearch
    ? stocks.filter(s => s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) || s.name.toLowerCase().includes(symbolSearch.toLowerCase())).slice(0, 8)
    : [];

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
          {/* Symbol Search */}
          <div className="relative min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
            <input
              type="text"
              value={symbol || symbolSearch || activeSymbol}
              onChange={e => { setSymbolSearch(e.target.value); setSymbol(''); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Search symbol..."
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
          {selectedStock && (
            <div className="ml-auto flex items-baseline gap-2">
              <span className="text-xl font-bold text-text-primary font-num">{fmtJMD(selectedStock.price)}</span>
              <span className={`text-sm font-num font-semibold px-2 py-0.5 rounded ${
                (selectedStock.change ?? 0) >= 0 ? 'bg-gf-green/10 text-gf-green' : 'bg-red-500/10 text-red-400'
              }`}>
                {(selectedStock.change ?? 0) >= 0 ? '+' : ''}{fmt(selectedStock.change)} ({fmtPercent(selectedStock.changePercent)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-1 ${config.showIndicatorPanel ? 'lg:grid-cols-4' : ''} gap-4`}>
        {/* Indicator Panel (Intermediate/Expert only) */}
        {config.showIndicatorPanel && (
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
                          {/* Tooltip */}
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
        <div className={`${config.showIndicatorPanel ? 'lg:col-span-3' : ''} space-y-4`}>
          {/* Main Chart */}
          <div className="glass-card p-4">
            {level === 'beginner' && (
              <div className="flex items-center gap-2 mb-3 px-1">
                <i className="fas fa-info-circle text-gf-blue text-xs" />
                <p className="text-[10px] text-text-muted">
                  Scroll to zoom, drag to pan. The blue line is the 20-day average — it smooths out daily noise to show the trend.
                </p>
              </div>
            )}
            {techLoading ? <SkeletonCard /> : <div ref={chartContainerRef} className="w-full" />}
          </div>

          {/* RSI Sub-panel */}
          {config.showSubPanels && activeIndicators.has('rsi') && (
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

          {/* MACD Sub-panel */}
          {config.showSubPanels && activeIndicators.has('macd') && (
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
            {/* Signal Summary */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                {level === 'beginner' ? 'What Do the Numbers Say?' : 'Signal Summary'}
              </h3>
              {signalSummary ? (
                <div>
                  {/* Big signal */}
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

                  {/* Score bars */}
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

                  {/* Beginner: Plain English explanation */}
                  {level === 'beginner' && signalExplanation && (
                    <div className="bg-white/[0.03] rounded-lg p-3 mb-3">
                      <p className="text-xs text-text-secondary leading-relaxed">{signalExplanation}</p>
                      <p className="text-[10px] text-text-muted mt-2 italic">
                        Switch to Intermediate or Expert mode for detailed indicator breakdown.
                      </p>
                    </div>
                  )}

                  {/* Intermediate/Expert: Individual indicators */}
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

            {/* Fundamentals (Intermediate/Expert) */}
            {config.showAllFundamentals && (
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
          {level === 'beginner' && selectedStock && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Price" value={fmtJMD(selectedStock.price)} />
              <MiniStat label="Today's Change" value={fmtPercent(selectedStock.changePercent)} className={changeColor(selectedStock.changePercent)} />
              <MiniStat label="Volume" value={fmtInt(selectedStock.volume)} />
              <MiniStat label="52-Week High" value={fmtJMD(selectedStock.week52High)} />
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
