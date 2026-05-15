import { useState, useMemo } from 'react';
import { useMarketStore } from '../../stores/market';
import type { Stock } from '../../types';

type Tab = 'gainers' | 'losers' | 'active';

const TABS: { key: Tab; label: string; icon: string; color: string }[] = [
  { key: 'gainers', label: 'Gainers', icon: 'fa-arrow-trend-up',   color: '#00e676' },
  { key: 'losers',  label: 'Losers',  icon: 'fa-arrow-trend-down', color: '#ff5252' },
  { key: 'active',  label: 'Active',  icon: 'fa-bolt',             color: '#ffd740' },
];

function sort(stocks: Stock[], tab: Tab): Stock[] {
  const c = [...stocks];
  if (tab === 'gainers') return c.sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0));
  if (tab === 'losers')  return c.sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0));
  return c.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

function fmtVol(n?: number) {
  const v = n ?? 0;
  if (v >= 1e6) return (v/1e6).toFixed(1)+'M';
  if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
  return v.toString();
}

export default function StockPanel() {
  const [tab, setTab] = useState<Tab>('gainers');
  const stocks = useMarketStore(s => s.stocks);
  const selectSymbol = useMarketStore(s => s.selectSymbol);
  const sorted = useMemo(() => sort(stocks, tab).slice(0, 18), [stocks, tab]);

  const activeTab = TABS.find(t => t.key === tab)!;

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 400 }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '12px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: 'transparent', border: 'none',
            color: tab === t.key ? t.color : 'var(--color-muted)',
            borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 150ms',
          }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 10 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: 'var(--color-muted)' }}>
            <i className="fa-solid fa-satellite-dish" style={{ fontSize: 22, opacity: .2 }} />
            <span style={{ fontSize: 12 }}>Awaiting market data</span>
          </div>
        ) : sorted.map((s, i) => {
          const pct = s.pctChange ?? 0;
          const pos = pct > 0, neg = pct < 0;
          // Color per tab context
          const rowColor = tab === 'gainers'
            ? (pos ? '#00e676' : 'var(--color-muted)')
            : tab === 'losers'
            ? (neg ? '#ff5252' : 'var(--color-muted)')
            : '#ffd740';

          return (
            <button key={s.symbol} onClick={() => selectSymbol(s.symbol)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.03)', transition: 'background 120ms' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Rank */}
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-muted)', width: 16, textAlign: 'right', flexShrink: 0, opacity: .5 }}>{i + 1}</span>

              {/* Icon */}
              <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: pos ? 'rgba(0,230,118,.1)' : neg ? 'rgba(255,82,82,.1)' : 'rgba(255,255,255,.05)' }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)' }}>{s.symbol.slice(0, 3)}</span>
              </div>

              {/* Symbol */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{s.symbol}</p>
                {tab === 'active' && (
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>{fmtVol(s.volume)} vol</p>
                )}
              </div>

              {/* Price + change */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                  ${(s.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: rowColor }}>
                  {pos ? '+' : ''}{pct.toFixed(2)}%
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{stocks.length} securities · JSE</span>
        <span style={{ fontSize: 10, color: activeTab.color, fontWeight: 600 }}>
          <i className={`fa-solid ${activeTab.icon}`} style={{ marginRight: 4, fontSize: 9 }} />
          {activeTab.label}
        </span>
      </div>
    </div>
  );
}
