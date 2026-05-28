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
    body: 'Gotham Financial is your Caribbean investment companion — live JSE & US stock data, AI-powered advice, and a gamified path from Seed to Wealth Master.',
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

export default function Onboarding() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const openAuthModal = useUIStore(s => s.openAuthModal);
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function finish() {
    localStorage.setItem('gf_onboarded', '1');
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
      padding: '0 0 env(safe-area-inset-bottom, 32px)', position: 'relative', overflow: 'hidden',
      fontFamily: SANS,
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 400, borderRadius: '50%',
        background: `${current.color}14`, filter: 'blur(100px)',
        pointerEvents: 'none', transition: 'background 600ms ease',
      }} />

      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: 480, padding: '56px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 900, letterSpacing: '.1em', color: '#fff', lineHeight: 1 }}>GOTHAM</p>
          <p style={{ margin: 0, fontSize: 8, fontWeight: 600, letterSpacing: '.28em', color: 'rgba(255,255,255,.3)', lineHeight: 1, marginTop: 3 }}>FINANCIAL</p>
        </div>
        <button onClick={finish} style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS, padding: '8px 0' }}>
          Skip
        </button>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 6, marginTop: 24, position: 'relative', zIndex: 2 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 24 : 6, height: 6, borderRadius: 99,
            background: i === step ? current.color : i < step ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)',
            transition: 'all 300ms cubic-bezier(.4,0,.2,1)',
            boxShadow: i === step ? `0 0 8px ${current.color}70` : 'none',
          }} />
        ))}
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '28px 24px', maxWidth: 480, width: '100%', position: 'relative', zIndex: 2,
        textAlign: 'center',
      }}>
        {/* Emoji */}
        <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1, filter: 'drop-shadow(0 0 24px rgba(255,255,255,.08))' }}>
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
          fontSize: 'clamp(26px, 7vw, 36px)', fontWeight: 900,
          color: '#fff', lineHeight: 1.15, letterSpacing: '-0.025em',
          margin: '0 0 14px',
        }}>
          {current.title}
        </h1>

        {/* Body */}
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 360 }}>
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
                background: i === 0 ? 'rgba(0,230,118,.07)' : 'rgba(255,255,255,.03)',
                border: `1px solid ${i === 0 ? 'rgba(0,230,118,.2)' : 'rgba(255,255,255,.06)'}`,
                textAlign: 'left',
              }}>
                <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{r.emoji}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? '#fff' : 'rgba(255,255,255,.5)' }}>{r.name}</span>
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', fontWeight: 700 }}>{r.range}</span>
                {i === 0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#00e676', background: 'rgba(0,230,118,.12)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(0,230,118,.2)' }}>YOU START HERE</span>}
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Goal picker */}
        {step === 2 && current.goals && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {current.goals.map((g, i) => (
              <button key={g} onClick={() => setSelectedGoal(i)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: selectedGoal === i ? 'rgba(64,196,255,.1)' : 'rgba(255,255,255,.03)',
                borderTop: `1px solid ${selectedGoal === i ? 'rgba(64,196,255,.3)' : 'rgba(255,255,255,.07)'}`,
                borderRight: `1px solid ${selectedGoal === i ? 'rgba(64,196,255,.3)' : 'rgba(255,255,255,.07)'}`,
                borderBottom: `1px solid ${selectedGoal === i ? 'rgba(64,196,255,.3)' : 'rgba(255,255,255,.07)'}`,
                borderLeft: `1px solid ${selectedGoal === i ? 'rgba(64,196,255,.3)' : 'rgba(255,255,255,.07)'}`,
                transition: 'all .15s',
                fontFamily: SANS,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${selectedGoal === i ? '#40c4ff' : 'rgba(255,255,255,.2)'}`,
                  background: selectedGoal === i ? '#40c4ff' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s',
                }}>
                  {selectedGoal === i && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#04060d' }} />}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: selectedGoal === i ? '#fff' : 'rgba(255,255,255,.55)' }}>{g}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ width: '100%', maxWidth: 480, padding: '0 24px 8px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 2 }}>
        {/* Primary CTA */}
        <button
          onClick={next}
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
          {current.cta}
        </button>

        {/* Auth buttons on last step */}
        {isLast && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { openAuthModal('login'); finish(); }}
              style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
              Log In
            </button>
            <button
              onClick={() => { openAuthModal('signup'); finish(); }}
              style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'rgba(64,196,255,.1)', border: '1px solid rgba(64,196,255,.25)', color: '#40c4ff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
              Sign Up Free
            </button>
          </div>
        )}

        {/* Step counter */}
        <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,.2)' }}>
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
