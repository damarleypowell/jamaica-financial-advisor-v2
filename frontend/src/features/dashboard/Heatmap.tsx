import { useMemo, useState } from 'react';
import { useMarketStore } from '../../stores/market';
import { useUIStore } from '../../stores/ui';
import type { Stock } from '../../types';

function tileStyle(pct: number): React.CSSProperties {
  if (pct === 0) return { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' };
  const c = Math.max(-10, Math.min(10, pct));
  const t = Math.abs(c) / 10;
  if (pct > 0) {
    const g = `rgba(0,230,118,${t > .7 ? .55 : t > .4 ? .32 : t > .15 ? .16 : .07})`;
    const b = `rgba(0,230,118,${t > .4 ? .3 : .12})`;
    return { background: g, border: `1px solid ${b}` };
  } else {
    const r = `rgba(255,82,82,${t > .7 ? .55 : t > .4 ? .32 : t > .15 ? .16 : .07})`;
    const b = `rgba(255,82,82,${t > .4 ? .3 : .12})`;
    return { background: r, border: `1px solid ${b}` };
  }
}

function Tile({ stock }: { stock: Stock }) {
  const selectSymbol = useMarketStore((s) => s.selectSymbol);
  const openStockDetail = useUIStore((s) => s.openStockDetail);
  const pos = (stock.pctChange ?? 0) > 0, neg = (stock.pctChange ?? 0) < 0;

  return (
    <button
      onClick={() => { selectSymbol(stock.symbol); openStockDetail(stock.symbol); }}
      style={{ ...tileStyle(stock.pctChange ?? 0), borderRadius: 12, minHeight: 66 }}
      className="flex flex-col items-center justify-center gap-1 p-2 transition-transform hover:scale-[1.05] active:scale-[.97] cursor-pointer"
    >
      <span className="text-[11px] font-black num leading-none" style={{ color: 'var(--color-text)' }}>{stock.symbol}</span>
      <span className="text-[10px] font-bold num leading-none"
        style={{ color: pos ? 'var(--color-green)' : neg ? 'var(--color-red)' : 'var(--color-muted)' }}>
        {pos ? '+' : ''}{(stock.pctChange ?? 0).toFixed(2)}%
      </span>
    </button>
  );
}

const KEY = 'gotham_heatmap_v2';

export default function Heatmap() {
  const stocks = useMarketStore((s) => s.stocks);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(KEY) === 'true'; } catch { return false; }
  });
  const toggle = () => setCollapsed(v => { const n = !v; try { localStorage.setItem(KEY, String(n)); } catch {} return n; });
  const sorted = useMemo(() => [...stocks].sort((a, b) => Math.abs(b.pctChange ?? 0) - Math.abs(a.pctChange ?? 0)), [stocks]);
  const gainers = stocks.filter(s => (s.pctChange ?? 0) > 0).length;
  const losers = stocks.filter(s => (s.pctChange ?? 0) < 0).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: collapsed ? 'none' : '1px solid var(--color-border)' }}
        onClick={toggle}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,230,118,.1)' }}>
            <i className="fa-solid fa-fire text-sm" style={{ color: 'var(--color-green)' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Market Heatmap</h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {gainers} gaining · {losers} falling · {stocks.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-[9px] font-semibold" style={{ color: 'var(--color-muted)' }}>
            {[['rgba(255,82,82,.45)', 'Loss'],['rgba(255,255,255,.1)','Flat'],['rgba(0,230,118,.45)','Gain']].map(([bg, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: bg }} />
                {label}
              </span>
            ))}
          </div>
          <button onClick={e => { e.stopPropagation(); toggle(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text2)' }}>
            <i className={`fa-solid fa-chevron-${collapsed ? 'down' : 'up'} text-[9px]`} />
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: 'var(--color-muted)' }}>
              <i className="fa-solid fa-satellite-dish text-2xl opacity-20" />
              <span className="text-sm">Awaiting market data</span>
            </div>
          ) : (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))' }}>
              {sorted.map(s => <Tile key={s.symbol} stock={s} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
