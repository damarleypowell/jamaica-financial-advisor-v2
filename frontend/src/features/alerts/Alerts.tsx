import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useMarketStore } from '../../stores/market';
import type { SubscriptionTier } from '../../types';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type AlertCondition =
  | 'ABOVE'
  | 'BELOW'
  | 'PERCENT_CHANGE_ABOVE'
  | 'PERCENT_CHANGE_BELOW';

interface Alert {
  id: string;
  symbol: string;
  targetValue: number;
  /** Backend field — also check targetPrice */
  targetPrice?: number;
  condition: AlertCondition;
  isTriggered?: boolean;
  triggered?: boolean;
  createdAt: string;
}

interface AlertsResponse {
  alerts: Alert[];
}

interface SubscriptionResponse {
  plan?: SubscriptionTier;
  tier?: SubscriptionTier;
  maxAlerts?: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const MAX_ALERTS_BY_TIER: Record<string, number> = {
  FREE:       3,
  BASIC:     10,
  PRO:       50,
  ENTERPRISE: 999,
};

const CONDITION_LABELS: Record<AlertCondition, string> = {
  ABOVE:                'Price goes ABOVE',
  BELOW:                'Price goes BELOW',
  PERCENT_CHANGE_ABOVE: '% Change goes ABOVE',
  PERCENT_CHANGE_BELOW: '% Change goes BELOW',
};

function conditionDescription(alert: Alert): string {
  const price = alert.targetPrice ?? alert.targetValue ?? 0;
  const sym   = alert.symbol;
  switch (alert.condition) {
    case 'ABOVE':                return `Notify when ${sym} exceeds J$${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    case 'BELOW':                return `Notify when ${sym} drops below J$${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    case 'PERCENT_CHANGE_ABOVE': return `Notify when ${sym} gains more than ${price}%`;
    case 'PERCENT_CHANGE_BELOW': return `Notify when ${sym} falls more than ${price}%`;
    default:                     return `Alert on ${sym}`;
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                            */
/* ------------------------------------------------------------------ */

function Skeleton({ h = 18, w = '100%', r = 8 }: { h?: number; w?: string | number; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

/* ------------------------------------------------------------------ */
/*  AlertCard                                                           */
/* ------------------------------------------------------------------ */

function AlertCard({ alert, onDelete, deleting }: { alert: Alert; onDelete: () => void; deleting: boolean }) {
  const triggered = alert.isTriggered ?? alert.triggered ?? false;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '16px 18px', borderRadius: 14,
        background: 'var(--color-bg3)', border: `1px solid ${triggered ? 'rgba(0,230,118,.2)' : 'var(--color-border)'}`,
        transition: 'border-color .2s',
      }}
    >
      {/* Icon */}
      <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: triggered ? 'rgba(0,230,118,.1)' : 'rgba(255,152,0,.08)' }}>
        <i className={`fa-solid ${triggered ? 'fa-circle-check' : 'fa-bell'}`} style={{ fontSize: 16, color: triggered ? 'var(--color-green)' : '#ff9800' }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          {/* Symbol badge */}
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 6, fontSize: 11, fontWeight: 800, letterSpacing: '.05em', background: 'rgba(0,230,118,.08)', border: '1px solid rgba(0,230,118,.18)', color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>
            {alert.symbol}
          </span>
          {/* Trigger status */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: triggered ? 'rgba(0,230,118,.08)' : 'rgba(255,152,0,.08)', border: `1px solid ${triggered ? 'rgba(0,230,118,.2)' : 'rgba(255,152,0,.2)'}`, color: triggered ? 'var(--color-green)' : '#ff9800' }}>
            <i className={`fa-solid fa-circle`} style={{ fontSize: 5 }} />
            {triggered ? 'Triggered' : 'Active'}
          </span>
        </div>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {conditionDescription(alert)}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)' }}>
          Created {fmtDate(alert.createdAt)}
        </p>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={deleting}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid transparent', background: 'transparent', cursor: deleting ? 'wait' : 'pointer', transition: 'all .15s', flexShrink: 0, opacity: deleting ? .4 : hovered ? 1 : .45, borderColor: hovered ? 'rgba(255,82,82,.3)' : 'transparent', backgroundColor: hovered ? 'rgba(255,82,82,.08)' : 'transparent' }}
      >
        <i className="fa-solid fa-trash-can" style={{ fontSize: 12, color: 'var(--color-red)' }} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                         */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 40px', gap: 14, textAlign: 'center' }}>
      {/* Illustration-like icon composition */}
      <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 4 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(0,230,118,.05)', border: '2px dashed rgba(0,230,118,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-solid fa-bell" style={{ fontSize: 28, color: 'var(--color-muted)', opacity: .35 }} />
        </div>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--color-bg2)', border: '2px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-solid fa-plus" style={{ fontSize: 9, color: 'var(--color-muted)' }} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>No price alerts yet</p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', maxWidth: 300, lineHeight: 1.6 }}>
        Create an alert above to get notified by email when a stock hits your target price.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export default function Alerts() {
  const { isAuthenticated, user } = useAuthStore();
  const stocks = useMarketStore(s => s.stocks);
  const qc = useQueryClient();

  /* ---- Form state ---- */
  const [symbol,       setSymbol]       = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [targetPrice,  setTargetPrice]  = useState('');
  const [condition,    setCondition]    = useState<AlertCondition>('ABOVE');
  const [formError,    setFormError]    = useState('');
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  /* ---- Stock search results ---- */
  const searchResults = useMemo(() => {
    if (!symbolSearch.trim()) return [];
    const q = symbolSearch.toLowerCase();
    return stocks.filter(s =>
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [symbolSearch, stocks]);

  /* ---- Fetch alerts ---- */
  const { data: alertsData, isLoading: alertsLoading, isError: alertsError, refetch: alertsRefetch } = useQuery<AlertsResponse>({
    queryKey: ['alerts'],
    queryFn: () => apiGet<AlertsResponse>('/api/alerts'),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  /* ---- Fetch subscription ---- */
  const { data: subData } = useQuery<SubscriptionResponse>({
    queryKey: ['subscription-info'],
    queryFn: async () => {
      try { return await apiGet<SubscriptionResponse>('/api/subscription'); }
      catch { return {}; }
    },
    enabled: isAuthenticated,
    staleTime: 120_000,
  });

  const alerts = alertsData?.alerts ?? [];
  const tier   = subData?.plan ?? subData?.tier ?? user?.subscriptionTier ?? 'FREE';
  const maxAlerts   = subData?.maxAlerts ?? MAX_ALERTS_BY_TIER[tier] ?? 3;
  const remaining   = Math.max(0, maxAlerts - alerts.length);
  const atLimit     = alerts.length >= maxAlerts;

  /* ---- Create alert ---- */
  const createMut = useMutation({
    mutationFn: () => {
      if (!symbol) throw new Error('Select a stock symbol');
      if (!targetPrice || isNaN(Number(targetPrice))) throw new Error('Enter a valid target price');
      return apiPost('/api/alerts', { symbol, targetPrice: Number(targetPrice), condition });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      setSymbol('');
      setSymbolSearch('');
      setTargetPrice('');
      setCondition('ABOVE');
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message || 'Failed to create alert'),
  });

  /* ---- Delete alert ---- */
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/alerts/${id}`),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  /* ---- Unauthenticated guard ---- */
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <i className="fa-solid fa-bell" style={{ fontSize: 40, color: 'var(--color-muted)', opacity: .4 }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Sign in to manage Price Alerts</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>Price Alerts</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
            Get notified by email when your targets are hit
          </p>
        </div>

        {/* Quota badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'var(--color-bg2)', border: '1px solid var(--color-border)' }}>
          <i className="fa-solid fa-bell" style={{ fontSize: 12, color: atLimit ? 'var(--color-red)' : 'var(--color-green)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text2)' }}>
            {alerts.length} / {maxAlerts === 999 ? '∞' : maxAlerts} alerts
          </span>
          {remaining < maxAlerts && maxAlerts !== 999 && (
            <span style={{ fontSize: 11, color: atLimit ? 'var(--color-red)' : 'var(--color-muted)' }}>
              · {atLimit ? 'Limit reached' : `${remaining} remaining`}
            </span>
          )}
        </div>
      </div>

      {/* ── Add alert card ── */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 18, padding: 24 }}>
        <p style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-plus-circle" style={{ fontSize: 13, color: 'var(--color-green)' }} />
          Create New Alert
        </p>

        {atLimit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,82,82,.07)', border: '1px solid rgba(255,82,82,.2)', marginBottom: 16 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 13, color: 'var(--color-red)' }} />
            <span style={{ fontSize: 12, color: 'var(--color-text2)' }}>
              You've reached your alert limit for the <strong style={{ color: 'var(--color-text)' }}>{tier}</strong> plan.{' '}
              <a href="/subscription" style={{ color: 'var(--color-green)', textDecoration: 'none', fontWeight: 700 }}>Upgrade</a> to add more.
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>

          {/* Symbol search */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.1em' }}>Stock Symbol</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--color-muted)', pointerEvents: 'none' }} />
                <input
                  value={symbol ? symbol : symbolSearch}
                  placeholder="e.g. NCB, JBG…"
                  readOnly={!!symbol}
                  onChange={e => {
                    setSymbolSearch(e.target.value);
                    setSymbol('');
                    setShowDropdown(true);
                    setFormError('');
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    paddingLeft: 34, paddingRight: symbol ? 32 : 12, paddingTop: 10, paddingBottom: 10,
                    background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)',
                    borderRadius: 10, fontSize: 13, color: 'var(--color-text)', outline: 'none',
                    cursor: symbol ? 'default' : 'text',
                  }}
                  onFocusCapture={e => { if (!symbol) e.target.style.borderColor = 'rgba(0,230,118,.45)'; }}
                  onBlurCapture={e => { e.target.style.borderColor = 'var(--color-border)'; }}
                />
                {symbol && (
                  <button
                    onClick={() => { setSymbol(''); setSymbolSearch(''); }}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 2 }}
                  >
                    <i className="fa-solid fa-xmark" style={{ fontSize: 11 }} />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {showDropdown && searchResults.length > 0 && !symbol && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--color-bg3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.45)', zIndex: 60, overflow: 'hidden' }}>
                  {searchResults.map(s => (
                    <button
                      key={s.symbol}
                      onMouseDown={() => { setSymbol(s.symbol); setSymbolSearch(s.symbol); setShowDropdown(false); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,.08)', flexShrink: 0 }}>
                        <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-green)' }}>{s.symbol.slice(0, 3)}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{s.symbol}</p>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)', fontFamily: 'var(--font-mono)' }}>
                        J${s.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Condition */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.1em' }}>Condition</label>
            <select
              value={condition}
              onChange={e => setCondition(e.target.value as AlertCondition)}
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, color: 'var(--color-text)', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
            >
              {(Object.entries(CONDITION_LABELS) as [AlertCondition, string][]).map(([val, label]) => (
                <option key={val} value={val} style={{ background: 'var(--color-bg3)' }}>{label}</option>
              ))}
            </select>
          </div>

          {/* Target price */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.1em' }}>
              {condition.includes('PERCENT') ? 'Target %' : 'Target Price (J$)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetPrice}
              onChange={e => { setTargetPrice(e.target.value); setFormError(''); }}
              placeholder={condition.includes('PERCENT') ? 'e.g. 5' : 'e.g. 120.00'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, color: 'var(--color-text)', outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(0,230,118,.45)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            />
          </div>

          {/* Submit */}
          <button
            onClick={() => { if (!atLimit) createMut.mutate(); }}
            disabled={createMut.isPending || atLimit || !symbol || !targetPrice}
            style={{
              padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: atLimit ? 'rgba(255,255,255,.06)' : 'var(--color-green)',
              color: atLimit ? 'var(--color-muted)' : 'var(--color-bg)',
              border: 'none', cursor: createMut.isPending || atLimit || !symbol || !targetPrice ? 'not-allowed' : 'pointer',
              opacity: createMut.isPending || !symbol || !targetPrice ? .5 : 1,
              transition: 'opacity .15s', whiteSpace: 'nowrap',
            }}
          >
            {createMut.isPending
              ? <><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 11, marginRight: 6 }} />Adding…</>
              : <><i className="fa-solid fa-bell-plus" style={{ fontSize: 11, marginRight: 6 }} />Add Alert</>
            }
          </button>
        </div>

        {formError && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 11 }} /> {formError}
          </p>
        )}
      </div>

      {/* ── Alerts list ── */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 18, overflow: 'hidden' }}>
        {/* List header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-list" style={{ fontSize: 13, color: 'var(--color-muted)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Active Alerts</span>
            {alerts.length > 0 && (
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', color: 'var(--color-green)' }}>
                {alerts.length}
              </span>
            )}
          </div>
          {alerts.some(a => a.isTriggered || a.triggered) && (
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 10, color: 'var(--color-green)', marginRight: 5 }} />
              {alerts.filter(a => a.isTriggered || a.triggered).length} triggered
            </span>
          )}
        </div>

        {/* Content */}
        {alertsLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 14 }}>
                <Skeleton h={40} w={40} r={10} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton h={14} w="40%" />
                  <Skeleton h={12} w="70%" />
                  <Skeleton h={11} w="30%" />
                </div>
              </div>
            ))}
          </div>
        ) : alertsError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,82,82,.1)', border: '1px solid rgba(255,82,82,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 18, color: 'var(--color-red)' }} />
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Unable to load alerts. Please try again.</p>
            <button onClick={() => alertsRefetch()}
              style={{ padding: '8px 20px', borderRadius: 10, background: 'var(--color-green)', color: 'var(--color-bg)', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Triggered alerts first */}
            {[...alerts]
              .sort((a, b) => {
                const aT = a.isTriggered || a.triggered ? 1 : 0;
                const bT = b.isTriggered || b.triggered ? 1 : 0;
                return bT - aT; // triggered first, then by date desc
              })
              .map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDelete={() => deleteMut.mutate(alert.id)}
                  deleting={deletingId === alert.id}
                />
              ))}
          </div>
        )}
      </div>

      {/* ── Upgrade notice (only for FREE/BASIC) ── */}
      {(tier === 'FREE' || tier === 'BASIC') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderRadius: 14, background: 'rgba(0,230,118,.04)', border: '1px solid rgba(0,230,118,.12)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fa-solid fa-rocket" style={{ fontSize: 14, color: 'var(--color-green)' }} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                Need more alerts?
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>
                {tier === 'FREE'
                  ? 'FREE plan includes 3 alerts. Upgrade to BASIC for 10, PRO for 50.'
                  : 'BASIC plan includes 10 alerts. Upgrade to PRO for up to 50.'}
              </p>
            </div>
          </div>
          <a href="/subscription" style={{ padding: '8px 20px', borderRadius: 9, background: 'var(--color-green)', color: 'var(--color-bg)', fontSize: 12, fontWeight: 800, textDecoration: 'none', transition: 'opacity .15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Upgrade Plan
          </a>
        </div>
      )}
    </div>
  );
}
