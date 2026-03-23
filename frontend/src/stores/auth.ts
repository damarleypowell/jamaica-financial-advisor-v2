import { create } from 'zustand';
import { apiGet, apiPost } from '../lib/api';
import type { AuthResponse, User, AccountType } from '../types';

const TOKEN_KEY = 'jse_token';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (
    name: string,
    email: string,
    password: string,
    accountType: AccountType,
  ) => Promise<AuthResponse>;
  verify2FA: (code: string, tempToken: string) => Promise<AuthResponse>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setUser: (user: User) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  /* ---- initial state ---- */
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  isLoading: false,

  /* ---- actions ---- */
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await apiPost<AuthResponse>('/api/auth/login', {
        email,
        password,
      });

      if (res.requires2FA) {
        set({ isLoading: false });
        return res;
      }

      localStorage.setItem(TOKEN_KEY, res.token);
      set({
        token: res.token,
        user: res.user,
        isAuthenticated: true,
        isLoading: false,
      });

      return res;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  signup: async (name, email, password, accountType) => {
    set({ isLoading: true });
    try {
      const res = await apiPost<AuthResponse>('/api/auth/register', {
        name,
        email,
        password,
        accountType,
      });

      localStorage.setItem(TOKEN_KEY, res.token);
      set({
        token: res.token,
        user: res.user,
        isAuthenticated: true,
        isLoading: false,
      });

      return res;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  verify2FA: async (code, tempToken) => {
    set({ isLoading: true });
    try {
      const res = await apiPost<AuthResponse>('/api/auth/verify-2fa', {
        code,
        tempToken,
      });

      localStorage.setItem(TOKEN_KEY, res.token);
      set({
        token: res.token,
        user: res.user,
        isAuthenticated: true,
        isLoading: false,
      });

      return res;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  loadUser: async () => {
    const { token } = get();
    if (!token) return;

    set({ isLoading: true });
    try {
      const user = await apiGet<User>('/api/auth/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Token expired or invalid — clear everything
      localStorage.removeItem(TOKEN_KEY);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setUser: (user) => set({ user }),
}));
