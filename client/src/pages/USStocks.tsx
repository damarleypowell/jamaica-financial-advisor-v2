import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchUSStocks, getUSQuote, placeUSOrder, getUSOrders, cancelUSOrder, getUSPositions, closeUSPosition } from '@/api/us-stocks';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import PaywallModal from '@/components/common/PaywallModal';
import { fmt, fmtUSD, fmtPercent, fmtInt, fmtLargeNum, fmtDateTime, changeColor, changeBg } from '@/utils/formatters';
import { SkeletonTable } from '@/components/common/LoadingSpinner';
import type { USQuote, Order, Position } from '@/types';
import toast from 'react-hot-toast';
import { useEffect } from 'react';

type Tab = 'search' | 'positions' | 'orders';

export default function USStocks() {
  const { isAuthenticated } = useAuth();
  const { hasTier, showPaywall, requiredTier, closePaywall, requireTier } = useSubscription();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');

  // Order form
  const [orderQty, setOrderQty] = useState('');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [orderLimit, setOrderLimit] = useState('');

  useEffect(() => { requireTier('PRO'); }, [requireTier]);

  const { data: searchResults = [] } = useQuery({
    queryKey: ['us-search', searchQuery],
    queryFn: () => searchUSStocks(searchQuery),
    enabled: searchQuery.length >= 1,
  });

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ['us-quote', selectedSymbol],
    queryFn: () => getUSQuote(selectedSymbol),
    enabled: !!selectedSymbol,
    refetchInterval: 15_000,
  });

  const { data: usPositions = [] } = useQuery({
    queryKey: ['us-positions'],
    queryFn: getUSPositions,
    enabled: isAuthenticated,
  });

  const { data: usOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['us-orders'],
    queryFn: getUSOrders,
    enabled: isAuthenticated,
  });

  const placeMut = useMutation({
    mutationFn: placeUSOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['us-orders'] });
      queryClient.invalidateQueries({ queryKey: ['us-positions'] });
      toast.success('US order placed');
      setOrderQty('');
      setOrderLimit('');
    },
    onError: (err: Error) => toast.error(err.message || 'Order failed'),
  });

  const cancelMut = useMutation({
    mutationFn: cancelUSOrder,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['us-orders'] }); toast.success('Order cancelled'); },
  });

  const closeMut = useMutation({
    mutationFn: closeUSPosition,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['us-positions'] }); toast.success('Position closed'); },
  });

  const isPro = hasTier('PRO');
  if (showPaywall) return <PaywallModal requiredTier={requiredTier} onClose={closePaywall} />;
  if (!isPro) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <i className="fas fa-flag-usa text-4xl text-text-muted mb-4" />
        <h2 className="text-xl font-bold text-text-primary mb-2">US Stocks</h2>
        <p className="text-sm text-text-secondary">Log in to trade US stocks via Alpaca.</p>
      </div>
    );
  }

  const handlePlaceOrder = () => {
    if (!selectedSymbol) return toast.error('Select a stock');
    const qty = parseInt(orderQty);
    if (!qty || qty <= 0) return toast.error('Enter a valid quantity');

    placeMut.mutate({
      symbol: selectedSymbol,
      qty,
      side: orderSide,
      type: orderType,
      ...(orderType === 'limit' ? { limitPrice: parseFloat(orderLimit) } : {}),
    });
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1">
        {(['search', 'positions', 'orders'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
            }`}
          >
            {t === 'search' ? 'Search & Trade' : t}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Search + Quote */}
          <div className="space-y-4">
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Search US Stocks</h3>
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
                <input
                  type="text"
                  placeholder="Search by symbol or name (e.g. AAPL, Tesla)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                  {searchResults.map(r => (
                    <button
                      key={r.symbol}
                      onClick={() => { setSelectedSymbol(r.symbol); setSearchQuery(''); }}
                      className={`w-full flex justify-between px-3 py-2 rounded-lg text-xs hover:bg-white/5 text-left ${
                        selectedSymbol === r.symbol ? 'bg-gf-green/10 text-gf-green' : ''
                      }`}
                    >
                      <span className="font-semibold text-text-primary">{r.symbol}</span>
                      <span className="text-text-muted">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quote */}
            {selectedSymbol && (
              <div className="glass-card p-5">
                {quoteLoading ? (
                  <div className="py-4 text-center text-text-muted text-xs">Loading quote...</div>
                ) : quote ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-text-primary">{quote.symbol}</h3>
                        <p className="text-xs text-text-muted">{quote.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-text-primary font-num">{fmtUSD(quote.price)}</p>
                        <p className={`text-sm font-num ${changeColor(quote.changePercent)}`}>
                          {fmt(quote.change)} ({fmtPercent(quote.changePercent)})
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-text-muted">Open</p><p className="font-num text-text-primary">{fmtUSD(quote.open)}</p></div>
                      <div><p className="text-text-muted">Prev Close</p><p className="font-num text-text-primary">{fmtUSD(quote.previousClose)}</p></div>
                      <div><p className="text-text-muted">High</p><p className="font-num text-text-primary">{fmtUSD(quote.high)}</p></div>
                      <div><p className="text-text-muted">Low</p><p className="font-num text-text-primary">{fmtUSD(quote.low)}</p></div>
                      <div><p className="text-text-muted">Volume</p><p className="font-num text-text-primary">{fmtLargeNum(quote.volume)}</p></div>
                      <div><p className="text-text-muted">Mkt Cap</p><p className="font-num text-text-primary">{fmtLargeNum(quote.marketCap)}</p></div>
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center text-text-muted text-xs">No quote data</div>
                )}
              </div>
            )}
          </div>

          {/* Order Form */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Place US Order {selectedSymbol && <span className="text-gf-green">— {selectedSymbol}</span>}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderSide('buy')}
                  className={`py-2.5 rounded-lg text-sm font-semibold ${orderSide === 'buy' ? 'bg-gf-green text-bg' : 'bg-white/5 text-text-muted'}`}
                >Buy</button>
                <button
                  onClick={() => setOrderSide('sell')}
                  className={`py-2.5 rounded-lg text-sm font-semibold ${orderSide === 'sell' ? 'bg-red-500 text-white' : 'bg-white/5 text-text-muted'}`}
                >Sell</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderType('market')}
                  className={`py-2 rounded-lg text-xs font-semibold ${orderType === 'market' ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted'}`}
                >Market</button>
                <button
                  onClick={() => setOrderType('limit')}
                  className={`py-2 rounded-lg text-xs font-semibold ${orderType === 'limit' ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted'}`}
                >Limit</button>
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Quantity</label>
                <input type="number" min="1" value={orderQty} onChange={e => setOrderQty(e.target.value)} placeholder="Shares" className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none" />
              </div>
              {orderType === 'limit' && (
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Limit Price (USD)</label>
                  <input type="number" min="0" step="0.01" value={orderLimit} onChange={e => setOrderLimit(e.target.value)} placeholder="$0.00" className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none" />
                </div>
              )}
              {quote && orderQty && (
                <div className="bg-white/[0.03] rounded-lg p-3 text-xs">
                  <div className="flex justify-between"><span className="text-text-muted">Estimated Total</span><span className="text-text-primary font-num font-semibold">{fmtUSD(quote.price * parseInt(orderQty || '0'))}</span></div>
                </div>
              )}
              <button
                onClick={handlePlaceOrder}
                disabled={placeMut.isPending || !selectedSymbol}
                className={`w-full py-3 rounded-lg text-sm font-bold disabled:opacity-50 ${orderSide === 'buy' ? 'bg-gf-green text-bg' : 'bg-red-500 text-white'}`}
              >
                {placeMut.isPending ? 'Placing...' : `${orderSide.toUpperCase()} ${selectedSymbol || 'Stock'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'positions' && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">US Positions</h3>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-white/5">
                  <th className="py-2 px-3 text-left">Symbol</th>
                  <th className="py-2 px-3 text-right">Shares</th>
                  <th className="py-2 px-3 text-right">Avg Cost</th>
                  <th className="py-2 px-3 text-right">Price</th>
                  <th className="py-2 px-3 text-right">P&L</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {usPositions.map(p => {
                  const pnl = p.unrealizedPnL ?? (p.currentPrice ? (p.currentPrice - p.avgCost) * p.shares : 0);
                  return (
                    <tr key={p.id} className="border-b border-white/[0.02] hover:bg-white/[0.03]">
                      <td className="py-2.5 px-3 font-semibold text-text-primary">{p.symbol}</td>
                      <td className="py-2.5 px-3 text-right font-num">{fmtInt(p.shares)}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-secondary">{fmtUSD(p.avgCost)}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtUSD(p.currentPrice)}</td>
                      <td className={`py-2.5 px-3 text-right font-num ${changeColor(pnl)}`}>{fmtUSD(pnl)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => { if (confirm(`Close ${p.symbol} position?`)) closeMut.mutate(p.symbol); }}
                          className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20"
                        >Close</button>
                      </td>
                    </tr>
                  );
                })}
                {usPositions.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-text-muted">No US positions</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">US Orders</h3>
          {ordersLoading ? <SkeletonTable rows={5} /> : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-white/5">
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Symbol</th>
                    <th className="py-2 px-3 text-center">Side</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usOrders.map(o => (
                    <tr key={o.id} className="border-b border-white/[0.02] hover:bg-white/[0.03]">
                      <td className="py-2.5 px-3 text-text-secondary">{fmtDateTime(o.createdAt)}</td>
                      <td className="py-2.5 px-3 font-semibold text-text-primary">{o.symbol}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${o.side === 'BUY' ? 'bg-gf-green/10 text-gf-green' : 'bg-red-500/10 text-red-400'}`}>{o.side}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-num">{fmtInt(o.quantity)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          o.status === 'FILLED' ? 'bg-gf-green/10 text-gf-green' : ['CANCELLED','REJECTED'].includes(o.status) ? 'bg-red-500/10 text-red-400' : 'bg-gf-blue/10 text-gf-blue'
                        }`}>{o.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {['PENDING','OPEN'].includes(o.status) && (
                          <button onClick={() => cancelMut.mutate(o.id)} className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20">Cancel</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {usOrders.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-text-muted">No US orders</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
