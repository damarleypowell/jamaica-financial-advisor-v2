import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPositions, getTransactionHistory, getWalletBalance, deposit, withdraw } from '@/api/orders';
import { useAuth } from '@/context/AuthContext';
import { fmt, fmtJMD, fmtUSD, fmtPercent, fmtInt, fmtCurrency, fmtDateTime, changeColor, changeBg } from '@/utils/formatters';
import { SECTOR_COLORS, CHART_COLORS } from '@/utils/constants';
import { SkeletonTable } from '@/components/common/LoadingSpinner';
import type { Position, Transaction } from '@/types';
import toast from 'react-hot-toast';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

type Tab = 'holdings' | 'history' | 'wallet';

export default function Portfolio() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('holdings');
  const [walletAction, setWalletAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [walletAmount, setWalletAmount] = useState('');

  const { data: positions = [], isLoading: posLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
    enabled: isAuthenticated,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: getTransactionHistory,
    enabled: isAuthenticated && tab === 'history',
  });

  const { data: wallets = [], isLoading: walletLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: getWalletBalance,
    enabled: isAuthenticated,
  });

  const depositMut = useMutation({
    mutationFn: ({ amount, currency }: { amount: number; currency: string }) => deposit(amount, currency),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wallets'] }); toast.success('Deposit successful'); setWalletAction(null); setWalletAmount(''); },
    onError: () => toast.error('Deposit failed'),
  });

  const withdrawMut = useMutation({
    mutationFn: ({ amount, currency }: { amount: number; currency: string }) => withdraw(amount, currency),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wallets'] }); toast.success('Withdrawal successful'); setWalletAction(null); setWalletAmount(''); },
    onError: () => toast.error('Withdrawal failed'),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <i className="fas fa-briefcase text-4xl text-text-muted mb-4" />
        <h2 className="text-xl font-bold text-text-primary mb-2">Portfolio</h2>
        <p className="text-sm text-text-secondary">Please log in to view your portfolio.</p>
      </div>
    );
  }

  // Portfolio summary
  const totalValue = positions.reduce((sum, p) => sum + (p.marketValue ?? p.shares * (p.currentPrice ?? p.avgCost)), 0);
  const totalCost = positions.reduce((sum, p) => sum + p.shares * p.avgCost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Sector allocation
  const sectorMap = new Map<string, number>();
  positions.forEach(p => {
    const sector = p.market === 'US' ? 'US Stocks' : 'JSE';
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + (p.marketValue ?? p.shares * (p.currentPrice ?? p.avgCost)));
  });
  const sectorLabels = Array.from(sectorMap.keys());
  const sectorValues = Array.from(sectorMap.values());

  const pieData = {
    labels: sectorLabels,
    datasets: [{
      data: sectorValues,
      backgroundColor: sectorLabels.map((s, i) => SECTOR_COLORS[s] || CHART_COLORS[i % CHART_COLORS.length]),
      borderWidth: 0,
    }],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: '#8892a0', font: { size: 11 }, padding: 12 } },
    },
  };

  const handleWalletSubmit = () => {
    const amount = parseFloat(walletAmount);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    if (walletAction === 'deposit') depositMut.mutate({ amount, currency: 'JMD' });
    else withdrawMut.mutate({ amount, currency: 'JMD' });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Portfolio Value</p>
          <p className="text-lg font-bold text-text-primary font-num">{fmtJMD(totalValue)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Total Cost</p>
          <p className="text-lg font-bold text-text-primary font-num">{fmtJMD(totalCost)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Unrealized P&L</p>
          <p className={`text-lg font-bold font-num ${changeColor(totalPnL)}`}>{fmtJMD(totalPnL)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Return</p>
          <p className={`text-lg font-bold font-num ${changeColor(totalPnLPct)}`}>{fmtPercent(totalPnLPct)}</p>
        </div>
      </div>

      {/* Wallet Balances */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Wallet</h3>
          <div className="flex gap-2">
            <button onClick={() => setWalletAction('deposit')} className="px-3 py-1 rounded-lg bg-gf-green/20 text-gf-green text-xs font-semibold hover:bg-gf-green/30">
              <i className="fas fa-plus mr-1" />Deposit
            </button>
            <button onClick={() => setWalletAction('withdraw')} className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30">
              <i className="fas fa-minus mr-1" />Withdraw
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {walletLoading ? (
            <div className="col-span-3 py-4 text-center text-text-muted text-xs">Loading...</div>
          ) : wallets.length > 0 ? wallets.map(w => (
            <div key={w.currency} className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-[10px] text-text-muted">{w.currency}</p>
              <p className="text-sm font-bold text-text-primary font-num">{fmtCurrency(w.balance, w.currency)}</p>
              <p className="text-[10px] text-text-muted">Available: {fmtCurrency(w.available, w.currency)}</p>
            </div>
          )) : (
            <div className="col-span-3 py-4 text-center text-text-muted text-xs">No wallet data</div>
          )}
        </div>

        {/* Deposit/Withdraw Modal */}
        {walletAction && (
          <div className="mt-3 bg-white/[0.03] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-text-primary capitalize">{walletAction}</h4>
              <button onClick={() => setWalletAction(null)} className="text-text-muted hover:text-text-secondary">
                <i className="fas fa-times text-xs" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="100"
                placeholder="Amount (JMD)"
                value={walletAmount}
                onChange={e => setWalletAmount(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
              />
              <button
                onClick={handleWalletSubmit}
                disabled={depositMut.isPending || withdrawMut.isPending}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  walletAction === 'deposit'
                    ? 'bg-gf-green text-bg hover:bg-gf-green/90'
                    : 'bg-red-500 text-white hover:bg-red-600'
                } disabled:opacity-50`}
              >
                {(depositMut.isPending || withdrawMut.isPending) ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['holdings', 'history', 'wallet'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'holdings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Holdings Table */}
          <div className="lg:col-span-2 glass-card p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Holdings</h3>
            {posLoading ? <SkeletonTable rows={5} /> : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-muted border-b border-white/5">
                      <th className="py-2 px-3 text-left">Symbol</th>
                      <th className="py-2 px-3 text-right">Shares</th>
                      <th className="py-2 px-3 text-right">Avg Cost</th>
                      <th className="py-2 px-3 text-right">Price</th>
                      <th className="py-2 px-3 text-right">Value</th>
                      <th className="py-2 px-3 text-right">P&L</th>
                      <th className="py-2 px-3 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(p => {
                      const value = p.marketValue ?? p.shares * (p.currentPrice ?? p.avgCost);
                      const pnl = p.unrealizedPnL ?? value - p.shares * p.avgCost;
                      const pnlPct = p.unrealizedPnLPercent ?? (p.avgCost > 0 ? (pnl / (p.shares * p.avgCost)) * 100 : 0);
                      return (
                        <tr key={p.id} className="border-b border-white/[0.02] hover:bg-white/[0.03]">
                          <td className="py-2.5 px-3 font-semibold text-text-primary">
                            {p.symbol}
                            {p.isPaper && <span className="ml-1 text-[9px] text-gf-gold bg-gf-gold/10 px-1 rounded">PAPER</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtInt(p.shares)}</td>
                          <td className="py-2.5 px-3 text-right font-num text-text-secondary">{fmtCurrency(p.avgCost, p.currency)}</td>
                          <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtCurrency(p.currentPrice, p.currency)}</td>
                          <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtCurrency(value, p.currency)}</td>
                          <td className={`py-2.5 px-3 text-right font-num ${changeColor(pnl)}`}>{fmtCurrency(pnl, p.currency)}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-num font-semibold ${changeBg(pnlPct)} ${changeColor(pnlPct)}`}>
                              {fmtPercent(pnlPct)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {positions.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-text-muted">No holdings yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sector Allocation */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Allocation</h3>
            {positions.length > 0 ? (
              <div className="h-64">
                <Pie data={pieData} options={pieOptions} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-text-muted text-xs">No data</div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Transaction History</h3>
          {txLoading ? <SkeletonTable rows={5} /> : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-white/5">
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Type</th>
                    <th className="py-2 px-3 text-left">Symbol</th>
                    <th className="py-2 px-3 text-right">Shares</th>
                    <th className="py-2 px-3 text-right">Price</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: Transaction) => (
                    <tr key={tx.id} className="border-b border-white/[0.02] hover:bg-white/[0.03]">
                      <td className="py-2.5 px-3 text-text-secondary">{fmtDateTime(tx.createdAt)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          tx.type === 'BUY' ? 'bg-gf-green/10 text-gf-green' :
                          tx.type === 'SELL' ? 'bg-red-500/10 text-red-400' :
                          tx.type === 'DEPOSIT' ? 'bg-gf-blue/10 text-gf-blue' :
                          tx.type === 'WITHDRAWAL' ? 'bg-gf-gold/10 text-gf-gold' :
                          'bg-white/5 text-text-muted'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-text-primary">{tx.symbol || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-secondary">{tx.shares ? fmtInt(tx.shares) : '—'}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-secondary">{tx.price ? fmtCurrency(tx.price, tx.currency) : '—'}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtCurrency(tx.totalAmount, tx.currency)}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-muted">{fmtCurrency(tx.feeAmount, tx.currency)}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-text-muted">No transactions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'wallet' && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Wallet Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wallets.map(w => (
              <div key={w.currency} className="bg-white/[0.03] rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gf-green/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-gf-green">{w.currency}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary font-num">{fmtCurrency(w.balance, w.currency)}</p>
                    <p className="text-[10px] text-text-muted">Total Balance</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-text-muted">Available</p>
                    <p className="font-num text-text-primary">{fmtCurrency(w.available, w.currency)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Held</p>
                    <p className="font-num text-text-secondary">{fmtCurrency(w.heldBalance, w.currency)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
