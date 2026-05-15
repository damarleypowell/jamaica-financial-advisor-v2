import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type CSSProperties,
} from 'react';
import { useUIStore } from '../../stores/ui';
import { useAuthStore } from '../../stores/auth';
import { apiPost } from '../../lib/api';
import type { AccountType } from '../../types';

/* ------------------------------------------------------------------ */
/*  Design tokens                                                       */
/* ------------------------------------------------------------------ */

const HEAD  = "'Syne', sans-serif";
const BODY  = "'DM Sans', sans-serif";
const GREEN = '#00e676';
const TEXT  = '#eef4ee';
const MUTED = 'rgba(255,255,255,.38)';
const BORDER = 'rgba(255,255,255,.07)';

/* ------------------------------------------------------------------ */
/*  Password helpers                                                    */
/* ------------------------------------------------------------------ */

interface PasswordCheck {
  minLength: boolean; hasUpper: boolean; hasLower: boolean;
  hasNumber: boolean; hasSpecial: boolean;
}

function checkPassword(pw: string): PasswordCheck {
  return {
    minLength: pw.length >= 12, hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw), hasNumber: /[0-9]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
  };
}
function isPasswordValid(pw: string): boolean {
  const c = checkPassword(pw);
  return c.minLength && c.hasUpper && c.hasLower && c.hasNumber && c.hasSpecial;
}
function pwStrength(pw: string): number {
  if (!pw) return 0;
  const c = checkPassword(pw);
  return ([c.minLength, c.hasUpper, c.hasLower, c.hasNumber, c.hasSpecial].filter(Boolean).length / 5) * 100;
}

/* ------------------------------------------------------------------ */
/*  Shared styles                                                       */
/* ------------------------------------------------------------------ */

