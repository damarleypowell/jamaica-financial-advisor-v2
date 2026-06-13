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

/* ── Tokens ─────────────────────────────────────────────────────────── */
const HEAD  = "'Syne', sans-serif";
const BODY  = "'Inter', sans-serif";

// Brand panel (dark)
const PANEL = '#060D07';

// Form panel (white)
const WHITE  = '#FFFFFF';
const INK    = '#111827';
const SUB    = '#6B7280';
const GREEN  = '#00C853';
const LGREEN = 'rgba(0,200,83,.12)';
const BORDER = '#E5E7EB';
const FIELD  = '#F9FAFB';
const FDARK  = '#00C853';   // green CTA

/* ── Password helpers ───────────────────────────────────────────────── */
interface PwCheck { len: boolean; up: boolean; lo: boolean; num: boolean; sym: boolean }
const chkPw = (p: string): PwCheck => ({
  len: p.length >= 12, up: /[A-Z]/.test(p), lo: /[a-z]/.test(p),
  num: /[0-9]/.test(p), sym: /[^A-Za-z0-9]/.test(p),
});
const pwOk = (p: string) => { const c = chkPw(p); return c.len && c.up && c.lo && c.num && c.sym; };
const pwStrength = (p: string) => {
  if (!p) return 0;
  const c = chkPw(p);
  return ([c.len, c.up, c.lo, c.num, c.sym].filter(Boolean).length / 5) * 100;
};

/* ── Shared styles ──────────────────────────────────────────────────── */
const S: Record<string, CSSProperties> = {
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: SUB, marginBottom: 6, fontFamily: BODY },
  input: { width: '100%', height: 44, borderRadius: 10, background: FIELD, border: `1.5px solid ${BORDER}`, fontSize: 14, padding: '0 14px', color: INK, outline: 'none', boxSizing: 'border-box', transition: 'border .15s, box-shadow .15s, background .15s', fontFamily: BODY },
  inputFocus: { border: `1.5px solid rgba(0,200,83,.6)`, boxShadow: '0 0 0 3px rgba(0,200,83,.12)', background: WHITE },
  inputWrap: { position: 'relative' as const },
  btnDark: { width: '100%', height: 44, borderRadius: 10, background: FDARK, color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', fontFamily: BODY, letterSpacing: '.01em', transition: 'transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s, opacity .15s' },
  link: { background: 'none', border: 'none', color: GREEN, cursor: 'pointer', fontFamily: BODY, fontWeight: 600, fontSize: 13, padding: 0, transition: 'opacity .15s' },
  mutedText: { fontSize: 13, color: SUB, textAlign: 'center' as const, fontFamily: BODY },
  h2: { fontSize: 24, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.18, fontFamily: HEAD, letterSpacing: '-0.005em', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' },
  sub: { fontSize: 13, color: SUB, margin: '5px 0 0', fontFamily: BODY, lineHeight: 1.5 },
  stack: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  errBox: { background: 'rgba(220,38,38,.06)', border: '1.5px solid rgba(220,38,38,.18)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#b91c1c', fontFamily: BODY, display: 'flex', alignItems: 'center', gap: 8 },
};

/* ── Micro-components ───────────────────────────────────────────────── */
function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={S.errBox}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {msg}
    </div>
  );
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
      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: SUB, fontSize: 11, fontWeight: 700, letterSpacing: '.07em', fontFamily: BODY, padding: '4px 6px', borderRadius: 6, transition: 'background .12s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = FIELD; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
    >{show ? 'HIDE' : 'SHOW'}</button>
  );
}

function StrBar({ pw }: { pw: string }) {
  const pct = pwStrength(pw);
  const col = pct < 40 ? '#ef4444' : pct < 80 ? '#f59e0b' : GREEN;
  const label = pct < 40 ? 'Weak' : pct < 80 ? 'Fair' : 'Strong';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 3, borderRadius: 99, background: '#EAF0EB', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 99, transition: 'width .3s, background .3s' }} />
      </div>
      <div style={{ fontSize: 11, color: col, marginTop: 4, fontFamily: BODY, fontWeight: 600 }}>{pw ? label : ''}</div>
    </div>
  );
}

