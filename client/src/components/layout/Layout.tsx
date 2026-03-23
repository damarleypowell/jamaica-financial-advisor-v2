import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useSSE } from '@/hooks/useSSE';
import { useAuth } from '@/context/AuthContext';
import LoginModal from '@/components/auth/LoginModal';
import SignupModal from '@/components/auth/SignupModal';
import TwoFactorModal from '@/components/auth/TwoFactorModal';
import type { Stock } from '@/types';
import { fmt, fmtPercent, changeColor } from '@/utils/formatters';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/sectors': 'Sectors',
  '/news': 'Market News',
  '/leaderboard': 'Leaderboard',
  '/dividends': 'Dividends',
  '/currency-impact': 'Currency Impact',
  '/portfolio': 'Portfolio',
  '/orders': 'Orders',
  '/watchlists': 'Watchlists',
  '/alerts': 'Alerts & Notifications',
  '/us-stocks': 'US Stocks',
  '/technicals': 'Technical Analysis',
  '/screener': 'Stock Screener',
  '/analytics': 'Analytics',
  '/ai-chat': 'AI Chat',
  '/settings': 'Settings',
  '/subscription': 'Subscription',
  '/admin': 'Admin',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null);
  const location = useLocation();
  const { needs2FA } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { stocks } = useSSE();

  const title = PAGE_TITLES[location.pathname] || 'Gotham Financial';

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.fillStyle = 'rgba(0, 200, 83, 0.15)';

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas!.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas!.height) p.vy *= -1;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Draw connections
      ctx!.strokeStyle = 'rgba(0, 200, 83, 0.03)';
      ctx!.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const tickerStocks = stocks.length > 0 ? stocks : [];

  const handleLoginClick = useCallback(() => setAuthModal('login'), []);

  return (
    <div className="min-h-screen bg-bg relative">
      {/* Ambient background */}
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-orb ambient-orb-3" />
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

      {/* Ticker Bar */}
      {tickerStocks.length > 0 && (
        <div className="ticker-bar fixed top-0 left-0 right-0 h-8 z-40 overflow-hidden flex items-center">
          <div className="animate-ticker flex items-center gap-8 whitespace-nowrap">
            {[...tickerStocks, ...tickerStocks].map((s: Stock, i: number) => (
              <span key={`${s.symbol}-${i}`} className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-text-primary">{s.symbol}</span>
                <span className="font-num text-text-secondary">{fmt(s.price)}</span>
                <span className={`font-num ${changeColor(s.changePercent)}`}>
                  {fmtPercent(s.changePercent)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className={`lg:ml-[260px] ${tickerStocks.length > 0 ? 'pt-8' : ''} relative z-10`}>
        <Header
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          onLoginClick={handleLoginClick}
        />
        <main className="p-4 lg:p-6 animate-fadeIn min-h-[calc(100vh-3.5rem)]">
          <Outlet />
        </main>
      </div>

      {/* Auth Modals */}
      {authModal === 'login' && (
        <LoginModal
          onClose={() => setAuthModal(null)}
          onSwitchToSignup={() => setAuthModal('signup')}
        />
      )}
      {authModal === 'signup' && (
        <SignupModal
          onClose={() => setAuthModal(null)}
          onSwitchToLogin={() => setAuthModal('login')}
        />
      )}
      {needs2FA && <TwoFactorModal onClose={() => {}} />}
    </div>
  );
}
