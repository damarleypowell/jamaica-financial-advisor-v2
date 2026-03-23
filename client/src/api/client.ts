// ═══════════════════════════════════════════════════════════════════════════════
// ── Axios Client with Auth Interceptor ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ── Request interceptor: attach Bearer token ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jse_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 + refresh ───────────────────────────────
let isRefreshing = false;
let pendingRequests: ((token: string) => void)[] = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('jse_refresh_token');

      if (refreshToken) {
        if (isRefreshing) {
          // Queue this request until refresh completes
          return new Promise((resolve) => {
            pendingRequests.push((newToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          const newToken = data.token;
          localStorage.setItem('jse_token', newToken);
          if (data.refreshToken) {
            localStorage.setItem('jse_refresh_token', data.refreshToken);
          }

          // Retry queued requests
          pendingRequests.forEach((cb) => cb(newToken));
          pendingRequests = [];

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          // Refresh failed — clear tokens and redirect to login
          localStorage.removeItem('jse_token');
          localStorage.removeItem('jse_refresh_token');
          pendingRequests = [];
          window.dispatchEvent(new Event('auth:logout'));
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token — clear and emit logout
        localStorage.removeItem('jse_token');
        window.dispatchEvent(new Event('auth:logout'));
      }
    }

    // Show error toast for non-401 server errors
    if (error.response?.status && error.response.status >= 500) {
      toast.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  }
);

export default api;
