/* ------------------------------------------------------------------ */
/*  Shared utility functions for Gotham Financial                     */
/* ------------------------------------------------------------------ */

/**
 * Format a number as currency.
 * Defaults to JMD; pass `'USD'` for US dollars.
 */
export function formatCurrency(
  n: number,
  currency: 'JMD' | 'USD' = 'JMD',
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Format a number as a percentage with a leading +/- sign.
 */
export function formatPercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

/**
 * Format a volume number into a short human-readable string.
 * e.g. 1200 → "1.2K", 3400000 → "3.4M"
 */
export function formatVolume(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Format a market cap value.
 * e.g. 1_200_000_000 → "$1.2B"
 */
export function formatMarketCap(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

/**
 * Tiny className utility — filters out falsy values and joins with a space.
 *
 * Usage: `cn('base', isActive && 'active', undefined, 'extra')`
 */
export function cn(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Return a Tailwind-style text colour token based on the sign of the change.
 */
export function getChangeColor(
  change: number,
): 'text-green' | 'text-red' | 'text-muted' {
  if (change > 0) return 'text-green';
  if (change < 0) return 'text-red';
  return 'text-muted';
}

const TIER_LEVELS: Record<string, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

/**
 * Map a subscription tier name to a numeric level for comparison.
 */
export function tierLevel(tier: string): number {
  return TIER_LEVELS[tier.toUpperCase()] ?? 0;
}

/**
 * Check whether a user's tier meets or exceeds the required tier.
 */
export function canAccessFeature(
  userTier: string,
  requiredTier: string,
): boolean {
  return tierLevel(userTier) >= tierLevel(requiredTier);
}
