import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createChart, AreaSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '../../stores/market';
import { apiGet } from '../../lib/api';

interface PredictionResult {
  symbol?: string;
  predictions?: Array<{ day: number; price: number; lower?: number; upper?: number }>;
  currentPrice?: number;
  confidence?: number;
  trend?: 'bullish' | 'bearish' | 'neutral';
  horizon?: number;
  models?: { linearRegression?: number; randomForest?: number; arima?: number };
  ensemble?: { weights?: Record<string, number> };
}

function MLPredictionPanel({ symbol }: { symbol: string }) {
  const [horizon, setHorizon] = useState(10);

  const { data, isLoading, error, refetch } = useQuery<PredictionResult>({
    queryKey: ['ml-predict', symbol, horizon],
    queryFn: () => apiGet<PredictionResult>(`/api/analytics/predict/${symbol}?days=${horizon}`),
    enabled: !!symbol,
    staleTime: 300_000,
    retry: 1,
  });

  const pred = data?.predictions ?? [];
  const last = pred[pred.length - 1];
  const current = data?.currentPrice ?? 0;
  const trend = data?.trend ?? 'neutral';
  const conf = data?.confidence;

  const trendColor = trend === 'bullish' ? 'var(--color-green)' : trend === 'bearish' ? 'var(--color-red)' : 'var(--color-gold)';
  const trendIcon = trend === 'bullish' ? 'fa-arrow-trend-up' : trend === 'bearish' ? 'fa-arrow-trend-down' : 'fa-minus';

  const targetPct = current > 0 && last?.price ? ((last.price - current) / current * 100) : null;

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(206,147,216,.1)', border: '1px solid rgba(206,147,216,.2)' }}>
            <i className="fa-solid fa-brain" style={{ fontSize: 14, color: '#ce93d8' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>ML Price Forecast</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>Ensemble: Linear Regression · Random Forest · ARIMA · Educational only</p>
          </div>
        </div>

        {/* Horizon selector */}
        <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3 }}>
          {[5, 10, 20, 30].map(d => (
            <button key={d} onClick={() => setHorizon(d)} style={{
              padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s',
              background: horizon === d ? '#ce93d8' : 'transparent',
              color: horizon === d ? '#04060d' : 'var(--color-muted)',
            }}>{d}D</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 18px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #ce93d8', borderTopColor: 'transparent' }} className="animate-spin" />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Running ensemble model... this may take a few seconds</p>
          </div>
        ) : error || !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 0', textAlign: 'center' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 24, color: 'var(--color-muted)', opacity: .4 }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>ML service unavailable — make sure the Python analytics engine is running</p>
            <button onClick={() => refetch()} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,.06)', border: '1px solid var(--color-border)', color: 'var(--color-text2)', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Key metrics row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {/* Trend */}
              <div style={{ padding: '12px 14px', borderRadius: 12, background: trendColor + '0e', border: `1px solid ${trendColor}28` }}>
                <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>Signal</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className={`fa-solid ${trendIcon}`} style={{ fontSize: 14, color: trendColor }} />
                  <span style={{ fontSize: 15, fontWeight: 900, color: trendColor, textTransform: 'capitalize' }}>{trend}</span>
                </div>
              </div>

              {/* Target price */}
              {last && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>{horizon}D Target</p>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                    ${last.price.toFixed(2)}
                  </p>
                  {targetPct !== null && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: targetPct >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {targetPct >= 0 ? '+' : ''}{targetPct.toFixed(2)}%
                    </p>
                  )}
                </div>
              )}

              {/* Confidence */}
              {conf !== undefined && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>Confidence</p>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 900, fontFamily: 'var(--font-mono)', color: conf >= 65 ? 'var(--color-green)' : conf >= 45 ? 'var(--color-gold)' : 'var(--color-red)' }}>
                    {conf.toFixed(0)}%
                  </p>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${conf}%`, background: conf >= 65 ? 'var(--color-green)' : conf >= 45 ? 'var(--color-gold)' : 'var(--color-red)', borderRadius: 99, transition: 'width .4s ease' }} />
                  </div>
                </div>
              )}

              {/* Model weights */}
              {data.ensemble?.weights && Object.keys(data.ensemble.weights).length > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>Model Weights</p>
                  {Object.entries(data.ensemble.weights).map(([name, w]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'capitalize' }}>{name.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>{((w as number) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prediction table */}
            {pred.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      {['Day', 'Forecast', 'Lower (68%)', 'Upper (68%)'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'right', fontSize: 9, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}
                          className={h === 'Day' ? 'text-left' : ''}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pred.slice(0, 10).map((p, i) => {
                      const pct = current > 0 ? ((p.price - current) / current * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.025)', transition: 'background .1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>+{p.day}d</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>${p.price.toFixed(2)}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: pct >= 0 ? 'var(--color-green)' : 'var(--color-red)', marginLeft: 6 }}>
                              {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                            {p.lower != null ? `$${p.lower.toFixed(2)}` : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                            {p.upper != null ? `$${p.upper.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Disclaimer */}
            <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', opacity: .6, fontStyle: 'italic' }}>
              <i className="fa-solid fa-shield-halved" style={{ marginRight: 5 }} />
              ML forecasts are statistical estimates for educational purposes only. Past performance does not guarantee future results. Not financial advice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface HistoryPoint { time: string | number; value: number; }
