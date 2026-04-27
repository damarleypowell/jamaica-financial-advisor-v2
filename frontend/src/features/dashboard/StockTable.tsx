import { useState, useMemo } from 'react';
import { useMarketStore } from '../../stores/market';
import { useUIStore } from '../../stores/ui';
import type { Stock } from '../../types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type SortField = 'symbol' | 'name' | 'price' | 'dollarChange' | 'pctChange' | 'volume';
type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: SortField;
  label: string;
  align?: 'left' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { key: 'symbol', label: 'Symbol', align: 'left' },
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'price', label: 'Price', align: 'right' },
  { key: 'dollarChange', label: '$Change', align: 'right' },
  { key: 'pctChange', label: '%Change', align: 'right' },
  { key: 'volume', label: 'Volume', align: 'right' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatPrice(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function changeColor(v: number): string {
  if (v > 0) return 'text-green';
  if (v < 0) return 'text-red';
  return 'text-muted';
}

function changePrefix(v: number): string {
  return v > 0 ? '+' : '';
}

/* ------------------------------------------------------------------ */
/*  SortIcon                                                          */
/* ------------------------------------------------------------------ */

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="w-3 h-3 text-muted ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 text-green ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {dir === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  StockTable                                                        */
/* ------------------------------------------------------------------ */

export default function StockTable() {
  const stocks = useMarketStore((s) => s.stocks);
  const selectSymbol = useMarketStore((s) => s.selectSymbol);
  const openStockDetail = useUIStore((s) => s.openStockDetail);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'symbol' || field === 'name' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = stocks;

    if (q) {
      result = stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q),
      );
    }

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...result].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
  }, [stocks, search, sortField, sortDir]);

  const handleRowClick = (stock: Stock) => {
    selectSymbol(stock.symbol);
    openStockDetail(stock.symbol);
  };

  return (
    <div className="rounded-xl border border-border bg-card backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">All Stocks</h3>
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stocks..."
            className="w-48 rounded-lg border border-border bg-glass pl-8 pr-3 py-1.5 text-xs text-text placeholder-muted outline-none focus:border-green/50 focus:ring-1 focus:ring-green/20 transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wide cursor-pointer hover:text-text2 transition select-none ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                  <SortIcon active={sortField === col.key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-muted text-sm">
                  {search ? 'No stocks match your search' : 'No stock data available'}
                </td>
              </tr>
            ) : (
              filtered.map((stock) => (
                <tr
                  key={stock.symbol}
                  onClick={() => handleRowClick(stock)}
                  className="border-b border-border/30 hover:bg-glass cursor-pointer transition"
                >
                  <td className="px-4 py-2.5 font-medium text-text">{stock.symbol}</td>
                  <td className="px-4 py-2.5 text-text2 truncate max-w-[200px]">{stock.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-text">
                    ${formatPrice(stock.price)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${changeColor(stock.dollarChange)}`}>
                    {changePrefix(stock.dollarChange)}
                    {formatPrice(Math.abs(stock.dollarChange))}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${changeColor(stock.pctChange)}`}>
                    {changePrefix(stock.pctChange)}
                    {stock.pctChange.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted">
                    {formatVolume(stock.volume)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-[11px] text-muted">
        {filtered.length} of {stocks.length} stocks
      </div>
    </div>
  );
}
