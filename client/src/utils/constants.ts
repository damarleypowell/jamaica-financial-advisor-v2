// ═══════════════════════════════════════════════════════════════════════════════
// ── Constants ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

import type { TierConfig } from '@/types';

// ── Navigation ───────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  section: string;
  minTier?: 'FREE' | 'PRO' | 'ENTERPRISE';
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  // Markets
  { label: 'Dashboard', path: '/', icon: 'fa-chart-line', section: 'Markets' },
  { label: 'Sectors', path: '/sectors', icon: 'fa-layer-group', section: 'Markets' },
  { label: 'News', path: '/news', icon: 'fa-newspaper', section: 'Markets' },
  { label: 'Leaderboard', path: '/leaderboard', icon: 'fa-trophy', section: 'Markets' },
  { label: 'Dividends', path: '/dividends', icon: 'fa-coins', section: 'Markets' },
  { label: 'Currency Impact', path: '/currency-impact', icon: 'fa-exchange-alt', section: 'Markets' },

  // Trading
  { label: 'Portfolio', path: '/portfolio', icon: 'fa-briefcase', section: 'Trading' },
  { label: 'Orders', path: '/orders', icon: 'fa-receipt', section: 'Trading' },
  { label: 'Watchlists', path: '/watchlists', icon: 'fa-eye', section: 'Trading' },
  { label: 'Alerts', path: '/alerts', icon: 'fa-bell', section: 'Trading' },
  { label: 'US Stocks', path: '/us-stocks', icon: 'fa-flag-usa', section: 'Trading', minTier: 'PRO' },

  // Research
  { label: 'Technical Analysis', path: '/technicals', icon: 'fa-chart-bar', section: 'Research', minTier: 'PRO' },
  { label: 'Screener', path: '/screener', icon: 'fa-filter', section: 'Research', minTier: 'PRO' },
  { label: 'Analytics', path: '/analytics', icon: 'fa-chart-pie', section: 'Research', minTier: 'PRO' },

  // AI & Tools
  { label: 'AI Chat', path: '/ai-chat', icon: 'fa-robot', section: 'AI & Tools', minTier: 'PRO' },

  // Account
  { label: 'Settings', path: '/settings', icon: 'fa-cog', section: 'Account' },
  { label: 'Subscription', path: '/subscription', icon: 'fa-crown', section: 'Account' },
  { label: 'Admin', path: '/admin', icon: 'fa-shield-alt', section: 'Account', adminOnly: true },
];

// ── Subscription Tiers ───────────────────────────────────────────────────────

export const TIER_CONFIGS: TierConfig[] = [
  {
    name: 'Free',
    plan: 'FREE',
    price: 'Free',
    priceUSD: 'Free',
    priceAmount: 0,
    priceAmountUSD: 0,
    currency: 'JMD',
    features: [
      'Basic dashboard & market overview',
      'Real-time JSE stock prices',
      'Market news & sentiment',
      'Basic watchlists (up to 2)',
      'Paper trading',
    ],
  },
  {
    name: 'Basic',
    plan: 'BASIC',
    price: 'J$3,100/mo',
    priceUSD: '$19.99/mo',
    priceAmount: 3100,
    priceAmountUSD: 19.99,
    currency: 'JMD',
    features: [
      'Everything in Free',
      'Advanced charting & technical indicators',
      'AI-powered stock analysis (50 chats/day)',
      'Stock screener with custom filters',
      'Up to 5 watchlists & 20 price alerts',
      'Portfolio analytics (Sharpe, Sortino, drawdown)',
      'US stock trading (via Alpaca)',
      'Financial calculators',
      '1% JSE / 0.5% US trade service charge',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    plan: 'PRO',
    price: 'J$15,500/mo',
    priceUSD: '$99.99/mo',
    priceAmount: 15500,
    priceAmountUSD: 99.99,
    currency: 'JMD',
    highlighted: true,
    features: [
      'Everything in Basic',
      'Unlimited AI chat & analysis',
      'ML price predictions (30-day forecasts)',
      'Voice agent (speech-to-text + TTS)',
      'Backtesting engine',
      'Unlimited watchlists & alerts',
      'Monte Carlo & VaR/CVaR risk engine',
      'Portfolio optimization (Markowitz)',
      '1% JSE / 0.5% US trade service charge',
      'Priority support',
    ],
  },
  {
    name: 'Institutional',
    plan: 'ENTERPRISE',
    price: 'Contact Sales',
    priceUSD: 'Contact Sales',
    priceAmount: 0,
    priceAmountUSD: 0,
    currency: 'JMD',
    contactSales: true,
    features: [
      'Everything in Pro',
      'API access for automated trading',
      'Bulk data exports (CSV/JSON)',
      'Multi-user team accounts',
      'Custom alert workflows',
      'Dedicated account manager',
      'Custom trade service charge',
      'SLA-backed uptime guarantee',
    ],
  },
];

// ── Sector Colors ────────────────────────────────────────────────────────────

export const SECTOR_COLORS: Record<string, string> = {
  'Financial': '#00c853',
  'Manufacturing': '#00b0ff',
  'Conglomerate': '#ffd600',
  'Insurance': '#bb86fc',
  'Retail': '#ff1744',
  'Energy': '#ff9100',
  'Real Estate': '#00e5ff',
  'Technology': '#651fff',
  'Telecommunications': '#76ff03',
  'Tourism': '#f50057',
  'Mining': '#795548',
  'Distribution': '#607d8b',
  'Other': '#9e9e9e',
};

// ── Chart Colors ─────────────────────────────────────────────────────────────

export const CHART_COLORS = [
  '#00c853', '#00b0ff', '#ffd600', '#bb86fc', '#ff1744',
  '#ff9100', '#00e5ff', '#651fff', '#76ff03', '#f50057',
  '#795548', '#607d8b',
];

// ── Design Tokens ────────────────────────────────────────────────────────────

export const COLORS = {
  bg: '#060810',
  bg2: '#0c1017',
  bg3: '#111822',
  green: '#00c853',
  gold: '#ffd600',
  red: '#ff1744',
  blue: '#00b0ff',
  purple: '#bb86fc',
  jamaicaGreen: '#007a3d',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBorder: 'rgba(255,255,255,0.06)',
};

// ── Market Status ────────────────────────────────────────────────────────────

export function getMarketStatus(): { status: string; color: string } {
  const now = new Date();
  const hours = now.getUTCHours() - 5; // EST = UTC-5
  const day = now.getDay();
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && hours >= 10 && hours < 14; // JSE: 10am-2pm EST (approx)

  if (!isWeekday) return { status: 'Closed (Weekend)', color: 'text-gray-400' };
  if (isOpen) return { status: 'Market Open', color: 'text-green-400' };
  if (isWeekday && hours >= 9 && hours < 10) return { status: 'Pre-Market', color: 'text-yellow-400' };
  return { status: 'Market Closed', color: 'text-red-400' };
}
