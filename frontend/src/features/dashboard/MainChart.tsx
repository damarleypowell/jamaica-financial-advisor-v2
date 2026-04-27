import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createChart,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { Link } from 'react-router-dom';
import { useMarketStore } from '../../stores/market';
import { apiGet } from '../../lib/api';

interface HistoryPoint {
  time: string;
  value: number;
}

interface MainChartProps {
  symbol: string;
}

type Timeframe = '1W' | '1M' | '3M' | '6M' | '1Y';
const TIMEFRAMES: Timeframe[] = ['1W', '1M', '3M', '6M', '1Y'];

export default function MainChart({ symbol }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1M');

  const stocks = useMarketStore((s) => s.stocks);
  const liveStock = stocks.find((s) => s.symbol === symbol);

  const { data, isLoading } = useQuery<HistoryPoint[]>({
    queryKey: ['history', symbol, timeframe],
    queryFn: () => apiGet<HistoryPoint[]>(`/api/history/${symbol}?period=${timeframe}`),
    enabled: !!symbol,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 340,
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7a8d',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(0,200,83,0.35)', width: 1, style: 2 },
        horzLine: { color: 'rgba(0,200,83,0.35)', width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: true, fixLeftEdge: true },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(0,200,83,0.28)',
      bottomColor: 'rgba(0,200,83,0.01)',
      lineColor: '#00c853',
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = areaSeries;

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
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;
    seriesRef.current.setData(data as any);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  const changePositive = (liveStock?.pctChange ?? 0) >= 0;
  const changeColor = changePositive ? 'text-green' : 'text-red';
  const changePrefix = changePositive ? '+' : '';

  return (
    <div className="rounded-xl border border-border bg-card backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border flex-wrap">
        {/* Left: symbol + live price */}
        <div className="flex-1 min-w-0">
          {symbol ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-base font-bold text-text">{symbol}</span>
              {liveStock?.name && (
                <span className="text-sm text-muted truncate hidden sm:block max-w-[200px]">
                  {liveStock.name}
                </span>
              )}
              {liveStock && (
                <div className="flex items-center gap-2">
                  <span className="text-base font-mono font-semibold text-text">
                    ${liveStock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-sm font-semibold ${changeColor}`}>
                    {changePrefix}{liveStock.pctChange.toFixed(2)}%
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse inline-block" />
                    LIVE
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted">Select a stock to view chart</span>
          )}
        </div>

        {/* Right: timeframe tabs + full chart link */}
        {symbol && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-glass rounded-lg p-0.5 border border-border">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    timeframe === tf
                      ? 'bg-green text-bg'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <Link
              to={`/technicals/${symbol}`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-glass hover:bg-glass2 text-xs font-medium text-text2 hover:text-text transition"
            >
              <i className="fa-solid fa-up-right-and-down-left-from-center text-[10px]" />
              Full Chart
            </Link>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/60 z-10">
            <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="w-full" style={{ height: 340 }}>
          {!symbol && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted">
              <i className="fa-solid fa-chart-area text-3xl opacity-30" />
              <span className="text-sm">Select a stock to view its chart</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
