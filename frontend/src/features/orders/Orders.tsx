import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { Order, Transaction } from '../../types';

type Tab = 'orders' | 'history';

const fmt2 = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusStyle = (s: string): React.CSSProperties => {
  if (s === 'FILLED')    return { background: 'rgba(0,230,118,.1)',  border: '1px solid rgba(0,230,118,.2)',  color: 'var(--color-green)' };
  if (s === 'PENDING' || s === 'OPEN') return { background: 'rgba(255,215,64,.1)', border: '1px solid rgba(255,215,64,.2)', color: 'var(--color-gold)'  };
  if (s === 'CANCELLED' || s === 'REJECTED' || s === 'EXPIRED') return { background: 'rgba(255,82,82,.1)',  border: '1px solid rgba(255,82,82,.2)',  color: 'var(--color-red)'   };
  return { background: 'rgba(var(--fg),.05)', border: '1px solid rgba(var(--fg),.08)', color: 'var(--color-muted)' };
};

export default function Orders() {
  const { isAuthenticated } = useAuthStore();
  const [tab, setTab] = useState<Tab>('orders');

  const { data: orders = [], isLoading: oLoad, isError: oError, refetch: oRefetch } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await apiGet<{ orders?: unknown[] } | unknown[]>('/api/orders');
      // Backend returns { orders: [...] }
      const rawOrders = (Array.isArray(res) ? res : (res?.orders ?? [])) as Record<string, unknown>[];
      // Normalise: backend uses orderType not type
      return rawOrders.map((o) => ({
        ...o,
        type: o.type ?? o.orderType ?? 'MARKET',
        price: o.price ?? o.limitPrice ?? o.avgFillPrice ?? null,
      })) as Order[];
    },
    enabled: isAuthenticated,
    retry: 1,
  });

  const { data: transactions = [], isLoading: tLoad, isError: tError, refetch: tRefetch } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await apiGet<{ transactions?: unknown[] } | unknown[]>('/api/portfolio/history');
      // Backend returns { transactions: [...] }
      const txs = (Array.isArray(res) ? res : (res?.transactions ?? [])) as Record<string, unknown>[];
      // Normalise field names: backend uses totalAmount/feeAmount/shares
      return txs.map((t) => ({
        ...t,
        side: t.type === 'BUY' || t.type === 'SELL' ? t.type : (t.side ?? t.type),
        quantity: t.quantity ?? t.shares ?? 0,
        total: t.total ?? t.totalAmount ?? 0,
        fee: t.fee ?? t.feeAmount ?? 0,
      })) as Transaction[];
    },
    enabled: isAuthenticated && tab === 'history',
    retry: 1,
  });

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: 40, color: 'var(--color-muted)', opacity: .4 }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Sign in to view orders</p>
      </div>
    );
  }

  const TABS = [
    { key: 'orders' as Tab, label: 'Open Orders', icon: 'fa-solid fa-list-check' },
    { key: 'history' as Tab, label: 'Trade History', icon: 'fa-solid fa-clock-rotate-left' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 4, padding: 12, borderBottom: '1px solid var(--color-border)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s',
                background: tab === t.key ? 'var(--color-green)' : 'rgba(var(--fg),.04)',
                color: tab === t.key ? 'var(--color-bg)' : 'var(--color-muted)' }}>
              <i className={`${t.icon} text-[10px]`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Orders table */}
        {tab === 'orders' && (
          oLoad ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
            </div>
          ) : oError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,82,82,.1)', border: '1px solid rgba(255,82,82,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 18, color: 'var(--color-red)' }} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Unable to load orders. Please try again.</p>
              <button onClick={() => oRefetch()}
                style={{ padding: '8px 20px', borderRadius: 10, background: 'var(--color-green)', color: 'var(--color-bg)', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Retry
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 10 }}>
              <i className="fa-solid fa-list-check" style={{ fontSize: 28, color: 'var(--color-muted)', opacity: .25 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text2)' }}>No open orders</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Place a trade from the stock detail panel</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(var(--fg),.04)' }}>
                    {['Symbol', 'Side', 'Type', 'Qty', 'Price', 'Status', 'Date'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(var(--fg),.025)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--fg),.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{o.symbol}</span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: o.side === 'BUY' ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', color: o.side === 'BUY' ? 'var(--color-green)' : 'var(--color-red)', border: o.side === 'BUY' ? '1px solid rgba(0,230,118,.2)' : '1px solid rgba(255,82,82,.2)' }}>
                          {o.side}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, color: 'var(--color-muted)' }}>{o.type}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>{o.quantity.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>{o.price ? `$${fmt2(o.price)}` : 'MKT'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{ ...statusStyle(o.status), display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{o.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, color: 'var(--color-muted)' }}>
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* History table */}
        {tab === 'history' && (
          tLoad ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />)}
            </div>
          ) : tError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,82,82,.1)', border: '1px solid rgba(255,82,82,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 18, color: 'var(--color-red)' }} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Unable to load orders. Please try again.</p>
              <button onClick={() => tRefetch()}
                style={{ padding: '8px 20px', borderRadius: 10, background: 'var(--color-green)', color: 'var(--color-bg)', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Retry
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 10 }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: 28, color: 'var(--color-muted)', opacity: .25 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text2)' }}>No trade history</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Your completed trades will appear here</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(var(--fg),.04)' }}>
                    {['Date', 'Symbol', 'Side', 'Qty', 'Price', 'Total', 'Fee'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', textAlign: i <= 1 ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(var(--fg),.025)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--fg),.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-muted)' }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{tx.symbol}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: tx.side === 'BUY' ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', color: tx.side === 'BUY' ? 'var(--color-green)' : 'var(--color-red)', border: tx.side === 'BUY' ? '1px solid rgba(0,230,118,.2)' : '1px solid rgba(255,82,82,.2)' }}>
                          {tx.side}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>{tx.quantity}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>${fmt2(tx.price)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text)' }}>${fmt2(tx.total)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>${fmt2(tx.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
