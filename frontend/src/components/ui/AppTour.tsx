import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/ui';

const TOUR_KEY = 'gf_tour_v1';
const PAD = 12;
const CARD_W = 316;

// Amber — deliberately different from the app's green brand; signals premium/special
const A = '#C8A45A';           // amber base
const A_DIM = 'rgba(200,164,90,.42)';


interface Step {
  target: string | null;
  label: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: '[data-tour="sidebar"]',
    label: 'Navigation',
    title: 'Your Command Centre',
    body: 'Every section of the app lives in this panel — markets, charts, AI tools, paper trading, and your account. Select any item to begin exploring.',
  },
  {
    target: '[data-tour="bottom-nav"]',
    label: 'Navigation',
    title: 'Always Within Reach',
    body: 'These four tabs keep Markets, Charts, AI Chat, and Learning at your fingertips at all times. Always visible at the bottom of the screen.',
  },
  {
    target: '[data-tour="search"]',
    label: 'Search',
    title: 'Find Any Stock Instantly',
    body: 'Type a company name or ticker — NCB, GK, AAPL, TSLA — to pull up live prices, charts, and market data in seconds.',
  },
  {
    target: '[data-tour="floating-ai"]',
    label: 'AI Advisor',
    title: 'Your Personal Advisor',
    body: 'Tap the button at any moment to consult Gotham AI. Ask about stocks, chart patterns, market conditions, or any financial concept.',
  },
  {
    target: null,
    label: 'Ready',
    title: "You're Ready to Go",
    body: "The platform is yours. Each section opens with a brief guide the first time you visit. Take your time, explore freely.",
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

function queryRect(selector: string | null): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function cardPos(rect: Rect | null, vw: number, vh: number): React.CSSProperties {
  const base: React.CSSProperties = { position: 'fixed', width: CARD_W, zIndex: 10010 };
  if (!rect) {
    return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
  const sp = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    right: rect.left + rect.width + PAD,
    bottom: rect.top + rect.height + PAD,
  };
  if (sp.bottom + 260 < vh) {
    const l = Math.max(12, Math.min(rect.left + rect.width / 2 - CARD_W / 2, vw - CARD_W - 12));
    return { ...base, top: sp.bottom + 16, left: l };
  }
  if (sp.right + CARD_W + 20 < vw) {
    const t = Math.max(12, Math.min(rect.top + rect.height / 2 - 120, vh - 270));
    return { ...base, top: t, left: sp.right + 16 };
  }
  if (sp.top > 270) {
    const l = Math.max(12, Math.min(rect.left + rect.width / 2 - CARD_W / 2, vw - CARD_W - 12));
    return { ...base, bottom: vh - sp.top + 16, left: l };
  }
  if (sp.left > CARD_W + 20) {
    const t = Math.max(12, Math.min(rect.top + rect.height / 2 - 120, vh - 270));
    return { ...base, top: t, right: vw - sp.left + 16, left: 'auto' };
  }
  return { ...base, bottom: 90, left: '50%', transform: 'translateX(-50%)' };
}

// Grain texture data URI for card depth
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`;

export default function AppTour() {
  const location = useLocation();
  const authModalOpen = useUIStore(s => s.authModalOpen);
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const rafRef = useRef<number | null>(null);

  const path = '/' + (location.pathname.split('/')[1] ?? '');

  useEffect(() => {
    if (path !== '/') return;
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => setActive(true), 2200);
    return () => clearTimeout(t);
  }, [path]);

  useEffect(() => {
    const fn = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const visibleSteps = STEPS.filter(s =>
    s.target === null || !!document.querySelector(s.target)
  );

  const step = visibleSteps[stepIdx];

  useEffect(() => {
    if (!active || !step) return;
    const update = () => {
      setRect(queryRect(step.target));
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, step]);

  const done = useCallback(() => {
    localStorage.setItem(TOUR_KEY, '1');
    setActive(false);
  }, []);

  const next = useCallback(() => {
    if (stepIdx < visibleSteps.length - 1) setStepIdx(i => i + 1);
    else done();
  }, [stepIdx, visibleSteps.length, done]);

  // Pause the tour while the auth modal is open so it never covers sign-in.
  if (!active || !step || authModalOpen) return null;

  const isLast = stepIdx === visibleSteps.length - 1;
  const OVL = 'rgba(var(--surf),.88)';
  const numStr = String(stepIdx + 1).padStart(2, '0');
  const totStr = String(visibleSteps.length).padStart(2, '0');

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

        @keyframes tourIn {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes contentFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes ringBreath {
          0%, 100% { opacity: .42; }
          50%       { opacity: .72; }
        }
        .tour-next-btn:hover { opacity: .8; }
        .tour-back-btn:hover { color: rgba(237,235,230,.6) !important; }
        .tour-dot:hover { opacity: .7 !important; }
        .tour-skip:hover { color: rgba(237,235,230,.5) !important; }
      `}</style>

      {/* ── Overlay panels (spotlight cutout) ── */}
      {rect ? (
        <>
          <div onClick={done} style={{ position:'fixed', top:0, left:0, right:0, height:Math.max(0,rect.top-PAD), background:OVL, zIndex:10000 }} />
          <div onClick={done} style={{ position:'fixed', left:0, right:0, top:rect.top+rect.height+PAD, bottom:0, background:OVL, zIndex:10000 }} />
          <div onClick={done} style={{ position:'fixed', left:0, width:Math.max(0,rect.left-PAD), top:rect.top-PAD, height:rect.height+PAD*2, background:OVL, zIndex:10000 }} />
          <div onClick={done} style={{ position:'fixed', left:rect.left+rect.width+PAD, right:0, top:rect.top-PAD, height:rect.height+PAD*2, background:OVL, zIndex:10000 }} />
          {/* Amber hairline ring — no glow, just precision */}
          <div style={{
            position:'fixed', zIndex:10001, pointerEvents:'none',
            top:rect.top-PAD-1, left:rect.left-PAD-1,
            width:rect.width+PAD*2+2, height:rect.height+PAD*2+2,
            borderRadius:10,
            border:`1.5px solid ${A}`,
            animation:'ringBreath 2.4s ease-in-out infinite',
          }} />
        </>
      ) : (
        <div onClick={done} style={{ position:'fixed', inset:0, background:OVL, zIndex:10000 }} />
      )}

      {/* ── Tour card ── */}
      <div style={{
        ...cardPos(rect, vp.w, vp.h),
        background:'var(--color-bg2)',
        backgroundImage:GRAIN,
        border:'1px solid rgba(var(--fg),.07)',
        borderRadius:14,
        boxShadow:'0 32px 80px rgba(0,0,0,.75), 0 1px 0 rgba(var(--fg),.04) inset',
        overflow:'hidden',
        animation:'tourIn .38s cubic-bezier(.22,1,.36,1)',
      }}>

        {/* Amber progress line — hairline, not chunky */}
        <div style={{ height:1.5, background:'rgba(var(--fg),.04)' }}>
          <div style={{
            height:'100%',
            width:`${((stepIdx+1)/visibleSteps.length)*100}%`,
            background:A,
            transition:'width .4s cubic-bezier(.4,0,.2,1)',
          }} />
        </div>

        {/* Card content — keyed so it fades on step change */}
        <div key={stepIdx} style={{ padding:'22px 24px 20px', animation:'contentFade .28s cubic-bezier(.22,1,.36,1)' }}>

          {/* Step counter + close */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            <span style={{
              fontFamily:"'DM Mono', monospace",
              fontSize:10, fontWeight:500, letterSpacing:'.18em',
              color:A,
            }}>
              — {numStr}&nbsp;&nbsp;of&nbsp;&nbsp;{totStr}
            </span>
            <button
              onClick={done}
              className="tour-skip"
              style={{
                background:'none', border:'none', cursor:'pointer', padding:'2px 4px',
                color:'rgba(237,235,230,.28)', fontSize:16, lineHeight:1,
                fontFamily:'system-ui', transition:'color .15s',
              }}>
              ×
            </button>
          </div>

          {/* Title — serif, distinguished */}
          <h2 style={{
            margin:'0 0 10px',
            fontFamily:"'Cormorant Garamond', Georgia, serif",
            fontSize:22, fontWeight:500, letterSpacing:'-.01em', lineHeight:1.2,
            color:'#EDEBE6',
          }}>
            {step.title}
          </h2>

          {/* Body */}
          <p style={{
            margin:'0 0 22px',
            fontSize:12.5, lineHeight:1.78,
            color:'rgba(237,235,230,.45)',
            fontFamily:'var(--font-sans, system-ui)',
          }}>
            {step.body}
          </p>

          {/* Bottom row: dots + navigation */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>

            {/* Step dots */}
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              {visibleSteps.map((_, i) => (
                <button
                  key={i}
                  className="tour-dot"
                  onClick={() => setStepIdx(i)}
                  style={{
                    width: i === stepIdx ? 16 : 5,
                    height: 5,
                    borderRadius: 99,
                    background: i === stepIdx ? A : i < stepIdx ? A_DIM : 'rgba(var(--fg),.14)',
                    border: 'none', padding: 0, cursor: 'pointer',
                    transition: 'all .3s cubic-bezier(.4,0,.2,1)',
                    opacity: i === stepIdx ? 1 : undefined,
                  }}
                />
              ))}
            </div>

            {/* Navigation buttons — text-forward, no filled backgrounds */}
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              {stepIdx > 0 && (
                <button
                  className="tour-back-btn"
                  onClick={() => setStepIdx(i => i - 1)}
                  style={{
                    background:'none', border:'none', cursor:'pointer', padding:0,
                    fontFamily:"'DM Mono', monospace",
                    fontSize:11, fontWeight:500, letterSpacing:'.08em',
                    color:'rgba(237,235,230,.28)', transition:'color .15s',
                  }}>
                  ← back
                </button>
              )}
              <button
                className="tour-next-btn"
                onClick={next}
                style={{
                  background:'none', border:'none', cursor:'pointer', padding:0,
                  fontFamily:"'DM Mono', monospace",
                  fontSize:11, fontWeight:500, letterSpacing:'.08em',
                  color:A, transition:'opacity .15s',
                }}>
                {isLast ? 'begin →' : 'next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
