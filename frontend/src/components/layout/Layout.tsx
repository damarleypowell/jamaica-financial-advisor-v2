import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Ticker from './Ticker.tsx';
import Header from './Header.tsx';
import Sidebar from './Sidebar.tsx';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      <Ticker />
      <Header onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <main
        className={
          'min-h-screen pt-[100px] pb-6 px-4 md:px-6 ' +
          'md:ml-[260px] ' +   /* desktop: offset for sidebar */
          'mb-[60px] md:mb-0'  /* mobile: offset for bottom nav */
        }
      >
        <div className="max-w-[1600px] mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
