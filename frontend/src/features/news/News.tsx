import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import type { NewsItem } from '../../types';

const HEAD = "'Syne', sans-serif";

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

/* ─── topic signals (compact mood strip) ─── */
const TOPIC_PATTERNS: { topic: string; keywords: string[] }[] = [
  { topic: 'JSE',          keywords: ['jse','jamaica stock','ncb','gracekennedy','sagicor','barita','jmmb','wisynco','seprod'] },
  { topic: 'US Markets',   keywords: ['fed','nasdaq','s&p','dow','wall street','federal reserve','powell','rate','treasury'] },
  { topic: 'Oil & Energy', keywords: ['oil','crude','opec','energy','gas','petroleum','brent','wti'] },
  { topic: 'Crypto',       keywords: ['bitcoin','crypto','ethereum','btc','eth','blockchain'] },
  { topic: 'Tech & AI',    keywords: ['ai','nvidia','apple','microsoft','google','tech','semiconductor','chip','openai'] },
  { topic: 'Tourism',      keywords: ['tourism','hotel','resort','visitor','sandals','airlines','travel'] },
];

const POSITIVE_WORDS = ['surge','rally','gain','rise','high','record','profit','growth','strong','beat','upgrade','bull','recover','boost','expand','jump','soar','climb','outperform'];
const NEGATIVE_WORDS = ['fall','drop','crash','slump','loss','deficit','risk','war','sanction','decline','weak','cut','below','miss','debt','default','layoff','bear','plunge','sink','contract'];

type Sent = 'bullish' | 'bearish' | 'neutral';

function topicSent(news: NewsItem[], keywords: string[]): { count: number; sent: Sent } {
  const matches = news.filter(n => {
    const t = (n.title + ' ' + (n.summary ?? '')).toLowerCase();
    return keywords.some(k => t.includes(k));
  });
  let pos = 0, neg = 0;
  for (const m of matches) {
    const t = (m.title + ' ' + (m.summary ?? '')).toLowerCase();
    pos += POSITIVE_WORDS.filter(w => t.includes(w)).length;
    neg += NEGATIVE_WORDS.filter(w => t.includes(w)).length;
  }
  return { count: matches.length, sent: pos > neg + 1 ? 'bullish' : neg > pos + 1 ? 'bearish' : 'neutral' };
}

const SENT_COLOR: Record<Sent, string> = { bullish: '#00e676', bearish: '#ff5252', neutral: '#ffd740' };

