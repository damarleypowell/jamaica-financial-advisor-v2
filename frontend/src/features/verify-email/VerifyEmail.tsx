import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const loadUser = useAuthStore((s) => s.loadUser);
  // Derive the token and initial state during render so the effect never has
  // to synchronously set state for the missing-token case.
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [msg, setMsg] = useState(token ? '' : 'No verification token found.');

  useEffect(() => {
    if (!token) return;
    apiPost('/api/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        loadUser(); // refresh user so emailVerified reflects the new state
      })
      .catch((e: unknown) => {
        setStatus('error');
        setMsg(e instanceof Error ? e.message : 'Verification failed. The link may have expired.');
      });
  }, [token, loadUser]);

  const GREEN = '#00C853';
  const INK = '#111827';
  const SUB = '#6B7280';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.08)' }}>
        {status === 'loading' && (
          <>
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${GREEN}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 24px' }} />
            <p style={{ color: SUB, fontSize: 15, fontFamily: "'Inter', sans-serif" }}>Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(0,200,83,.1)', border: `1.5px solid rgba(0,200,83,.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: '0 0 12px', fontFamily: "'Syne', sans-serif", letterSpacing: '-0.025em' }}>Email verified!</h1>
            <p style={{ color: SUB, fontSize: 14, fontFamily: "'Inter', sans-serif", lineHeight: 1.6, margin: '0 0 28px' }}>
              Your account is now active. You can sign in and start investing.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{ background: GREEN, color: 'rgba(var(--fg),1)', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
            >
              Go to Dashboard
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(220,38,38,.08)', border: `1.5px solid rgba(220,38,38,.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: '0 0 12px', fontFamily: "'Syne', sans-serif", letterSpacing: '-0.025em' }}>Verification failed</h1>
            <p style={{ color: SUB, fontSize: 14, fontFamily: "'Inter', sans-serif", lineHeight: 1.6, margin: '0 0 28px' }}>
              {msg || 'This link may have expired. Try signing up again or contact support.'}
            </p>
            <button
              onClick={() => navigate('/')}
              style={{ background: '#111827', color: 'rgba(var(--fg),1)', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
            >
              Back to Home
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
