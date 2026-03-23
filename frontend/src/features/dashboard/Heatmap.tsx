import { useMemo } from 'react';
import { useMarketStore } from '../../stores/market';
import { useUIStore } from '../../stores/ui';
import type { Stock } from '../../types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Map a percentage change to a background color.
 * Positive = green shades, negative = red shades, zero = neutral.
 */
function changeToColor(pct: number): string {
  if (pct === 0) return 'bg-zinc-800';

  // Clamp to -10..+10 range for color intensity
  const clamped = Math.max(-10, Math.min(10, pct));
  const intensity = Math.abs(clamped) / 10; // 0..1

  if (pct > 0) {
    if (intensity > 0.7) return 'bg-emerald-600/80';
    if (intensity > 0.4) return 'bg-emerald-600/50';
    if (intensity > 0.15) return 'bg-emerald-600/30';
    return 'bg-emerald-600/15';
  } else {
    if (intensity > 0.7) return 'bg-red-600/80';
    if (intensity > 0.4) return 'bg-red-600/50';
    if (intensity > 0.15) return 'bg-red-600/30';
    return 'bg-red-600/15';
  }
}

function formatChange(n: number): string {
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(2)}%`;
}

/* ------------------------------------------------------------------ */
/*  HeatmapTile                                                       */
/* ------------------------------------------------------------------ */

function HeatmapTile({ stock }: { stock: Stock }) {
  const selectSymbol = useMarketStore((s) => s.selectSymbol);
  const openStockDetail = useUIStore((s) => s.openStockDetail);

  const bg = changeToColor(stock.pctChange);
  const textColor =
    stock.pctChange > 0
      ? 'text-emerald-200'
      : stock.pctChange < 0
        ? 'text-red-200'
        : 'text-zinc-300';

  return (
    <button
      onClick={() => {
        selectSymbol(stock.symbol);
        openStockDetail(stock.symbol);
      }}
      className={`${bg} rounded-lg p-2.5 flex flex-col items-center justify-center gap-0.5 border border-zinc-700/30 hover:border-zinc-500/50 transition cursor-pointer min-h-[72px]`}
    >
      <span className="text-xs font-bold text-white">{stock.symbol}</span>
      <span className={`text-[11px] font-mono font-medium ${textColor}`}>
        {formatChange(stock.pctChange)}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Heatmap                                                           */
/* ------------------------------------------------------------------ */

export default function Heatmap() {
  const stocks = useMarketStore((s) => s.stocks);

  // Sort by absolute change so the most-moved stocks appear first
  const sorted = useMemo(
    () => [...stocks].sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)),
    [stocks],
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 backdrop-blur-sm p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Market Heatmap</h3>
        <div className="text-sm text-zinc-600 text-center py-8">
          No stock data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Market Heatmap</h3>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-600/60" /> Loss
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-zinc-800" /> Flat
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-emerald-600/60" /> Gain
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-1.5">
        {sorted.map((stock) => (
          <HeatmapTile key={stock.symbol} stock={stock} />
        ))}
      </div>
    </div>
  );
}
