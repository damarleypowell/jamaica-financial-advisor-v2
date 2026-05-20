import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import type { NewsItem } from '../../types';

/* ─── source classification ─── */
const LOCAL_SOURCES = new Set([
  'Jamaica Gleaner', 'Jamaica Observer', 'Loop Jamaica', 'RJR News',
  'JSE', 'Loop News Jamaica', 'The Gleaner', 'Observer',
]);

function isCaribbean(item: NewsItem): boolean {
  if (LOCAL_SOURCES.has(item.source)) return true;
  const s = item.source.toLowerCase();
  return s.includes('gleaner') || s.includes('observer') || s.includes('loop') ||
    s.includes('rjr') || s.includes('jse') || s.includes('jamaic') ||
    s.includes('caribbean') || s.includes('barbados') || s.includes('trinidad');
}

function ago(item: NewsItem): string {
  if (item.time && item.time !== 'Today') return item.time;
  const d = item.date ?? item.scrapedAt;
  if (!d) return 'Today';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

/* ─── sentiment analysis ─── */
const POSITIVE_WORDS = ['surge','rally','gain','rise','high','record','profit','growth','strong','beat','upgrade','bull','recover','boost','expand','jump','soar','climb','outperform'];
const NEGATIVE_WORDS = ['fall','drop','crash','slump','loss','deficit','risk','war','sanction','decline','weak','cut','below','miss','debt','default','layoff','bear','plunge','sink','contract'];
const MACRO_WORDS    = ['fed','rate','inflation','interest','policy','gdp','recession','growth','central bank','economy','fiscal','monetary','employment'];
const MACRO_POS      = ['growth','expand','strong gdp','rate cut','stimulus','employment'];
const MACRO_NEG      = ['recession','inflation','rate hike','default','crisis','contraction','unemployment'];

type Horizon = 'today' | 'week' | 'month';
type Sent = 'bullish' | 'bearish' | 'neutral';

interface Outlook { horizon: Horizon; sent: Sent; summary: string; }
interface TopicSignal { label: string; icon: string; sent: Sent; reason: string; }

const TOPIC_PATTERNS: { topic: string; icon: string; keywords: string[] }[] = [
  { topic: 'Oil & Energy',    icon: 'fa-solid fa-oil-can',       keywords: ['oil','crude','opec','energy','gas','petroleum','brent','wti'] },
  { topic: 'US Markets',      icon: 'fa-solid fa-flag-usa',       keywords: ['fed','nasdaq','s&p','dow','wall street','federal reserve','powell','rate','treasury'] },
  { topic: 'JSE',             icon: 'fa-solid fa-chart-line',     keywords: ['jse','jamaica stock','ncb','gracekennedy','sagicor','barita','jmmb','wisynco','seprod'] },
  { topic: 'Crypto',          icon: 'fa-brands fa-bitcoin',       keywords: ['bitcoin','crypto','ethereum','btc','eth','blockchain','digital asset'] },
  { topic: 'Gold',            icon: 'fa-solid fa-coins',          keywords: ['gold','silver','precious metal','bullion','xau'] },
  { topic: 'Caribbean',       icon: 'fa-solid fa-water',          keywords: ['caribbean','trinidad','barbados','carifta','caricom','region'] },
  { topic: 'Geopolitical',    icon: 'fa-solid fa-globe',          keywords: ['war','conflict','sanction','iran','russia','china','tariff','trade war','military'] },
  { topic: 'Tech & AI',       icon: 'fa-solid fa-microchip',      keywords: ['ai','nvidia','apple','microsoft','google','tech','semiconductor','chip','openai'] },
  { topic: 'Real Estate',     icon: 'fa-solid fa-building',       keywords: ['real estate','property','housing','mortgage','reit','construction'] },
  { topic: 'Tourism',         icon: 'fa-solid fa-plane',          keywords: ['tourism','hotel','resort','visitor','sandals','airlines','travel'] },
];

function scoreSentiment(texts: string[]): { pos: number; neg: number; sent: Sent } {
  let pos = 0, neg = 0;
  for (const t of texts) {
    const lower = t.toLowerCase();
    pos += POSITIVE_WORDS.filter(w => lower.includes(w)).length;
    neg += NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  }
  const sent: Sent = pos > neg + 1 ? 'bullish' : neg > pos + 1 ? 'bearish' : 'neutral';
  return { pos, neg, sent };
}

function buildTopicSignals(news: NewsItem[]): TopicSignal[] {
  const out: TopicSignal[] = [];
  for (const pat of TOPIC_PATTERNS) {
    const matches = news.filter(n => {
      const text = (n.title + ' ' + (n.summary ?? '')).toLowerCase();
      return pat.keywords.some(k => text.includes(k));
    });
    if (matches.length < 1) continue;
    const texts = matches.map(m => m.title + ' ' + (m.summary ?? ''));
    const { sent } = scoreSentiment(texts);
    const drivers = matches.slice(0, 2).map(m => m.title.split(' ').slice(0, 6).join(' '));
    out.push({ label: pat.topic, icon: pat.icon, sent, reason: drivers.join(' • ') });
  }
  return out.slice(0, 8);
}

function buildOutlook(news: NewsItem[]): Outlook[] {
  if (news.length === 0) return [];
  const texts = news.map(n => n.title + ' ' + (n.summary ?? ''));

  // TODAY — based on headline count
  const { pos, neg, sent: todaySent } = scoreSentiment(texts);
  const todayMsg = todaySent === 'bullish'
    ? `${pos} bullish signals outweigh ${neg} bearish ones in today's coverage. Markets appear to be trending upward in the near term.`
    : todaySent === 'bearish'
    ? `${neg} bearish signals dominate today's headlines. Short-term pressure is likely as risk sentiment weighs on prices.`
    : `Mixed signals today — ${pos} bullish vs ${neg} bearish. Markets may consolidate before picking a direction.`;

  // 1 WEEK — look at macro/rate keywords
  const macroTexts = texts.filter(t => MACRO_WORDS.some(w => t.toLowerCase().includes(w)));
  let wPos = 0, wNeg = 0;
  for (const t of macroTexts) {
    wPos += MACRO_POS.filter(w => t.toLowerCase().includes(w)).length;
    wNeg += MACRO_NEG.filter(w => t.toLowerCase().includes(w)).length;
  }
  const weekSent: Sent = wPos > wNeg ? 'bullish' : wNeg > wPos ? 'bearish' : 'neutral';
  const weekMsg = weekSent === 'bullish'
    ? `Macro indicators this week lean positive. Rate expectations and economic data suggest room for gains over the next 5–7 trading days.`
    : weekSent === 'bearish'
    ? `Macro headwinds present. Central bank policy or geopolitical factors may dampen sentiment over the coming week.`
    : `No dominant macro theme emerging. Expect range-bound trading with volatility around key data releases this week.`;

  // 1 MONTH — based on geopolitical and structural themes
  const geoTexts = texts.filter(t => ['tariff','sanction','war','inflation','fed','recession','trade'].some(w => t.toLowerCase().includes(w)));
  const { sent: monthSent } = geoTexts.length > 0 ? scoreSentiment(geoTexts) : { sent: 'neutral' as Sent };
  const monthMsg = monthSent === 'bullish'
    ? `Medium-term macro backdrop appears constructive. Absent major shocks, the structural trend over the next 30 days looks positive.`
    : monthSent === 'bearish'
    ? `Structural risks are present — trade tensions, monetary tightening, or geopolitical uncertainty could weigh on sentiment over the month ahead.`
    : `The 30-day outlook is mixed. Watch for earnings seasons, central bank meetings, and regional economic data to set direction.`;

  return [
    { horizon: 'today', sent: todaySent, summary: todayMsg },
    { horizon: 'week',  sent: weekSent,  summary: weekMsg  },
    { horizon: 'month', sent: monthSent, summary: monthMsg },
  ];
}

/* ─── styles ─── */
const SS = {
  bullish: { bg: 'rgba(0,230,118,.08)',  border: 'rgba(0,230,118,.22)', text: '#00e676', dot: '#00e676' },
  bearish: { bg: 'rgba(255,82,82,.08)',  border: 'rgba(255,82,82,.22)', text: '#ff5252', dot: '#ff5252' },
  neutral: { bg: 'rgba(255,215,64,.06)', border: 'rgba(255,215,64,.18)', text: '#ffd740', dot: '#ffd740' },
};

/* ─── components ─── */
function OutlookPanel({ news }: { news: NewsItem[] }) {
  const outlooks = useMemo(() => buildOutlook(news), [news]);
  if (outlooks.length === 0) return null;
  const HORIZON_LABELS = { today: 'Today', week: '1 Week', month: '1 Month' };
  const HORIZON_ICONS  = { today: 'fa-sun', week: 'fa-calendar-week', month: 'fa-calendar' };

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fa-solid fa-robot" style={{ fontSize: 13, color: '#00e676' }} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>AI Market Outlook</p>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>Compiled from {news.length} articles · Updated continuously · Educational only</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0 }}>
        {outlooks.map((o, i) => {
          const ss = SS[o.sent];
          return (
            <div key={o.horizon} style={{ padding: '16px 18px', borderRight: i < outlooks.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <i className={`fa-solid ${HORIZON_ICONS[o.horizon]}`} style={{ fontSize: 12, color: 'var(--color-muted)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{HORIZON_LABELS[o.horizon]}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 800, letterSpacing: '.06em', background: ss.bg, border: `1px solid ${ss.border}`, color: ss.text }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
                  {o.sent === 'bullish' ? 'BULLISH' : o.sent === 'bearish' ? 'BEARISH' : 'MIXED'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text2)', lineHeight: 1.6 }}>{o.summary}</p>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '8px 18px', borderTop: '1px solid rgba(255,255,255,.04)', background: 'rgba(255,255,255,.015)' }}>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', opacity: .6, fontStyle: 'italic' }}>
          <i className="fa-solid fa-shield-halved" style={{ marginRight: 4 }} />
          AI-generated sentiment analysis based on news headlines. Not financial advice. Always do your own research.
        </p>
      </div>
    </div>
  );
}

function SentimentBar({ news }: { news: NewsItem[] }) {
  const signals = useMemo(() => buildTopicSignals(news), [news]);
  if (signals.length === 0) return null;
  const pos = news.filter(n => n.sentiment === 'positive').length;
  const neg = news.filter(n => n.sentiment === 'negative').length;
  const total = news.length || 1;
  const posPct = Math.round((pos / total) * 100);
  const negPct = Math.round((neg / total) * 100);
  const neutPct = 100 - posPct - negPct;
  const overall: Sent = pos > neg * 1.2 ? 'bullish' : neg > pos * 1.2 ? 'bearish' : 'neutral';
  const oss = SS[overall];

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.04)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text)' }}>Sentiment Breakdown</span>
        <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: oss.bg, border: `1px solid ${oss.border}`, color: oss.text }}>
          {overall === 'bullish' ? 'BULLISH' : overall === 'bearish' ? 'BEARISH' : 'MIXED'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
          {[{ l: `${posPct}% Bullish`, c: '#00e676' }, { l: `${neutPct}% Neutral`, c: 'rgba(255,255,255,.3)' }, { l: `${negPct}% Bearish`, c: '#ff5252' }].map(s => (
            <span key={s.l} style={{ fontSize: 10, color: s.c, fontWeight: 700 }}>{s.l}</span>
          ))}
        </div>
      </div>
      <div style={{ height: 4, display: 'flex', gap: 1 }}>
        <div style={{ width: `${posPct}%`, background: '#00e676' }} />
        <div style={{ width: `${neutPct}%`, background: 'rgba(255,255,255,.06)' }} />
        <div style={{ width: `${negPct}%`, background: '#ff5252' }} />
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {signals.map(sig => {
          const ss = SS[sig.sent];
          return (
            <div key={sig.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 10, background: ss.bg, border: `1px solid ${ss.border}`, flex: '0 1 auto' }}>
              <i className={sig.icon} style={{ fontSize: 11, color: ss.text, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: ss.text }}>{sig.label}</span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: ss.dot, flexShrink: 0, boxShadow: `0 0 5px ${ss.dot}` }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: ss.text, textTransform: 'uppercase', letterSpacing: '.07em' }}>{sig.sent}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const sent = item.sentiment;
  const ss = sent === 'positive' ? SS.bullish : sent === 'negative' ? SS.bearish : SS.neutral;
  const sentLabel = sent === 'positive' ? 'Bullish' : sent === 'negative' ? 'Bearish' : 'Neutral';
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '15px 17px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, textDecoration: 'none', cursor: 'pointer', transition: 'all .18s', height: '100%', boxSizing: 'border-box' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ss.border; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(0,0,0,.25)`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
          {sent && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 800, background: ss.bg, border: `1px solid ${ss.border}`, color: ss.text, letterSpacing: '.06em', flexShrink: 0 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
              {sentLabel.toUpperCase()}
            </span>
          )}
          {item.sector && item.sector !== 'General' && (
            <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,.05)', color: 'var(--color-muted)', border: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>{item.sector}</span>
          )}
          {item.symbol && (
            <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 800, background: 'rgba(0,230,118,.06)', color: '#00e676', border: '1px solid rgba(0,230,118,.15)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{item.symbol}</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{ago(item)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.48, color: 'var(--color-text)', flex: 1 }}>{item.title}</p>
      {item.summary && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text2)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{item.summary}</p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.04)' }}>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{item.source}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 8, color: '#00e676' }} />
          <span style={{ fontSize: 10, color: '#00e676', fontWeight: 700 }}>Read</span>
        </div>
      </div>
    </a>
  );
}

/* ─── main ─── */
type Tab = 'caribbean' | 'international';
type SentFilter = 'all' | 'positive' | 'negative' | 'neutral';

export default function News() {
  const [tab, setTab]         = useState<Tab>('caribbean');
  const [filter, setFilter]   = useState<SentFilter>('all');
  const [search, setSearch]   = useState('');

  const { data: news = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ['news'],
    queryFn: () => apiGet('/api/news'),
    refetchInterval: 120_000,
    retry: 1,
  });

  const caribbean = useMemo(() => news.filter(isCaribbean), [news]);
  const intl      = useMemo(() => news.filter(n => !isCaribbean(n)), [news]);
  const current   = tab === 'caribbean' ? caribbean : intl;

  const filtered = useMemo(() => current.filter(n => {
    if (filter !== 'all' && n.sentiment !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || (n.summary ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [current, filter, search]);

  const SENT_TABS: { key: SentFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'positive', label: 'Bullish' },
    { key: 'negative', label: 'Bearish' },
    { key: 'neutral', label: 'Neutral' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Top toggle: Caribbean ↔ International ── */}
      <div style={{ display: 'flex', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 6, gap: 4 }}>
        {([
          { key: 'caribbean',     flag: '🇯🇲', label: 'Caribbean & Jamaica',  sub: `${caribbean.length} articles`,   icon: 'fa-water' },
          { key: 'international', flag: '🌐', label: 'International Markets', sub: `${intl.length} articles`,        icon: 'fa-earth-americas' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setFilter('all'); setSearch(''); }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'all .18s', textAlign: 'left',
              background: tab === t.key ? 'rgba(0,230,118,.1)' : 'transparent',
              boxShadow: tab === t.key ? 'inset 0 0 0 1px rgba(0,230,118,.3)' : 'none' }}>
            <span style={{ fontSize: 22 }}>{t.flag}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: tab === t.key ? '#00e676' : 'var(--color-text)', transition: 'color .15s' }}>{t.label}</p>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>{t.sub}</p>
            </div>
            {tab === t.key && <i className="fa-solid fa-circle-check" style={{ fontSize: 14, color: '#00e676', flexShrink: 0 }} />}
          </button>
        ))}
      </div>

      {/* ── AI Outlook ── */}
      {!isLoading && current.length > 0 && <OutlookPanel news={current} />}

      {/* ── Sentiment breakdown ── */}
      {!isLoading && current.length > 0 && <SentimentBar news={current} />}

      {/* ── Filter / search bar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--color-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab === 'caribbean' ? 'Caribbean' : 'international'} news…`}
            style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 9, fontSize: 12, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.4)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {SENT_TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', border: 'none', background: filter === t.key ? '#00c853' : 'rgba(255,255,255,.05)', color: filter === t.key ? '#04060d' : 'var(--color-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-muted)', flexShrink: 0 }}>{filtered.length} articles</span>
      </div>

      {/* ── News grid ── */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 14 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
          <i className="fa-solid fa-newspaper" style={{ fontSize: 36, color: 'var(--color-muted)', opacity: .25 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text2)', margin: 0 }}>No articles found</p>
          <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: 0 }}>{search ? 'Try a different search term' : 'Check back soon'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, alignItems: 'start' }}>
          {filtered.map((n, i) => <NewsCard key={i} item={n} />)}
        </div>
      )}
    </div>
  );
}
