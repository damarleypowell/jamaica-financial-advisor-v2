import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

interface GlobalIndex {
  name: string; symbol?: string; region: string;
  value?: number; change?: number; pctChange?: number;
  open?: number; high?: number; low?: number;
  currency?: string; exchange?: string;
}

const REGION_COLORS: Record<string, string> = {
  'Americas': '#00e676', 'Europe': '#40c4ff', 'Asia': '#ffd740',
  'Caribbean': '#ce93d8', 'Pacific': '#ff8a65', 'Africa': '#80deea',
};

const REGION_ICONS: Record<string, string> = {
  'Americas': 'fa-earth-americas', 'Europe': 'fa-earth-europe',
  'Asia': 'fa-earth-asia', 'Caribbean': 'fa-umbrella-beach',
  'Pacific': 'fa-earth-oceania', 'Africa': 'fa-earth-africa',
};

function fmtNum(n?: number, dp = 2) {
  return n != null ? n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—';
}

export default function GlobalMarkets() {
  const { data, isLoading, dataUpdatedAt } = useQuery<GlobalIndex[]>({
    queryKey: ['global-markets'],
    queryFn: () => apiGet<GlobalIndex[]>('/api/global-markets'),
    staleTime: 120_000,
    refetchInterval: 300_000,
    retry: 1,
  });

  const indices = data ?? [];
  const grouped = indices.reduce<Record<string, GlobalIndex[]>>((acc, idx) => {
    const r = idx.region || 'Other';
    if (!acc[r]) acc[r] = [];
    acc[r].push(idx);
    return acc;
  }, {});

  const gainers = indices.filter(i => (i.pctChange ?? 0) > 0).length;
  const losers = indices.filter(i => (i.pctChange ?? 0) < 0).length;
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>Global Markets</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>Major world indices and market performance</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isLoading && indices.length > 0 && (
            <>
              <span className="badge badge-green"><i className="fa-solid fa-arrow-up" style={{ fontSize: 7 }} />{gainers}</span>
              <span className="badge badge-red"><i className="fa-solid fa-arrow-down" style={{ fontSize: 7 }} />{losers}</span>
            </>
          )}
          {updatedAt && <span style={{ fontSize: 10, color: 'var(--color-muted)', padding: '5px 10px', borderRadius: 8, background: 'rgba(var(--fg),.04)', border: '1px solid var(--color-border)' }}>Updated {updatedAt}</span>}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {[0,1,2,3,4,5,6,7].map(i => (
            <div key={i} style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '18px 20px', height: 100 }}>
              <div className="skeleton" style={{ width: 100, height: 13, borderRadius: 6, marginBottom: 10 }} />
              <div className="skeleton" style={{ width: 140, height: 24, borderRadius: 7, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 70, height: 11, borderRadius: 5 }} />
            </div>
          ))}
        </div>
      ) : indices.length === 0 ? (
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <i className="fa-solid fa-globe" style={{ fontSize: 32, color: 'var(--color-muted)', opacity: .3, display: 'block', marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Global market data unavailable</p>
        </div>
      ) : (
        Object.entries(grouped).map(([region, regionIndices]) => {
          const color = REGION_COLORS[region] ?? '#40c4ff';
          const icon = REGION_ICONS[region] ?? 'fa-globe';
          return (
            <div key={region}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '18' }}>
                  <i className={`fa-solid ${icon}`} style={{ fontSize: 12, color }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>{region}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                {regionIndices.map(idx => {
                  const pos = (idx.pctChange ?? 0) > 0, neg = (idx.pctChange ?? 0) < 0;
                  return (
                    <div key={idx.name}
                      style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden', transition: 'border-color 200ms' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border2)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'}
                    >
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${pos ? '#00e676' : neg ? '#ff5252' : 'rgba(var(--fg),.1)'},transparent)` }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idx.name}</p>
                          {idx.exchange && <p style={{ margin: '2px 0 0', fontSize: 9.5, color: 'var(--color-muted)' }}>{idx.exchange}{idx.currency ? ` · ${idx.currency}` : ''}</p>}
                        </div>
                        {idx.pctChange != null && (
                          <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 99, marginLeft: 8, flexShrink: 0, color: pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)', background: pos ? 'rgba(0,230,118,.1)' : neg ? 'rgba(255,82,82,.1)' : 'rgba(var(--fg),.06)', border: `1px solid ${pos ? 'rgba(0,230,118,.2)' : neg ? 'rgba(255,82,82,.2)' : 'rgba(var(--fg),.08)'}` }}>
                            {pos ? '+' : ''}{idx.pctChange.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-text)', lineHeight: 1 }}>
                        {fmtNum(idx.value, 0)}
                      </p>
                      {idx.change != null && (
                        <p style={{ margin: '3px 0 0', fontSize: 10, fontFamily: 'var(--font-mono)', color: pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)' }}>
                          {pos ? '+' : ''}{fmtNum(idx.change)} pts
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
