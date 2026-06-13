import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { apiGet, apiPost } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

interface SubscriptionData {
  plan: string; status: string; currentPeriodEnd: string | null;
  limits: Record<string, string | boolean | number>;
  usage: { tradesThisMonth: number; tradesRemaining: number | string; watchlists: number; watchlistsRemaining: number | string; activeAlerts: number; alertsRemaining: number | string; aiChatsToday: number; aiChatsRemaining: number | string; };
}
interface PayPalConfig { clientId: string | null; mode: 'sandbox' | 'live'; configured: boolean; }
interface CreateOrderResponse { orderId: string; approveUrl: string; }
interface CaptureOrderResponse { success: boolean; plan: string; message: string; }

// Prices here are fallbacks; the live values come from GET /api/subscription/plans
// (the backend catalog is the single source of truth — see PLAN_CATALOG).
const PLANS = [
  { id: 'CORE', name: 'Core', priceUSD: 14.99, priceJMD: 2400, badge: null, icon: 'fa-solid fa-bolt', color: '#40c4ff', description: 'Perfect for investors getting started on the JSE.', features: ['50 trades per month', '5 watchlists', '20 price alerts', '50 AI chats/day', 'US stock access', 'Advanced analytics', 'Email support'], missing: ['ML price predictions', 'Voice AI agent'] },
  { id: 'PRO', name: 'Pro', priceUSD: 49.99, priceJMD: 7800, badge: 'Most Popular', icon: 'fa-solid fa-star', color: '#00e676', description: 'Unlimited trading with AI predictions and voice assistant.', features: ['Unlimited trades', 'Unlimited watchlists', 'Unlimited alerts', 'Unlimited AI chat', 'US stock access', 'ML price predictions', 'Voice AI agent', 'Priority support'], missing: [] },
  { id: 'ENTERPRISE', name: 'Enterprise', priceUSD: null, priceJMD: null, badge: 'Custom', icon: 'fa-solid fa-building', color: '#ce93d8', description: 'Custom solutions for institutions and investment firms.', features: ['Everything in Pro', 'API access', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee', 'Team seats', 'White-label options'], missing: [] },
];

interface CatalogPlan { plan: string; priceUSD: number | null; priceJMD: number | null; }
type Plan = (typeof PLANS)[number];

const TIER_RANK: Record<string, number> = { FREE: 0, CORE: 1, PRO: 2, ENTERPRISE: 3 };

function UsageBar({ label, icon, used, limit }: { label: string; icon: string; used: number; limit: number | string }) {
  const isUnlimited = limit === 'Unlimited' || limit === Infinity;
  const pct = isUnlimited ? 0 : Math.min(100, (used / (limit as number)) * 100);
  const isNear = !isUnlimited && pct >= 80;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-muted)' }}>
          <i className={icon} style={{ fontSize: 10 }} />
          {label}
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: isNear ? '#ffd740' : 'var(--color-text)' }}>
          {isUnlimited ? '∞ Unlimited' : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: isNear ? '#ffd740' : '#00e676', transition: 'width .4s' }} />
        </div>
      )}
    </div>
  );
}

