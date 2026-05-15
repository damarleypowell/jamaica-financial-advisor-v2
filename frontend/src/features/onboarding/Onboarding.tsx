import { useState, useEffect, useRef } from 'react';
import { CheckCircle, ChevronRight, ChevronLeft, TrendingUp, BookOpen, Shield, Brain, BarChart2, Bell } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { apiPost } from '../../lib/api';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────
type UserType = 'beginner' | 'intermediate' | 'advanced';
interface QuizQuestion { question: string; options: string[]; correct: number; }
interface Lesson { title: string; icon: React.ReactNode; content: string[]; quiz: QuizQuestion[]; }

// ── Splash slides ─────────────────────────────────────────────────────────────
const SLIDES = [
  {
    gradient: 'linear-gradient(160deg, #04060d 0%, #0a1f12 50%, #04060d 100%)',
    glow: 'rgba(0,230,118,0.18)',
    Icon: TrendingUp,
    tag: 'Jamaica Stock Exchange',
    title: 'More than just a\ntrading platform',
    subtitle: 'Real-time JSE data, AI-powered insights, and smart portfolio tools — built for Jamaican investors.',
  },
  {
    gradient: 'linear-gradient(160deg, #04060d 0%, #081828 50%, #04060d 100%)',
    glow: 'rgba(64,196,255,0.15)',
    Icon: BarChart2,
    tag: 'Live Market Data',
    title: 'Track the JSE\nin real time',
    subtitle: 'Live prices, heatmaps, sector performance, and breaking news — all in one place.',
  },
  {
    gradient: 'linear-gradient(160deg, #04060d 0%, #160a24 50%, #04060d 100%)',
    glow: 'rgba(206,147,216,0.15)',
    Icon: Brain,
    tag: 'AI Powered',
    title: 'Your personal\nfinancial advisor',
    subtitle: 'Ask Gotham AI anything about stocks, your portfolio, or the market — and get expert-level answers instantly.',
  },
  {
    gradient: 'linear-gradient(160deg, #04060d 0%, #1a1408 50%, #04060d 100%)',
    glow: 'rgba(255,215,64,0.12)',
    Icon: Bell,
    tag: 'Price Alerts',
    title: 'Never miss\nan opportunity',
    subtitle: 'Set price alerts and get notified by email the moment your targets are hit.',
  },
];

const ICON_COLORS = ['#00e676', '#40c4ff', '#ce93d8', '#ffd740'];

