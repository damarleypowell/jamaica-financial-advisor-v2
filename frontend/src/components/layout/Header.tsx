import { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.ts';
import { useMarketStore } from '../../stores/market.ts';

/* ---------- page titles by route ---------- */
const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Market Overview' },
  '/technicals': { title: 'Advanced Chart', subtitle: 'Technical Analysis' },
  '/news': { title: 'News', subtitle: 'Market News & Sentiment' },
  '/watchlists': { title: 'Watchlists', subtitle: 'Track Your Stocks' },
  '/screener': { title: 'Screener', subtitle: 'Find Stocks' },
  '/sectors': { title: 'Sectors', subtitle: 'Sector Performance' },
  '/compare': { title: 'Compare', subtitle: 'Side-by-Side Analysis' },
  '/dividends': { title: 'Dividends', subtitle: 'Dividend Tracker' },
  '/portfolio': { title: 'Portfolio', subtitle: 'Your Holdings' },
  '/orders': { title: 'Orders & History', subtitle: 'Transactions' },
  '/calculators': { title: 'Calculators', subtitle: 'Investment Tools' },
  '/us-stocks': { title: 'US Stocks', subtitle: 'American Markets' },
  '/forex': { title: 'Forex', subtitle: 'Currency Exchange' },
  '/global-markets': { title: 'Global Markets', subtitle: 'World Indices' },
  '/currency-impact': { title: 'Currency Impact', subtitle: 'FX Analysis' },
  '/planner': { title: 'Financial Planner', subtitle: 'Plan Your Future' },
  '/leaderboard': { title: 'Leaderboard', subtitle: 'Top Traders' },
  '/chat': { title: 'AI Chat', subtitle: 'Ask Anything' },
  '/analysis': { title: 'AI Analysis', subtitle: 'Deep Insights' },
  '/learn': { title: 'Learn', subtitle: 'Education Centre' },
  '/settings': { title: 'Settings', subtitle: 'Preferences' },
  '/subscription': { title: 'Subscription', subtitle: 'Manage Plan' },
  '/admin': { title: 'Admin', subtitle: 'System Management' },
};

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

export default function Header({ onToggleSidebar, onOpenAuth }: HeaderProps) {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const stocks = useMarketStore((s) => s.stocks);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Resolve page title
  const basePath = '/' + (location.pathname.split('/')[1] ?? '');
  const pageInfo = PAGE_TITLES[basePath] ?? PAGE_TITLES[location.pathname] ?? {
    title: 'Gotham Financial',
  };

  // Search filtering
  const searchResults = searchQuery.trim()
    ? stocks
        .filter(
          (s) =>
            s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .slice(0, 8)
    : [];

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="fixed top-9 left-0 right-0 h-16 bg-bg2 border-b border-border z-40 flex items-center px-4 gap-4">
      {/* Left: mobile toggle + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-glass text-muted hover:text-text transition-colors"
          aria-label="Toggle sidebar"
        >
          <i className="fa-solid fa-bars text-lg" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-text truncate">
            {pageInfo.title}
          </h1>
          {pageInfo.subtitle && (
            <p className="text-xs text-muted truncate">{pageInfo.subtitle}</p>
          )}
        </div>
      </div>

      {/* Center: search */}
      <div ref={searchRef} className="relative flex-1 max-w-md mx-auto hidden sm:block">
        <div className="relative">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
          <input
            type="text"
            placeholder="Search stocks..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            className="w-full h-9 pl-9 pr-4 bg-glass border border-border rounded-lg text-sm text-text placeholder:text-muted focus:outline-none focus:border-green/50 transition-colors"
          />
        </div>
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-bg2 border border-border rounded-lg shadow-xl max-h-80 overflow-y-auto z-50">
            {searchResults.map((stock) => (
              <Link
                key={stock.symbol}
                to={`/technicals/${stock.symbol}`}
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-glass transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-green font-semibold text-sm">
                    {stock.symbol}
                  </span>
                  <span className="text-text2 text-sm truncate max-w-[180px]">
                    {stock.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm text-text">
                    ${stock.price.toFixed(2)}
                  </span>
                  <span
                    className={`ml-2 font-mono text-xs ${
                      stock.pctChange >= 0 ? 'text-green' : 'text-red'
                    }`}
                  >
                    {stock.pctChange >= 0 ? '+' : ''}
                    {stock.pctChange.toFixed(2)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        {isAuthenticated && user ? (
          <>
            {/* Wallet balance */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg">
              <i className="fa-solid fa-wallet text-green text-xs" />
              <span className="font-mono text-xs text-text">
                J$0.00
              </span>
            </div>

            {/* Notification bell */}
            <button className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-glass text-muted hover:text-text transition-colors">
              <i className="fa-solid fa-bell text-sm" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                0
              </span>
            </button>

            {/* User dropdown */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-glass transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center">
                  <span className="text-green font-semibold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="hidden md:block text-sm text-text">
                  {user.name.split(' ')[0]}
                </span>
                <i className="fa-solid fa-chevron-down text-[10px] text-muted" />
              </button>

              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-bg2 border border-border rounded-lg shadow-xl z-50 py-1">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-text">
                      {user.name}
                    </p>
                    <p className="text-xs text-muted">{user.email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-green/15 text-green border border-green/30">
                      {user.subscriptionTier}
                    </span>
                  </div>
                  <UserMenuItem
                    icon="fa-solid fa-user"
                    label="Profile"
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <UserMenuItem
                    icon="fa-solid fa-gear"
                    label="Settings"
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <UserMenuItem
                    icon="fa-solid fa-crown"
                    label="Subscription"
                    to="/subscription"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <UserMenuItem
                    icon="fa-solid fa-wallet"
                    label="Wallet"
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <UserMenuItem
                    icon="fa-solid fa-bell"
                    label="Alerts"
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <UserMenuItem
                    icon="fa-solid fa-shield"
                    label="Security"
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <UserMenuItem
                    icon="fa-solid fa-id-card"
                    label="KYC Verification"
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red hover:bg-glass transition-colors"
                    >
                      <i className="fa-solid fa-arrow-right-from-bracket text-xs w-4 text-center" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-4 py-2 text-sm font-medium text-text hover:text-green border border-border rounded-lg hover:border-green/50 transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-4 py-2 text-sm font-medium text-bg bg-green rounded-lg hover:bg-green/90 transition-colors"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/* ---------- helper ---------- */
function UserMenuItem({
  icon,
  label,
  to,
  onClick,
}: {
  icon: string;
  label: string;
  to: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 text-sm text-text2 hover:bg-glass hover:text-text transition-colors"
    >
      <i className={`${icon} text-xs w-4 text-center text-muted`} />
      {label}
    </Link>
  );
}
