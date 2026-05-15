import { useState, useMemo } from 'react';
import { useMarketStore } from '../../stores/market';
import { useUIStore } from '../../stores/ui';
import type { Stock } from '../../types';

type SortKey = keyof Stock;

const fmt2  = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtVol = (n?: number) => { const v = n ?? 0; return v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v.toLocaleString(); };
const chg   = (v?: number) => (v ?? 0) > 0 ? 'var(--color-green)' : (v ?? 0) < 0 ? 'var(--color-red)' : 'var(--color-muted)';

export default function Screener() {
  const stocks = useMarketStore(s => s.stocks);
  const selectSymbol = useMarketStore(s => s.selectSymbol);
  const openStockDetail = useUIStore(s => s.openStockDetail);

  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minChg, setMinChg] = useState('');
  const [maxChg, setMaxChg] = useState('');
  const [minVol, setMinVol] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('pctChange');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach(s => { if (s.sector) set.add(s.sector); });
    return Array.from(set).sort();
  }, [stocks]);

  const results = useMemo(() => {
    let r = [...stocks];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    if (sector) r = r.filter(s => s.sector === sector);
    if (minPrice) r = r.filter(s => (s.price ?? 0) >= parseFloat(minPrice));
    if (maxPrice) r = r.filter(s => (s.price ?? 0) <= parseFloat(maxPrice));
    if (minChg)   r = r.filter(s => (s.pctChange ?? 0) >= parseFloat(minChg));
    if (maxChg)   r = r.filter(s => (s.pctChange ?? 0) <= parseFloat(maxChg));
    if (minVol)   r = r.filter(s => (s.volume ?? 0) >= parseFloat(minVol) * 1000);

    const dir = sortDir === 'asc' ? 1 : -1;
    r.sort((a, b) => {
      const av = (a as any)[sortKey] ?? '';
      const bv = (b as any)[sortKey] ?? '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return r;
  }, [stocks, search, minPrice, maxPrice, minChg, maxChg, minVol, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <i className={`fa-solid ${sortKey === k ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}
      style={{ fontSize: 8, marginLeft: 4 }} />
  );

  const filterInput = (label: string, val: string, set: (v: string) => void, placeholder: string) => (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</label>
      <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
        type="number"
        style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
        onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.4)')}
        onBlur={e => (e.target.style.borderColor = 'var(--color-border)')} />
    </div>
  );

  const COLS: { label: string; key: SortKey; right?: boolean }[] = [
    { label: 'Symbol',   key: 'symbol' },
    { label: 'Company',  key: 'name' },
    { label: 'Price',    key: 'price',      right: true },
    { label: '$ Chg',    key: 'dollarChange', right: true },
    { label: '% Chg',    key: 'pctChange',  right: true },
    { label: 'Volume',   key: 'volume',     right: true },
    { label: 'Mkt Cap',  key: 'marketCap',  right: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,.1)' }}>
            <i className="fa-solid fa-filter" style={{ fontSize: 11, color: 'var(--color-green)' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Filters</span>
          <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 'auto' }}>{results.length} of {stocks.length} securities</span>
          {(search || sector || minPrice || maxPrice || minChg || maxChg || minVol) && (
            <button onClick={() => { setSearch(''); setSector(''); setMinPrice(''); setMaxPrice(''); setMinChg(''); setMaxChg(''); setMinVol(''); }}
              style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,82,82,.1)', border: '1px solid rgba(255,82,82,.2)', color: 'var(--color-red)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.1em' }}>Search</label>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--color-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Symbol or name..."
                style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.4)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-border)')} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.1em' }}>Sector</label>
            <select value={sector} onChange={e => setSector(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: sector ? 'var(--color-text)' : 'var(--color-muted)', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="">All Sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {filterInput('Min Price ($)', minPrice, setMinPrice, '0.00')}
          {filterInput('Max Price ($)', maxPrice, setMaxPrice, '9999')}
          {filterInput('Min Change (%)', minChg, setMinChg, '-100')}
          {filterInput('Max Change (%)', maxChg, setMaxChg, '100')}
          {filterInput('Min Volume (K)', minVol, setMinVol, '0')}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                {COLS.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)} style={{ padding: '11px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', cursor: 'pointer', userSelect: 'none', textAlign: col.right ? 'right' : 'left', color: sortKey === col.key ? 'var(--color-green)' : 'var(--color-muted)', transition: 'color .15s' }}>
                    {col.label}<SortIcon k={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td colSpan={7}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 20px', gap: 10 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-filter-circle-xmark" style={{ fontSize: 20, color: 'var(--color-muted)', opacity: .35 }} />
                    </div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text2)' }}>No stocks match your filters</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Try adjusting or clearing your filters to see results</p>
                  </div>
                </td></tr>
              ) : results.map((s) => {
                const pos = (s.pctChange ?? 0) > 0, neg = (s.pctChange ?? 0) < 0;
                return (
                  <tr key={s.symbol} onClick={() => { selectSymbol(s.symbol); openStockDetail(s.symbol); }}
                    style={{ borderBottom: '1px solid rgba(255,255,255,.025)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: pos ? 'rgba(0,230,118,.1)' : neg ? 'rgba(255,82,82,.08)' : 'rgba(255,255,255,.04)', flexShrink: 0 }}>
                          <span style={{ fontSize: 8, fontWeight: 800, color: pos ? 'var(--color-green)' : neg ? 'var(--color-red)' : 'var(--color-muted)' }}>{s.symbol.slice(0,3)}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{s.symbol}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-text2)', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '—'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>${fmt2(s.price)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: chg(s.dollarChange), fontFamily: 'var(--font-mono)' }}>
                      {(s.dollarChange ?? 0) !== 0 ? `${(s.dollarChange ?? 0) > 0 ? '+' : ''}$${fmt2(Math.abs(s.dollarChange ?? 0))}` : '$0.00'}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: chg(s.pctChange), fontFamily: 'var(--font-mono)' }}>
                      {pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{fmtVol(s.volume)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{s.marketCap ? fmtVol(s.marketCap) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
