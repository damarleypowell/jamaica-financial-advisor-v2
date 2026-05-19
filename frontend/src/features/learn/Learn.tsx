import { useState, useEffect } from 'react';
import {
  BookOpen, ChevronDown, ChevronUp, CheckCircle, Clock,
  TrendingUp, BarChart2, Star, X, ArrowRight, Award, Zap,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  readTime: number;
  description: string;
  content: string[];
}

interface LearningPath {
  id: string;
  title: string;
  lessonCount: number;
  color: string;
  tag?: string;
  icon: React.ReactNode;
}

interface GlossaryTerm {
  term: string;
  definition: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const LESSONS: Lesson[] = [
  {
    id: 'jse-intro',
    title: 'What Is the Jamaica Stock Exchange?',
    category: 'Market Basics',
    difficulty: 'Beginner',
    readTime: 5,
    description:
      'The JSE was founded in 1969 and is one of the oldest exchanges in the Caribbean. Learn how it operates, what companies are listed, and how trading works.',
    content: [
      'The Jamaica Stock Exchange (JSE) was established in 1969 and stands as one of the oldest and most developed securities markets in the Caribbean region. It serves as the primary marketplace for buying and selling shares of publicly listed Jamaican companies. The exchange currently has approximately 40 listed companies spanning multiple sectors including financial services, manufacturing, distribution, and tourism.',
      'The JSE operates under the supervision of the Financial Services Commission (FSC) of Jamaica. Two main indices track overall market performance: the JSE All Jamaican Composite Index, which includes all listed ordinary stocks, and the JSE Select Index, which tracks the top 10 companies by market capitalisation. These indices serve as benchmarks for measuring portfolio performance against the broader market.',
      'Trading on the JSE takes place Monday through Friday from 9:30 AM to 1:30 PM Jamaica Standard Time. All transactions are settled in Jamaican Dollars (JMD), though the Junior Market — a segment for smaller emerging companies — also plays an important role in the ecosystem by offering tax incentives to attract growing businesses.',
      'To invest on the JSE, you need to open a brokerage account with a licensed broker-dealer. These brokers execute trades on your behalf through the exchange\'s electronic trading platform. The JSE also operates a US Dollar Equities Market, allowing investors to trade USD-denominated shares of certain listed companies, providing a degree of currency diversification within the local market.',
    ],
  },
  {
    id: 'stock-quote',
    title: 'How to Read a Stock Quote',
    category: 'Market Basics',
    difficulty: 'Beginner',
    readTime: 4,
    description:
      'Stock quotes contain a wealth of information — open, high, low, close (OHLC), bid/ask spread, volume, and more. Learn to decode them using real JSE examples.',
    content: [
      'A stock quote is a snapshot of a security\'s price and trading activity at a given point in time. The most fundamental piece of data is the OHLC: the Opening price (first trade of the day), the High (the highest price reached), the Low (the lowest price reached), and the Close (the final trade price). On the JSE, you can find these figures for any listed stock through your broker\'s platform or the JSE\'s official website.',
      'The bid price is the highest amount a buyer is currently willing to pay, while the ask price is the lowest amount a seller is willing to accept. The difference between the two is the bid-ask spread. A narrow spread typically indicates a liquid, actively traded stock, whereas a wide spread can signal low trading activity and potential difficulty entering or exiting a position at your desired price.',
      'Volume refers to the total number of shares traded during the session. High volume on a price move generally confirms the strength of that move, while low-volume price changes may be less reliable signals. For context on the JSE, blue-chip stocks like GraceKennedy (GK) or NCB Financial Group (NCBFG) tend to have significantly higher daily volumes than smaller-cap listings.',
      'The Price-to-Earnings (P/E) ratio compares a company\'s share price to its earnings per share. For example, if GraceKennedy trades at J$70 and has earnings per share of J$5, its P/E ratio is 14x. A lower P/E may suggest undervaluation relative to peers, though it is essential to compare within the same sector and consider the company\'s growth prospects before drawing conclusions.',
    ],
  },
  {
    id: 'dividends',
    title: 'Understanding Dividends',
    category: 'Income Investing',
    difficulty: 'Beginner',
    readTime: 6,
    description:
      'Dividends are a key source of passive income for JSE investors. Discover ex-dividend dates, payment timelines, and how to calculate dividend yield.',
    content: [
      'A dividend is a portion of a company\'s profits distributed to shareholders. On the JSE, dividends are most commonly paid in cash, though some companies offer stock dividends instead. Consistent dividend payers like GraceKennedy and NCB Financial Group are popular among income-oriented investors who seek regular cash returns in addition to capital appreciation.',
      'Two critical dates govern dividend entitlement. The ex-dividend date is the cutoff — if you purchase shares on or after this date, you will not receive the upcoming dividend; the seller retains the right to it. The record date, typically one or two days after the ex-dividend date, is when the company takes its official snapshot of shareholders eligible for payment. The payment date is when the cash actually arrives in your account.',
      'Dividend yield is calculated by dividing the annual dividend per share by the current share price. For example, if a JSE stock pays J$2.50 annually in dividends and its current price is J$50, the dividend yield is 5%. This metric allows you to compare the income-generating potential of different stocks — and even compare stocks against fixed-income alternatives like Government of Jamaica bonds.',
      'It is important not to chase yield blindly. An unusually high dividend yield can sometimes be a warning sign: the share price may have fallen sharply due to deteriorating business performance, which inflates the yield figure artificially. Always examine whether the company\'s earnings are sufficient to sustain its dividend payout — a payout ratio (dividends divided by net earnings) above 100% is unsustainable over the long term.',
    ],
  },
  {
    id: 'rsi-macd',
    title: 'Technical Indicators: RSI & MACD',
    category: 'Technical Analysis',
    difficulty: 'Intermediate',
    readTime: 8,
    description:
      'RSI and MACD are two of the most widely used technical indicators. Learn to interpret their signals and apply them to JSE stock charts.',
    content: [
      'The Relative Strength Index (RSI) is a momentum oscillator that measures the speed and magnitude of a stock\'s recent price changes on a scale from 0 to 100. Developed by J. Welles Wilder, the conventional interpretation is that an RSI reading above 70 indicates the stock may be overbought — potentially due for a pullback — while a reading below 30 suggests oversold conditions, which can precede a price rebound. On JSE stocks, RSI is best used in conjunction with other signals rather than in isolation.',
      'The Moving Average Convergence Divergence (MACD) indicator consists of two exponential moving averages (typically the 12-period and 26-period EMAs) and a signal line (the 9-period EMA of the MACD line). When the MACD line crosses above the signal line, it generates a bullish crossover — a potential buy signal. A crossover below the signal line is bearish, suggesting downward momentum may be building.',
      'Applying these tools to JSE stocks requires awareness of the market\'s lower liquidity compared to major exchanges. Because fewer shares change hands each day, individual large trades can create short-term price spikes that produce false RSI or MACD signals. To filter out noise, many technical analysts on the JSE apply these indicators to weekly charts rather than daily charts, which smooth out erratic intraday movements.',
      'Divergence is one of the most powerful signals both indicators offer. Bullish divergence occurs when a stock\'s price makes a new low but the RSI or MACD fails to confirm with a new low — suggesting selling momentum is weakening. Bearish divergence is the opposite: price makes a new high but the indicator lags. Used thoughtfully alongside fundamental analysis, these indicators can meaningfully improve your entry and exit timing on JSE positions.',
    ],
  },
  {
    id: 'diversification',
    title: 'Portfolio Diversification on the JSE',
    category: 'Portfolio Strategy',
    difficulty: 'Intermediate',
    readTime: 7,
    description:
      'Concentrating in a single stock or sector dramatically increases risk. Discover how to build a diversified JSE portfolio across sectors and asset classes.',
    content: [
      'Diversification is the practice of spreading investments across different assets so that the poor performance of any single holding does not devastate your entire portfolio. On the JSE, the primary sectors available to investors include Financial Services, Manufacturing, Distribution, Tourism and Entertainment, and Conglomerates. Each sector tends to respond differently to economic cycles, making cross-sector diversification particularly effective at reducing portfolio volatility.',
      'A simple example of a diversified JSE portfolio might include NCB Financial Group (Financials), GraceKennedy (Conglomerate/Distribution), Carreras Group (Consumer Goods), Sagicor Group Jamaica (Insurance/Financials), and a tourism-linked company such as Pulse Investments. Spreading across these different business models means that a downturn in one sector — say, a drop in tourism revenue — will be partially offset by stability or growth in others.',
      'Beyond equities, Jamaican investors can further diversify through Government of Jamaica bonds, unit trusts, and USD-denominated instruments on the JSE\'s USD Equities Market. This multi-asset approach guards against both company-specific risk and broader sector risk. Currency diversification — holding some assets in USD — also protects against JMD depreciation, which has been a persistent long-term trend.',
      'A common mistake among new JSE investors is concentrating heavily in financial sector stocks because of their high visibility and dividend payouts. While financials are an important component, over-concentration in any one sector can expose your portfolio to systemic risk. As a general rule of thumb, no single stock should represent more than 15–20% of your total portfolio, and no single sector more than 30–35%.',
    ],
  },
  {
    id: 'financial-statements',
    title: 'Reading Financial Statements',
    category: 'Fundamental Analysis',
    difficulty: 'Intermediate',
    readTime: 10,
    description:
      'Annual reports and quarterly financials are the backbone of fundamental analysis. Learn to find and interpret key metrics from JSE company filings.',
    content: [
      'Every company listed on the JSE is required to publish audited annual financial statements and unaudited quarterly reports. These documents are available on the Jamaica Stock Exchange\'s official website (www.jamstockex.com) under each company\'s profile page. They include three core financial statements: the Income Statement (Profit & Loss), the Balance Sheet (Statement of Financial Position), and the Cash Flow Statement — each telling a different part of the company\'s financial story.',
      'On the Income Statement, focus first on revenue growth — is the company growing its top line year over year? Then move to operating profit and net profit margins. Earnings Per Share (EPS) — net profit divided by the number of shares outstanding — is particularly important because it directly feeds into the P/E ratio calculation and reflects what each share of ownership is earning for you. GraceKennedy\'s annual reports, for example, clearly break down revenue by segment, making it easy to see which business units are driving growth.',
      'The Balance Sheet reveals the company\'s financial health at a point in time. Key metrics include the Debt-to-Equity (D/E) ratio, which compares total liabilities to shareholder equity. A high D/E ratio means the company is heavily leveraged — potentially risky if revenues decline. Also examine current assets versus current liabilities: if current liabilities exceed current assets, the company may face short-term cash flow difficulties. A strong balance sheet with manageable debt provides a margin of safety for investors.',
      'The Cash Flow Statement is often considered the most reliable of the three, because unlike profits (which can be influenced by accounting choices), cash is harder to manipulate. Pay attention to cash flow from operations — positive and growing operating cash flow is a sign of a genuinely healthy business. Also note capital expenditure (capex): high capex may signal an investment phase, while low capex in a capital-intensive business could indicate underinvestment. Over time, free cash flow (operating cash flow minus capex) is the fuel that funds dividends, buybacks, and growth.',
    ],
  },
];

const PATHS: LearningPath[] = [
  {
    id: 'all',
    title: 'All Lessons',
    lessonCount: 6,
    color: 'var(--color-green)',
    tag: 'Start Here',
    icon: <BookOpen size={20} />,
  },
  {
    id: 'technical',
    title: 'Technical Analysis',
    lessonCount: 2,
    color: '#4f9eff',
    icon: <BarChart2 size={20} />,
  },
  {
    id: 'advanced',
    title: 'Advanced Investing',
    lessonCount: 3,
    color: '#f5c842',
    tag: 'PRO',
    icon: <TrendingUp size={20} />,
  },
];

const GLOSSARY: GlossaryTerm[] = [
  {
    term: 'Market Capitalisation',
    definition:
      'The total market value of a company\'s outstanding shares, calculated by multiplying the current share price by the total number of shares. On the JSE, market cap is used to classify companies as large-cap, mid-cap, or small-cap, each carrying different risk and liquidity profiles.',
  },
  {
    term: 'P/E Ratio (Price-to-Earnings)',
    definition:
      'A valuation metric that compares a stock\'s price to its earnings per share. A P/E of 15 means investors are paying J$15 for every J$1 of annual earnings. Lower P/E stocks may be undervalued relative to peers, but always compare within the same sector.',
  },
  {
    term: 'Dividend Yield',
    definition:
      'The annual dividend per share expressed as a percentage of the current share price. For example, a J$2 annual dividend on a J$40 stock equals a 5% yield. Dividend yield helps compare the income potential of different stocks and against fixed-income alternatives.',
  },
  {
    term: 'Beta',
    definition:
      'A measure of a stock\'s price volatility relative to the overall market. A beta of 1.0 means the stock moves in line with the index. Beta above 1.0 implies greater volatility; below 1.0 means the stock tends to be more stable. Higher beta stocks carry higher risk and potentially higher reward.',
  },
  {
    term: 'Volume',
    definition:
      'The total number of shares traded during a given period. High volume on a price move validates the direction of the move. Low volume can indicate weak conviction. On the JSE, volume is particularly important because lower-liquidity stocks can see outsized price moves on relatively small trades.',
  },
];

// ─── Style helpers ────────────────────────────────────────────────────────────

const difficultyStyle = (d: Lesson['difficulty']): React.CSSProperties => {
  if (d === 'Beginner') return { background: 'rgba(0,230,118,.12)', color: 'var(--color-green)', border: '1px solid rgba(0,230,118,.25)' };
  if (d === 'Intermediate') return { background: 'rgba(79,158,255,.12)', color: '#4f9eff', border: '1px solid rgba(79,158,255,.25)' };
  return { background: 'rgba(245,200,66,.12)', color: '#f5c842', border: '1px solid rgba(245,200,66,.25)' };
};

const badgePill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PathCard({ path, isActive, onClick }: { path: LearningPath; isActive: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        minWidth: 200, flex: '0 0 200px',
        background: isActive ? `${path.color}12` : 'var(--color-bg2)',
        border: `1px solid ${isActive ? path.color + '55' : 'var(--color-border)'}`,
        borderRadius: 18, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12,
        cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden',
        boxShadow: isActive ? `0 4px 20px ${path.color}18` : 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = path.color;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = isActive ? path.color + '55' : 'var(--color-border)';
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      {/* Glow blob */}
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 100, height: 100,
        borderRadius: '50%', background: path.color, opacity: .06, pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${path.color}22`, color: path.color,
        }}>
          {path.icon}
        </div>
        {path.tag && (
          <span style={{
            ...badgePill,
            background: path.tag === 'PRO' ? 'rgba(245,200,66,.15)' : 'rgba(0,230,118,.15)',
            color: path.tag === 'PRO' ? '#f5c842' : 'var(--color-green)',
            border: `1px solid ${path.tag === 'PRO' ? 'rgba(245,200,66,.3)' : 'rgba(0,230,118,.3)'}`,
            fontSize: 9,
          }}>
            {path.tag === 'PRO' && <Star size={8} />}
            {path.tag}
          </span>
        )}
      </div>

      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{path.title}</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text2)' }}>{path.lessonCount} lessons</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 'auto', color: path.color }}>
        <span style={{ fontSize: 11, fontWeight: 700 }}>Explore path</span>
        <ArrowRight size={12} />
      </div>
    </div>
  );
}

function LessonCard({ lesson, isRead, onClick }: { lesson: Lesson; isRead: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--color-bg2)', border: `1px solid ${isRead ? 'rgba(0,230,118,.3)' : 'var(--color-border)'}`,
        borderRadius: 18, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 10,
        cursor: 'pointer', transition: 'all .2s', position: 'relative',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,230,118,.4)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = isRead ? 'rgba(0,230,118,.3)' : 'var(--color-border)';
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      {/* Read badge */}
      {isRead && (
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <CheckCircle size={16} color="var(--color-green)" />
        </div>
      )}

      {/* Tags row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ ...badgePill, background: 'rgba(255,255,255,.06)', color: 'var(--color-text2)', border: '1px solid rgba(255,255,255,.08)', fontSize: 10 }}>
          {lesson.category}
        </span>
        <span style={{ ...badgePill, ...difficultyStyle(lesson.difficulty) }}>
          {lesson.difficulty}
        </span>
      </div>

      {/* Title */}
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.4, paddingRight: isRead ? 24 : 0 }}>
        {lesson.title}
      </p>

      {/* Description */}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text2)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {lesson.description}
      </p>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-text2)' }}>
          <Clock size={11} />
          <span style={{ fontSize: 11 }}>{lesson.readTime} min read</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {isRead ? 'Review' : 'Read lesson'}
          <ArrowRight size={11} />
        </span>
      </div>
    </div>
  );
}

function GlossaryRow({ item }: { item: GlossaryTerm }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14,
        overflow: 'hidden', transition: 'border-color .2s',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', cursor: 'pointer', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={13} color="var(--color-green)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', textAlign: 'left' }}>{item.term}</span>
        </div>
        {open ? <ChevronUp size={15} color="var(--color-text2)" /> : <ChevronDown size={15} color="var(--color-text2)" />}
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-text2)', lineHeight: 1.65 }}>{item.definition}</p>
        </div>
      )}
    </div>
  );
}

function LessonModal({ lesson, isRead, onMarkRead, onClose }: {
  lesson: Lesson; isRead: boolean; onMarkRead: () => void; onClose: () => void;
}) {
  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--color-bg2)', border: '1px solid var(--color-border)',
        borderRadius: 22, width: '100%', maxWidth: 680, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ ...badgePill, background: 'rgba(255,255,255,.06)', color: 'var(--color-text2)', border: '1px solid rgba(255,255,255,.08)' }}>
                {lesson.category}
              </span>
              <span style={{ ...badgePill, ...difficultyStyle(lesson.difficulty) }}>{lesson.difficulty}</span>
              <span style={{ ...badgePill, background: 'transparent', color: 'var(--color-text2)', border: 'none', gap: 4 }}>
                <Clock size={10} /> {lesson.readTime} min read
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.35 }}>{lesson.title}</h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,.07)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--color-text2)', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {lesson.content.map((para, i) => (
            <p key={i} style={{ margin: 0, fontSize: 14, color: 'var(--color-text)', lineHeight: 1.8, fontWeight: i === 0 ? 500 : 400 }}>
              {para}
            </p>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {isRead ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--color-green)' }}>
              <CheckCircle size={15} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Lesson completed</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--color-text2)' }}>Finished reading?</span>
          )}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <button
              onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text2)' }}
            >
              Close
            </button>
            {!isRead && (
              <button
                onClick={onMarkRead}
                style={{ padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', background: 'var(--color-green)', color: 'var(--color-bg)', display: 'flex', alignItems: 'center', gap: 7 }}
              >
                <CheckCircle size={13} />
                Mark as Read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const LS_KEY = 'gotham_learn_read';

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveRead(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

function filterLessonsByPath(pathId: string): Lesson[] {
  if (pathId === 'all') return LESSONS;
  if (pathId === 'technical') return LESSONS.filter(l => l.category === 'Technical Analysis');
  if (pathId === 'advanced') return LESSONS.filter(l => l.difficulty === 'Advanced' || l.difficulty === 'Intermediate');
  return LESSONS;
}

export default function Learn() {
  const [readIds, setReadIds] = useState<Set<string>>(loadRead);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('all');

  const markRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveRead(next);
      return next;
    });
  };

  const filteredLessons = filterLessonsByPath(selectedPath);
  const completedCount = LESSONS.filter(l => readIds.has(l.id)).length;
  const progressPct = Math.round((completedCount / LESSONS.length) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: 'var(--font-sans)' }}>

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Award size={22} color="var(--color-green)" />
              Learning Hub
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--color-text2)' }}>
              Master Caribbean &amp; US investing — from first principles to advanced strategy.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text2)', fontWeight: 600 }}>{completedCount}/{LESSONS.length} lessons</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>Your Progress</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-green)' }}>{progressPct}% complete</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--color-green)', borderRadius: 999, transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
          </div>
          {completedCount === LESSONS.length && (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--color-green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Star size={11} /> All lessons complete — excellent work!
            </p>
          )}
        </div>
      </div>

      {/* ── Learning Paths ───────────────────────────────────────────────────── */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={15} color="var(--color-green)" />
          Learning Paths
        </h2>

        {/* Horizontal scroll on mobile, flex wrap on desktop */}
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
          {PATHS.map(p => (
            <PathCard
              key={p.id}
              path={{ ...p, lessonCount: filterLessonsByPath(p.id).length }}
              isActive={selectedPath === p.id}
              onClick={() => setSelectedPath(p.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Featured Lessons ─────────────────────────────────────────────────── */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={15} color="var(--color-green)" />
          {selectedPath === 'all' ? 'All Lessons' : PATHS.find(p => p.id === selectedPath)?.title ?? 'Lessons'}
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)', marginLeft: 2 }}>({filteredLessons.length})</span>
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filteredLessons.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text2)', gridColumn: '1 / -1', padding: '24px 0' }}>
              No lessons in this path yet — check back soon.
            </p>
          ) : filteredLessons.map(l => (
            <LessonCard
              key={l.id}
              lesson={l}
              isRead={readIds.has(l.id)}
              onClick={() => setActiveLesson(l)}
            />
          ))}
        </div>
      </section>

      {/* ── Quick Reference / Glossary ───────────────────────────────────────── */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={15} color="var(--color-green)" />
          Quick Reference
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--color-text2)' }}>Key investing terms explained simply.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {GLOSSARY.map(g => <GlossaryRow key={g.term} item={g} />)}
        </div>
      </section>

      {/* ── Lesson Modal ─────────────────────────────────────────────────────── */}
      {activeLesson && (
        <LessonModal
          lesson={activeLesson}
          isRead={readIds.has(activeLesson.id)}
          onMarkRead={() => markRead(activeLesson.id)}
          onClose={() => setActiveLesson(null)}
        />
      )}
    </div>
  );
}
