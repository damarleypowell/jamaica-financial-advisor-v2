import api from './client';
import type { AuthResponse, User } from '@/types';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post('/api/auth/login', { email, password });
  return data;
}

export async function signup(username: string, email: string, password: string, fullName?: string): Promise<AuthResponse> {
  const { data } = await api.post('/api/auth/signup', { username, email, password, fullName });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get('/api/auth/me');
  return data.user || data;
}

export async function verify2FA(code: string, tempToken: string): Promise<AuthResponse> {
  const { data } = await api.post('/api/auth/verify-2fa', { code, tempToken });
  return data;
}

export async function setup2FA(): Promise<{ qrCode: string; secret: string }> {
  const { data } = await api.post('/api/auth/2fa/setup');
  return data;
}

export async function enable2FA(code: string): Promise<{ success: boolean }> {
  const { data } = await api.post('/api/auth/2fa/enable', { code });
  return data;
}

export async function disable2FA(code: string): Promise<{ success: boolean }> {
  const { data } = await api.post('/api/auth/2fa/disable', { code });
  return data;
}

export async function resetPassword(email: string): Promise<{ message: string }> {
  const { data } = await api.post('/api/auth/reset-password', { email });
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const { data } = await api.post('/api/auth/change-password', { currentPassword, newPassword });
  return data;
}

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  const { data } = await api.post('/api/auth/refresh', { refreshToken });
  return data;
}

export async function logoutAll(): Promise<{ message: string }> {
  const { data } = await api.post('/api/auth/logout-all');
  return data;
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const { data } = await api.post('/api/auth/verify-email', { token });
  return data;
}
