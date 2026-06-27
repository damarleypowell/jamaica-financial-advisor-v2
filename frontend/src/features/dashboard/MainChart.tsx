import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createChart, AreaSeries, CandlestickSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type Time, type HistogramData,
} from 'lightweight-charts';
import { Link } from 'react-router-dom';
import { useMarketStore } from '../../stores/market';
import { apiGet } from '../../lib/api';

interface HistoryPoint { time: string | number; value: number; volume?: number; }
interface OHLCPoint   { time: number; open: number; high: number; low: number; close: number; volume?: number; }
type TF = string;
// US has real intraday + daily data; JSE is daily-only, so its buttons are
// honest range selectors (no fake intraday) — see backend period→days mapping.
const US_TFS: TF[]  = ['1H', '4H', '1D', 'ALL'];
const JSE_TFS: TF[] = ['1M', '3M', '6M', '1Y'];

function toAreaData(pts: HistoryPoint[]): { time: Time; value: number }[] {
  const seen = new Set<string>();
  return pts
    .map(p => ({ time: p.time as Time, value: p.value }))
    .filter(p => { const k = String(p.time); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (a.time as number) - (b.time as number));
}

function ohlcToArea(candles: OHLCPoint[]): { time: Time; value: number }[] {
  const seen = new Set<number>();
  return candles
    .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
    .sort((a, b) => a.time - b.time)
    .map(c => ({ time: c.time as Time, value: c.close }));
}

function volData(candles: OHLCPoint[]): { time: Time; value: number; color: string }[] {
  return candles.map(c => ({
    time: c.time as Time,
    value: c.volume ?? 0,
    color: c.close >= c.open ? 'rgba(0,230,118,.4)' : 'rgba(255,82,82,.4)',
  }));
}

export default function MainChart({ symbol, isUS }: { symbol: string; isUS?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const areaRef      = useRef<ISeriesApi<'Area'> | null>(null);
  const candleRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef       = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [tf, setTf]     = useState<TF>('1D');
  const [mode, setMode] = useState<'area' | 'candle'>('area');
  const showVol = true;

  const TFS = isUS ? US_TFS : JSE_TFS;
  const cur = isUS ? 'US$' : 'J$';
  const RANGE_LABEL: Record<string, string> = {
    '1H': 'Intraday', '4H': 'Intraday', '1D': '1-year daily', 'ALL': '1-year daily',
    '1M': '1-month daily', '3M': '3-month daily', '6M': '6-month daily', '1Y': '1-year daily',
  };
  // The two markets expose different button sets — derive a valid timeframe for
  // the current market rather than resetting state in an effect.
  const activeTf = TFS.includes(tf) ? tf : (isUS ? '1D' : '6M');

  const stocks = useMarketStore((s) => s.stocks);
  const live   = stocks.find((s) => s.symbol === symbol);

  /* ── JSE history (daily series anchored to the live price) ── */
  const { data: jseData } = useQuery<{ points: HistoryPoint[]; source?: string }>({
    queryKey: ['jse-history', symbol, activeTf],
    queryFn: async () => {
      const res = await apiGet<{ history?: unknown[]; data?: unknown[]; source?: string } | HistoryPoint[]>(`/api/history/${symbol}?period=${activeTf}`);
      const source = Array.isArray(res) ? undefined : res?.source;
      const raw: unknown[] = Array.isArray(res) ? res
        : Array.isArray(res?.history) ? res.history
        : Array.isArray(res?.data) ? res.data : [];
      if (raw.length === 0) return { points: [], source };
      // Objects already carry { time, value/close, volume } — normalize close → value.
      if (raw[0] != null && typeof raw[0] === 'object' && 'time' in (raw[0] as object)) {
        const points = (raw as Array<{ time: number | string; value?: number; close?: number; volume?: number }>)
          .map(p => ({ time: p.time, value: p.value ?? p.close ?? 0, volume: p.volume }))
          .filter(p => p.value > 0);
        return { points, source };
      }
      // Legacy: bare number array (in-memory live fallback).
      const now = Math.floor(Date.now() / 1000);
      const points = (raw as number[])
        .map((v, i) => ({ time: now - (raw.length - 1 - i) * 30, value: typeof v === 'number' ? v : 0 }))
        .filter(p => p.value > 0);
      return { points, source };
    },
    enabled: !!symbol && !isUS,
    staleTime: 30_000,
    retry: 0,
  });

  const indicative = !isUS && jseData?.source === 'indicative';

  /* ── US OHLCV history (Alpaca/Finnhub) ── */
  const resMap: Record<string, string> = { '1H': '60', '4H': '60', '1D': 'D', 'ALL': 'D' };
  const { data: usData, isLoading: usLoading } = useQuery<{ candles?: OHLCPoint[]; history?: HistoryPoint[] } | OHLCPoint[]>({
    queryKey: ['us-history', symbol, activeTf],
    queryFn: () => apiGet<{ candles?: OHLCPoint[]; history?: HistoryPoint[] } | OHLCPoint[]>(`/api/stocks/${symbol}/history?resolution=${resMap[activeTf]}`),
    enabled: !!symbol && !!isUS,
    staleTime: 60_000,
    retry: 0,
  });

  const isLoading = isUS ? usLoading : false;

  /* ── Build display data ── */
  const candles: OHLCPoint[] = (() => {
    if (!isUS || !usData) return [];
    const arr = Array.isArray(usData) ? usData : ((usData as { candles?: OHLCPoint[] }).candles ?? []);
    return arr as OHLCPoint[];
  })();

  const areaPoints = isUS
    ? ohlcToArea(candles)
    : toAreaData(jseData?.points ?? []);

  const hasData = areaPoints.length > 1;
  const pos = isUS
    ? (candles.length > 1 ? candles[candles.length - 1].close >= candles[candles.length - 2].close : true)
    : (live?.pctChange ?? 0) >= 0;
  const livePrice = isUS
    ? (candles[candles.length - 1]?.close ?? 0)
    : (live?.price ?? 0);
  const livePct = live?.pctChange ?? 0;

  /* ── Chart init (once) ── */
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 220,
      layout: { background: { color: 'transparent' }, textColor: 'rgba(180,200,220,0.65)', fontSize: 10 },
      grid: { vertLines: { color: 'rgba(var(--fg),0.025)' }, horzLines: { color: 'rgba(var(--fg),0.025)' } },
      // Price axis + crosshair labels carry the right currency symbol.
      localization: { priceFormatter: (p: number) => (isUS ? 'US$' : 'J$') + p.toFixed(2) },
      crosshair: {
        vertLine: { color: 'rgba(0,230,118,0.4)', width: 1, style: 2 },
        // Dark label bg so the crosshair tag doesn't fight the live-price tag.
        horzLine: { color: 'rgba(0,230,118,0.4)', width: 1, style: 2, labelBackgroundColor: '#0c1422' },
      },
      rightPriceScale: { borderColor: 'rgba(var(--fg),0.03)', scaleMargins: { top: 0.08, bottom: showVol ? 0.18 : 0.04 } },
      timeScale: { borderColor: 'rgba(var(--fg),0.03)', timeVisible: true, fixLeftEdge: true, rightOffset: 3 },
    });

    areaRef.current = chart.addSeries(AreaSeries, {
      topColor: 'rgba(0,230,118,0.18)', bottomColor: 'rgba(0,230,118,0.0)',
      lineColor: '#00e676', lineWidth: 2,
    });

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#00e676', downColor: '#ff5252',
      borderUpColor: '#00e676', borderDownColor: '#ff5252',
      wickUpColor: '#00e676', wickDownColor: '#ff5252',
    });
    candleRef.current.applyOptions({ visible: false });

    volRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });

    chartRef.current = chart;

    const ro = new ResizeObserver(entries => {
      for (const e of entries) if (e.contentRect.width > 0) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; areaRef.current = null; candleRef.current = null; volRef.current = null; };
  }, []); // eslint-disable-line

  /* ── Clear chart + refresh the currency formatter when the market changes ── */
  useEffect(() => {
    try {
      chartRef.current?.applyOptions({ localization: { priceFormatter: (p: number) => (isUS ? 'US$' : 'J$') + p.toFixed(2) } });
      areaRef.current?.setData([]);
      candleRef.current?.setData([]);
      volRef.current?.setData([]);
    } catch { /* chart series not ready */ }
  }, [symbol, isUS]);

  /* ── Push data whenever it arrives ── */
  useEffect(() => {
    if (!areaRef.current || areaPoints.length === 0) return;
    try {
      areaRef.current.setData(areaPoints);
      if (candleRef.current && candles.length > 0) {
        candleRef.current.setData(candles.map(c => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })));
      }
      if (volRef.current) {
        const jsePts = jseData?.points ?? [];
        const vd = isUS ? volData(candles) : jsePts.map((p, i, arr) => ({
          time: p.time as Time, value: p.volume ?? 0,
          color: i === 0 || p.value >= arr[i - 1].value ? 'rgba(0,230,118,.32)' : 'rgba(255,82,82,.32)',
        }));
        volRef.current.setData(vd as HistogramData<Time>[]);
      }
      chartRef.current?.timeScale().fitContent();
    } catch (e) { console.warn('[MainChart]', e); }
  }, [areaPoints, candles, isUS, jseData]);

  /* ── Toggle area ↔ candle ── */
  useEffect(() => {
    areaRef.current?.applyOptions({ visible: mode === 'area' });
    candleRef.current?.applyOptions({ visible: mode === 'candle' && isUS && candles.length > 0 });
  }, [mode, isUS, candles.length]);

  return (
    <div className="card overflow-hidden flex flex-col">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {symbol ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: pos ? 'rgba(0,230,118,.12)' : 'rgba(255,82,82,.12)', border: `1px solid ${pos ? 'rgba(0,230,118,.2)' : 'rgba(255,82,82,.2)'}` }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: pos ? '#00e676' : '#ff5252', letterSpacing: '-.01em' }}>{symbol.slice(0, 4)}</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--color-text)', fontFamily: 'var(--font-mono)', letterSpacing: '-.01em' }}>{symbol}</p>
                {live?.name && <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>{live.name}</p>}
                {!live?.name && isUS && <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>US Equity</p>}
              </div>
              {livePrice > 0 && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text)', fontFamily: 'var(--font-mono)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text2)', marginRight: 1 }}>{cur}</span>{livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {!isUS && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: pos ? '#00e676' : '#ff5252', fontFamily: 'var(--font-mono)' }}>
                      {pos ? '+' : ''}{livePct.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Click any stock to view its chart</p>
          )}
        </div>

        {symbol && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Chart type toggle */}
            {isUS && candles.length > 0 && (
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(var(--fg),.08)' }}>
                {(['area', 'candle'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} aria-label={m === 'area' ? 'Area chart' : 'Candlestick chart'}
                    style={{ padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, transition: 'background .15s, color .15s', background: mode === m ? 'rgba(0,230,118,.16)' : 'transparent', color: mode === m ? '#00e676' : 'rgba(var(--fg),.4)' }}>
                    <i className={`fa-solid ${m === 'area' ? 'fa-chart-area' : 'fa-chart-candlestick'}`} />
                  </button>
                ))}
              </div>
            )}
            {/* Timeframe — quiet "selected" state so it doesn't outshout the price */}
            <div role="group" aria-label="Timeframe" style={{ display: 'flex', borderRadius: 10, padding: 2, background: 'rgba(var(--fg),.04)', border: '1px solid rgba(var(--fg),.07)' }}>
              {TFS.map(t => (
                <button key={t} onClick={() => setTf(t)} aria-pressed={activeTf === t}
                  style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, borderRadius: 8, border: '1px solid', cursor: 'pointer', transition: 'background .15s, color .15s, border-color .15s',
                    background: activeTf === t ? 'rgba(0,230,118,.14)' : 'transparent',
                    borderColor: activeTf === t ? 'rgba(0,230,118,.32)' : 'transparent',
                    color: activeTf === t ? '#00e676' : 'var(--color-muted)' }}>
                  {t}
                </button>
              ))}
            </div>
            <Link to={`/technicals/${symbol}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, background: 'rgba(0,230,118,.08)', border: '1px solid rgba(0,230,118,.2)', color: '#00e676', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-chart-candlestick" style={{ fontSize: 10 }} />
              Full Chart
            </Link>
          </div>
        )}
      </div>

      {/* Chart canvas */}
      <div style={{ position: 'relative', flex: 1 }}>
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(var(--surf),.7)', backdropFilter: 'blur(4px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #00e676', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>Loading {symbol} data…</span>
            </div>
          </div>
        )}

        {/* No stocks empty state — shown as overlay above the (empty) canvas */}
        {!symbol && !isLoading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '32px 24px', pointerEvents: 'none' }}>
            {/* Inline SVG: trending-up / chart icon */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.18 }}>
              <rect width="48" height="48" rx="12" fill="rgba(0,230,118,0.12)" />
              <polyline points="8,34 18,22 26,28 40,14" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <polyline points="34,14 40,14 40,20" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="8" y1="38" x2="40" y2="38" stroke="rgba(0,230,118,0.4)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: 'rgba(var(--fg),0.45)', letterSpacing: '-0.01em' }}>
                No stocks to display
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg),0.22)', lineHeight: 1.5, maxWidth: 220 }}>
                Search for a stock above or add one to your watchlist to get started
              </p>
            </div>
          </div>
        )}

        {symbol && !isLoading && !hasData && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
            <i className="fa-solid fa-satellite-dish" style={{ fontSize: 24, color: 'var(--color-muted)', opacity: .3 }} />
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text2)', margin: 0 }}>
              {isUS ? 'Chart data loading…' : 'No price history yet'}
            </p>
            <p style={{ fontSize: 10, color: 'var(--color-muted)', margin: 0 }}>
              {isUS ? 'Fetching from Alpaca / Yahoo Finance' : 'Chart data streams in as prices update'}
            </p>
          </div>
        )}

        {/* Canvas overlays: honesty chip travels with the visual; volume legend */}
        {indicative && hasData && (
          <span title="Daily history is modeled from the live JSE price. The official JSE historical feed is coming soon."
            style={{ position: 'absolute', top: 10, left: 12, zIndex: 6, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: '#ffd740', background: 'rgba(255,215,64,.12)', border: '1px solid rgba(255,215,64,.28)', padding: '3px 8px', borderRadius: 6, pointerEvents: 'none' }}>
            <i className="fa-solid fa-wave-square" style={{ fontSize: 8 }} />INDICATIVE
          </span>
        )}
        {hasData && (
          <span style={{ position: 'absolute', left: 46, bottom: 7, zIndex: 6, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: 'var(--color-muted)', opacity: .6, pointerEvents: 'none' }}>VOL</span>
        )}

        <div ref={containerRef} style={{ width: '100%', height: 220 }} />
      </div>

      {/* Footer: honesty note (left) + range / as-of stamp (right) */}
      {symbol && hasData && (
        <div style={{ padding: '9px 18px', borderTop: '1px solid rgba(var(--fg),.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'rgba(var(--fg),.01)', flexWrap: 'wrap' }}>
          {indicative ? (
            <span title="Daily history is modeled from the live JSE price. The official JSE historical feed is coming soon."
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--color-text2)', background: 'rgba(255,215,64,.10)', border: '1px solid rgba(255,215,64,.22)', padding: '3px 10px', borderRadius: 999 }}>
              <i className="fa-solid fa-wave-square" style={{ fontSize: 9, color: '#ffd740' }} />
              Indicative daily history · anchored to live price
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--color-text2)' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 9, color: '#00e676' }} />
              Live market data
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {RANGE_LABEL[activeTf] ?? 'Daily'} · as of {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}
