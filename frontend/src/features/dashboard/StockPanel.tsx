import { useState, useMemo } from 'react';
import { useMarketStore } from '../../stores/market';

type Tab = 'gainers' | 'losers' | 'active';

interface StockLike {
  symbol: string;
  name?: string;
  price?: number;
  pctChange?: number;
  volume?: number;
}

const TABS: { key: Tab; label: string; icon: string; color: string }[] = [
  { key: 'gainers', label: 'Gainers', icon: 'fa-arrow-trend-up',   color: '#00e676' },
  { key: 'losers',  label: 'Losers',  icon: 'fa-arrow-trend-down', color: '#ff5252' },
  { key: 'active',  label: 'Active',  icon: 'fa-bolt',             color: '#ffd740' },
];

function sortStocks(stocks: StockLike[], tab: Tab): StockLike[] {
  const c = [...stocks];
  if (tab === 'gainers') return c.sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0));
  if (tab === 'losers')  return c.sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0));
  return c.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

function fmtVol(n?: number) {
  const v = n ?? 0;
  if (v >= 1e9) return (v/1e9).toFixed(1)+'B';
  if (v >= 1e6) return (v/1e6).toFixed(1)+'M';
  if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
  return v.toString();
}

interface Props {
  stocks?: StockLike[];
  isUS?: boolean;
}

export default function StockPanel({ stocks: externalStocks, isUS }: Props) {
  const [tab, setTab] = useState<Tab>('gainers');
  const jseStocks = useMarketStore(s => s.stocks);
  const selectSymbol = useMarketStore(s => s.selectSymbol);

  const allStocks = externalStocks ?? jseStocks;
  const sorted = useMemo(() => sortStocks(allStocks.filter(s => (s.price ?? 0) > 0), tab).slice(0, 15), [allStocks, tab]);
  const activeTab = TABS.find(t => t.key === tab)!;

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '11px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: 'transparent', border: 'none',
            color: tab === t.key ? t.color : 'var(--color-muted)',
            borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 150ms',
          }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 9 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, gap: 8, color: 'var(--color-muted)' }}>
            <i className="fa-solid fa-satellite-dish" style={{ fontSize: 20, opacity: .2 }} />
            <span style={{ fontSize: 12 }}>{isUS ? 'US data unavailable' : 'Awaiting market data'}</span>
          </div>
        ) : sorted.map((s, i) => {
          const pct = s.pctChange ?? 0;
          const pos = pct > 0, neg = pct < 0;
          const rowColor = tab === 'gainers' ? (pos ? '#00e676' : 'var(--color-muted)') : tab === 'losers' ? (neg ? '#ff5252' : 'var(--color-muted)') : '#ffd740';

          return (
            <button key={s.symbol} onClick={() => selectSymbol(s.symbol)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.03)', transition: 'background 120ms' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.035)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.2)', width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>

              <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: pos ? 'rgba(0,230,118,.1)' : neg ? 'rgba(255,82,82,.1)' : 'rgba(255,255,255,.05)', border: `1px solid ${pos ? 'rgba(0,230,118,.18)' : neg ? 'rgba(255,82,82,.15)' : 'rgba(255,255,255,.05)'}` }}>
                <span style={{ fontSize: 7, fontWeight: 900, color: pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)', letterSpacing: '-.02em' }}>{s.symbol.slice(0, 4)}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.symbol}</p>
                {(tab === 'active' || s.name) && (
                  <p style={{ margin: 0, fontSize: 9, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tab === 'active' ? fmtVol(s.volume) + ' vol' : (s.name ?? '')}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                  ${(s.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-mono)', color: rowColor }}>
                  {pos ? '+' : ''}{pct.toFixed(2)}%
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ padding: '7px 14px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.2)' }}>{allStocks.filter(s => (s.price ?? 0) > 0).length} securities · {isUS ? 'US' : 'JSE'}</span>
        <span style={{ fontSize: 9, color: activeTab.color, fontWeight: 700 }}>
          <i className={`fa-solid ${activeTab.icon}`} style={{ marginRight: 4, fontSize: 8 }} />
          {activeTab.label}
        </span>
      </div>
    </div>
  );
}
