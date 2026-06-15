import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/layout/Layout.tsx';
import ProtectedRoute from './components/ui/ProtectedRoute.tsx';
import StockDetailModal from './components/modals/StockDetailModal.tsx';
import ComplianceModal from './components/modals/ComplianceModal.tsx';
import AuthModal from './components/modals/AuthModal.tsx';
import FeatureGuide from './components/ui/FeatureGuide.tsx';
import AppTour from './components/ui/AppTour.tsx';
import { useMarketStore } from './stores/market.ts';
import { useAuthStore } from './stores/auth.ts';
import { useUIStore } from './stores/ui.ts';
import FloatingAIAdvisor from './components/FloatingAIAdvisor.tsx';

/* ---------- Lazy-loaded route components ---------- */
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.tsx'));
const AdvancedChart = lazy(() => import('./features/technicals/AdvancedChart.tsx'));
const News = lazy(() => import('./features/news/News.tsx'));
const Watchlists = lazy(() => import('./features/watchlists/Watchlists.tsx'));
const Screener = lazy(() => import('./features/screener/Screener.tsx'));
const Portfolio = lazy(() => import('./features/portfolio/Portfolio.tsx'));
const Holdings = lazy(() => import('./features/holdings/Holdings.tsx'));
const Invest = lazy(() => import('./features/invest/Invest.tsx'));
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

function W(C: React.LazyExoticComponent<React.ComponentType>) {
  return <Suspense fallback={<PageLoader />}><C /></Suspense>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const onboarded = localStorage.getItem('gf_onboarded');
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/* Password-reset link from email lands here — open the reset form over the app. */
function ResetPasswordRoute() {
  const openAuthModal = useUIStore((s) => s.openAuthModal);
  useEffect(() => { openAuthModal('reset'); }, [openAuthModal]);
  return <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} />;
}

/* ---------- App ---------- */
export default function App() {
  const connectSSE = useMarketStore((s) => s.connectSSE);
  const disconnectSSE = useMarketStore((s) => s.disconnectSSE);
  const loadStocks = useMarketStore((s) => s.loadStocks);
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    loadStocks();   // REST snapshot (with names) — resilient if SSE doesn't deliver
    connectSSE();   // live price updates
    loadUser();
    return () => disconnectSSE();
  }, [connectSSE, disconnectSSE, loadStocks, loadUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthModal />
        <FloatingAIAdvisor />
        <FeatureGuide />
        <AppTour />
        <Routes>
          {/* Full-screen routes — no sidebar */}
          <Route path="onboarding" element={<Suspense fallback={<PageLoader />}><Onboarding /></Suspense>} />
          <Route path="verify-email" element={<Suspense fallback={<PageLoader />}><VerifyEmail /></Suspense>} />
          <Route path="reset-password" element={<ResetPasswordRoute />} />

          <Route element={<Layout />}>
            {/* ── Open to all (FREE) ─────────────────────────────── */}
            <Route index element={<OnboardingGate>{W(Dashboard)}</OnboardingGate>} />
            <Route path="subscription" element={W(Subscription)} />
            <Route path="settings" element={W(Settings)} />
            <Route path="news" element={W(News)} />
            <Route path="watchlists" element={W(Watchlists)} />
            <Route path="invest" element={W(Invest)} />
            <Route path="portfolio" element={W(Portfolio)} />
            <Route path="holdings" element={W(Holdings)} />
            <Route path="orders" element={W(Orders)} />
            <Route path="alerts" element={W(Alerts)} />
            <Route path="learn" element={W(Learn)} />
            <Route path="technicals" element={W(AdvancedChart)} />
            <Route path="technicals/:symbol" element={W(AdvancedChart)} />
            <Route path="us-stocks" element={W(USStocks)} />

            {/* ── AI is free (sign-in required, daily usage cap) ── */}
            <Route path="chat" element={W(AIChat)} />
            <Route path="analysis" element={W(AIAnalysis)} />

            {/* ── CORE+ required (paid plan) ────────────────────── */}
            <Route element={<ProtectedRoute requiredTier="CORE" featureName="Stock Screener" />}>
              <Route path="screener" element={W(Screener)} />
            </Route>

            {/* ── Admin ─────────────────────────────────────────── */}
            <Route element={<ProtectedRoute requiredTier="ENTERPRISE" featureName="Admin Panel" />}>
              <Route path="admin" element={W(Admin)} />
            </Route>
          </Route>

          {/* Catch-all — never leave the user on a blank screen */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global modals */}
        <StockDetailModal />
        <ComplianceModal />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