function PayPalButtonsInner({ planId, planName, priceUSD, onSuccess, onFallback, fallbackLoading }: { planId: string; planName: string; priceUSD: number; onSuccess: (msg: string) => void; onFallback: () => void; fallbackLoading: boolean }) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const [ppError, setPpError] = useState<string | null>(null);

  const createOrder = async (): Promise<string> => {
    setPpError(null);
    const r = await apiPost<CreateOrderResponse>('/api/payments/create-order', { amount: priceUSD, currency: 'USD', type: 'SUBSCRIPTION', plan: planId });
    return r.orderId;
  };
  const onApprove = async (data: { orderID: string }) => {
    const r = await apiPost<CaptureOrderResponse>('/api/payments/capture-order', { orderId: data.orderID });
    if (r.success) onSuccess(r.message || `Successfully upgraded to ${planName}!`);
    else setPpError('Payment capture failed. Please try again or contact support.');
  };

  if (isPending) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: 10, color: 'var(--color-muted)' }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 13 }}>Loading PayPal...</span>
    </div>
  );

  const fallbackBtn = (
    <button onClick={onFallback} disabled={fallbackLoading} style={{ width: '100%', padding: '11px', borderRadius: 12, background: '#00e676', color: '#04060d', fontSize: 13, fontWeight: 700, border: 'none', cursor: fallbackLoading ? 'not-allowed' : 'pointer', opacity: fallbackLoading ? .6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {fallbackLoading ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} /> Activating...</> : `Activate ${planName} Plan`}
    </button>
  );

  if (isRejected) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,215,64,.06)', border: '1px solid rgba(255,215,64,.2)', display: 'flex', gap: 10 }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 13, color: '#ffd740', flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text2)', lineHeight: 1.5 }}>PayPal could not load. You can activate the plan directly — payment processing will be configured shortly.</p>
      </div>
      {fallbackBtn}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PayPalButtons style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }} createOrder={createOrder} onApprove={onApprove} onError={() => setPpError('PayPal encountered an error. You can activate the plan directly below.')} onCancel={() => setPpError(null)} />
      {ppError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,82,82,.06)', border: '1px solid rgba(255,82,82,.2)', display: 'flex', gap: 10 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 12, color: '#ff5252', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text2)' }}>{ppError}</p>
          </div>
          {fallbackBtn}
        </div>
      )}
    </div>
  );
}

