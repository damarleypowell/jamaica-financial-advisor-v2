import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.ts';
import { useUIStore } from '../../stores/ui.ts';

interface DrawerItem {
  label: string;
  icon: string;
  to?: string;
  onClick?: () => void;
}
interface DrawerSection { heading: string; items: DrawerItem[]; }

const SECTIONS: DrawerSection[] = [
  {
    heading: 'My Wealth',
    items: [
      { label: 'Paper Trading', icon: 'fa-solid fa-flask-vial', to: '/portfolio' },
      { label: 'My Portfolio',  icon: 'fa-solid fa-chart-pie',  to: '/holdings'  },
    ],
  },
  {
    heading: 'Markets',
    items: [
      { label: 'JSE Live',     icon: 'fa-solid fa-chart-line',        to: '/screener'   },
      { label: 'US Stocks',    icon: 'fa-solid fa-flag-usa',          to: '/us-stocks'  },
      { label: 'Watchlists',   icon: 'fa-solid fa-star',              to: '/watchlists' },
      { label: 'Charts',       icon: 'fa-solid fa-chart-candlestick', to: '/technicals' },
      { label: 'News',         icon: 'fa-solid fa-newspaper',         to: '/news'       },
    ],
  },
  {
    heading: 'AI Tools',
    items: [
      { label: 'AI Chat Advisor', icon: 'fa-solid fa-robot', to: '/chat'     },
      { label: 'Stock Analysis',  icon: 'fa-solid fa-brain', to: '/analysis' },
    ],
  },
  {
    heading: 'Account',
    items: [
      { label: 'Orders',       icon: 'fa-solid fa-receipt',        to: '/orders'        },
      { label: 'Alerts',       icon: 'fa-solid fa-bell',           to: '/alerts'        },
      { label: 'Learn',        icon: 'fa-solid fa-graduation-cap', to: '/learn'         },
      { label: 'Settings',     icon: 'fa-solid fa-gear',           to: '/settings'      },
      { label: 'Subscription', icon: 'fa-solid fa-crown',          to: '/subscription'  },
    ],
  },
];

export default function OptionsDrawer() {
  const { user, logout } = useAuthStore();
  const { closeOptionsDrawer, toggleTheme, theme, openAuthModal } = useUIStore();

  const tier = user?.subscriptionTier ?? 'FREE';
  const TIER_COLORS: Record<string, string> = {
    FREE: '#00e676', CORE: '#40c4ff', PRO: '#ffd740', ENTERPRISE: '#ce93d8',
  };
  const tierColor = TIER_COLORS[tier] ?? '#00e676';

  return (
    <>
      <div className="options-drawer-overlay" onClick={closeOptionsDrawer} />

      <div className="options-drawer">
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 20px' }}>
          <div>
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: '.1em', color: 'var(--color-text)' }}>OROS</p>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 600, letterSpacing: '.25em', color: 'var(--color-muted)' }}>FINANCIAL</p>
          </div>
          <button className="top-icon-btn" onClick={closeOptionsDrawer} aria-label="Close menu">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* User card */}
        {user ? (
          <div style={{ margin: '0 16px 8px', padding: '14px 16px', borderRadius: 14, background: 'var(--color-bg3)', border: '1px solid var(--color-border2)' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{user.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>{user.email}</p>
            <span style={{ display: 'inline-block', marginTop: 8, fontSize: 9, fontWeight: 800, letterSpacing: '.12em', color: tierColor, background: `${tierColor}18`, padding: '3px 10px', borderRadius: 99 }}>
              {tier} PLAN
            </span>
          </div>
        ) : (
          <div style={{ padding: '0 16px 8px' }}>
            <button
              onClick={() => { openAuthModal('login'); closeOptionsDrawer(); }}
              style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'var(--color-green)', color: 'var(--color-bg)', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>
              Sign In / Create Account
            </button>
          </div>
        )}

        {/* Nav sections */}
        {SECTIONS.map(section => (
          <div key={section.heading}>
            <p className="options-drawer__section-label">{section.heading}</p>
            {section.items.map(item =>
              item.to ? (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) => `options-drawer__item${isActive ? ' options-drawer__item--active' : ''}`}
                  onClick={closeOptionsDrawer}>
                  <i className={item.icon} />
                  {item.label}
                </NavLink>
              ) : (
                <button key={item.label} className="options-drawer__item" onClick={() => { item.onClick?.(); closeOptionsDrawer(); }}>
                  <i className={item.icon} />
                  {item.label}
                </button>
              )
            )}
          </div>
        ))}

        {/* Bottom: theme + logout */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
          <p className="options-drawer__section-label">Display</p>
          <button className="options-drawer__item" onClick={toggleTheme}>
            <i className={theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} />
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          {user && (
            <button
              className="options-drawer__item options-drawer__item--danger"
              onClick={() => { logout(); closeOptionsDrawer(); }}>
              <i className="fa-solid fa-right-from-bracket" />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </>
  );
}
