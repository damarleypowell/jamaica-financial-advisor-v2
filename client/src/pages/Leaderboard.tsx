import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, getStocks } from '@/api/market';
import { useSSE } from '@/hooks/useSSE';
import { fmtJMD, fmtPercent, fmtInt, fmtLargeNum, changeColor, changeBg } from '@/utils/formatters';
import { SkeletonTable } from '@/components/common/LoadingSpinner';
import { useState } from 'react';
import StockDetailModal from '@/components/common/StockDetailModal';
import type { Stock } from '@/types';

type Tab = 'gainers' | 'losers' | 'volume';

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>('gainers');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const { stocks: liveStocks } = useSSE();

  const { data: leaderboard, isLoading: lbLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
    refetchInterval: 60_000,
  });

  const { data: fetchedStocks = [] } = useQuery({
    queryKey: ['stocks'],
    queryFn: getStocks,
    refetchInterval: 60_000,
  });

  const stocks = liveStocks.length > 0 ? liveStocks : fetchedStocks;

  const gainers = leaderboard?.gainers || [...stocks].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)).slice(0, 15);
  const losers = leaderboard?.losers || [...stocks].sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0)).slice(0, 15);
  const byVolume = [...stocks].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 15);

  const list = tab === 'gainers' ? gainers : tab === 'losers' ? losers : byVolume;
  const isLoading = lbLoading;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center cursor-pointer hover:border-gf-green/20 transition-colors" onClick={() => setTab('gainers')}>
          <div className="w-10 h-10 rounded-xl bg-gf-green/10 flex items-center justify-center mx-auto mb-2">
            <i className="fas fa-arrow-up text-gf-green" />
          </div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Top Gainer</p>
          <p className="text-sm font-bold text-gf-green">{gainers[0]?.symbol ?? '—'}</p>
          <p className="text-xs font-num text-gf-green">{gainers[0] ? fmtPercent(gainers[0].changePercent) : '—'}</p>
        </div>
        <div className="glass-card p-4 text-center cursor-pointer hover:border-red-500/20 transition-colors" onClick={() => setTab('losers')}>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-2">
            <i className="fas fa-arrow-down text-red-400" />
          </div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Top Loser</p>
          <p className="text-sm font-bold text-red-400">{losers[0]?.symbol ?? '—'}</p>
          <p className="text-xs font-num text-red-400">{losers[0] ? fmtPercent(losers[0].changePercent) : '—'}</p>
        </div>
        <div className="glass-card p-4 text-center cursor-pointer hover:border-gf-blue/20 transition-colors" onClick={() => setTab('volume')}>
          <div className="w-10 h-10 rounded-xl bg-gf-blue/10 flex items-center justify-center mx-auto mb-2">
            <i className="fas fa-exchange-alt text-gf-blue" />
          </div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Most Active</p>
          <p className="text-sm font-bold text-gf-blue">{byVolume[0]?.symbol ?? '—'}</p>
          <p className="text-xs font-num text-text-secondary">{byVolume[0] ? fmtLargeNum(byVolume[0].volume) : '—'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['gainers', 'losers', 'volume'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
            }`}
          >
            {t === 'volume' ? 'Most Active' : `Top ${t}`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card p-4">
        {isLoading ? <SkeletonTable rows={10} /> : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-white/5">
                  <th className="py-2 px-3 text-center w-10">#</th>
                  <th className="py-2 px-3 text-left">Symbol</th>
                  <th className="py-2 px-3 text-left hidden md:table-cell">Name</th>
                  <th className="py-2 px-3 text-right">Price</th>
                  <th className="py-2 px-3 text-right">Change</th>
                  <th className="py-2 px-3 text-right">%</th>
                  <th className="py-2 px-3 text-right hidden sm:table-cell">Volume</th>
                  <th className="py-2 px-3 text-right hidden lg:table-cell">Mkt Cap</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s: Stock, i: number) => (
                  <tr
                    key={s.symbol}
                    onClick={() => setSelectedStock(s)}
                    className="border-b border-white/[0.02] hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                        i < 3 ? 'bg-gf-gold/10 text-gf-gold' : 'bg-white/5 text-text-muted'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-text-primary">{s.symbol}</td>
                    <td className="py-2.5 px-3 text-text-secondary hidden md:table-cell">{s.name}</td>
                    <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtJMD(s.price)}</td>
                    <td className={`py-2.5 px-3 text-right font-num ${changeColor(s.change)}`}>{s.change >= 0 ? '+' : ''}{fmtJMD(s.change)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-num font-semibold ${changeBg(s.changePercent)} ${changeColor(s.changePercent)}`}>
                        {fmtPercent(s.changePercent)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-text-secondary hidden sm:table-cell">{fmtInt(s.volume)}</td>
                    <td className="py-2.5 px-3 text-right font-num text-text-secondary hidden lg:table-cell">{fmtLargeNum(s.marketCap)}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-text-muted">No data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedStock && <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} />}
    </div>
  );
}
