import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { changePassword, setup2FA, enable2FA, disable2FA } from '@/api/auth';
import { useAuth } from '@/context/AuthContext';
import { fmtDate } from '@/utils/formatters';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'security' | 'preferences';

export default function Settings() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // 2FA
  const [qrCode, setQrCode] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  const changePwMut = useMutation({
    mutationFn: () => changePassword(currentPw, newPw),
    onSuccess: () => { toast.success('Password changed'); setCurrentPw(''); setNewPw(''); setConfirmPw(''); },
    onError: (err: Error) => toast.error(err.message || 'Failed to change password'),
  });

  const setup2FAMut = useMutation({
    mutationFn: setup2FA,
    onSuccess: (data) => { setQrCode(data.qrCode); setShowSetup2FA(true); },
    onError: () => toast.error('Failed to setup 2FA'),
  });

  const enable2FAMut = useMutation({
    mutationFn: () => enable2FA(twoFaCode),
    onSuccess: () => { toast.success('2FA enabled!'); setShowSetup2FA(false); setTwoFaCode(''); refreshUser(); },
    onError: () => toast.error('Invalid code'),
  });

  const disable2FAMut = useMutation({
    mutationFn: () => disable2FA(disableCode),
    onSuccess: () => { toast.success('2FA disabled'); setShowDisable2FA(false); setDisableCode(''); refreshUser(); },
    onError: () => toast.error('Invalid code'),
  });

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <i className="fas fa-cog text-4xl text-text-muted mb-4" />
        <h2 className="text-xl font-bold text-text-primary mb-2">Settings</h2>
        <p className="text-sm text-text-secondary">Please log in to access settings.</p>
      </div>
    );
  }

  const handleChangePw = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) return toast.error('Passwords do not match');
    if (newPw.length < 8) return toast.error('Password must be at least 8 characters');
    changePwMut.mutate();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex gap-1">
        {([
          { key: 'profile', label: 'Profile', icon: 'fa-user' },
          { key: 'security', label: 'Security', icon: 'fa-shield-alt' },
          { key: 'preferences', label: 'Preferences', icon: 'fa-sliders-h' },
        ] as { key: Tab; label: string; icon: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              tab === t.key ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
            }`}
          >
            <i className={`fas ${t.icon} text-[10px]`} />{t.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Profile Information</h3>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gf-green to-gf-gold flex items-center justify-center">
              <span className="text-2xl font-bold text-bg">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary">{user.name}</p>
              <p className="text-xs text-text-secondary">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-text-muted">Account Created</p>
              <p className="text-text-primary font-semibold">{fmtDate(user.createdAt)}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-text-muted">Email Verified</p>
              <p className={`font-semibold ${user.emailVerified ? 'text-gf-green' : 'text-red-400'}`}>
                {user.emailVerified ? 'Verified' : 'Not Verified'}
              </p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-text-muted">KYC Status</p>
              <p className={`font-semibold ${user.kycStatus === 'VERIFIED' ? 'text-gf-green' : user.kycStatus === 'PENDING' ? 'text-gf-gold' : 'text-text-muted'}`}>
                {user.kycStatus}
              </p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-text-muted">2FA</p>
              <p className={`font-semibold ${user.twoFactorEnabled ? 'text-gf-green' : 'text-text-muted'}`}>
                {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="space-y-4">
          {/* Change Password */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Change Password</h3>
            <form onSubmit={handleChangePw} className="space-y-3">
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Current Password</label>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">New Password</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Confirm New Password</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none" />
              </div>
              <button type="submit" disabled={changePwMut.isPending} className="px-6 py-2.5 rounded-lg bg-gf-green text-bg text-sm font-semibold hover:bg-gf-green/90 disabled:opacity-50">
                {changePwMut.isPending ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* 2FA */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Two-Factor Authentication</h3>
            {user.twoFactorEnabled ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gf-green/10 flex items-center justify-center">
                    <i className="fas fa-check text-gf-green text-xs" />
                  </div>
                  <span className="text-xs text-gf-green font-semibold">2FA is enabled</span>
                </div>
                {showDisable2FA ? (
                  <div className="space-y-3">
                    <p className="text-xs text-text-secondary">Enter your 2FA code to disable:</p>
                    <input
                      type="text"
                      maxLength={6}
                      value={disableCode}
                      onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit code"
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary text-center tracking-widest focus:border-red-500/50 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => disable2FAMut.mutate()} disabled={disableCode.length !== 6} className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold disabled:opacity-50">Disable 2FA</button>
                      <button onClick={() => setShowDisable2FA(false)} className="px-4 py-2 rounded-lg bg-white/5 text-text-muted text-xs font-semibold">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowDisable2FA(true)} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20">
                    Disable 2FA
                  </button>
                )}
              </div>
            ) : showSetup2FA ? (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">Scan this QR code with your authenticator app:</p>
                {qrCode && <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg bg-white p-2 mx-auto" />}
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={twoFaCode}
                    onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary text-center tracking-widest focus:border-gf-green/50 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => enable2FAMut.mutate()} disabled={twoFaCode.length !== 6} className="px-4 py-2 rounded-lg bg-gf-green text-bg text-xs font-semibold disabled:opacity-50">Verify & Enable</button>
                  <button onClick={() => setShowSetup2FA(false)} className="px-4 py-2 rounded-lg bg-white/5 text-text-muted text-xs font-semibold">Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-text-secondary mb-3">
                  Add an extra layer of security to your account with two-factor authentication.
                </p>
                <button onClick={() => setup2FAMut.mutate()} disabled={setup2FAMut.isPending} className="px-4 py-2 rounded-lg bg-gf-green text-bg text-xs font-semibold hover:bg-gf-green/90 disabled:opacity-50">
                  {setup2FAMut.isPending ? 'Setting up...' : 'Setup 2FA'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preferences */}
      {tab === 'preferences' && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-xs font-semibold text-text-primary">Default Currency</p>
                <p className="text-[10px] text-text-muted">Currency for displaying prices</p>
              </div>
              <select className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:outline-none">
                <option value="JMD">JMD (J$)</option>
                <option value="USD">USD (US$)</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-xs font-semibold text-text-primary">Paper Trading Mode</p>
                <p className="text-[10px] text-text-muted">Practice trading with virtual funds</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-9 h-5 bg-white/10 peer-checked:bg-gf-green rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-xs font-semibold text-text-primary">Email Notifications</p>
                <p className="text-[10px] text-text-muted">Receive alerts and updates via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-9 h-5 bg-white/10 peer-checked:bg-gf-green rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs font-semibold text-text-primary">Sound Alerts</p>
                <p className="text-[10px] text-text-muted">Play sounds for price alerts and order fills</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-9 h-5 bg-white/10 peer-checked:bg-gf-green rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
