import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { screener, getSectors } from '@/api/market';
import { useSubscription } from '@/hooks/useSubscription';
import PaywallModal from '@/components/common/PaywallModal';
import { fmtJMD, fmtPercent, fmtInt, fmtLargeNum, changeColor, changeBg } from '@/utils/formatters';
import { SkeletonTable } from '@/components/common/LoadingSpinner';
import StockDetailModal from '@/components/common/StockDetailModal';
import type { Stock } from '@/types';
import { useEffect } from 'react';

export default function Screener() {
  const { hasTier, showPaywall, requiredTier, closePaywall, requireTier } = useSubscription();

  const [filters, setFilters] = useState({
    sector: '',
    minPE: '',
    maxPE: '',
    minDivYield: '',
    maxDivYield: '',
    minChange: '',
    maxChange: '',
    minPrice: '',
    maxPrice: '',
    minVolume: '',
  });
  const [applied, setApplied] = useState<Record<string, unknown>>({});
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  useEffect(() => { requireTier('PRO'); }, [requireTier]);

  const { data: sectors = [] } = useQuery({
    queryKey: ['sectors'],
    queryFn: getSectors,
  });

  const { data: results = [], isLoading, refetch } = useQuery({
    queryKey: ['screener', applied],
    queryFn: () => screener(applied),
    enabled: Object.keys(applied).length > 0,
  });

  const isPro = hasTier('PRO');
  if (showPaywall) return <PaywallModal requiredTier={requiredTier} onClose={closePaywall} />;
  if (!isPro) return null;

  const handleApply = () => {
    const f: Record<string, unknown> = {};
    if (filters.sector) f.sector = filters.sector;
    if (filters.minPE) f.minPE = parseFloat(filters.minPE);
    if (filters.maxPE) f.maxPE = parseFloat(filters.maxPE);
    if (filters.minDivYield) f.minDivYield = parseFloat(filters.minDivYield);
    if (filters.maxDivYield) f.maxDivYield = parseFloat(filters.maxDivYield);
    if (filters.minChange) f.minChange = parseFloat(filters.minChange);
    if (filters.maxChange) f.maxChange = parseFloat(filters.maxChange);
    if (filters.minPrice) f.minPrice = parseFloat(filters.minPrice);
    if (filters.maxPrice) f.maxPrice = parseFloat(filters.maxPrice);
    if (filters.minVolume) f.minVolume = parseInt(filters.minVolume);
    setApplied(f);
  };

  const handleReset = () => {
    setFilters({ sector: '', minPE: '', maxPE: '', minDivYield: '', maxDivYield: '', minChange: '', maxChange: '', minPrice: '', maxPrice: '', minVolume: '' });
    setApplied({});
  };

  const updateFilter = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Filters</h3>
          <div className="flex gap-2">
            <button onClick={handleReset} className="px-3 py-1.5 rounded-lg bg-white/5 text-text-muted text-xs font-semibold hover:bg-white/10">
              Reset
            </button>
            <button onClick={handleApply} className="px-4 py-1.5 rounded-lg bg-gf-green text-bg text-xs font-semibold hover:bg-gf-green/90">
              <i className="fas fa-filter mr-1" />Screen
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Sector */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Sector</label>
            <select
              value={filters.sector}
              onChange={e => updateFilter('sector', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none"
            >
              <option value="">All Sectors</option>
              {sectors.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Price (J$)</label>
            <div className="flex gap-1">
              <input type="number" placeholder="Min" value={filters.minPrice} onChange={e => updateFilter('minPrice', e.target.value)} className="w-1/2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none" />
              <input type="number" placeholder="Max" value={filters.maxPrice} onChange={e => updateFilter('maxPrice', e.target.value)} className="w-1/2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none" />
            </div>
          </div>

          {/* P/E Range */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">P/E Ratio</label>
            <div className="flex gap-1">
              <input type="number" placeholder="Min" value={filters.minPE} onChange={e => updateFilter('minPE', e.target.value)} className="w-1/2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none" />
              <input type="number" placeholder="Max" value={filters.maxPE} onChange={e => updateFilter('maxPE', e.target.value)} className="w-1/2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none" />
            </div>
          </div>

          {/* Div Yield */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Div Yield (%)</label>
            <div className="flex gap-1">
              <input type="number" placeholder="Min" value={filters.minDivYield} onChange={e => updateFilter('minDivYield', e.target.value)} className="w-1/2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none" />
              <input type="number" placeholder="Max" value={filters.maxDivYield} onChange={e => updateFilter('maxDivYield', e.target.value)} className="w-1/2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none" />
            </div>
          </div>

          {/* Change % */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Change (%)</label>
            <div className="flex gap-1">
              <input type="number" placeholder="Min" value={filters.minChange} onChange={e => updateFilter('minChange', e.target.value)} className="w-1/2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none" />
              <input type="number" placeholder="Max" value={filters.maxChange} onChange={e => updateFilter('maxChange', e.target.value)} className="w-1/2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Results {results.length > 0 && <span className="text-text-muted font-normal">({results.length})</span>}
          </h3>
        </div>

        {isLoading ? <SkeletonTable rows={5} /> : Object.keys(applied).length === 0 ? (
          <div className="py-12 text-center text-text-muted text-xs">
            <i className="fas fa-filter text-2xl mb-3 block" />
            Set your filters and click "Screen" to find stocks
          </div>
        ) : results.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-xs">
            <i className="fas fa-search text-2xl mb-3 block" />
            No stocks match your criteria
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-white/5">
                  <th className="py-2 px-3 text-left">Symbol</th>
                  <th className="py-2 px-3 text-left hidden md:table-cell">Name</th>
                  <th className="py-2 px-3 text-right">Price</th>
                  <th className="py-2 px-3 text-right">Change</th>
                  <th className="py-2 px-3 text-right hidden sm:table-cell">Volume</th>
                  <th className="py-2 px-3 text-right hidden lg:table-cell">P/E</th>
                  <th className="py-2 px-3 text-right hidden lg:table-cell">Div Yield</th>
                  <th className="py-2 px-3 text-right hidden lg:table-cell">Mkt Cap</th>
                  <th className="py-2 px-3 text-center hidden md:table-cell">Sector</th>
                </tr>
              </thead>
              <tbody>
                {results.map((s: Stock) => (
                  <tr
                    key={s.symbol}
                    onClick={() => setSelectedStock(s)}
                    className="border-b border-white/[0.02] hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-semibold text-text-primary">{s.symbol}</td>
                    <td className="py-2.5 px-3 text-text-secondary hidden md:table-cell">{s.name}</td>
                    <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtJMD(s.price)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-num font-semibold ${changeBg(s.changePercent)} ${changeColor(s.changePercent)}`}>
                        {fmtPercent(s.changePercent)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-text-secondary hidden sm:table-cell">{fmtInt(s.volume)}</td>
                    <td className="py-2.5 px-3 text-right font-num text-text-secondary hidden lg:table-cell">{s.peRatio?.toFixed(1) ?? '—'}</td>
                    <td className="py-2.5 px-3 text-right font-num text-text-secondary hidden lg:table-cell">{s.dividendYield ? fmtPercent(s.dividendYield) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-num text-text-secondary hidden lg:table-cell">{fmtLargeNum(s.marketCap)}</td>
                    <td className="py-2.5 px-3 text-center hidden md:table-cell text-text-muted">{s.sector ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedStock && <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} />}
    </div>
  );
}
