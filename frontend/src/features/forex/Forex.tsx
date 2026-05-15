import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

interface ForexRate {
  pair: string; base: string; quote: string;
  rate: number; change?: number; pctChange?: number;
  bid?: number; ask?: number; high24h?: number; low24h?: number;
  lastUpdated?: string;
}

const PAIR_COLORS: Record<string, string> = {
  'USD/JMD': '#00e676', 'EUR/JMD': '#40c4ff', 'GBP/JMD': '#ce93d8',
  'CAD/JMD': '#ffd740', 'TTD/JMD': '#ff8a65', 'BBD/JMD': '#80deea',
};

function fmt2(n?: number) { return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }

export default function Forex() {
  const { data, isLoading, dataUpdatedAt } = useQuery<ForexRate[]>({
    queryKey: ['forex'],
    queryFn: () => apiGet<ForexRate[]>('/api/forex'),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  const rates = data ?? [];
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>Forex Rates</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>Live currency exchange rates — JMD pairs</p>
        </div>
        {updatedAt && <span style={{ fontSize: 10, color: 'var(--color-muted)', padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>Updated {updatedAt}</span>}
      </div>

      {/* Rate cards */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {[0,1,2,3,4,5].map(i => (
            <div key={i} style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 20, height: 140 }}>
              <div className="skeleton" style={{ width: 80, height: 14, borderRadius: 6, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: 140, height: 28, borderRadius: 8, marginBottom: 10 }} />
              <div className="skeleton" style={{ width: 60, height: 12, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : rates.length === 0 ? (
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <i className="fa-solid fa-money-bill-transfer" style={{ fontSize: 32, color: 'var(--color-muted)', opacity: .3, display: 'block', marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Forex data unavailable</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {rates.map(r => {
            const pos = (r.pctChange ?? 0) > 0, neg = (r.pctChange ?? 0) < 0;
            const color = PAIR_COLORS[r.pair] ?? '#40c4ff';
            return (
              <div key={r.pair} style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden', transition: 'border-color 200ms' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: color, opacity: .05, filter: 'blur(24px)', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '18' }}>
                      <i className="fa-solid fa-arrow-right-arrow-left" style={{ fontSize: 12, color }} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{r.pair}</p>
                      <p style={{ margin: 0, fontSize: 9.5, color: 'var(--color-muted)' }}>{r.base} → {r.quote}</p>
                    </div>
                  </div>
                  {r.pctChange != null && (
                    <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 99, color: pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)', background: pos ? 'rgba(0,230,118,.1)' : neg ? 'rgba(255,82,82,.1)' : 'rgba(255,255,255,.05)', border: `1px solid ${pos ? 'rgba(0,230,118,.2)' : neg ? 'rgba(255,82,82,.2)' : 'rgba(255,255,255,.08)'}` }}>
                      {pos ? '+' : ''}{r.pctChange.toFixed(3)}%
                    </span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-text)', lineHeight: 1, letterSpacing: '-.01em' }}>
                  {fmt2(r.rate)}
                </p>
                {r.change != null && (
                  <p style={{ margin: '4px 0 0', fontSize: 10, fontFamily: 'var(--font-mono)', color: pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)' }}>
                    {pos ? '+' : ''}{fmt2(r.change)} today
                  </p>
                )}

                {(r.bid != null || r.ask != null) && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-muted)' }}>Bid</p>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ff5252' }}>{fmt2(r.bid)}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-muted)' }}>Ask</p>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#00e676' }}>{fmt2(r.ask)}</p>
                    </div>
                    {r.high24h != null && (
                      <div>
                        <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-muted)' }}>24H Range</p>
                        <p style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>{fmt2(r.low24h)} – {fmt2(r.high24h)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Converter */}
      <ForexConverter rates={rates} />
    </div>
  );
}

function ForexConverter({ rates }: { rates: ForexRate[] }) {
  const [amount, setAmount] = useState('1000');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('JMD');

  const rate = rates.find(r => r.base === from && r.quote === to)?.rate
    ?? (rates.find(r => r.base === to && r.quote === from) ? 1 / (rates.find(r => r.base === to && r.quote === from)!.rate) : null);

  const result = rate && parseFloat(amount) ? (parseFloat(amount) * rate).toFixed(2) : null;

  const currencies = Array.from(new Set(rates.flatMap(r => [r.base, r.quote])));

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,.1)' }}>
          <i className="fa-solid fa-calculator" style={{ fontSize: 12, color: 'var(--color-green)' }} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>Currency Converter</h3>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>Live exchange rates</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0"
          style={{ width: 140, height: 42, padding: '0 14px', borderRadius: 10, fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,230,118,.4)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
        />
        <select value={from} onChange={e => setFrom(e.target.value)}
          style={{ height: 42, padding: '0 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'var(--color-bg3)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}>
          {currencies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 16, color: 'var(--color-muted)' }}>→</span>
        <select value={to} onChange={e => setTo(e.target.value)}
          style={{ height: 42, padding: '0 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'var(--color-bg3)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}>
          {currencies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {result ? (
          <div style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(0,230,118,.08)', border: '1px solid rgba(0,230,118,.2)' }}>
            <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#00e676' }}>{parseFloat(result).toLocaleString('en-US', { minimumFractionDigits: 2 })} {to}</span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Rate unavailable</span>
        )}
      </div>
    </div>
  );
}

