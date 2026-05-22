import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Ticker from './Ticker.tsx';
import Header from './Header.tsx';
import Sidebar from './Sidebar.tsx';
import { useAnalytics } from '../../hooks/useAnalytics.ts';
import { useUIStore } from '../../stores/ui.ts';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const { theme } = useUIStore();
  useAnalytics();

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleFocus = () => {
    setSidebarOpen(false);
    setFocusMode(v => !v);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Ticker />
      <Header onToggleSidebar={() => setSidebarOpen(v => !v)} focusMode={focusMode} sidebarOpen={sidebarOpen} />
      {!focusMode && (
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}

      <main
        style={{
          paddingTop: 88,
          paddingBottom: 100,
          paddingLeft: focusMode ? 20 : 20,
          paddingRight: 20,
          maxWidth: focusMode ? '100%' : 1280,
          margin: '0 auto',
          transition: 'padding-left .25s cubic-bezier(.4,0,.2,1)',
        }}
        className={`animate-fade-in${focusMode ? '' : ' layout-main'}`}
      >
        <Outlet />
      </main>

      {/* Focus mode banner */}
      {focusMode && (
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 99, background: 'rgba(8,13,24,.92)', border: '1px solid rgba(0,230,118,.2)', backdropFilter: 'blur(16px)', boxShadow: '0 4px 32px rgba(0,0,0,.4)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,.8)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', letterSpacing: '.08em' }}>FOCUS MODE</span>
          <button onClick={toggleFocus} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#00e676', padding: '0 0 0 6px' }}>
            Exit <i className="fa-solid fa-xmark" style={{ fontSize: 9 }} />
          </button>
        </div>
      )}
    </div>
  );
}
