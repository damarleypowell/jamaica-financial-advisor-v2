import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useMarketStore } from '../../stores/market';
import { useUIStore } from '../../stores/ui';
import { apiGet } from '../../lib/api';

interface SectorData {
  name: string;
  stocks: string[];
  avgChange: number;
  totalVolume: number;
  marketCap?: number;
  advancers: number;
  decliners: number;
}

// Raw shape from GET /api/sectors (the backend may omit fields we derive locally).
interface RawSector { name?: string; stocks?: string[]; avgChange?: number }

const SECTOR_ICONS: Record<string, string> = {
  'Financial': 'fa-building-columns',
  'Manufacturing': 'fa-industry',
  'Distribution': 'fa-truck',
  'Tourism': 'fa-umbrella-beach',
  'Agriculture': 'fa-wheat-awn',
  'Energy': 'fa-bolt',
  'Technology': 'fa-microchip',
  'Real Estate': 'fa-building',
  'Healthcare': 'fa-hospital',
  'Conglomerate': 'fa-briefcase',
};

const SECTOR_COLORS: Record<string, string> = {
  'Financial': '#40c4ff',
  'Manufacturing': '#ffd740',
  'Distribution': '#ce93d8',
  'Tourism': '#ff8a65',
  'Agriculture': '#a5d6a7',
  'Energy': '#fff176',
  'Technology': '#80deea',
  'Real Estate': '#bcaaa4',
  'Healthcare': '#f48fb1',
  'Conglomerate': '#b0bec5',
};

function fmtVol(n: number) {
  if (n >= 1e9) return (n/1e9).toFixed(2)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(0)+'K';
  return n.toLocaleString();
}

export default function Sectors() {
  const [selected, setSelected] = useState<string | null>(null);
  const stocks = useMarketStore(s => s.stocks);
  const selectSymbol = useMarketStore(s => s.selectSymbol);
  const openStockDetail = useUIStore(s => s.openStockDetail);

  const { data: rawSectors, isLoading } = useQuery<RawSector[]>({
    queryKey: ['sectors'],
    queryFn: () => apiGet<RawSector[]>('/api/sectors'),
    staleTime: 60_000,
    retry: 1,
  });

  const sectors: SectorData[] = (rawSectors ?? []).map((sec) => {
    const secStocks = stocks.filter(s => sec.stocks?.includes(s.symbol) || s.sector === sec.name);
    const advancers = secStocks.filter(s => (s.pctChange ?? 0) > 0).length;
    const decliners = secStocks.filter(s => (s.pctChange ?? 0) < 0).length;
    const totalVolume = secStocks.reduce((a, s) => a + (s.volume ?? 0), 0);
    const avgChange = secStocks.length
      ? secStocks.reduce((a, s) => a + (s.pctChange ?? 0), 0) / secStocks.length
      : (sec.avgChange ?? 0);
    return {
      name: sec.name ?? '',
      stocks: sec.stocks ?? secStocks.map(s => s.symbol),
      avgChange,
      totalVolume,
      advancers,
      decliners,
    };
  }).sort((a, b) => Math.abs(b.avgChange) - Math.abs(a.avgChange));

  const activeSector = sectors.find(s => s.name === selected);
  const sectorStocks = activeSector
    ? stocks.filter(s => activeSector.stocks.includes(s.symbol))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>Sector Performance</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>JSE sector breakdown — click any sector to drill down</p>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {[0,1,2,3,4,5].map(i => (
            <div key={i} style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '18px 20px', height: 130 }}>
              <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 10, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '40%', height: 12, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : sectors.length === 0 ? (
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <i className="fa-solid fa-building" style={{ fontSize: 32, color: 'var(--color-muted)', opacity: .3 }} />
          <p style={{ margin: '12px 0 0', color: 'var(--color-muted)', fontSize: 13 }}>No sector data available</p>
        </div>
      ) : (
        <>
          {/* Sector cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {sectors.map(sec => {
              const pos = sec.avgChange > 0, neg = sec.avgChange < 0;
              const color = SECTOR_COLORS[sec.name] ?? '#40c4ff';
              const icon = SECTOR_ICONS[sec.name] ?? 'fa-chart-pie';
              const isActive = selected === sec.name;
              return (
                <button key={sec.name} onClick={() => setSelected(isActive ? null : sec.name)}
                  style={{
                    background: isActive ? 'rgba(0,230,118,.06)' : 'var(--color-bg2)',
                    border: `1px solid ${isActive ? 'rgba(0,230,118,.3)' : 'var(--color-border)'}`,
                    borderRadius: 14, padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
                    transition: 'all 200ms', position: 'relative', overflow: 'hidden',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border2)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '18' }}>
                      <i className={`fa-solid ${icon}`} style={{ fontSize: 14, color }} />
                    </div>
                    <span style={{
                      padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)',
                      color: pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)',
                      background: pos ? 'rgba(0,230,118,.1)' : neg ? 'rgba(255,82,82,.1)' : 'rgba(var(--fg),.06)',
                      border: `1px solid ${pos ? 'rgba(0,230,118,.2)' : neg ? 'rgba(255,82,82,.2)' : 'rgba(var(--fg),.08)'}`,
                    }}>
                      {pos ? '+' : ''}{sec.avgChange.toFixed(2)}%
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{sec.name}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--color-muted)' }}>{sec.stocks.length} stocks · Vol {fmtVol(sec.totalVolume)}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#00e676' }}>{sec.advancers} ▲</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#ff5252' }}>{sec.decliners} ▼</span>
                    <span style={{ fontSize: 9, color: 'var(--color-muted)' }}>{sec.stocks.length - sec.advancers - sec.decliners} flat</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Drill-down */}
          {activeSector && (
            <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>{activeSector.name} Sector</h3>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--color-muted)' }}>{sectorStocks.length} securities</p>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'rgba(var(--fg),.05)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: 'var(--color-text2)', cursor: 'pointer' }}>
                  <i className="fa-solid fa-xmark" style={{ marginRight: 5 }} />Close
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(var(--fg),.04)' }}>
                      {['Symbol', 'Company', 'Price', '$Chg', '%Chg', 'Volume'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sectorStocks.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)' }}>No live data yet</td></tr>
                    ) : sectorStocks.map(s => {
                      const pos = (s.pctChange ?? 0) > 0, neg = (s.pctChange ?? 0) < 0;
                      const cc = pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)';
                      return (
                        <tr key={s.symbol}
                          onClick={() => { selectSymbol(s.symbol); openStockDetail(s.symbol); }}
                          style={{ borderBottom: '1px solid rgba(var(--fg),.025)', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),.025)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                        >
                          <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{s.symbol}</td>
                          <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-text2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '—'}</td>
                          <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>${(s.price ?? 0).toFixed(2)}</td>
                          <td style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: cc, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                            {(s.dollarChange ?? 0) !== 0 ? `${(s.dollarChange ?? 0) > 0 ? '+' : ''}$${Math.abs(s.dollarChange ?? 0).toFixed(2)}` : '$0.00'}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: cc, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                            {pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                            {fmtVol(s.volume ?? 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
