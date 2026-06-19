import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { apiPost } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../stores/ui';

const SANS = "'DM Sans', 'Inter', system-ui, sans-serif";

const STEPS = [
  {
    emoji: '🌱',
    color: '#00e676',
    tag: 'Welcome',
    title: 'Plant Your Wealth',
    body: 'Gotham is your Caribbean investment companion — live JSE & US stock data, AI-powered advice, and a gamified path from Seed to Wealth Master.',
    cta: 'Let\'s go',
    features: [
      { icon: 'fa-chart-line', label: 'JSE + US Markets' },
      { icon: 'fa-robot',      label: 'AI Advisor'       },
      { icon: 'fa-seedling',   label: 'Wealth Score'     },
    ],
  },
  {
    emoji: '🏆',
    color: '#ffd740',
    tag: 'How it works',
    title: 'Your Wealth, Your Way',
    body: 'Invest in Caribbean and global stocks. Track your portfolio. Earn XP, complete missions, and climb from 🌱 Seed to 👑 Wealth Master — all at your own pace.',
    cta: 'What\'s my goal?',
    ranks: [
      { emoji: '🌱', name: 'Seed',         range: '0–19 pts'   },
      { emoji: '🌿', name: 'Sapling',      range: '20–39 pts'  },
      { emoji: '🌳', name: 'Grower',       range: '40–59 pts'  },
      { emoji: '🏗️',  name: 'Builder',      range: '60–79 pts'  },
      { emoji: '👑', name: 'Wealth Master', range: '80–100 pts' },
    ],
  },
  {
    emoji: '🎯',
    color: '#40c4ff',
    tag: 'Set Your Goal',
    title: 'What are you building toward?',
    body: 'Whether it\'s J$50K this year or financial freedom in 10 years — Gotham helps you build a plan and track every milestone.',
    cta: 'Start for free',
    goals: [
      'Save for a major purchase',
      'Build a retirement nest egg',
      'Earn passive income from dividends',
      'Grow generational wealth',
    ],
  },
];

// Plain-language affirmation shown once a goal is picked (personalization).
const GOAL_AFFIRMATION = [
  'Smart — we\'ll help you set a target and stay on track.',
  'Great — we\'ll surface dividend-paying and long-term picks.',
  'Nice — we\'ll highlight steady income opportunities.',
  'Bold — we\'ll help you think in decades, not days.',
];

