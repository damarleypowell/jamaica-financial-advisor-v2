import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { apiPost } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../stores/ui';

// ── Tour steps ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    icon: '📈',
    color: '#00e676',
    tag: 'Welcome to Gotham Financial',
    title: 'Your Caribbean investment platform',
    body: 'Gotham Financial lets you track stocks on the Jamaica Stock Exchange (JSE) and US markets — all in one place. See live prices, set alerts, paper trade, and get AI-powered analysis.',
    cta: 'Show me around',
  },
  {
    icon: '🏠',
    color: '#40c4ff',
    tag: 'Feature 1 — Dashboard',
    title: 'The Dashboard is your home base',
    body: 'When you open the app you land here. It shows every JSE stock with live prices, percentage change, and trading volume. You can search for any stock by name or ticker (e.g. "NCB" or "GK").',
    cta: 'Next',
  },
  {
    icon: '📊',
    color: '#40c4ff',
    tag: 'Feature 2 — Charts',
    title: 'Analyse any stock with charts',
    body: 'Open any stock to see its full price chart — candlestick, line, or bar. You can overlay indicators like moving averages, RSI, and Bollinger Bands to spot trends and entry points.',
    cta: 'Next',
  },
  {
    icon: '⭐',
    color: '#ffd740',
    tag: 'Feature 3 — Watchlists',
    title: 'Save stocks you care about',
    body: 'Add stocks to a Watchlist so you can monitor them without scrolling through the full market. Create multiple lists — e.g. "JSE Banking" or "US Tech" — and check them at a glance.',
    cta: 'Next',
  },
  {
    icon: '🔔',
    color: '#ffd740',
    tag: 'Feature 4 — Price Alerts',
    title: 'Get notified at your target price',
    body: 'Set a price alert on any stock. When the stock hits your target — either above or below — Gotham sends you an email notification so you never miss a move while you\'re away.',
    cta: 'Next',
  },
  {
    icon: '🧪',
    color: '#ce93d8',
    tag: 'Feature 5 — Paper Trading',
    title: 'Practice investing risk-free',
    body: 'Paper trading means you invest with virtual money — no real cash at risk. Place buy and sell orders, build a portfolio, and track your performance. Perfect for learning how markets work before you invest real money.',
    cta: 'Next',
  },
  {
    icon: '🤖',
    color: '#ce93d8',
    tag: 'Feature 6 — AI Advisor',
    title: 'Ask anything, get expert answers',
    body: 'Gotham AI is your personal financial advisor. Ask "Is NCB a good buy right now?", "What\'s the difference between a stock and a bond?", or "What is my portfolio risk level?" — and get a detailed, intelligent answer instantly.',
    cta: 'Next',
  },
  {
    icon: '📰',
    color: '#00e676',
    tag: 'Feature 7 — News',
    title: 'Stay current on the market',
    body: 'The News feed shows the latest JSE and US market news in real time. Each article is tagged with the stocks it affects so you can see immediately how news might impact your holdings.',
    cta: 'Next',
  },
  {
    icon: '🎓',
    color: '#00e676',
    tag: 'Feature 8 — Learn',
    title: 'Learn to invest at your own pace',
    body: 'New to investing? The Learn section has structured courses: "Caribbean Stock Market Basics", "Technical Analysis", "US Markets", and "Building Your First Portfolio". Each lesson ends with a graded quiz.',
    cta: 'Next',
  },
  {
    icon: '💳',
    color: '#ffd740',
    tag: 'Plans & Pricing',
    title: 'What\'s free, what\'s paid',
    body: 'The Dashboard is free for everyone. Upgrade to BASIC ($19.99/mo) for charts, watchlists, alerts, paper trading, news, and US stocks. Upgrade to PRO ($99.99/mo) for unlimited AI chat, AI analysis, and ML predictions.',
    cta: 'Got it — take me in',
  },
];

