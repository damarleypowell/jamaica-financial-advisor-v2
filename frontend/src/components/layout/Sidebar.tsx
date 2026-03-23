import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.ts';
import { useMarketStore } from '../../stores/market.ts';
import type { SubscriptionTier } from '../../types/index.ts';
import { useState, useEffect } from 'react';

/* ---------- tier helpers ---------- */
const TIER_LEVEL: Record<SubscriptionTier, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

function canAccess(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_LEVEL[userTier] >= TIER_LEVEL[required];
}

/* ---------- nav item definition ---------- */
interface NavItem {
  label: string;
  icon: string;
  to: string;
  tier?: SubscriptionTier;
  adminOnly?: boolean;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'MARKET',
    items: [
      { label: 'Dashboard', icon: 'fa-solid fa-chart-line', to: '/' },
      { label: 'Advanced Chart', icon: 'fa-solid fa-chart-candlestick', to: '/technicals', tier: 'BASIC' },
      { label: 'News', icon: 'fa-solid fa-newspaper', to: '/news' },
      { label: 'Watchlists', icon: 'fa-solid fa-eye', to: '/watchlists' },
      { label: 'Screener', icon: 'fa-solid fa-filter', to: '/screener', tier: 'BASIC' },
      { label: 'Sectors', icon: 'fa-solid fa-building', to: '/sectors', tier: 'BASIC' },
      { label: 'Compare', icon: 'fa-solid fa-code-compare', to: '/compare', tier: 'BASIC' },
      { label: 'Dividends', icon: 'fa-solid fa-money-bill-trend-up', to: '/dividends', tier: 'BASIC' },
    ],
  },
  {
    heading: 'INVEST',
    items: [
      { label: 'Portfolio', icon: 'fa-solid fa-briefcase', to: '/portfolio' },
      { label: 'Orders & History', icon: 'fa-solid fa-clock-rotate-left', to: '/orders' },
      { label: 'Calculators', icon: 'fa-solid fa-calculator', to: '/calculators', tier: 'BASIC' },
      { label: 'US Stocks', icon: 'fa-solid fa-flag-usa', to: '/us-stocks', tier: 'BASIC' },
      { label: 'Forex', icon: 'fa-solid fa-money-bill-transfer', to: '/forex', tier: 'PRO' },
      { label: 'Markets', icon: 'fa-solid fa-globe', to: '/global-markets', tier: 'PRO' },
      { label: 'Currency Impact', icon: 'fa-solid fa-coins', to: '/currency-impact', tier: 'PRO' },
      { label: 'Planner', icon: 'fa-solid fa-bullseye', to: '/planner', tier: 'PRO' },
      { label: 'Leaderboard', icon: 'fa-solid fa-trophy', to: '/leaderboard', tier: 'PRO' },
    ],
  },
  {
    heading: 'AI TOOLS',
    items: [
      { label: 'AI Chat', icon: 'fa-solid fa-robot', to: '/chat', tier: 'BASIC' },
      { label: 'AI Analysis', icon: 'fa-solid fa-brain', to: '/analysis', tier: 'PRO' },
    ],
  },
  {
    heading: 'LEARN',
    items: [
      { label: 'Learn', icon: 'fa-solid fa-graduation-cap', to: '/learn' },
    ],
  },
  {
    heading: 'ACCOUNT',
    items: [
      { label: 'Settings', icon: 'fa-solid fa-gear', to: '/settings' },
      { label: 'Subscription', icon: 'fa-solid fa-crown', to: '/subscription' },
      { label: 'Admin', icon: 'fa-solid fa-shield-halved', to: '/admin', adminOnly: true },
    ],
  },
];

