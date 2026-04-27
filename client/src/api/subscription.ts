import api from './client';
import type { Subscription } from '@/types';

export async function getSubscription(): Promise<Subscription> {
  const { data } = await api.get('/api/subscription');
  return data.subscription || data;
}

export async function getPlans(): Promise<Record<string, unknown>[]> {
  const { data } = await api.get('/api/subscription/plans');
  return data.plans || data;
}

export async function subscribe(plan: string): Promise<{ url?: string; subscription?: Subscription }> {
  const { data } = await api.post('/api/subscription/upgrade', { plan });
  return data;
}

export async function cancelSubscription(): Promise<{ success: boolean }> {
  const { data } = await api.delete('/api/subscription');
  return data;
}
