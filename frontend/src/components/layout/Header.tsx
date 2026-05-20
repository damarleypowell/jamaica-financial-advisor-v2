import { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.ts';
import { useMarketStore } from '../../stores/market.ts';
import { useUIStore } from '../../stores/ui.ts';
import type { AuthModalView } from '../../stores/ui.ts';
import type { Stock } from '../../types/index.ts';

interface SearchResultsProps {
  results: Stock[];
  width: number;
  onSelect: (symbol: string) => void;
}

function SearchResults({ results, width, onSelect }: SearchResultsProps) {
  if (results.length === 0) return null;
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 10px)', right: 0, width,
      background: 'var(--color-bg3)', border: '1px solid rgba(255,255,255,.1)',
      borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.8)', zIndex: 60, overflow: 'hidden',
    }} className="animate-fade-in">
      <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
          {results.length} result{results.length !== 1 ? 's' : ''}
        </p>
      </div>
      {results.map(s => {
        const pos = (s.pctChange ?? 0) >= 0;
        return (
          <button key={s.symbol}
            onClick={() => onSelect(s.symbol)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 120ms' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: pos ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', flexShrink: 0,
            }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: pos ? '#00e676' : '#ff5252', fontFamily: 'var(--font-mono)' }}>{s.symbol.slice(0, 3)}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{s.symbol}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text)' }}>${(s.price ?? 0).toFixed(2)}</p>
              <p style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: pos ? '#00e676' : '#ff5252' }}>{pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const PAGE_META: Record<string, { title: string; sub?: string }> = {
  '/':                 { title: 'Dashboard',        sub: 'JSE Market Overview' },
  '/technicals':       { title: 'Advanced Chart',   sub: 'Technical Analysis' },
  '/news':             { title: 'News',              sub: 'Market News & Sentiment' },
  '/watchlists':       { title: 'Watchlists',        sub: 'Your Tracked Stocks' },
  '/screener':         { title: 'Screener',          sub: 'Find Opportunities' },
  '/sectors':          { title: 'Sectors',           sub: 'Sector Performance' },
  '/compare':          { title: 'Compare',           sub: 'Side-by-Side Analysis' },
  '/dividends':        { title: 'Dividends',         sub: 'Dividend Tracker' },
  '/portfolio':        { title: 'Portfolio',         sub: 'Your Holdings' },
  '/orders':           { title: 'Orders',            sub: 'Transaction History' },
  '/calculators':      { title: 'Calculators',       sub: 'Investment Tools' },
  '/us-stocks':        { title: 'US Stocks',         sub: 'American Markets' },
  '/forex':            { title: 'Forex',             sub: 'Currency Exchange' },
  '/global-markets':   { title: 'Global Markets',   sub: 'World Indices' },
  '/planner':          { title: 'Financial Planner', sub: 'Plan Your Future' },
  '/leaderboard':      { title: 'Leaderboard',       sub: 'Top Traders' },
  '/chat':             { title: 'AI Chat',           sub: 'Ask Gotham AI' },
  '/analysis':         { title: 'AI Analysis',       sub: 'Deep Insights' },
  '/learn':            { title: 'Learn',             sub: 'Education Centre' },
  '/settings':         { title: 'Settings',          sub: 'Preferences' },
  '/subscription':     { title: 'Subscription',      sub: 'Manage Plan' },
  '/admin':            { title: 'Admin',             sub: 'System Management' },
};

const TIER_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  FREE:       { bg: 'rgba(0,230,118,.12)',   color: '#00e676', border: 'rgba(0,230,118,.25)'   },
  BASIC:      { bg: 'rgba(64,196,255,.12)',  color: '#40c4ff', border: 'rgba(64,196,255,.25)'  },
  PRO:        { bg: 'rgba(255,215,64,.12)',  color: '#ffd740', border: 'rgba(255,215,64,.25)'  },
  ENTERPRISE: { bg: 'rgba(206,147,216,.12)', color: '#ce93d8', border: 'rgba(206,147,216,.25)' },
};

