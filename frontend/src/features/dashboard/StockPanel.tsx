import { useState, useMemo } from 'react';
import { useMarketStore } from '../../stores/market';
import type { Stock } from '../../types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type SortMode = 'gainers' | 'losers' | 'active';

const TABS: { key: SortMode; label: string }[] = [
  { key: 'gainers', label: 'Top Gainers' },
  { key: 'losers', label: 'Top Losers' },
  { key: 'active', label: 'Most Active' },
];

const DISPLAY_COUNT = 12;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function sortStocks(stocks: Stock[], mode: SortMode): Stock[] {
  const copy = [...stocks];
  switch (mode) {
    case 'gainers':
      return copy.sort((a, b) => b.pctChange - a.pctChange);
    case 'losers':
      return copy.sort((a, b) => a.pctChange - b.pctChange);
    case 'active':
      return copy.sort((a, b) => b.volume - a.volume);
  }
}

function formatPrice(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(n: number): string {
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(2)}%`;
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

/* ------------------------------------------------------------------ */
/*  StockRow                                                          */
/* ------------------------------------------------------------------ */

function StockRow({ stock, onSelect }: { stock: Stock; onSelect: (s: string) => void }) {
  const changeColor = stock.pctChange > 0 ? 'text-emerald-400' : stock.pctChange < 0 ? 'text-red-400' : 'text-zinc-400';

  return (
    <button
      onClick={() => onSelect(stock.symbol)}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/50 rounded-lg transition group text-left"
    >
      {/* Symbol badge */}
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
        <span className="text-[10px] font-bold text-zinc-300">
          {stock.symbol.slice(0, 3)}
        </span>
      </div>

      {/* Name + symbol */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-emerald-400 transition">
          {stock.symbol}
        </p>
        <p className="text-[11px] text-zinc-500 truncate">{stock.name}</p>
      </div>

      {/* Price + change */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-mono text-white">${formatPrice(stock.price)}</p>
        <p className={`text-[11px] font-medium ${changeColor}`}>
          {formatChange(stock.pctChange)}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  StockPanel                                                        */
/* ------------------------------------------------------------------ */

export default function StockPanel() {
  const [mode, setMode] = useState<SortMode>('gainers');
  const stocks = useMarketStore((s) => s.stocks);
  const selectSymbol = useMarketStore((s) => s.selectSymbol);

  const sorted = useMemo(
    () => sortStocks(stocks, mode).slice(0, DISPLAY_COUNT),
    [stocks, mode],
  );

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 backdrop-blur-sm flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800/60">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition ${
              mode === tab.key
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
            No stock data available
          </div>
        ) : (
          sorted.map((stock) => (
            <StockRow key={stock.symbol} stock={stock} onSelect={selectSymbol} />
          ))
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-2 border-t border-zinc-800/60 text-[11px] text-zinc-600">
        {stocks.length} stocks tracked
        {mode === 'active' && sorted.length > 0 && (
          <span className="ml-2">
            Top vol: {formatVolume(sorted[0].volume)}
          </span>
        )}
      </div>
    </div>
  );
}
