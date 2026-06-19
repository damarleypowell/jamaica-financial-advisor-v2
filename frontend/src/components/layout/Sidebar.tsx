import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.ts';
import { useMarketStore } from '../../stores/market.ts';
import { useUIStore } from '../../stores/ui.ts';
import type { SubscriptionTier } from '../../types/index.ts';
import { useState, useEffect } from 'react';

const TIER: Record<SubscriptionTier, number> = { FREE: 0, CORE: 1, PRO: 2, ENTERPRISE: 3 };
const canAccess = (u: SubscriptionTier, req: SubscriptionTier) => TIER[u] >= TIER[req];

interface NavItem { label: string; icon: string; to: string; tier?: SubscriptionTier; adminOnly?: boolean; }
interface Section { heading: string; items: NavItem[]; }

const NAV: Section[] = [
  {
    heading: 'My Wealth',
    items: [
      { label: 'Overview',      icon: 'fa-solid fa-house',             to: '/'            },
      { label: 'Paper Trading', icon: 'fa-solid fa-flask-vial',        to: '/portfolio'   },
      { label: 'My Portfolio',  icon: 'fa-solid fa-chart-pie',         to: '/holdings'    },
      { label: 'Orders',        icon: 'fa-solid fa-receipt',           to: '/orders'      },
      { label: 'Wealth Planner',icon: 'fa-solid fa-bullseye',          to: '/planner',    tier: 'PRO' },
      { label: 'Alerts',        icon: 'fa-solid fa-bell',              to: '/alerts'      },
    ],
  },
  {
    heading: 'Markets',
    items: [
      { label: 'JSE Live',      icon: 'fa-solid fa-chart-line',        to: '/screener',   tier: 'CORE' },
      { label: 'US Stocks',     icon: 'fa-solid fa-flag-usa',          to: '/us-stocks',  tier: 'CORE' },
      { label: 'Watchlists',    icon: 'fa-solid fa-star',              to: '/watchlists'  },
      { label: 'Charts',        icon: 'fa-solid fa-chart-candlestick', to: '/technicals'  },
      { label: 'News',          icon: 'fa-solid fa-newspaper',         to: '/news'        },
    ],
  },
  {
    heading: 'AI Advisor',
    items: [
      { label: 'Chat Advisor',  icon: 'fa-solid fa-robot',             to: '/chat'        },
      { label: 'Stock Analysis',icon: 'fa-solid fa-brain',             to: '/analysis'    },
    ],
  },
  {
    heading: 'Account',
    items: [
      { label: 'Learn',         icon: 'fa-solid fa-graduation-cap',    to: '/learn'       },
      { label: 'Settings',      icon: 'fa-solid fa-gear',              to: '/settings'    },
      { label: 'Admin',         icon: 'fa-solid fa-shield-halved',     to: '/admin',      adminOnly: true },
    ],
  },
];

const MOBILE_NAV_BASE: NavItem[] = [
  { label: 'Home',      icon: 'fa-solid fa-house',       to: '/'          },
  { label: 'Invest',    icon: 'fa-solid fa-seedling',    to: '/invest'    },
  { label: 'Portfolio', icon: 'fa-solid fa-chart-pie',   to: '/holdings'  },
  { label: 'You',       icon: 'fa-solid fa-circle-user', to: '/settings'  },
];

const TIER_COLORS: Record<string, string> = {
  FREE: '#00e676', CORE: '#40c4ff', PRO: '#ffd740', ENTERPRISE: '#ce93d8',
};

