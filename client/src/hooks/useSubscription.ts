import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { SubscriptionPlan } from '@/types';

const TIER_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

export function useSubscription() {
  const { tier, isAuthenticated } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);
  const [requiredTier, setRequiredTier] = useState<SubscriptionPlan>('PRO');

  const hasTier = useCallback(
    (required: SubscriptionPlan) => TIER_RANK[tier] >= TIER_RANK[required],
    [tier]
  );

  const requireTier = useCallback(
    (required: SubscriptionPlan): boolean => {
      if (!isAuthenticated) return false;
      if (hasTier(required)) return true;
      setRequiredTier(required);
      setShowPaywall(true);
      return false;
    },
    [isAuthenticated, hasTier]
  );

  const closePaywall = useCallback(() => setShowPaywall(false), []);

  return {
    tier,
    hasTier,
    requireTier,
    showPaywall,
    requiredTier,
    closePaywall,
  };
}
