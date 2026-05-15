import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { PortfolioPosition, Transaction, WalletBalance } from '../../types';

type Tab = 'holdings' | 'history' | 'wallet';

const fmt2 = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtJMD = (n?: number) => `J$${fmt2(n)}`;
const chgColor = (v?: number) => (v ?? 0) > 0 ? '#00e676' : (v ?? 0) < 0 ? '#ff5252' : 'var(--color-muted)';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'holdings', label: 'Holdings', icon: 'fa-solid fa-briefcase' },
  { key: 'history',  label: 'History',  icon: 'fa-solid fa-clock-rotate-left' },
  { key: 'wallet',   label: 'Wallet',   icon: 'fa-solid fa-wallet' },
];

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)' }}>
        <i className={icon} style={{ fontSize: 20, color: 'var(--color-muted)', opacity: .4 }} />
      </div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text2)' }}>{title}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>{sub}</p>
    </div>
  );
}

export default function Portfolio() {
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('holdings');
  const [walletAction, setWalletAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [walletAmount, setWalletAmount] = useState('');

  const { data: positions = [], isLoading: posLoading } = useQuery<PortfolioPosition[]>({
    queryKey: ['positions'],
    queryFn: async () => {
      const res: any = await apiGet('/api/portfolio/positions');
      return Array.isArray(res) ? res : (res?.positions ?? []);
    },
    enabled: isAuthenticated, retry: 1,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res: any = await apiGet('/api/portfolio/history');
      const txs = Array.isArray(res) ? res : (res?.transactions ?? []);
      return txs.map((t: any) => ({
        ...t,
        side: t.type === 'BUY' || t.type === 'SELL' ? t.type : (t.side ?? t.type),
        quantity: t.quantity ?? t.shares ?? 0,
        total: t.total ?? t.totalAmount ?? 0,
        fee: t.fee ?? t.feeAmount ?? 0,
      }));
    },
    enabled: isAuthenticated && tab === 'history', retry: 1,
  });

  const { data: wallet } = useQuery<WalletBalance>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res: any = await apiGet('/api/wallet/balance');
      const wallets: any[] = res?.wallets ?? [];
      const jmdW = wallets.find((w: any) => w.currency === 'JMD') ?? {};
      const usdW = wallets.find((w: any) => w.currency === 'USD') ?? {};
      return {
        jmd: jmdW.balance ?? res?.jmd ?? 0,
        jmdHeld: jmdW.held ?? res?.jmdHeld ?? 0,
        usd: usdW.balance ?? res?.usd ?? 0,
        usdHeld: usdW.held ?? res?.usdHeld ?? 0,
      };
    },
    enabled: isAuthenticated, retry: 1,
  });

  const depositMut = useMutation({
    mutationFn: (amt: number) => apiPost('/api/wallet/deposit', { amount: amt, currency: 'JMD' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet'] }); setWalletAction(null); setWalletAmount(''); },
  });

  const withdrawMut = useMutation({
    mutationFn: (amt: number) => apiPost('/api/wallet/withdraw', { amount: amt, currency: 'JMD' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet'] }); setWalletAction(null); setWalletAmount(''); },
  });

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)' }}>
          <i className="fa-solid fa-briefcase" style={{ fontSize: 24, color: 'var(--color-muted)' }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>Sign in to view your portfolio</h2>
      </div>
    );
  }

  const totalValue = positions.reduce((s, p) => s + (p.marketValue ?? p.shares * (p.currentPrice ?? p.avgCost)), 0);
  const totalCost  = positions.reduce((s, p) => s + p.shares * p.avgCost, 0);
  const totalPnL   = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const summaryCards = [
    { label: 'Portfolio Value', value: fmtJMD(totalValue), icon: 'fa-solid fa-briefcase',   color: '#00e676' },
    { label: 'Total P&L',       value: `${totalPnL >= 0 ? '+' : ''}${fmtJMD(totalPnL)}`,   icon: 'fa-solid fa-chart-line',  color: totalPnL >= 0 ? '#00e676' : '#ff5252' },
    { label: 'Return',          value: `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%`, icon: 'fa-solid fa-percent', color: totalPnLPct >= 0 ? '#00e676' : '#ff5252' },
    { label: 'Positions',       value: String(positions.length),                              icon: 'fa-solid fa-layer-group', color: '#40c4ff' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Summary cards ── */}
      <div className="grid-summary-4">
        {summaryCards.map(c => (
          <div key={c.label} style={{
            background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16,
            padding: '18px 20px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${c.color}, transparent)` }} />
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, background: c.color === '#40c4ff' ? 'rgba(64,196,255,.1)' : c.color === '#ff5252' ? 'rgba(255,82,82,.1)' : 'rgba(0,230,118,.1)' }}>
              <i className={c.icon} style={{ fontSize: 12, color: c.color }} />
            </div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: c.color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{c.value}</p>
            <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tab card ── */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Tab strip */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '13px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: tab === t.key ? '#00e676' : 'var(--color-muted)',
              borderBottom: tab === t.key ? '2px solid #00e676' : '2px solid transparent',
              marginBottom: -1, transition: 'all 150ms',
            }}>
              <i className={t.icon} style={{ fontSize: 10 }} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Holdings ── */}
        {tab === 'holdings' && (
          posLoading ? (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
            </div>
          ) : positions.length === 0 ? (
            <EmptyState icon="fa-solid fa-briefcase" title="No holdings yet" sub="Buy your first JSE stock to get started" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {['Symbol', 'Shares', 'Avg Cost', 'Market Value', 'P&L', 'P&L %'].map((h, i) => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-muted)', textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map(p => {
                    const mv = p.marketValue ?? p.shares * (p.currentPrice ?? p.avgCost);
                    const pnl = p.pnl ?? (mv - p.shares * p.avgCost);
                    const pnlPct = p.pnlPercent ?? (p.avgCost > 0 ? (pnl / (p.shares * p.avgCost)) * 100 : 0);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.025)', transition: 'background 120ms' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: pnl >= 0 ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', flexShrink: 0 }}>
                              <span style={{ fontSize: 9, fontWeight: 900, color: pnl >= 0 ? '#00e676' : '#ff5252' }}>{p.symbol.slice(0,3)}</span>
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{p.symbol}</p>
                              <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>{p.market}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>{p.shares.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>${fmt2(p.avgCost)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>${fmt2(mv)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: chgColor(pnl) }}>
                          {pnl >= 0 ? '+' : ''}${fmt2(Math.abs(pnl))}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: chgColor(pnlPct) }}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── History ── */}
        {tab === 'history' && (
          txLoading ? (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 10 }} />)}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState icon="fa-solid fa-clock-rotate-left" title="No transactions yet" sub="Your trade history will appear here" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {['Date', 'Symbol', 'Side', 'Qty', 'Price', 'Total', 'Fee'].map((h, i) => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-muted)', textAlign: i <= 1 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,.025)', transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-muted)' }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{tx.symbol}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', background: tx.side === 'BUY' ? 'rgba(0,230,118,.12)' : 'rgba(255,82,82,.12)', color: tx.side === 'BUY' ? '#00e676' : '#ff5252', border: `1px solid ${tx.side === 'BUY' ? 'rgba(0,230,118,.25)' : 'rgba(255,82,82,.25)'}` }}>
                          {tx.side}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>{tx.quantity}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>${fmt2(tx.price)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>${fmt2(tx.total)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>${fmt2(tx.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── Wallet ── */}
        {tab === 'wallet' && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Balance cards */}
            <div className="grid-wallet-2">
              {[
                { label: 'JMD Balance', value: fmtJMD(wallet?.jmd), held: fmtJMD(wallet?.jmdHeld), color: '#00e676' },
                { label: 'USD Balance', value: `$${fmt2(wallet?.usd)}`, held: `$${fmt2(wallet?.usdHeld)}`, color: '#ffd740' },
              ].map(w => (
                <div key={w.label} style={{ background: 'var(--color-bg3)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${w.color}, transparent)` }} />
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{w.label}</p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-mono)', color: w.color }}>{w.value}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>{w.held} held in orders</p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setWalletAction('deposit')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 12, background: '#00e676', color: '#04060d', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'opacity 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                <i className="fa-solid fa-plus" style={{ fontSize: 11 }} /> Deposit
              </button>
              <button onClick={() => setWalletAction('withdraw')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid var(--color-border)', color: 'var(--color-text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.15)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text2)'; }}>
                <i className="fa-solid fa-minus" style={{ fontSize: 11 }} /> Withdraw
              </button>
            </div>

            {/* Deposit/withdraw form */}
            {walletAction && (
              <div style={{ background: 'var(--color-bg3)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '16px 18px' }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', textTransform: 'capitalize' }}>{walletAction} Funds (JMD)</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="number" value={walletAmount}
                    onChange={e => setWalletAmount(e.target.value)}
                    placeholder="Amount (J$)"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 14, outline: 'none' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.4)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                  />
                  <button
                    onClick={() => {
                      const amt = parseFloat(walletAmount);
                      if (!amt || amt <= 0) return;
                      if (walletAction === 'deposit') depositMut.mutate(amt);
                      else withdrawMut.mutate(amt);
                    }}
                    disabled={depositMut.isPending || withdrawMut.isPending}
                    style={{ padding: '10px 20px', borderRadius: 10, background: '#00e676', color: '#04060d', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: depositMut.isPending || withdrawMut.isPending ? .6 : 1 }}>
                    Confirm
                  </button>
                  <button onClick={() => { setWalletAction(null); setWalletAmount(''); }}
                    style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
