import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createChart,
  AreaSeries,
  type IChartApi,
} from 'lightweight-charts';
import { Link } from 'react-router-dom';
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
      height: 240,
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7a8d',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.06)' },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.06)', timeVisible: false },
      crosshair: {
        vertLine: { color: 'rgba(0, 200, 83, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(0, 200, 83, 0.3)', width: 1, style: 2 },
      },
    });

    const series = chart.addSeries(AreaSeries, {
      topColor: 'rgba(0, 200, 83, 0.25)',
      bottomColor: 'rgba(0, 200, 83, 0.01)',
      lineColor: '#00c853',
      lineWidth: 2,
    });
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

  return <div ref={containerRef} className="w-full" style={{ height: 240 }} />;
}

/* ------------------------------------------------------------------ */
/*  Fundamental Item                                                  */
/* ------------------------------------------------------------------ */

function FundItem({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      <span className="text-sm font-mono text-text">{value ?? '--'}</span>
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

  const { data: research, isLoading } = useQuery<StockResearch>({
    queryKey: ['research', stockDetailSymbol],
    queryFn: () => apiGet<StockResearch>(`/api/research/${stockDetailSymbol}`),
    enabled: !!stockDetailSymbol,
    staleTime: 60_000,
  });

  const liveStock: Stock | undefined = stocks.find(
    (s) => s.symbol === stockDetailSymbol,
  );

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

  const changeColor = change > 0 ? 'text-green' : change < 0 ? 'text-red' : 'text-muted';
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeStockDetail}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-2xl border border-border2 bg-bg2/95 backdrop-blur-2xl shadow-2xl animate-fade-in">
        {/* Close */}
        <button
          onClick={closeStockDetail}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-glass transition z-20"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-4 pr-8">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-text">{stockDetailSymbol}</h2>
                    {r?.sector && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue/10 text-blue border border-blue/20">
                        {r.sector}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text2 mt-0.5">{r?.name ?? liveStock?.name ?? ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold font-mono text-text">
                    ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-sm font-semibold ${changeColor}`}>
                    {changePrefix}{change.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="border-b border-border">
              {r?.history && r.history.length > 0 ? (
                <MiniChart data={r.history} />
              ) : (
                <div className="h-[240px] flex items-center justify-center text-muted text-sm">
                  No chart data available
                </div>
              )}
            </div>

            {/* Fundamentals grid */}
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
                Fundamentals
              </h3>
              <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                <FundItem label="P/E" value={r?.pe?.toFixed(2)} />
                <FundItem label="EPS" value={r?.eps?.toFixed(2)} />
                <FundItem label="Div Yield" value={r?.divYield ? r.divYield.toFixed(2) + '%' : undefined} />
                <FundItem label="Mkt Cap" value={formatMktCap(r?.marketCap)} />
                <FundItem
                  label="52W High"
                  value={r?.high52?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                />
                <FundItem
                  label="52W Low"
                  value={r?.low52?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                />
                <FundItem
                  label="Volume"
                  value={liveStock?.volume?.toLocaleString() ?? r?.volume?.toLocaleString()}
                />
                <FundItem label="Sector" value={r?.sector ?? liveStock?.sector} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg bg-green hover:bg-green/90 px-5 py-2 text-sm font-semibold text-bg transition">
                  Buy
                </button>
                <button className="rounded-lg bg-red hover:bg-red/90 px-5 py-2 text-sm font-semibold text-bg transition">
                  Sell
                </button>
                <Link
                  to={`/technicals/${stockDetailSymbol}`}
                  onClick={closeStockDetail}
                  className="rounded-lg border border-border bg-glass hover:bg-glass2 px-4 py-2 text-sm font-medium text-text2 hover:text-text transition inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Chart
                </Link>
                <button className="rounded-lg border border-border bg-glass hover:bg-glass2 px-4 py-2 text-sm font-medium text-text2 hover:text-text transition">
                  Analyze
                </button>
              </div>
            </div>

            {/* Alert section */}
            <div className="px-6 py-4">
              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
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
                  className="flex-1 rounded-lg border border-border bg-glass px-3 py-2 text-sm text-text placeholder-muted outline-none focus:border-green/50 focus:ring-1 focus:ring-green/20 transition"
                />
                <select
                  value={alertCondition}
                  onChange={(e) => setAlertCondition(e.target.value as AlertCondition)}
                  className="rounded-lg border border-border bg-glass px-3 py-2 text-sm text-text outline-none focus:border-green/50 transition"
                >
                  <option value="ABOVE">Above</option>
                  <option value="BELOW">Below</option>
                </select>
                <button
                  onClick={handleSetAlert}
                  className="rounded-lg bg-green hover:bg-green/90 disabled:opacity-50 px-4 py-2 text-sm font-medium text-bg transition"
                >
                  {alertSending ? '...' : 'Set Alert'}
                </button>
              </div>
              {alertMsg && (
                <p
                  className={`mt-2 text-xs ${
                    alertMsg.includes('success') ? 'text-green' : 'text-red'
                  }`}
                >
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
