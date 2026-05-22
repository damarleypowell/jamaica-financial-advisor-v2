import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useMarketStore } from '../../stores/market';

// ── Formatters ────────────────────────────────────────────────────────────────

const f2 = (n?: number) =>
  (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fJMD = (n?: number) => `J$${f2(n)}`;
const chgColor = (v: number) => v > 0 ? '#00e676' : v < 0 ? '#ff5252' : 'rgba(255,255,255,.4)';

const INTER = "'Inter', sans-serif";
const MONO  = "'JetBrains Mono', 'Fira Mono', monospace";

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color = '#00e676', sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', fontFamily: INTER }}>{label}</p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color, fontFamily: MONO, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,.35)', fontFamily: INTER }}>{sub}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'trade' | 'positions' | 'history' | 'wallet';

export default function Portfolio() {
  const { isAuthenticated } = useAuthStore();
  const stocks = useMarketStore(s => s.stocks);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('trade');

  // Trade form state
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [qty, setQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [tradeMsg, setTradeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Wallet form
  const [walletAction, setWalletAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [walletAmt, setWalletAmt] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: walletData, isError: walletError, refetch: walletRefetch } = useQuery<any>({
    queryKey: ['wallet'],
    queryFn: () => apiGet('/api/wallet/balance'),
    enabled: isAuthenticated,
    refetchInterval: 15_000,
  });

  const { data: posData, isLoading: posLoading, isError: posError, refetch: posRefetch } = useQuery<any>({
    queryKey: ['positions'],
    queryFn: () => apiGet('/api/portfolio/positions'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const { data: histData, isLoading: histLoading, isError: histError, refetch: histRefetch } = useQuery<any>({
    queryKey: ['transactions'],
    queryFn: () => apiGet('/api/portfolio/history'),
    enabled: isAuthenticated && tab === 'history',
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const tradeMut = useMutation({
    mutationFn: (body: object) => apiPost('/api/orders', body),
    onSuccess: (data: any) => {
      setTradeMsg({ text: data?.message ?? 'Order placed successfully!', ok: true });
      setQty('');
      setLimitPrice('');
      qc.invalidateQueries({ queryKey: ['positions'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err: any) => {
      setTradeMsg({ text: err?.message ?? 'Order failed. Check your balance and try again.', ok: false });
    },
  });

  const depositMut = useMutation({
    mutationFn: (amt: number) => apiPost('/api/wallet/deposit', { amount: amt, currency: 'JMD' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet'] }); setWalletAction(null); setWalletAmt(''); },
  });

  const withdrawMut = useMutation({
    mutationFn: (amt: number) => apiPost('/api/wallet/withdraw', { amount: amt, currency: 'JMD' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet'] }); setWalletAction(null); setWalletAmt(''); },
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const jmdWallet = walletData?.wallets?.find((w: any) => w.currency === 'JMD') ?? { balance: 0, available: 0, held: 0 };

  const positions: any[] = Array.isArray(posData?.positions) ? posData.positions
    : Array.isArray(posData) ? posData : [];

  const transactions: any[] = (() => {
    const raw = Array.isArray(histData?.transactions) ? histData.transactions
      : Array.isArray(histData) ? histData : [];
    return raw.map((t: any) => ({
      ...t,
      side: t.type === 'BUY' || t.type === 'SELL' ? t.type : (t.side ?? t.type),
      quantity: t.quantity ?? t.shares ?? 0,
      total: t.total ?? t.totalAmount ?? 0,
      fee: t.fee ?? t.feeAmount ?? 0,
    }));
  })();

  const totalValue   = positions.reduce((s: number, p: any) => s + (p.currentValue ?? p.marketValue ?? 0), 0);
  const totalPnL     = positions.reduce((s: number, p: any) => s + (p.pnl ?? 0), 0);
  const totalPnLPct  = positions.length > 0 ? positions.reduce((s: number, p: any) => s + (p.pnlPct ?? 0), 0) / positions.length : 0;

  // Stock search dropdown
  const filteredStocks = useMemo(() => {
    if (!symbolSearch.trim()) return stocks.slice(0, 8);
    const q = symbolSearch.toUpperCase();
    return stocks.filter(s => s.symbol.includes(q) || (s.name ?? '').toUpperCase().includes(q)).slice(0, 8);
  }, [stocks, symbolSearch]);

  const selectedStock = stocks.find(s => s.symbol === symbol);
  const marketPrice = selectedStock?.price ?? 0;
  const estValue = (parseFloat(qty) || 0) * (orderType === 'LIMIT' && limitPrice ? parseFloat(limitPrice) : marketPrice);
  const fee = estValue * 0.01; // 1% JSE fee

  const handleTrade = () => {
    if (!symbol) { setTradeMsg({ text: 'Select a stock first.', ok: false }); return; }
    const q = parseInt(qty);
    if (!q || q <= 0) { setTradeMsg({ text: 'Enter a valid quantity.', ok: false }); return; }
    if (orderType === 'LIMIT' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      setTradeMsg({ text: 'Enter a valid limit price.', ok: false }); return;
    }
    setTradeMsg(null);
    tradeMut.mutate({
      symbol,
      side,
      orderType,
      quantity: q,
      isPaper: true,
      ...(orderType === 'LIMIT' ? { limitPrice: parseFloat(limitPrice) } : {}),
    });
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, fontFamily: INTER }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-solid fa-flask-vial" style={{ fontSize: 24, color: 'rgba(255,255,255,.3)' }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>Sign in to access Paper Trading</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Practice investing with J$1,000,000 in virtual funds — no real money at risk.</p>
      </div>
    );
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'trade',     label: 'Place Trade',   icon: 'fa-solid fa-bolt'                },
    { key: 'positions', label: 'Positions',      icon: 'fa-solid fa-briefcase'           },
    { key: 'history',   label: 'History',        icon: 'fa-solid fa-clock-rotate-left'   },
    { key: 'wallet',    label: 'Wallet',         icon: 'fa-solid fa-wallet'              },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: INTER }}>

      {/* ── Header ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-flask-vial" style={{ fontSize: 15, color: '#00e676' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>Paper Trading</h1>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,.35)' }}>Practice with J$1,000,000 virtual funds · No real money at risk</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: 'rgba(0,230,118,.08)', border: '1px solid rgba(0,230,118,.2)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00e676', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#00e676', fontFamily: INTER }}>PAPER</span>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="Cash Available" value={fJMD(jmdWallet.available)} color="#00e676" sub={`${fJMD(jmdWallet.held)} held`} />
        <StatCard label="Portfolio Value" value={fJMD(totalValue)} color="#40c4ff" />
        <StatCard label="Total P&L" value={`${totalPnL >= 0 ? '+' : ''}${fJMD(totalPnL)}`} color={chgColor(totalPnL)} sub={`${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}% avg`} />
        <StatCard label="Positions" value={String(positions.length)} color="#ce93d8" />
      </div>

      {/* ── Tab strip + content ── */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, overflow: 'hidden' }}>
        {/* Tab buttons */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '13px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              color: tab === t.key ? '#00e676' : 'rgba(255,255,255,.35)',
              borderBottom: tab === t.key ? '2px solid #00e676' : '2px solid transparent',
              marginBottom: -1, transition: 'all .15s', fontFamily: INTER,
            }}>
              <i className={t.icon} style={{ fontSize: 9 }} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── PLACE TRADE ─────────────────────────────────────────────────── */}
        {tab === 'trade' && (
          <div style={{ padding: '24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Stock selector */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>
                Stock
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  value={symbolSearch || symbol}
                  onChange={e => { setSymbolSearch(e.target.value); setSymbol(''); setShowDropdown(true); setTradeMsg(null); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder="Search symbol or company name…"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 13, fontFamily: INTER, outline: 'none', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,.04)', border: `1px solid ${symbol ? 'rgba(0,230,118,.3)' : 'rgba(255,255,255,.1)'}`,
                    color: '#fff', transition: 'border-color .15s',
                  }}
                />
                {showDropdown && filteredStocks.length > 0 && !symbol && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
                    {filteredStocks.map(s => (
                      <button key={s.symbol} onMouseDown={() => { setSymbol(s.symbol); setSymbolSearch(''); setShowDropdown(false); }}
                        style={{
                          width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', transition: 'background .1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: MONO, marginRight: 8 }}>{s.symbol}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{s.name ?? ''}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: (s.pctChange ?? 0) >= 0 ? '#00e676' : '#ff5252', fontFamily: MONO }}>
                          J${f2(s.price ?? 0)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected stock info */}
              {symbol && selectedStock && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(0,230,118,.05)', border: '1px solid rgba(0,230,118,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: MONO }}>{symbol}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginLeft: 8 }}>{selectedStock.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: MONO }}>J${f2(marketPrice)}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: chgColor(selectedStock.pctChange ?? 0), fontFamily: MONO }}>
                      {(selectedStock.pctChange ?? 0) >= 0 ? '+' : ''}{(selectedStock.pctChange ?? 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Buy / Sell toggle */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>Direction</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['BUY', 'SELL'] as const).map(s => (
                  <button key={s} onClick={() => { setSide(s); setTradeMsg(null); }}
                    style={{
                      padding: '12px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: 'none', transition: 'all .15s', fontFamily: INTER,
                      background: side === s ? (s === 'BUY' ? '#00e676' : '#ff5252') : 'rgba(255,255,255,.04)',
                      color: side === s ? '#04060d' : 'rgba(255,255,255,.4)',
                    }}>
                    {s === 'BUY' ? '▲ BUY' : '▼ SELL'}
                  </button>
                ))}
              </div>
            </div>

            {/* Order type + Qty */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>Order Type</label>
                <select value={orderType} onChange={e => { setOrderType(e.target.value as 'MARKET' | 'LIMIT'); setTradeMsg(null); }}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', fontSize: 13, fontFamily: INTER, outline: 'none', cursor: 'pointer' }}>
                  <option value="MARKET">Market (instant fill)</option>
                  <option value="LIMIT">Limit (set your price)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>Shares</label>
                <input type="number" min="1" value={qty} onChange={e => { setQty(e.target.value); setTradeMsg(null); }}
                  placeholder="e.g. 100"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', fontSize: 13, fontFamily: MONO, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,.1)')}
                />
              </div>
            </div>

            {/* Limit price */}
            {orderType === 'LIMIT' && (
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>Limit Price (J$)</label>
                <input type="number" step="0.01" min="0" value={limitPrice} onChange={e => { setLimitPrice(e.target.value); setTradeMsg(null); }}
                  placeholder={marketPrice > 0 ? f2(marketPrice) : 'Price...'}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', fontSize: 13, fontFamily: MONO, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,.1)')}
                />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(255,255,255,.35)', fontFamily: INTER }}>Limit orders fill when the market price reaches your target.</p>
              </div>
            )}

            {/* Order summary */}
            {symbol && qty && parseFloat(qty) > 0 && marketPrice > 0 && (
              <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)' }}>Order Summary</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    ['Symbol', symbol],
                    ['Side', side],
                    ['Type', orderType],
                    ['Shares', parseInt(qty).toLocaleString()],
                    ['Est. Price', orderType === 'LIMIT' && limitPrice ? `J$${f2(parseFloat(limitPrice))}` : `J$${f2(marketPrice)} (market)`],
                    ['Est. Total', `J$${f2(estValue)}`],
                    ['Fee (1%)', `J$${f2(fee)}`],
                    ['Total Cost', `J$${f2(estValue + fee)}`],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontFamily: INTER }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: label.includes('Cost') || label.includes('Total') ? MONO : INTER }}>{val}</span>
                    </div>
                  ))}
                </div>
                {side === 'BUY' && (estValue + fee) > jmdWallet.available && (
                  <p style={{ margin: '10px 0 0', fontSize: 11, color: '#ff5252', fontFamily: INTER }}>
                    ⚠ Insufficient funds. Available: {fJMD(jmdWallet.available)}
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <button onClick={handleTrade} disabled={tradeMut.isPending || !symbol}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: symbol ? 'pointer' : 'not-allowed',
                background: !symbol ? 'rgba(255,255,255,.04)' : side === 'BUY' ? '#00e676' : '#ff5252',
                color: !symbol ? 'rgba(255,255,255,.25)' : '#04060d',
                fontSize: 14, fontWeight: 800, fontFamily: INTER, opacity: tradeMut.isPending ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s',
              }}>
              {tradeMut.isPending ? (
                <>
                  <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                  Placing order…
                </>
              ) : `${side === 'BUY' ? '▲ Buy' : '▼ Sell'} ${symbol || 'Stock'}`}
            </button>

            {/* Result message */}
            {tradeMsg && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: tradeMsg.ok ? 'rgba(0,230,118,.08)' : 'rgba(255,82,82,.08)', border: `1px solid ${tradeMsg.ok ? 'rgba(0,230,118,.25)' : 'rgba(255,82,82,.25)'}` }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: tradeMsg.ok ? '#00e676' : '#ff5252' }}>{tradeMsg.text}</p>
              </div>
            )}

            {/* Info callout */}
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,215,64,.04)', border: '1px solid rgba(255,215,64,.15)' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,215,64,.7)', lineHeight: 1.6, fontFamily: INTER }}>
                💡 <strong>Paper trading</strong> uses virtual money. Market orders fill instantly at the current live price. Limit orders wait until the market price matches your target.
              </p>
            </div>
          </div>
        )}

        {/* ── POSITIONS ───────────────────────────────────────────────────── */}
        {tab === 'positions' && (
          posLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 56, borderRadius: 12, background: 'rgba(255,255,255,.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : posError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 14, fontFamily: INTER }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,82,82,.1)', border: '1px solid rgba(255,82,82,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 18, color: '#ff5252' }} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Unable to load portfolio data. Please try again.</p>
              <button onClick={() => posRefetch()}
                style={{ padding: '9px 22px', borderRadius: 10, background: '#00e676', color: '#04060d', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: INTER }}>
                Retry
              </button>
            </div>
          ) : positions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-briefcase" style={{ fontSize: 22, color: 'rgba(255,255,255,.2)' }} />
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>No positions yet</p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.35)' }}>Go to <strong>Place Trade</strong> and buy your first stock.</p>
              <button onClick={() => setTab('trade')} style={{ padding: '9px 22px', borderRadius: 10, background: '#00e676', color: '#04060d', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: INTER }}>
                Place First Trade
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: INTER }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    {['Stock', 'Shares', 'Avg Cost', 'Curr Price', 'Value', 'P&L', 'Return'].map((h, i) => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.3)', textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p: any) => {
                    const pnl = p.pnl ?? 0;
                    const pnlPct = p.pnlPct ?? 0;
                    const mv = p.currentValue ?? p.marketValue ?? 0;
                    const cp = p.currentPrice ?? p.avgCost;
                    return (
                      <tr key={p.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', transition: 'background .12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: pnl >= 0 ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', border: `1px solid ${pnl >= 0 ? 'rgba(0,230,118,.2)' : 'rgba(255,82,82,.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 9, fontWeight: 900, color: pnl >= 0 ? '#00e676' : '#ff5252' }}>{(p.symbol ?? '').slice(0, 3)}</span>
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: MONO }}>{p.symbol}</p>
                              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{p.market ?? 'JSE'}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontFamily: MONO, color: 'rgba(255,255,255,.7)' }}>{(p.shares ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontFamily: MONO, color: 'rgba(255,255,255,.7)' }}>J${f2(p.avgCost)}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontFamily: MONO, color: '#fff' }}>J${f2(cp)}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, fontFamily: MONO, color: '#fff' }}>J${f2(mv)}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: MONO, color: chgColor(pnl) }}>
                          {pnl >= 0 ? '+' : ''}J${f2(Math.abs(pnl))}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, fontFamily: MONO, color: chgColor(pnlPct) }}>
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

        {/* ── HISTORY ─────────────────────────────────────────────────────── */}
        {tab === 'history' && (
          histLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ height: 48, borderRadius: 12, background: 'rgba(255,255,255,.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : histError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 14, fontFamily: INTER }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,82,82,.1)', border: '1px solid rgba(255,82,82,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 18, color: '#ff5252' }} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Unable to load portfolio data. Please try again.</p>
              <button onClick={() => histRefetch()}
                style={{ padding: '9px 22px', borderRadius: 10, background: '#00e676', color: '#04060d', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: INTER }}>
                Retry
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 12 }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: 28, color: 'rgba(255,255,255,.15)' }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff' }}>No trade history</p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.35)' }}>Your completed trades appear here.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: INTER }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    {['Date', 'Symbol', 'Side', 'Qty', 'Price', 'Total', 'Fee'].map((h, i) => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.3)', textAlign: i <= 1 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.filter((t: any) => t.type === 'BUY' || t.type === 'SELL' || t.side === 'BUY' || t.side === 'SELL').map((tx: any) => {
                    const txSide = tx.side === 'BUY' || tx.type === 'BUY' ? 'BUY' : 'SELL';
                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', transition: 'background .12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '11px 16px', fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: MONO }}>{tx.symbol}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', background: txSide === 'BUY' ? 'rgba(0,230,118,.12)' : 'rgba(255,82,82,.12)', color: txSide === 'BUY' ? '#00e676' : '#ff5252', border: `1px solid ${txSide === 'BUY' ? 'rgba(0,230,118,.25)' : 'rgba(255,82,82,.25)'}` }}>
                            {txSide}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, fontFamily: MONO, color: 'rgba(255,255,255,.7)' }}>{(tx.quantity ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, fontFamily: MONO, color: 'rgba(255,255,255,.7)' }}>J${f2(tx.price)}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: MONO, color: '#fff' }}>J${f2(tx.total)}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 11, fontFamily: MONO, color: 'rgba(255,255,255,.35)' }}>J${f2(tx.fee)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── WALLET ──────────────────────────────────────────────────────── */}
        {tab === 'wallet' && walletError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 14, fontFamily: INTER }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,82,82,.1)', border: '1px solid rgba(255,82,82,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 18, color: '#ff5252' }} />
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Unable to load portfolio data. Please try again.</p>
            <button onClick={() => walletRefetch()}
              style={{ padding: '9px 22px', borderRadius: 10, background: '#00e676', color: '#04060d', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: INTER }}>
              Retry
            </button>
          </div>
        ) : tab === 'wallet' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Total Balance', value: fJMD(jmdWallet.balance), color: '#00e676' },
                { label: 'Available', value: fJMD(jmdWallet.available), color: '#40c4ff' },
                { label: 'Held in Orders', value: fJMD(jmdWallet.held), color: '#ffd740' },
              ].map(w => (
                <div key={w.label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${w.color}, transparent)` }} />
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', fontFamily: INTER }}>{w.label}</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: MONO, color: w.color }}>{w.value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setWalletAction('deposit')} style={{ flex: 1, padding: '11px', borderRadius: 12, background: '#00e676', color: '#04060d', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: INTER }}>
                + Add Virtual Cash
              </button>
              <button onClick={() => setWalletAction('withdraw')} style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: INTER }}>
                − Remove Cash
              </button>
            </div>

            {walletAction && (
              <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '16px 18px' }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'capitalize', fontFamily: INTER }}>{walletAction === 'deposit' ? 'Add Virtual Cash (JMD)' : 'Remove Cash (JMD)'}</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="number" value={walletAmt} onChange={e => setWalletAmt(e.target.value)}
                    placeholder="Amount (J$)"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', fontSize: 14, fontFamily: MONO, outline: 'none' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.4)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,.1)')}
                  />
                  <button onClick={() => { const a = parseFloat(walletAmt); if (!a || a <= 0) return; walletAction === 'deposit' ? depositMut.mutate(a) : withdrawMut.mutate(a); }}
                    disabled={depositMut.isPending || withdrawMut.isPending}
                    style={{ padding: '10px 20px', borderRadius: 10, background: '#00e676', color: '#04060d', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: INTER }}>
                    Confirm
                  </button>
                  <button onClick={() => { setWalletAction(null); setWalletAmt(''); }}
                    style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.5)', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,215,64,.04)', border: '1px solid rgba(255,215,64,.12)' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,215,64,.6)', lineHeight: 1.6, fontFamily: INTER }}>
                💡 New accounts start with <strong>J$1,000,000</strong> in virtual paper money. Add more anytime to keep practising. Nothing here is real money.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
