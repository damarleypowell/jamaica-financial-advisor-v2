import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onSwitchToSignup: () => void;
}

export default function LoginModal({ onClose, onSwitchToSignup }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { resetPassword } = await import('@/api/auth');
      await resetPassword(email);
      toast.success('Password reset email sent');
      setShowForgot(false);
    } catch {
      toast.error('Could not send reset email');
    }
  };

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold gradient-text">
            {showForgot ? 'Reset Password' : 'Login'}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <i className="fas fa-times" />
          </button>
        </div>

        {showForgot ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg"
                placeholder="your@email.com"
              />
            </div>
            <button type="submit" className="w-full py-2 bg-gf-green text-bg font-semibold rounded-lg text-sm hover:bg-gf-green/90">
              Send Reset Link
            </button>
            <button type="button" onClick={() => setShowForgot(false)} className="w-full text-sm text-text-secondary hover:text-text-primary">
              Back to login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Email or Username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gf-green text-bg font-semibold rounded-lg text-sm hover:bg-gf-green/90 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => setShowForgot(true)} className="text-gf-blue hover:underline">
                Forgot password?
              </button>
              <button type="button" onClick={onSwitchToSignup} className="text-gf-green hover:underline">
                Create account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
