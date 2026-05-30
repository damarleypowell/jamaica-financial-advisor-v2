import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  createChart, AreaSeries, CandlestickSeries, HistogramSeries, LineSeries,
  type IChartApi, type ISeriesApi, type Time, LineStyle,
  type AreaData, type CandlestickData, type HistogramData, type LineData,
} from 'lightweight-charts';
import { useMarketStore } from '../../stores/market';
import { apiGet } from '../../lib/api';

/* ─── types ─── */
interface PricePoint { time: Time; value: number; }
interface OHLCPoint  { time: Time; open: number; high: number; low: number; close: number; }
type TF = '1H' | '4H' | '1D' | 'ALL';
type ChartMode = 'area' | 'candle';
type DrawMode = 'cursor' | 'hline' | 'vline';
type Indicator = 'ema20' | 'ema50' | 'rsi' | 'volume' | 'bb';

/* ─── maths ─── */
function calcEMA(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = new Array(values.length).fill(null);
  let ema: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (ema === null) ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    else ema = values[i] * k + ema * (1 - k);
    out[i] = +ema.toFixed(4);
  }
  return out;
}

function calcRSI(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  out[period] = +(100 - 100 / (1 + (avgL === 0 ? 9999 : avgG / avgL))).toFixed(2);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = +(100 - 100 / (1 + (avgL === 0 ? 9999 : avgG / avgL))).toFixed(2);
  }
  return out;
}

function calcBB(values: number[], period = 20, sd = 2) {
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  const mid:   (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const s = Math.sqrt(variance);
    mid[i] = +mean.toFixed(4); upper[i] = +(mean + sd * s).toFixed(4); lower[i] = +(mean - sd * s).toFixed(4);
  }
  return { upper, lower, mid };
}

function toSyntheticOHLC(pts: PricePoint[]): OHLCPoint[] {
  return pts.map((p, i) => {
    const prev = i > 0 ? pts[i - 1].value : p.value;
    return { time: p.time, open: +prev.toFixed(4), high: +(Math.max(prev, p.value) * 1.003).toFixed(4), low: +(Math.min(prev, p.value) * 0.997).toFixed(4), close: +p.value.toFixed(4) };
  });
}

/* ─── ML panel ─── */
interface PredictionResult {
  predictions?: Array<{ day: number; price: number; lower?: number; upper?: number }>;
  currentPrice?: number; confidence?: number;
  trend?: 'bullish' | 'bearish' | 'neutral';
  ensemble?: { weights?: Record<string, number> };
}

function MLPanel({ symbol }: { symbol: string }) {
  const [horizon, setHorizon] = useState(10);
  const { data, isLoading, error, refetch } = useQuery<PredictionResult>({
    queryKey: ['ml-predict', symbol, horizon],
    queryFn: () => apiGet<PredictionResult>(`/api/analytics/predict/${symbol}?days=${horizon}`),
    enabled: !!symbol, staleTime: 300_000, retry: 1,
  });
  const pred = data?.predictions ?? [];
  const last = pred[pred.length - 1];
  const current = data?.currentPrice ?? 0;
  const trend = data?.trend ?? 'neutral';
  const conf = data?.confidence;
  const tC = trend === 'bullish' ? '#00e676' : trend === 'bearish' ? '#ff5252' : '#ffd740';
  const tPct = current > 0 && last?.price ? ((last.price - current) / current * 100) : null;

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(206,147,216,.1)', border: '1px solid rgba(206,147,216,.2)' }}>
            <i className="fa-solid fa-brain" style={{ fontSize: 14, color: '#ce93d8' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>ML Price Forecast</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>Ensemble · Educational only · Not financial advice</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3 }}>
          {[5, 10, 20, 30].map(d => (
            <button key={d} onClick={() => setHorizon(d)} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s', background: horizon === d ? '#ce93d8' : 'transparent', color: horizon === d ? '#04060d' : 'var(--color-muted)' }}>{d}D</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 18px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #ce93d8', borderTopColor: 'transparent' }} className="animate-spin" />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Running ensemble model…</p>
          </div>
        ) : error || !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 0', textAlign: 'center' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 24, color: 'var(--color-muted)', opacity: .4 }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>ML service unavailable — Python analytics engine must be running</p>
            <button onClick={() => refetch()} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,.06)', border: '1px solid var(--color-border)', color: 'var(--color-text2)', cursor: 'pointer' }}>Retry</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              <div style={{ padding: '12px 14px', borderRadius: 12, background: tC + '12', border: `1px solid ${tC}30` }}>
                <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>Signal</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className={`fa-solid ${trend === 'bullish' ? 'fa-arrow-trend-up' : trend === 'bearish' ? 'fa-arrow-trend-down' : 'fa-minus'}`} style={{ fontSize: 14, color: tC }} />
                  <span style={{ fontSize: 15, fontWeight: 900, color: tC, textTransform: 'capitalize' }}>{trend}</span>
                </div>
              </div>
              {last && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>{horizon}D Target</p>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>${last.price.toFixed(2)}</p>
                  {tPct !== null && <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: tPct >= 0 ? '#00e676' : '#ff5252' }}>{tPct >= 0 ? '+' : ''}{tPct.toFixed(2)}%</p>}
                </div>
              )}
              {conf !== undefined && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>Confidence</p>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 900, fontFamily: 'var(--font-mono)', color: conf >= 65 ? '#00e676' : conf >= 45 ? '#ffd740' : '#ff5252' }}>{conf.toFixed(0)}%</p>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${conf}%`, background: conf >= 65 ? '#00e676' : conf >= 45 ? '#ffd740' : '#ff5252', borderRadius: 99, transition: 'width .4s' }} />
                  </div>
                </div>
              )}
            </div>
            {pred.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      {['Day', 'Forecast', 'Lower 68%', 'Upper 68%'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Day' ? 'left' : 'right', fontSize: 9, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pred.slice(0, 10).map((p, i) => {
                      const pct = current > 0 ? ((p.price - current) / current * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.025)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>+{p.day}d</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>${p.price.toFixed(2)}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: pct >= 0 ? '#00e676' : '#ff5252', marginLeft: 6 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>{p.lower != null ? `$${p.lower.toFixed(2)}` : '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>{p.upper != null ? `$${p.upper.toFixed(2)}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── chart ─── */
