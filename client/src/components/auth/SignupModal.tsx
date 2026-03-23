import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onSwitchToLogin: () => void;
}

const PW_RULES = [
  { label: '12+ characters', test: (p: string) => p.length >= 12 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[!@#$%^&*()_+\-=]/.test(p) },
];

export default function SignupModal({ onClose, onSwitchToLogin }: Props) {
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allPass = PW_RULES.every((r) => r.test(form.password));
    if (!allPass) {
      toast.error('Password does not meet requirements');
      return;
    }
    setLoading(true);
    try {
      await signup(form.username, form.email, form.password, form.name);
      onClose();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; details?: { message: string }[] } } })?.response?.data;
      toast.error(data?.details?.[0]?.message || data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-6 animate-fadeIn max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold gradient-text">Create Account</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <i className="fas fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg"
              placeholder="johndoe"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg"
            />
            <div className="mt-2 grid grid-cols-2 gap-1">
              {PW_RULES.map((rule) => (
                <span
                  key={rule.label}
                  className={`text-[10px] flex items-center gap-1 ${
                    rule.test(form.password) ? 'text-gf-green' : 'text-text-muted'
                  }`}
                >
                  <i className={`fas ${rule.test(form.password) ? 'fa-check' : 'fa-circle'} text-[7px]`} />
                  {rule.label}
                </span>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-gf-green text-bg font-semibold rounded-lg text-sm hover:bg-gf-green/90 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
          <p className="text-center text-xs text-text-muted">
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin} className="text-gf-green hover:underline">
              Login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