export default function Onboarding() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const openAuthModal = useUIStore(s => s.openAuthModal);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);          // animation direction
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  async function finish() {
    localStorage.setItem('gf_onboarded', '1');
    // Persist the chosen goal so the dashboard / planner can personalize later.
    const goals = STEPS[2].goals;
    if (selectedGoal !== null && goals) localStorage.setItem('gf_goal', goals[selectedGoal]);
    try {
      await apiPost('/api/users/onboarding', { completed: true });
      if (user) setUser({ ...user, onboardingCompleted: true });
    } catch { /* silent — guests aren't authenticated yet */ }
    navigate('/');
  }

  function next() {
    if (isLast) { finish(); return; }
    setDir(1);
    setStep(s => s + 1);
  }

  function back() {
    if (step === 0) return;
    setDir(-1);
    setStep(s => s - 1);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--color-bg) 0%, var(--color-bg2) 50%, var(--color-bg) 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 0 env(safe-area-inset-bottom, 32px)', position: 'relative', overflow: 'hidden',
      fontFamily: SANS,
    }}>
      <style>{`
        @keyframes obSlideIn {
          from { opacity: 0; transform: translateX(var(--ob-from)); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes obFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ob-cta:active { transform: scale(.98); }
        .ob-back:hover { color: #fff !important; background: rgba(var(--fg),.06) !important; }
        .ob-skip:hover { color: rgba(var(--fg),.6) !important; }
      `}</style>

      {/* ── Top progress bar (research: a progress bar alone lifts completion ~20%) ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(var(--fg),.06)', zIndex: 4 }}>
        <div style={{
          height: '100%', width: `${progress}%`, background: current.color,
          boxShadow: `0 0 12px ${current.color}`,
          transition: 'width .45s cubic-bezier(.22,1,.36,1), background .6s ease',
        }} />
      </div>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 400, borderRadius: '50%',
        background: `${current.color}14`, filter: 'blur(100px)',
        pointerEvents: 'none', transition: 'background 600ms ease',
      }} />

      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: 480, padding: '56px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {step > 0 && (
            <button
              onClick={back}
              aria-label="Go back"
              className="ob-back"
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: 'rgba(var(--fg),.04)', border: '1px solid rgba(var(--fg),.08)',
                color: 'rgba(var(--fg),.55)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color .15s, background .15s',
              }}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: 13 }} />
            </button>
          )}
          <div className="gf-wordmark">
            <p style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '.14em', color: '#00e676', lineHeight: 1 }}>GOTHAM</p>
            <p style={{ margin: 0, fontSize: 7.5, fontWeight: 600, letterSpacing: '.34em', color: 'rgba(var(--fg),.3)', lineHeight: 1, marginTop: 3, paddingLeft: '.34em' }}>FINANCIAL</p>
          </div>
        </div>
        <button onClick={finish} className="ob-skip" style={{ fontSize: 13, color: 'rgba(var(--fg),.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS, padding: '8px 0', transition: 'color .15s' }}>
          Skip
        </button>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 6, marginTop: 24, position: 'relative', zIndex: 2 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 24 : 6, height: 6, borderRadius: 99,
            background: i === step ? current.color : i < step ? 'rgba(var(--fg),.3)' : 'rgba(var(--fg),.1)',
            transition: 'all 300ms cubic-bezier(.4,0,.2,1)',
            boxShadow: i === step ? `0 0 8px ${current.color}70` : 'none',
          }} />
        ))}
      </div>

      {/* Main content — keyed so it animates on every step change */}
      <div
        key={step}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '28px 24px', maxWidth: 480, width: '100%', position: 'relative', zIndex: 2,
          textAlign: 'center',
          ['--ob-from' as string]: dir === 1 ? '24px' : '-24px',
          animation: 'obSlideIn .4s cubic-bezier(.22,1,.36,1)',
        }}>
        {/* Emoji */}
        <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1, filter: 'drop-shadow(0 0 24px rgba(var(--fg),.08))' }}>
          {current.emoji}
        </div>

        {/* Tag */}
        <span style={{
          display: 'inline-block', padding: '4px 12px', borderRadius: 99,
          fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
          color: current.color, background: `${current.color}12`,
          border: `1px solid ${current.color}25`,
          marginBottom: 14,
        }}>
          {current.tag}
        </span>

        {/* Title */}
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 'clamp(26px, 7vw, 34px)', fontWeight: 700,
          color: 'rgba(var(--fg),1)', lineHeight: 1.15, letterSpacing: '-0.01em',
          margin: '0 0 14px',
          WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility',
        }}>
          {current.title}
        </h1>

        {/* Body */}
        <p style={{ fontSize: 15, color: 'rgba(var(--fg),.5)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 360 }}>
          {current.body}
        </p>

        {/* Step 1: Feature pills */}
        {step === 0 && current.features && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {current.features.map(f => (
              <div key={f.label} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 12,
                background: 'rgba(0,230,118,.07)', border: '1px solid rgba(0,230,118,.18)',
                fontSize: 13, fontWeight: 700, color: '#00e676',
              }}>
                <i className={`fa-solid ${f.icon}`} style={{ fontSize: 12 }} />
                {f.label}
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Rank ladder */}
        {step === 1 && current.ranks && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {current.ranks.map((r, i) => (
              <div key={r.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 12,
                background: i === 0 ? 'rgba(0,230,118,.07)' : 'rgba(var(--fg),.03)',
                border: `1px solid ${i === 0 ? 'rgba(0,230,118,.2)' : 'rgba(var(--fg),.06)'}`,
                textAlign: 'left',
              }}>
                <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{r.emoji}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? '#fff' : 'rgba(var(--fg),.5)' }}>{r.name}</span>
                </div>
                <span style={{ fontSize: 10, color: 'rgba(var(--fg),.2)', fontWeight: 700 }}>{r.range}</span>
                {i === 0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#00e676', background: 'rgba(0,230,118,.12)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(0,230,118,.2)' }}>YOU START HERE</span>}
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Goal picker */}
        {step === 2 && current.goals && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {current.goals.map((g, i) => {
              const active = selectedGoal === i;
              return (
                <button key={g} onClick={() => setSelectedGoal(i)} aria-pressed={active} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  background: active ? 'rgba(64,196,255,.1)' : 'rgba(var(--fg),.03)',
                  border: `1px solid ${active ? 'rgba(64,196,255,.3)' : 'rgba(var(--fg),.07)'}`,
                  transition: 'all .15s',
                  fontFamily: SANS,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${active ? '#40c4ff' : 'rgba(var(--fg),.2)'}`,
                    background: active ? '#40c4ff' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s',
                  }}>
                    {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-bg)' }} />}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: active ? '#fff' : 'rgba(var(--fg),.55)' }}>{g}</span>
                </button>
              );
            })}
            {selectedGoal !== null && (
              <p style={{
                margin: '6px 2px 0', fontSize: 12.5, color: '#40c4ff', fontWeight: 600,
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7,
                animation: 'obFadeUp .3s cubic-bezier(.22,1,.36,1)',
              }}>
                <i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: 11 }} />
                {GOAL_AFFIRMATION[selectedGoal]}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ width: '100%', maxWidth: 480, padding: '0 24px 8px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 2 }}>
        {/* Primary CTA */}
        <button
          onClick={next}
          className="ob-cta"
          style={{
            width: '100%', padding: '17px', borderRadius: 16,
            background: current.color,
            border: 'none', color: '#04060d', fontWeight: 900, fontSize: 15,
            cursor: 'pointer', fontFamily: SANS,
            boxShadow: `0 6px 28px ${current.color}40`,
            transition: 'opacity .15s, transform .1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.88'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          {isLast ? 'Start exploring — free' : current.cta}
        </button>

        {/* Auth buttons on last step */}
        {isLast && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { openAuthModal('login'); finish(); }}
              style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'rgba(var(--fg),.06)', border: '1px solid rgba(var(--fg),.1)', color: 'rgba(var(--fg),.7)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
              Log In
            </button>
            <button
              onClick={() => { openAuthModal('signup'); finish(); }}
              style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'rgba(64,196,255,.1)', border: '1px solid rgba(64,196,255,.25)', color: '#40c4ff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
              Sign Up Free
            </button>
          </div>
        )}

        {/* Trust strip on last step (research: visible security/trust cues lift activation up to ~40%) */}
        {isLast ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
            gap: '4px 14px', margin: '6px 0 0',
            fontSize: 10.5, fontWeight: 600, color: 'rgba(var(--fg),.3)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i className="fa-solid fa-lock" style={{ fontSize: 9, color: '#00e676' }} />Bank-level encryption</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i className="fa-regular fa-credit-card" style={{ fontSize: 9, color: '#00e676' }} />No card required</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i className="fa-solid fa-infinity" style={{ fontSize: 9, color: '#00e676' }} />Free forever</span>
          </div>
        ) : (
          /* Step counter */
          <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: 11, color: 'rgba(var(--fg),.2)' }}>
            Step {step + 1} of {STEPS.length}
          </p>
        )}
      </div>
    </div>
  );
}
