import { useState } from 'react';
import type React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useMarketStore } from '../../stores/market';
import { useUIStore } from '../../stores/ui';
import type { Watchlist } from '../../types';

const BG       = 'var(--color-bg)';
const BG2      = 'var(--color-bg2)';
const BG3      = 'var(--color-bg3)';
const BORDER   = 'rgba(var(--fg),0.055)';
const TEXT     = '#dde5f0';
const TEXT2    = '#7a95b0';
const MUTED    = '#3d5470';
const GREEN    = '#00e676';
const RED      = '#ff5252';
const FONT_MONO = 'JetBrains Mono, monospace';

const fmt2 = (n?: number) =>
  (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const chgColor = (v?: number) =>
  (v ?? 0) > 0 ? GREEN : (v ?? 0) < 0 ? RED : MUTED;

interface WLWithStocks extends Watchlist {
  stocks?: { symbol: string; name: string; price: number; change: number }[];
}

export default function Watchlists() {
  const { isAuthenticated } = useAuthStore();
  const stocks = useMarketStore(s => s.stocks);
  const selectSymbol = useMarketStore(s => s.selectSymbol);
  const openStockDetail = useUIStore(s => s.openStockDetail);
  const qc = useQueryClient();

  const [active, setActive]       = useState<string | null>(null);
  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState('');
  const [, setAddSymbol] = useState('');
  const [addSearch, setAddSearch] = useState('');

  const { data: watchlists = [], isLoading } = useQuery<WLWithStocks[]>({
    queryKey: ['watchlists'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic API response shape
      const res: any = await apiGet('/api/watchlists');
      return Array.isArray(res) ? res : (res?.watchlists ?? []);
    },
    enabled: isAuthenticated,
    retry: 1,
  });

  const createMut = useMutation({
    mutationFn: (name: string) => apiPost('/api/watchlists', { name, symbols: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['watchlists'] }); setCreating(false); setNewName(''); },
  });

  const addMut = useMutation({
    mutationFn: ({ id, symbol }: { id: string; symbol: string }) =>
      apiPost(`/api/watchlists/${id}/symbols`, { symbol }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['watchlists'] }); setAddSymbol(''); setAddSearch(''); },
  });

  const removeMut = useMutation({
    mutationFn: ({ id, symbol }: { id: string; symbol: string }) =>
      apiDelete(`/api/watchlists/${id}/symbols/${symbol}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlists'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/watchlists/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['watchlists'] });
      if (active === id) setActive(null);
    },
  });

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 20,
        background: BG2, borderRadius: 20, border: `1px solid ${BORDER}`,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,230,118,0.08)', border: `1px solid rgba(0,230,118,0.15)`,
        }}>
          <i className="fa-solid fa-eye" style={{ fontSize: 28, color: GREEN, opacity: 0.6 }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT }}>Sign in to use Watchlists</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: MUTED }}>Track your favourite JSE stocks in one place</p>
        </div>
      </div>
    );
  }

  const current = watchlists.find(w => w.id === active);
  const searchResults = addSearch
    ? stocks.filter(s =>
        s.symbol.toLowerCase().includes(addSearch.toLowerCase()) ||
        s.name.toLowerCase().includes(addSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  const enriched = current
    ? (current.symbols || []).map(sym => {
        const live = stocks.find(s => s.symbol === sym);
        return { symbol: sym, name: live?.name ?? '', price: live?.price ?? 0, change: live?.pctChange ?? 0 };
      })
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,230,118,0.1)', border: `1px solid rgba(0,230,118,0.2)`,
        }}>
          <i className="fa-solid fa-eye" style={{ fontSize: 20, color: GREEN }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: TEXT, letterSpacing: '-0.5px' }}>Watchlists</h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: MUTED }}>
            Monitor your selected JSE securities in real time
          </p>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Sidebar ── */}
        <div style={{
          background: BG2, border: `1px solid ${BORDER}`,
          borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}>
          {/* Sidebar header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 18px', borderBottom: `1px solid ${BORDER}`,
            background: `linear-gradient(135deg, rgba(0,230,118,0.04), transparent)`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              My Lists
            </span>
            <button
              onClick={() => setCreating(true)}
              title="New watchlist"
              style={{
                width: 30, height: 30, borderRadius: 9, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,230,118,0.12)', border: `1px solid rgba(0,230,118,0.25)`,
                cursor: 'pointer', transition: 'all 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,230,118,0.22)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,230,118,0.12)'; }}
            >
              <i className="fa-solid fa-plus" style={{ fontSize: 11, color: GREEN }} />
            </button>
          </div>

          {/* New list input */}
          {creating && (
            <div style={{
              padding: '12px 14px', borderBottom: `1px solid ${BORDER}`,
              display: 'flex', gap: 8, background: 'rgba(0,230,118,0.03)',
            }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newName.trim()) createMut.mutate(newName.trim());
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
                placeholder="List name..."
                style={{
                  flex: 1, padding: '7px 12px',
                  background: 'rgba(var(--fg),0.04)', border: `1px solid rgba(0,230,118,0.3)`,
                  borderRadius: 9, fontSize: 12, color: TEXT, outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <button
                onClick={() => { if (newName.trim()) createMut.mutate(newName.trim()); }}
                style={{
                  padding: '7px 12px', background: GREEN, borderRadius: 9,
                  fontSize: 11, fontWeight: 800, color: BG, border: 'none',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Save
              </button>
            </div>
          )}

          {/* Watchlist items */}
          {isLoading ? (
            <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} />
              ))}
            </div>
          ) : watchlists.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <i className="fa-solid fa-star" style={{ fontSize: 22, color: MUTED, opacity: 0.3 }} />
              <p style={{ marginTop: 10, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                No watchlists yet.<br />Hit + to create one.
              </p>
            </div>
          ) : (
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {watchlists.map(w => {
                const isActive = active === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => setActive(w.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', padding: '11px 13px',
                      borderRadius: 12, border: `1px solid ${isActive ? 'rgba(0,230,118,0.25)' : 'transparent'}`,
                      cursor: 'pointer', textAlign: 'left', transition: 'all 150ms',
                      background: isActive ? 'rgba(0,230,118,0.08)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),0.04)'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isActive ? GREEN : MUTED,
                        boxShadow: isActive ? `0 0 6px ${GREEN}` : 'none',
                        transition: 'all 150ms',
                      }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{
                          margin: 0, fontSize: 13, fontWeight: 700,
                          color: isActive ? GREEN : TEXT,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {w.name}
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: MUTED }}>
                          {(w.symbols || []).length} stock{(w.symbols || []).length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteMut.mutate(w.id); }}
                      style={{
                        padding: '4px 6px', background: 'transparent', border: 'none',
                        cursor: 'pointer', opacity: 0, transition: 'opacity 150ms', flexShrink: 0,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
                      // Always show on the parent hover
                      className="delete-btn"
                    >
                      <i className="fa-solid fa-trash-can" style={{ fontSize: 10, color: RED }} />
                    </button>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {!current ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', background: BG2, border: `1px solid ${BORDER}`,
            borderRadius: 18, padding: '100px 40px', gap: 14,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(var(--fg),0.03)', border: `1px solid ${BORDER}`,
            }}>
              <i className="fa-solid fa-eye" style={{ fontSize: 26, color: MUTED, opacity: 0.5 }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: TEXT2, margin: 0 }}>Select a watchlist</p>
              <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0' }}>Or create a new list to start tracking stocks</p>
            </div>
          </div>
        ) : (
          <div style={{
            background: BG2, border: `1px solid ${BORDER}`,
            borderRadius: 18, overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}>
            {/* Detail header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 22px', borderBottom: `1px solid ${BORDER}`,
              background: `linear-gradient(135deg, rgba(0,230,118,0.04), transparent)`,
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: TEXT, letterSpacing: '-0.3px' }}>
                  {current.name}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED }}>
                  {enriched.length} securit{enriched.length !== 1 ? 'ies' : 'y'} tracked
                </p>
              </div>

              {/* Add stock search */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{
                    position: 'absolute', left: 11, top: '50%',
                    transform: 'translateY(-50%)', fontSize: 11, color: MUTED,
                    pointerEvents: 'none',
                  }} />
                  <input
                    value={addSearch}
                    onChange={e => setAddSearch(e.target.value)}
                    placeholder="Add stock..."
                    style={{
                      paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                      background: 'rgba(var(--fg),0.05)', border: `1px solid ${BORDER}`,
                      borderRadius: 11, fontSize: 12, color: TEXT, outline: 'none', width: 175,
                      fontFamily: 'Inter, sans-serif', transition: 'border-color 150ms',
                    }}
                    onFocus={e => { (e.target as HTMLElement).style.borderColor = 'rgba(0,230,118,0.4)'; }}
                    onBlur={e => { (e.target as HTMLElement).style.borderColor = BORDER; }}
                  />
                </div>

                {/* Dropdown results */}
                {searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    width: window.innerWidth < 768 ? Math.min(260, window.innerWidth - 16) : 260,
                    maxWidth: '100vw',
                    background: BG3, border: `1px solid rgba(var(--fg),0.1)`,
                    borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                    zIndex: 50, overflowY: 'auto', maxHeight: '40vh',
                  }}>
                    {searchResults.map(s => (
                      <button
                        key={s.symbol}
                        onClick={() => { addMut.mutate({ id: current.id, symbol: s.symbol }); setAddSearch(''); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                          padding: '11px 14px', background: 'transparent', border: 'none',
                          cursor: 'pointer', textAlign: 'left', transition: 'background 100ms',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),0.05)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 9, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,230,118,0.1)', flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 8, fontWeight: 900, color: GREEN, fontFamily: FONT_MONO }}>
                            {s.symbol.slice(0, 3)}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: TEXT, fontFamily: FONT_MONO }}>{s.symbol}</p>
                          <p style={{ margin: 0, fontSize: 10, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.name}
                          </p>
                        </div>
                        <i className="fa-solid fa-plus" style={{ fontSize: 10, color: GREEN }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Table or empty state */}
            {enriched.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '80px 40px', gap: 12,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(var(--fg),0.03)', border: `1px solid ${BORDER}`,
                }}>
                  <i className="fa-solid fa-circle-plus" style={{ fontSize: 22, color: MUTED, opacity: 0.5 }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: TEXT2, margin: 0 }}>Add stocks to this list</p>
                <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Search above to add JSE securities</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid rgba(var(--fg),0.04)` }}>
                      {[
                        { label: 'Symbol', align: 'left' },
                        { label: 'Company', align: 'left' },
                        { label: 'Price', align: 'right' },
                        { label: 'Change', align: 'right' },
                        { label: '', align: 'right' },
                      ].map((h, i) => (
                        <th key={i} style={{
                          padding: '11px 18px', fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                          color: MUTED, textAlign: h.align as React.CSSProperties['textAlign'],
                        }}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.map(s => {
                      const isPos = s.change >= 0;
                      const cc = chgColor(s.change);
                      return (
                        <tr
                          key={s.symbol}
                          style={{ borderBottom: `1px solid rgba(var(--fg),0.028)`, cursor: 'pointer', transition: 'background 100ms' }}
                          onClick={() => { selectSymbol(s.symbol); openStockDetail(s.symbol); }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),0.028)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                              <div style={{
                                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isPos ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
                                border: `1px solid ${isPos ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)'}`,
                              }}>
                                <span style={{ fontSize: 8, fontWeight: 900, color: cc, fontFamily: FONT_MONO }}>
                                  {s.symbol.slice(0, 3)}
                                </span>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 800, color: TEXT, fontFamily: FONT_MONO }}>
                                {s.symbol}
                              </span>
                            </div>
                          </td>
                          <td style={{
                            padding: '14px 18px', fontSize: 12, color: TEXT2,
                            maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {s.name || '—'}
                          </td>
                          <td style={{
                            padding: '14px 18px', textAlign: 'right',
                            fontSize: 13, fontWeight: 700, fontFamily: FONT_MONO, color: TEXT,
                          }}>
                            J${fmt2(s.price)}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 9px', borderRadius: 8,
                              fontSize: 11, fontWeight: 800, fontFamily: FONT_MONO,
                              color: cc,
                              background: isPos ? 'rgba(0,230,118,0.1)' : s.change < 0 ? 'rgba(255,82,82,0.1)' : 'rgba(var(--fg),0.05)',
                            }}>
                              <i className={`fa-solid fa-caret-${isPos ? 'up' : 'down'}`} style={{ fontSize: 9 }} />
                              {Math.abs(s.change).toFixed(2)}%
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <button
                              onClick={e => { e.stopPropagation(); removeMut.mutate({ id: current.id, symbol: s.symbol }); }}
                              title="Remove"
                              style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                padding: '5px 7px', opacity: 0.35, transition: 'opacity 150ms, color 150ms',
                                borderRadius: 6,
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,82,82,0.1)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.35'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                              <i className="fa-solid fa-xmark" style={{ fontSize: 11, color: RED }} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
