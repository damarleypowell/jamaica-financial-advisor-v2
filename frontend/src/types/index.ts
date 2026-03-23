/* ------------------------------------------------------------------ */
/*  Core domain types for Gotham Financial                            */
/* ------------------------------------------------------------------ */

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  dollarChange: number;
  pctChange: number;
  volume: number;
  currency: string;
  dataSource: string;
  sector?: string;
  marketCap?: number;
  pe?: number;
  divYield?: number;
  eps?: number;
  high52?: number;
  low52?: number;
}

export type SubscriptionTier = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
export type KycStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type AccountType = 'paper' | 'live';

export interface User {
  id: string;
  name: string;
  email: string;
  subscriptionTier: SubscriptionTier;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  kycStatus: KycStatus;
  accountType: AccountType;
  settings?: Record<string, any>;
}

export interface AuthResponse {
  token: string;
  user: User;
  requires2FA?: boolean;
  tempToken?: string;
}

export type Market = 'JSE' | 'US';

export interface PortfolioPosition {
  id: string;
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice?: number;
  marketValue?: number;
  pnl?: number;
  pnlPercent?: number;
  market: Market;
}

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
export type OrderStatus =
  | 'PENDING'
  | 'OPEN'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  limitPrice?: number;
  stopPrice?: number;
  status: OrderStatus;
  createdAt: string;
  filledAt?: string;
}

export type TransactionType = string;

export interface Transaction {
  id: string;
  type: TransactionType;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  total: number;
  fee: number;
  createdAt: string;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
}

export type AlertCondition = 'ABOVE' | 'BELOW';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: AlertCondition;
  triggered: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalDirection = 'BUY' | 'SELL' | 'NEUTRAL';

export interface Signal {
  name: string;
  signal: SignalDirection;
  value: number;
}

export interface TechnicalData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  candles: Candle[];
  indicators: Record<string, any>;
  signals: Signal[];
  fundamentals?: Record<string, any>;
}

export interface WalletBalance {
  jmd: number;
  jmdHeld: number;
  usd: number;
  usdHeld: number;
}

export interface Subscription {
  plan: SubscriptionTier;
  status: string;
  currentPeriodEnd?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  sentiment?: string;
}

export interface SectorData {
  name: string;
  change: number;
  volume: number;
  stocks: number;
}
