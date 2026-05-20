import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/layout/Layout.tsx';
import ProtectedRoute from './components/ui/ProtectedRoute.tsx';
import StockDetailModal from './components/modals/StockDetailModal.tsx';
import ComplianceModal from './components/modals/ComplianceModal.tsx';
import AuthModal from './components/modals/AuthModal.tsx';
import { useMarketStore } from './stores/market.ts';
import { useAuthStore } from './stores/auth.ts';
import FloatingAIAdvisor from './components/FloatingAIAdvisor.tsx';

/* ---------- Lazy-loaded route components ---------- */
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.tsx'));
const AdvancedChart = lazy(() => import('./features/technicals/AdvancedChart.tsx'));
const News = lazy(() => import('./features/news/News.tsx'));
const Watchlists = lazy(() => import('./features/watchlists/Watchlists.tsx'));
const Screener = lazy(() => import('./features/screener/Screener.tsx'));
const Portfolio = lazy(() => import('./features/portfolio/Portfolio.tsx'));
const Orders = lazy(() => import('./features/orders/Orders.tsx'));
const USStocks    = lazy(() => import('./features/us-stocks/USStocks.tsx'));
const AIChat = lazy(() => import('./features/chat/AIChat.tsx'));
const AIAnalysis = lazy(() => import('./features/analysis/AIAnalysis.tsx'));
const Learn = lazy(() => import('./features/learn/Learn.tsx'));
const Settings = lazy(() => import('./features/settings/Settings.tsx'));
const Alerts = lazy(() => import('./features/alerts/Alerts.tsx'));
const Subscription = lazy(() => import('./features/subscription/Subscription.tsx'));
const Admin = lazy(() => import('./features/admin/Admin.tsx'));
const Onboarding = lazy(() => import('./features/onboarding/Onboarding.tsx'));
const VerifyEmail = lazy(() => import('./features/verify-email/VerifyEmail.tsx'));

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
  const connectSSE = useMarketStore((s) => s.connectSSE);
  const disconnectSSE = useMarketStore((s) => s.disconnectSSE);
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    connectSSE();
    loadUser();
    return () => disconnectSSE();
  }, [connectSSE, disconnectSSE, loadUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthModal />
        <FloatingAIAdvisor />
        <Routes>
          {/* Onboarding â€” full-screen, no sidebar layout */}
          <Route
            path="onboarding"
            element={
              <Suspense fallback={<PageLoader />}>
                <Onboarding />
              </Suspense>
            }
          />
          <Route
            path="verify-email"
            element={
              <Suspense fallback={<PageLoader />}>
                <VerifyEmail />
              </Suspense>
            }
          />

          <Route element={<Layout />}>
            {/* FREE — dashboard (limited), subscription, settings always accessible */}
            <Route
              index
              element={
                <Suspense fallback={<PageLoader />}>
                  <Dashboard />
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
            <Route
              path="settings"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Settings />
                </Suspense>
              }
            />

            {/* BASIC+ routes */}
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="News & Sentiment" />}>
              <Route path="news" element={<Suspense fallback={<PageLoader />}><News /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Watchlists" />}>
              <Route path="watchlists" element={<Suspense fallback={<PageLoader />}><Watchlists /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Portfolio Tracker" />}>
              <Route path="portfolio" element={<Suspense fallback={<PageLoader />}><Portfolio /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Paper Trading" />}>
              <Route path="orders" element={<Suspense fallback={<PageLoader />}><Orders /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Price Alerts" />}>
              <Route path="alerts" element={<Suspense fallback={<PageLoader />}><Alerts /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Learning Academy" />}>
              <Route path="learn" element={<Suspense fallback={<PageLoader />}><Learn /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="Advanced Charts" />}>
              <Route path="technicals" element={<Suspense fallback={<PageLoader />}><AdvancedChart /></Suspense>} />
              <Route path="technicals/:symbol" element={<Suspense fallback={<PageLoader />}><AdvancedChart /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute requiredTier="BASIC" featureName="US Stocks" />}>
              <Route path="us-stocks" element={<Suspense fallback={<PageLoader />}><USStocks /></Suspense>} />
            </Route>

            {/* PRO+ routes */}
            <Route element={<ProtectedRoute requiredTier="PRO" featureName="Stock Screener" />}>
              <Route path="screener" element={<Suspense fallback={<PageLoader />}><Screener /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute requiredTier="PRO" featureName="AI Chat Advisor" />}>
              <Route path="chat" element={<Suspense fallback={<PageLoader />}><AIChat /></Suspense>} />
            </Route>
            <Route element={<ProtectedRoute requiredTier="PRO" featureName="AI Stock Analysis" />}>
              <Route path="analysis" element={<Suspense fallback={<PageLoader />}><AIAnalysis /></Suspense>} />
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

        {/* Global modals â€” rendered outside the route tree */}
        <StockDetailModal />
        <ComplianceModal />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

