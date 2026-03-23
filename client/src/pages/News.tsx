import { useQuery } from '@tanstack/react-query';
import { getNews } from '@/api/market';
import { fmtRelativeTime } from '@/utils/formatters';
import { SkeletonCard } from '@/components/common/LoadingSpinner';
import { useState } from 'react';
import type { NewsItem } from '@/types';

type SentimentFilter = 'all' | 'positive' | 'negative' | 'neutral';

export default function News() {
  const [filter, setFilter] = useState<SentimentFilter>('all');
  const [search, setSearch] = useState('');

  const { data: news = [], isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: getNews,
    refetchInterval: 120_000,
  });

  const filtered = news.filter((n: NewsItem) => {
    if (filter !== 'all' && n.sentiment !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q) || n.symbols?.some(s => s.toLowerCase().includes(q));
    }
    return true;
  });

  const sentimentBadge = (sentiment?: string) => {
    if (!sentiment) return null;
    const styles = {
      positive: 'bg-gf-green/10 text-gf-green',
      negative: 'bg-red-500/10 text-red-400',
      neutral: 'bg-gf-gold/10 text-gf-gold',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[sentiment as keyof typeof styles] || 'bg-white/5 text-text-muted'}`}>
        {sentiment === 'positive' ? 'Bullish' : sentiment === 'negative' ? 'Bearish' : 'Neutral'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
            <input
              type="text"
              placeholder="Search news..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary placeholder:text-text-muted focus:border-gf-green/50 focus:outline-none"
            />
          </div>

          {/* Sentiment Filter */}
          <div className="flex gap-1">
            {(['all', 'positive', 'negative', 'neutral'] as SentimentFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-[11px] font-semibold capitalize transition-colors ${
                  filter === f ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
                }`}
              >
                {f === 'positive' ? 'Bullish' : f === 'negative' ? 'Bearish' : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* News Grid */}
      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-text-muted text-xs">
          <i className="fas fa-newspaper text-3xl mb-3 block" />
          No news articles found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((n: NewsItem, i: number) => (
            <a
              key={i}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card p-5 group hover:border-white/10 transition-all block"
            >
              {/* Image */}
              {n.imageUrl && (
                <div className="h-36 rounded-lg overflow-hidden mb-3 -mx-1 -mt-1">
                  <img src={n.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                {sentimentBadge(n.sentiment)}
                <span className="text-[10px] text-text-muted">{n.source}</span>
                <span className="text-[10px] text-text-muted ml-auto">{fmtRelativeTime(n.publishedAt)}</span>
              </div>

              {/* Title */}
              <h4 className="text-sm font-semibold text-text-primary group-hover:text-gf-green transition-colors leading-snug mb-2">
                {n.title}
              </h4>

              {/* Description */}
              {n.description && (
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-3 mb-3">{n.description}</p>
              )}

              {/* Related symbols */}
              {n.symbols && n.symbols.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {n.symbols.map(sym => (
                    <span key={sym} className="px-1.5 py-0.5 rounded bg-gf-blue/10 text-gf-blue text-[10px] font-semibold">
                      {sym}
                    </span>
                  ))}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
