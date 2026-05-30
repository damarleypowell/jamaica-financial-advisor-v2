import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMarketStore } from '../../stores/market';
import { apiPost } from '../../lib/api';
import type { Stock } from '../../types';

interface ComparedStock {
  symbol: string; name?: string; price?: number; pctChange?: number; dollarChange?: number | null;
  volume?: number; marketCap?: number; peRatio?: number; dividendYield?: number;
  fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number; sector?: string;
  beta?: number | null; eps?: number | null;
}

interface CompareResult {
  symbols: string[];
  stocks: ComparedStock[];
}

// Raw shape returned by POST /api/compare (different key names than the UI uses).
interface CompareApiItem {
  symbol: string; name?: string; price?: number; change?: number; volume?: number;
  marketCap?: number; pe?: number; divYield?: number; high52?: number; low52?: number; sector?: string;
}
interface CompareApiResponse { comparison?: CompareApiItem[]; partial?: boolean }

const fmt2 = (n?: number) => n != null ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const fmt = (val: number | string | null | undefined, decimals = 2) => val == null ? '—' : typeof val === 'number' ? val.toFixed(decimals) : val;
const fmtLarge = (n?: number) => {
  if (n == null) return '—';
  if (n >= 1e9) return (n/1e9).toFixed(2)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(0)+'K';
  return n.toLocaleString();
};
const fmtMarketCap = (v?: number) => v == null ? '—' : v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(1)}M`;

const METRICS = [
  { label: 'Price', key: 'price', fmt: (v?: number) => v == null ? '—' : `$${fmt2(v)}` },
  { label: '% Change', key: 'pctChange', fmt: (v?: number) => v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v, 2)}%`, color: (v?: number) => v == null ? undefined : v > 0 ? '#00e676' : v < 0 ? '#ff5252' : undefined },
  { label: 'Volume', key: 'volume', fmt: (v?: number) => fmtLarge(v) },
  { label: 'Market Cap', key: 'marketCap', fmt: (v?: number) => fmtMarketCap(v) },
  { label: 'P/E Ratio', key: 'peRatio', fmt: (v?: number) => fmt(v, 2) },
  { label: 'Dividend Yield', key: 'dividendYield', fmt: (v?: number) => v == null ? '—' : `${fmt(v, 2)}%`, color: (v?: number) => v != null && v > 3 ? '#00e676' : undefined },
  { label: '52W High', key: 'fiftyTwoWeekHigh', fmt: (v?: number) => v == null ? '—' : `$${fmt2(v)}` },
  { label: '52W Low', key: 'fiftyTwoWeekLow', fmt: (v?: number) => v == null ? '—' : `$${fmt2(v)}` },
  { label: 'Beta', key: 'beta', fmt: (v?: number) => fmt(v, 2) },
  { label: 'EPS', key: 'eps', fmt: (v?: number) => v == null ? '—' : `$${fmt2(v)}` },
  { label: 'Sector', key: 'sector', fmt: (v?: string) => v ?? '—' },
];

