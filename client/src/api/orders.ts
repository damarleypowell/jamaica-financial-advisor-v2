import api from './client';
import type { Order, Position, Transaction, Wallet, PlaceOrderRequest } from '@/types';

export async function placeOrder(order: PlaceOrderRequest): Promise<Order> {
  const { data } = await api.post('/api/orders', order);
  return data.order || data;
}

export async function getOrders(): Promise<Order[]> {
  const { data } = await api.get('/api/orders');
  return data.orders || data;
}

export async function getOrder(id: string): Promise<Order> {
  const { data } = await api.get(`/api/orders/${id}`);
  return data.order || data;
}

export async function cancelOrder(id: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/api/orders/${id}`);
  return data;
}

export async function getPositions(): Promise<Position[]> {
  const { data } = await api.get('/api/portfolio/positions');
  return data.positions || data;
}

export async function getTransactionHistory(): Promise<Transaction[]> {
  const { data } = await api.get('/api/portfolio/history');
  return data.transactions || data;
}

export async function getWalletBalance(): Promise<Wallet[]> {
  const { data } = await api.get('/api/wallet/balance');
  return data.wallets || data;
}

export async function deposit(amount: number, currency: string = 'JMD'): Promise<Wallet> {
  const { data } = await api.post('/api/wallet/deposit', { amount, currency });
  return data;
}

export async function withdraw(amount: number, currency: string = 'JMD'): Promise<Wallet> {
  const { data } = await api.post('/api/wallet/withdraw', { amount, currency });
  return data;
}