// ── Lesson content ─────────────────────────────────────────────────────────────
const LESSONS: Lesson[] = [
  {
    title: 'What Are Stocks?',
    icon: <TrendingUp size={20} />,
    content: [
      'A stock represents part-ownership in a company. Buy a share of NCB and you own a tiny piece of National Commercial Bank.',
      'Companies list on the Jamaica Stock Exchange to raise money from the public. In return you can share in the company\'s growth and profits through capital appreciation and dividends.',
      'Why invest in stocks?\n• Capital appreciation — the stock price goes up\n• Dividends — the company shares profits with you\n• Ownership — you get voting rights at shareholder meetings',
    ],
    quiz: [
      { question: 'What does owning a stock mean?', options: ['You lent money to the company', 'You own a piece of the company', 'You work for the company', 'You are a customer'], correct: 1 },
      { question: 'What is a dividend?', options: ['A fee you pay to buy stocks', 'A share of company profits paid to investors', 'The price of one share', 'A type of bank account'], correct: 1 },
    ],
  },
  {
    title: 'Understanding the JSE',
    icon: <BarChart2 size={20} />,
    content: [
      'The Jamaica Stock Exchange (JSE) is where Jamaican companies list their shares for public trading. Founded in 1968 and based in Kingston.',
      'Trading hours: 9:30 AM – 2:00 PM, Monday to Friday. 50+ companies listed across banking, manufacturing, tourism, and retail sectors.',
      'Popular JSE stocks:\n• NCB Financial Group — largest bank\n• GraceKennedy — food & financial services\n• Sagicor Group — insurance & finance\n• Barita Investments — brokerage services\n• Mayberry Investments — investment firm',
    ],
    quiz: [
      { question: 'When does the JSE trade?', options: ['24 hours a day', '9:30 AM – 2:00 PM weekdays', '9:00 AM – 4:00 PM weekdays', 'Weekends only'], correct: 1 },
      { question: 'Which of these is JSE-listed?', options: ['Apple Inc.', 'GraceKennedy', 'Amazon', 'Tesla'], correct: 1 },
    ],
  },
  {
    title: 'Risk & Your Money',
    icon: <Shield size={20} />,
    content: [
      'GOLDEN RULE: Only invest money you can afford to lose. Stocks can go UP or DOWN — sometimes sharply.',
      'Never invest rent money, food money, emergency savings, or anything you need within 6 months.',
      'Before investing, build an emergency fund of 3–6 months of expenses in a savings account. Once you have that cushion, extra savings can be put to work in the market.',
    ],
    quiz: [
      { question: 'What money should you NEVER invest?', options: ['An annual bonus you saved', 'Extra savings after all bills', 'Rent money due next week', 'An inheritance you won\'t need soon'], correct: 2 },
      { question: 'How much emergency savings before investing?', options: ['None — start immediately', '1 week of expenses', '3–6 months of expenses', '10 years of expenses'], correct: 2 },
    ],
  },
  {
    title: 'Reading Stock Data',
    icon: <BookOpen size={20} />,
    content: [
      'PRICE — Current cost of one share. Example: Mayberry at JA$5.20 means one share costs JA$5.20.',
      'CHANGE — How much the price moved today. +3% means up 3%.\n\nP/E RATIO — Price ÷ earnings per share. Lower may mean better value.\n\nDIVIDEND YIELD — Annual dividend as a % of share price.',
      'VOLUME — How many shares traded today. High volume = lots of interest.\n\nMARKET CAP — Total company value = share price × total shares.',
    ],
    quiz: [
      { question: 'A stock at JA$10 pays JA$0.50/year. What is the dividend yield?', options: ['2%', '5%', '10%', '50%'], correct: 1 },
      { question: 'What does "+3%" next to a stock mean?', options: ['Down 3% today', 'Up 3% today', 'Dividend yield is 3%', 'P/E ratio is 3'], correct: 1 },
    ],
  },
];

const STARTER_STOCKS = [
  { ticker: 'NCBFG', name: 'NCB Financial Group', sector: 'Banking' },
  { ticker: 'GK', name: 'GraceKennedy Ltd', sector: 'Consumer' },
  { ticker: 'MIL', name: 'Mayberry Investments', sector: 'Investments' },
  { ticker: 'SJ', name: 'Sagicor Group Jamaica', sector: 'Insurance' },
  { ticker: 'BIL', name: 'Barita Investments', sector: 'Investments' },
  { ticker: 'SGJ', name: 'Scotia Group Jamaica', sector: 'Banking' },
];