const S: Record<string, CSSProperties> = {
  label: { display: 'block', fontSize: 10, fontWeight: 600, color: MUTED, marginBottom: 5, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: BODY },
  input: { width: '100%', height: 44, borderRadius: 12, background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`, fontSize: 14, padding: '0 14px', color: TEXT, outline: 'none', boxSizing: 'border-box', transition: 'border .18s, box-shadow .18s, background .18s', fontFamily: BODY },
  inputFocus: { border: '1.5px solid rgba(0,230,118,.45)', boxShadow: '0 0 0 3px rgba(0,230,118,.06)', background: 'rgba(0,230,118,.025)' },
  inputWrap: { position: 'relative' as const },
  btnGreen: { width: '100%', height: 46, borderRadius: 12, background: GREEN, color: '#030a05', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: BODY, letterSpacing: '0.01em', transition: 'transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s', boxShadow: '0 4px 20px rgba(0,230,118,.28)' },
  link: { background: 'none', border: 'none', color: GREEN, cursor: 'pointer', fontFamily: BODY, fontWeight: 600, fontSize: 12, padding: 0, transition: 'opacity .15s' },
  mutedText: { fontSize: 12, color: MUTED, textAlign: 'center' as const, fontFamily: BODY },
  h2: { fontSize: 22, fontWeight: 800, color: TEXT, margin: 0, lineHeight: 1.15, fontFamily: HEAD, letterSpacing: '-0.025em' },
  sub: { fontSize: 13, color: MUTED, margin: '4px 0 0', fontFamily: BODY },
  stack: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  errBox: { background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.18)', borderLeft: '3px solid #ef4444', borderRadius: 12, padding: '11px 16px', fontSize: 13, color: '#f87171', fontFamily: BODY },
};

/* ------------------------------------------------------------------ */
/*  Micro-components                                                    */
/* ------------------------------------------------------------------ */

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div style={S.errBox}>{msg}</div>;
}

function Field({ style, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { style?: CSSProperties }) {
  const [f, setF] = useState(false);
  return (
    <input {...p}
      style={{ ...S.input, ...(f ? S.inputFocus : {}), ...style }}
      onFocus={e => { setF(true); p.onFocus?.(e); }}
      onBlur={e => { setF(false); p.onBlur?.(e); }}
    />
  );
}

function EyeBtn({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: '.07em', fontFamily: BODY, padding: 0 }}>
      {show ? 'HIDE' : 'SHOW'}
    </button>
  );
}

function StrBar({ pw }: { pw: string }) {
  const pct = pwStrength(pw);
  const col = pct < 40 ? '#ef4444' : pct < 80 ? '#f59e0b' : GREEN;
  return (
    <div style={{ marginTop: 8, height: 3, borderRadius: 99, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 99, transition: 'width .3s, background .3s' }} />
    </div>
  );
}

function PwChecklist({ c }: { c: PasswordCheck }) {
  const items: [boolean, string][] = [[c.minLength,'12+ chars'],[c.hasUpper,'Uppercase'],[c.hasLower,'Lowercase'],[c.hasNumber,'Number'],[c.hasSpecial,'Symbol']];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
      {items.map(([met, label]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: met ? GREEN : MUTED, transition: 'color .2s', fontFamily: BODY }}>
          <span style={{ fontSize: 7 }}>{met ? '●' : '○'}</span>{label}
        </div>
      ))}
    </div>
  );
}

function Done({ icon, title, body, cta, onCta }: { icon: 'email'|'check'; title: string; body: React.ReactNode; cta: string; onCta: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '12px 0' }}>
      <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(0,230,118,.1)' }}>
        {icon === 'email'
          ? <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          : <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        }
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ ...S.h2, fontSize: 22, marginBottom: 10 }}>{title}</h2>
        <p style={{ ...S.sub, maxWidth: 270, margin: '0 auto', lineHeight: 1.65 }}>{body}</p>
      </div>
      <button type="button" onClick={onCta}
        style={{ ...S.btnGreen, width: 'auto', padding: '0 36px' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 32px rgba(0,230,118,.38)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,230,118,.28)'; }}
      >{cta}</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Brand Panel — animated chart + stats                               */
/* ------------------------------------------------------------------ */

function BrandPanel() {
  const pathRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    const raf = requestAnimationFrame(() => {
      path.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(.4,0,.2,1) .3s';
      path.style.strokeDashoffset = '0';
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hidden md:flex" style={{
      flexDirection: 'column', justifyContent: 'space-between',
      padding: '36px 28px',
      background: 'linear-gradient(155deg, #040d06 0%, #071209 55%, #030805 100%)',
      borderRadius: '20px 0 0 20px',
      position: 'relative', overflow: 'hidden',
      width: 260, flexShrink: 0,
    }}>
      {/* Grain */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .045, pointerEvents: 'none' }}>
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,230,118,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,230,118,.025) 1px,transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
      {/* Glow blobs */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,230,118,.14) 0%,transparent 70%)', filter: 'blur(32px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: '20%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,200,80,.09) 0%,transparent 70%)', filter: 'blur(28px)', pointerEvents: 'none' }} />

      {/* Logo + headline */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(0,230,118,.12)', border: '1px solid rgba(0,230,118,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <polyline points="3,17 8,12 13,14 21,7" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="15,7 21,7 21,13" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.16em', color: GREEN, fontFamily: HEAD }}>GOTHAM FINANCIAL</span>
        </div>
        <h1 style={{ fontFamily: HEAD, fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.22, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          Your edge in<br />
          the <span style={{ color: GREEN }}>Jamaica<br />market.</span>
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.38)', margin: 0, fontFamily: BODY, lineHeight: 1.6 }}>
          Professional tools for every JSE investor.
        </p>
      </div>

      {/* Animated chart */}
      <div style={{ position: 'relative', zIndex: 1, margin: '20px 0' }}>
        <svg viewBox="0 0 232 72" fill="none" style={{ width: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity=".14" />
              <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,65 L0,52 C18,47 28,38 48,33 C68,28 78,43 98,35 C118,27 128,17 150,14 C172,11 188,22 210,11 L232,4 L232,72 Z" fill="url(#cg)" />
          <path ref={pathRef} d="M0,52 C18,47 28,38 48,33 C68,28 78,43 98,35 C118,27 128,17 150,14 C172,11 188,22 210,11 L232,4" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <circle cx="232" cy="4" r="3" fill={GREEN} style={{ filter: `drop-shadow(0 0 5px ${GREEN})` }} />
        </svg>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[['NCB','72.50','+2.4%'],['GKC','94.20','+1.8%'],['SCI','58.75','+0.6%']].map(([sym, price, chg]) => (
            <div key={sym} style={{ flex: 1, padding: '7px 8px', borderRadius: 10, background: 'rgba(0,230,118,.05)', border: '1px solid rgba(0,230,118,.1)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.5)', fontFamily: BODY, letterSpacing: '.04em' }}>{sym}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, fontFamily: BODY, marginTop: 2 }}>{price}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, fontFamily: BODY }}>{chg}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[['131+','JSE securities tracked in real-time'],['AI','Powered analysis & market signals'],['Free','Paper trading, zero commissions']].map(([n, l]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 30, borderRadius: 8, background: 'rgba(0,230,118,.07)', border: '1px solid rgba(0,230,118,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: GREEN, fontFamily: HEAD }}>{n}</span>
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', fontFamily: BODY, lineHeight: 1.4 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OAuth — Google (primary) + Apple                                   */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (c: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; context?: string }) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
          prompt: () => void;
        };
      };
    };
    AppleID?: { auth: { init: (c: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void; signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }> } };
  }
}

const GID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const AID = import.meta.env.VITE_APPLE_CLIENT_ID  as string | undefined;

function GoogleButton({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const { loginWithGoogle } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GID) return;

    const mount = () => {
      if (!window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GID,
        callback: async ({ credential }) => {
          try { await loginWithGoogle(credential); onSuccess(); }
          catch (e: unknown) { onError(e instanceof Error ? e.message : 'Google sign-in failed.'); }
        },
        ux_mode: 'popup',
        context: 'signup',
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: containerRef.current.offsetWidth || 360,
        logo_alignment: 'center',
      });
      setReady(true);
    };

    if (window.google) { mount(); return; }
    const t = setInterval(() => { if (window.google) { clearInterval(t); mount(); } }, 60);
    return () => clearInterval(t);
  }, [loginWithGoogle, onSuccess, onError]);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 44 }}>
      {/* Google renders its button into this div */}
      <div ref={containerRef} style={{ width: '100%' }} />
      {/* Loading placeholder while Google script initialises */}
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 44, borderRadius: 12, border: '1.5px solid rgba(0,0,0,.1)', background: '#fff', fontSize: 14, fontWeight: 600, color: '#444', fontFamily: BODY }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin .8s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="#e0e0e0" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Continue with Google
        </div>
      )}
    </div>
  );
}

function OAuthButtons({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const { loginWithApple, isLoading } = useAuthStore();
  const [aReady, setAReady] = useState(false);

  // Apple
  useEffect(() => {
    if (!AID) return;
    if (window.AppleID) { setAReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    s.async = true;
    s.onload = () => { window.AppleID?.auth.init({ clientId: AID, scope: 'name email', redirectURI: window.location.origin, usePopup: true }); setAReady(true); };
    document.head.appendChild(s);
    return () => { if (document.head.contains(s)) document.head.removeChild(s); };
  }, []);

  const handleApple = async () => {
    if (!window.AppleID) return;
    try {
      const r = await window.AppleID.auth.signIn();
      await loginWithApple(r.authorization.id_token, r.user);
      onSuccess();
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'popup_closed_by_user') onError(e.message || 'Apple sign-in failed.');
    }
  };

  const showG = Boolean(GID);
  const showA = Boolean(AID);
  if (!showG && !showA) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {showG && <GoogleButton onSuccess={onSuccess} onError={onError} />}

      {showA && (
        <button type="button" disabled={isLoading || !aReady} onClick={handleApple}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', height: 44, borderRadius: 12, border: 'none', background: '#000', color: '#fff', fontSize: 14, fontWeight: 600, cursor: (isLoading || !aReady) ? 'not-allowed' : 'pointer', fontFamily: BODY, transition: 'all .15s', opacity: (!aReady || isLoading) ? 0.7 : 1 }}
          onMouseEnter={e => { if (aReady && !isLoading) (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#000'; }}
        >
          <svg width="13" height="16" viewBox="0 0 814 1000" fill="white">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-161-39.5c-74 0-103.7 40.8-165.9 40.8s-105-42.3-150.3-107.9L74.1 740.1c-60.9-91.8-91.5-217.8-91.5-217.8s-36.6 178.4 24.6 287.9c12.5 22.9 25.3 45.8 37.5 68.4C93.3 970 178.2 1000 263.5 1000c84 0 159-52.3 212.8-52.3 52.7 0 127.3 54.8 214.7 54.8 85.5 0 170.1-45 225.9-140.4.7-1.2 36.7-61.9 60.7-129.4 4.7-12.7 9.2-25.7 13.2-38.6 5.8-19.1 9.8-38.8 11.6-59.4.7-7.9 1-16.4 1-25.2 0-188.4-168.4-346.8-214.3-368.8zM551.5 5.8C565.7 19.3 634 97.6 634 190.1c0 93.2-75.4 156.8-127.2 189.7-7 4.4-18.7 9.3-29.5 9.3-11.4 0-22.9-5.2-30.8-10.7C410 361.7 351 291 351 190.1c0-100.6 69.4-177.8 89-190.1 5-3.2 11.5-5 18.4-5 6.8 0 13.3 1.8 18.4 5l74.7 5.8z"/>
          </svg>
          Continue with Apple
        </button>
      )}
    </div>
  );
}

function OrDivider({ label = 'or continue with email' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', whiteSpace: 'nowrap', fontFamily: BODY, letterSpacing: '.04em' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login Form                                                          */
/* ------------------------------------------------------------------ */

function LoginForm() {
  const { login, isLoading } = useAuthStore();
  const { closeAuthModal, setAuthModalView } = useUIStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [hov, setHov] = useState(false);

  const onOAuthOk  = useCallback(() => closeAuthModal(), [closeAuthModal]);
  const onOAuthErr = useCallback((m: string) => setErr(m), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try {
      const res = await login(email, pw);
      if (res.requires2FA) { sessionStorage.setItem('jse_temp_token', res.tempToken ?? ''); setAuthModalView('2fa'); }
      else closeAuthModal();
    } catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Login failed.'); }
  };

  return (
    <form onSubmit={submit} style={S.stack}>
      <div>
        <h2 style={S.h2}>Welcome back</h2>
        <p style={S.sub}>Sign in to your Gotham account</p>
      </div>

      <Err msg={err} />

      {/* OAuth first — primary CTA */}
      <OAuthButtons onSuccess={onOAuthOk} onError={onOAuthErr} />
      <OrDivider />

      <div>
        <label style={S.label}>Email</label>
        <Field type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </div>

      <div>
        <label style={S.label}>Password</label>
        <div style={S.inputWrap}>
          <Field type={show ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter your password" autoComplete="current-password" style={{ paddingRight: 62 }} />
          <EyeBtn show={show} onToggle={() => setShow(!show)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={() => setAuthModalView('forgot')} style={{ ...S.link, fontSize: 12 }}>Forgot password?</button>
        </div>
      </div>

      <button type="submit" disabled={isLoading}
        style={{ ...S.btnGreen, opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'pointer', transform: hov && !isLoading ? 'translateY(-2px)' : '', boxShadow: hov && !isLoading ? '0 10px 32px rgba(0,230,118,.38)' : '0 4px 24px rgba(0,230,118,.28)' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      >{isLoading ? 'Signing in…' : 'Sign In'}</button>

      <p style={S.mutedText}>
        No account?{' '}
        <button type="button" onClick={() => setAuthModalView('signup')} style={S.link}>Create one free</button>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Signup Form                                                         */
/* ------------------------------------------------------------------ */

function SignupForm() {
  const { signup, isLoading } = useAuthStore();
  const { setAuthModalView, closeAuthModal } = useUIStore();
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw]       = useState('');
  const [show, setShow]   = useState(false);
  const [acct, setAcct]   = useState<AccountType>('paper');
  const [err, setErr]     = useState('');
  const [ok, setOk]       = useState(false);
  const [hov, setHov]     = useState(false);
  const checks = checkPassword(pw);

  const onOAuthOk  = useCallback(() => closeAuthModal(), [closeAuthModal]);
  const onOAuthErr = useCallback((m: string) => setErr(m), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!isPasswordValid(pw)) { setErr('Password does not meet all requirements.'); return; }
    try { await signup(name, email, pw, acct); setOk(true); }
    catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Signup failed.'); }
  };

  if (ok) return (
    <Done icon="email" title="Check your email"
      body={<>We sent a verification link to <strong style={{ color: TEXT }}>{email}</strong>. Verify to activate your account.</>}
      cta="Back to Login" onCta={() => setAuthModalView('login')} />
  );

  const dis = isLoading || !isPasswordValid(pw);

  return (
    <form onSubmit={submit} style={S.stack}>
      <div>
        <h2 style={S.h2}>Create your account</h2>
        <p style={S.sub}>Free forever — start in under a minute</p>
      </div>

      <Err msg={err} />

      {/* OAuth first */}
      <OAuthButtons onSuccess={onOAuthOk} onError={onOAuthErr} />
      <OrDivider label="or sign up with email" />

      <div>
        <label style={S.label}>Full Name</label>
        <Field type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" autoComplete="name" />
      </div>

      <div>
        <label style={S.label}>Email</label>
        <Field type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </div>

      <div>
        <label style={S.label}>Password</label>
        <div style={S.inputWrap}>
          <Field type={show ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 12 characters" autoComplete="new-password" style={{ paddingRight: 62 }} />
          <EyeBtn show={show} onToggle={() => setShow(!show)} />
        </div>
        {pw.length > 0 && <><StrBar pw={pw} /><PwChecklist c={checks} /></>}
      </div>

      <div>
        <label style={S.label}>Account Type</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['paper', 'live'] as AccountType[]).map(t => {
            const active = acct === t;
            return (
              <button key={t} type="button" onClick={() => setAcct(t)}
                style={{ height: 40, borderRadius: 10, border: active ? '1.5px solid rgba(0,230,118,.45)' : `1px solid ${BORDER}`, background: active ? 'rgba(0,230,118,.09)' : 'rgba(255,255,255,.025)', color: active ? GREEN : MUTED, fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer', transition: 'all .18s', fontFamily: BODY }}>
                {t === 'paper' ? '📄 Paper Trading' : '⚡ Live Trading'}
              </button>
            );
          })}
        </div>
      </div>

      <button type="submit" disabled={dis}
        style={{ ...S.btnGreen, opacity: dis ? 0.45 : 1, cursor: dis ? 'not-allowed' : 'pointer', transform: hov && !dis ? 'translateY(-2px)' : '', boxShadow: hov && !dis ? '0 10px 32px rgba(0,230,118,.38)' : '0 4px 24px rgba(0,230,118,.28)' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      >{isLoading ? 'Creating account…' : 'Create Account'}</button>

      <p style={S.mutedText}>
        Already have an account?{' '}
        <button type="button" onClick={() => setAuthModalView('login')} style={S.link}>Sign In</button>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  2FA Form                                                            */
/* ------------------------------------------------------------------ */

function TwoFactorForm() {
  const { verify2FA, isLoading } = useAuthStore();
  const { closeAuthModal, setAuthModalView } = useUIStore();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [err, setErr] = useState('');
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const submit = useCallback(async (code: string) => {
    setErr('');
    try {
      await verify2FA(code, sessionStorage.getItem('jse_temp_token') ?? '');
      sessionStorage.removeItem('jse_temp_token');
      closeAuthModal();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Invalid code.');
      setDigits(Array(6).fill('')); refs.current[0]?.focus();
    }
  }, [verify2FA, closeAuthModal]);

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const next = [...digits]; next[i] = v.slice(-1); setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    const code = next.join('');
    if (code.length === 6 && next.every(d => d)) submit(code);
  };

  const handleKey = (i: number, e: ReactKeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!p) return;
    const next = Array(6).fill('');
    for (let i = 0; i < p.length; i++) next[i] = p[i];
    setDigits(next);
    if (p.length === 6) submit(p);
    else refs.current[p.length]?.focus();
  };

  useEffect(() => { refs.current[0]?.focus(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,230,118,.09)', border: '1px solid rgba(0,230,118,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={1.8}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ ...S.h2, fontSize: 22 }}>Two-factor auth</h2>
        <p style={{ ...S.sub, marginTop: 5 }}>Enter the 6-digit code from your authenticator app</p>
      </div>
      <Err msg={err} />
      <div style={{ display: 'flex', gap: 8 }} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input key={i} ref={el => { refs.current[i] = el; }}
            type="text" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            onFocus={e => { (e.target as HTMLInputElement).style.border = '1.5px solid rgba(0,230,118,.5)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(0,230,118,.09)'; }}
            onBlur={e => { (e.target as HTMLInputElement).style.border = d ? '1px solid rgba(0,230,118,.25)' : `1px solid ${BORDER}`; (e.target as HTMLInputElement).style.boxShadow = ''; }}
            style={{ width: 50, height: 56, borderRadius: 12, background: 'rgba(255,255,255,.04)', border: d ? '1px solid rgba(0,230,118,.25)' : `1px solid ${BORDER}`, textAlign: 'center', fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: TEXT, outline: 'none', transition: 'border .18s, box-shadow .18s', cursor: 'text' }}
          />
        ))}
      </div>
      {isLoading && <p style={{ fontSize: 13, color: MUTED, fontFamily: BODY }}>Verifying…</p>}
      <button type="button" onClick={() => setAuthModalView('login')} style={S.link}>← Back to login</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Forgot Password                                                     */
/* ------------------------------------------------------------------ */

function ForgotForm() {
  const { setAuthModalView } = useUIStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [hov, setHov] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try { await apiPost('/api/auth/reset-password', { email }); setSent(true); }
    catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Failed to send reset email.'); }
    finally { setLoading(false); }
  };

  if (sent) return (
    <Done icon="email" title="Email sent"
      body={<>If an account exists for <strong style={{ color: TEXT }}>{email}</strong>, you'll receive a reset link shortly.</>}
      cta="Back to Login" onCta={() => setAuthModalView('login')} />
  );

  return (
    <form onSubmit={submit} style={S.stack}>
      <div>
        <h2 style={S.h2}>Reset password</h2>
        <p style={S.sub}>We'll send a reset link to your email.</p>
      </div>
      <Err msg={err} />
      <div>
        <label style={S.label}>Email</label>
        <Field type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </div>
      <button type="submit" disabled={loading}
        style={{ ...S.btnGreen, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', transform: hov && !loading ? 'translateY(-2px)' : '', boxShadow: hov && !loading ? '0 10px 32px rgba(0,230,118,.38)' : '0 4px 24px rgba(0,230,118,.28)' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      >{loading ? 'Sending…' : 'Send Reset Link'}</button>
      <p style={S.mutedText}><button type="button" onClick={() => setAuthModalView('login')} style={S.link}>← Back to Login</button></p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Reset Password                                                      */
/* ------------------------------------------------------------------ */

function ResetForm() {
  const { setAuthModalView } = useUIStore();
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [hov, setHov] = useState(false);
  const checks = checkPassword(pw);
  const token = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('resetToken') ?? '' : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!isPasswordValid(pw)) { setErr('Password does not meet requirements.'); return; }
    setLoading(true);
    try { await apiPost('/api/auth/reset-password', { token, password: pw }); setOk(true); }
    catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Failed to reset password.'); }
    finally { setLoading(false); }
  };

  if (ok) return <Done icon="check" title="Password reset" body="Your password has been reset. You can now sign in." cta="Sign In" onCta={() => setAuthModalView('login')} />;
  const dis = loading || !isPasswordValid(pw);

  return (
    <form onSubmit={submit} style={S.stack}>
      <div>
        <h2 style={S.h2}>Set new password</h2>
        <p style={S.sub}>Choose a strong password for your account.</p>
      </div>
      <Err msg={err} />
      <div>
        <label style={S.label}>New Password</label>
        <div style={S.inputWrap}>
          <Field type={show ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 12 characters" autoComplete="new-password" style={{ paddingRight: 62 }} />
          <EyeBtn show={show} onToggle={() => setShow(!show)} />
        </div>
        {pw.length > 0 && <><StrBar pw={pw} /><PwChecklist c={checks} /></>}
      </div>
      <button type="submit" disabled={dis}
        style={{ ...S.btnGreen, opacity: dis ? 0.45 : 1, cursor: dis ? 'not-allowed' : 'pointer', transform: hov && !dis ? 'translateY(-2px)' : '', boxShadow: hov && !dis ? '0 10px 32px rgba(0,230,118,.38)' : '0 4px 24px rgba(0,230,118,.28)' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      >{loading ? 'Resetting…' : 'Reset Password'}</button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Close button                                                        */
/* ------------------------------------------------------------------ */

function CloseBtn({ onClose }: { onClose: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClose} aria-label="Close"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', border: `1px solid ${BORDER}`, background: hov ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background .15s', color: MUTED, zIndex: 10 }}>
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main AuthModal                                                      */
/* ------------------------------------------------------------------ */

export default function AuthModal() {
  const { authModalOpen, authModalView, closeAuthModal } = useUIStore();
  const hasBrand = authModalView === 'login' || authModalView === 'signup';

  useEffect(() => {
    if (!authModalOpen) return;
    const h = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') closeAuthModal(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  const views: Record<string, React.ReactElement> = {
    login: <LoginForm />, signup: <SignupForm />,
    '2fa': <TwoFactorForm />, forgot: <ForgotForm />, reset: <ResetForm />,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Backdrop */}
      <div onClick={closeAuthModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', borderRadius: 22,
        border: '1px solid rgba(255,255,255,.08)',
        background: '#0d1610',
        boxShadow: '0 32px 96px rgba(0,0,0,.85), 0 0 0 1px rgba(0,230,118,.04), inset 0 1px 0 rgba(255,255,255,.04)',
        overflow: 'hidden', width: '100%',
        maxWidth: hasBrand ? 740 : 420,
        maxHeight: 'calc(100vh - 32px)',
        animation: 'modalIn .24s cubic-bezier(.16,1,.3,1)',
      }}>
        {hasBrand && <BrandPanel />}

        {/* Form pane */}
        <div style={{ flex: 1, padding: '32px 30px', overflowY: 'auto', position: 'relative', minWidth: 0 }}>
          <CloseBtn onClose={closeAuthModal} />
          {views[authModalView] ?? <LoginForm />}
        </div>
      </div>
    </div>
  );
}
