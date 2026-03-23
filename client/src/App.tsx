import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';

// Lazy-loaded pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Sectors = lazy(() => import('@/pages/Sectors'));
const News = lazy(() => import('@/pages/News'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const Dividends = lazy(() => import('@/pages/Dividends'));
const CurrencyImpact = lazy(() => import('@/pages/CurrencyImpact'));
const Portfolio = lazy(() => import('@/pages/Portfolio'));
const Orders = lazy(() => import('@/pages/Orders'));
const Watchlists = lazy(() => import('@/pages/Watchlists'));
const Alerts = lazy(() => import('@/pages/Alerts'));
const USStocks = lazy(() => import('@/pages/USStocks'));
const TechnicalAnalysis = lazy(() => import('@/pages/TechnicalAnalysis'));
const Screener = lazy(() => import('@/pages/Screener'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const AIChat = lazy(() => import('@/pages/AIChat'));
const Settings = lazy(() => import('@/pages/Settings'));
const Subscription = lazy(() => import('@/pages/Subscription'));
const Admin = lazy(() => import('@/pages/Admin'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout />}>
          {/* Public — Markets */}
          <Route index element={<Dashboard />} />
          <Route path="sectors" element={<Sectors />} />
          <Route path="news" element={<News />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="dividends" element={<Dividends />} />
          <Route path="currency-impact" element={<CurrencyImpact />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="privacy" element={<PrivacyPolicy />} />
          <Route path="terms" element={<TermsOfService />} />

          {/* Protected — Trading */}
          <Route path="portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="watchlists" element={<ProtectedRoute><Watchlists /></ProtectedRoute>} />
          <Route path="alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Protected + Pro tier — Research */}
          <Route path="technicals" element={<ProtectedRoute><TechnicalAnalysis /></ProtectedRoute>} />
          <Route path="screener" element={<ProtectedRoute><Screener /></ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="us-stocks" element={<ProtectedRoute><USStocks /></ProtectedRoute>} />
          <Route path="ai-chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
