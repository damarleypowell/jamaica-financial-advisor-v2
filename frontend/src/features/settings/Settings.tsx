import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiPost } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { User } from '../../types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

type Tab = 'profile' | 'security' | 'preferences';

function getLS(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === 'true';
}
function setLS(key: string, value: boolean) {
  localStorage.setItem(key, String(value));
}
function getLSStr(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}
function setLSStr(key: string, value: string) {
  localStorage.setItem(key, value);
}

function passwordStrength(pw: string): { label: string; color: string; pct: number } {
  if (!pw) return { label: '', color: 'transparent', pct: 0 };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak',   color: 'var(--color-red)',  pct: 25 };
  if (score <= 3) return { label: 'Medium', color: '#f59e0b',           pct: 60 };
  return              { label: 'Strong',  color: 'var(--color-green)', pct: 100 };
}

/* ------------------------------------------------------------------ */
/*  Toast                                                               */
/* ------------------------------------------------------------------ */

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

function Toast({ toast }: { toast: ToastState }) {
  const bg =
    toast.type === 'success' ? 'rgba(0,230,118,.12)' :
    toast.type === 'error'   ? 'rgba(255,82,82,.12)'  :
                               'rgba(255,255,255,.08)';
  const border =
    toast.type === 'success' ? 'rgba(0,230,118,.3)' :
    toast.type === 'error'   ? 'rgba(255,82,82,.3)'  :
                               'rgba(255,255,255,.15)';
  const color =
    toast.type === 'success' ? 'var(--color-green)' :
    toast.type === 'error'   ? 'var(--color-red)'    :
                               'var(--color-text)';
  const icon =
    toast.type === 'success' ? 'fa-solid fa-circle-check' :
    toast.type === 'error'   ? 'fa-solid fa-circle-xmark' :
                               'fa-solid fa-circle-info';

  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px', borderRadius: 12,
      background: bg, border: `1px solid ${border}`,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      transition: 'opacity .3s, transform .3s',
      opacity: toast.visible ? 1 : 0,
      transform: toast.visible ? 'translateY(0)' : 'translateY(12px)',
      pointerEvents: 'none',
    }}>
      <i className={icon} style={{ fontSize: 14, color }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{toast.message}</span>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', visible: false });
  const show = useCallback((message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);
  return { toast, show };
}

/* ------------------------------------------------------------------ */
/*  Toggle row                                                           */
/* ------------------------------------------------------------------ */

function ToggleRow({
  label, sub, value, onChange, locked, lockNote,
}: {
  label: string; sub: string; value: boolean;
  onChange?: (v: boolean) => void; locked?: boolean; lockNote?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: 'var(--color-bg3)', border: '1px solid var(--color-border)' }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>{locked ? lockNote : sub}</p>
      </div>
      <button
        onClick={() => !locked && onChange?.(!value)}
        style={{
          flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: 'none',
          cursor: locked ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background .2s',
          background: value ? 'var(--color-green)' : 'rgba(255,255,255,.1)',
          opacity: locked ? 0.7 : 1,
        }}
      >
        <span style={{ position: 'absolute', top: 4, left: value ? 22 : 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                             */
/* ------------------------------------------------------------------ */

function Skeleton({ h = 18, w = '100%', r = 8 }: { h?: number; w?: string | number; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

/* ------------------------------------------------------------------ */
/*  Input                                                               */
/* ------------------------------------------------------------------ */

function Field({
  label, value, onChange, disabled, type = 'text', hint,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  disabled?: boolean; type?: string; hint?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</label>
      <input
        type={type} value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%', padding: '10px 14px', boxSizing: 'border-box',
          background: disabled ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.05)',
          border: `1px solid ${disabled ? 'rgba(255,255,255,.06)' : 'var(--color-border)'}`,
          borderRadius: 10, fontSize: 14, color: disabled ? 'var(--color-muted)' : 'var(--color-text)',
          outline: 'none', cursor: disabled ? 'not-allowed' : 'text', transition: 'border-color .15s',
        }}
        onFocus={e => { if (!disabled) e.target.style.borderColor = 'rgba(0,230,118,.45)'; }}
        onBlur={e => { e.target.style.borderColor = disabled ? 'rgba(255,255,255,.06)' : 'var(--color-border)'; }}
      />
      {hint && <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                       */
/* ------------------------------------------------------------------ */

export default function Settings() {
  const { user: storeUser, isAuthenticated, setUser } = useAuthStore();
  const qc = useQueryClient();
  const { toast, show } = useToast();
  const [tab, setTab] = useState<Tab>('profile');

  /* ---- Profile state ---- */
  const [name, setName] = useState(storeUser?.name ?? '');

  /* ---- Security state ---- */
  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError,   setPwError]   = useState('');

  /* ---- Preferences state ---- */
  const [emailNotif,  setEmailNotif]  = useState(() => getLS('pref_email_notifications', true));
  const [priceAlerts, setPriceAlerts] = useState(() => getLS('pref_price_alert_emails',  true));
  const [marketAlerts, setMarketAlerts] = useState(() => getLS('pref_market_alerts', false));
  const [currency, setCurrency] = useState(() => getLSStr('pref_currency', 'JMD'));

  /* ---- Fetch full profile ---- */
  const { data: profile, isLoading: profileLoading } = useQuery<User>({
    queryKey: ['profile'],
    queryFn: () => apiGet<User>('/api/auth/profile'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  // Sync name from fetched profile
  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile]);

  /* ---- Save profile mutation ---- */
  const saveMut = useMutation({
    mutationFn: async (data: { name: string }) => {
      try {
        return await apiPut<User>('/api/auth/profile', data);
      } catch (e: any) {
        if (e?.status === 404 || e?.status === 405) return { ...storeUser, ...data } as User;
        throw e;
      }
    },
    onSuccess: (updated) => {
      if (updated) { setUser(updated as User); qc.invalidateQueries({ queryKey: ['profile'] }); }
      show('Profile saved successfully');
    },
    onError: (e: any) => show(e.message || 'Failed to save profile', 'error'),
  });

  /* ---- Change password mutation ---- */
  const pwMut = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      try {
        return await apiPost('/api/auth/change-password', data);
      } catch (e: any) {
        if (e?.status === 404 || e?.status === 405) {
          show('Password change coming soon — use Forgot Password for now.', 'info');
          return null;
        }
        throw e;
      }
    },
    onSuccess: (res) => {
      if (res !== null) {
        show('Password changed successfully');
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
      }
    },
    onError: (e: any) => setPwError(e.message || 'Password change failed'),
  });

  /* ---- Unauthenticated guard ---- */
  if (!isAuthenticated || !storeUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <i className="fa-solid fa-gear" style={{ fontSize: 40, color: 'var(--color-muted)', opacity: .4 }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Sign in to access Settings</p>
      </div>
    );
  }

  const user = profile ?? storeUser;
  const tierColors: Record<string, string> = {
    FREE: 'var(--color-green)', BASIC: '#38bdf8', PRO: '#f59e0b', ENTERPRISE: '#a855f7',
  };
  const tierColor = tierColors[user.subscriptionTier ?? 'FREE'] ?? 'var(--color-green)';
  const strength  = passwordStrength(newPw);

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'profile',     label: 'Profile',     icon: 'fa-solid fa-user'          },
    { key: 'security',    label: 'Security',    icon: 'fa-solid fa-shield-halved'  },
    { key: 'preferences', label: 'Preferences', icon: 'fa-solid fa-sliders'        },
  ];

  return (
    <>
      <Toast toast={toast} />

      <div className="settings-grid" style={{ alignItems: 'start' }}>
        {/* ── Sidebar ── */}
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 18, overflow: 'hidden' }}>
          {/* Avatar card */}
          <div style={{ padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
            {profileLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Skeleton h={56} w={56} r={28} />
                <Skeleton h={14} w="60%" />
                <Skeleton h={11} w="80%" />
              </div>
            ) : (
              <>
                <div style={{ width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${tierColor}33, ${tierColor}11)`, border: `2px solid ${tierColor}44`, margin: '0 auto 12px' }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: tierColor }}>{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>{user.name}</p>
                <p style={{ margin: '3px 0 10px', fontSize: 11, color: 'var(--color-muted)', wordBreak: 'break-all' }}>{user.email}</p>
                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '.1em', background: `${tierColor}18`, border: `1px solid ${tierColor}33`, color: tierColor }}>
                  {user.subscriptionTier ?? 'FREE'}
                </span>
              </>
            )}
          </div>

          {/* Tab nav */}
          <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  textAlign: 'left', transition: 'all .15s', width: '100%',
                  background: tab === t.key ? 'rgba(0,230,118,.1)' : 'transparent',
                  color: tab === t.key ? 'var(--color-green)' : 'var(--color-text2)',
                  outline: tab === t.key ? '1px solid rgba(0,230,118,.15)' : 'none',
                }}>
                <i className={t.icon} style={{ fontSize: 12, width: 14, textAlign: 'center', color: tab === t.key ? 'var(--color-green)' : 'var(--color-muted)' }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content panel ── */}
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 18, overflow: 'hidden' }}>
          {/* Panel header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className={TABS.find(t => t.key === tab)?.icon} style={{ fontSize: 14, color: 'var(--color-green)' }} />
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>
              {TABS.find(t => t.key === tab)?.label}
            </p>
          </div>

          <div style={{ padding: 28 }}>

            {/* ════════════════ PROFILE TAB ════════════════ */}
            {tab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 480 }}>
                {profileLoading ? (
                  <>
                    <Skeleton h={40} />
                    <Skeleton h={40} />
                    <Skeleton h={32} w={140} />
                  </>
                ) : (
                  <>
                    <Field
                      label="Display Name"
                      value={name}
                      onChange={setName}
                    />
                    <Field
                      label="Email Address"
                      value={user.email}
                      disabled
                      hint="Email address cannot be changed. Contact support if needed."
                    />

                    {/* Verification badges */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Email',     ok: user.emailVerified          },
                        { label: '2FA',       ok: user.twoFactorEnabled       },
                        { label: 'KYC',       ok: user.kycStatus === 'VERIFIED' },
                      ].map(b => (
                        <span key={b.label} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: b.ok ? 'rgba(0,230,118,.08)' : 'rgba(255,255,255,.04)',
                          border: `1px solid ${b.ok ? 'rgba(0,230,118,.2)' : 'rgba(255,255,255,.08)'}`,
                          color: b.ok ? 'var(--color-green)' : 'var(--color-muted)',
                        }}>
                          <i className={`fa-solid ${b.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ fontSize: 9 }} />
                          {b.label} {b.ok ? 'Verified' : 'Unverified'}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => saveMut.mutate({ name })}
                      disabled={saveMut.isPending || name.trim() === user.name}
                      style={{
                        alignSelf: 'flex-start', padding: '10px 28px',
                        background: 'var(--color-green)', color: 'var(--color-bg)',
                        borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none',
                        cursor: saveMut.isPending || name.trim() === user.name ? 'not-allowed' : 'pointer',
                        opacity: saveMut.isPending || name.trim() === user.name ? .5 : 1,
                        transition: 'opacity .15s',
                      }}
                    >
                      {saveMut.isPending ? 'Saving…' : 'Save Profile'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ════════════════ SECURITY TAB ════════════════ */}
            {tab === 'security' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 480 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text2)', lineHeight: 1.6 }}>
                  Update your password to keep your account secure. Minimum 8 characters.
                </p>

                <Field label="Current Password" type="password" value={currentPw} onChange={v => { setCurrentPw(v); setPwError(''); }} />
                <Field label="New Password"     type="password" value={newPw}     onChange={v => { setNewPw(v);     setPwError(''); }} />

                {/* Strength indicator */}
                {newPw && (
                  <div style={{ marginTop: -10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Password strength</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: strength.color }}>{strength.label}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${strength.pct}%`, background: strength.color, borderRadius: 4, transition: 'width .3s, background .3s' }} />
                    </div>
                  </div>
                )}

                <Field label="Confirm New Password" type="password" value={confirmPw} onChange={v => { setConfirmPw(v); setPwError(''); }} />

                {pwError && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 11 }} /> {pwError}
                  </p>
                )}

                <button
                  onClick={() => {
                    if (!currentPw) { setPwError('Enter your current password'); return; }
                    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
                    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
                    pwMut.mutate({ currentPassword: currentPw, newPassword: newPw });
                  }}
                  disabled={pwMut.isPending || !currentPw || !newPw || !confirmPw}
                  style={{
                    alignSelf: 'flex-start', padding: '10px 28px',
                    background: 'var(--color-green)', color: 'var(--color-bg)',
                    borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none',
                    cursor: pwMut.isPending || !currentPw || !newPw || !confirmPw ? 'not-allowed' : 'pointer',
                    opacity: pwMut.isPending || !currentPw || !newPw || !confirmPw ? .5 : 1,
                    transition: 'opacity .15s',
                  }}
                >
                  {pwMut.isPending ? 'Updating…' : 'Change Password'}
                </button>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />

                {/* 2FA section */}
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Two-Factor Authentication</p>
                  <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--color-muted)' }}>
                    Add an extra layer of security using an authenticator app.
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'var(--color-bg3)', border: '1px solid var(--color-border)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: user.twoFactorEnabled ? 'rgba(0,230,118,.1)' : 'rgba(255,255,255,.06)', flexShrink: 0 }}>
                      <i className={`fa-solid ${user.twoFactorEnabled ? 'fa-lock' : 'fa-lock-open'}`} style={{ fontSize: 16, color: user.twoFactorEnabled ? 'var(--color-green)' : 'var(--color-muted)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                        {user.twoFactorEnabled ? 'Two-Factor Enabled' : 'Two-Factor Disabled'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>
                        {user.twoFactorEnabled ? 'Your account is protected with 2FA.' : 'Enable 2FA to secure your account.'}
                      </p>
                    </div>
                    {user.twoFactorEnabled ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.25)', color: 'var(--color-green)' }}>
                        <i className="fa-solid fa-circle-check" style={{ fontSize: 9 }} /> 2FA Active
                      </span>
                    ) : (
                      <button style={{ padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.07)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer' }}>
                        Set up 2FA
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════ PREFERENCES TAB ════════════════ */}
            {tab === 'preferences' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 520 }}>
                {/* Appearance */}
                <div>
                  <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Appearance</p>
                  <ToggleRow
                    label="Dark Theme"
                    sub="Gotham dark interface"
                    value={true}
                    locked
                    lockNote="Light mode coming soon"
                  />
                </div>

                {/* Notifications */}
                <div>
                  <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Email Notifications</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ToggleRow
                      label="Email Notifications"
                      sub="Receive important account updates via email"
                      value={emailNotif}
                      onChange={v => { setEmailNotif(v); setLS('pref_email_notifications', v); }}
                    />
                    <ToggleRow
                      label="Price Alert Emails"
                      sub="Get emailed when your price alerts trigger"
                      value={priceAlerts}
                      onChange={v => { setPriceAlerts(v); setLS('pref_price_alert_emails', v); }}
                    />
                    <ToggleRow
                      label="Market Open / Close Alerts"
                      sub="Daily JSE market status notifications"
                      value={marketAlerts}
                      onChange={v => { setMarketAlerts(v); setLS('pref_market_alerts', v); }}
                    />
                  </div>
                </div>

                {/* Display currency */}
                <div>
                  <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Display Currency</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['JMD', 'USD'] as const).map(c => (
                      <button
                        key={c}
                        onClick={() => { setCurrency(c); setLSStr('pref_currency', c); }}
                        style={{
                          flex: 1, padding: '12px 0', borderRadius: 12, border: `1px solid ${currency === c ? 'rgba(0,230,118,.4)' : 'var(--color-border)'}`,
                          background: currency === c ? 'rgba(0,230,118,.1)' : 'rgba(255,255,255,.03)',
                          color: currency === c ? 'var(--color-green)' : 'var(--color-text2)',
                          fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                        }}
                      >
                        {c === 'JMD' ? 'J$ Jamaican Dollar' : 'US$ US Dollar'}
                      </button>
                    ))}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>
                    Affects how prices are displayed across the platform. Preference saved locally.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