/* ---------- mobile bottom nav items ---------- */
const MOBILE_NAV: NavItem[] = [
  { label: 'Home', icon: 'fa-solid fa-house', to: '/' },
  { label: 'Portfolio', icon: 'fa-solid fa-briefcase', to: '/portfolio' },
  { label: 'Chart', icon: 'fa-solid fa-chart-line', to: '/technicals', tier: 'BASIC' },
  { label: 'News', icon: 'fa-solid fa-newspaper', to: '/news' },
  { label: 'More', icon: 'fa-solid fa-ellipsis', to: '/settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuthStore();
  const isConnected = useMarketStore((s) => s.isConnected);
  const userTier: SubscriptionTier = user?.subscriptionTier ?? 'FREE';
  const isAdmin = false; // TODO: derive from user role when admin field added
  const navigate = useNavigate();
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Jamaica is UTC-5
  const jamaicaTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Jamaica',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(clock);

  // JSE hours: Mon-Fri 9:30 AM - 1:30 PM Jamaica time
  const jamaicaNow = new Date(
    clock.toLocaleString('en-US', { timeZone: 'America/Jamaica' }),
  );
  const day = jamaicaNow.getDay();
  const hours = jamaicaNow.getHours();
  const minutes = jamaicaNow.getMinutes();
  const timeMinutes = hours * 60 + minutes;
  const isMarketOpen =
    day >= 1 && day <= 5 && timeMinutes >= 570 && timeMinutes < 810;

  function handleNavClick(item: NavItem, e: React.MouseEvent) {
    if (item.tier && !canAccess(userTier, item.tier)) {
      e.preventDefault();
      navigate('/subscription');
      onClose();
      return;
    }
    onClose();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed top-9 left-0 bottom-0 w-[260px] bg-bg2 border-r border-border z-30 flex-col overflow-y-auto hidden md:flex transition-transform duration-300`}
      >
        {/* Brand */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green/20 flex items-center justify-center">
              <i className="fa-solid fa-chart-line text-green text-sm" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide text-green leading-none">
                GOTHAM
              </h1>
              <p className="text-[10px] font-medium text-muted tracking-[0.2em] leading-none mt-0.5">
                FINANCIAL
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="text-[10px] font-semibold text-muted tracking-[0.15em] uppercase px-3 mb-1.5">
                {section.heading}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  // Hide admin item for non-admins
                  if (item.adminOnly && !isAdmin) return null;

                  const locked =
                    !!item.tier && !canAccess(userTier, item.tier);

                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={(e) => handleNavClick(item, e)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
                            isActive
                              ? 'bg-green/10 text-green border-l-2 border-green'
                              : 'text-text2 hover:bg-glass hover:text-text border-l-2 border-transparent'
                          } ${locked ? 'opacity-60' : ''}`
                        }
                      >
                        <i
                          className={`${item.icon} w-4 text-center text-xs`}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {locked && (
                          <i className="fa-solid fa-lock text-[10px] text-muted" />
                        )}
                        {item.tier && !locked && (
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded ${
                              item.tier === 'PRO'
                                ? 'bg-gold/15 text-gold'
                                : 'bg-blue/15 text-blue'
                            }`}
                          >
                            {item.tier}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer: market status */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isMarketOpen ? 'bg-green animate-pulse-slow' : isConnected ? 'bg-gold' : 'bg-red'
              }`}
            />
            <span className="text-xs text-muted">
              {isMarketOpen ? 'JSE Market Open' : 'JSE Market Closed'}
            </span>
          </div>
          <p className="text-[10px] text-muted mt-1 font-mono">{jamaicaTime}</p>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile slide-out sidebar */}
      <aside
        className={`fixed top-9 left-0 bottom-[60px] w-[280px] bg-bg2 border-r border-border z-50 flex flex-col overflow-y-auto md:hidden transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="px-5 pt-5 pb-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green/20 flex items-center justify-center">
              <i className="fa-solid fa-chart-line text-green text-sm" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide text-green leading-none">
                GOTHAM
              </h1>
              <p className="text-[10px] font-medium text-muted tracking-[0.2em] leading-none mt-0.5">
                FINANCIAL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-glass text-muted hover:text-text transition-colors flex items-center justify-center"
            aria-label="Close sidebar"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Same nav sections */}
        <nav className="flex-1 py-3 px-3 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="text-[10px] font-semibold text-muted tracking-[0.15em] uppercase px-3 mb-1.5">
                {section.heading}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.adminOnly && !isAdmin) return null;
                  const locked =
                    !!item.tier && !canAccess(userTier, item.tier);

                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={(e) => handleNavClick(item, e)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-green/10 text-green border-l-2 border-green'
                              : 'text-text2 hover:bg-glass hover:text-text border-l-2 border-transparent'
                          } ${locked ? 'opacity-60' : ''}`
                        }
                      >
                        <i
                          className={`${item.icon} w-4 text-center text-xs`}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {locked && (
                          <i className="fa-solid fa-lock text-[10px] text-muted" />
                        )}
                        {item.tier && !locked && (
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded ${
                              item.tier === 'PRO'
                                ? 'bg-gold/15 text-gold'
                                : 'bg-blue/15 text-blue'
                            }`}
                          >
                            {item.tier}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isMarketOpen ? 'bg-green animate-pulse-slow' : isConnected ? 'bg-gold' : 'bg-red'
              }`}
            />
            <span className="text-xs text-muted">
              {isMarketOpen ? 'JSE Open' : 'JSE Closed'}
            </span>
          </div>
          <p className="text-[10px] text-muted mt-1 font-mono">{jamaicaTime}</p>
        </div>
      </aside>

      {/* Mobile bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-bg2 border-t border-border z-40 flex items-center justify-around md:hidden">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                isActive ? 'text-green' : 'text-muted hover:text-text'
              }`
            }
          >
            <i className={`${item.icon} text-lg`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
