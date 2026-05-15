import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import type { NewsItem } from '../../types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const LOCAL_SOURCES = new Set([
  'Jamaica Gleaner', 'Jamaica Observer', 'Loop Jamaica', 'RJR News',
  'JSE', 'Loop News Jamaica', 'The Gleaner', 'Observer',
]);

function isLocal(item: NewsItem): boolean {
  if (LOCAL_SOURCES.has(item.source)) return true;
  const s = item.source.toLowerCase();
  return s.includes('gleaner') || s.includes('observer') || s.includes('loop') ||
    s.includes('rjr') || s.includes('jse') || s.includes('jamaic');
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

/* ------------------------------------------------------------------ */
/*  Sentiment signals derived from headlines                           */
/* ------------------------------------------------------------------ */

interface Signal { label: string; icon: string; sent: 'bullish' | 'bearish' | 'neutral'; reason: string; }

const TOPIC_PATTERNS: { topic: string; icon: string; keywords: string[] }[] = [
  { topic: 'Oil & Energy',    icon: 'fa-solid fa-oil-can',           keywords: ['oil','crude','opec','energy','gas','petroleum','brent','wti'] },
  { topic: 'US Markets',      icon: 'fa-solid fa-flag-usa',           keywords: ['fed','nasdaq','s&p','dow','wall street','federal reserve','powell','rate','treasury'] },
  { topic: 'JSE',             icon: 'fa-solid fa-chart-line',         keywords: ['jse','jamaica stock','ncb','gracekennedy','sagicor','barita','jmmb','wisynco','seprod'] },
  { topic: 'Crypto',          icon: 'fa-brands fa-bitcoin',           keywords: ['bitcoin','crypto','ethereum','btc','eth','blockchain','digital asset'] },
  { topic: 'Gold',            icon: 'fa-solid fa-coins',              keywords: ['gold','silver','precious metal','bullion','xau'] },
  { topic: 'Caribbean',       icon: 'fa-solid fa-water',              keywords: ['caribbean','trinidad','barbados','carifta','caricom','region'] },
  { topic: 'Geopolitical',    icon: 'fa-solid fa-globe',              keywords: ['war','conflict','sanction','iran','russia','china','tariff','trade war','military'] },
  { topic: 'Tech',            icon: 'fa-solid fa-microchip',          keywords: ['ai','nvidia','apple','microsoft','google','tech','semiconductor','chip'] },
];

const POSITIVE_WORDS = ['surge','rally','gain','rise','high','record','profit','growth','strong','beat','upgrade','bull','recover','boost','expand','jump'];
const NEGATIVE_WORDS = ['fall','drop','crash','slump','loss','deficit','risk','war','sanction','decline','weak','cut','below','miss','debt','default','layoff','bear'];

function buildSignals(news: NewsItem[]): Signal[] {
  const signals: Signal[] = [];

  for (const pattern of TOPIC_PATTERNS) {
    const matches = news.filter(n => {
      const text = (n.title + ' ' + (n.summary ?? '')).toLowerCase();
      return pattern.keywords.some(k => text.includes(k));
    });
    if (matches.length < 2) continue;

    let pos = 0, neg = 0;
    const drivers: string[] = [];
    for (const m of matches) {
      const text = (m.title + ' ' + (m.summary ?? '')).toLowerCase();
      const p = POSITIVE_WORDS.filter(w => text.includes(w)).length;
      const n = NEGATIVE_WORDS.filter(w => text.includes(w)).length;
      pos += p; neg += n;
      // Collect short phrases as "drivers" (first 5 words of headline)
      const short = m.title.split(' ').slice(0, 6).join(' ');
      if (!drivers.includes(short) && drivers.length < 2) drivers.push(short);
    }

    const sent: Signal['sent'] = pos > neg + 1 ? 'bullish' : neg > pos + 1 ? 'bearish' : 'neutral';
    const reason = drivers.join(' • ') || `${matches.length} stories`;
    signals.push({ label: pattern.topic, icon: pattern.icon, sent, reason });
  }

  return signals.slice(0, 6);
}

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

const SENT_STYLE = {
  bullish: { bg: 'rgba(0,230,118,.1)',   border: 'rgba(0,230,118,.25)',  text: 'var(--color-green)', dot: '#00e676' },
  bearish: { bg: 'rgba(255,82,82,.1)',   border: 'rgba(255,82,82,.25)',  text: 'var(--color-red)',   dot: '#ff5252' },
  neutral: { bg: 'rgba(255,215,64,.07)', border: 'rgba(255,215,64,.2)',  text: 'var(--color-gold)',  dot: '#ffd740' },
};

function SentimentBanner({ news }: { news: NewsItem[] }) {
  const signals = useMemo(() => buildSignals(news), [news]);
  if (signals.length === 0) return null;

  const pos = news.filter(n => n.sentiment === 'positive').length;
  const neg = news.filter(n => n.sentiment === 'negative').length;
  const total = news.length || 1;
  const posPct = Math.round((pos / total) * 100);
  const negPct = Math.round((neg / total) * 100);
  const neutralPct = 100 - posPct - negPct;
  const overall: Signal['sent'] = pos > neg * 1.2 ? 'bullish' : neg > pos * 1.2 ? 'bearish' : 'neutral';
  const overallStyle = SENT_STYLE[overall];

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: overallStyle.bg, border: `1px solid ${overallStyle.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`fa-solid ${overall === 'bullish' ? 'fa-arrow-trend-up' : overall === 'bearish' ? 'fa-arrow-trend-down' : 'fa-minus'}`}
              style={{ fontSize: 11, color: overallStyle.text }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>Market Sentiment</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>Based on {news.length} articles across all sources</p>
          </div>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: '.06em', background: overallStyle.bg, border: `1px solid ${overallStyle.border}`, color: overallStyle.text }}>
          {overall === 'bullish' ? 'BULLISH' : overall === 'bearish' ? 'BEARISH' : 'MIXED'}
        </span>
      </div>

      {/* Breadth bar */}
      <div style={{ padding: '10px 20px 6px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', gap: 1 }}>
          <div style={{ width: `${posPct}%`, background: '#00e676', transition: 'width .6s ease' }} />
          <div style={{ width: `${neutralPct}%`, background: 'rgba(255,255,255,.1)' }} />
          <div style={{ width: `${negPct}%`, background: '#ff5252', transition: 'width .6s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 10, color: 'var(--color-green)' }}><strong>{posPct}%</strong> Bullish</span>
          <span style={{ fontSize: 10, color: 'var(--color-muted)' }}><strong>{neutralPct}%</strong> Neutral</span>
          <span style={{ fontSize: 10, color: 'var(--color-red)' }}><strong>{negPct}%</strong> Bearish</span>
        </div>
      </div>

      {/* Topic signals */}
      <div style={{ padding: '10px 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {signals.map(sig => {
          const ss = SENT_STYLE[sig.sent];
          return (
            <div key={sig.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderRadius: 12, background: ss.bg, border: `1px solid ${ss.border}`, flex: '1 1 220px', minWidth: 180 }}>
              <i className={sig.icon} style={{ fontSize: 13, color: ss.text, marginTop: 2, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: ss.text }}>{sig.label}</span>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: ss.dot, display: 'inline-block', boxShadow: `0 0 6px ${ss.dot}` }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: ss.text, letterSpacing: '.08em', textTransform: 'uppercase' }}>{sig.sent}</span>
                </div>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,.45)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{sig.reason}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const sent = item.sentiment;
  const ss = sent === 'positive' ? SENT_STYLE.bullish : sent === 'negative' ? SENT_STYLE.bearish : SENT_STYLE.neutral;
  const sentLabel = sent === 'positive' ? 'Bullish' : sent === 'negative' ? 'Bearish' : 'Neutral';

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, textDecoration: 'none', cursor: 'pointer', transition: 'all .2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ss.border}`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.transform = ''; }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {sent && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 800, background: ss.bg, border: `1px solid ${ss.border}`, color: ss.text, letterSpacing: '.06em' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
              {sentLabel.toUpperCase()}
            </span>
          )}
          {item.sector && item.sector !== 'General' && (
            <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,.05)', color: 'var(--color-muted)', border: '1px solid rgba(255,255,255,.06)', letterSpacing: '.04em' }}>{item.sector}</span>
          )}
          {item.symbol && (
            <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 800, background: 'rgba(0,230,118,.06)', color: 'var(--color-green)', border: '1px solid rgba(0,230,118,.15)', fontFamily: 'var(--font-mono)' }}>{item.symbol}</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{ago(item)}</span>
      </div>

      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.45, color: 'var(--color-text)' }}>{item.title}</p>

      {item.summary && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text2)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{item.summary}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{item.source}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 8, color: 'var(--color-green)' }} />
          <span style={{ fontSize: 10, color: 'var(--color-green)', fontWeight: 700 }}>Read</span>
        </div>
      </div>
    </a>
  );
}

