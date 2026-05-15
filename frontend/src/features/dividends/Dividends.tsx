import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { apiGet } from '../../lib/api';

interface DividendEvent {
  symbol: string;
  companyName?: string;
  exDividendDate?: string;
  paymentDate?: string;
  recordDate?: string;
  dividendAmount?: number;
  yield?: number;
  frequency?: string;
  currency?: string;
}

type SortField = 'symbol' | 'dividendAmount' | 'yield' | 'exDividendDate';

const fmt2 = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function isUpcoming(d?: string) {
  if (!d) return false;
  return new Date(d) >= new Date();
}

export default function Dividends() {
  const [sortField, setSortField] = useState<SortField>('yield');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<'all' | 'upcoming'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<DividendEvent[]>({
    queryKey: ['dividends'],
    queryFn: () => apiGet<DividendEvent[]>('/api/dividends'),
    staleTime: 300_000,
    retry: 1,
  });

  const rows = useMemo(() => {
    let r = data ?? [];
    if (filter === 'upcoming') r = r.filter(d => isUpcoming(d.exDividendDate));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(d => d.symbol.toLowerCase().includes(q) || (d.companyName ?? '').toLowerCase().includes(q));
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...r].sort((a, b) => {
      if (sortField === 'symbol') return (a.symbol ?? '').localeCompare(b.symbol ?? '') * dir;
      if (sortField === 'exDividendDate') {
        const ad = a.exDividendDate ? new Date(a.exDividendDate).getTime() : 0;
        const bd = b.exDividendDate ? new Date(b.exDividendDate).getTime() : 0;
        return (ad - bd) * dir;
      }
      return ((a[sortField] ?? 0) - (b[sortField] ?? 0)) * dir;
    });
  }, [data, filter, search, sortField, sortDir]);

  const totalYield = rows.length ? rows.reduce((a, r) => a + (r.yield ?? 0), 0) / rows.length : 0;
  const upcomingCount = (data ?? []).filter(d => isUpcoming(d.exDividendDate)).length;

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const SortIcon = ({ f }: { f: SortField }) => (
    <i className={`fa-solid ${sortField === f ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'} text-[7px] ml-1`} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>Dividends</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>Dividend history and upcoming events for JSE listed companies</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { icon: 'fa-list', color: '#40c4ff', bg: 'rgba(64,196,255,.1)', grad: 'linear-gradient(90deg,#40c4ff,transparent)', label: 'Total Records', value: (data ?? []).length.toString() },
          { icon: 'fa-calendar-check', color: '#00e676', bg: 'rgba(0,230,118,.1)', grad: 'linear-gradient(90deg,#00e676,transparent)', label: 'Upcoming Ex-Dates', value: upcomingCount.toString() },
          { icon: 'fa-percent', color: '#ffd740', bg: 'rgba(255,215,64,.1)', grad: 'linear-gradient(90deg,#ffd740,transparent)', label: 'Avg Yield (shown)', value: totalYield > 0 ? totalYield.toFixed(2) + '%' : '—' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: card.grad }} />
            <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: card.bg, marginBottom: 10 }}>
              <i className={`fa-solid ${card.icon}`} style={{ fontSize: 13, color: card.color }} />
            </div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-text)', lineHeight: 1 }}>{card.value}</p>
            <p style={{ margin: '4px 0 0', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
        {/* Controls */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'upcoming'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 150ms',
                  background: filter === f ? 'var(--color-green)' : 'transparent',
                  color: filter === f ? 'var(--color-bg)' : 'var(--color-muted)',
                  borderColor: filter === f ? 'var(--color-green)' : 'var(--color-border)',
                }}>
                {f === 'all' ? 'All Dividends' : 'Upcoming Only'}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--color-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol..."
              style={{ width: 200, height: 32, paddingLeft: 30, paddingRight: 10, borderRadius: 9, fontSize: 11, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
              onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,230,118,.4)'}
              onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading dividend data...
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
              <i className="fa-solid fa-money-bill-wave" style={{ fontSize: 28, opacity: .2, display: 'block', marginBottom: 10 }} />
              No dividend records found
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  {([['symbol', 'Symbol', false], ['companyName', 'Company', false], ['exDividendDate', 'Ex-Date', true], ['paymentDate', 'Pay Date', true], ['dividendAmount', 'Amount', true], ['yield', 'Yield', true]] as [SortField | string, string, boolean][]).map(([key, label, right]) => (
                    <th key={key} onClick={() => handleSort(key as SortField)}
                      style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', textAlign: right ? 'right' : 'left', cursor: 'pointer', color: sortField === key ? 'var(--color-green)' : 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {label}<SortIcon f={key as SortField} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((d, i) => {
                  const upcoming = isUpcoming(d.exDividendDate);
                  return (
                    <tr key={`${d.symbol}-${i}`}
                      style={{ borderBottom: '1px solid rgba(255,255,255,.025)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                    >
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,.1)' }}>
                            <span style={{ fontSize: 8, fontWeight: 900, color: 'var(--color-green)' }}>{d.symbol.slice(0,3)}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{d.symbol}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-text2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.companyName || '—'}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <span style={{
                          fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: upcoming ? 700 : 400,
                          color: upcoming ? '#ffd740' : 'var(--color-text2)',
                          background: upcoming ? 'rgba(255,215,64,.1)' : 'transparent',
                          padding: upcoming ? '2px 7px' : '0', borderRadius: upcoming ? 6 : 0,
                        }}>{fmtDate(d.exDividendDate)}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)', textAlign: 'right' }}>{fmtDate(d.paymentDate)}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#00e676', textAlign: 'right' }}>
                        {d.dividendAmount ? `$${fmt2(d.dividendAmount)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        {d.yield ? (
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: d.yield >= 5 ? '#00e676' : 'var(--color-text)' }}>
                            {d.yield.toFixed(2)}%
                          </span>
                        ) : <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