function NavItemRow({ item, userTier, onClose }: { item: NavItem; userTier: SubscriptionTier; onClose: () => void }) {
  const navigate = useNavigate();
  const locked = !!item.tier && !canAccess(userTier, item.tier);
  const tierColor = item.tier ? TIER_COLORS[item.tier] : null;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={e => {
        if (locked) { e.preventDefault(); navigate('/subscription'); }
        onClose();
      }}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 10,
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        textDecoration: 'none', transition: 'all 130ms',
        opacity: locked ? .4 : 1,
        background: isActive ? 'rgba(0,230,118,.08)' : 'transparent',
        color: isActive ? '#00e676' : 'var(--color-text2)',
        marginBottom: 1,
        cursor: locked ? 'not-allowed' : 'pointer',
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{
            width: 18, display: 'flex', justifyContent: 'center', flexShrink: 0,
          }}>
            <i className={item.icon} style={{
              fontSize: 13, color: isActive ? '#00e676' : 'var(--color-muted)',
            }} />
          </span>
          <span style={{ flex: 1, lineHeight: 1.2 }}>{item.label}</span>
          {item.tier && !locked && tierColor && (
            <span style={{
              fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
              background: tierColor + '18', color: tierColor, letterSpacing: '.06em',
              border: `1px solid ${tierColor}30`,
            }}>{item.tier}</span>
          )}
          {locked && <i className="fa-solid fa-lock" style={{ fontSize: 8, color: 'var(--color-muted)', opacity: .5 }} />}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onClose, userTier, isAdmin }: { onClose: () => void; userTier: SubscriptionTier; isAdmin: boolean }) {
  const isConn = useMarketStore(s => s.isConnected);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();
  const [clock, setClock] = useState(new Date());
  const tierColor = TIER_COLORS[userTier] ?? '#00e676';

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const jamTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Jamaica', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(clock);
  const local = new Date(clock.toLocaleString('en-US', { timeZone: 'America/Jamaica' }));
  const d = local.getDay(), m = local.getHours() * 60 + local.getMinutes();
  const mktOpen = d >= 1 && d <= 5 && m >= 570 && m < 810;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Logo block */}
      <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid rgba(var(--fg),.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,230,118,.2), rgba(0,178,72,.1))',
            border: '1px solid rgba(0,230,118,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18 }}>
              <path d="M3 17L7 12L11 14.5L16 9L21 5" stroke="#00e676" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="21" cy="5" r="2.2" fill="#00e676"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 900, letterSpacing: '.12em', color: '#00e676', lineHeight: 1 }}>OROS</p>
            <p style={{ margin: 0, fontSize: 8, fontWeight: 600, letterSpacing: '.3em', color: 'var(--color-muted)', lineHeight: 1, marginTop: 3 }}>WEALTH</p>
          </div>
        </div>

        {/* User pill (if logged in) */}
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, marginTop: 14,
            padding: '8px 10px', borderRadius: 10,
            background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.05)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800,
              background: tierColor + '18', border: `1.5px solid ${tierColor}40`, color: tierColor,
            }}>{user.name.charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name.split(' ')[0]}</p>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: tierColor, letterSpacing: '.1em' }}>{userTier}</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', scrollbarWidth: 'none' }}>
        {NAV.map(sec => {
          const vis = sec.items.filter(i => !i.adminOnly || isAdmin);
          if (!vis.length) return null;
          return (
            <div key={sec.heading} style={{ marginBottom: 4 }}>
              <p style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '.16em', color: 'var(--color-muted)',
                textTransform: 'uppercase', padding: '10px 10px 4px', margin: 0, opacity: .55,
              }}>
                {sec.heading}
              </p>
              {vis.map(item => (
                <NavItemRow key={item.to} item={item} userTier={userTier} onClose={onClose} />
              ))}
            </div>
          );
        })}
        <div style={{ height: 20 }} />
      </nav>

      {/* Footer */}
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid rgba(var(--fg),.05)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Market status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: mktOpen ? '#00e676' : isConn ? '#ffd740' : 'rgba(var(--fg),.15)', boxShadow: mktOpen ? '0 0 8px rgba(0,230,118,.6)' : 'none' }} className={mktOpen ? 'animate-pulse-dot' : ''} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: mktOpen ? '#00e676' : 'var(--color-text2)', lineHeight: 1 }}>{mktOpen ? 'Markets Open' : 'Markets Closed'}</p>
            <p style={{ margin: '2px 0 0', fontSize: 9, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{jamTime} JAM</p>
          </div>
          {isConn && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 99, color: '#00e676', background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)' }}>LIVE</span>}
        </div>

        {/* Actions row */}
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Light/Dark toggle */}
          <button onClick={toggleTheme}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 9, background: 'rgba(var(--fg),.04)', border: '1px solid rgba(var(--fg),.07)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', transition: 'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),.04)'; }}>
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} style={{ fontSize: 11 }} />
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          {/* Logout */}
          {user && (
            <button onClick={() => { logout(); onClose(); }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 9, background: 'rgba(255,82,82,.06)', border: '1px solid rgba(255,82,82,.12)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'rgba(255,82,82,.7)', transition: 'all .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,82,82,.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,82,82,.06)'; }}>
              <i className="fa-solid fa-right-from-bracket" style={{ fontSize: 10 }} />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuthStore();
  const userTier: SubscriptionTier = user?.subscriptionTier ?? 'FREE';
  const isAdmin = userTier === 'ENTERPRISE';

  const MOBILE_NAV = MOBILE_NAV_BASE;

  const SIDEBAR_W = 240;

  return (
    <>
      {/* ── Desktop: always-visible pinned sidebar ─────────────────── */}
      <aside
        data-tour="sidebar"
        className="hidden lg:flex"
        style={{
          position: 'fixed',
          top: 32,         // below ticker
          left: 0,
          bottom: 0,
          width: SIDEBAR_W,
          background: 'var(--color-bg2)',
          borderRight: '1px solid rgba(var(--fg),.05)',
          zIndex: 35,
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 260ms cubic-bezier(.4,0,.2,1)',
        }}
      >
        <SidebarContent onClose={() => {}} userTier={userTier} isAdmin={isAdmin} />
      </aside>

      {/* ── Mobile: backdrop + slide drawer ────────────────────────── */}
      <div className="lg:hidden">
        {isOpen && (
          <div
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)', zIndex: 48,
            }}
          />
        )}
        <aside style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
          background: 'var(--color-bg2)',
          borderRight: '1px solid rgba(var(--fg),.06)',
          zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 260ms cubic-bezier(.4,0,.2,1)',
        }}>
          {/* Mobile drawer close button */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: '12px 12px 0',
            paddingTop: 'max(12px, env(safe-area-inset-top))',
          }}>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(var(--fg),.05)', border: '1px solid rgba(var(--fg),.07)', cursor: 'pointer',
            }}>
              <i className="fa-solid fa-xmark" style={{ fontSize: 13, color: 'var(--color-muted)' }} />
            </button>
          </div>
          <SidebarContent onClose={onClose} userTier={userTier} isAdmin={isAdmin} />
        </aside>
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────────────── */}
      <nav data-tour="bottom-nav" className="lg:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(var(--surf),.98)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(var(--fg),.06)', zIndex: 40,
        display: 'flex', alignItems: 'stretch',
      }}>
        {MOBILE_NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={{ textDecoration: 'none', flex: 1, display: 'flex', justifyContent: 'center' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '10px 4px 12px', position: 'relative', width: '100%',
              }}>
                {isActive && (
                  <span style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 24, height: 2, borderRadius: 99, background: 'var(--color-green)',
                    boxShadow: '0 0 10px rgba(0,230,118,.7)',
                  }} />
                )}
                <div style={{
                  width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'rgba(0,230,118,.12)' : 'transparent',
                  transition: 'background 160ms',
                }}>
                  <i className={item.icon} style={{
                    fontSize: 16, transition: 'all 160ms',
                    color: isActive ? 'var(--color-green)' : 'rgba(var(--fg),.35)',
                    filter: isActive ? 'drop-shadow(0 0 6px rgba(0,230,118,.6))' : 'none',
                  }} />
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '.03em',
                  color: isActive ? 'var(--color-green)' : 'rgba(var(--fg),.28)',
                  transition: 'color 160ms',
                }}>
                  {item.label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