function SectionHeader({ title, icon, count, flag }: { title: string; icon: string; count: number; flag?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {flag ? <span style={{ fontSize: 16 }}>{flag}</span> : <i className={icon} style={{ fontSize: 12, color: 'var(--color-green)' }} />}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>{title}</p>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>{count} article{count !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

type SentFilter = 'all' | 'positive' | 'negative' | 'neutral';

export default function News() {
  const [filter, setFilter]   = useState<SentFilter>('all');
  const [search, setSearch]   = useState('');

  const { data: news = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ['news'],
    queryFn: () => apiGet('/api/news'),
    refetchInterval: 120_000,
    retry: 1,
  });

  const filtered = useMemo(() => news.filter(n => {
    if (filter !== 'all' && n.sentiment !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || (n.summary ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [news, filter, search]);

  const local = useMemo(() => filtered.filter(isLocal), [filtered]);
  const intl  = useMemo(() => filtered.filter(n => !isLocal(n)), [filtered]);

  const TABS: { key: SentFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'positive', label: 'Bullish' },
    { key: 'negative', label: 'Bearish' },
    { key: 'neutral', label: 'Neutral' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Sentiment Dashboard */}
      {!isLoading && news.length > 0 && <SentimentBanner news={news} />}

      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--color-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search news..."
            style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 9, fontSize: 12, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.4)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')} />
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{ padding: '6px 13px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', border: 'none', background: filter === t.key ? 'var(--color-green)' : 'rgba(255,255,255,.05)', color: filter === t.key ? 'var(--color-bg)' : 'var(--color-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-muted)', flexShrink: 0 }}>{filtered.length} articles</span>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 14 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
          <i className="fa-solid fa-newspaper" style={{ fontSize: 32, color: 'var(--color-muted)', opacity: .3 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text2)', margin: 0 }}>No news found</p>
          <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: 0 }}>{search ? 'Try a different search term' : 'Check back soon'}</p>
        </div>
      ) : (
        <>
          {/* Local News */}
          {local.length > 0 && (
            <section>
              <SectionHeader title="Jamaica & Caribbean" icon="fa-solid fa-map-pin" count={local.length} flag="🇯🇲" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {local.map((n, i) => <NewsCard key={i} item={n} />)}
              </div>
            </section>
          )}

          {/* Divider */}
          {local.length > 0 && intl.length > 0 && (
            <div style={{ height: 1, background: 'rgba(255,255,255,.04)', margin: '4px 0' }} />
          )}

          {/* International News */}
          {intl.length > 0 && (
            <section>
              <SectionHeader title="International Markets" icon="fa-solid fa-earth-americas" count={intl.length} flag="🌐" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {intl.map((n, i) => <NewsCard key={i} item={n} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
