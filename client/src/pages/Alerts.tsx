import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlerts, createAlert, deleteAlert, getNotifications, markNotificationRead, markAllNotificationsRead } from '@/api/alerts';
import { getStocks } from '@/api/market';
import { useAuth } from '@/context/AuthContext';
import { fmtJMD, fmtPercent, fmtRelativeTime } from '@/utils/formatters';
import { SkeletonTable } from '@/components/common/LoadingSpinner';
import type { AlertCondition, PriceAlert, Notification as NotifType } from '@/types';
import toast from 'react-hot-toast';

type Tab = 'alerts' | 'notifications';

export default function Alerts() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('alerts');

  // Create alert form
  const [alertSymbol, setAlertSymbol] = useState('');
  const [alertCondition, setAlertCondition] = useState<AlertCondition>('ABOVE');
  const [alertValue, setAlertValue] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    enabled: isAuthenticated,
  });

  const { data: notifications = [], isLoading: notifsLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    enabled: isAuthenticated && tab === 'notifications',
  });

  const { data: stocks = [] } = useQuery({
    queryKey: ['stocks'],
    queryFn: getStocks,
  });

  const createMut = useMutation({
    mutationFn: createAlert,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alerts'] }); toast.success('Alert created'); setAlertSymbol(''); setAlertValue(''); },
    onError: () => toast.error('Failed to create alert'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alerts'] }); toast.success('Alert deleted'); },
  });

  const markReadMut = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); toast.success('All marked as read'); },
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <i className="fas fa-bell text-4xl text-text-muted mb-4" />
        <h2 className="text-xl font-bold text-text-primary mb-2">Alerts & Notifications</h2>
        <p className="text-sm text-text-secondary">Please log in to manage alerts.</p>
      </div>
    );
  }

  const filteredSymbols = symbolSearch
    ? stocks.filter(s => s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) || s.name.toLowerCase().includes(symbolSearch.toLowerCase())).slice(0, 6)
    : [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertSymbol) return toast.error('Select a symbol');
    const val = parseFloat(alertValue);
    if (!val || val <= 0) return toast.error('Enter a valid target value');
    createMut.mutate({ symbol: alertSymbol, condition: alertCondition, targetValue: val });
  };

  const conditionLabel = (c: AlertCondition) => {
    switch (c) {
      case 'ABOVE': return 'Price Above';
      case 'BELOW': return 'Price Below';
      case 'PERCENT_CHANGE_ABOVE': return 'Change % Above';
      case 'PERCENT_CHANGE_BELOW': return 'Change % Below';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => setTab('alerts')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === 'alerts' ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted'}`}
        >
          <i className="fas fa-bell mr-1.5" />Price Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setTab('notifications')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors relative ${tab === 'notifications' ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted'}`}
        >
          <i className="fas fa-inbox mr-1.5" />Notifications
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">{unreadCount}</span>
          )}
        </button>
      </div>

      {tab === 'alerts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Alert */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Create Alert</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Symbol */}
              <div className="relative">
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Symbol</label>
                <input
                  type="text"
                  value={alertSymbol || symbolSearch}
                  onChange={e => { setSymbolSearch(e.target.value); setAlertSymbol(''); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Search stock..."
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                />
                {showDropdown && filteredSymbols.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-bg3 border border-white/10 rounded-lg max-h-40 overflow-y-auto custom-scrollbar">
                    {filteredSymbols.map(s => (
                      <button key={s.symbol} type="button" onMouseDown={() => { setAlertSymbol(s.symbol); setSymbolSearch(''); setShowDropdown(false); }}
                        className="w-full px-3 py-2 flex justify-between hover:bg-white/5 text-left text-xs">
                        <span className="font-semibold text-text-primary">{s.symbol}</span>
                        <span className="text-text-muted">{fmtJMD(s.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Condition */}
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Condition</label>
                <select
                  value={alertCondition}
                  onChange={e => setAlertCondition(e.target.value as AlertCondition)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                >
                  <option value="ABOVE">Price Above</option>
                  <option value="BELOW">Price Below</option>
                  <option value="PERCENT_CHANGE_ABOVE">% Change Above</option>
                  <option value="PERCENT_CHANGE_BELOW">% Change Below</option>
                </select>
              </div>

              {/* Target */}
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                  {alertCondition.includes('PERCENT') ? 'Target %' : 'Target Price (J$)'}
                </label>
                <input type="number" min="0" step="0.01" value={alertValue} onChange={e => setAlertValue(e.target.value)} placeholder={alertCondition.includes('PERCENT') ? '5.00' : '100.00'}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                />
              </div>

              <button type="submit" disabled={createMut.isPending} className="w-full py-3 rounded-lg bg-gf-green text-bg text-sm font-bold hover:bg-gf-green/90 disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Alert'}
              </button>
            </form>
          </div>

          {/* Alert List */}
          <div className="lg:col-span-2 glass-card p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Active Alerts</h3>
            {alertsLoading ? <SkeletonTable rows={4} /> : alerts.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-xs">
                <i className="fas fa-bell-slash text-2xl mb-3 block" />No alerts yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a: PriceAlert) => (
                  <div key={a.id} className={`flex items-center justify-between bg-white/[0.03] rounded-lg p-3 ${a.isTriggered ? 'border-l-2 border-gf-gold' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.isTriggered ? 'bg-gf-gold/10' : 'bg-gf-green/10'}`}>
                        <i className={`fas ${a.isTriggered ? 'fa-check-circle text-gf-gold' : 'fa-bell text-gf-green'} text-xs`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">{a.symbol}</p>
                        <p className="text-[10px] text-text-muted">
                          {conditionLabel(a.condition)}: {a.condition.includes('PERCENT') ? fmtPercent(a.targetValue) : fmtJMD(a.targetValue)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.isTriggered && <span className="px-1.5 py-0.5 rounded bg-gf-gold/10 text-gf-gold text-[10px] font-semibold">Triggered</span>}
                      <button onClick={() => deleteMut.mutate(a.id)} className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors">
                        <i className="fas fa-trash text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={() => markAllReadMut.mutate()} className="px-3 py-1.5 rounded-lg bg-white/5 text-text-muted text-xs font-semibold hover:bg-white/10">
                Mark all read
              </button>
            )}
          </div>
          {notifsLoading ? <SkeletonTable rows={5} /> : notifications.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs">
              <i className="fas fa-inbox text-2xl mb-3 block" />No notifications
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n: NotifType) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markReadMut.mutate(n.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${n.isRead ? 'bg-transparent hover:bg-white/[0.02]' : 'bg-gf-green/5 hover:bg-gf-green/10'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.isRead ? 'bg-white/5' : 'bg-gf-green/10'}`}>
                    <i className={`fas fa-${n.type === 'alert' ? 'bell' : n.type === 'order' ? 'receipt' : 'info-circle'} text-xs ${n.isRead ? 'text-text-muted' : 'text-gf-green'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${n.isRead ? 'text-text-secondary' : 'text-text-primary'}`}>{n.title}</p>
                    {n.body && <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{n.body}</p>}
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0">{fmtRelativeTime(n.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