function UpgradeModal({ plan, paypalConfig, onClose, onSuccess }: { plan: Plan; paypalConfig: PayPalConfig; onClose: () => void; onSuccess: (msg: string) => void }) {
  const qc = useQueryClient();
  const fallbackMut = useMutation({
    mutationFn: (planId: string) => apiPost('/api/subscription/upgrade', { plan: planId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscription'] }); onSuccess(`${plan.name} plan activated! Payment processing will be enabled soon.`); },
  });

  const handleSuccess = (msg: string) => { qc.invalidateQueries({ queryKey: ['subscription'] }); onSuccess(msg); };
  const clientId = paypalConfig.clientId ?? 'sb';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, background: 'var(--color-bg2)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.8)', animation: 'fadeIn .22s ease' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-credit-card" style={{ fontSize: 14, color: '#00e676' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>Upgrade to {plan.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)' }}>${plan.priceUSD}/mo · ≈ JA${plan.priceJMD?.toLocaleString()}/mo</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-xmark" style={{ fontSize: 12, color: 'var(--color-muted)' }} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(0,230,118,.05)', border: '1px solid rgba(0,230,118,.15)' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>You are upgrading to:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {plan.features.slice(0, 4).map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text2)' }}>
                  <i className="fa-solid fa-check" style={{ fontSize: 9, color: '#00e676' }} /> {f}
                </div>
              ))}
              {plan.features.length > 4 && <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)', paddingLeft: 17 }}>+ {plan.features.length - 4} more features</p>}
            </div>
          </div>
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Complete your payment:</p>
            {paypalConfig.configured && paypalConfig.clientId ? (
              <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'capture' }}>
                <PayPalButtonsInner planId={plan.id} planName={plan.name} priceUSD={plan.priceUSD!} onSuccess={handleSuccess} onFallback={() => fallbackMut.mutate(plan.id)} fallbackLoading={fallbackMut.isPending} />
              </PayPalScriptProvider>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,215,64,.06)', border: '1px solid rgba(255,215,64,.2)', display: 'flex', gap: 10 }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 13, color: '#ffd740', flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text2)', lineHeight: 1.5 }}>Payment processing is being configured — activating directly for now. You will not be charged until billing is fully set up.</p>
                </div>
                <button onClick={() => fallbackMut.mutate(plan.id)} disabled={fallbackMut.isPending} style={{ width: '100%', padding: '12px', borderRadius: 12, background: '#00e676', color: '#04060d', fontSize: 14, fontWeight: 700, border: 'none', cursor: fallbackMut.isPending ? 'not-allowed' : 'pointer', opacity: fallbackMut.isPending ? .6 : 1 }}>
                  {fallbackMut.isPending ? 'Activating...' : `Activate ${plan.name} Plan`}
                </button>
              </div>
            )}
            {fallbackMut.isError && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#ff5252' }}>Failed to activate plan. Please try again or contact support.</p>}
          </div>
        </div>
        <div style={{ padding: '0 24px 20px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Secure payment · Cancel anytime · Questions? <a href="mailto:support@gothamfinancial.io" style={{ color: '#00e676' }}>support@gothamfinancial.io</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Subscription() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: sub, isLoading } = useQuery<SubscriptionData>({ queryKey: ['subscription'], queryFn: () => apiGet('/api/subscription'), enabled: !!user });
  const { data: ppConfig } = useQuery<PayPalConfig>({ queryKey: ['paypal-config'], queryFn: () => apiGet('/api/payments/config'), enabled: !!user, staleTime: 300_000 });
  const { data: catalog } = useQuery<{ plans: CatalogPlan[] }>({ queryKey: ['plans'], queryFn: () => apiGet('/api/subscription/plans'), staleTime: 600_000 });

  // Backend catalog is the source of truth for prices; merge it over the local fallback.
  const priceMap = new Map((catalog?.plans ?? []).map((p) => [p.plan, p]));
  const plans: Plan[] = PLANS.map((p) => {
    const live = priceMap.get(p.id);
    return live ? ({ ...p, priceUSD: live.priceUSD ?? p.priceUSD, priceJMD: live.priceJMD ?? p.priceJMD } as Plan) : p;
  });

  const currentPlan = sub?.plan || 'FREE';
  const currentRank = TIER_RANK[currentPlan] ?? 0;

  const defaultPpConfig: PayPalConfig = { clientId: null, mode: 'sandbox', configured: false };

  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <p style={{ color: 'var(--color-muted)' }}>Please sign in to manage your subscription.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>Subscription</h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Manage your plan and track your usage.</p>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px', background: 'rgba(0,230,118,.08)', border: '1px solid rgba(0,230,118,.25)', borderRadius: 14 }}>
          <i className="fa-solid fa-circle-check" style={{ fontSize: 14, color: '#00e676', flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, flex: 1, fontSize: 13, fontWeight: 600, color: '#00e676' }}>{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
            <i className="fa-solid fa-xmark" style={{ fontSize: 13 }} />
          </button>
        </div>
      )}

      {/* Current plan + usage */}
      {sub && !isLoading && (
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Current Plan</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>{currentPlan}</p>
              {sub.currentPeriodEnd && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>
                  Renews {new Date(sub.currentPeriodEnd).toLocaleDateString('en-JM', { dateStyle: 'long' })}
                </p>
              )}
            </div>
            <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: sub.status === 'ACTIVE' ? 'rgba(0,230,118,.1)' : 'rgba(255,215,64,.1)', color: sub.status === 'ACTIVE' ? '#00e676' : '#ffd740', border: `1px solid ${sub.status === 'ACTIVE' ? 'rgba(0,230,118,.25)' : 'rgba(255,215,64,.25)'}` }}>
              {sub.status}
            </span>
          </div>

          {/* Usage grid */}
          <div className="grid-usage-2">
            <UsageBar label="Trades this month" icon="fa-solid fa-chart-line" used={sub.usage.tradesThisMonth} limit={sub.limits.maxTrades as string} />
            <UsageBar label="AI chats today"    icon="fa-solid fa-robot"      used={sub.usage.aiChatsToday}    limit={sub.limits.aiChats as string} />
            <UsageBar label="Watchlists"         icon="fa-solid fa-eye"        used={sub.usage.watchlists}      limit={sub.limits.maxWatchlists as string} />
            <UsageBar label="Active alerts"      icon="fa-solid fa-bell"       used={sub.usage.activeAlerts}    limit={sub.limits.maxAlerts as string} />
          </div>
        </div>
      )}

      {isLoading && <div className="skeleton" style={{ height: 180, borderRadius: 18 }} />}

      {/* Plan cards */}
      <div>
        <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Available Plans</p>
        <div className="grid-plans-3">
          {plans.map(plan => {
            const isCurrent = currentPlan === plan.id;
            const isUpgrade = TIER_RANK[plan.id] > currentRank;
            const isPro = plan.id === 'PRO';
            return (
              <div key={plan.id} style={{
                position: 'relative', padding: '24px 22px', borderRadius: 18,
                background: isPro ? 'rgba(0,230,118,.04)' : 'var(--color-bg2)',
                border: `1px solid ${isCurrent ? 'rgba(0,230,118,.35)' : isPro ? 'rgba(0,230,118,.18)' : 'var(--color-border)'}`,
                display: 'flex', flexDirection: 'column', gap: 16,
                boxShadow: isPro ? '0 8px 32px rgba(0,230,118,.08)' : 'none',
              }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '3px 14px', borderRadius: 99, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', background: isPro ? '#00e676' : '#ce93d8', color: isPro ? '#04060d' : '#04060d', whiteSpace: 'nowrap' }}>
                    {plan.badge}
                  </div>
                )}

                {/* Plan header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${plan.color}18`, border: `1px solid ${plan.color}35` }}>
                      <i className={plan.icon} style={{ fontSize: 14, color: plan.color }} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>{plan.name}</p>
                      <p style={{ margin: 0, fontSize: 10.5, color: 'var(--color-muted)', lineHeight: 1.3 }}>{plan.description}</p>
                    </div>
                  </div>
                  {isCurrent && <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 99, fontSize: 9, fontWeight: 800, letterSpacing: '.06em', background: 'rgba(0,230,118,.12)', color: '#00e676', border: '1px solid rgba(0,230,118,.25)' }}>CURRENT</span>}
                </div>

                {/* Price */}
                <div>
                  {plan.priceUSD === null ? (
                    <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--color-text)' }}>Custom</p>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                        ${plan.priceUSD}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-muted)' }}>/mo</span>
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>≈ JA${plan.priceJMD?.toLocaleString()}/mo</p>
                    </>
                  )}
                </div>

                {/* Features */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text2)' }}>
                      <i className="fa-solid fa-check" style={{ fontSize: 9, color: '#00e676', flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                  {plan.missing.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-muted)', opacity: .45, textDecoration: 'line-through' }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', border: '1px solid var(--color-border)', flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {isCurrent ? (
                  <div style={{ padding: '10px', borderRadius: 12, border: '1px solid rgba(0,230,118,.3)', color: '#00e676', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                    ✓ Your current plan
                  </div>
                ) : plan.id === 'ENTERPRISE' ? (
                  <a href="mailto:sales@gothamfinancial.io" style={{ display: 'block', padding: '10px', borderRadius: 12, border: '1px solid rgba(206,147,216,.3)', color: '#ce93d8', fontSize: 12, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
                    Contact Sales →
                  </a>
                ) : isUpgrade ? (
                  <button onClick={() => setSelectedPlan(plan)} style={{
                    padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 180ms',
                    background: isPro ? '#00e676' : 'rgba(255,255,255,.07)',
                    color: isPro ? '#04060d' : 'var(--color-text)',
                    boxShadow: isPro ? '0 4px 20px rgba(0,230,118,.3)' : 'none',
                  }}
                    onMouseEnter={e => { if (isPro) (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(0,230,118,.45)'; }}
                    onMouseLeave={e => { if (isPro) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,230,118,.3)'; }}>
                    Upgrade to {plan.name} →
                  </button>
                ) : (
                  <div style={{ padding: '10px', borderRadius: 12, border: '1px solid var(--color-border)', color: 'var(--color-muted)', fontSize: 12, textAlign: 'center' }}>
                    Downgrade — contact support
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Honest note — Gotham is paper-trading + research, so there are no real commissions */}
      <div style={{ padding: '16px 20px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14 }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>No trading commissions</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          Gotham is a <strong style={{ color: 'var(--color-text)' }}>paper-trading and research platform</strong> — you practise with virtual funds at real live prices, with <strong style={{ color: 'var(--color-text)' }}>zero commissions and no hidden fees</strong>. Your plan covers AI usage, analytics, watchlists and alerts — nothing is charged per trade.
        </p>
      </div>

      {selectedPlan && (
        <UpgradeModal plan={selectedPlan} paypalConfig={ppConfig ?? defaultPpConfig} onClose={() => setSelectedPlan(null)} onSuccess={(msg) => { setSelectedPlan(null); setSuccessMsg(msg); qc.invalidateQueries({ queryKey: ['subscription'] }); }} />
      )}
    </div>
  );
}
