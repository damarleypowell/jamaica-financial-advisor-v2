import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDividends } from '@/api/market';
import { fmtJMD, fmtPercent, fmtDate, changeColor } from '@/utils/formatters';
import { SkeletonTable } from '@/components/common/LoadingSpinner';
import type { DividendInfo } from '@/types';

type SortKey = 'symbol' | 'exDate' | 'amount' | 'yield';
type Tab = 'upcoming' | 'yield';

export default function Dividends() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [sortKey, setSortKey] = useState<SortKey>('exDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: dividends = [], isLoading } = useQuery({
    queryKey: ['dividends'],
    queryFn: getDividends,
    refetchInterval: 300_000,
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'yield' || key === 'amount' ? 'desc' : 'asc'); }
  };

  const sorted = useMemo(() => {
    let list = [...dividends];
    if (tab === 'yield') {
      list = list.filter(d => d.yield != null).sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0));
    } else {
      list.sort((a, b) => {
        if (sortKey === 'symbol') return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
        if (sortKey === 'exDate') return sortDir === 'asc' ? new Date(a.exDate).getTime() - new Date(b.exDate).getTime() : new Date(b.exDate).getTime() - new Date(a.exDate).getTime();
        if (sortKey === 'amount') return sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount;
        if (sortKey === 'yield') return sortDir === 'asc' ? (a.yield ?? 0) - (b.yield ?? 0) : (b.yield ?? 0) - (a.yield ?? 0);
        return 0;
      });
    }
    return list;
  }, [dividends, tab, sortKey, sortDir]);

  // Upcoming dividends (next 90 days)
  const upcoming = useMemo(() => {
    const now = Date.now();
    const cutoff = now + 90 * 86400000;
    return dividends.filter(d => {
      const t = new Date(d.exDate).getTime();
      return t >= now && t <= cutoff;
    }).sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime());
  }, [dividends]);

  // Top yields
  const topYields = useMemo(() =>
    [...dividends].filter(d => d.yield != null && (d.yield ?? 0) > 0).sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0)).slice(0, 10),
    [dividends]
  );

  const SortIcon = ({ col }: { col: SortKey }) => (
    sortKey === col
      ? <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'} ml-1 text-gf-green text-[10px]`} />
      : <i className="fas fa-sort ml-1 text-text-muted text-[10px]" />
  );

  if (isLoading) return <SkeletonTable rows={8} />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Total Dividends</p>
          <p className="text-lg font-bold text-text-primary">{dividends.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Upcoming (90d)</p>
          <p className="text-lg font-bold text-gf-green">{upcoming.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Top Yield</p>
          <p className="text-lg font-bold text-gf-gold font-num">{topYields[0] ? fmtPercent(topYields[0].yield) : '—'}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Top Yielder</p>
          <p className="text-lg font-bold text-text-primary">{topYields[0]?.symbol ?? '—'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['upcoming', 'yield'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
            }`}
          >
            {t === 'yield' ? 'Yield Rankings' : 'Upcoming Dividends'}
          </button>
        ))}
      </div>

      {tab === 'upcoming' && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Dividend Calendar</h3>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-white/5">
                  <th className="py-2 px-3 text-left cursor-pointer hover:text-text-secondary" onClick={() => toggleSort('symbol')}>
                    Symbol <SortIcon col="symbol" />
                  </th>
                  <th className="py-2 px-3 text-left hidden md:table-cell">Name</th>
                  <th className="py-2 px-3 text-left cursor-pointer hover:text-text-secondary" onClick={() => toggleSort('exDate')}>
                    Ex-Date <SortIcon col="exDate" />
                  </th>
                  <th className="py-2 px-3 text-left hidden sm:table-cell">Pay Date</th>
                  <th className="py-2 px-3 text-right cursor-pointer hover:text-text-secondary" onClick={() => toggleSort('amount')}>
                    Amount <SortIcon col="amount" />
                  </th>
                  <th className="py-2 px-3 text-right cursor-pointer hover:text-text-secondary" onClick={() => toggleSort('yield')}>
                    Yield <SortIcon col="yield" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d, i) => (
                  <tr key={`${d.symbol}-${i}`} className="border-b border-white/[0.02] hover:bg-white/[0.03]">
                    <td className="py-2.5 px-3 font-semibold text-text-primary">{d.symbol}</td>
                    <td className="py-2.5 px-3 text-text-secondary hidden md:table-cell">{d.name || '—'}</td>
                    <td className="py-2.5 px-3 text-text-primary">{fmtDate(d.exDate)}</td>
                    <td className="py-2.5 px-3 text-text-secondary hidden sm:table-cell">{d.payDate ? fmtDate(d.payDate) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtJMD(d.amount)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {d.yield != null ? (
                        <span className="text-gf-green font-num font-semibold">{fmtPercent(d.yield)}</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-text-muted">No dividend data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'yield' && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Top Dividend Yields</h3>
          <div className="space-y-2">
            {topYields.map((d, i) => (
              <div key={`${d.symbol}-${i}`} className="flex items-center justify-between bg-white/[0.03] rounded-lg p-3 hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gf-gold/10 flex items-center justify-center text-xs font-bold text-gf-gold">
                    #{i + 1}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{d.symbol}</p>
                    <p className="text-[10px] text-text-muted">{d.name || 'JSE Listed'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gf-green font-num">{fmtPercent(d.yield)}</p>
                  <p className="text-[10px] text-text-muted font-num">{fmtJMD(d.amount)} per share</p>
                </div>
              </div>
            ))}
            {topYields.length === 0 && (
              <div className="py-8 text-center text-text-muted text-xs">No yield data available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