// ── Quiz ──────────────────────────────────────────────────────────────────────
function Quiz({ questions, onPass }: { questions: QuizQuestion[]; onPass: () => void }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  function handleSubmit() {
    const s = questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
    setScore(s);
    setSubmitted(true);
    if (s >= Math.ceil(questions.length / 2)) setTimeout(onPass, 1600);
  }

  const passed = submitted && score >= Math.ceil(questions.length / 2);
  const failed  = submitted && !passed;

  return (
    <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.07)' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>Quick Check ✏️</p>
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>{qi + 1}. {q.question}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map((opt, oi) => {
              const isSelected = answers[qi] === oi;
              const isCorrect  = oi === q.correct;
              let bg = 'rgba(255,255,255,.03)';
              let border = 'rgba(255,255,255,.08)';
              let color = 'var(--color-text2)';
              if (!submitted && isSelected) { bg = 'rgba(0,230,118,.1)'; border = 'rgba(0,230,118,.4)'; color = '#00e676'; }
              if (submitted && isCorrect)   { bg = 'rgba(0,230,118,.1)'; border = 'rgba(0,230,118,.4)'; color = '#00e676'; }
              if (submitted && isSelected && !isCorrect) { bg = 'rgba(255,82,82,.1)'; border = 'rgba(255,82,82,.35)'; color = '#ff5252'; }
              return (
                <button key={oi} disabled={submitted}
                  onClick={() => setAnswers(a => ({ ...a, [qi]: oi }))}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`, background: bg, color, fontSize: 13, textAlign: 'left', cursor: submitted ? 'default' : 'pointer', transition: 'all 150ms', fontFamily: 'var(--font-sans)' }}>
                  {opt}{submitted && isCorrect ? ' ✓' : ''}{submitted && isSelected && !isCorrect ? ' ✗' : ''}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!submitted && (
        <button disabled={Object.keys(answers).length < questions.length}
          onClick={handleSubmit}
          style={{ width: '100%', padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: Object.keys(answers).length < questions.length ? 'not-allowed' : 'pointer', background: Object.keys(answers).length < questions.length ? 'rgba(255,255,255,.06)' : 'var(--color-green)', color: Object.keys(answers).length < questions.length ? 'var(--color-muted)' : '#04060d', border: 'none', transition: 'all 180ms', fontFamily: 'var(--font-sans)' }}>
          Check Answers
        </button>
      )}
      {passed && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-green)', fontSize: 13, fontWeight: 600, marginTop: 12 }}><CheckCircle size={16} /> {score}/{questions.length} correct — moving on...</div>}
      {failed && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: '#ff5252', fontSize: 13, marginBottom: 6 }}>{score}/{questions.length} — review the lesson and try again.</p>
          <button onClick={() => { setAnswers({}); setSubmitted(false); setScore(0); }} style={{ fontSize: 13, color: 'var(--color-green)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Try Again →</button>
        </div>
      )}
    </div>
  );
}

// ── Watchlist builder ─────────────────────────────────────────────────────────
function WatchlistBuilder({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(t: string) {
    setSelected(p => p.includes(t) ? p.filter(x => x !== t) : p.length < 5 ? [...p, t] : p);
  }
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: 13, color: 'var(--color-text2)', marginBottom: 14 }}>Select 3–5 stocks for your first watchlist:</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {STARTER_STOCKS.map(s => {
          const sel = selected.includes(s.ticker);
          return (
            <button key={s.ticker} onClick={() => toggle(s.ticker)}
              style={{ padding: '12px', borderRadius: 12, border: `1px solid ${sel ? 'rgba(0,230,118,.45)' : 'rgba(255,255,255,.08)'}`, background: sel ? 'rgba(0,230,118,.09)' : 'rgba(255,255,255,.02)', cursor: 'pointer', textAlign: 'left', transition: 'all 150ms' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: sel ? '#00e676' : 'var(--color-text)', margin: 0 }}>{s.ticker}</p>
                  <p style={{ fontSize: 11, color: 'var(--color-muted)', margin: '3px 0 6px', lineHeight: 1.3 }}>{s.name}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: 'var(--color-muted)' }}>{s.sector}</span>
                </div>
                {sel && <CheckCircle size={15} color="#00e676" style={{ flexShrink: 0 }} />}
              </div>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12 }}>{selected.length}/5 selected</p>
      {selected.length >= 3 && (
        <button onClick={onDone}
          style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'var(--color-green)', color: '#04060d', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,230,118,.35)', fontFamily: 'var(--font-sans)', transition: 'all 180ms' }}>
          Start Investing →
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<'splash' | 'select' | 'lesson'>('splash');
  const [slide, setSlide] = useState(0);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [lessonStep, setLessonStep] = useState(1);
  const [lessonScores, setLessonScores] = useState<Record<number, number>>({});
  const [autoplay, setAutoplay] = useState(true);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-advance slides
  useEffect(() => {
    if (phase !== 'splash' || !autoplay) return;
    autoRef.current = setInterval(() => {
      setSlide(s => {
        if (s >= SLIDES.length - 1) { clearInterval(autoRef.current!); return s; }
        return s + 1;
      });
    }, 3200);
    return () => clearInterval(autoRef.current!);
  }, [phase, autoplay, slide]);

  async function saveAndFinish() {
    try {
      await apiPost('/api/users/onboarding', { userType, step: lessonStep, completed: true, lessonScores });
      if (user) setUser({ ...user, onboardingCompleted: true });
    } catch { /* silent */ }
    navigate('/');
  }

  function handleUserType(type: UserType) {
    setUserType(type);
    if (type === 'advanced') { saveAndFinish(); return; }
    setLessonStep(type === 'intermediate' ? 3 : 1);
    setPhase('lesson');
  }

  function handleLessonPass(idx: number) {
    setLessonScores(s => ({ ...s, [idx]: 2 }));
    if (idx < LESSONS.length) setLessonStep(idx + 1);
  }

  const currentLesson = LESSONS[lessonStep - 1];
  const isLastLesson  = lessonStep === LESSONS.length;
  const lessonPct     = (lessonStep / LESSONS.length) * 100;

  // ── PHASE: Splash ─────────────────────────────────────────────────────────
  if (phase === 'splash') {
    const s = SLIDES[slide];
    const accentColor = ICON_COLORS[slide];
    return (
      <div style={{ minHeight: '100vh', background: s.gradient, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 40px', position: 'relative', overflow: 'hidden', transition: 'background 600ms ease' }}>

        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 400, borderRadius: '50%', background: s.glow, filter: 'blur(100px)', pointerEvents: 'none', transition: 'background 600ms' }} />

        {/* Grid texture */}
        <div className="bg-grid" style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }} />

        {/* Logo top */}
        <div style={{ width: '100%', padding: '56px 28px 0', display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 2 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,230,118,.12)', border: '1px solid rgba(0,230,118,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }}>
              <path d="M3 17L7 12L11 14.5L16 9L21 5" stroke="#00e676" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="21" cy="5" r="2.2" fill="#00e676"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 900, letterSpacing: '.12em', color: '#00e676', lineHeight: 1 }}>GOTHAM</p>
            <p style={{ margin: 0, fontSize: 8, fontWeight: 600, letterSpacing: '.32em', color: 'rgba(255,255,255,.3)', lineHeight: 1, marginTop: 2 }}>FINANCIAL</p>
          </div>
        </div>

        {/* Centre content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', position: 'relative', zIndex: 2, maxWidth: 480 }}>
          {/* Icon circle */}
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: `${accentColor}18`, border: `1.5px solid ${accentColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, boxShadow: `0 0 40px ${accentColor}25`, transition: 'all 600ms' }}>
            <s.Icon size={36} color={accentColor} />
          </div>

          {/* Tag */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: accentColor, background: `${accentColor}12`, border: `1px solid ${accentColor}28`, marginBottom: 22, transition: 'all 600ms' }}>
            {s.tag}
          </span>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(28px, 7vw, 42px)', fontWeight: 900, color: '#fff', lineHeight: 1.18, letterSpacing: '-0.025em', margin: '0 0 18px', whiteSpace: 'pre-line' }}>
            {s.title}
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
            {s.subtitle}
          </p>
        </div>

        {/* Bottom controls */}
        <div style={{ width: '100%', maxWidth: 420, padding: '0 28px', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 2 }}>
          {/* Slide dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7 }}>
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => { setSlide(i); setAutoplay(false); }}
                style={{ width: i === slide ? 22 : 7, height: 7, borderRadius: 99, border: 'none', cursor: 'pointer', transition: 'all 280ms cubic-bezier(.4,0,.2,1)', background: i === slide ? '#00e676' : 'rgba(255,255,255,.18)', boxShadow: i === slide ? '0 0 8px rgba(0,230,118,.5)' : 'none', padding: 0 }} />
            ))}
          </div>

          {slide < SLIDES.length - 1 ? (
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={saveAndFinish}
                style={{ flex: 1, padding: '15px', borderRadius: 16, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 150ms' }}>
                Log In
              </button>
              <button onClick={() => { setSlide(s => s + 1); setAutoplay(false); }}
                style={{ flex: 2, padding: '15px', borderRadius: 16, background: 'linear-gradient(135deg,#00e676,#00b248)', border: 'none', color: '#04060d', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 4px 24px rgba(0,230,118,.4)', transition: 'all 180ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                Next <ChevronRight size={18} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setPhase('select')}
                style={{ width: '100%', padding: '16px', borderRadius: 16, background: 'linear-gradient(135deg,#00e676,#00b248)', border: 'none', color: '#04060d', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 4px 28px rgba(0,230,118,.45)', letterSpacing: '.04em', transition: 'all 180ms' }}>
                GET STARTED
              </button>
              <button onClick={saveAndFinish}
                style={{ width: '100%', padding: '14px', borderRadius: 16, background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.65)', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 150ms' }}>
                LOG IN
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PHASE: Select experience level ────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '30%', width: 400, height: 300, borderRadius: '50%', background: 'rgba(0,230,118,.05)', filter: 'blur(100px)', pointerEvents: 'none' }} />

        <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <TrendingUp size={26} color="#00e676" />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text)', margin: '0 0 10px', letterSpacing: '-0.02em' }}>Your experience level?</h1>
            <p style={{ fontSize: 14, color: 'var(--color-text2)', margin: 0, lineHeight: 1.5 }}>We'll personalise your onboarding so you're not wasting time on things you already know.</p>
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {([
              { type: 'beginner' as UserType, Icon: BookOpen, title: 'Brand New Investor', desc: "I've never invested before — start me from the basics.", color: '#00e676', bg: 'rgba(0,230,118,.08)', border: 'rgba(0,230,118,.2)' },
              { type: 'intermediate' as UserType, Icon: TrendingUp, title: 'Some Experience', desc: "I understand the basics and have bought stocks before.", color: '#40c4ff', bg: 'rgba(64,196,255,.08)', border: 'rgba(64,196,255,.2)' },
              { type: 'advanced' as UserType, Icon: Shield, title: 'Experienced Trader', desc: "I'm an active investor — take me straight to the platform.", color: '#ffd740', bg: 'rgba(255,215,64,.08)', border: 'rgba(255,215,64,.2)' },
            ]).map(({ type, Icon, title, desc, color, bg, border }) => (
              <button key={type} onClick={() => handleUserType(type)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 18, border: `1px solid ${border}`, background: bg, cursor: 'pointer', textAlign: 'left', transition: 'all 180ms', fontFamily: 'var(--font-sans)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${color}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}18`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={22} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{title}</p>
                  <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--color-text2)', lineHeight: 1.45 }}>{desc}</p>
                </div>
                <ChevronRight size={18} color="var(--color-muted)" style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>

          <button onClick={saveAndFinish} style={{ width: '100%', fontSize: 13, color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '10px', fontFamily: 'var(--font-sans)', transition: 'color 150ms' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}>
            Skip for now →
          </button>
        </div>
      </div>
    );
  }

  // ── PHASE: Lessons ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '5%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(0,230,118,.04)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)' }}>Lesson {lessonStep} of {LESSONS.length}</span>
            <button onClick={saveAndFinish} style={{ fontSize: 12, color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'color 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}>
              Skip →
            </button>
          </div>
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${lessonPct}%`, background: 'linear-gradient(90deg,#00e676,#00b248)', borderRadius: 99, transition: 'width 500ms cubic-bezier(.4,0,.2,1)', boxShadow: '0 0 8px rgba(0,230,118,.4)' }} />
          </div>
          {/* Step dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            {LESSONS.map((_, i) => (
              <div key={i} style={{ width: i + 1 === lessonStep ? 20 : 7, height: 7, borderRadius: 99, transition: 'all 280ms', background: i + 1 < lessonStep ? 'rgba(0,230,118,.5)' : i + 1 === lessonStep ? '#00e676' : 'rgba(255,255,255,.1)', boxShadow: i + 1 === lessonStep ? '0 0 8px rgba(0,230,118,.5)' : 'none' }} />
            ))}
          </div>
        </div>

        {/* Lesson card */}
        <div style={{ background: 'var(--color-bg2)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 22, padding: '28px 28px 24px', boxShadow: '0 8px 40px rgba(0,0,0,.4)' }}
          className="animate-fade-in">

          {/* Lesson header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00e676', flexShrink: 0 }}>
              {currentLesson.icon}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>{currentLesson.title}</h2>
          </div>

          {/* Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {currentLesson.content.map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: 'var(--color-text2)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line' }}>{para}</p>
            ))}
          </div>

          {/* Quiz or watchlist */}
          {isLastLesson ? (
            <WatchlistBuilder onDone={saveAndFinish} />
          ) : (
            <Quiz questions={currentLesson.quiz} onPass={() => handleLessonPass(lessonStep)} />
          )}
        </div>

        {/* Back button */}
        {lessonStep > 1 && (
          <button onClick={() => setLessonStep(s => s - 1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'var(--color-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; }}>
            <ChevronLeft size={15} /> Back
          </button>
        )}
      </div>
    </div>
  );
}
