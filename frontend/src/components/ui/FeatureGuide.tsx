import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';

const GUIDE_KEY = (path: string) => `gf_guide_v1_${path.replace(/\//g, '_') || 'home'}`;
const TOUR_KEY = 'gf_tour_v1';

interface GuideConfig {
  title: string;
  intro: string;
  tips: string[];
}

const GUIDES: Record<string, GuideConfig> = {
  '/': {
    title: 'Welcome to your Dashboard',
    intro: "This is your home base. You can see live prices for every stock on the Jamaica Stock Exchange and US markets right here. Use the search bar at the top to look up any stock by name or ticker symbol. The market toggle lets you switch between Caribbean and US markets.",
    tips: ['Search for NCB, GK, or SVL to see JSE stocks', 'Switch to US Markets to see Apple, Tesla, and more', 'Click any stock to open a detailed chart'],
  },
  '/technicals': {
    title: 'Welcome to Charts',
    intro: "Charts let you analyse any stock's price history visually. Select a stock from the left panel, then switch between timeframes — 1 day, 1 week, 1 month, or longer. You can add technical indicators like moving averages and RSI to spot trends and entry points.",
    tips: ['Click a stock name to load its chart', 'Use the timeframe buttons to zoom in or out', 'RSI above 70 means overbought, below 30 means oversold'],
  },
  '/watchlists': {
    title: 'Welcome to Watchlists',
    intro: "Watchlists let you save stocks you're interested in so you can monitor them without scrolling through the whole market. Create multiple lists — for example one for JSE banking stocks and another for US tech stocks — and check them at a glance every day.",
    tips: ['Tap the star icon on any stock to add it here', 'Create multiple lists to organise your picks', 'Watchlists sync across your devices'],
  },
  '/portfolio': {
    title: 'Welcome to Paper Trading',
    intro: "Paper trading means you invest with virtual money — no real cash at risk. This is the safest way to learn how markets work before you put in real money. Place buy and sell orders, build a virtual portfolio, and track how well your picks perform over time.",
    tips: ['Start with J$1,000,000 of virtual cash', 'Buy low, sell high — practice your strategy risk-free', 'Track your portfolio performance over time'],
  },
  '/orders': {
    title: 'Welcome to Order History',
    intro: "Every buy and sell you make in paper trading is recorded here. You can review your past decisions, see your wins and losses, and learn from your trading history.",
    tips: ['Filter by date or stock symbol', 'Review your best and worst trades', 'Use this to refine your strategy'],
  },
  '/alerts': {
    title: 'Welcome to Price Alerts',
    intro: "Set a target price on any stock — either above or below the current price — and Gotham will send you an email notification the moment it hits that level. This way you never miss a move while you're away from the app.",
    tips: ['Set an alert above current price to catch breakouts', 'Set an alert below to catch dips and buy opportunities', 'You can have multiple alerts on the same stock'],
  },
  '/news': {
    title: 'Welcome to Market News',
    intro: "This feed shows the latest news from the Jamaica Stock Exchange, Caribbean markets, and US markets in real time. Each article is tagged to the stocks it mentions, so you can see immediately how news might affect your holdings.",
    tips: ['News is updated every few minutes', 'Click an article to read the full story', 'Look for stocks mentioned to spot opportunities'],
  },
  '/learn': {
    title: 'Welcome to the Learning Academy',
    intro: "The Learn section has structured courses designed for Caribbean investors — from complete beginners to experienced traders. Each lesson ends with a short quiz to test what you learned. You can come back and continue from where you left off any time.",
    tips: ['Start with Course 1 if you\'re new to investing', 'Complete the quizzes to earn progress badges', 'Live exercises use real JSE data'],
  },
  '/chat': {
    title: 'Welcome to AI Chat',
    intro: "I'm Gotham AI, your personal financial advisor. Ask me anything — about specific stocks, how to read a chart, what a financial term means, whether now is a good time to invest, or how to build a portfolio. I'll give you a detailed, educational answer instantly.",
    tips: ['Try asking: Is NCB a good buy right now?', 'Ask: What is a P/E ratio and why does it matter?', 'Ask: How do I read a candlestick chart?'],
  },
  '/analysis': {
    title: 'Welcome to AI Analysis',
    intro: "AI Analysis generates a full research report on any stock — covering price technicals, recent performance, sector context, and key risk factors. It's like having a professional analyst on demand.",
    tips: ['Type a stock symbol to generate a report', 'Reports cover both JSE and US stocks', 'Use this before making any trading decision'],
  },
  '/screener': {
    title: 'Welcome to the Stock Screener',
    intro: "The Screener lets you filter stocks by criteria like price range, percentage change, volume, and sector. Instead of browsing the whole market, you set your filters and the Screener shows you only the stocks that match your strategy.",
    tips: ['Filter by sector to compare banking stocks', 'Sort by % change to find today\'s movers', 'Combine filters to find hidden opportunities'],
  },
  '/us-stocks': {
    title: 'Welcome to US Stocks',
    intro: "US Stocks gives you access to companies listed on the New York Stock Exchange and Nasdaq — Apple, Tesla, Amazon, Google, and hundreds more. You can track them alongside your JSE stocks in one place.",
    tips: ['US markets trade 9:30 AM to 4:00 PM Eastern Time', 'Search by ticker or company name', 'Compare US tech giants side by side'],
  },
  '/subscription': {
    title: 'Your Subscription Plan',
    intro: "This is where you manage your Gotham Financial plan. Free users get the dashboard and learning content. Upgrade to Core for full market access, the screener, watchlists, and alerts. Upgrade to Pro for unlimited AI chat, the voice agent, and machine learning predictions.",
    tips: ['Core is $14.99/month — cancel anytime', 'Pro is $49.99/month — full AI features', 'Payments are secure and processed via PayPal'],
  },
};

