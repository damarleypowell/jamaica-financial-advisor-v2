import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.ts';
import type { SubscriptionTier } from '../../types/index.ts';

const TIER_LEVEL: Record<SubscriptionTier, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

interface ProtectedRouteProps {
  requiredTier?: SubscriptionTier;
  featureName?: string;
}

export default function ProtectedRoute({
  requiredTier = 'FREE',
  featureName,
}: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();

  const userTier: SubscriptionTier = user?.subscriptionTier ?? 'FREE';
  const hasAccess = TIER_LEVEL[userTier] >= TIER_LEVEL[requiredTier];

  // Not authenticated — render content but they'll see prompts on interaction
  if (!isAuthenticated || !user) {
    if (requiredTier !== 'FREE') {
      return (
        <div className="relative min-h-[60vh]">
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="glass-strong rounded-2xl p-8 max-w-md text-center">
              <div className="w-16 h-16 rounded-full bg-green/10 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-lock text-2xl text-green" />
              </div>
              <h2 className="text-xl font-bold text-text mb-2">
                {featureName ?? 'This Feature'} Requires {requiredTier}+
              </h2>
              <p className="text-muted text-sm mb-6">
                Sign in and upgrade your plan to access this feature.
              </p>
              <a
                href="/subscription"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green text-bg font-semibold rounded-lg hover:bg-green/90 transition-colors"
              >
                <i className="fa-solid fa-arrow-up" />
                View Plans
              </a>
            </div>
          </div>
          <div className="blur-sm pointer-events-none opacity-30">
            <Outlet />
          </div>
        </div>
      );
    }
    return <Outlet />;
  }

  // Authenticated but tier too low
  if (!hasAccess) {
    return (
      <div className="relative min-h-[60vh]">
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="glass-strong rounded-2xl p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-crown text-2xl text-gold" />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">
              Upgrade to {requiredTier}
            </h2>
            <p className="text-muted text-sm mb-2">
              {featureName ?? 'This feature'} requires a{' '}
              <span className="text-gold font-semibold">{requiredTier}</span>{' '}
              subscription or higher.
            </p>
            <p className="text-muted text-xs mb-6">
              You're currently on the{' '}
              <span className="text-text2 font-medium">{userTier}</span> plan.
            </p>
            <a
              href="/subscription"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green text-bg font-semibold rounded-lg hover:bg-green/90 transition-colors"
            >
              <i className="fa-solid fa-arrow-up" />
              Upgrade Now
            </a>
          </div>
        </div>
        <div className="blur-sm pointer-events-none opacity-30">
          <Outlet />
        </div>
      </div>
    );
  }

  // Has access
  return <Outlet />;
}
