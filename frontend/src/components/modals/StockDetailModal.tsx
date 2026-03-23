import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, type IChartApi, type ISeriesApi, type AreaSeriesOptions, type DeepPartial } from 'lightweight-charts';
import { useUIStore } from '../../stores/ui';
import { useMarketStore } from '../../stores/market';
import { apiGet, apiPost } from '../../lib/api';
import type { Stock, AlertCondition } from '../../types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface StockResearch {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  pe?: number;
  eps?: number;
  divYield?: number;
  marketCap?: number;
  high52?: number;
  low52?: number;
  sector?: string;
  history?: { time: string; value: number }[];
}

/* ------------------------------------------------------------------ */
/*  Mini Chart                                                        */
/* ------------------------------------------------------------------ */

function MiniChart({ data }: { data: { time: string; value: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 260,
      layout: {
        background: { color: 'transparent' },
        textColor: '#71717a',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(63, 63, 70, 0.2)' },
        horzLines: { color: 'rgba(63, 63, 70, 0.2)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(63, 63, 70, 0.3)',
      },
      timeScale: {
        borderColor: 'rgba(63, 63, 70, 0.3)',
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(16, 185, 129, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(16, 185, 129, 0.3)', width: 1, style: 2 },
      },
    });

    const areaOptions: DeepPartial<AreaSeriesOptions> = {
      topColor: 'rgba(16, 185, 129, 0.3)',
      bottomColor: 'rgba(16, 185, 129, 0.01)',
      lineColor: '#10b981',
      lineWidth: 2,
    };

    const series = chart.addAreaSeries(areaOptions);
    series.setData(data as any);
    chart.timeScale().fitContent();

    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) chart.applyOptions({ width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return <div ref={containerRef} className="w-full" style={{ height: 260 }} />;
}

/* ------------------------------------------------------------------ */
/*  Fundamental Item                                                  */
/* ------------------------------------------------------------------ */

function FundItem({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-mono text-white">{value ?? '--'}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StockDetailModal                                                  */
/* ------------------------------------------------------------------ */

export default function StockDetailModal() {
  const { stockDetailSymbol, closeStockDetail } = useUIStore();
  const stocks = useMarketStore((s) => s.stocks);

  const [alertPrice, setAlertPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<AlertCondition>('ABOVE');
  const [alertSending, setAlertSending] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  // Fetch research data
  const { data: research, isLoading } = useQuery<StockResearch>({
    queryKey: ['research', stockDetailSymbol],
    queryFn: () => apiGet<StockResearch>(`/api/research/${stockDetailSymbol}`),
    enabled: !!stockDetailSymbol,
    staleTime: 60_000,
  });

  // Get live stock from market store for latest price
  const liveStock: Stock | undefined = stocks.find(
    (s) => s.symbol === stockDetailSymbol,
  );

  // Use research data merged with live data
  const price = liveStock?.price ?? research?.price ?? 0;
  const change = liveStock?.pctChange ?? research?.change ?? 0;

  // Close on Escape
  useEffect(() => {
    if (!stockDetailSymbol) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeStockDetail();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stockDetailSymbol, closeStockDetail]);

  // Reset alert state when symbol changes
  useEffect(() => {
    setAlertPrice('');
    setAlertMsg('');
  }, [stockDetailSymbol]);

  if (!stockDetailSymbol) return null;

  const changeColor = change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-zinc-400';
  const changePrefix = change > 0 ? '+' : '';

  const handleSetAlert = async () => {
    const target = parseFloat(alertPrice);
    if (isNaN(target) || target <= 0) {
      setAlertMsg('Enter a valid price.');
      return;
    }
    setAlertSending(true);
    setAlertMsg('');
    try {
      await apiPost('/api/alerts', {
        symbol: stockDetailSymbol,
        targetPrice: target,
        condition: alertCondition,
      });
      setAlertMsg('Alert set successfully.');
      setAlertPrice('');
    } catch (err: any) {
      setAlertMsg(err?.message ?? 'Failed to set alert.');
    } finally {
      setAlertSending(false);
    }
  };

  function formatMktCap(n?: number): string | undefined {
    if (!n) return undefined;
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    return '$' + n.toLocaleString();
  }

  const r = research;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeStockDetail}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl">
        {/* Close */}
        <button
          onClick={closeStockDetail}
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition z-20"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-zinc-800/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{stockDetailSymbol}</h2>
                  <p className="text-sm text-zinc-400">{r?.name ?? liveStock?.name ?? ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold font-mono text-white">
                    ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-sm font-medium ${changeColor}`}>
                    {changePrefix}{change.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="border-b border-zinc-800/60">
              {r?.history && r.history.length > 0 ? (
                <MiniChart data={r.history} />
              ) : (
                <div className="h-[260px] flex items-center justify-center text-zinc-600 text-sm">
                  No chart data available
                </div>
              )}
            </div>

            {/* Fundamentals grid */}
            <div className="px-6 py-4 border-b border-zinc-800/60">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
                Fundamentals
              </h3>
              <div className="grid grid-cols-4 gap-x-6 gap-y-3">
                <FundItem label="P/E" value={r?.pe?.toFixed(2)} />
                <FundItem label="EPS" value={r?.eps?.toFixed(2)} />
                <FundItem label="Div Yield" value={r?.divYield ? r.divYield.toFixed(2) + '%' : undefined} />
                <FundItem label="Mkt Cap" value={formatMktCap(r?.marketCap)} />
                <FundItem label="52W High" value={r?.high52?.toLocaleString(undefined, { minimumFractionDigits: 2 })} />
                <FundItem label="52W Low" value={r?.low52?.toLocaleString(undefined, { minimumFractionDigits: 2 })} />
                <FundItem label="Volume" value={liveStock?.volume?.toLocaleString() ?? r?.volume?.toLocaleString()} />
                <FundItem label="Sector" value={r?.sector ?? liveStock?.sector} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-6 py-4 border-b border-zinc-800/60">
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition">
                  Buy
                </button>
                <button className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-medium text-white transition">
                  Sell
                </button>
                <a
                  href={`/technicals/${stockDetailSymbol}`}
                  className="rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Chart
                </a>
                <button className="rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition">
                  Analyze
                </button>
              </div>
            </div>

            {/* Alert section */}
            <div className="px-6 py-4">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
                Set Price Alert
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                  placeholder="Target price"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition"
                />
                <select
                  value={alertCondition}
                  onChange={(e) => setAlertCondition(e.target.value as AlertCondition)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition"
                >
                  <option value="ABOVE">Above</option>
                  <option value="BELOW">Below</option>
                </select>
                <button
                  onClick={handleSetAlert}
                  disabled={alertSending}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition"
                >
                  {alertSending ? '...' : 'Set Alert'}
                </button>
              </div>
              {alertMsg && (
                <p className={`mt-2 text-xs ${alertMsg.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {alertMsg}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