function speak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();

  const doSpeak = () => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.92;
    utt.pitch = 1.05;
    utt.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('karen') ||
      v.name.toLowerCase().includes('victoria') ||
      v.name.toLowerCase().includes('zira') ||
      (v.lang.startsWith('en') && v.name.toLowerCase().includes('google'))
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;
    utt.onerror = () => onEnd?.();
    if (onEnd) utt.onend = onEnd;
    window.speechSynthesis.speak(utt);
  };

  // Voices may not be loaded yet — wait for them
  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak();
    };
  }
}

export default function FeatureGuide() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const authModalOpen = useUIStore(s => s.authModalOpen);
  const [guide, setGuide] = useState<GuideConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const path = '/' + (location.pathname.split('/')[1] ?? '');

  useEffect(() => {
    // Reset first-run guide state whenever the route changes — intentional sync resets.
    /* eslint-disable react-hooks/set-state-in-effect */
    setDismissed(false);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setVisible(false);
    /* eslint-enable react-hooks/set-state-in-effect */

    const cfg = GUIDES[path];
    if (!cfg) return;

    const key = GUIDE_KEY(path);
    if (localStorage.getItem(key)) return; // already seen

    // Don't stack on top of other first-run overlays:
    // - while the auth modal is open
    // - on the dashboard until the guided app tour has been completed
    if (authModalOpen) return;
    if (path === '/' && !localStorage.getItem(TOUR_KEY)) return;

    // Show after 1.8s so page finishes loading
    timerRef.current = setTimeout(() => {
      setGuide(cfg);
      setVisible(true);
    }, 1800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, [path, authModalOpen]);

  const handlePlay = useCallback(() => {
    if (!guide) return;
    setSpeaking(true);
    speak(guide.intro, () => setSpeaking(false));
  }, [guide]);

  const handleDismiss = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setVisible(false);
    setDismissed(true);
    if (guide) localStorage.setItem(GUIDE_KEY(path), '1');
  }, [guide, path]);

  // Voice narration is opt-in — the user taps play. Auto-playing audio on
  // every first page visit is jarring and can violate browser autoplay rules.

  if (!visible || !guide || dismissed || authModalOpen) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 100, left: 20, right: 20,
      maxWidth: 420, margin: '0 auto',
      zIndex: 9990,
      animation: 'slideUp .35s cubic-bezier(.16,1,.3,1)',
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); }
          50%       { transform: scaleY(1); }
        }
      `}</style>

      <div style={{
        background: 'rgba(6,10,18,.97)',
        border: '1px solid rgba(0,230,118,.25)',
        borderRadius: 20,
        boxShadow: '0 8px 48px rgba(0,0,0,.7), 0 0 0 1px rgba(0,230,118,.08)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,.05)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'linear-gradient(135deg, rgba(0,230,118,.08) 0%, transparent 60%)',
        }}>
          {/* AI avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,200,83,.25), rgba(0,230,118,.1))',
            border: '1px solid rgba(0,230,118,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: speaking ? '0 0 16px rgba(0,230,118,.4)' : 'none',
            transition: 'box-shadow .3s',
          }}>
            {/* Sound wave bars when speaking */}
            {speaking ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 18 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    width: 3, height: '100%', borderRadius: 99,
                    background: '#00e676',
                    animation: `wave .8s ${i * 0.12}s ease-in-out infinite`,
                    transformOrigin: 'center',
                  }} />
                ))}
              </div>
            ) : (
              <i className="fa-solid fa-robot" style={{ fontSize: 16, color: '#00e676' }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
              {guide.title}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(0,230,118,.7)', fontWeight: 600 }}>
              {user ? `Hey ${user.name?.split(' ')[0] ?? 'there'} · ` : ''}Gotham AI Guide
            </p>
          </div>

          {/* Play/stop button */}
          <button
            onClick={speaking ? () => { window.speechSynthesis?.cancel(); setSpeaking(false); } : handlePlay}
            style={{
              width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: speaking ? 'rgba(255,82,82,.15)' : 'rgba(0,230,118,.12)',
              color: speaking ? '#ff5252' : '#00e676',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s', flexShrink: 0,
            }}>
            <i className={`fa-solid ${speaking ? 'fa-stop' : 'fa-play'}`} style={{ fontSize: 11 }} />
          </button>

          <button
            onClick={handleDismiss}
            style={{
              width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,.07)',
              background: 'rgba(255,255,255,.04)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,.4)', transition: 'all .15s', flexShrink: 0,
            }}>
            <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.65 }}>
            {guide.intro}
          </p>

          {/* Quick tips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {guide.tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
                <span style={{ color: '#00e676', fontSize: 10, marginTop: 2, flexShrink: 0 }}>▸</span>
                {tip}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px 14px',
          display: 'flex', gap: 8,
        }}>
          <button
            onClick={() => { handleDismiss(); navigate('/chat'); }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '10px 0', borderRadius: 12, cursor: 'pointer',
              background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)',
              color: '#00e676', fontSize: 12, fontWeight: 700,
              transition: 'all .15s',
            }}>
            <i className="fa-solid fa-robot" style={{ fontSize: 11 }} />
            Ask Gotham AI
          </button>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12,
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
              color: 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all .15s',
            }}>
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}