/* â"€â"€ JWT auth section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
function AuthSection({ user, isAuthenticated, openAuthModal, logout }: {
  user: { subscriptionTier?: string; name?: string } | null;
  isAuthenticated: boolean;
  openAuthModal: (view?: AuthModalView) => void;
  logout: () => void;
}) {
  const tier = user?.subscriptionTier ?? 'FREE';
  const tb   = TIER_BADGE[tier] ?? TIER_BADGE.FREE;
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  if (isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800, letterSpacing: '.1em', background: tb.bg, border: `1px solid ${tb.border}`, color: tb.color }} className="hidden md:inline-flex">{tier}</span>
        <div style={{ position: 'relative' }} className="group">
          <button
            onClick={logout}
            title="Sign out"
            style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(0,230,118,.12)', border: '1px solid rgba(0,230,118,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#00e676', fontFamily: 'var(--font-mono)', transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,82,82,.12)'; e.currentTarget.style.borderColor = 'rgba(255,82,82,.3)'; e.currentTarget.style.color = '#ff5252'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,230,118,.12)'; e.currentTarget.style.borderColor = 'rgba(0,230,118,.22)'; e.currentTarget.style.color = '#00e676'; }}>
            {initials}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={() => openAuthModal('login')}
        style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, color: 'var(--color-text2)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 10, transition: 'all 150ms', background: 'transparent', cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = 'var(--color-text)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text2)'; }}>
        Log In
      </button>
      <button
        onClick={() => openAuthModal('signup')}
        style={{ padding: '7px 16px', fontSize: 13, fontWeight: 700, color: '#04060d', background: 'var(--color-green)', border: 'none', borderRadius: 10, transition: 'all 180ms', boxShadow: '0 2px 16px rgba(0,230,118,.3)', cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,230,118,.45)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(0,230,118,.3)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
        Sign Up
      </button>
    </div>
  );
}

export default function Header({ onToggleSidebar, focusMode: _focusMode }: { onToggleSidebar: () => void; focusMode?: boolean }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const user      = useAuthStore(s => s.user);
  const logout    = useAuthStore(s => s.logout);
  const stocks    = useMarketStore(s => s.stocks);
  const isConn    = useMarketStore(s => s.isConnected);

  const isAuthenticated = !!user;
  const openAuthModal = useUIStore(s => s.openAuthModal);

  const [sq, setSq] = useState('');
  const [sOpen, setSOpen] = useState(false);
  const [mSearchOpen, setMSearchOpen] = useState(false);
  const sRef  = useRef<HTMLDivElement>(null);
  const mRef  = useRef<HTMLDivElement>(null);

  const base = '/' + (location.pathname.split('/')[1] ?? '');
  const page = PAGE_META[base] ?? { title: 'Gotham Financial' };

  const results = sq.trim()
    ? stocks.filter(s =>
        s.symbol.toLowerCase().includes(sq.toLowerCase()) ||
        s.name.toLowerCase().includes(sq.toLowerCase())
      ).slice(0, 7)
    : [];

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (sRef.current && !sRef.current.contains(e.target as Node)) { setSOpen(false); setSq(''); }
      if (mRef.current && !mRef.current.contains(e.target as Node)) { setMSearchOpen(false); setSq(''); }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSOpen(true); }
      if (e.key === 'Escape') { setSOpen(false); setSq(''); setMSearchOpen(false); }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  const iconBtn: React.CSSProperties = {
    width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms', flexShrink: 0,
  };

  const handleSelectResult = (symbol: string) => {
    navigate(`/technicals/${symbol}`);
    setSOpen(false);
    setMSearchOpen(false);
    setSq('');
  };

  return (
    <header style={{
      position: 'fixed', top: 32, left: 0, right: 0, height: 56,
      background: 'rgba(7,11,20,0.96)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      zIndex: 40, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
      maxWidth: '100%',
    }}>

      {/* Mobile menu toggle */}
      <button onClick={onToggleSidebar} aria-label="menu"
        style={iconBtn}
        className="md:hidden"
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.07)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <i className="fa-solid fa-bars" style={{ fontSize: 15, color: 'var(--color-text2)' }} />
      </button>

      {/* Brand â€" single, always visible */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18 }}>
            <path d="M3 17L7 12L11 14.5L16 9L21 5" stroke="#00e676" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="21" cy="5" r="2.2" fill="#00e676"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 900, letterSpacing: '.1em', color: '#00e676', lineHeight: 1, margin: 0 }}>GOTHAM</p>
          <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: '.3em', color: 'var(--color-muted)', lineHeight: 1, margin: 0, marginTop: 2 }}>FINANCIAL</p>
        </div>
      </Link>

      {/* Divider + page title */}
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.08)', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{page.title}</p>
        {page.sub && <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', lineHeight: 1, marginTop: 2 }} className="hidden sm:block">{page.sub}</p>}
      </div>

      <div style={{ flex: 1 }} className="hidden md:block" />

      {/* Desktop search */}
      <div ref={sRef} style={{ position: 'relative', flexShrink: 0 }} className="hidden sm:block">
        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--color-muted)', pointerEvents: 'none', zIndex: 1 }} />
        <input
          value={sq}
          onChange={e => { setSq(e.target.value); setSOpen(true); }}
          onFocus={() => setSOpen(true)}
          placeholder="Search stocks..."
          style={{
            height: 36, width: 230, paddingLeft: 34, paddingRight: 50,
            background: sOpen ? 'rgba(0,230,118,.05)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${sOpen ? 'rgba(0,230,118,.35)' : 'rgba(255,255,255,.07)'}`,
            borderRadius: 10, fontSize: 13, color: 'var(--color-text)',
            outline: 'none', transition: 'all 180ms', fontFamily: 'var(--font-sans)',
            boxShadow: sOpen ? '0 0 0 3px rgba(0,230,118,.08)' : 'none',
          }}
        />
        <kbd style={{
          position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
          fontSize: 9, color: 'var(--color-muted)', background: 'rgba(255,255,255,.05)',
          border: '1px solid rgba(255,255,255,.08)', borderRadius: 5, padding: '2px 5px', fontFamily: 'var(--font-mono)',
        }}>âŒ˜K</kbd>
        {sOpen && <SearchResults results={results} width={310} onSelect={handleSelectResult} />}
      </div>

      {/* Mobile search button */}
      <div ref={mRef} style={{ position: 'relative' }} className="flex sm:hidden">
        <button
          onClick={() => setMSearchOpen(v => !v)}
          style={{
            ...iconBtn,
            background: mSearchOpen ? 'rgba(0,230,118,.08)' : 'transparent',
            border: mSearchOpen ? '1px solid rgba(0,230,118,.2)' : '1px solid transparent',
          }}
          aria-label="search">
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 15, color: mSearchOpen ? 'var(--color-green)' : 'var(--color-text2)' }} />
        </button>

        {mSearchOpen && (
          <div style={{
            position: 'fixed', top: 90, left: 12, right: 12, zIndex: 60,
          }} className="animate-slide-up">
            <div style={{
              background: 'var(--color-bg3)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.8)', overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 14, color: 'var(--color-muted)' }} />
                <input
                  autoFocus
                  value={sq}
                  onChange={e => setSq(e.target.value)}
                  placeholder="Search stocks, funds..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 15, color: 'var(--color-text)', fontFamily: 'var(--font-sans)',
                  }}
                />
                {sq && (
                  <button onClick={() => setSq('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <i className="fa-solid fa-xmark" style={{ fontSize: 13, color: 'var(--color-muted)' }} />
                  </button>
                )}
              </div>
              {results.length > 0 ? (
                results.map(s => {
                  const pos = (s.pctChange ?? 0) >= 0;
                  return (
                    <button key={s.symbol}
                      onClick={() => { navigate(`/technicals/${s.symbol}`); setMSearchOpen(false); setSq(''); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 120ms', borderBottom: '1px solid rgba(255,255,255,.03)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: pos ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: pos ? '#00e676' : '#ff5252', fontFamily: 'var(--font-mono)' }}>{s.symbol.slice(0, 3)}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{s.symbol}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text)' }}>${(s.price ?? 0).toFixed(2)}</p>
                        <p style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: pos ? '#00e676' : '#ff5252' }}>{pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%</p>
                      </div>
                    </button>
                  );
                })
              ) : sq.trim() ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                  No results for "{sq}"
                </div>
              ) : (
                <div style={{ padding: '16px 14px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Popular</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['NCB', 'GK', 'SVL', 'SJ', 'JMMBGL'].map(sym => (
                      <button key={sym}
                        onClick={() => { navigate(`/technicals/${sym}`); setMSearchOpen(false); }}
                        style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: 'rgba(255,255,255,.06)', border: '1px solid var(--color-border)',
                          color: 'var(--color-text2)', cursor: 'pointer', transition: 'all 140ms',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,230,118,.1)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-green)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.06)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text2)'; }}>
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connection status â€" desktop */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
        background: isConn ? 'rgba(0,230,118,.08)' : 'rgba(255,255,255,.04)',
        border: `1px solid ${isConn ? 'rgba(0,230,118,.22)' : 'rgba(255,255,255,.07)'}`,
        color: isConn ? '#00e676' : 'var(--color-muted)',
        flexShrink: 0,
      }} className="hidden lg:inline-flex">
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isConn ? '#00e676' : 'var(--color-muted)',
          display: 'inline-block',
          boxShadow: isConn ? '0 0 6px rgba(0,230,118,.6)' : 'none',
        }} className={isConn ? 'animate-pulse-dot' : ''} />
        {isConn ? 'Live' : 'Offline'}
      </div>

      {/* Auth */}
      <AuthSection user={user} isAuthenticated={isAuthenticated} openAuthModal={openAuthModal} logout={logout} />
    </header>
  );
}

