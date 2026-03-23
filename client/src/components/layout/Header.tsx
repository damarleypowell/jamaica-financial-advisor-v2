import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '@/api/alerts';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onLoginClick: () => void;
}

export default function Header({ title, onMenuClick, onLoginClick }: HeaderProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/technicals?symbol=${search.trim().toUpperCase()}`);
      setSearch('');
    }
  };

  return (
    <header className="h-14 bg-bg2/80 backdrop-blur-md border-b border-card-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-text-secondary hover:text-text-primary p-1">
          <i className="fas fa-bars text-lg" />
        </button>
        <h2 className="text-base font-semibold text-text-primary hidden sm:block">{title}</h2>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="hidden md:flex items-center max-w-xs w-full mx-4">
        <div className="relative w-full">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stocks... (e.g. NCBFG)"
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-bg3 border border-card-border focus:border-gf-green"
          />
        </div>
      </form>

      {/* Right */}
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <>
            {/* Notifications */}
            <button
              onClick={() => navigate('/alerts')}
              className="relative text-text-secondary hover:text-text-primary p-1.5"
            >
              <i className="fas fa-bell" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gf-red text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <div className="w-7 h-7 rounded-full bg-gf-green/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-gf-green">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="hidden sm:inline text-xs">{user?.name}</span>
                <i className="fas fa-chevron-down text-[10px]" />
              </button>

              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 glass-card py-1 z-50 animate-fadeIn">
                    <button
                      onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
                    >
                      <i className="fas fa-cog mr-2 w-4" /> Settings
                    </button>
                    <button
                      onClick={() => { navigate('/subscription'); setShowDropdown(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
                    >
                      <i className="fas fa-crown mr-2 w-4" /> Subscription
                    </button>
                    <hr className="border-card-border my-1" />
                    <button
                      onClick={() => { logout(); setShowDropdown(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gf-red hover:bg-white/[0.03]"
                    >
                      <i className="fas fa-sign-out-alt mr-2 w-4" /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={onLoginClick}
            className="px-4 py-1.5 bg-gf-green text-bg text-sm font-semibold rounded-lg hover:bg-gf-green/90 transition-colors"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
}
