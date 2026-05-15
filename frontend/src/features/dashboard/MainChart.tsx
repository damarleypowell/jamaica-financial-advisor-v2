import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, AreaSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { Link } from 'react-router-dom';
import { useMarketStore } from '../../stores/market';
import { apiGet } from '../../lib/api';

interface HistoryPoint { time: string; value: number; }
type TF = '1H' | '4H' | '1D' | 'ALL';
const TFS: TF[] = ['1H', '4H', '1D', 'ALL'];

export default function MainChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [tf, setTf] = useState<TF>('ALL');

  const stocks = useMarketStore((s) => s.stocks);
  const live = stocks.find((s) => s.symbol === symbol);

  const { data, isLoading } = useQuery<HistoryPoint[]>({
    queryKey: ['history', symbol, tf],
    queryFn: async () => {
      try {
        const res = await apiGet<any>(`/api/history/${symbol}?period=${tf}`);
        const raw: unknown[] = Array.isArray(res) ? res
          : Array.isArray(res?.history) ? res.history
          : Array.isArray(res?.data) ? res.data : [];
        if (raw.length === 0) return [];
        if (raw[0] != null && typeof raw[0] === 'object' && 'time' in (raw[0] as object))
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

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: { background: { color: 'transparent' }, textColor: 'rgba(74,96,128,0.8)', fontSize: 10 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      crosshair: {
        vertLine: { color: 'rgba(0,230,118,0.4)', width: 1, style: 2 },
        horzLine: { color: 'rgba(0,230,118,0.4)', width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.03)', scaleMargins: { top: 0.15, bottom: 0.08 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.03)', timeVisible: true, fixLeftEdge: true },
    });
    const series = chart.addSeries(AreaSeries, {
      topColor: 'rgba(0,230,118,0.2)',
      bottomColor: 'rgba(0,230,118,0.0)',
      lineColor: '#00e676',
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) if (e.contentRect.width > 0) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !Array.isArray(data) || data.length === 0) return;
    const clean = data.filter(p => p?.time != null && p?.value != null);
    if (clean.length === 0) return;
    try { seriesRef.current.setData(clean as any); chartRef.current?.timeScale().fitContent(); }
    catch (e) { console.warn('[MainChart]', e); }
  }, [data]);

  const pos = (live?.pctChange ?? 0) >= 0;
  const hasData = Array.isArray(data) && data.length > 1;

  return (
    <div className="card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 flex-wrap" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex-1 min-w-0">
          {symbol ? (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: pos ? 'rgba(0,230,118,.12)' : 'rgba(255,82,82,.12)', border: `1px solid ${pos ? 'rgba(0,230,118,.2)' : 'rgba(255,82,82,.2)'}` }}>
                <span className="text-[10px] font-black num" style={{ color: pos ? 'var(--color-green)' : 'var(--color-red)' }}>
                  {symbol.slice(0, 3)}
                </span>
              </div>
              <div>
                <p className="text-base font-black num leading-none" style={{ color: 'var(--color-text)' }}>{symbol}</p>
                {live?.name && <p className="text-[10px] mt-0.5 leading-none truncate max-w-[200px]" style={{ color: 'var(--color-muted)' }}>{live.name}</p>}
              </div>
              {live && (
                <div className="flex items-center gap-2.5 ml-1">
                  <span className="text-xl font-black num" style={{ color: 'var(--color-text)' }}>
                    ${(live.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm font-bold num" style={{ color: pos ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {pos ? '+' : ''}{(live.pctChange ?? 0).toFixed(2)}%
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black"
                    style={{ background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', color: 'var(--color-green)' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--color-green)' }} />
                    LIVE
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Select a stock to view its chart</p>
          )}
        </div>

        {symbol && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center rounded-xl p-0.5" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>
              {TFS.map(t => (
                <button key={t} onClick={() => setTf(t)}
                  className="px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all"
                  style={tf === t
                    ? { background: 'var(--color-green)', color: 'var(--color-bg)', boxShadow: '0 2px 10px rgba(0,230,118,.3)' }
                    : { color: 'var(--color-muted)' }}>
                  {t}
                </button>
              ))}
            </div>
            <Link to={`/technicals/${symbol}`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text2)' }}>
              <i className="fa-solid fa-expand text-[9px]" /> Full Chart
            </Link>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(9,14,26,.7)', backdropFilter: 'blur(4px)' }}>
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-green)', borderTopColor: 'transparent' }} />
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>Loading</span>
            </div>
          </div>
        )}

        <div ref={containerRef} className="w-full" style={{ height: 300 }}>
          {!symbol && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>
                <i className="fa-solid fa-chart-area text-2xl" style={{ color: 'var(--color-muted)', opacity: .4 }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text2)' }}>Select a stock</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>Click any stock in the panel to view its chart</p>
              </div>
            </div>
          )}
          {symbol && !isLoading && !hasData && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>
                <i className="fa-solid fa-satellite-dish text-xl" style={{ color: 'var(--color-muted)', opacity: .4 }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text2)' }}>No price history yet</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>Chart populates as data streams in</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