export default function Compare() {
  const stocks = useMarketStore(s => s.stocks);
  const [symbols, setSymbols] = useState<string[]>(['', '']);
  const [inputs, setInputs] = useState<string[]>(['', '']);

  const validSymbols = symbols.filter(s => s && stocks.some(st => st.symbol === s));

  const { data, isLoading } = useQuery<CompareResult>({
    queryKey: ['compare', validSymbols.sort().join(',')],
    queryFn: async () => {
      const res = await apiPost<CompareApiResponse>('/api/compare', { symbols: validSymbols });
      // Backend returns { comparison: [...], partial } — map to expected shape
      const stocks: ComparedStock[] = (res?.comparison ?? []).map((s) => ({
        symbol: s.symbol,
        name: s.name,
        price: s.price,
        pctChange: s.change,
        dollarChange: null,
        volume: s.volume,
        marketCap: s.marketCap,
        peRatio: s.pe,
        dividendYield: s.divYield,
        fiftyTwoWeekHigh: s.high52,
        fiftyTwoWeekLow: s.low52,
        sector: s.sector,
        beta: null,
        eps: null,
      }));
      return { symbols: validSymbols, stocks };
    },
    enabled: validSymbols.length >= 2,
    staleTime: 60_000,
    retry: 1,
  });

  const displayStocks = useMemo<(ComparedStock | Stock)[]>(() => {
    if (data?.stocks?.length) return data.stocks;
    return validSymbols.map(sym => stocks.find(s => s.symbol === sym)).filter(Boolean) as Stock[];
  }, [data, validSymbols, stocks]);

  const addSlot = () => {
    if (symbols.length < 4) { setSymbols(s => [...s, '']); setInputs(i => [...i, '']); }
  };
  const removeSlot = (idx: number) => {
    setSymbols(s => s.filter((_, i) => i !== idx));
    setInputs(i => i.filter((_, j) => j !== idx));
  };

  const handleInput = (idx: number, val: string) => {
    const v = val.toUpperCase();
    setInputs(prev => { const n = [...prev]; n[idx] = v; return n; });
    const found = stocks.find(s => s.symbol === v);
    if (found || v === '') {
      setSymbols(prev => { const n = [...prev]; n[idx] = v; return n; });
    }
  };

  const suggestions = (idx: number) => {
    const q = inputs[idx].toLowerCase();
    if (!q || q.length < 1) return [];
    return stocks.filter(s => s.symbol.toLowerCase().startsWith(q) || (s.name ?? '').toLowerCase().includes(q)).slice(0, 6);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>Stock Comparison</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>Compare up to 4 JSE securities side by side</p>
      </div>

      {/* Symbol selectors */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {symbols.map((sym, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>
                Stock {idx + 1}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    value={inputs[idx]}
                    onChange={e => handleInput(idx, e.target.value)}
                    placeholder="SYMBOL"
                    style={{ width: 130, height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.05)', border: `1px solid ${sym && stocks.some(s => s.symbol === sym) ? 'rgba(0,230,118,.4)' : 'var(--color-border)'}`, color: 'var(--color-text)', outline: 'none', letterSpacing: '.05em' }}
                    onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(0,230,118,.4)'}
                    onBlur={() => { setTimeout(() => {}, 200); }}
                  />
                  {/* Suggestions dropdown */}
                  {inputs[idx] && suggestions(idx).length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--color-bg3)', border: '1px solid var(--color-border)', borderRadius: 10, zIndex: 50, minWidth: 200, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
                      {suggestions(idx).map(s => (
                        <button key={s.symbol} onMouseDown={() => handleInput(idx, s.symbol)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,230,118,.08)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-green)' }}>{s.symbol}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {symbols.length > 2 && (
                  <button onClick={() => removeSlot(idx)} style={{ width: 38, height: 38, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,82,82,.1)', border: '1px solid rgba(255,82,82,.2)', cursor: 'pointer' }}>
                    <i className="fa-solid fa-xmark" style={{ fontSize: 11, color: '#ff5252' }} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {symbols.length < 4 && (
            <button onClick={addSlot}
              style={{ height: 38, padding: '0 16px', borderRadius: 9, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
              <i className="fa-solid fa-plus" style={{ fontSize: 9 }} /> Add Stock
            </button>
          )}
        </div>
      </div>

      {/* Comparison table */}
      {validSymbols.length >= 2 && (
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Fetching comparison data...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)', minWidth: 130 }}>Metric</th>
                    {displayStocks.map((s) => {
                      const pos = (s?.pctChange ?? 0) > 0, neg = (s?.pctChange ?? 0) < 0;
                      return (
                        <th key={s.symbol} style={{ padding: '14px 20px', textAlign: 'center', minWidth: 160 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: pos ? 'rgba(0,230,118,.1)' : neg ? 'rgba(255,82,82,.1)' : 'rgba(255,255,255,.05)' }}>
                              <span style={{ fontSize: 9, fontWeight: 900, color: pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)' }}>{s.symbol?.slice(0,3)}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>{s.symbol}</span>
                            {s.name && <span style={{ fontSize: 10, color: 'var(--color-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((metric, mi) => (
                    <tr key={metric.key} style={{ borderBottom: '1px solid rgba(255,255,255,.025)', background: mi % 2 === 0 ? 'rgba(255,255,255,.01)' : 'transparent' }}>
                      <td style={{ padding: '11px 20px', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{metric.label}</td>
                      {displayStocks.map((s) => {
                        const val = (s as unknown as Record<string, unknown>)[metric.key];
                        const formatted = (metric.fmt as (v: unknown) => string)(val);
                        const color = 'color' in metric && metric.color ? (metric.color as (v: unknown) => string | undefined)(val) : undefined;
                        return (
                          <td key={s.symbol} style={{ padding: '11px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: color || 'var(--color-text)' }}>
                            {formatted}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {validSymbols.length < 2 && (
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <i className="fa-solid fa-code-compare" style={{ fontSize: 32, color: 'var(--color-muted)', opacity: .3, display: 'block', marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text2)', fontWeight: 600 }}>Enter at least 2 stock symbols above</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>Type a JSE symbol and select from the dropdown</p>
        </div>
      )}
    </div>
  );
}
