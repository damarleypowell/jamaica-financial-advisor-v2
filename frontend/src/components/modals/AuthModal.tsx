import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useUIStore } from '../../stores/ui';
import { useAuthStore } from '../../stores/auth';
import { apiPost } from '../../lib/api';
import type { AccountType } from '../../types';

/* ------------------------------------------------------------------ */
/*  Password validation helpers                                       */
/* ------------------------------------------------------------------ */

interface PasswordCheck {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

function checkPassword(pw: string): PasswordCheck {
  return {
    minLength: pw.length >= 12,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
  };
}

function isPasswordValid(pw: string): boolean {
  const c = checkPassword(pw);
  return c.minLength && c.hasUpper && c.hasLower && c.hasNumber && c.hasSpecial;
}

/* ------------------------------------------------------------------ */
/*  Shared small components                                           */
/* ------------------------------------------------------------------ */

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? 'text-emerald-400' : 'text-zinc-500'}`}>
      <span className="text-[10px]">{met ? '\u2713' : '\u2022'}</span>
      {label}
    </li>
  );
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-400">
      {message}
    </div>
  );
}

function SuccessBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm text-emerald-400">
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login Form                                                        */
/* ------------------------------------------------------------------ */

function LoginForm() {
  const { login, isLoading } = useAuthStore();
  const { closeAuthModal, setAuthModalView } = useUIStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await login(email, password);
      if (res.requires2FA) {
        // Store tempToken for 2FA step — stash in sessionStorage briefly
        sessionStorage.setItem('jse_temp_token', res.tempToken ?? '');
        setAuthModalView('2fa');
      } else {
        closeAuthModal();
      }
    } catch (err: any) {
      setError(err?.message ?? 'Login failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white text-center">Sign In</h2>

      <ErrorBox message={error} />

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 pr-10 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs select-none"
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAuthModalView('forgot')}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition"
        >
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm font-semibold text-white transition"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={() => setAuthModalView('signup')}
          className="text-emerald-400 hover:text-emerald-300 font-medium transition"
        >
          Sign Up
        </button>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  2FA Form                                                          */
/* ------------------------------------------------------------------ */

function TwoFactorForm() {
  const { verify2FA, isLoading } = useAuthStore();
  const { closeAuthModal, setAuthModalView } = useUIStore();

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const submit = useCallback(
    async (code: string) => {
      setError('');
      const tempToken = sessionStorage.getItem('jse_temp_token') ?? '';
      try {
        await verify2FA(code, tempToken);
        sessionStorage.removeItem('jse_temp_token');
        closeAuthModal();
      } catch (err: any) {
        setError(err?.message ?? 'Invalid code. Please try again.');
        setDigits(Array(6).fill(''));
        inputsRef.current[0]?.focus();
      }
    },
    [verify2FA, closeAuthModal],
  );

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    const code = next.join('');
    if (code.length === 6 && next.every((d) => d !== '')) {
      submit(code);
    }
  };

  const handleKeyDown = (index: number, e: ReactKeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = Array(6).fill('');
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);

    if (pasted.length === 6) {
      submit(pasted);
    } else {
      inputsRef.current[pasted.length]?.focus();
    }
  };

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white text-center">Two-Factor Authentication</h2>
      <p className="text-sm text-zinc-400 text-center">
        Enter the 6-digit code from your authenticator app.
      </p>

      <ErrorBox message={error} />

      <div className="flex justify-center gap-2" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-11 h-13 rounded-lg border border-zinc-700 bg-zinc-800/60 text-center text-lg font-mono text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition"
          />
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-zinc-400 text-center">Verifying...</p>
      )}

      <p className="text-center text-sm text-zinc-500">
        <button
          type="button"
          onClick={() => setAuthModalView('login')}
          className="text-emerald-400 hover:text-emerald-300 font-medium transition"
        >
          Back to login
        </button>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Signup Form                                                       */
/* ------------------------------------------------------------------ */

function SignupForm() {
  const { signup, isLoading } = useAuthStore();
  const { setAuthModalView } = useUIStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('paper');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const checks = checkPassword(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid(password)) {
      setError('Password does not meet all requirements.');
      return;
    }

    try {
      await signup(name, email, password, accountType);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? 'Signup failed. Please try again.');
    }
  };

  if (success) {
    return (
      <div className="flex flex-col gap-4 items-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Check Your Email</h2>
        <p className="text-sm text-zinc-400 text-center max-w-xs">
          We sent a verification link to <span className="text-white font-medium">{email}</span>.
          Please verify your email to activate your account.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalView('login')}
          className="mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white transition"
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white text-center">Create Account</h2>

      <ErrorBox message={error} />

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Full Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 pr-10 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition"
            placeholder="Min 12 characters"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs select-none"
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
        {password.length > 0 && (
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
            <Requirement met={checks.minLength} label="12+ characters" />
            <Requirement met={checks.hasUpper} label="Uppercase letter" />
            <Requirement met={checks.hasLower} label="Lowercase letter" />
            <Requirement met={checks.hasNumber} label="Number" />
            <Requirement met={checks.hasSpecial} label="Special character" />
          </ul>
        )}
      </div>

      {/* Account type toggle */}
      <div>
        <label className="block text-sm text-zinc-400 mb-2">Account Type</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAccountType('paper')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              accountType === 'paper'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            Paper Trading
          </button>
          <button
            type="button"
            onClick={() => setAccountType('live')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              accountType === 'live'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            Live Trading
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !isPasswordValid(password)}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm font-semibold text-white transition"
      >
        {isLoading ? 'Creating account...' : 'Create Account'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => setAuthModalView('login')}
          className="text-emerald-400 hover:text-emerald-300 font-medium transition"
        >
          Sign In
        </button>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Forgot Password Form                                              */
/* ------------------------------------------------------------------ */

function ForgotPasswordForm() {
  const { setAuthModalView } = useUIStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiPost('/api/auth/reset-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4 items-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Email Sent</h2>
        <p className="text-sm text-zinc-400 text-center max-w-xs">
          If an account exists for <span className="text-white font-medium">{email}</span>,
          you will receive a password reset link shortly.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalView('login')}
          className="mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white transition"
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white text-center">Reset Password</h2>
      <p className="text-sm text-zinc-400 text-center">
        Enter your email and we'll send you a reset link.
      </p>

      <ErrorBox message={error} />

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm font-semibold text-white transition"
      >
        {loading ? 'Sending...' : 'Send Reset Link'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        <button
          type="button"
          onClick={() => setAuthModalView('login')}
          className="text-emerald-400 hover:text-emerald-300 font-medium transition"
        >
          Back to Login
        </button>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Reset Password Form (when user has a token)                       */
/* ------------------------------------------------------------------ */

function ResetPasswordForm() {
  const { setAuthModalView } = useUIStore();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const checks = checkPassword(password);

  // Extract token from URL
  const token =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('resetToken') ?? ''
      : '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid(password)) {
      setError('Password does not meet all requirements.');
      return;
    }

    setLoading(true);
    try {
      await apiPost('/api/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col gap-4 items-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Password Reset</h2>
        <p className="text-sm text-zinc-400 text-center">
          Your password has been reset successfully.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalView('login')}
          className="mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white transition"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white text-center">Set New Password</h2>

      <ErrorBox message={error} />

      <div>
        <label className="block text-sm text-zinc-400 mb-1">New Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 pr-10 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition"
            placeholder="Min 12 characters"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs select-none"
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
        {password.length > 0 && (
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
            <Requirement met={checks.minLength} label="12+ characters" />
            <Requirement met={checks.hasUpper} label="Uppercase letter" />
            <Requirement met={checks.hasLower} label="Lowercase letter" />
            <Requirement met={checks.hasNumber} label="Number" />
            <Requirement met={checks.hasSpecial} label="Special character" />
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !isPasswordValid(password)}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm font-semibold text-white transition"
      >
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Main AuthModal                                                    */
/* ------------------------------------------------------------------ */

export default function AuthModal() {
  const { authModalOpen, authModalView, closeAuthModal } = useUIStore();

  // Close on Escape
  useEffect(() => {
    if (!authModalOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeAuthModal();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  const viewMap: Record<string, JSX.Element> = {
    login: <LoginForm />,
    signup: <SignupForm />,
    '2fa': <TwoFactorForm />,
    forgot: <ForgotPasswordForm />,
    reset: <ResetPasswordForm />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeAuthModal}
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-zinc-700/50 bg-zinc-900/90 backdrop-blur-xl p-6 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {viewMap[authModalView] ?? <LoginForm />}
      </div>
    </div>
  );
}
