import api from './client';
import type { USQuote, Order, Position } from '@/types';

export async function getUSQuote(symbol: string): Promise<USQuote> {
  const { data } = await api.get(`/api/us/quote/${symbol}`);
  return data;
}

export async function getUSBars(symbol: string, timeframe = '1Day', limit = 100): Promise<Record<string, unknown>> {
  const { data } = await api.get(`/api/us/bars/${symbol}`, { params: { timeframe, limit } });
  return data;
}

export async function searchUSStocks(query: string): Promise<{ symbol: string; name: string }[]> {
  const { data } = await api.get('/api/us/search', { params: { q: query } });
  return data.results || data;
}

export async function placeUSOrder(order: {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  limitPrice?: number;
  stopPrice?: number;
}): Promise<Order> {
  const { data } = await api.post('/api/us/orders', order);
  return data;
}

export async function getUSOrders(): Promise<Order[]> {
  const { data } = await api.get('/api/us/orders');
  return data.orders || data;
}

export async function cancelUSOrder(id: string): Promise<void> {
  await api.delete(`/api/us/orders/${id}`);
}

export async function getUSPositions(): Promise<Position[]> {
  const { data } = await api.get('/api/us/positions');
  return data.positions || data;
}

export async function closeUSPosition(symbol: string): Promise<void> {
  await api.delete(`/api/us/positions/${symbol}`);
}

export async function getBatchQuotes(symbols: string[]): Promise<Record<string, USQuote>> {
  const { data } = await api.post('/api/us/quotes', { symbols });
  return data;
}
