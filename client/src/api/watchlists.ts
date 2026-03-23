import api from './client';
import type { Watchlist } from '@/types';

export async function getWatchlists(): Promise<Watchlist[]> {
  const { data } = await api.get('/api/watchlists');
  return data.watchlists || data;
}

export async function createWatchlist(name: string): Promise<Watchlist> {
  const { data } = await api.post('/api/watchlists', { name });
  return data.watchlist || data;
}

export async function updateWatchlist(id: string, name: string): Promise<Watchlist> {
  const { data } = await api.put(`/api/watchlists/${id}`, { name });
  return data.watchlist || data;
}

export async function deleteWatchlist(id: string): Promise<void> {
  await api.delete(`/api/watchlists/${id}`);
}

export async function addSymbol(id: string, symbol: string): Promise<Watchlist> {
  const { data } = await api.post(`/api/watchlists/${id}/symbols`, { symbol });
  return data.watchlist || data;
}

export async function removeSymbol(id: string, symbol: string): Promise<Watchlist> {
  const { data } = await api.delete(`/api/watchlists/${id}/symbols`, { data: { symbol } });
  return data.watchlist || data;
}
