import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, type IChartApi, type ISeriesApi, type AreaSeriesOptions, type DeepPartial } from 'lightweight-charts';
import { apiGet } from '../../lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface HistoryPoint {
  time: string; // "YYYY-MM-DD" or unix timestamp
  value: number;
}

interface MainChartProps {
  symbol: string;
}

/* ------------------------------------------------------------------ */
/*  MainChart                                                         */
/* ------------------------------------------------------------------ */

export default function MainChart({ symbol }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const { data } = useQuery<HistoryPoint[]>({
    queryKey: ['history', symbol],
    queryFn: () => apiGet<HistoryPoint[]>(`/api/history/${symbol}`),
    enabled: !!symbol,
    staleTime: 60_000,
  });

  /* ---- Create chart once on mount ---- */
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: 'transparent' },
        textColor: '#71717a',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(63, 63, 70, 0.3)' },
        horzLines: { color: 'rgba(63, 63, 70, 0.3)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(16, 185, 129, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(16, 185, 129, 0.3)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: 'rgba(63, 63, 70, 0.4)',
      },
      timeScale: {
        borderColor: 'rgba(63, 63, 70, 0.4)',
        timeVisible: false,
      },
    });

    const areaOptions: DeepPartial<AreaSeriesOptions> = {
      topColor: 'rgba(16, 185, 129, 0.35)',
      bottomColor: 'rgba(16, 185, 129, 0.02)',
      lineColor: '#10b981',
      lineWidth: 2,
    };

    const areaSeries = chart.addAreaSeries(areaOptions);

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    /* ---- ResizeObserver ---- */
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          chart.applyOptions({ width });
        }
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

  /* ---- Update data when it changes ---- */
  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;

    const mapped = data.map((p) => ({
      time: p.time as string,
      value: p.value,
    }));

    seriesRef.current.setData(mapped as any);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
        <span className="text-sm font-semibold text-white">
          {symbol || 'Select a stock'}
        </span>
        {symbol && (
          <span className="text-xs text-zinc-500">Price History</span>
        )}
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="w-full" style={{ height: 400 }}>
        {!symbol && (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            Select a stock to view its chart
          </div>
        )}
      </div>
    </div>
  );
}