const TFS: TF[] = ['1H', '4H', '1D', 'ALL'];
const fmt2 = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const IND_LABELS: Record<Indicator, string> = { ema20: 'EMA 20', ema50: 'EMA 50', rsi: 'RSI 14', volume: 'Volume', bb: 'BB 20' };
const IND_COLORS: Record<Indicator, string> = { ema20: '#ffd740', ema50: '#ff9800', rsi: '#ce93d8', volume: '#00e676', bb: '#64b5f6' };

export default function AdvancedChart() {
  const { symbol: paramSymbol } = useParams<{ symbol?: string }>();
  const stocks   = useMarketStore(s => s.stocks);
  const selSym   = useMarketStore(s => s.selectedSymbol);
  const selFn    = useMarketStore(s => s.selectSymbol);
  const symbol   = paramSymbol ?? selSym ?? (stocks[0]?.symbol ?? '');
  const live     = stocks.find(s => s.symbol === symbol);
  const pos      = (live?.pctChange ?? 0) >= 0;

  const [tf, setTf]         = useState<TF>('ALL');
  const [mode, setMode]     = useState<ChartMode>('area');
  const [drawMode, setDraw] = useState<DrawMode>('cursor');
  const [srch, setSrch]     = useState(false);
  const [srchQ, setSrchQ]   = useState('');
  const [inds, setInds]     = useState<Set<Indicator>>(new Set(['ema20', 'ema50', 'volume']));
  const [drawnLines, setDrawn] = useState<number[]>([]); // prices of drawn h-lines

  const toggleInd = (ind: Indicator) => setInds(prev => { const n = new Set(prev); if (n.has(ind)) n.delete(ind); else n.add(ind); return n; });

  /* ── refs ── */
  const wrapRef    = useRef<HTMLDivElement>(null); // main chart mount
  const rsiDivRef  = useRef<HTMLDivElement>(null); // RSI chart mount
  const mainChart  = useRef<IChartApi | null>(null);
  const rsiChart   = useRef<IChartApi | null>(null);
  const areaS      = useRef<ISeriesApi<'Area'> | null>(null);
  const candleS    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volS       = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20S     = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50S     = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUS       = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLS       = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMS       = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiS       = useRef<ISeriesApi<'Line'> | null>(null);
  // drawn price lines: stored on areaS / candleS
  const hLinesRef  = useRef<ReturnType<ISeriesApi<'Area'>['createPriceLine']>[]>([]);

  /* ── data fetch ── */
  const { data: raw, isLoading } = useQuery({
    queryKey: ['history', symbol, tf],
    queryFn: async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await apiGet<any>(`/api/history/${symbol}?period=${tf}`);
        const arr: unknown[] = Array.isArray(res) ? res : Array.isArray(res?.history) ? res.history : Array.isArray(res?.data) ? res.data : [];
        if (!arr.length) return { price: [] as PricePoint[], ohlc: [] as OHLCPoint[] };
        const now = Math.floor(Date.now() / 1000);
        if (typeof arr[0] === 'object' && arr[0] != null && 'close' in (arr[0] as object)) {
          const ohlc = arr as OHLCPoint[];
          return { price: ohlc.map(p => ({ time: p.time, value: p.close })), ohlc };
        }
        if (typeof arr[0] === 'object' && arr[0] != null && 'time' in (arr[0] as object)) {
          const price = arr as PricePoint[];
          return { price, ohlc: toSyntheticOHLC(price) };
        }
        const price: PricePoint[] = (arr as number[]).map((v, i) => ({ time: (now - (arr.length - 1 - i) * 300) as unknown as Time, value: typeof v === 'number' ? v : 0 })).filter(p => p.value > 0);
        return { price, ohlc: toSyntheticOHLC(price) };
      } catch { return { price: [] as PricePoint[], ohlc: [] as OHLCPoint[] }; }
    },
    enabled: !!symbol, staleTime: 30_000, retry: 0,
  });

  const priceData = useMemo(() => raw?.price ?? [], [raw]);
  const ohlcData  = useMemo(() => raw?.ohlc  ?? [], [raw]);

  const derived = useMemo(() => {
    const vals = priceData.map(p => p.value);
    const times = priceData.map(p => p.time);
    const toLine = (arr: (number | null)[]) => arr.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean) as PricePoint[];
    return {
      ema20: toLine(calcEMA(vals, 20)), ema50: toLine(calcEMA(vals, 50)),
      rsi: toLine(calcRSI(vals, 14)),
      ...(() => { const b = calcBB(vals, 20); return { bbU: toLine(b.upper), bbL: toLine(b.lower), bbM: toLine(b.mid) }; })(),
    };
  }, [priceData]);

  const baseChartOpts = {
    layout: { background: { color: 'transparent' }, textColor: 'rgba(148,163,184,.7)', fontSize: 10 },
    grid: { vertLines: { color: 'rgba(255,255,255,.02)' }, horzLines: { color: 'rgba(255,255,255,.02)' } },
    crosshair: { vertLine: { color: 'rgba(0,230,118,.3)', width: 1 as const, style: 2 as const }, horzLine: { color: 'rgba(0,230,118,.3)', width: 1 as const, style: 2 as const } },
    rightPriceScale: { borderColor: 'rgba(255,255,255,.04)' },
    timeScale: { borderColor: 'rgba(255,255,255,.04)', timeVisible: true, fixLeftEdge: true },
  };

  /* ── init main chart (once) ── */
  useEffect(() => {
    if (!wrapRef.current) return;
    const chart = createChart(wrapRef.current, { ...baseChartOpts, width: wrapRef.current.clientWidth, height: 420,
      rightPriceScale: { ...baseChartOpts.rightPriceScale, scaleMargins: { top: 0.08, bottom: 0.18 } } });

    areaS.current   = chart.addSeries(AreaSeries, { topColor: 'rgba(0,230,118,.18)', bottomColor: 'rgba(0,230,118,0)', lineColor: '#00e676', lineWidth: 2 });
    candleS.current = chart.addSeries(CandlestickSeries, { upColor: '#00e676', downColor: '#ff5252', borderUpColor: '#00e676', borderDownColor: '#ff5252', wickUpColor: 'rgba(0,230,118,.7)', wickDownColor: 'rgba(255,82,82,.7)' });
    candleS.current.applyOptions({ visible: false });

    volS.current = chart.addSeries(HistogramSeries, { color: 'rgba(0,230,118,.15)', priceFormat: { type: 'volume' as const }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });

    ema20S.current = chart.addSeries(LineSeries, { color: '#ffd740', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ema50S.current = chart.addSeries(LineSeries, { color: '#ff9800', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    bbUS.current   = chart.addSeries(LineSeries, { color: 'rgba(100,181,246,.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
    bbLS.current   = chart.addSeries(LineSeries, { color: 'rgba(100,181,246,.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
    bbMS.current   = chart.addSeries(LineSeries, { color: 'rgba(100,181,246,.25)', lineWidth: 1, lineStyle: LineStyle.SparseDotted, priceLineVisible: false, lastValueVisible: false });

    mainChart.current = chart;
    const ro = new ResizeObserver(ents => { for (const e of ents) if (e.contentRect.width > 0) chart.applyOptions({ width: e.contentRect.width }); });
    ro.observe(wrapRef.current);
    return () => { ro.disconnect(); chart.remove(); mainChart.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── init RSI chart (once) ── */
  useEffect(() => {
    if (!rsiDivRef.current) return;
    const chart = createChart(rsiDivRef.current, { ...baseChartOpts, width: rsiDivRef.current.clientWidth, height: 110,
      rightPriceScale: { borderColor: 'rgba(255,255,255,.04)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { visible: false, borderColor: 'rgba(255,255,255,.04)' } });
    rsiS.current = chart.addSeries(LineSeries, { color: '#ce93d8', lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
    // RSI 70/30 lines
    rsiS.current.createPriceLine({ price: 70, color: 'rgba(255,82,82,.4)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OB' });
    rsiS.current.createPriceLine({ price: 30, color: 'rgba(0,230,118,.4)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OS' });
    rsiChart.current = chart;
    const ro = new ResizeObserver(ents => { for (const e of ents) if (e.contentRect.width > 0) chart.applyOptions({ width: e.contentRect.width }); });
    ro.observe(rsiDivRef.current);
    return () => { ro.disconnect(); chart.remove(); rsiChart.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── push data ── */
  useEffect(() => {
    if (!priceData.length || !mainChart.current) return;
    try {
      areaS.current?.setData(priceData as AreaData<Time>[]);
      candleS.current?.setData(ohlcData as CandlestickData<Time>[]);
      const volData = ohlcData.map(p => ({ time: p.time, value: Math.abs((p.close - p.open) / (p.open || 1) * 100) * 1000 + 100, color: p.close >= p.open ? 'rgba(0,230,118,.2)' : 'rgba(255,82,82,.2)' }));
      volS.current?.setData(volData as HistogramData<Time>[]);
      mainChart.current.timeScale().fitContent();
    } catch (e) { console.warn('[chart data]', e); }
  }, [priceData, ohlcData]);

  /* ── push indicators ── */
  useEffect(() => {
    try {
      ema20S.current?.setData(derived.ema20 as LineData<Time>[]);
      ema50S.current?.setData(derived.ema50 as LineData<Time>[]);
      bbUS.current?.setData(derived.bbU as LineData<Time>[]);
      bbLS.current?.setData(derived.bbL as LineData<Time>[]);
      bbMS.current?.setData(derived.bbM as LineData<Time>[]);
      rsiS.current?.setData(derived.rsi as LineData<Time>[]);
    } catch (e) { console.warn('[chart indicators]', e); }
  }, [derived]);

  /* ── area ↔ candle ── */
  useEffect(() => {
    areaS.current?.applyOptions({ visible: mode === 'area' });
    candleS.current?.applyOptions({ visible: mode === 'candle' });
  }, [mode]);

  /* ── indicator visibility ── */
  useEffect(() => {
    ema20S.current?.applyOptions({ visible: inds.has('ema20') });
    ema50S.current?.applyOptions({ visible: inds.has('ema50') });
    volS.current?.applyOptions({ visible: inds.has('volume') });
    bbUS.current?.applyOptions({ visible: inds.has('bb') });
    bbLS.current?.applyOptions({ visible: inds.has('bb') });
    bbMS.current?.applyOptions({ visible: inds.has('bb') });
  }, [inds]);

  /* ── click handler: draw horizontal lines ── */
  const handleChartClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (drawMode !== 'hline' || !areaS.current || !priceData.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    try {
      const price = areaS.current.coordinateToPrice(y);
      if (price === null) return;
      const targetS = mode === 'area' ? areaS.current : candleS.current;
      if (!targetS) return;
      const line = targetS.createPriceLine({ price, color: '#ffd740', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `$${fmt2(price)}` });
      hLinesRef.current.push(line);
      setDrawn(prev => [...prev, price]);
    } catch (err) { console.warn('[draw]', err); }
  }, [drawMode, mode, priceData]);

  const clearDrawings = useCallback(() => {
    const targetS = mode === 'area' ? areaS.current : candleS.current;
    if (!targetS) return;
    hLinesRef.current.forEach(l => { try { targetS.removePriceLine(l); } catch { /* line already removed */ } });
    hLinesRef.current = [];
    setDrawn([]);
  }, [mode]);

  const srchResults = srchQ ? stocks.filter(s => s.symbol.toLowerCase().includes(srchQ.toLowerCase()) || s.name.toLowerCase().includes(srchQ.toLowerCase())).slice(0, 8) : stocks.slice(0, 12);
  const hasData = priceData.length > 1;

  const statItems: { label: string; value: string; color?: string }[] = live ? [
    { label: 'Price', value: `$${fmt2(live.price)}` },
    { label: 'Change', value: `${pos ? '+' : ''}${(live.pctChange ?? 0).toFixed(2)}%`, color: pos ? '#00e676' : '#ff5252' },
    { label: 'Volume', value: (live.volume ?? 0).toLocaleString() },
    ...(live.high52 ? [{ label: '52W H', value: `$${fmt2(live.high52)}` }] : []),
    ...(live.low52  ? [{ label: '52W L', value: `$${fmt2(live.low52)}` }] : []),
    ...(live.pe     ? [{ label: 'P/E',   value: live.pe.toFixed(1) }] : []),
    ...(live.divYield ? [{ label: 'Yield', value: `${(live.divYield * 100).toFixed(2)}%` }] : []),
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── header ── */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '12px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        {/* symbol picker */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setSrch(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 12, cursor: 'pointer', minWidth: 200 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: pos ? 'rgba(0,230,118,.12)' : 'rgba(255,82,82,.12)', flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: pos ? '#00e676' : '#ff5252' }}>{symbol.slice(0, 3)}</span>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{symbol || 'Select'}</p>
              {live?.name && <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>{live.name}</p>}
            </div>
            <i className="fa-solid fa-chevron-down" style={{ fontSize: 10, color: 'var(--color-muted)' }} />
          </button>
          {srch && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, width: 280, background: 'var(--color-bg3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.6)', zIndex: 100, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <input autoFocus value={srchQ} onChange={e => setSrchQ(e.target.value)} placeholder="Search symbol or name…"
                  style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {srchResults.map(s => (
                  <button key={s.symbol} onClick={() => { selFn(s.symbol); setSrch(false); setSrchQ(''); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (s.pctChange ?? 0) >= 0 ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', flexShrink: 0 }}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: (s.pctChange ?? 0) >= 0 ? '#00e676' : '#ff5252' }}>{s.symbol.slice(0, 3)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{s.symbol}</p>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: (s.pctChange ?? 0) >= 0 ? '#00e676' : '#ff5252', fontFamily: 'var(--font-mono)' }}>{(s.pctChange ?? 0) >= 0 ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* live price */}
        {live && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>${fmt2(live.price)}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: pos ? '#00e676' : '#ff5252', fontFamily: 'var(--font-mono)' }}>{pos ? '+' : ''}{(live.pctChange ?? 0).toFixed(2)}%</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 800, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', color: '#00e676' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e676', display: 'inline-block' }} className="animate-pulse-dot" /> LIVE
            </span>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* chart mode */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3, gap: 2 }}>
            {([['area', 'fa-chart-area', 'Area'], ['candle', 'fa-chart-candlestick', 'Candles']] as const).map(([key, icon, label]) => (
              <button key={key} onClick={() => setMode(key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all .15s', background: mode === key ? 'var(--color-green)' : 'transparent', color: mode === key ? 'var(--color-bg)' : 'var(--color-muted)' }}>
                <i className={`fa-solid ${icon}`} style={{ fontSize: 10 }} />{label}
              </button>
            ))}
          </div>
          {/* timeframe */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3, gap: 2 }}>
            {TFS.map(t => (
              <button key={t} onClick={() => setTf(t)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s', background: tf === t ? 'var(--color-green)' : 'transparent', color: tf === t ? 'var(--color-bg)' : 'var(--color-muted)' }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── stats bar ── */}
      {statItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '8px 14px', overflowX: 'auto' }}>
          {statItems.map((s, i) => (
            <div key={s.label} style={{ padding: '4px 14px', borderRight: i < statItems.length - 1 ? '1px solid var(--color-border)' : 'none', display: 'flex', gap: 7, alignItems: 'center', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color ?? 'var(--color-text)' }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── indicator + drawing toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 600 }}>Indicators:</span>
          {(Object.keys(IND_LABELS) as Indicator[]).map(ind => (
            <button key={ind} onClick={() => toggleInd(ind)} style={{ padding: '4px 11px', borderRadius: 8, border: `1px solid ${inds.has(ind) ? IND_COLORS[ind] : 'var(--color-border)'}`, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', background: inds.has(ind) ? IND_COLORS[ind] + '18' : 'rgba(255,255,255,.04)', color: inds.has(ind) ? IND_COLORS[ind] : 'var(--color-muted)' }}>
              {IND_LABELS[ind]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 600 }}>Draw:</span>
          {([['cursor', 'fa-arrow-pointer', 'Select'], ['hline', 'fa-grip-lines', 'H-Line']] as const).map(([key, icon, label]) => (
            <button key={key} onClick={() => setDraw(key as DrawMode)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: `1px solid ${drawMode === key ? '#ffd740' : 'var(--color-border)'}`, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', background: drawMode === key ? 'rgba(255,215,64,.12)' : 'rgba(255,255,255,.04)', color: drawMode === key ? '#ffd740' : 'var(--color-muted)' }}>
              <i className={`fa-solid ${icon}`} style={{ fontSize: 9 }} />{label}
            </button>
          ))}
          {drawnLines.length > 0 && (
            <button onClick={clearDrawings} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,82,82,.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,82,82,.08)', color: '#ff5252' }}>
              <i className="fa-solid fa-trash" style={{ fontSize: 9 }} /> Clear
            </button>
          )}
          {drawMode === 'hline' && (
            <span style={{ fontSize: 10, color: '#ffd740', fontWeight: 600, opacity: .8 }}>
              <i className="fa-solid fa-arrow-pointer" style={{ marginRight: 4 }} />Click chart to draw line
            </span>
          )}
        </div>
      </div>

      {/* ── main chart pane ── */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden', position: 'relative', cursor: drawMode === 'hline' ? 'crosshair' : 'default' }}>
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(9,14,26,.8)', backdropFilter: 'blur(4px)', zIndex: 10, gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #00e676', borderTopColor: 'transparent' }} className="animate-spin" />
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Loading chart data…</span>
          </div>
        )}
        {!symbol && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 420, gap: 12 }}>
            <i className="fa-solid fa-chart-candlestick" style={{ fontSize: 36, color: 'var(--color-muted)', opacity: .25 }} />
            <p style={{ fontSize: 14, color: 'var(--color-text2)', margin: 0 }}>Select a stock above to view its chart</p>
          </div>
        )}
        {symbol && !isLoading && !hasData && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 420, gap: 10 }}>
            <i className="fa-solid fa-satellite-dish" style={{ fontSize: 28, color: 'var(--color-muted)', opacity: .3 }} />
            <p style={{ fontSize: 13, color: 'var(--color-text2)', margin: 0 }}>No price history yet — chart populates as data streams in</p>
          </div>
        )}

        {/* lightweight-charts canvas target */}
        <div ref={wrapRef} style={{ width: '100%', height: 420 }} onClick={handleChartClick} />

        {/* indicator legend */}
        {hasData && (
          <div style={{ position: 'absolute', top: 10, left: 14, display: 'flex', gap: 8, flexWrap: 'wrap', pointerEvents: 'none' }}>
            {inds.has('ema20') && <span style={{ fontSize: 10, fontWeight: 700, color: '#ffd740', background: 'rgba(0,0,0,.55)', padding: '2px 6px', borderRadius: 4 }}>EMA 20</span>}
            {inds.has('ema50') && <span style={{ fontSize: 10, fontWeight: 700, color: '#ff9800', background: 'rgba(0,0,0,.55)', padding: '2px 6px', borderRadius: 4 }}>EMA 50</span>}
            {inds.has('bb')    && <span style={{ fontSize: 10, fontWeight: 700, color: '#64b5f6', background: 'rgba(0,0,0,.55)', padding: '2px 6px', borderRadius: 4 }}>BB 20</span>}
            {inds.has('volume') && <span style={{ fontSize: 10, fontWeight: 700, color: '#00e676', background: 'rgba(0,0,0,.55)', padding: '2px 6px', borderRadius: 4 }}>Volume</span>}
          </div>
        )}
      </div>

      {/* ── RSI pane — always mounted, visibility toggled via style ── */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', position: 'relative', display: inds.has('rsi') ? 'block' : 'none' }}>
        <div style={{ position: 'absolute', top: 6, left: 12, fontSize: 10, fontWeight: 700, color: '#ce93d8', background: 'rgba(0,0,0,.5)', padding: '2px 6px', borderRadius: 4, zIndex: 5, pointerEvents: 'none' }}>RSI 14</div>
        <div ref={rsiDivRef} style={{ width: '100%', height: 110 }} />
      </div>

      {/* ── ML forecast ── */}
      {symbol && <MLPanel symbol={symbol} />}
    </div>
  );
}
