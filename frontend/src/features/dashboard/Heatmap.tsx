import { useMemo, useState } from 'react';
import { useMarketStore } from '../../stores/market';
import { useUIStore } from '../../stores/ui';
import type { Stock } from '../../types';

function changeToColor(pct: number): string {
  if (pct === 0) return 'bg-glass2';
  const clamped = Math.max(-10, Math.min(10, pct));
  const intensity = Math.abs(clamped) / 10;
  if (pct > 0) {
    if (intensity > 0.7) return 'bg-green/70';
    if (intensity > 0.4) return 'bg-green/40';
    if (intensity > 0.15) return 'bg-green/20';
    return 'bg-green/10';
  } else {
    if (intensity > 0.7) return 'bg-red/70';
    if (intensity > 0.4) return 'bg-red/40';
    if (intensity > 0.15) return 'bg-red/20';
    return 'bg-red/10';
  }
}

function formatChange(n: number): string {
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(2)}%`;
}

function HeatmapTile({ stock }: { stock: Stock }) {
  const selectSymbol = useMarketStore((s) => s.selectSymbol);
  const openStockDetail = useUIStore((s) => s.openStockDetail);
  const bg = changeToColor(stock.pctChange);
  const textColor = stock.pctChange > 0 ? 'text-green' : stock.pctChange < 0 ? 'text-red' : 'text-text2';

  return (
    <button
      onClick={() => { selectSymbol(stock.symbol); openStockDetail(stock.symbol); }}
      className={`${bg} rounded-lg p-2.5 flex flex-col items-center justify-center gap-0.5 border border-border hover:border-border2 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer min-h-[72px]`}
    >
      <span className="text-xs font-bold text-text leading-tight">{stock.symbol}</span>
      <span className={`text-[11px] font-mono font-semibold ${textColor}`}>
        {formatChange(stock.pctChange)}
      </span>
    </button>
  );
}

const STORAGE_KEY = 'gotham_heatmap_collapsed';

export default function Heatmap() {
  const stocks = useMarketStore((s) => s.stocks);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  };

  const sorted = useMemo(
    () => [...stocks].sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)),
    [stocks],
  );

  const gainers = stocks.filter((s) => s.pctChange > 0).length;
  const losers = stocks.filter((s) => s.pctChange < 0).length;

  return (
    <div className="rounded-xl border border-border bg-card backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-glass/40 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-green/10 flex items-center justify-center">
            <i className="fa-solid fa-fire text-green text-xs" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text leading-none">Market Heatmap</h3>
            <p className="text-[11px] text-muted mt-0.5">
              {gainers} gaining &middot; {losers} falling &middot; {stocks.length} total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red/50" /> Loss
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-glass2 border border-border" /> Flat
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-green/50" /> Gain
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-glass hover:bg-glass2 text-xs text-muted hover:text-text transition-colors"
            aria-label={collapsed ? 'Show heatmap' : 'Hide heatmap'}
          >
            <i className={`fa-solid fa-chevron-${collapsed ? 'down' : 'up'} text-[10px]`} />
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-3 border-t border-border">
          {sorted.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">No stock data available</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5">
              {sorted.map((stock) => (
                <HeatmapTile key={stock.symbol} stock={stock} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
