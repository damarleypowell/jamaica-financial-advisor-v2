import { create } from 'zustand';
import { apiGet, apiPost } from '../lib/api';
import type { User, AccountType } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

interface AuthActions {
  loadUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<any>;
  signup: (name: string, email: string, password: string, accountType: AccountType) => Promise<any>;
  verify2FA: (code: string, tempToken: string) => Promise<any>;
  loginWithGoogle: (credential: string) => Promise<any>;
  loginWithApple: (idToken: string, appleUser?: { name?: { firstName?: string; lastName?: string } }) => Promise<any>;
  setUser: (user: User) => void;
  logout: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  token: null,

  loadUser: async () => {
    const token = localStorage.getItem('jse_token');
    if (!token) return;
    try {
      const user = await apiGet<User>('/api/auth/me');
      set({ user, isAuthenticated: true, token });
    } catch {
      localStorage.removeItem('jse_token');
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await apiPost<{ token?: string; tempToken?: string; requires2FA?: boolean; user?: User }>('/api/auth/login', { email, password });
      if (res.requires2FA) { set({ isLoading: false }); return res; }
      if (res.token) {
        localStorage.setItem('jse_token', res.token);
        const user = await apiGet<User>('/api/auth/me');
        set({ user, isAuthenticated: true, isLoading: false, token: res.token });
      }
      return res;
    } catch (e) { set({ isLoading: false }); throw e; }
  },

  signup: async (name: string, email: string, password: string, accountType: AccountType) => {
    set({ isLoading: true });
    try {
      const res = await apiPost<{ token?: string; user?: User }>('/api/auth/signup', { name, email, password, accountType });
      if (res.token) {
        localStorage.setItem('jse_token', res.token);
        const user = await apiGet<User>('/api/auth/me');
        set({ user, isAuthenticated: true, isLoading: false, token: res.token });
      }
      return res;
    } catch (e) { set({ isLoading: false }); throw e; }
  },

  verify2FA: async (code: string, tempToken: string) => {
    const res = await apiPost<{ token: string }>('/api/auth/verify-2fa', { code, tempToken });
    if (res.token) {
      localStorage.setItem('jse_token', res.token);
      const user = await apiGet<User>('/api/auth/me');
      set({ user, isAuthenticated: true, token: res.token });
    }
    return res;
  },

  loginWithGoogle: async (credential: string) => {
    const res = await apiPost<{ token: string; user: User }>('/api/auth/google', { credential });
    if (res.token) {
      localStorage.setItem('jse_token', res.token);
      set({ user: res.user, isAuthenticated: true, token: res.token });
    }
    return res;
  },

  loginWithApple: async (idToken: string, appleUser?: { name?: { firstName?: string; lastName?: string } }) => {
    const res = await apiPost<{ token: string; user: User }>('/api/auth/apple', { id_token: idToken, user: appleUser });
    if (res.token) {
      localStorage.setItem('jse_token', res.token);
      set({ user: res.user, isAuthenticated: true, token: res.token });
    }
    return res;
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('jse_token');
    set({ user: null, isAuthenticated: false, isLoading: false, token: null });
  },
}));