function PwChecklist({ c }: { c: PwCheck }) {
  const items: [boolean, string][] = [[c.len,'12+ chars'],[c.up,'Uppercase'],[c.lo,'Lowercase'],[c.num,'Number'],[c.sym,'Symbol']];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 16px', marginTop: 8 }}>
      {items.map(([met, label]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: met ? GREEN : '#AABCAC', transition: 'color .2s', fontFamily: BODY, fontWeight: met ? 600 : 400 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            {met
              ? <><circle cx="6" cy="6" r="6" fill={GREEN} /><path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>
              : <circle cx="6" cy="6" r="5.5" stroke="#D0DDD2" />
            }
          </svg>
          {label}
        </div>
      ))}
    </div>
  );
}

function Done({ icon, title, body, cta, onCta }: { icon: 'email'|'check'; title: string; body: React.ReactNode; cta: string; onCta: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '8px 0' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: LGREEN, border: `1.5px solid rgba(0,200,83,.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon === 'email'
          ? <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          : <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        }
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ ...S.h2, marginBottom: 10 }}>{title}</h2>
        <p style={{ ...S.sub, maxWidth: 280, margin: '0 auto', lineHeight: 1.7 }}>{body}</p>
      </div>
      <button type="button" onClick={onCta}
        style={{ ...S.btnDark, width: 'auto', padding: '0 40px', height: 46 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,200,83,.35)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
      >{cta}</button>
    </div>
  );
}

/* ── Brand Panel ────────────────────────────────────────────────────── */
function BrandPanel() {
  const pathRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    const path = pathRef.current; if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    const raf = requestAnimationFrame(() => {
      path.style.transition = 'stroke-dashoffset 2s cubic-bezier(.4,0,.2,1) .4s';
      path.style.strokeDashoffset = '0';
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hidden md:flex" style={{
      flexDirection: 'column', justifyContent: 'space-between',
      padding: '36px 28px', background: PANEL,
      borderRadius: '20px 0 0 20px',
      position: 'relative', overflow: 'hidden',
      width: 272, flexShrink: 0,
    }}>
      {/* Grain */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .055, pointerEvents: 'none' }}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      {/* Subtle grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,200,83,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,83,.018) 1px,transparent 1px)', backgroundSize: '30px 30px', pointerEvents: 'none' }} />
      {/* Glow */}
      <div style={{ position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,200,83,.13) 0%,transparent 68%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -40, left: '10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,180,60,.08) 0%,transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 32 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(0,200,83,.13)', border: '1px solid rgba(0,200,83,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <polyline points="3,17 8,12 13,14 21,7" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="15,7 21,7 21,13" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.22em', color: GREEN, fontFamily: HEAD, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>GOTHAM FINANCIAL</span>
        </div>

        <h1 style={{ fontFamily: HEAD, fontSize: 24, fontWeight: 700, color: '#F0F6F1', lineHeight: 1.16, margin: '0 0 12px', letterSpacing: '-0.005em', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' }}>
          Your edge in<br />
          the <span style={{ color: GREEN }}>Caribbean<br />market.</span>
        </h1>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.35)', margin: 0, fontFamily: BODY, lineHeight: 1.65 }}>
          AI-powered tools for every Caribbean investor. JSE, TTSE, ECSE and beyond.
        </p>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative', zIndex: 1, margin: '24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', fontFamily: BODY, letterSpacing: '.04em' }}>PORTFOLIO</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, fontFamily: BODY }}>+12.4%</span>
        </div>
        <svg viewBox="0 0 232 64" fill="none" style={{ width: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity=".18" />
              <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,58 L0,48 C20,43 30,35 50,30 C70,25 80,40 100,32 C120,24 130,14 152,11 C174,8 190,20 212,9 L232,3 L232,64 Z" fill="url(#cg2)" />
          <path ref={pathRef} d="M0,48 C20,43 30,35 50,30 C70,25 80,40 100,32 C120,24 130,14 152,11 C174,8 190,20 212,9 L232,3" stroke={GREEN} strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="232" cy="3" r="3.5" fill={GREEN} style={{ filter: `drop-shadow(0 0 6px ${GREEN})` }} />
        </svg>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[['NCB','72.50','+2.4%'],['GKC','94.20','+1.8%'],['SCI','58.75','+0.6%']].map(([sym, price, chg]) => (
            <div key={sym} style={{ flex: 1, padding: '8px 8px', borderRadius: 10, background: 'rgba(0,200,83,.06)', border: '1px solid rgba(0,200,83,.12)' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.4)', fontFamily: BODY, letterSpacing: '.05em' }}>{sym}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#EEF5EF', fontFamily: BODY, marginTop: 2 }}>{price}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, fontFamily: BODY }}>{chg}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['150+', 'Caribbean securities tracked live'],
          ['AI', 'Market analysis & smart signals'],
          ['Free', 'Paper trading, zero commissions'],
        ].map(([n, l]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 28, borderRadius: 8, background: 'rgba(0,200,83,.08)', border: '1px solid rgba(0,200,83,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: GREEN, fontFamily: HEAD }}>{n}</span>
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.38)', fontFamily: BODY, lineHeight: 1.4 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── OAuth ──────────────────────────────────────────────────────────── */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (c: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
          prompt: (cb?: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (c: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
        signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }>;
      };
    };
  }
}

const GID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const AID = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;

function SocialBtn({
  onClick, disabled, children, style,
}: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; style?: CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        width: '100%', height: 44, borderRadius: 10,
        border: `1.5px solid ${hov ? '#D1D5DB' : BORDER}`,
        background: hov ? '#F3F4F6' : WHITE,
        color: INK, fontSize: 14, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: BODY, transition: 'all .15s',
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >{children}</button>
  );
}

function GoogleOAuth({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const { loginWithGoogle } = useAuthStore();
  const [ready, setReady] = useState(false);
  const gsiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GID) return;
    const init = () => {
      if (!window.google || !gsiRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GID,
        callback: async ({ credential }) => {
          try { await loginWithGoogle(credential); onSuccess(); }
          catch (e: unknown) { onError(e instanceof Error ? e.message : 'Google sign-in failed.'); }
        },
        ux_mode: 'popup',
      });
      window.google.accounts.id.renderButton(gsiRef.current, {
        theme: 'outline', size: 'large', text: 'continue_with',
      });
      setReady(true);
    };
    if (window.google) { init(); return; }
    const t = setInterval(() => { if (window.google) { clearInterval(t); init(); } }, 80);
    return () => clearInterval(t);
  }, [loginWithGoogle, onSuccess, onError]);

  const handleClick = () => {
    const btn = gsiRef.current?.querySelector('div[role="button"]') as HTMLElement | null;
    if (btn) { btn.click(); return; }
    window.google?.accounts.id.prompt();
  };

  if (!GID) return null;

  return (
    <>
      <div ref={gsiRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1, overflow: 'hidden' }} />
      <SocialBtn onClick={handleClick} disabled={!ready}>
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </SocialBtn>
    </>
  );
}

function AppleOAuth({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const { loginWithApple } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!AID) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.AppleID) { setReady(true); return; } // SDK already present
    const s = document.createElement('script');
    s.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    s.async = true;
    s.onload = () => {
      window.AppleID?.auth.init({ clientId: AID, scope: 'name email', redirectURI: window.location.origin, usePopup: true });
      setReady(true);
    };
    document.head.appendChild(s);
    return () => { if (document.head.contains(s)) document.head.removeChild(s); };
  }, []);

  const handleClick = async () => {
    if (!window.AppleID) return;
    try {
      const r = await window.AppleID.auth.signIn();
      await loginWithApple(r.authorization.id_token, r.user);
      onSuccess();
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'popup_closed_by_user') {
        onError(e.message || 'Apple sign-in failed.');
      }
    }
  };

  if (!AID) return null;

  return (
    <SocialBtn onClick={handleClick} disabled={!ready} style={{ background: '#000', color: '#fff', border: '1.5px solid #000' }}>
      <svg width="14" height="17" viewBox="0 0 814 1000" fill="white">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-161-39.5c-74 0-103.7 40.8-165.9 40.8s-105-42.3-150.3-107.9L74.1 740.1c-60.9-91.8-91.5-217.8-91.5-217.8s-36.6 178.4 24.6 287.9c12.5 22.9 25.3 45.8 37.5 68.4C93.3 970 178.2 1000 263.5 1000c84 0 159-52.3 212.8-52.3 52.7 0 127.3 54.8 214.7 54.8 85.5 0 170.1-45 225.9-140.4.7-1.2 36.7-61.9 60.7-129.4 4.7-12.7 9.2-25.7 13.2-38.6 5.8-19.1 9.8-38.8 11.6-59.4.7-7.9 1-16.4 1-25.2 0-188.4-168.4-346.8-214.3-368.8zM551.5 5.8C565.7 19.3 634 97.6 634 190.1c0 93.2-75.4 156.8-127.2 189.7-7 4.4-18.7 9.3-29.5 9.3-11.4 0-22.9-5.2-30.8-10.7C410 361.7 351 291 351 190.1c0-100.6 69.4-177.8 89-190.1 5-3.2 11.5-5 18.4-5 6.8 0 13.3 1.8 18.4 5l74.7 5.8z"/>
      </svg>
      Continue with Apple
    </SocialBtn>
  );
}

function OrDivider({ label = 'or continue with email' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
      <span style={{ fontSize: 11.5, color: '#AABCAC', whiteSpace: 'nowrap', fontFamily: BODY, letterSpacing: '.04em' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

function OAuthSection({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const hasOAuth = Boolean(GID || AID);
  if (!hasOAuth) return null;
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <GoogleOAuth onSuccess={onSuccess} onError={onError} />
        <AppleOAuth onSuccess={onSuccess} onError={onError} />
      </div>
      <OrDivider />
    </>
  );
}

/* ── Login ──────────────────────────────────────────────────────────── */
function LoginForm() {
  const { login, isLoading } = useAuthStore();
  const { closeAuthModal, setAuthModalView } = useUIStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [hov, setHov] = useState(false);

  const onOk  = useCallback(() => closeAuthModal(), [closeAuthModal]);
  const onErr = useCallback((m: string) => setErr(m), []);

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

      <OAuthSection onSuccess={onOk} onError={onErr} />
      <Err msg={err} />

      <div>
        <label style={S.label}>Email address</label>
        <Field type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ ...S.label, marginBottom: 0 }}>Password</label>
          <button type="button" onClick={() => setAuthModalView('forgot')} style={{ ...S.link, fontSize: 12, color: SUB }}>Forgot password?</button>
        </div>
        <div style={S.inputWrap}>
          <Field type={show ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter your password" autoComplete="current-password" style={{ paddingRight: 70 }} />
          <EyeBtn show={show} onToggle={() => setShow(!show)} />
        </div>
      </div>

      <button type="submit" disabled={isLoading}
        style={{ ...S.btnDark, opacity: isLoading ? 0.65 : 1, cursor: isLoading ? 'not-allowed' : 'pointer', transform: hov && !isLoading ? 'translateY(-2px)' : '', boxShadow: hov && !isLoading ? '0 8px 28px rgba(0,200,83,.35)' : 'none' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      >{isLoading ? 'Signing in…' : 'Sign In'}</button>

      <p style={S.mutedText}>
        New to Gotham?{' '}
        <button type="button" onClick={() => setAuthModalView('signup')} style={S.link}>Create a free account</button>
      </p>
    </form>
  );
}

/* ── Signup ─────────────────────────────────────────────────────────── */
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
  const checks = chkPw(pw);

  const onOk  = useCallback(() => closeAuthModal(), [closeAuthModal]);
  const onErr = useCallback((m: string) => setErr(m), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!pwOk(pw)) { setErr('Password does not meet all requirements.'); return; }
    try { await signup(name, email, pw, acct); setOk(true); }
    catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Signup failed.'); }
  };

  if (ok) return (
    <Done icon="check" title="You're all set!"
      body={<>Welcome to Gotham. We've emailed a verification link to <strong style={{ color: INK }}>{email}</strong> — but you can start right now. Verify any time from Settings.</>}
      cta="Start exploring" onCta={() => closeAuthModal()} />
  );

  const dis = isLoading || !pwOk(pw);

  return (
    <form onSubmit={submit} style={S.stack}>
      <div>
        <h2 style={S.h2}>Create your account</h2>
        <p style={S.sub}>Free forever — start in under a minute</p>
      </div>

      <OAuthSection onSuccess={onOk} onError={onErr} />
      <Err msg={err} />

      <div>
        <label style={S.label}>Full Name</label>
        <Field type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" autoComplete="name" />
      </div>

      <div>
        <label style={S.label}>Email address</label>
        <Field type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </div>

      <div>
        <label style={S.label}>Password</label>
        <div style={S.inputWrap}>
          <Field type={show ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 12 characters" autoComplete="new-password" style={{ paddingRight: 70 }} />
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
                style={{ height: 44, borderRadius: 10, border: active ? `1.5px solid rgba(0,200,83,.55)` : `1.5px solid ${BORDER}`, background: active ? 'rgba(0,200,83,.08)' : FIELD, color: active ? '#067D38' : SUB, fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all .15s', fontFamily: BODY }}>
                {t === 'paper' ? '📄 Paper Trading' : '⚡ Live Trading'}
              </button>
            );
          })}
        </div>
      </div>

      <button type="submit" disabled={dis}
        style={{ ...S.btnDark, opacity: dis ? 0.4 : 1, cursor: dis ? 'not-allowed' : 'pointer', transform: hov && !dis ? 'translateY(-2px)' : '', boxShadow: hov && !dis ? '0 8px 28px rgba(0,200,83,.35)' : 'none' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      >{isLoading ? 'Creating account…' : 'Create Account'}</button>

      <p style={S.mutedText}>
        Already have an account?{' '}
        <button type="button" onClick={() => setAuthModalView('login')} style={S.link}>Sign In</button>
      </p>

      <p style={{ ...S.mutedText, fontSize: 11, lineHeight: 1.6, color: '#AAB8AC' }}>
        By creating an account you agree to our Terms of Service. AI-generated content is educational and not financial advice — do your own research before making any financial decisions.
      </p>
    </form>
  );
}

/* ── 2FA ────────────────────────────────────────────────────────────── */
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
  const handleKey = (i: number, e: ReactKeyboardEvent) => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); };
  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!p) return;
    const next = Array(6).fill(''); for (let i = 0; i < p.length; i++) next[i] = p[i];
    setDigits(next); if (p.length === 6) submit(p); else refs.current[p.length]?.focus();
  };
  useEffect(() => { refs.current[0]?.focus(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: LGREEN, border: `1.5px solid rgba(0,200,83,.22)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={1.8}>
          <rect x="3" y="11" width="18" height="11" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ ...S.h2, fontSize: 22 }}>Two-factor auth</h2>
        <p style={{ ...S.sub, marginTop: 6 }}>Enter the 6-digit code from your authenticator app</p>
      </div>
      <Err msg={err} />
      <div style={{ display: 'flex', gap: 8 }} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input key={i} ref={el => { refs.current[i] = el; }}
            type="text" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKey(i, e)}
            onFocus={e => { (e.target as HTMLInputElement).style.border = `1.5px solid rgba(0,200,83,.55)`; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(0,200,83,.1)'; }}
            onBlur={e => { (e.target as HTMLInputElement).style.border = d ? `1.5px solid rgba(0,200,83,.35)` : `1.5px solid ${BORDER}`; (e.target as HTMLInputElement).style.boxShadow = ''; }}
            style={{ width: 50, height: 56, borderRadius: 10, background: FIELD, border: d ? `1.5px solid rgba(0,200,83,.35)` : `1.5px solid ${BORDER}`, textAlign: 'center', fontSize: 22, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", color: INK, outline: 'none', transition: 'border .15s, box-shadow .15s', cursor: 'text' }}
          />
        ))}
      </div>
      {isLoading && <p style={{ fontSize: 13, color: SUB, fontFamily: BODY }}>Verifying…</p>}
      <button type="button" onClick={() => setAuthModalView('login')} style={{ ...S.link, color: SUB, fontSize: 13 }}>← Back to login</button>
    </div>
  );
}