/* ─── compact market-mood strip (replaces the two big AI panels) ─── */
function MoodStrip({ news }: { news: NewsItem[] }) {
  const { posPct, neutPct, negPct, overall, topics } = useMemo(() => {
    const pos = news.filter(n => n.sentiment === 'positive').length;
    const neg = news.filter(n => n.sentiment === 'negative').length;
    const total = news.length || 1;
    const posPct = Math.round((pos / total) * 100);
    const negPct = Math.round((neg / total) * 100);
    const overall: Sent = pos > neg * 1.2 ? 'bullish' : neg > pos * 1.2 ? 'bearish' : 'neutral';
    const topics = TOPIC_PATTERNS
      .map(p => ({ topic: p.topic, ...topicSent(news, p.keywords) }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    return { posPct, neutPct: 100 - posPct - negPct, negPct, overall, topics };
  }, [news]);

  const oc = SENT_COLOR[overall];
  const label = overall === 'bullish' ? 'Bullish' : overall === 'bearish' ? 'Bearish' : 'Mixed';

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Market mood</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${oc}1a`, border: `1px solid ${oc}3a`, color: oc }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: oc, boxShadow: `0 0 6px ${oc}` }} />
          {label}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: '#00e676' }}>{posPct}%</span>
          <span style={{ color: 'rgba(255,255,255,.3)' }}>{neutPct}%</span>
          <span style={{ color: '#ff5252' }}>{negPct}%</span>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 999, overflow: 'hidden', display: 'flex', gap: 1, background: 'rgba(255,255,255,.04)' }}>
        <div style={{ width: `${posPct}%`, background: '#00e676' }} />
        <div style={{ width: `${neutPct}%`, background: 'rgba(255,255,255,.08)' }} />
        <div style={{ width: `${negPct}%`, background: '#ff5252' }} />
      </div>
      {topics.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {topics.map(t => {
            const c = SENT_COLOR[t.sent];
            return (
              <span key={t.topic} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--color-text2)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                {t.topic}
                <span style={{ color: 'var(--color-muted)', fontSize: 10 }}>· {t.count}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── meta line shared by lead + list ─── */
function Meta({ item }: { item: NewsItem }) {
  const c = item.sentiment === 'positive' ? '#00e676' : item.sentiment === 'negative' ? '#ff5252' : '#ffd740';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-muted)' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
      <span style={{ fontWeight: 700, color: 'var(--color-text2)' }}>{item.source}</span>
      <span>·</span>
      <span>{ago(item)}</span>
      {item.symbol && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00e676' }}>{item.symbol}</span>}
    </div>
  );
}

/* ─── lead story (first article, editorial treatment) ─── */
function LeadStory({ item }: { item: NewsItem }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'block', padding: '20px 22px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, textDecoration: 'none', transition: 'border-color .18s, transform .18s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,230,118,.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = ''; }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#00e676' }}>Top story</span>
      <h2 style={{ margin: '8px 0 10px', fontFamily: HEAD, fontWeight: 700, fontSize: 'clamp(18px, 4.5vw, 24px)', lineHeight: 1.22, letterSpacing: '-0.01em', color: 'var(--color-text)', WebkitFontSmoothing: 'antialiased' }}>
        {item.title}
      </h2>
      {item.summary && (
        <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-text2)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{item.summary}</p>
      )}
      <Meta item={item} />
    </a>
  );
}

/* ─── compact list row ─── */
function NewsRow({ item }: { item: NewsItem }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 13, textDecoration: 'none', transition: 'border-color .15s, transform .15s', height: '100%', boxSizing: 'border-box' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.16)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = ''; }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.42, color: 'var(--color-text)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{item.title}</p>
      <div style={{ marginTop: 'auto' }}><Meta item={item} /></div>
    </a>
  );
}

/* ─── main ─── */
type Tab = 'caribbean' | 'international';
type SentFilter = 'all' | 'positive' | 'negative' | 'neutral';

export default function News() {
  const [tab, setTab]       = useState<Tab>('caribbean');
  const [filter, setFilter] = useState<SentFilter>('all');
  const [search, setSearch] = useState('');

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

  const lead = filtered[0];
  const rest = filtered.slice(1);

  const SENT_TABS: { key: SentFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'positive', label: 'Bullish' },
    { key: 'negative', label: 'Bearish' },
    { key: 'neutral', label: 'Neutral' },
  ];

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'caribbean', label: 'Caribbean', count: caribbean.length },
    { key: 'international', label: 'International', count: intl.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000, margin: '0 auto', width: '100%' }}>

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text)', WebkitFontSmoothing: 'antialiased' }}>Market News</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>Caribbean &amp; global headlines, with live sentiment.</p>
        </div>
        {/* Segmented region toggle (no emoji) */}
        <div style={{ display: 'inline-flex', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 11, padding: 3 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setFilter('all'); setSearch(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, transition: 'all .15s',
                background: tab === t.key ? 'rgba(0,230,118,.12)' : 'transparent',
                color: tab === t.key ? '#00e676' : 'var(--color-text2)' }}>
              {t.label}
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 999, background: tab === t.key ? 'rgba(0,230,118,.16)' : 'rgba(255,255,255,.05)', color: tab === t.key ? '#00e676' : 'var(--color-muted)' }}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Compact market mood */}
      {!isLoading && current.length > 0 && <MoodStrip news={current} />}

      {/* Filter + search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--color-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search headlines…"
            style={{ width: '100%', paddingLeft: 34, paddingRight: 12, height: 38, background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.4)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')} />
        </div>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {SENT_TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{ padding: '8px 13px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s', border: '1px solid', borderColor: filter === t.key ? 'transparent' : 'var(--color-border)', background: filter === t.key ? '#00e676' : 'var(--color-bg2)', color: filter === t.key ? '#04060d' : 'var(--color-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton" style={{ height: 150, borderRadius: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 13 }} />)}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 0', gap: 12 }}>
          <i className="fa-solid fa-newspaper" style={{ fontSize: 34, color: 'var(--color-muted)', opacity: .25 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text2)', margin: 0 }}>No articles found</p>
          <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: 0 }}>{search ? 'Try a different search term' : 'Check back soon'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lead && <LeadStory item={lead} />}
          {rest.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, alignItems: 'stretch' }}>
              {rest.map((n, i) => <NewsRow key={i} item={n} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