export default function Onboarding() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const openAuthModal = useUIStore(s => s.openAuthModal);
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  async function finish() {
    try {
      await apiPost('/api/users/onboarding', { completed: true });
      if (user) setUser({ ...user, onboardingCompleted: true });
    } catch { /* silent */ }
    navigate('/');
  }

  function next() {
    if (isLast) { finish(); return; }
    setStep(s => s + 1);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #04060d 0%, #081410 50%, #04060d 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 0 40px', position: 'relative', overflow: 'hidden',
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 400, borderRadius: '50%',
        background: `${current.color}18`, filter: 'blur(120px)',
        pointerEvents: 'none', transition: 'background 500ms',
      }} />

      {/* Logo + skip */}
      <div style={{ width: '100%', maxWidth: 480, padding: '52px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(0,230,118,.12)', border: '1px solid rgba(0,230,118,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18 }}>
              <path d="M3 17L7 12L11 14.5L16 9L21 5" stroke="#00e676" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="21" cy="5" r="2.2" fill="#00e676"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 900, letterSpacing: '.12em', color: '#00e676', lineHeight: 1 }}>GOTHAM</p>
            <p style={{ margin: 0, fontSize: 7.5, fontWeight: 600, letterSpacing: '.3em', color: 'rgba(255,255,255,.3)', lineHeight: 1, marginTop: 2 }}>FINANCIAL</p>
          </div>
        </div>
        <button
          onClick={finish}
          style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          Skip tour
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 480, padding: '24px 28px 0', position: 'relative', zIndex: 2 }}>
        <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: 99,
            background: current.color,
            transition: 'width 400ms cubic-bezier(.4,0,.2,1), background 400ms',
            boxShadow: `0 0 8px ${current.color}60`,
          }} />
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,.3)', textAlign: 'right' }}>
          {step + 1} / {STEPS.length}
        </p>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 28px', maxWidth: 480, width: '100%', position: 'relative', zIndex: 2,
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          fontSize: 52, marginBottom: 28,
          filter: 'drop-shadow(0 0 20px rgba(255,255,255,.1))',
        }}>
          {current.icon}
        </div>

        {/* Tag */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 99,
          fontSize: 10, fontWeight: 800, letterSpacing: '.08em',
          color: current.color, background: `${current.color}12`,
          border: `1px solid ${current.color}28`,
          marginBottom: 18, transition: 'all 400ms',
        }}>
          {current.tag}
        </span>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(24px, 6vw, 34px)', fontWeight: 900,
          color: '#fff', lineHeight: 1.2, letterSpacing: '-0.025em',
          margin: '0 0 16px',
        }}>
          {current.title}
        </h1>

        {/* Body */}
        <p style={{
          fontSize: 15, color: 'rgba(255,255,255,.55)',
          lineHeight: 1.7, margin: 0, maxWidth: 380,
        }}>
          {current.body}
        </p>
      </div>

      {/* Bottom controls */}
      <div style={{ width: '100%', maxWidth: 420, padding: '0 28px', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 2 }}>

        {/* Dot indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 99, border: 'none',
                cursor: 'pointer', padding: 0,
                background: i === step ? current.color : i < step ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.12)',
                transition: 'all 280ms',
                boxShadow: i === step ? `0 0 8px ${current.color}60` : 'none',
              }} />
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={next}
          style={{
            width: '100%', padding: '16px', borderRadius: 16,
            background: `linear-gradient(135deg, ${current.color}, ${current.color}cc)`,
            border: 'none', color: '#04060d', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: `0 4px 28px ${current.color}45`,
            transition: 'all 200ms',
          }}>
          {current.cta}
        </button>

        {/* Secondary: sign in / sign up */}
        {step === 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { openAuthModal('login'); navigate('/'); }}
              style={{ flex: 1, padding: '13px', borderRadius: 14, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.65)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms' }}>
              Log In
            </button>
            <button
              onClick={() => { openAuthModal('signup'); navigate('/'); }}
              style={{ flex: 1, padding: '13px', borderRadius: 14, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.25)', color: '#00e676', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms' }}>
              Sign Up
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