type TF = '1H' | '4H' | '1D' | 'ALL';
type ChartType = 'area' | 'candle';

const TFS: TF[] = ['1H', '4H', '1D', 'ALL'];

const fmt2 = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const chgColor = (v?: number) => (v ?? 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)';

export default function AdvancedChart() {
  const { symbol: paramSymbol } = useParams<{ symbol?: string }>();
  const stores = useMarketStore(s => s.stocks);
  const selectedSymbol = useMarketStore(s => s.selectedSymbol);
  const selectSymbol = useMarketStore(s => s.selectSymbol);

  const symbol = paramSymbol ?? selectedSymbol ?? (stores[0]?.symbol ?? '');

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaRef  = useRef<ISeriesApi<'Area'> | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [tf, setTf] = useState<TF>('ALL');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  const live = stores.find(s => s.symbol === symbol);
  const pos  = (live?.pctChange ?? 0) >= 0;

  const { data: rawData, isLoading } = useQuery<HistoryPoint[]>({
    queryKey: ['history', symbol, tf],
    queryFn: async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic API response shape
        const res = await apiGet<any>(`/api/history/${symbol}?period=${tf}`);
        const raw: unknown[] = Array.isArray(res) ? res
          : Array.isArray(res?.history) ? res.history
          : Array.isArray(res?.data) ? res.data : [];
        if (raw.length === 0) return [];
        if (typeof raw[0] === 'object' && raw[0] != null && 'time' in (raw[0] as object))
          return raw as HistoryPoint[];
        const now = Math.floor(Date.now() / 1000);
        return (raw as number[])
          .map((v, i) => ({ time: (now - (raw.length - 1 - i) * 30) as unknown as string, value: typeof v === 'number' ? v : 0 }))
          .filter(p => p.value > 0);
      } catch { return []; }
    },
    enabled: !!symbol,
    staleTime: 30_000,
    retry: 0,
  });

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: { background: { color: 'transparent' }, textColor: 'rgba(74,96,128,0.8)', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      crosshair: {
        vertLine: { color: 'rgba(0,230,118,0.4)', width: 1, style: 2 },
        horzLine: { color: 'rgba(0,230,118,0.4)', width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.03)', scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.03)', timeVisible: true, fixLeftEdge: true },
    });

    const area = chart.addSeries(AreaSeries, {
      topColor: 'rgba(0,230,118,0.18)',
      bottomColor: 'rgba(0,230,118,0.0)',
      lineColor: '#00e676',
      lineWidth: 2,
    });

    chartRef.current = chart;
    areaRef.current  = area;

    const ro = new ResizeObserver(entries => {
      for (const e of entries) if (e.contentRect.width > 0) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; areaRef.current = null; candleRef.current = null; };
  }, []);

  // Update data
  useEffect(() => {
    if (!rawData || rawData.length === 0 || !chartRef.current) return;
    const clean = rawData.filter(p => p?.time != null && p?.value != null);
    if (clean.length === 0) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lightweight-charts type mismatch
      areaRef.current?.setData(clean as any);
      chartRef.current.timeScale().fitContent();
    } catch (e) { console.warn('[AdvancedChart]', e); }
  }, [rawData]);

  const searchResults = searchQ ? stores.filter(s =>
    s.symbol.toLowerCase().includes(searchQ.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQ.toLowerCase())
  ).slice(0, 8) : [];

  const statItems = live ? [
    { label: 'Price', value: `$${fmt2(live.price)}` },
    { label: '$ Change', value: `${(live.dollarChange ?? 0) >= 0 ? '+' : ''}$${fmt2(Math.abs(live.dollarChange ?? 0))}`, colored: true },
    { label: '% Change', value: `${pos ? '+' : ''}${(live.pctChange ?? 0).toFixed(2)}%`, colored: true },
    { label: 'Volume', value: `${(live.volume ?? 0).toLocaleString()}` },
    ...(live.high52 ? [{ label: '52W High', value: `$${fmt2(live.high52)}` }] : []),
    ...(live.low52  ? [{ label: '52W Low',  value: `$${fmt2(live.low52)}`  }] : []),
    ...(live.pe     ? [{ label: 'P/E', value: live.pe.toFixed(1) }] : []),
    ...(live.divYield ? [{ label: 'Div Yield', value: `${(live.divYield * 100).toFixed(2)}%` }] : []),
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        {/* Symbol search */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 12, cursor: 'pointer', minWidth: 200 }}
            onClick={() => setSearchOpen(v => !v)}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: pos ? 'rgba(0,230,118,.12)' : 'rgba(255,82,82,.12)' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: pos ? 'var(--color-green)' : 'var(--color-red)' }}>{symbol.slice(0,3)}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{symbol || 'Select'}</p>
              {live?.name && <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>{live.name}</p>}
            </div>
            <i className="fa-solid fa-chevron-down" style={{ fontSize: 10, color: 'var(--color-muted)' }} />
          </div>

          {searchOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, width: 280, background: 'var(--color-bg3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 100, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search symbol or name..."
                  style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {(searchQ ? searchResults : stores.slice(0, 10)).map(s => (
                  <button key={s.symbol}
                    onClick={() => { selectSymbol(s.symbol); setSearchOpen(false); setSearchQ(''); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (s.pctChange ?? 0) >= 0 ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', flexShrink: 0 }}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: (s.pctChange ?? 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{s.symbol.slice(0,3)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{s.symbol}</p>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: (s.pctChange ?? 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontFamily: 'var(--font-mono)' }}>
                      {(s.pctChange ?? 0) >= 0 ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {live && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>${fmt2(live.price)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: chgColor(live.pctChange), fontFamily: 'var(--font-mono)' }}>
              {pos ? '+' : ''}{(live.pctChange ?? 0).toFixed(2)}%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', color: 'var(--color-green)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-green)', display: 'inline-block' }} className="animate-pulse-dot" />
              LIVE
            </span>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Chart type */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3, gap: 2 }}>
            {[{ key: 'area', icon: 'fa-solid fa-chart-area' }, { key: 'candle', icon: 'fa-solid fa-chart-candlestick' }].map(t => (
              <button key={t.key} onClick={() => setChartType(t.key as ChartType)}
                style={{ padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', transition: 'all .15s',
                  background: chartType === t.key ? 'var(--color-green)' : 'transparent',
                  color: chartType === t.key ? 'var(--color-bg)' : 'var(--color-muted)' }}>
                <i className={t.icon} style={{ fontSize: 11 }} />
              </button>
            ))}
          </div>
          {/* Timeframe */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3, gap: 2 }}>
            {TFS.map(t => (
              <button key={t} onClick={() => setTf(t)}
                style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s',
                  background: tf === t ? 'var(--color-green)' : 'transparent',
                  color: tf === t ? 'var(--color-bg)' : 'var(--color-muted)' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {statItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '10px 16px' }}>
          {statItems.map(s => (
            <div key={s.label} style={{ padding: '4px 12px', borderRight: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.colored ? chgColor(live?.pctChange) : 'var(--color-text)' }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(9,14,26,.75)', backdropFilter: 'blur(4px)', zIndex: 10, gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--color-green)', borderTopColor: 'transparent' }} className="animate-spin" />
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Loading chart data...</span>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: 420 }}>
          {!symbol && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <i className="fa-solid fa-chart-candlestick" style={{ fontSize: 32, color: 'var(--color-muted)', opacity: .3 }} />
              <p style={{ fontSize: 14, color: 'var(--color-text2)', margin: 0, fontWeight: 600 }}>Select a stock to view its chart</p>
            </div>
          )}
        </div>
      </div>

      {/* ML Prediction Panel */}
      {symbol && <MLPredictionPanel symbol={symbol} />}
    </div>
  );
}
