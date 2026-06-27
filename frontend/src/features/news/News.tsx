import { useState, useMemo, useEffect, type MouseEvent, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import type { NewsItem } from '../../types';

const HEAD = "'Syne', sans-serif";

/* ─── source classification ─── */
const LOCAL_SOURCES = new Set([
  'Jamaica Gleaner', 'Jamaica Observer', 'Loop Jamaica', 'RJR News',
  'JSE', 'Loop News Jamaica', 'The Gleaner', 'Observer',
]);

function isCaribbean(item: NewsItem): boolean {
  if (item.region === 'caribbean') return true;
  if (LOCAL_SOURCES.has(item.source)) return true;
  const s = item.source.toLowerCase();
  return s.includes('gleaner') || s.includes('observer') || s.includes('loop') ||
    s.includes('rjr') || s.includes('jse') || s.includes('jamaic') ||
    s.includes('caribbean') || s.includes('barbados') || s.includes('trinidad');
}

function ago(item: NewsItem): string {
  if (item.time && item.time !== 'Today') return item.time;
  const d = item.publishedAt ?? item.date ?? item.scrapedAt;
  if (!d) return 'Today';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function imgOf(item: NewsItem): string | undefined {
  const u = item.imageUrl || item.image;
  return u && /^https?:\/\//.test(u) ? u : undefined;
}

/* Only ever follow http(s) links — scraped URLs are untrusted (block javascript:/data:). */
function safeUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try { const p = new URL(u, window.location.origin); return /^https?:$/.test(p.protocol) ? p.href : undefined; }
  catch { return undefined; }
}

/* Tidy scraped copy for DISPLAY (entities/tags). Not a security sanitizer — output
   is rendered as React text children, which React escapes. */
function tidyText(s?: string): string {
  if (!s) return '';
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&hellip;/gi, '…').replace(/&mdash;/gi, '—').replace(/&ndash;/gi, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ─── sentiment system (single source of truth) ─── */
type Sent = 'bullish' | 'bearish' | 'neutral';
const SENT_COLOR: Record<Sent, string> = { bullish: '#00e676', bearish: '#ff5252', neutral: '#ffd740' };
function sentOf(item: NewsItem): Sent {
  if (item.sentiment === 'positive') return 'bullish';
  if (item.sentiment === 'negative') return 'bearish';
  // Fall back to the backend's numeric score when the label is absent/neutral.
  const score = item.sentimentScore ?? item.score;
  if (typeof score === 'number' && score !== 0) return score > 0 ? 'bullish' : 'bearish';
  return 'neutral';
}

/* ─── source identity: deterministic brand-palette avatar ─── */
const AVATAR_COLORS = ['#00e676', '#40c4ff', '#ffd740', '#ce93d8', '#18ffff', '#ff8a65'];
function hashStr(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function sourceColor(s: string): string { return AVATAR_COLORS[hashStr(s) % AVATAR_COLORS.length]; }
function sourceInitials(s: string): string {
  const parts = s.replace(/[^a-zA-Z ]/g, '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function SourceAvatar({ source, size = 26 }: { source: string; size?: number }) {
  const c = sourceColor(source);
  return (
    <span aria-hidden style={{
      width: size, height: size, flexShrink: 0, borderRadius: 8,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, letterSpacing: '-.02em',
      color: c, background: `${c}1c`, border: `1px solid ${c}3a`,
      fontFamily: HEAD,
    }}>{sourceInitials(source)}</span>
  );
}

function TickerChip({ symbol, sent }: { symbol: string; sent: Sent }) {
  const c = SENT_COLOR[sent];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6,
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, letterSpacing: '.02em',
      color: c, background: `${c}14`, border: `1px solid ${c}33`,
    }}>
      <i className="fa-solid fa-arrow-trend-up" style={{ fontSize: 8 }} />{symbol}
    </span>
  );
}

/* ─── article thumbnail with graceful fallback ─── */
function Thumb({ item, ratio = '16 / 10', radius = 14, fill = false }: { item: NewsItem; ratio?: string; radius?: number; fill?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = imgOf(item);
  const sent = sentOf(item);
  const c = SENT_COLOR[sent];
  const frame: CSSProperties = fill
    ? { position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', background: `radial-gradient(120% 120% at 20% 0%, ${c}1f, transparent 60%), var(--color-bg3)` }
    : { position: 'relative', width: '100%', aspectRatio: ratio, borderRadius: radius, overflow: 'hidden', background: `radial-gradient(120% 120% at 20% 0%, ${c}1f, transparent 60%), var(--color-bg3)` };
  return (
    <div style={frame}>
      {src && !broken ? (
        <>
          <img src={src} alt="" loading="lazy" onError={() => setBroken(true)}
            onLoad={e => { const { naturalWidth: w, naturalHeight: h } = e.currentTarget; if (w < 320 || h < 180 || w / h > 3) setBroken(true); }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: `${c}`, mixBlendMode: 'multiply', opacity: .12 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(var(--surf),.82) 0%, rgba(var(--surf),.14) 55%, transparent 100%)' }} />
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-regular fa-newspaper" style={{ fontSize: 30, color: c, opacity: .35 }} />
        </div>
      )}
    </div>
  );
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

// Topic sentiment uses the SAME source of truth as everything else (sentOf →
// the backend's sentiment/score), so a topic chip can never disagree with the
// header badge on the same articles.
function topicSent(news: NewsItem[], keywords: string[]): { count: number; sent: Sent } {
  const matches = news.filter(n => {
    const t = (n.title + ' ' + (n.summary ?? '')).toLowerCase();
    return keywords.some(k => t.includes(k));
  });
  let pos = 0, neg = 0;
  for (const m of matches) {
    const s = sentOf(m);
    if (s === 'bullish') pos++; else if (s === 'bearish') neg++;
  }
  return { count: matches.length, sent: pos > neg * 1.2 ? 'bullish' : neg > pos * 1.2 ? 'bearish' : 'neutral' };
}

function MoodStrip({ news }: { news: NewsItem[] }) {
  const { posPct, neutPct, negPct, overall, topics } = useMemo(() => {
    const pos = news.filter(n => sentOf(n) === 'bullish').length;
    const neg = news.filter(n => sentOf(n) === 'bearish').length;
    const total = news.length || 1;
    const posPct = Math.round((pos / total) * 100);
    const negPct = Math.round((neg / total) * 100);
    const overall: Sent = pos > neg * 1.2 ? 'bullish' : neg > pos * 1.2 ? 'bearish' : 'neutral';
    const topics = TOPIC_PATTERNS
      .map(p => ({ topic: p.topic, ...topicSent(news, p.keywords) }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { posPct, neutPct: Math.max(0, 100 - posPct - negPct), negPct, overall, topics };
  }, [news]);

  const oc = SENT_COLOR[overall];
  const label = overall === 'bullish' ? 'Bullish' : overall === 'bearish' ? 'Bearish' : 'Mixed';

  return (
    <div style={{ position: 'relative', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '15px 18px', display: 'flex', flexDirection: 'column', gap: 13, overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', top: -40, right: -20, width: 180, height: 180, background: `radial-gradient(circle, ${oc}14, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.14em' }}>Market mood</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${oc}1a`, border: `1px solid ${oc}3a`, color: oc }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: oc, boxShadow: `0 0 6px ${oc}`, animation: 'pulse 2.4s ease-in-out infinite' }} />
          {label}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: '#00e676' }}><i className="fa-solid fa-caret-up" style={{ marginRight: 4 }} />{posPct}%<span style={{ fontWeight: 700, opacity: .6, fontSize: 9, marginLeft: 3 }}>BULL</span></span>
          <span style={{ color: 'var(--color-text2)' }}><i className="fa-solid fa-minus" style={{ marginRight: 4, opacity: .6 }} />{neutPct}%<span style={{ fontWeight: 700, opacity: .6, fontSize: 9, marginLeft: 3 }}>FLAT</span></span>
          <span style={{ color: '#ff5252' }}><i className="fa-solid fa-caret-down" style={{ marginRight: 4 }} />{negPct}%<span style={{ fontWeight: 700, opacity: .6, fontSize: 9, marginLeft: 3 }}>BEAR</span></span>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', display: 'flex', gap: 2, background: 'rgba(var(--fg),.04)', position: 'relative' }}>
        <div style={{ width: `${posPct}%`, background: 'linear-gradient(90deg,#00b248,#00e676)' }} />
        <div style={{ width: `${neutPct}%`, background: 'rgba(var(--fg),.09)' }} />
        <div style={{ width: `${negPct}%`, background: 'linear-gradient(90deg,#ff5252,#c62828)' }} />
      </div>
      {topics.length > 0 && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', position: 'relative' }}>
          {topics.map(t => {
            const c = SENT_COLOR[t.sent];
            return (
              <span key={t.topic} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--color-text2)', padding: '4px 10px', borderRadius: 999, background: 'rgba(var(--fg),.03)', border: '1px solid var(--color-border)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                {t.topic}
                <span style={{ color: 'var(--color-muted)', fontSize: 10, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{t.count}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── meta line ─── */
function Meta({ item, light }: { item: NewsItem; light?: boolean }) {
  const sent = sentOf(item);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: light ? 'rgba(255,255,255,.7)' : 'var(--color-muted)', flexWrap: 'wrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: SENT_COLOR[sent], flexShrink: 0, boxShadow: `0 0 5px ${SENT_COLOR[sent]}80` }} />
      <span style={{ fontWeight: 700, color: light ? '#fff' : 'var(--color-text2)' }}>{item.source}</span>
      <span style={{ opacity: .5 }}>·</span>
      <span>{ago(item)}</span>
      {item.symbol && <TickerChip symbol={item.symbol} sent={sent} />}
    </div>
  );
}

const cardHover = {
  enter: (e: MouseEvent<HTMLAnchorElement>, glow = 'rgba(0,230,118,.32)') => {
    e.currentTarget.style.borderColor = glow;
    e.currentTarget.style.transform = 'translateY(-3px)';
    e.currentTarget.style.boxShadow = '0 12px 40px -12px rgba(0,230,118,.22), 0 4px 14px rgba(0,0,0,.4)';
  },
  leave: (e: MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.borderColor = 'var(--color-border)';
    e.currentTarget.style.transform = '';
    e.currentTarget.style.boxShadow = '';
  },
};

/* ─── lead story (editorial, image-aware) ─── */
function LeadStory({ item }: { item: NewsItem }) {
  const [imgBroken, setImgBroken] = useState(false);
  const src = imgOf(item);
  const showImg = !!src && !imgBroken;      // collapse to text-forward if the image fails
  const c = SENT_COLOR[sentOf(item)];
  // Text-forward lead gets an intentional tinted wash so the absence of art
  // reads as design, never as a broken/empty media well.
  const surface = showImg
    ? 'var(--color-bg2)'
    : `linear-gradient(135deg, ${c}0f, transparent 55%), var(--color-bg2)`;
  return (
    <a href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer" className={`news-rise news-lead${showImg ? '' : ' no-img'}`}
      style={{ background: surface, border: '1px solid var(--color-border)', borderRadius: 20, textDecoration: 'none',
        overflow: 'hidden', transition: 'border-color .2s, transform .2s, box-shadow .2s' }}
      onMouseEnter={e => cardHover.enter(e)} onMouseLeave={cardHover.leave}>
      {showImg && (
        <div style={{ position: 'relative', minHeight: 250, background: `radial-gradient(120% 120% at 20% 0%, ${c}1f, transparent 60%), var(--color-bg3)` }}>
          <img src={src} alt="" loading="lazy" onError={() => setImgBroken(true)}
            onLoad={e => {
              // Source "images" are frequently publisher logos/wide banners — too
              // small or too wide to work as a hero crop. Fall back to text-forward.
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w < 480 || h < 260 || w / h > 2.6) setImgBroken(true);
            }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: c, mixBlendMode: 'multiply', opacity: .12 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(var(--surf),.82) 0%, rgba(var(--surf),.12) 55%, transparent 100%)' }} />
          <span style={{ position: 'absolute', top: 16, left: 16, fontSize: 10, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--color-bg)', background: '#00e676', padding: '4px 10px', borderRadius: 6, zIndex: 1 }}>Top Story</span>
        </div>
      )}
      <div style={{ padding: showImg ? '24px 26px' : '28px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 13 }}>
        {!showImg && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#00e676' }}>
            <i className="fa-solid fa-bolt" style={{ fontSize: 10 }} />Top Story
          </span>
        )}
        <h2 style={{ margin: 0, fontFamily: HEAD, fontWeight: 700, fontSize: showImg ? 'clamp(20px, 3.2vw, 28px)' : 'clamp(22px, 3.6vw, 32px)', lineHeight: 1.14, letterSpacing: '-.02em', color: 'var(--color-text)', WebkitFontSmoothing: 'antialiased' }}>
          {tidyText(item.title)}
        </h2>
        {tidyText(item.summary) && (
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--color-text2)', display: '-webkit-box', WebkitLineClamp: showImg ? 3 : 4, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{tidyText(item.summary)}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <SourceAvatar source={item.source} size={30} />
          <Meta item={item} />
          <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-muted)' }} />
        </div>
      </div>
    </a>
  );
}

/* ─── featured card (medium, with thumb) ─── */
function FeatureCard({ item, i }: { item: NewsItem; i: number }) {
  return (
    <a href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer" className="news-rise"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, textDecoration: 'none', height: '100%', boxSizing: 'border-box', transition: 'border-color .18s, transform .18s, box-shadow .18s', animationDelay: `${i * 50}ms` }}
      onMouseEnter={e => cardHover.enter(e)} onMouseLeave={cardHover.leave}>
      <Thumb item={item} ratio="16 / 9" />
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.34, letterSpacing: '-.01em', color: 'var(--color-text)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{tidyText(item.title)}</h3>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
        <SourceAvatar source={item.source} size={24} />
        <Meta item={item} />
      </div>
    </a>
  );
}

/* ─── compact headline row ─── */
function HeadlineCard({ item, i }: { item: NewsItem; i: number }) {
  return (
    <a href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer" className="news-rise"
      style={{ display: 'flex', gap: 13, padding: '14px 15px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, textDecoration: 'none', height: '100%', boxSizing: 'border-box', transition: 'border-color .15s, transform .15s, box-shadow .15s', animationDelay: `${Math.min(i, 12) * 35}ms` }}
      onMouseEnter={e => cardHover.enter(e, 'rgba(var(--fg),.2)')} onMouseLeave={cardHover.leave}>
      <SourceAvatar source={item.source} size={38} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-.005em', color: 'var(--color-text)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{tidyText(item.title)}</p>
        <div style={{ marginTop: 'auto' }}><Meta item={item} /></div>
      </div>
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
  const [stuck, setStuck]   = useState(false);

  const { data: news = [], isLoading, isError, refetch, isRefetching, dataUpdatedAt } = useQuery<NewsItem[]>({
    queryKey: ['news'],
    queryFn: () => apiGet('/api/news'),
    refetchInterval: 120_000,
    retry: 1,
  });

  // Only flip `stuck` on the boundary crossing, not on every scroll frame.
  useEffect(() => {
    let on = false;
    const onScroll = () => {
      const next = window.scrollY > 8;
      if (next !== on) { on = next; setStuck(next); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const caribbean = useMemo(() => news.filter(isCaribbean), [news]);
  const intl      = useMemo(() => news.filter(n => !isCaribbean(n)), [news]);
  const current   = tab === 'caribbean' ? caribbean : intl;

  const filtered = useMemo(() => current.filter(n => {
    if (filter !== 'all') {
      const want = filter === 'positive' ? 'bullish' : filter === 'negative' ? 'bearish' : 'neutral';
      if (sentOf(n) !== want) return false;  // match what the dots actually show
    }
    if (search) {
      const q = search.toLowerCase();
      return tidyText(n.title).toLowerCase().includes(q) || tidyText(n.summary).toLowerCase().includes(q) || (n.symbol ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [current, filter, search]);

  // Editorial split: hero, two featured, the rest. Prefer an image-backed lead.
  const lead = useMemo(() => filtered.find(n => imgOf(n)) ?? filtered[0], [filtered]);
  const afterLead = useMemo(() => filtered.filter(n => n !== lead), [filtered, lead]);
  const featured = afterLead.slice(0, 2);
  const rest = afterLead.slice(2);

  const SENT_TABS: { key: SentFilter; label: string; dot?: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'positive', label: 'Bullish', dot: '#00e676' },
    { key: 'negative', label: 'Bearish', dot: '#ff5252' },
    { key: 'neutral', label: 'Neutral', dot: '#ffd740' },
  ];

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'caribbean', label: 'Caribbean', count: caribbean.length },
    { key: 'international', label: 'International', count: intl.length },
  ];

  const updated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const updatedLabel = updated ? updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1120, margin: '0 auto', width: '100%' }}>
      <style>{`
        .news-rise { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }
        .news-chip:focus-visible, a.news-rise:focus-visible { outline: 2px solid #00e676; outline-offset: 2px; }
        .news-lead { display: grid; grid-template-columns: 1.05fr 1fr; }
        .news-lead.no-img { grid-template-columns: 1fr; }
        /* Sit just below the fixed app header (desktop ticker+header = 88px, mobile = 56px). */
        .news-sticky { top: 88px; }
        @media (max-width: 900px) { .news-sticky { top: 56px; } }
        @media (max-width: 760px) { .news-lead { grid-template-columns: 1fr; } }
        @media (prefers-reduced-motion: reduce) { .news-rise { animation: none; } }
      `}</style>

      {/* Masthead */}
      <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 'clamp(24px,5vw,30px)', fontWeight: 700, letterSpacing: '-.02em', color: 'var(--color-text)', WebkitFontSmoothing: 'antialiased' }}>Market News</h1>
              <button className="news-chip" onClick={() => refetch()} disabled={isRefetching} title="Refresh headlines"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#00e676', background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.22)', padding: '3px 9px', borderRadius: 999, cursor: isRefetching ? 'default' : 'pointer' }}>
                {isRefetching
                  ? <i className="fa-solid fa-arrows-rotate" style={{ fontSize: 9, animation: 'spin .8s linear infinite' }} />
                  : <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 6px #00e676', animation: 'pulse 2s ease-in-out infinite' }} />}
                {isRefetching ? 'SYNCING' : 'LIVE'}
              </button>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
              {today} · Caribbean &amp; global markets{updatedLabel ? ` · updated ${updatedLabel}` : ''}
            </p>
          </div>
          <div style={{ display: 'inline-flex', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 3 }}>
            {TABS.map(t => (
              <button key={t.key} className="news-chip" onClick={() => { setTab(t.key); setFilter('all'); setSearch(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, transition: 'background .15s, color .15s',
                  background: tab === t.key ? 'rgba(0,230,118,.12)' : 'transparent',
                  color: tab === t.key ? '#00e676' : 'var(--color-text2)' }}>
                {t.label}
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', padding: '1px 6px', borderRadius: 999, background: tab === t.key ? 'rgba(0,230,118,.16)' : 'rgba(var(--fg),.05)', color: tab === t.key ? '#00e676' : 'var(--color-muted)' }}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Market mood */}
      {!isLoading && current.length > 0 && <MoodStrip news={current} />}

      {/* Sticky controls — offset below the fixed app header via .news-sticky */}
      <div className="news-sticky" style={{ position: 'sticky', zIndex: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
        padding: stuck ? '10px 12px' : '2px 0', margin: stuck ? '0 -12px' : 0, borderRadius: 14,
        background: stuck ? 'rgba(var(--surf),.92)' : 'transparent', backdropFilter: stuck ? 'blur(14px)' : 'none',
        border: stuck ? '1px solid var(--color-border)' : '1px solid transparent', boxShadow: stuck ? '0 8px 24px -12px rgba(0,0,0,.5)' : 'none', transition: 'background .2s, padding .2s, border-color .2s' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 170 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--color-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search headlines or ticker…"
            className="news-chip"
            style={{ width: '100%', paddingLeft: 35, paddingRight: 12, height: 40, background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 11, fontSize: 13, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.45)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')} />
        </div>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
          {SENT_TABS.map(t => {
            const on = filter === t.key;
            return (
              <button key={t.key} className="news-chip" onClick={() => setFilter(t.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background .15s, color .15s, border-color .15s', border: '1px solid', borderColor: on ? 'transparent' : 'var(--color-border)', background: on ? '#00e676' : 'var(--color-bg2)', color: on ? 'var(--color-bg)' : 'var(--color-text2)' }}>
                {t.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? 'var(--color-bg)' : t.dot }} />}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton" style={{ height: 240, borderRadius: 20 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 14 }} />)}
          </div>
        </div>
      ) : isError && news.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,82,82,.08)', border: '1px solid rgba(255,82,82,.18)' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 24, color: '#ff5252', opacity: .7 }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0, fontFamily: HEAD }}>Couldn’t load the news feed</p>
          <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: 0 }}>Check your connection — the wire will be back shortly.</p>
          <button className="news-chip" onClick={() => refetch()} disabled={isRefetching}
            style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(0,230,118,.3)', background: 'rgba(0,230,118,.1)', color: '#00e676', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            <i className="fa-solid fa-arrows-rotate" style={{ fontSize: 11, animation: isRefetching ? 'spin .8s linear infinite' : 'none' }} />
            {isRefetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,.07)', border: '1px solid rgba(0,230,118,.16)' }}>
            <i className="fa-regular fa-newspaper" style={{ fontSize: 26, color: '#00e676', opacity: .6 }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0, fontFamily: HEAD }}>No headlines found</p>
          <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: 0 }}>{search ? `Nothing matches “${search}”` : 'Fresh stories land here every few minutes'}</p>
          {(search || filter !== 'all') && (
            <button className="news-chip" onClick={() => { setSearch(''); setFilter('all'); }}
              style={{ marginTop: 4, padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(0,230,118,.3)', background: 'rgba(0,230,118,.1)', color: '#00e676', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {lead && <LeadStory item={lead} />}

          {featured.length > 0 && (
            /* Raised, tinted band breaks the same-tone monotony down the page */
            <div style={{ background: 'rgba(var(--fg),.02)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '16px 16px 18px', margin: '2px 0' }}>
              <SectionRule label="Featured" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginTop: 12 }}>
                {featured.map((n, i) => <FeatureCard key={n.id ?? n.url} item={n} i={i} />)}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div>
              <SectionRule label="Latest headlines" count={rest.length} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginTop: 12, alignItems: 'stretch' }}>
                {rest.slice(0, 9).map((n, i) => <HeadlineCard key={n.id ?? n.url} item={n} i={i} />)}
              </div>
            </div>
          )}

          {rest.length > 9 && (
            <div>
              <SectionRule label="Earlier" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginTop: 12, alignItems: 'stretch' }}>
                {rest.slice(9).map((n, i) => <HeadlineCard key={n.id ?? n.url} item={n} i={i} />)}
              </div>
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-muted)', margin: '6px 0 4px' }}>
            Headlines aggregated from public sources for education. Not investment advice.{' '}
            <Link to="/learn" style={{ color: '#00e676', textDecoration: 'none', fontWeight: 600 }}>Learn how to read the market →</Link>
          </p>
        </div>
      )}
    </div>
  );
}

function SectionRule({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-text2)' }}>{label}</span>
      {count != null && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)', padding: '1px 7px', borderRadius: 999, background: 'rgba(var(--fg),.05)' }}>{count}</span>}
      <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--color-border), transparent)' }} />
    </div>
  );
}
