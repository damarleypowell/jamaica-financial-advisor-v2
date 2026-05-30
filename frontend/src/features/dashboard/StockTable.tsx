import { useState, useMemo } from 'react';
import { useMarketStore } from '../../stores/market';
import { useUIStore } from '../../stores/ui';
import { Link } from 'react-router-dom';
import StockLogo from '../../components/ui/StockLogo';

type Field = 'symbol' | 'name' | 'price' | 'dollarChange' | 'pctChange' | 'volume';
type Dir = 'asc' | 'desc';

interface StockRow {
  symbol: string;
  name?: string;
  price?: number;
  dollarChange?: number;
  pctChange?: number;
  volume?: number;
}

interface Props {
  stocks?: StockRow[];
  title?: string;
  isUS?: boolean;
  defaultLimit?: number;
}

const COLS: { key: Field; label: string; right?: boolean }[] = [
  { key: 'symbol',       label: 'Symbol'  },
  { key: 'price',        label: 'Price',   right: true },
  { key: 'dollarChange', label: 'Change',  right: true },
  { key: 'pctChange',    label: '%',       right: true },
  { key: 'volume',       label: 'Volume',  right: true },
];

const fmt2 = (n?: number) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtVol = (n?: number) => {
  const v = n ?? 0;
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toLocaleString();
};
const chgColor = (v?: number) => (v ?? 0) > 0 ? '#00e676' : (v ?? 0) < 0 ? '#ff5252' : 'var(--color-muted)';

export default function StockTable({ stocks: externalStocks, title, isUS, defaultLimit = 25 }: Props) {
  const jseStocks = useMarketStore((s) => s.stocks);
  const selectSymbol = useMarketStore((s) => s.selectSymbol);
  const openStockDetail = useUIStore((s) => s.openStockDetail);

  const allStocks: StockRow[] = externalStocks ?? jseStocks;

  const [q, setQ] = useState('');
  const [sf, setSf] = useState<Field>('pctChange');
  const [sd, setSd] = useState<Dir>('desc');
  const [showAll, setShowAll] = useState(false);

  const handleSort = (f: Field) => {
    if (sf === f) setSd(d => d === 'asc' ? 'desc' : 'asc');
    else { setSf(f); setSd(f === 'symbol' ? 'asc' : 'desc'); }
  };

  const rows = useMemo(() => {
    const ql = q.toLowerCase().trim();
    const r = ql
      ? allStocks.filter(s => s.symbol.toLowerCase().includes(ql) || (s.name ?? '').toLowerCase().includes(ql))
      : allStocks.filter(s => (s.price ?? 0) > 0);
    const dir = sd === 'asc' ? 1 : -1;
    return [...r].sort((a, b) => {
      const av = a[sf] ?? '', bv = b[sf] ?? '';
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [allStocks, q, sf, sd]);

  const visible = showAll || q ? rows : rows.slice(0, defaultLimit);
  const hidden = rows.length - visible.length;

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.05)' }}>
            <i className="fa-solid fa-table-list" style={{ fontSize: 12, color: 'var(--color-muted)' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{title ?? (isUS ? 'US Equities' : 'JSE Securities')}</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>{visible.length} of {rows.length} shown</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--color-muted)', pointerEvents: 'none' }} />
            <input
              value={q} onChange={e => setQ(e.target.value)} placeholder={isUS ? 'Search US symbol…' : 'Search JSE symbol…'}
              style={{ height: 32, width: 200, paddingLeft: 30, paddingRight: q ? 28 : 10, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 11, color: 'var(--color-text)', outline: 'none', transition: 'all 150ms', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(255,255,255,.18)'; e.target.style.background = 'rgba(255,255,255,.07)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.background = 'rgba(255,255,255,.05)'; }}
            />
            {q && (
              <button onClick={() => setQ('')} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <i className="fa-solid fa-xmark" style={{ fontSize: 9, color: 'var(--color-muted)' }} />
              </button>
            )}
          </div>
          {isUS && (
            <Link to="/technicals"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'var(--color-text2)', fontSize: 11, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-chart-candlestick" style={{ fontSize: 10 }} />
              Advanced Chart
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              {COLS.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', textAlign: col.right ? 'right' : 'left', color: sf === col.key ? '#00e676' : 'var(--color-muted)', transition: 'color 120ms', whiteSpace: 'nowrap' }}>
                  {col.label}{' '}
                  <i className={`fa-solid ${sf === col.key ? (sd === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`} style={{ fontSize: 7 }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)' }}>
                  {q ? 'No results found' : 'Awaiting market data...'}
                </td>
              </tr>
            ) : visible.map((s) => {
              const pos = (s.pctChange ?? 0) > 0;
              const neg = (s.pctChange ?? 0) < 0;
              return (
                <tr key={s.symbol}
                  onClick={() => { selectSymbol(s.symbol); openStockDetail(s.symbol); }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,.022)', cursor: 'pointer', transition: 'background 100ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <StockLogo symbol={s.symbol} isUS={isUS} size={34} radius={9} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{s.symbol}</p>
                        {s.name && <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                    ${fmt2(s.price)}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: chgColor(s.dollarChange) }}>
                    {(s.dollarChange ?? 0) >= 0 ? '+' : ''}${fmt2(s.dollarChange ?? 0)}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: pos ? 'rgba(0,230,118,.1)' : neg ? 'rgba(255,82,82,.1)' : 'rgba(255,255,255,.04)', color: chgColor(s.pctChange) }}>
                      {pos ? <i className="fa-solid fa-caret-up" style={{ fontSize: 8 }} /> : neg ? <i className="fa-solid fa-caret-down" style={{ fontSize: 8 }} /> : null}
                      {pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                    {fmtVol(s.volume)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Show more / less footer */}
      {hidden > 0 && !q && (
        <button onClick={() => setShowAll(v => !v)}
          style={{ width: '100%', padding: '12px 20px', background: 'rgba(255,255,255,.02)', border: 'none', borderTop: '1px solid rgba(255,255,255,.04)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--color-text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <i className={`fa-solid fa-chevron-${showAll ? 'up' : 'down'}`} style={{ fontSize: 9 }} />
          {showAll ? 'Show less' : `Show ${hidden} more ${isUS ? 'US stocks' : 'JSE stocks'}`}
        </button>
      )}
    </div>
  );
}