/* ── Forgot Password ─────────────────────────────────────────────────── */
function ForgotForm() {
  const { setAuthModalView } = useUIStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [hov, setHov] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try { await apiPost('/api/auth/forgot-password', { email }); setSent(true); }
    catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Failed to send reset email.'); }
    finally { setLoading(false); }
  };

  if (sent) return (
    <Done icon="email" title="Check your inbox"
      body={<>If an account exists for <strong style={{ color: INK }}>{email}</strong>, you'll get a reset link shortly.</>}
      cta="Back to Sign In" onCta={() => setAuthModalView('login')} />
  );

  return (
    <form onSubmit={submit} style={S.stack}>
      <div>
        <h2 style={S.h2}>Forgot password?</h2>
        <p style={S.sub}>We'll send a secure reset link to your email.</p>
      </div>
      <Err msg={err} />
      <div>
        <label style={S.label}>Email address</label>
        <Field type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </div>
      <button type="submit" disabled={loading}
        style={{ ...S.btnDark, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', transform: hov && !loading ? 'translateY(-2px)' : '', boxShadow: hov && !loading ? '0 8px 28px rgba(0,200,83,.35)' : 'none' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      >{loading ? 'Sending…' : 'Send Reset Link'}</button>
      <p style={S.mutedText}><button type="button" onClick={() => setAuthModalView('login')} style={{ ...S.link, color: SUB }}>← Back to Sign In</button></p>
    </form>
  );
}

/* ── Reset Password ──────────────────────────────────────────────────── */
function ResetForm() {
  const { setAuthModalView } = useUIStore();
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [hov, setHov] = useState(false);
  const checks = chkPw(pw);
  const token = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('resetToken') ?? '' : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!pwOk(pw)) { setErr('Password does not meet requirements.'); return; }
    setLoading(true);
    try { await apiPost('/api/auth/reset-password', { token, password: pw }); setOk(true); }
    catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Failed to reset password.'); }
    finally { setLoading(false); }
  };

  if (ok) return <Done icon="check" title="Password reset" body="Your password has been updated. You can now sign in with your new password." cta="Sign In" onCta={() => setAuthModalView('login')} />;

  const dis = loading || !pwOk(pw);
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
          <Field type={show ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 12 characters" autoComplete="new-password" style={{ paddingRight: 70 }} />
          <EyeBtn show={show} onToggle={() => setShow(!show)} />
        </div>
        {pw.length > 0 && <><StrBar pw={pw} /><PwChecklist c={checks} /></>}
      </div>
      <button type="submit" disabled={dis}
        style={{ ...S.btnDark, opacity: dis ? 0.4 : 1, cursor: dis ? 'not-allowed' : 'pointer', transform: hov && !dis ? 'translateY(-2px)' : '', boxShadow: hov && !dis ? '0 8px 28px rgba(0,200,83,.35)' : 'none' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      >{loading ? 'Resetting…' : 'Reset Password'}</button>
    </form>
  );
}

/* ── Close Button ────────────────────────────────────────────────────── */
function CloseBtn({ onClose, dark }: { onClose: () => void; dark?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClose} aria-label="Close"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%',
        border: dark ? '1px solid rgba(255,255,255,.1)' : `1px solid ${BORDER}`,
        background: hov ? (dark ? 'rgba(255,255,255,.08)' : '#F2F6F3') : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'background .15s', zIndex: 10,
        color: dark ? 'rgba(255,255,255,.5)' : SUB,
      }}>
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

/* ── AuthModal ───────────────────────────────────────────────────────── */
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
        @keyframes modalIn { from { opacity:0; transform:scale(.96) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
      `}</style>

      {/* Backdrop */}
      <div onClick={closeAuthModal} style={{ position: 'absolute', inset: 0, background: 'rgba(6,13,7,.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', animation: 'fadeIn .2s ease' }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', borderRadius: 22,
        overflow: 'hidden', width: '100%',
        maxWidth: hasBrand ? 760 : 440,
        maxHeight: 'calc(100vh - 32px)',
        animation: 'modalIn .26s cubic-bezier(.16,1,.3,1)',
        boxShadow: '0 40px 100px rgba(0,0,0,.45), 0 8px 32px rgba(0,0,0,.25)',
      }}>
        {hasBrand && <BrandPanel />}

        {/* Form pane — white */}
        <div style={{
          flex: 1, padding: '32px 28px', overflowY: 'auto',
          position: 'relative', minWidth: 0,
          background: WHITE,
        }}>
          <CloseBtn onClose={closeAuthModal} dark={false} />
          {views[authModalView] ?? <LoginForm />}
        </div>
      </div>
    </div>
  );
}
