import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useMarketStore } from '../../stores/market';

const MONO = "'JetBrains Mono', monospace";
const f2 = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DONUT_COLORS = ['#00e676', '#40c4ff', '#ce93d8', '#ffd740', '#ff8a65', '#4dd0e1', '#f06292', '#aed581', '#9575cd', '#fff176'];

interface Holding { symbol: string; shares?: number; avgCost?: number; market?: string; isPaper?: boolean; }

/* ─── allocation donut (SVG) ─── */
function Donut({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const R = 54, C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, flexShrink: 0 }}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="16" />
      {slices.map((s, i) => {
        const frac = s.value / total;
        const dash = frac * C;
        const el = (
          <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="16"
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} transform="rotate(-90 70 70)"
            strokeLinecap="butt" />
        );
        acc += frac;
        return el;
      })}
      <text x="70" y="66" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,.4)" fontFamily="'JetBrains Mono'">HOLDINGS</text>
      <text x="70" y="84" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff" fontFamily="'JetBrains Mono'">{slices.length}</text>
    </svg>
  );
}

export default function Holdings() {
  const { isAuthenticated } = useAuthStore();
  const stocks = useMarketStore(s => s.stocks);
  const qc = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [symSearch, setSymSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');

  const { data: raw = [], isLoading } = useQuery<Holding[]>({
    queryKey: ['user-portfolio'],
    queryFn: () => apiGet('/api/user/portfolio'),
    enabled: isAuthenticated,
  });

  const holdings = useMemo(() => (Array.isArray(raw) ? raw : []).filter(h => h.isPaper !== true && h.symbol), [raw]);

  const saveMut = useMutation({
    mutationFn: (next: Holding[]) => apiPut('/api/user/portfolio', { portfolio: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-portfolio'] }),
  });

  const priceOf = (sym: string) => stocks.find(s => s.symbol === sym)?.price ?? 0;

  const rows = useMemo(() => holdings.map((h, i) => {
    const live = priceOf(h.symbol!);
    const px = live > 0 ? live : (h.avgCost ?? 0);
    const sh = h.shares ?? 0;
    const value = px * sh;
    const cost = (h.avgCost ?? 0) * sh;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    return { ...h, color: DONUT_COLORS[i % DONUT_COLORS.length], live, value, cost, pnl, pnlPct, hasLive: live > 0 };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [holdings, stocks]);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const slices = rows.filter(r => r.value > 0).map(r => ({ label: r.symbol!, value: r.value, color: r.color }));

  const filtered = symSearch.trim()
    ? stocks.filter(s => s.symbol.includes(symSearch.toUpperCase()) || s.name.toUpperCase().includes(symSearch.toUpperCase())).slice(0, 8)
    : stocks.slice(0, 8);

  const addHolding = () => {
    const sym = (symbol || symSearch).trim().toUpperCase();
    const sh = parseFloat(shares), ac = parseFloat(avgCost);
    if (!sym || !sh || sh <= 0 || !ac || ac <= 0) return;
    const existingIdx = holdings.findIndex(h => h.symbol === sym);
    const next = [...holdings];
    const market = stocks.find(s => s.symbol === sym)?.symbol ? 'JSE' : 'US';
    if (existingIdx >= 0) next[existingIdx] = { ...next[existingIdx], shares: sh, avgCost: ac, isPaper: false };
    else next.push({ symbol: sym, shares: sh, avgCost: ac, market, isPaper: false });
    saveMut.mutate(next);
    setAdding(false); setSymbol(''); setSymSearch(''); setShares(''); setAvgCost('');
  };

  const removeHolding = (sym: string) => saveMut.mutate(holdings.filter(h => h.symbol !== sym));

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 14, textAlign: 'center', padding: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-solid fa-chart-pie" style={{ fontSize: 24, color: '#00e676' }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--color-text)' }}>Sign in to track your portfolio</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', maxWidth: 320 }}>Add your real holdings and see them valued at live prices — read-only, we never touch your brokerage.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-solid fa-chart-pie" style={{ fontSize: 15, color: '#00e676' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>My Real Portfolio</h1>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)' }}>Holdings you track manually, valued at live prices</p>
        </div>
      </div>

      {/* Read-only assurance + future brokerage connect */}
      <div style={{ padding: '12px 16px', borderRadius: 13, background: 'rgba(64,196,255,.05)', border: '1px solid rgba(64,196,255,.16)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <i className="fa-solid fa-lock" style={{ fontSize: 13, color: '#40c4ff' }} />
        <span style={{ fontSize: 12, color: 'var(--color-text2)', flex: 1, minWidth: 200, lineHeight: 1.5 }}>
          <strong style={{ color: '#fff' }}>Read-only.</strong> Enter holdings manually — we value and visualise them, but never connect to or move money in your brokerage.
        </span>
        <button disabled title="Coming soon — auto-sync from US brokerages"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', cursor: 'not-allowed' }}>
          <i className="fa-solid fa-link" style={{ fontSize: 10 }} /> Connect US brokerage · soon
        </button>
      </div>

      {/* Summary + donut */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '18px 20px' }}>
          <Donut slices={slices} />
          <div style={{ flex: 1, minWidth: 200, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Total Value</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: MONO, color: 'var(--color-text)' }}>J${f2(totalValue)}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Total Cost</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: MONO, color: 'var(--color-text2)' }}>J${f2(totalCost)}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Total P&amp;L</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: MONO, color: totalPnL >= 0 ? '#00e676' : '#ff5252' }}>
                {totalPnL >= 0 ? '+' : ''}J${f2(Math.abs(totalPnL))}
                <span style={{ fontSize: 13, marginLeft: 6 }}>{totalPnL >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add button / form */}
      {!adding ? (
        <button onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 13, background: 'rgba(0,230,118,.1)', border: '1px dashed rgba(0,230,118,.35)', color: '#00e676', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <i className="fa-solid fa-plus" /> Add a holding
        </button>
      ) : (
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>Stock</label>
            <input value={symbol || symSearch} onChange={e => { setSymSearch(e.target.value.toUpperCase()); setSymbol(''); setShowDrop(true); }} onFocus={() => setShowDrop(true)} onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="Search symbol or company…"
              style={{ width: '100%', height: 40, padding: '0 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: `1px solid ${symbol ? 'rgba(0,230,118,.3)' : 'var(--color-border)'}`, color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            {showDrop && !symbol && filtered.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: 'var(--color-bg3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 11, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
                {filtered.map(s => (
                  <button key={s.symbol} onMouseDown={() => { setSymbol(s.symbol); setSymSearch(''); setAvgCost(String(s.price || '')); setShowDrop(false); }}
                    style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span><span style={{ fontSize: 12, fontWeight: 800, fontFamily: MONO, color: '#fff', marginRight: 8 }}>{s.symbol}</span><span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{s.name}</span></span>
                    <span style={{ fontSize: 11, fontFamily: MONO, color: 'var(--color-text2)' }}>J${f2(s.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>Shares</label>
              <input value={shares} onChange={e => setShares(e.target.value)} type="number" min="0" placeholder="e.g. 100"
                style={{ width: '100%', height: 40, padding: '0 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, fontFamily: MONO, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>Avg cost (J$)</label>
              <input value={avgCost} onChange={e => setAvgCost(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00"
                style={{ width: '100%', height: 40, padding: '0 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, fontFamily: MONO, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addHolding} disabled={saveMut.isPending}
              style={{ flex: 1, height: 42, borderRadius: 11, background: '#00e676', color: '#04060d', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', opacity: saveMut.isPending ? .6 : 1 }}>
              {saveMut.isPending ? 'Saving…' : 'Add holding'}
            </button>
            <button onClick={() => { setAdding(false); setSymbol(''); setSymSearch(''); setShares(''); setAvgCost(''); }}
              style={{ height: 42, padding: '0 18px', borderRadius: 11, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Holdings list */}
      {isLoading ? (
        <div className="skeleton" style={{ height: 120, borderRadius: 14 }} />
      ) : rows.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 10 }}>
          <i className="fa-solid fa-folder-open" style={{ fontSize: 30, color: 'var(--color-muted)', opacity: .25 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text2)' }}>No holdings yet</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Add your first holding to see it valued live.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <div key={r.symbol} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, fontFamily: MONO, color: '#fff' }}>{r.symbol} <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-muted)' }}>{r.market}</span></p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)' }}>
                  {r.shares} sh @ J${f2(r.avgCost)} {r.hasLive ? <span style={{ color: 'var(--color-text2)' }}>· now J${f2(r.live)}</span> : <span style={{ color: '#ffd740' }}>· no live price</span>}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: MONO, color: '#fff' }}>J${f2(r.value)}</p>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, fontFamily: MONO, color: r.pnl >= 0 ? '#00e676' : '#ff5252' }}>{r.pnl >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%</p>
              </div>
              <button onClick={() => removeHolding(r.symbol!)} title="Remove"
                style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', cursor: 'pointer', flexShrink: 0 }}>
                <i className="fa-solid fa-xmark" style={{ fontSize: 11 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Prices are sourced live where available. JSE brokers don't offer data connections, so holdings are entered manually. Educational only — not financial advice.
      </p>
    </div>
  );
}
