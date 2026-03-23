import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/layout/Layout.tsx';
import ProtectedRoute from './components/ui/ProtectedRoute.tsx';
import { useMarketStore } from './stores/market.ts';
import { useAuthStore } from './stores/auth.ts';

/* ---------- Lazy-loaded route components ---------- */
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.tsx'));
const AdvancedChart = lazy(() => import('./features/technicals/AdvancedChart.tsx'));
const News = lazy(() => import('./features/news/News.tsx'));
const Watchlists = lazy(() => import('./features/watchlists/Watchlists.tsx'));
const Screener = lazy(() => import('./features/screener/Screener.tsx'));
const Sectors = lazy(() => import('./features/sectors/Sectors.tsx'));
const Compare = lazy(() => import('./features/compare/Compare.tsx'));
const Dividends = lazy(() => import('./features/dividends/Dividends.tsx'));
const Portfolio = lazy(() => import('./features/portfolio/Portfolio.tsx'));
const Orders = lazy(() => import('./features/orders/Orders.tsx'));
const Calculators = lazy(() => import('./features/calculators/Calculators.tsx'));
const USStocks = lazy(() => import('./features/us-stocks/USStocks.tsx'));
const Forex = lazy(() => import('./features/forex/Forex.tsx'));
const GlobalMarkets = lazy(() => import('./features/global-markets/GlobalMarkets.tsx'));
const CurrencyImpact = lazy(() => import('./features/currency-impact/CurrencyImpact.tsx'));
const Planner = lazy(() => import('./features/planner/Planner.tsx'));
const Leaderboard = lazy(() => import('./features/leaderboard/Leaderboard.tsx'));
const AIChat = lazy(() => import('./features/chat/AIChat.tsx'));
const AIAnalysis = lazy(() => import('./features/analysis/AIAnalysis.tsx'));
const Learn = lazy(() => import('./features/learn/Learn.tsx'));
const Settings = lazy(() => import('./features/settings/Settings.tsx'));
const Subscription = lazy(() => import('./features/subscription/Subscription.tsx'));
const Admin = lazy(() => import('./features/admin/Admin.tsx'));

/* ---------- Query client ---------- */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/* ---------- Loading fallback ---------- */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted">Loading...</span>
      </div>
    </div>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'login' | 'signup';
  }>({ open: false, mode: 'login' });

  const connectSSE = useMarketStore((s) => s.connectSSE);
  const disconnectSSE = useMarketStore((s) => s.disconnectSSE);
  const loadUser = useAuthStore((s) => s.loadUser);

  // Bootstrap: connect to market SSE + load user on mount
  useEffect(() => {
    connectSSE();
    loadUser();
    return () => {
      disconnectSSE();
    };
  }, [connectSSE, disconnectSSE, loadUser]);

  function openAuth(mode: 'login' | 'signup') {
    setAuthModal({ open: true, mode });
  }

  function closeAuth() {
    setAuthModal((prev) => ({ ...prev, open: false }));
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            element={<Layout onOpenAuth={openAuth} />}
          >
            {/* FREE routes */}
            <Route
              index
              element={
                <Suspense fallback={<PageLoader />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route
              path="news"
              element={
                <Suspense fallback={<PageLoader />}>
                  <News />
                </Suspense>
              }
            />
            <Route
              path="watchlists"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Watchlists />
                </Suspense>
              }
            />
            <Route
              path="portfolio"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Portfolio />
                </Suspense>
              }
            />
            <Route
              path="orders"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Orders />
                </Suspense>
              }
            />
            <Route
              path="learn"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Learn />
                </Suspense>
              }
            />
            <Route
              path="settings"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Settings />
                </Suspense>
              }
            />
            <Route
              path="subscription"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Subscription />
                </Suspense>
              }
            />

            {/* BASIC+ routes */}
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Advanced Chart" />}>
              <Route
                path="technicals"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AdvancedChart />
                  </Suspense>
                }
              />
              <Route
                path="technicals/:symbol"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AdvancedChart />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Screener" />}>
              <Route
                path="screener"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Screener />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Sectors" />}>
              <Route
                path="sectors"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Sectors />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Compare" />}>
              <Route
                path="compare"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Compare />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Dividends" />}>
              <Route
                path="dividends"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Dividends />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Calculators" />}>
              <Route
                path="calculators"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Calculators />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="US Stocks" />}>
              <Route
                path="us-stocks"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <USStocks />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="AI Chat" />}>
              <Route
                path="chat"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AIChat />
                  </Suspense>
                }
              />
            </Route>

            {/* PRO+ routes */}
            <Route element={<ProtectedRoute requiredTier="PRO" featureName="Forex" />}>
              <Route
                path="forex"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Forex />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="PRO" featureName="Global Markets" />}>
              <Route
                path="global-markets"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <GlobalMarkets />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="PRO" featureName="Currency Impact" />}>
              <Route
                path="currency-impact"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <CurrencyImpact />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="PRO" featureName="Financial Planner" />}>
              <Route
                path="planner"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Planner />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="PRO" featureName="Leaderboard" />}>
              <Route
                path="leaderboard"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Leaderboard />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requiredTier="PRO" featureName="AI Analysis" />}>
              <Route
                path="analysis"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AIAnalysis />
                  </Suspense>
                }
              />
            </Route>

            {/* Admin route */}
            <Route element={<ProtectedRoute requiredTier="ENTERPRISE" featureName="Admin Panel" />}>
              <Route
                path="admin"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Admin />
                  </Suspense>
                }
              />
            </Route>
          </Route>
        </Routes>

        {/* Global AuthModal - rendered outside routes */}
        {authModal.open && (
          <AuthModalPlaceholder
            mode={authModal.mode}
            onClose={closeAuth}
            onSwitchMode={(mode) =>
              setAuthModal({ open: true, mode })
            }
          />
        )}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/* ---------- AuthModal placeholder ---------- */
/* This will be replaced by the real AuthModal component once built. */
function AuthModalPlaceholder({
  mode,
  onClose,
  onSwitchMode,
}: {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSwitchMode: (mode: 'login' | 'signup') => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="glass-strong rounded-2xl p-8 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-glass text-muted hover:text-text transition-colors flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <p className="text-muted text-sm mb-6">
          {mode === 'login'
            ? 'Sign in to your Gotham Financial account.'
            : 'Join Gotham Financial to start trading.'}
        </p>
        <div className="space-y-4">
          <div className="h-10 skeleton rounded-lg" />
          <div className="h-10 skeleton rounded-lg" />
          {mode === 'signup' && <div className="h-10 skeleton rounded-lg" />}
          <button className="w-full py-3 bg-green text-bg font-semibold rounded-lg hover:bg-green/90 transition-colors">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
        <p className="text-center text-sm text-muted mt-4">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => onSwitchMode('signup')}
                className="text-green hover:underline"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => onSwitchMode('login')}
                className="text-green hover:underline"
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
