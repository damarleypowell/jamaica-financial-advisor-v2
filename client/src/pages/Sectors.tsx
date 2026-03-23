import { useQuery } from '@tanstack/react-query';
import { getSectors } from '@/api/market';
import { fmtPercent, fmtInt, fmtLargeNum, changeColor, changeBg } from '@/utils/formatters';
import { SECTOR_COLORS } from '@/utils/constants';
import { SkeletonCard } from '@/components/common/LoadingSpinner';
import type { Sector } from '@/types';

export default function Sectors() {
  const { data: sectors = [], isLoading } = useQuery({
    queryKey: ['sectors'],
    queryFn: getSectors,
    refetchInterval: 60_000,
  });

  const sorted = [...sectors].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const maxAbsChange = Math.max(...sectors.map(s => Math.abs(s.changePercent || 0)), 1);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Bars */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Sector Performance</h3>
        <div className="space-y-3">
          {sorted.map(s => {
            const pct = s.changePercent ?? 0;
            const barWidth = Math.max(2, (Math.abs(pct) / maxAbsChange) * 100);
            const color = SECTOR_COLORS[s.name] || '#9e9e9e';
            return (
              <div key={s.name} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold text-text-primary group-hover:text-gf-green transition-colors">{s.name}</span>
                    <span className="text-[10px] text-text-muted">{s.stockCount} stocks</span>
                  </div>
                  <span className={`text-xs font-num font-semibold ${changeColor(pct)}`}>{fmtPercent(pct)}</span>
                </div>
                <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: pct >= 0 ? '#00c853' : '#ff1744',
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map(s => {
          const color = SECTOR_COLORS[s.name] || '#9e9e9e';
          return (
            <div key={s.name} className="glass-card p-5 hover:border-white/10 transition-colors group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary group-hover:text-gf-green transition-colors">{s.name}</h4>
                  <p className="text-[10px] text-text-muted">{s.stockCount} listed stocks</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Change</p>
                  <p className={`text-sm font-bold font-num ${changeColor(s.changePercent)}`}>{fmtPercent(s.changePercent)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Volume</p>
                  <p className="text-sm font-bold font-num text-text-primary">{fmtLargeNum(s.totalVolume)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Market Cap</p>
                  <p className="text-sm font-bold font-num text-text-primary">{fmtLargeNum(s.marketCap)}</p>
                </div>
              </div>

              {/* Mini bar */}
              <div className="mt-3 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(5, (Math.abs(s.changePercent || 0) / maxAbsChange) * 100)}%`,
                    backgroundColor: (s.changePercent ?? 0) >= 0 ? '#00c853' : '#ff1744',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {sectors.length === 0 && !isLoading && (
        <div className="glass-card p-12 text-center text-text-muted text-xs">
          <i className="fas fa-layer-group text-3xl mb-3 block" />
          No sector data available
        </div>
      )}
    </div>
  );
}
