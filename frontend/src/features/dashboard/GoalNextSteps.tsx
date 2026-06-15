import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Step { icon: string; label: string; sub: string; to: string }

// Tailored next steps for each onboarding goal ("What are you building towards?").
const GOALS: Record<string, { blurb: string; steps: Step[] }> = {
  'Save for a major purchase': {
    blurb: "A shorter timeline means steadier choices. Here's where to start.",
    steps: [
      { icon: 'fa-building-columns', label: 'Start with stable blue chips', sub: 'Lower-risk Caribbean leaders', to: '/invest' },
      { icon: 'fa-flask-vial',       label: 'Practice risk-free first',     sub: 'Paper trade with virtual funds', to: '/portfolio' },
      { icon: 'fa-robot',            label: 'Ask AI for a savings plan',    sub: 'Tailored to your timeline',      to: '/chat' },
    ],
  },
  'Build a retirement nest egg': {
    blurb: "Time is your biggest advantage. Build a steady, diversified core.",
    steps: [
      { icon: 'fa-seedling',  label: 'Build a diversified core',  sub: 'Blue chips for the long run', to: '/invest' },
      { icon: 'fa-chart-pie', label: 'Track your real holdings',  sub: 'Watch your money compound',   to: '/holdings' },
      { icon: 'fa-robot',     label: 'Get a long-term plan',      sub: 'Think in decades, with AI',   to: '/chat' },
    ],
  },
  'Earn passive income from dividends': {
    blurb: "Focus on companies that pay you to hold them.",
    steps: [
      { icon: 'fa-coins',     label: 'Find dividend payers',          sub: 'Stocks that pay regularly',     to: '/invest' },
      { icon: 'fa-robot',     label: 'Which JSE stocks pay reliably?', sub: 'Ask the AI advisor',            to: '/chat' },
      { icon: 'fa-chart-pie', label: 'Track your income holdings',     sub: 'Monitor your yield',            to: '/holdings' },
    ],
  },
  'Grow generational wealth': {
    blurb: "Think big and long. Diversify across markets and keep learning.",
    steps: [
      { icon: 'fa-earth-americas',  label: 'Diversify JSE + US markets', sub: 'Hedge JMD with USD assets', to: '/us-stocks' },
      { icon: 'fa-robot',           label: 'Build a long-horizon plan',  sub: 'With the AI advisor',       to: '/chat' },
      { icon: 'fa-graduation-cap',  label: 'Learn the fundamentals',     sub: 'Courses for serious wealth', to: '/learn' },
    ],
  },
};

export default function GoalNextSteps() {
  const navigate = useNavigate();
  const goal = typeof window !== 'undefined' ? localStorage.getItem('gf_goal') : null;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('gf_goal_steps_dismissed') === '1');

  if (!goal || dismissed || !GOALS[goal]) return null;
  const cfg = GOALS[goal];
  const dismiss = () => { localStorage.setItem('gf_goal_steps_dismissed', '1'); setDismissed(true); };

  return (
    <div style={{ position: 'relative', background: 'linear-gradient(135deg, rgba(0,230,118,.07), rgba(64,196,255,.04))', border: '1px solid rgba(0,230,118,.2)', borderRadius: 18, padding: '18px 20px' }}>
      <button onClick={dismiss} aria-label="Dismiss" style={{ position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', cursor: 'pointer' }}>
        <i className="fa-solid fa-xmark" style={{ fontSize: 11 }} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <i className="fa-solid fa-bullseye" style={{ fontSize: 13, color: '#00e676' }} />
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#00e676' }}>Your goal</span>
      </div>
      <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--color-text)' }}>{goal}</h2>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-text2)', lineHeight: 1.5, maxWidth: 520 }}>{cfg.blurb}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {cfg.steps.map((s, i) => (
          <button key={s.label} onClick={() => navigate(s.to)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px', borderRadius: 12, background: 'var(--color-bg2)', border: '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s, transform .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,230,118,.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = ''; }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.18)' }}>
              <i className={`fa-solid ${s.icon}`} style={{ fontSize: 13, color: '#00e676' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)' }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: 10.5, color: 'var(--color-muted)' }}>{s.sub}</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#00e676', flexShrink: 0 }}>{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
