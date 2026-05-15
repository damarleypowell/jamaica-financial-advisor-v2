import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Ticker from './Ticker.tsx';
import Header from './Header.tsx';
import Sidebar from './Sidebar.tsx';
import { useAnalytics } from '../../hooks/useAnalytics.ts';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useAnalytics();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Ticker />
      <Header onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Persistent desktop sidebar offset — sidebar is always visible on lg+ */}
      <main
        style={{
          paddingTop: 88,          // ticker (32px) + header (56px)
          paddingBottom: 80,
          paddingLeft: 20,
          paddingRight: 20,
          maxWidth: 1280,
          margin: '0 auto',
          /* On desktop we shift content right to accommodate the pinned sidebar.
             The sidebar is 260px wide. Class applied via media query below. */
        }}
        className="layout-main animate-fade-in"
      >
        <Outlet />
      </main>
    </div>
  );
}
