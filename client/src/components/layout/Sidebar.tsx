import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { NAV_ITEMS, getMarketStatus } from '@/utils/constants';
import { useState, useEffect } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { isAuthenticated, tier, hasTier, isAdmin } = useAuth();
  const [clock, setClock] = useState(new Date());
  const marketStatus = getMarketStatus();

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const sections = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>((acc, item) => {
    if (item.adminOnly && !isAdmin) return acc;
    (acc[item.section] = acc[item.section] || []).push(item);
    return acc;
  }, {});

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-bg2 border-r border-card-border z-50 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="p-5 border-b border-card-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg sidebar-gradient flex items-center justify-center">
              <i className="fas fa-chart-line text-bg text-sm" />
            </div>
            <div>
              <h1 className="text-sm font-bold gradient-text">Gotham Financial</h1>
              <p className="text-[10px] text-text-secondary">AI-Powered Trading</p>
            </div>
          </div>
        </div>

        {/* Market Status */}
        <div className="px-5 py-3 border-b border-card-border">
          <div className="flex items-center justify-between text-xs">
            <span className={`flex items-center gap-1.5 ${marketStatus.color}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {marketStatus.status}
            </span>
            <span className="text-text-muted font-mono text-[11px]">
              {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 no-scrollbar">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section} className="mb-3">
              <p className="px-5 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                {section}
              </p>
              {items.map((item) => {
                const locked = item.minTier && !hasTier(item.minTier);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-5 py-2 text-[13px] transition-colors relative ${
                        isActive
                          ? 'text-gf-green bg-gf-green/5 border-r-2 border-gf-green'
                          : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.02]'
                      } ${locked ? 'opacity-50' : ''}`
                    }
                  >
                    <i className={`fas ${item.icon} w-4 text-center text-xs`} />
                    <span>{item.label}</span>
                    {locked && (
                      <i className="fas fa-lock text-[9px] text-gf-gold ml-auto" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Tier Badge */}
        {isAuthenticated && (
          <div className="p-4 border-t border-card-border">
            <div className="glass-card p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Current Plan</span>
              <p className={`text-sm font-bold ${tier === 'FREE' ? 'text-text-secondary' : 'gradient-text'}`}>
                {tier === 'ENTERPRISE' ? 'Institutional' : tier}
              </p>
              {tier === 'FREE' && (
                <NavLink
                  to="/subscription"
                  className="mt-2 block text-[11px] text-gf-green hover:underline"
                >
                  Upgrade to Pro
                </NavLink>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
