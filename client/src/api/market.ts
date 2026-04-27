import api from './client';
import type { Stock, MarketOverview, Sector, NewsItem, DividendInfo, ForexRate, CurrencyImpact, TechnicalIndicators } from '@/types';

export async function getStocks(): Promise<Stock[]> {
  const { data } = await api.get('/api/stocks');
  return data.stocks || data;
}

export async function getStock(symbol: string): Promise<Stock> {
  const { data } = await api.get(`/api/stocks/${symbol}`);
  return data.stock || data;
}

export async function getMarketOverview(): Promise<MarketOverview> {
  const { data } = await api.get('/api/market-overview');
  return data;
}

export async function getSectors(): Promise<Sector[]> {
  const { data } = await api.get('/api/sectors');
  return data.sectors || data;
}

export async function getNews(): Promise<NewsItem[]> {
  const { data } = await api.get('/api/news');
  return data.news || data;
}

export async function getForex(): Promise<ForexRate[]> {
  const { data } = await api.get('/api/forex');
  return data.rates || data;
}

export async function getDividends(): Promise<DividendInfo[]> {
  const { data } = await api.get('/api/dividends');
  return data.dividends || data;
}

export async function getCurrencyImpact(): Promise<CurrencyImpact> {
  const { data } = await api.get('/api/currency-impact');
  return data;
}

export async function getLeaderboard(): Promise<{ gainers: Stock[]; losers: Stock[] }> {
  const { data } = await api.get('/api/leaderboard');
  return data;
}

export async function getTechnicals(symbol: string): Promise<TechnicalIndicators> {
  const { data } = await api.get(`/api/analytics/technical/${symbol}`);
  return data.indicators || data;
}

export async function screener(filters: Record<string, unknown>): Promise<Stock[]> {
  const { data } = await api.post('/api/screener', filters);
  return data.results || data;
}

export async function getResearch(symbol: string): Promise<Record<string, unknown>> {
  const { data } = await api.get(`/api/research/${symbol}`);
  return data;
}

export async function getGlobalMarkets(): Promise<Record<string, unknown>> {
  const { data } = await api.get('/api/global-markets');
  return data;
}

// ── Finnhub-powered endpoints ───────────────────────────────────────────────

export async function getStockHistory(
  symbol: string,
  resolution = 'D',
  from?: number,
  to?: number
): Promise<import('@/types').StockHistoryResponse> {
  const params: Record<string, string> = { resolution };
  if (from) params.from = String(from);
  if (to) params.to = String(to);
  const { data } = await api.get(`/api/stocks/${symbol}/history`, { params });
  return data;
}

export async function getCompanyProfile(symbol: string): Promise<import('@/types').CompanyProfile> {
  const { data } = await api.get(`/api/stocks/${symbol}/profile`);
  return data;
}

export async function searchSymbols(query: string): Promise<{ symbol: string; description: string }[]> {
  const { data } = await api.get('/api/search', { params: { q: query } });
  return data;
}
