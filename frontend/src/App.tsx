import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/layout/Layout.tsx';
import ProtectedRoute from './components/ui/ProtectedRoute.tsx';
import AuthModal from './components/modals/AuthModal.tsx';
import StockDetailModal from './components/modals/StockDetailModal.tsx';
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

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
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

        {/* Global modals — rendered outside the route tree */}
        <AuthModal />
        <StockDetailModal />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
