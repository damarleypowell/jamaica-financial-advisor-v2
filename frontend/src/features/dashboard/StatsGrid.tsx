import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface MarketOverview {
  jseIndex: number;
  jseIndexChange: number;
  totalVolume: number;
  volumeChange: number;
  advancers: number;
  decliners: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  change?: number;
  suffix?: string;
}

/* ------------------------------------------------------------------ */
/*  StatCard                                                          */
/* ------------------------------------------------------------------ */

function StatCard({ icon, iconBg, label, value, change, suffix }: StatCardProps) {
  const changeColor =
    change === undefined || change === 0
      ? 'text-zinc-400'
      : change > 0
        ? 'text-emerald-400'
        : 'text-red-400';

  const changePrefix = change !== undefined && change > 0 ? '+' : '';

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 backdrop-blur-sm p-4 flex items-start gap-3.5">
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold font-mono text-white mt-0.5 truncate">{value}</p>
        {change !== undefined && (
          <p className={`text-xs font-medium mt-0.5 ${changeColor}`}>
            {changePrefix}
            {change.toFixed(2)}
            {suffix ?? '%'}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                             */
/* ------------------------------------------------------------------ */

function ChartIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  StatsGrid                                                         */
/* ------------------------------------------------------------------ */

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function StatsGrid() {
  const { data, isLoading } = useQuery<MarketOverview>({
    queryKey: ['market-overview'],
    queryFn: () => apiGet<MarketOverview>('/api/market-overview'),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 backdrop-blur-sm p-4 h-24 animate-pulse"
          >
            <div className="h-3 w-20 bg-zinc-800 rounded mb-3" />
            <div className="h-6 w-28 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      <StatCard
        icon={<ChartIcon />}
        iconBg="bg-emerald-500/15"
        label="JSE Index"
        value={data.jseIndex.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        change={data.jseIndexChange}
      />
      <StatCard
        icon={<VolumeIcon />}
        iconBg="bg-amber-500/15"
        label="Total Volume"
        value={formatNumber(data.totalVolume)}
        change={data.volumeChange}
      />
      <StatCard
        icon={<UpIcon />}
        iconBg="bg-blue-500/15"
        label="Advancers"
        value={data.advancers.toString()}
      />
      <StatCard
        icon={<DownIcon />}
        iconBg="bg-purple-500/15"
        label="Decliners"
        value={data.decliners.toString()}
      />
    </div>
  );
}
