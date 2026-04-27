import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { useMarketStore } from '../../stores/market';

interface MarketOverview {
  jseIndex: number;
  jseIndexChange: number;
  totalVolume: number;
  volumeChange: number;
  advancers: number;
  decliners: number;
  unchanged?: number;
  marketCap?: number;
}

interface StatCardProps {
  icon: string;
  iconBg: string;
  accentColor: string;
  label: string;
  value: string;
  subLabel?: string;
  change?: number;
  changeSuffix?: string;
  extra?: React.ReactNode;
}

function StatCard({
  icon, iconBg, accentColor, label, value, subLabel, change, changeSuffix, extra,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const changePrefix = isPositive ? '+' : '';
  const ArrowIcon = isPositive
    ? 'fa-solid fa-arrow-trend-up'
    : isNegative
    ? 'fa-solid fa-arrow-trend-down'
    : null;

  return (
    <div className="relative rounded-xl border border-border bg-card backdrop-blur-sm p-4 overflow-hidden group hover:border-border2 transition-colors">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${accentColor}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <i className={`${icon} text-sm`} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isPositive ? 'bg-green/10 text-green' : isNegative ? 'bg-red/10 text-red' : 'bg-glass2 text-muted'
          }`}>
            {ArrowIcon && <i className={`${ArrowIcon} text-[9px]`} />}
            {changePrefix}{Math.abs(change).toFixed(2)}{changeSuffix ?? '%'}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold font-mono text-text leading-none mb-1">{value}</p>
      <p className="text-xs text-muted font-medium uppercase tracking-wide">{label}</p>
      {subLabel && <p className="text-[11px] text-muted mt-1 truncate">{subLabel}</p>}
      {extra}
    </div>
  );
}

function BreadthBar({ advancers, decliners, unchanged = 0 }: { advancers: number; decliners: number; unchanged?: number }) {
  const total = advancers + decliners + unchanged;
  if (total === 0) return null;
  const advPct = (advancers / total) * 100;
  const declPct = (decliners / total) * 100;
  return (
    <div className="mt-2.5">
      <div className="h-1.5 rounded-full bg-glass2 overflow-hidden flex">
        <div className="bg-green h-full rounded-l-full transition-all" style={{ width: `${advPct}%` }} />
        <div className="bg-red h-full rounded-r-full transition-all" style={{ width: `${declPct}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-muted">
        <span className="text-green">{advancers} up</span>
        <span className="text-red">{decliners} down</span>
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatMktCap(n?: number): string {
  if (!n) return '--';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + n.toLocaleString();
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 h-[120px] animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="w-9 h-9 bg-glass2 rounded-lg" />
        <div className="w-14 h-5 bg-glass2 rounded-full" />
      </div>
      <div className="h-7 w-24 bg-glass2 rounded mb-1.5" />
      <div className="h-3 w-16 bg-glass2 rounded" />
    </div>
  );
}

export default function StatsGrid() {
  const { data, isLoading } = useQuery<MarketOverview>({
    queryKey: ['market-overview'],
    queryFn: () => apiGet<MarketOverview>('/api/market-overview'),
    refetchInterval: 30_000,
  });

  const stocks = useMarketStore((s) => s.stocks);
  const liveAdvancers = stocks.filter((s) => s.pctChange > 0).length;
  const liveDecliners = stocks.filter((s) => s.pctChange < 0).length;
  const liveUnchanged = stocks.filter((s) => s.pctChange === 0).length;

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const advancers = data.advancers || liveAdvancers;
  const decliners = data.decliners || liveDecliners;
  const unchanged = data.unchanged ?? liveUnchanged;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        icon="fa-solid fa-chart-line"
        iconBg="bg-green/10 text-green"
        accentColor="bg-green"
        label="JSE Index"
        value={data.jseIndex.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        change={data.jseIndexChange}
        subLabel="Jamaica Stock Exchange"
      />
      <StatCard
        icon="fa-solid fa-chart-column"
        iconBg="bg-gold/10 text-gold"
        accentColor="bg-gold"
        label="Market Volume"
        value={formatNumber(data.totalVolume)}
        change={data.volumeChange}
        subLabel="Total shares traded"
      />
      <StatCard
        icon="fa-solid fa-scale-balanced"
        iconBg="bg-blue/10 text-blue"
        accentColor="bg-blue"
        label="Market Breadth"
        value={`${advancers}/${decliners}`}
        subLabel={`${unchanged} unchanged`}
        extra={<BreadthBar advancers={advancers} decliners={decliners} unchanged={unchanged} />}
      />
      <StatCard
        icon="fa-solid fa-building-columns"
        iconBg="bg-purple/10 text-purple"
        accentColor="bg-purple"
        label="Market Cap"
        value={formatMktCap(data.marketCap)}
        subLabel={`${stocks.length} listed securities`}
      />
    </div>
  );
}
