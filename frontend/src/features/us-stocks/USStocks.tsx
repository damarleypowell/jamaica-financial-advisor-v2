import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api';

interface USStock {
  symbol: string; name?: string; price?: number;
  change?: number; pctChange?: number; volume?: number;
  marketCap?: number; pe?: number; sector?: string;
}

interface USOrder { symbol: string; qty: number; side: 'buy' | 'sell'; type: 'market' | 'limit'; limitPrice?: number; }

const fmtLg = (n?: number) => {
  if (!n) return '—';
  if (n >= 1e12) return (n/1e12).toFixed(2)+'T';
  if (n >= 1e9) return (n/1e9).toFixed(2)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  return n.toLocaleString();
};

const POPULAR = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'JNJ'];

export default function USStocks() {
  const [search, setSearch] = useState('');
  const [orderSymbol, setOrderSymbol] = useState('');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderQty, setOrderQty] = useState('1');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  const symbolsToFetch = search.trim().toUpperCase()
    ? [search.trim().toUpperCase()]
    : POPULAR;

  const { data, isLoading } = useQuery<USStock[]>({
    queryKey: ['us-stocks', symbolsToFetch.join(',')],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic API response shape
      const res: any = await apiPost('/api/us/quotes', { symbols: symbolsToFetch });
      // Backend returns { AAPL: { price, bid, ask, volume, change }, ... }
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return Object.entries(res).map(([sym, q]: [string, any]) => ({
          symbol: sym,
          name: q.name ?? sym,
          price: q.price ?? q.ask ?? null,
          change: null,
          pctChange: typeof q.change === 'string' ? parseFloat(q.change) : (q.change ?? null),
          volume: q.volume ?? null,
          marketCap: q.marketCap ?? null,
        }));
      }
      return [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const orderMutation = useMutation({
    mutationFn: (order: USOrder): Promise<{ id?: string }> => apiPost('/api/us/orders', {
      symbol: order.symbol,
      qty: order.qty,
      side: order.side,
      type: order.type,
      timeInForce: 'gtc',
      limitPrice: order.limitPrice,
    }),
    onSuccess: (res: { id?: string }) => {
      setOrderStatus(`Order placed: ${res.id ?? 'submitted'}`);
      setTimeout(() => setOrderStatus(null), 5000);
    },
    onError: (err: Error) => { setOrderStatus(`Error: ${err.message}`); setTimeout(() => setOrderStatus(null), 5000); },
  });

  const stocks = data ?? [];
  const selected = stocks.find(s => s.symbol === orderSymbol) ?? (orderSymbol ? { symbol: orderSymbol } as USStock : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>US Stocks</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>Practice with US equities — paper trading via Alpaca, real live prices</p>
      </div>

      <div className="us-layout">

        {/* Stock list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Search */}
          <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--color-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())} placeholder="Search symbols (e.g. AAPL, MSFT)..."
                style={{ width: '100%', height: 38, paddingLeft: 36, paddingRight: 12, borderRadius: 9, fontSize: 12, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,230,118,.4)'}
                onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
              />
            </div>
            {!search && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                {POPULAR.map(sym => (
                  <button key={sym} onClick={() => setOrderSymbol(sym)}
                    style={{ padding: '3px 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text2)', cursor: 'pointer' }}>
                    {sym}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading US market data...
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      {['Symbol', 'Company', 'Price', '$Chg', '%Chg', 'Volume', 'Mkt Cap', ''].map((h, i) => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', textAlign: i > 1 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)' }}>No data available — check Alpaca API config</td></tr>
                    ) : stocks.map(s => {
                      const pos = (s.pctChange ?? 0) > 0, neg = (s.pctChange ?? 0) < 0;
                      const cc = pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)';
                      return (
                        <tr key={s.symbol}
                          style={{ borderBottom: '1px solid rgba(255,255,255,.025)', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                        >
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(64,196,255,.1)' }}>
                                <i className="fa-solid fa-flag-usa" style={{ fontSize: 9, color: '#40c4ff' }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>{s.symbol}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--color-text2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>${(s.price ?? 0).toFixed(2)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: cc }}>{pos ? '+' : ''}{(s.change ?? 0).toFixed(2)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: cc }}>{pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>{fmtLg(s.volume)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>{fmtLg(s.marketCap)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button onClick={() => setOrderSymbol(s.symbol)}
                              style={{ padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 600, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', color: '#00e676', cursor: 'pointer' }}>
                              Trade
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Order panel */}
        <div className="us-order" style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px', height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(64,196,255,.1)' }}>
              <i className="fa-solid fa-flag-usa" style={{ fontSize: 12, color: '#40c4ff' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>Place Order</h3>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>via Alpaca Markets</p>
            </div>
          </div>

          {/* Symbol */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>Symbol</label>
            <input value={orderSymbol} onChange={e => setOrderSymbol(e.target.value.toUpperCase())} placeholder="e.g. AAPL"
              style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.05)', border: `1px solid ${orderSymbol ? 'rgba(0,230,118,.3)' : 'var(--color-border)'}`, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Side */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>Side</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['buy', 'sell'] as const).map(s => (
                <button key={s} onClick={() => setOrderSide(s)}
                  style={{ flex: 1, height: 36, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid', transition: 'all 150ms', background: orderSide === s ? (s === 'buy' ? '#00e676' : '#ff5252') : 'rgba(255,255,255,.04)', color: orderSide === s ? 'var(--color-bg)' : 'var(--color-text2)', borderColor: orderSide === s ? (s === 'buy' ? '#00e676' : '#ff5252') : 'var(--color-border)', textTransform: 'capitalize' }}>
                  {s === 'buy' ? '▲ Buy' : '▼ Sell'}
                </button>
              ))}
            </div>
          </div>

          {/* Qty */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>Quantity</label>
            <input value={orderQty} onChange={e => setOrderQty(e.target.value)} type="number" min="1" step="1"
              style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Order type */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>Order Type</label>
            <select value={orderType} onChange={e => setOrderType(e.target.value as 'market' | 'limit')}
              style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 12, background: 'var(--color-bg3)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}>
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </div>

          {orderType === 'limit' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>Limit Price (USD)</label>
              <input value={limitPrice} onChange={e => setLimitPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00"
                style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}

          {selected?.price && (
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,.03)', marginBottom: 14, fontSize: 11, color: 'var(--color-muted)' }}>
              Est. value: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text)' }}>
                ${((selected.price ?? 0) * parseInt(orderQty || '0')).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {orderStatus && (
            <div style={{ padding: '10px 12px', borderRadius: 9, background: orderStatus.startsWith('Error') ? 'rgba(255,82,82,.1)' : 'rgba(0,230,118,.1)', border: `1px solid ${orderStatus.startsWith('Error') ? 'rgba(255,82,82,.2)' : 'rgba(0,230,118,.2)'}`, marginBottom: 14, fontSize: 11, color: orderStatus.startsWith('Error') ? '#ff5252' : '#00e676' }}>
              {orderStatus}
            </div>
          )}

          <button
            onClick={() => {
              if (!orderSymbol || !orderQty) return;
              orderMutation.mutate({ symbol: orderSymbol, qty: parseInt(orderQty), side: orderSide, type: orderType, limitPrice: limitPrice ? parseFloat(limitPrice) : undefined });
            }}
            disabled={!orderSymbol || !orderQty || orderMutation.isPending}
            style={{ width: '100%', height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 200ms', background: orderSide === 'buy' ? 'var(--color-green)' : '#ff5252', color: 'var(--color-bg)', opacity: (!orderSymbol || !orderQty || orderMutation.isPending) ? .5 : 1 }}>
            {orderMutation.isPending ? <i className="fa-solid fa-spinner fa-spin" /> : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${orderSymbol || '—'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
