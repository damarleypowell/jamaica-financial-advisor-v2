import api from './client';
import type { AdminDashboard, User, KycSubmission } from '@/types';

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await api.get('/api/admin/dashboard');
  return data;
}

export async function getUsers(): Promise<User[]> {
  const { data } = await api.get('/api/admin/users');
  return data.users || data;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  const { data } = await api.put(`/api/admin/users/${id}`, updates);
  return data.user || data;
}

export async function getKycSubmissions(): Promise<KycSubmission[]> {
  const { data } = await api.get('/api/admin/kyc');
  return data.submissions || data;
}

export async function approveKyc(userId: string): Promise<{ success: boolean }> {
  const { data } = await api.post(`/api/admin/kyc/${userId}/approve`);
  return data;
}

export async function rejectKyc(userId: string, reason: string): Promise<{ success: boolean }> {
  const { data } = await api.post(`/api/admin/kyc/${userId}/reject`, { reason });
  return data;
}
