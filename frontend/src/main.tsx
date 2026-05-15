import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ui/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={
      <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Gotham Financial</p>
          <p style={{ color: '#f87171', marginBottom: 16 }}>Something went wrong. Please refresh.</p>
          <button onClick={() => window.location.reload()}
            style={{ padding: '8px 24px', borderRadius: 8, background: '#00e676', color: '#000', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      </div>
    }>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
