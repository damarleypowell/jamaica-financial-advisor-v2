// ═══════════════════════════════════════════════════════════════════════════════
// ── Gotham Financial — TypeScript Interfaces ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ── Enums ────────────────────────────────────────────────────────────────────

export type KycStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
export type OrderStatus = 'PENDING' | 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED';
export type TransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE' | 'DIVIDEND' | 'INTEREST';
export type GoalStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type AlertCondition = 'ABOVE' | 'BELOW' | 'PERCENT_CHANGE_ABOVE' | 'PERCENT_CHANGE_BELOW';
export type SubscriptionPlan = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING';
export type PaymentType = 'DEPOSIT' | 'WITHDRAWAL' | 'SUBSCRIPTION' | 'REFUND';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

// ── Core Models ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  kycStatus: KycStatus;
  riskProfile?: string;
  settings: Record<string, unknown>;
  twoFactorEnabled: boolean;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  subscription?: Subscription;
}

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  previousClose?: number;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  week52High?: number;
  week52Low?: number;
  sector?: string;
  currency?: string;
  lastUpdated?: string;
}

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  market: string;
  side: OrderSide;
  orderType: OrderType;
  status: OrderStatus;
  quantity: number;
  filledQty: number;
  limitPrice?: number;
  stopPrice?: number;
  avgFillPrice?: number;
  isPaper: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: 'buy' | 'sell' | 'BUY' | 'SELL';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
}

export interface Position {
  id: string;
  userId: string;
  symbol: string;
  market: string;
  shares: number;
  avgCost: number;
  currency: string;
  isPaper: boolean;
  openedAt: string;
  updatedAt: string;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
}

export interface Transaction {
  id: string;
  userId: string;
  orderId?: string;
  type: TransactionType;
  symbol?: string;
  market?: string;
  shares?: number;
  price?: number;
  totalAmount: number;
  feeAmount: number;
  currency: string;
  isPaper: boolean;
  createdAt: string;
}

export interface Wallet {
  currency: string;
  balance: number;
  heldBalance: number;
  available: number;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  symbols: string[];
  createdAt: string;
}

export interface PriceAlert {
  id: string;
  userId: string;
  symbol: string;
  condition: AlertCondition;
  targetValue: number;
  isTriggered: boolean;
  createdAt: string;
}

export interface CreateAlertRequest {
  symbol: string;
  condition: AlertCondition;
  targetValue: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd?: string;
  createdAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  category?: string;
  status: GoalStatus;
  createdAt: string;
}

export interface Sector {
  name: string;
  change: number;
  changePercent: number;
  stockCount: number;
  totalVolume: number;
  marketCap: number;
}

export interface NewsItem {
  title: string;
  description?: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  symbols?: string[];
  imageUrl?: string;
}

export interface DividendInfo {
  symbol: string;
  name?: string;
  exDate: string;
  payDate?: string;
  amount: number;
  yield?: number;
  currency?: string;
}

export interface MarketOverview {
  totalStocks: number;
  totalMarketCap: number;
  totalVolume: number;
  gainers: Stock[];
  losers: Stock[];
  mostActive: Stock[];
  advancers: number;
  decliners: number;
  unchanged: number;
}

export interface TechnicalIndicators {
  rsi?: number;
  macd?: { macd: number; signal: number; histogram: number };
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema12?: number;
  ema26?: number;
  bollingerBands?: { upper: number; middle: number; lower: number };
  stochastic?: { k: number; d: number };
  adx?: number;
  cci?: number;
  williamsR?: number;
  obv?: number;
  vwap?: number;
  atr?: number;
  fibonacci?: { levels: number[] };
  ichimoku?: { tenkan: number; kijun: number; senkouA: number; senkouB: number };
}

export interface PortfolioMetrics {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  maxDrawdown?: number;
  beta?: number;
  alpha?: number;
  volatility?: number;
}

export interface BacktestRequest {
  symbol: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  params?: Record<string, number>;
}

export interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  trades: number;
  equity: { date: string; value: number }[];
}

export interface USQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  marketCap?: number;
}

export interface ForexRate {
  pair: string;
  rate: number;
  change: number;
  changePercent: number;
}

export interface CurrencyImpact {
  usdJmdRate: number;
  change: number;
  changePercent: number;
  holdings: { symbol: string; impact: number; impactPercent: number }[];
}

export interface AdminDashboard {
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  pendingKyc: number;
  revenue: number;
  recentSignups: User[];
}

export interface KycSubmission {
  id: string;
  userId: string;
  user?: User;
  status: KycStatus;
  documents?: string[];
  submittedAt: string;
}

// ── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: { field: string; message: string }[];
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: User;
  requires2FA?: boolean;
  tempToken?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Subscription Tiers ───────────────────────────────────────────────────────

export interface TierConfig {
  name: string;
  plan: SubscriptionPlan;
  price: string;
  priceUSD: string;
  priceAmount: number;
  priceAmountUSD: number;
  currency: string;
  features: string[];
  highlighted?: boolean;
  contactSales?: boolean;
}

// ── Finnhub OHLCV Bar ──────────────────────────────────────────────────────

export interface HistoryBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockHistoryResponse {
  symbol: string;
  candles: HistoryBar[];
  noData?: boolean;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  logo: string | null;
  industry: string | null;
  exchange: string | null;
  marketCap: number | null;
  ipo: string | null;
  weburl: string | null;
  fundamentals: {
    pe: number | null;
    pb: number | null;
    eps: number | null;
    dividendYield: number | null;
    revenue: number | null;
    roe: number | null;
    beta: number | null;
    week52High: number | null;
    week52Low: number | null;
  };
}
