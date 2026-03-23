import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { placeOrder, getOrders, cancelOrder } from '@/api/orders';
import { getStocks } from '@/api/market';
import { useAuth } from '@/context/AuthContext';
import { fmtJMD, fmtInt, fmtDateTime, fmtPercent, changeColor } from '@/utils/formatters';
import { SkeletonTable } from '@/components/common/LoadingSpinner';
import type { OrderSide, OrderType, Order } from '@/types';
import toast from 'react-hot-toast';

type Tab = 'place' | 'open' | 'history';

export default function Orders() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('place');

  // Order form state
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<OrderSide>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);

  const { data: stocks = [] } = useQuery({
    queryKey: ['stocks'],
    queryFn: getStocks,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
    enabled: isAuthenticated,
    refetchInterval: 15_000,
  });

  const placeMut = useMutation({
    mutationFn: placeOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      toast.success('Order placed successfully');
      setQuantity('');
      setLimitPrice('');
      setStopPrice('');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to place order'),
  });

  const cancelMut = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order cancelled');
    },
    onError: () => toast.error('Failed to cancel order'),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <i className="fas fa-receipt text-4xl text-text-muted mb-4" />
        <h2 className="text-xl font-bold text-text-primary mb-2">Orders</h2>
        <p className="text-sm text-text-secondary">Please log in to place and manage orders.</p>
      </div>
    );
  }

  const selectedStock = stocks.find(s => s.symbol === symbol);
  const filteredSymbols = symbolSearch
    ? stocks.filter(s => s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) || s.name.toLowerCase().includes(symbolSearch.toLowerCase())).slice(0, 8)
    : [];

  const openOrders = orders.filter(o => ['PENDING', 'OPEN', 'PARTIALLY_FILLED'].includes(o.status));
  const completedOrders = orders.filter(o => !['PENDING', 'OPEN', 'PARTIALLY_FILLED'].includes(o.status));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol) return toast.error('Select a symbol');
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) return toast.error('Enter a valid quantity');

    placeMut.mutate({
      symbol,
      side: side.toLowerCase() as 'buy' | 'sell',
      type: orderType.toLowerCase() as 'market' | 'limit' | 'stop' | 'stop_limit',
      quantity: qty,
      ...(orderType === 'LIMIT' || orderType === 'STOP_LIMIT' ? { limitPrice: parseFloat(limitPrice) } : {}),
      ...(orderType === 'STOP' || orderType === 'STOP_LIMIT' ? { stopPrice: parseFloat(stopPrice) } : {}),
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'FILLED': return 'bg-gf-green/10 text-gf-green';
      case 'CANCELLED': case 'EXPIRED': case 'REJECTED': return 'bg-red-500/10 text-red-400';
      case 'PARTIALLY_FILLED': return 'bg-gf-gold/10 text-gf-gold';
      default: return 'bg-gf-blue/10 text-gf-blue';
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1">
        {(['place', 'open', 'history'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === t ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
            }`}
          >
            {t === 'place' ? 'Place Order' : t === 'open' ? `Open (${openOrders.length})` : 'History'}
          </button>
        ))}
      </div>

      {tab === 'place' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Form */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Place Order</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Symbol Search */}
              <div className="relative">
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Symbol</label>
                <input
                  type="text"
                  value={symbol || symbolSearch}
                  onChange={e => { setSymbolSearch(e.target.value); setSymbol(''); setShowSymbolDropdown(true); }}
                  onFocus={() => setShowSymbolDropdown(true)}
                  placeholder="Search stock..."
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                />
                {showSymbolDropdown && filteredSymbols.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-bg3 border border-white/10 rounded-lg max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredSymbols.map(s => (
                      <button
                        key={s.symbol}
                        type="button"
                        onClick={() => { setSymbol(s.symbol); setSymbolSearch(''); setShowSymbolDropdown(false); }}
                        className="w-full px-3 py-2 flex justify-between hover:bg-white/5 text-left text-xs"
                      >
                        <span className="font-semibold text-text-primary">{s.symbol}</span>
                        <span className="text-text-muted">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Side */}
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Side</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSide('BUY')}
                    className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      side === 'BUY' ? 'bg-gf-green text-bg' : 'bg-white/5 text-text-muted hover:bg-white/10'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide('SELL')}
                    className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      side === 'SELL' ? 'bg-red-500 text-white' : 'bg-white/5 text-text-muted hover:bg-white/10'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              {/* Order Type */}
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Order Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'] as OrderType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOrderType(t)}
                      className={`py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                        orderType === t ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:bg-white/10'
                      }`}
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="Number of shares"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                />
              </div>

              {/* Limit Price */}
              {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Limit Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={limitPrice}
                    onChange={e => setLimitPrice(e.target.value)}
                    placeholder="J$0.00"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                  />
                </div>
              )}

              {/* Stop Price */}
              {(orderType === 'STOP' || orderType === 'STOP_LIMIT') && (
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Stop Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stopPrice}
                    onChange={e => setStopPrice(e.target.value)}
                    placeholder="J$0.00"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                  />
                </div>
              )}

              {/* Estimated Cost */}
              {selectedStock && quantity && (
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-muted">Current Price</span>
                    <span className="text-text-primary font-num">{fmtJMD(selectedStock.price)}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-text-muted">Estimated Total</span>
                    <span className="text-text-primary font-num font-semibold">
                      {fmtJMD(selectedStock.price * parseInt(quantity || '0'))}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={placeMut.isPending}
                className={`w-full py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
                  side === 'BUY'
                    ? 'bg-gf-green text-bg hover:bg-gf-green/90'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {placeMut.isPending ? 'Placing...' : `${side} ${symbol || 'Stock'}`}
              </button>
            </form>
          </div>

          {/* Quick Info */}
          {selectedStock && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4">{selectedStock.symbol} — {selectedStock.name}</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <InfoRow label="Price" value={fmtJMD(selectedStock.price)} />
                <InfoRow label="Change" value={fmtPercent(selectedStock.changePercent)} className={changeColor(selectedStock.changePercent)} />
                <InfoRow label="Volume" value={fmtInt(selectedStock.volume)} />
                <InfoRow label="Open" value={fmtJMD(selectedStock.open)} />
                <InfoRow label="High" value={fmtJMD(selectedStock.high)} />
                <InfoRow label="Low" value={fmtJMD(selectedStock.low)} />
                <InfoRow label="52w High" value={fmtJMD(selectedStock.week52High)} />
                <InfoRow label="52w Low" value={fmtJMD(selectedStock.week52Low)} />
                <InfoRow label="P/E" value={selectedStock.peRatio?.toFixed(2) ?? '—'} />
                <InfoRow label="Div Yield" value={selectedStock.dividendYield ? fmtPercent(selectedStock.dividendYield) : '—'} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'open' && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Open Orders</h3>
          {ordersLoading ? <SkeletonTable rows={3} /> : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-white/5">
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Symbol</th>
                    <th className="py-2 px-3 text-center">Side</th>
                    <th className="py-2 px-3 text-center">Type</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Filled</th>
                    <th className="py-2 px-3 text-right">Limit</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map(o => (
                    <tr key={o.id} className="border-b border-white/[0.02] hover:bg-white/[0.03]">
                      <td className="py-2.5 px-3 text-text-secondary">{fmtDateTime(o.createdAt)}</td>
                      <td className="py-2.5 px-3 font-semibold text-text-primary">{o.symbol}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${o.side === 'BUY' ? 'bg-gf-green/10 text-gf-green' : 'bg-red-500/10 text-red-400'}`}>
                          {o.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-text-muted">{o.orderType}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtInt(o.quantity)}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-secondary">{fmtInt(o.filledQty)}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-secondary">{o.limitPrice ? fmtJMD(o.limitPrice) : '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor(o.status)}`}>{o.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => cancelMut.mutate(o.id)}
                          disabled={cancelMut.isPending}
                          className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                  {openOrders.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-text-muted">No open orders</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Order History</h3>
          {ordersLoading ? <SkeletonTable rows={5} /> : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-white/5">
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Symbol</th>
                    <th className="py-2 px-3 text-center">Side</th>
                    <th className="py-2 px-3 text-center">Type</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Avg Fill</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {completedOrders.map(o => (
                    <tr key={o.id} className="border-b border-white/[0.02] hover:bg-white/[0.03]">
                      <td className="py-2.5 px-3 text-text-secondary">{fmtDateTime(o.createdAt)}</td>
                      <td className="py-2.5 px-3 font-semibold text-text-primary">{o.symbol}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${o.side === 'BUY' ? 'bg-gf-green/10 text-gf-green' : 'bg-red-500/10 text-red-400'}`}>
                          {o.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-text-muted">{o.orderType}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtInt(o.quantity)}</td>
                      <td className="py-2.5 px-3 text-right font-num text-text-secondary">{o.avgFillPrice ? fmtJMD(o.avgFillPrice) : '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor(o.status)}`}>{o.status}</span>
                      </td>
                    </tr>
                  ))}
                  {completedOrders.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-text-muted">No order history</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-text-muted">{label}</p>
      <p className={`font-num font-semibold ${className || 'text-text-primary'}`}>{value}</p>
    </div>
  );
}
