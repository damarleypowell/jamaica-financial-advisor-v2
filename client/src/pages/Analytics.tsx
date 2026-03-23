import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getPortfolioAnalytics, runBacktest, compoundGrowth, retirementCalc, loanCalc } from '@/api/analytics';
import { getPositions } from '@/api/orders';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import PaywallModal from '@/components/common/PaywallModal';
import { fmt, fmtJMD, fmtPercent, changeColor } from '@/utils/formatters';
import { SkeletonCard } from '@/components/common/LoadingSpinner';
import type { BacktestResult } from '@/types';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

type Tab = 'portfolio' | 'backtest' | 'compound' | 'retirement' | 'loan';

export default function Analytics() {
  const { isAuthenticated } = useAuth();
  const { hasTier, showPaywall, requiredTier, closePaywall, requireTier } = useSubscription();
  const [tab, setTab] = useState<Tab>('portfolio');

  useEffect(() => { requireTier('PRO'); }, [requireTier]);

  // Portfolio metrics
  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
    enabled: isAuthenticated,
  });

  const posPayload = positions.map(p => ({ symbol: p.symbol, shares: p.shares, avgCost: p.avgCost }));

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['portfolio-analytics', posPayload],
    queryFn: () => getPortfolioAnalytics(posPayload),
    enabled: isAuthenticated && posPayload.length > 0,
  });

  // Backtest
  const [btSymbol, setBtSymbol] = useState('');
  const [btStrategy, setBtStrategy] = useState('sma_crossover');
  const [btStart, setBtStart] = useState('2024-01-01');
  const [btEnd, setBtEnd] = useState('2025-01-01');
  const [btCapital, setBtCapital] = useState('1000000');
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);

  const backtestMut = useMutation({
    mutationFn: runBacktest,
    onSuccess: (data) => setBtResult(data),
    onError: () => toast.error('Backtest failed'),
  });

  // Compound Growth
  const [cgPrincipal, setCgPrincipal] = useState('100000');
  const [cgMonthly, setCgMonthly] = useState('10000');
  const [cgRate, setCgRate] = useState('8');
  const [cgYears, setCgYears] = useState('10');
  const [cgResult, setCgResult] = useState<Record<string, unknown> | null>(null);

  const compoundMut = useMutation({
    mutationFn: compoundGrowth,
    onSuccess: (data) => setCgResult(data),
    onError: () => toast.error('Calculation failed'),
  });

  // Retirement
  const [retAge, setRetAge] = useState('25');
  const [retTarget, setRetTarget] = useState('65');
  const [retExpenses, setRetExpenses] = useState('100000');
  const [retInflation, setRetInflation] = useState('5');
  const [retResult, setRetResult] = useState<Record<string, unknown> | null>(null);

  const retirementMut = useMutation({
    mutationFn: retirementCalc,
    onSuccess: (data) => setRetResult(data),
    onError: () => toast.error('Calculation failed'),
  });

  // Loan
  const [loanPrincipal, setLoanPrincipal] = useState('5000000');
  const [loanRate, setLoanRate] = useState('12');
  const [loanYears, setLoanYears] = useState('15');
  const [loanResult, setLoanResult] = useState<Record<string, unknown> | null>(null);

  const loanMut = useMutation({
    mutationFn: loanCalc,
    onSuccess: (data) => setLoanResult(data),
    onError: () => toast.error('Calculation failed'),
  });

  const isPro = hasTier('PRO');
  if (showPaywall) return <PaywallModal requiredTier={requiredTier} onClose={closePaywall} />;
  if (!isPro) return null;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {([
          { key: 'portfolio', label: 'Portfolio Metrics', icon: 'fa-chart-pie' },
          { key: 'backtest', label: 'Backtester', icon: 'fa-history' },
          { key: 'compound', label: 'Compound Growth', icon: 'fa-seedling' },
          { key: 'retirement', label: 'Retirement', icon: 'fa-umbrella-beach' },
          { key: 'loan', label: 'Loan', icon: 'fa-hand-holding-usd' },
        ] as { key: Tab; label: string; icon: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              tab === t.key ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
            }`}
          >
            <i className={`fas ${t.icon} text-[10px]`} />{t.label}
          </button>
        ))}
      </div>

      {/* Portfolio Metrics */}
      {tab === 'portfolio' && (
        <div className="space-y-4">
          {metricsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
          ) : !metrics ? (
            <div className="glass-card p-12 text-center text-text-muted text-xs">
              <i className="fas fa-chart-pie text-3xl mb-3 block" />
              {isAuthenticated ? 'Add positions to your portfolio to see analytics' : 'Log in to see portfolio analytics'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Value" value={fmtJMD(metrics.totalValue)} />
                <MetricCard label="Total P&L" value={fmtJMD(metrics.totalPnL)} className={changeColor(metrics.totalPnL)} />
                <MetricCard label="Return" value={fmtPercent(metrics.totalPnLPercent)} className={changeColor(metrics.totalPnLPercent)} />
                <MetricCard label="Sharpe Ratio" value={fmt(metrics.sharpeRatio, 2)} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Sortino Ratio" value={fmt(metrics.sortinoRatio, 2)} />
                <MetricCard label="Max Drawdown" value={fmtPercent(metrics.maxDrawdown)} className="text-red-400" />
                <MetricCard label="Beta" value={fmt(metrics.beta, 2)} />
                <MetricCard label="Volatility" value={fmtPercent(metrics.volatility)} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Backtester */}
      {tab === 'backtest' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Backtest Configuration</h3>
            <div className="space-y-3">
              <Field label="Symbol" value={btSymbol} onChange={setBtSymbol} placeholder="e.g. NCBFG" />
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Strategy</label>
                <select value={btStrategy} onChange={e => setBtStrategy(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none">
                  <option value="sma_crossover">SMA Crossover</option>
                  <option value="rsi_oversold">RSI Oversold</option>
                  <option value="macd_signal">MACD Signal</option>
                  <option value="mean_reversion">Mean Reversion</option>
                  <option value="buy_hold">Buy & Hold</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date" type="date" value={btStart} onChange={setBtStart} />
                <Field label="End Date" type="date" value={btEnd} onChange={setBtEnd} />
              </div>
              <Field label="Initial Capital (J$)" type="number" value={btCapital} onChange={setBtCapital} />
              <button
                onClick={() => backtestMut.mutate({
                  symbol: btSymbol,
                  strategy: btStrategy,
                  startDate: btStart,
                  endDate: btEnd,
                  initialCapital: parseInt(btCapital),
                })}
                disabled={backtestMut.isPending || !btSymbol}
                className="w-full py-3 rounded-lg bg-gf-green text-bg text-sm font-bold hover:bg-gf-green/90 disabled:opacity-50"
              >
                {backtestMut.isPending ? 'Running...' : 'Run Backtest'}
              </button>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Results</h3>
            {btResult ? (
              <div className="grid grid-cols-2 gap-4">
                <MetricCard label="Total Return" value={fmtPercent(btResult.totalReturn)} className={changeColor(btResult.totalReturn)} small />
                <MetricCard label="Annualized Return" value={fmtPercent(btResult.annualizedReturn)} className={changeColor(btResult.annualizedReturn)} small />
                <MetricCard label="Sharpe Ratio" value={fmt(btResult.sharpeRatio, 2)} small />
                <MetricCard label="Max Drawdown" value={fmtPercent(btResult.maxDrawdown)} className="text-red-400" small />
                <MetricCard label="Win Rate" value={fmtPercent(btResult.winRate)} small />
                <MetricCard label="Total Trades" value={String(btResult.trades)} small />
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-text-muted text-xs">
                <div className="text-center">
                  <i className="fas fa-history text-2xl mb-2 block" />
                  Configure and run a backtest to see results
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compound Growth Calculator */}
      {tab === 'compound' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Compound Growth Calculator</h3>
            <div className="space-y-3">
              <Field label="Initial Investment (J$)" type="number" value={cgPrincipal} onChange={setCgPrincipal} />
              <Field label="Monthly Contribution (J$)" type="number" value={cgMonthly} onChange={setCgMonthly} />
              <Field label="Annual Return Rate (%)" type="number" value={cgRate} onChange={setCgRate} />
              <Field label="Investment Period (Years)" type="number" value={cgYears} onChange={setCgYears} />
              <button
                onClick={() => compoundMut.mutate({
                  principal: parseFloat(cgPrincipal),
                  monthlyContribution: parseFloat(cgMonthly),
                  annualRate: parseFloat(cgRate),
                  years: parseInt(cgYears),
                })}
                disabled={compoundMut.isPending}
                className="w-full py-3 rounded-lg bg-gf-green text-bg text-sm font-bold hover:bg-gf-green/90 disabled:opacity-50"
              >
                {compoundMut.isPending ? 'Calculating...' : 'Calculate'}
              </button>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Projection</h3>
            {cgResult ? (
              <div className="space-y-3">
                {Object.entries(cgResult).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-white/5 text-xs">
                    <span className="text-text-secondary capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-text-primary font-num font-semibold">{typeof v === 'number' ? fmtJMD(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-text-muted text-xs">
                <div className="text-center"><i className="fas fa-seedling text-2xl mb-2 block" />Enter values and calculate</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retirement Calculator */}
      {tab === 'retirement' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Retirement Calculator</h3>
            <div className="space-y-3">
              <Field label="Current Age" type="number" value={retAge} onChange={setRetAge} />
              <Field label="Retirement Age" type="number" value={retTarget} onChange={setRetTarget} />
              <Field label="Monthly Expenses (J$)" type="number" value={retExpenses} onChange={setRetExpenses} />
              <Field label="Expected Inflation (%)" type="number" value={retInflation} onChange={setRetInflation} />
              <button
                onClick={() => retirementMut.mutate({
                  currentAge: parseInt(retAge),
                  retirementAge: parseInt(retTarget),
                  monthlyExpenses: parseFloat(retExpenses),
                  inflationRate: parseFloat(retInflation),
                })}
                disabled={retirementMut.isPending}
                className="w-full py-3 rounded-lg bg-gf-green text-bg text-sm font-bold hover:bg-gf-green/90 disabled:opacity-50"
              >
                {retirementMut.isPending ? 'Calculating...' : 'Calculate'}
              </button>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Retirement Projection</h3>
            {retResult ? (
              <div className="space-y-3">
                {Object.entries(retResult).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-white/5 text-xs">
                    <span className="text-text-secondary capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-text-primary font-num font-semibold">{typeof v === 'number' ? fmtJMD(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-text-muted text-xs">
                <div className="text-center"><i className="fas fa-umbrella-beach text-2xl mb-2 block" />Plan your retirement</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loan Calculator */}
      {tab === 'loan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Loan Calculator</h3>
            <div className="space-y-3">
              <Field label="Loan Amount (J$)" type="number" value={loanPrincipal} onChange={setLoanPrincipal} />
              <Field label="Annual Interest Rate (%)" type="number" value={loanRate} onChange={setLoanRate} />
              <Field label="Loan Term (Years)" type="number" value={loanYears} onChange={setLoanYears} />
              <button
                onClick={() => loanMut.mutate({
                  principal: parseFloat(loanPrincipal),
                  annualRate: parseFloat(loanRate),
                  years: parseInt(loanYears),
                })}
                disabled={loanMut.isPending}
                className="w-full py-3 rounded-lg bg-gf-green text-bg text-sm font-bold hover:bg-gf-green/90 disabled:opacity-50"
              >
                {loanMut.isPending ? 'Calculating...' : 'Calculate'}
              </button>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Loan Breakdown</h3>
            {loanResult ? (
              <div className="space-y-3">
                {Object.entries(loanResult).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-white/5 text-xs">
                    <span className="text-text-secondary capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-text-primary font-num font-semibold">{typeof v === 'number' ? fmtJMD(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-text-muted text-xs">
                <div className="text-center"><i className="fas fa-hand-holding-usd text-2xl mb-2 block" />Calculate loan payments</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, className, small }: { label: string; value: string; className?: string; small?: boolean }) {
  return (
    <div className="glass-card p-4">
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`${small ? 'text-sm' : 'text-lg'} font-bold font-num ${className || 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, placeholder }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
      />
    </div>
  );
}
