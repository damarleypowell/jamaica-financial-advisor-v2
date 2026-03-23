import api from './client';
import type { PriceAlert, Notification, CreateAlertRequest } from '@/types';

export async function getAlerts(): Promise<PriceAlert[]> {
  const { data } = await api.get('/api/alerts');
  return data.alerts || data;
}

export async function createAlert(alert: CreateAlertRequest): Promise<PriceAlert> {
  const { data } = await api.post('/api/alerts', alert);
  return data.alert || data;
}

export async function deleteAlert(id: string): Promise<void> {
  await api.delete(`/api/alerts/${id}`);
}

export async function getNotifications(): Promise<Notification[]> {
  const { data } = await api.get('/api/notifications');
  return data.notifications || data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.put(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.put('/api/notifications/read-all');
}
