import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getMe, login as apiLogin, signup as apiSignup, verify2FA as apiVerify2FA } from '@/api/auth';
import type { User, SubscriptionPlan } from '@/types';
import toast from 'react-hot-toast';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tier: SubscriptionPlan;
  tempToken: string | null;
  needs2FA: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string, fullName?: string) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasTier: (requiredTier: SubscriptionPlan) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TIER_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('jse_token'),
    isAuthenticated: false,
    isLoading: true,
    tier: 'FREE',
    tempToken: null,
    needs2FA: false,
  });

  const setUser = useCallback((user: User | null, token?: string) => {
    const plan = user?.subscription?.plan || 'FREE';
    setState((s) => ({
      ...s,
      user,
      token: token ?? s.token,
      isAuthenticated: !!user,
      isLoading: false,
      tier: plan,
      needs2FA: false,
      tempToken: null,
    }));
  }, []);

  // Load user on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem('jse_token');
    if (token) {
      getMe()
        .then((user) => setUser(user, token))
        .catch(() => {
          localStorage.removeItem('jse_token');
          setState((s) => ({ ...s, isLoading: false, token: null }));
        });
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [setUser]);

  // Listen for auth:logout event from axios interceptor
  useEffect(() => {
    const handleLogout = () => {
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        tier: 'FREE',
        tempToken: null,
        needs2FA: false,
      });
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);

    if (res.requires2FA && res.tempToken) {
      setState((s) => ({ ...s, needs2FA: true, tempToken: res.tempToken! }));
      return;
    }

    localStorage.setItem('jse_token', res.token);
    if (res.refreshToken) localStorage.setItem('jse_refresh_token', res.refreshToken);
    setUser(res.user, res.token);
    toast.success(`Welcome back, ${res.user.name}!`);
  }, [setUser]);

  const signup = useCallback(async (username: string, email: string, password: string, fullName?: string) => {
    const res = await apiSignup(username, email, password, fullName);
    localStorage.setItem('jse_token', res.token);
    if (res.refreshToken) localStorage.setItem('jse_refresh_token', res.refreshToken);
    setUser(res.user, res.token);
    toast.success('Account created successfully!');
  }, [setUser]);

  const verify2FA = useCallback(async (code: string) => {
    if (!state.tempToken) throw new Error('No temp token');
    const res = await apiVerify2FA(code, state.tempToken);
    localStorage.setItem('jse_token', res.token);
    if (res.refreshToken) localStorage.setItem('jse_refresh_token', res.refreshToken);
    setUser(res.user, res.token);
    toast.success(`Welcome back, ${res.user.name}!`);
  }, [state.tempToken, setUser]);

  const logout = useCallback(() => {
    localStorage.removeItem('jse_token');
    localStorage.removeItem('jse_refresh_token');
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      tier: 'FREE',
      tempToken: null,
      needs2FA: false,
    });
    toast.success('Logged out');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await getMe();
      setUser(user);
    } catch {
      // Token may be invalid
    }
  }, [setUser]);

  const hasTier = useCallback(
    (requiredTier: SubscriptionPlan) => TIER_RANK[state.tier] >= TIER_RANK[requiredTier],
    [state.tier]
  );

  const isAdmin = state.user?.settings && typeof state.user.settings === 'object' && 'role' in state.user.settings
    ? (state.user.settings as Record<string, unknown>).role === 'admin'
    : false;

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        verify2FA,
        logout,
        refreshUser,
        hasTier,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
