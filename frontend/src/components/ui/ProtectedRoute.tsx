import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.ts';
import { useUIStore } from '../../stores/ui.ts';
import type { SubscriptionTier } from '../../types/index.ts';

const TIER_LEVEL: Record<SubscriptionTier, number> = {
  FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3,
};

const TIER_COLOR: Record<string, string> = {
  BASIC: '#40c4ff',
  PRO: '#00e676',
  ENTERPRISE: '#ce93d8',
};

const TIER_FEATURES: Record<string, string[]> = {
  BASIC: ['50 trades/month', '5 watchlists', '20 price alerts', 'US stock access', 'Advanced analytics'],
  PRO: ['Unlimited trades', 'Unlimited alerts', 'ML price predictions', 'Voice AI agent', 'Priority support'],
  ENTERPRISE: ['Everything in Pro', 'API access', 'Dedicated support', 'Custom integrations'],
};

interface ProtectedRouteProps {
  requiredTier?: SubscriptionTier;
  featureName?: string;
}

function UpgradeWall({ requiredTier, featureName, userTier, signedIn }: {
  requiredTier: string;
  featureName?: string;
  userTier?: string;
  signedIn: boolean;
}) {
  const color = TIER_COLOR[requiredTier] ?? '#00e676';
  const features = TIER_FEATURES[requiredTier] ?? [];
  const openAuthModal = useUIStore(s => s.openAuthModal);

  return (
    <div className="relative min-h-[60vh]">
      {/* Blurred page content behind */}
      <div className="blur-sm pointer-events-none opacity-25 select-none"><Outlet /></div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
        <div style={{
          background: 'var(--color-bg2, #0d1117)',
          border: `1px solid ${color}30`,
          borderRadius: 24,
          padding: '36px 32px',
          maxWidth: 420,
          width: '100%',
          boxShadow: `0 0 0 1px ${color}18, 0 32px 80px rgba(0,0,0,.7), 0 0 60px ${color}10`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}>

          {/* Icon glow */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `${color}15`,
            border: `1.5px solid ${color}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
            boxShadow: `0 0 24px ${color}25`,
          }}>
            <i className="fa-solid fa-crown" style={{ fontSize: 22, color }} />
          </div>

          {/* Tier badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 99,
            background: `${color}12`, border: `1px solid ${color}30`,
            fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
            color, marginBottom: 12, textTransform: 'uppercase',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 6px ${color}` }} />
            {requiredTier} Plan
          </div>

          {/* Headline */}
          <h2 style={{
            margin: '0 0 8px', fontSize: 22, fontWeight: 900,
            color: 'var(--color-text, #fff)', textAlign: 'center', letterSpacing: '-0.02em',
          }}>
            {featureName ?? 'This feature'} is a {requiredTier}+ feature
          </h2>

          {/* Subtext */}
          <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--color-muted, #6b7280)', textAlign: 'center', lineHeight: 1.6 }}>
            {signedIn
              ? <>You're on the <strong style={{ color: 'var(--color-text2, #9ca3af)', fontWeight: 700 }}>{userTier}</strong> plan. Upgrade to unlock this and more.</>
              : 'Sign in and upgrade your plan to access this feature.'}
          </p>

          {/* Feature list */}
          {features.length > 0 && (
            <div style={{
              width: '100%', padding: '16px 18px',
              background: `${color}08`, border: `1px solid ${color}18`,
              borderRadius: 14, marginBottom: 24,
              display: 'flex', flexDirection: 'column', gap: 9,
            }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: 'var(--color-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                Unlocks with {requiredTier}
              </p>
              {features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text2, #9ca3af)' }}>
                  <i className="fa-solid fa-check" style={{ fontSize: 9, color, flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          {signedIn ? (
            <a
              href="/subscription"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '13px 0', borderRadius: 13,
                background: color, color: '#04060d',
                fontSize: 14, fontWeight: 800, textDecoration: 'none',
                boxShadow: `0 4px 24px ${color}40`,
                transition: 'box-shadow 180ms, transform 180ms',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 6px 32px ${color}60`;
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 4px 24px ${color}40`;
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
              }}
            >
              <i className="fa-solid fa-arrow-up" style={{ fontSize: 12 }} />
              Upgrade to {requiredTier}
            </a>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => openAuthModal('signup')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '13px 0', borderRadius: 13,
                  background: color, color: '#04060d',
                  fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer',
                  boxShadow: `0 4px 24px ${color}40`,
                  transition: 'box-shadow 180ms, transform 180ms',
                }}
              >
                <i className="fa-solid fa-user" style={{ fontSize: 12 }} />
                Create Free Account
              </button>
              <button
                onClick={() => openAuthModal('login')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '11px 0', borderRadius: 13,
                  background: 'transparent', color: 'rgba(255,255,255,.45)',
                  fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,.1)', cursor: 'pointer',
                }}
              >
                Already have an account? Sign In
              </button>
            </div>
          )}

          <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--color-muted, #6b7280)' }}>
            {signedIn ? 'Cancel anytime · Secure payment' : 'Free to sign up · Upgrade anytime'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ requiredTier = 'FREE', featureName }: ProtectedRouteProps) {
  const user = useAuthStore(s => s.user);
  const isAuthenticated = !!user;
  const userTier: SubscriptionTier = user?.subscriptionTier ?? 'FREE';
  const hasAccess = TIER_LEVEL[userTier] >= TIER_LEVEL[requiredTier];

  if (!isAuthenticated && requiredTier !== 'FREE') {
    return <UpgradeWall requiredTier={requiredTier} featureName={featureName} signedIn={false} />;
  }

  if (isAuthenticated && !hasAccess) {
    return <UpgradeWall requiredTier={requiredTier} featureName={featureName} userTier={userTier} signedIn={true} />;
  }

  return <Outlet />;
}
