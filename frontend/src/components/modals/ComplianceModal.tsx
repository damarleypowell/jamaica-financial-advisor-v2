import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { apiPost } from '../../lib/api';

const COMPLIANCE_KEY = 'gf_compliance_v1';

export default function ComplianceModal() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [accepted, setAccepted] = useState({ understand: false, notAdvice: false, consultAdvisor: false });
  const [submitting, setSubmitting] = useState(false);

  // Hide if not logged in, already accepted on the user object, or accepted in localStorage
  if (!user || user.complianceAccepted || localStorage.getItem(COMPLIANCE_KEY)) return null;

  const allAccepted = Object.values(accepted).every(Boolean);

  async function handleAccept() {
    if (!allAccepted) return;
    setSubmitting(true);
    // Persist locally immediately so it never shows again after refresh
    localStorage.setItem(COMPLIANCE_KEY, '1');
    try {
      await apiPost('/api/users/accept-compliance', { version: '1.0' });
    } catch { /* ignore — localStorage already saved it */ }
    setUser({ ...user!, complianceAccepted: true });
    setSubmitting(false);
  }

  const items = [
    {
      key: 'understand' as const,
      label: 'I understand Oros is an educational and research tool, not a regulated investment advisor.',
    },
    {
      key: 'notAdvice' as const,
      label: 'All AI-generated analysis, reports, and suggestions are educational in nature — NOT personalized investment advice.',
    },
    {
      key: 'consultAdvisor' as const,
      label: 'I will consult a licensed financial advisor before making investment decisions and accept full responsibility for my own choices.',
    },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      background: 'rgba(0,0,0,.82)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--color-bg2)',
        border: '1px solid rgba(255,215,64,.18)',
        borderRadius: 24,
        boxShadow: '0 32px 80px rgba(0,0,0,.85), 0 0 0 1px rgba(255,215,64,.06)',
        overflow: 'hidden',
        animation: 'complianceIn .28s cubic-bezier(.16,1,.3,1)',
      }}>
        <style>{`@keyframes complianceIn { from { opacity:0; transform:scale(.95) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

        {/* Header */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid rgba(255,215,64,.1)',
          background: 'linear-gradient(135deg, rgba(255,215,64,.05) 0%, transparent 60%)',
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            background: 'rgba(255,215,64,.1)', border: '1px solid rgba(255,215,64,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="fa-solid fa-shield-halved" style={{ fontSize: 18, color: '#ffd740' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
              Before You Continue
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.4 }}>
              Please read and acknowledge the following disclosures
            </p>
          </div>
        </div>

        {/* Notice box */}
        <div style={{ padding: '20px 28px 0' }}>
          <div style={{
            padding: '14px 16px',
            borderRadius: 14,
            background: 'rgba(255,215,64,.05)',
            border: '1px solid rgba(255,215,64,.15)',
            borderLeft: '3px solid #ffd740',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 13, color: '#ffd740', marginTop: 1, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text2)', lineHeight: 1.6 }}>
                Oros provides market data, AI-powered analysis, and financial education.
                We do <strong style={{ color: 'var(--color-text)' }}>NOT</strong> provide personalized
                investment advice or act as a registered investment advisor or broker-dealer.
              </p>
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div style={{ padding: '18px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(({ key, label }) => (
            <label key={key} onClick={() => setAccepted(a => ({ ...a, [key]: !a[key] }))}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                border: `1px solid ${accepted[key] ? 'rgba(0,230,118,.35)' : 'var(--color-border)'}`,
                background: accepted[key] ? 'rgba(0,230,118,.06)' : 'rgba(var(--fg),.02)',
                transition: 'all 180ms',
              }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                border: `2px solid ${accepted[key] ? '#00e676' : 'rgba(var(--fg),.2)'}`,
                background: accepted[key] ? '#00e676' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 180ms',
              }}>
                {accepted[key] && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 13, color: 'var(--color-text2)', lineHeight: 1.5 }}>{label}</span>
            </label>
          ))}
        </div>

        {/* CTA */}
        <div style={{ padding: '4px 28px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleAccept} disabled={!allAccepted || submitting}
            style={{
              width: '100%', height: 50, borderRadius: 14, border: 'none',
              fontSize: 14, fontWeight: 800, cursor: allAccepted ? 'pointer' : 'not-allowed',
              background: allAccepted
                ? 'linear-gradient(135deg, #00e676, #00b248)'
                : 'rgba(var(--fg),.06)',
              color: allAccepted ? 'var(--color-bg)' : 'var(--color-muted)',
              boxShadow: allAccepted ? '0 4px 20px rgba(0,230,118,.35)' : 'none',
              transition: 'all 200ms',
              opacity: submitting ? 0.7 : 1,
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {submitting ? (
              <>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                Saving...
              </>
            ) : (
              <>
                <i className="fa-solid fa-check-circle" style={{ fontSize: 14 }} />
                I Agree — Continue to Platform
              </>
            )}
          </button>
          <p style={{ fontSize: 11, color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            By continuing, you acknowledge all investment decisions are your sole responsibility.
            Oros Ltd. is not liable for investment losses.
          </p>
        </div>
      </div>
    </div>
  );
}
