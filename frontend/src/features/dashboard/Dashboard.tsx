import { useEffect, useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../../stores/market';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import { apiGet, apiPost } from '../../lib/api';
import MainChart from './MainChart';
import StockPanel from './StockPanel';
import StockTable from './StockTable';
import GoalNextSteps from './GoalNextSteps';

interface Overview {
  jseIndex?: number; jseIndexChange?: number; totalVolume?: number;
  totalMarketCap?: number; advancers?: number; decliners?: number;
}

const INTER = "'Inter', 'DM Sans', sans-serif";
const MONO = "'JetBrains Mono', 'Fira Mono', monospace";
const SANS = INTER;

function fmt(n?: number, dp = 2) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtVol(n?: number) {
  const v = n ?? 0;
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toLocaleString();
}
function greet() {
  const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Jamaica' })).getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
}

type MoverTab = 'gainers' | 'losers' | 'active';
const MOVER_TABS: { key: MoverTab; label: string; icon: string; color: string; glow: string }[] = [
  { key: 'gainers', label: 'Gainers', icon: 'fa-arrow-trend-up',   color: '#00e676', glow: 'rgba(0,230,118,.18)' },
  { key: 'losers',  label: 'Losers',  icon: 'fa-arrow-trend-down', color: '#ff5252', glow: 'rgba(255,82,82,.18)'  },
  { key: 'active',  label: 'Active',  icon: 'fa-bolt',             color: '#ffd740', glow: 'rgba(255,215,64,.18)' },
];

/* ── Noise grain overlay SVG ─────────────────────────────────── */
function Grain({ opacity = 0.032 }: { opacity?: number }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, pointerEvents: 'none', borderRadius: 'inherit' }}>
      <filter id="grain-d"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter="url(#grain-d)" />
    </svg>
  );
}

/* ── Animated counter ────────────────────────────────────────── */
function Counter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const start = prev.current;
    const end = value;
    const dur = 800;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (end - start) * ease);
      if (p < 1) requestAnimationFrame(step);
      else { setDisplay(end); prev.current = end; }
    };
    requestAnimationFrame(step);
    prev.current = value;
  }, [value]);
  return <>{display.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

/* ── Hero market status card ─────────────────────────────────── */
function HeroCard({ jse, jseΔ, volume, firstName, jamTime, mktOpen, isConn, advCount, decCount, total, marketLabel = 'Market Index' }: {
  jse: number; jseΔ: number; volume: number; firstName: string;
  jamTime: string; mktOpen: boolean; isConn: boolean;
  advCount: number; decCount: number; total: number;
  marketLabel?: string; isUS?: boolean;
}) {
  const pos = jseΔ >= 0;
  const flat = total - advCount - decCount;
  // Goal captured during onboarding — surfaced as a subtle personalization chip.
  const [goal] = useState<string | null>(() => { try { return localStorage.getItem('gf_goal'); } catch { return null; } });

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20,
      background: 'linear-gradient(135deg, #050c0a 0%, #060e0c 50%, #040908 100%)',
      border: '1px solid rgba(0,230,118,.1)',
      boxShadow: mktOpen ? '0 0 80px rgba(0,230,118,.06), 0 4px 32px rgba(0,0,0,.5)' : '0 4px 32px rgba(0,0,0,.5)',
      padding: '28px 32px',
    }}>
      {/* Grid background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,230,118,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,230,118,.018) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />
      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,230,118,.5) 40%, transparent)' }} />
      {/* Glow blob */}
      <div style={{ position: 'absolute', top: -100, left: '30%', width: 400, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <Grain />

      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'start', gap: 24 }}>
        {/* Left: greeting + index */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'rgba(0,230,118,.7)', fontFamily: SANS, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                {greet()},
              </span>
              <span style={{ fontSize: 12, color: 'rgba(var(--fg),.8)', fontFamily: SANS, fontWeight: 700 }}>{firstName}</span>
              <span style={{ width: 1, height: 12, background: 'rgba(var(--fg),.1)', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'rgba(var(--fg),.28)', fontFamily: MONO }}>{jamTime} · JA</span>
            </div>

            {goal && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '4px 10px', borderRadius: 8, background: 'rgba(64,196,255,.08)', border: '1px solid rgba(64,196,255,.18)', maxWidth: 'fit-content' }}>
                <i className="fa-solid fa-bullseye" style={{ fontSize: 10, color: '#40c4ff' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(var(--fg),.55)', fontFamily: SANS }}>
                  Your goal: <span style={{ color: '#40c4ff' }}>{goal}</span>
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              {jse > 0 ? (
                <>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(var(--fg),.3)', letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: INTER, marginBottom: 4 }}>{marketLabel}</div>
                    <div style={{ fontSize: 36, fontWeight: 800, fontFamily: INTER, letterSpacing: '-0.03em', lineHeight: 1, color: 'rgba(var(--fg),1)' }}>
                      <Counter value={jse} decimals={0} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8,
                      background: pos ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)',
                      border: `1px solid ${pos ? 'rgba(0,230,118,.22)' : 'rgba(255,82,82,.22)'}`,
                    }}>
                      <i className={`fa-solid ${pos ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} style={{ fontSize: 10, color: pos ? '#00e676' : '#ff5252' }} />
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: MONO, color: pos ? '#00e676' : '#ff5252' }}>
                        {pos ? '+' : ''}{jseΔ.toFixed(2)}%
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(var(--fg),.25)', fontFamily: SANS }}>today</span>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(var(--fg),.3)', letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: INTER, marginBottom: 8 }}>{marketLabel}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: INTER, color: 'rgba(var(--fg),.85)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                    {total > 0 ? `${total} Securities` : 'Connecting to market…'}
                  </div>
                  {total > 0 && <div style={{ fontSize: 12, color: 'rgba(0,230,118,.6)', fontFamily: MONO, marginTop: 6 }}>Real-time market data</div>}
                </div>
              )}
            </div>
          </div>

          {/* Breadth visual */}
          {total > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
              <div style={{ display: 'flex', gap: 3, height: 6, borderRadius: 99, overflow: 'hidden' }}>
                {advCount > 0 && <div style={{ flex: advCount, background: '#00e676', borderRadius: '99px 0 0 99px', transition: 'flex .6s ease', boxShadow: '0 0 8px rgba(0,230,118,.5)' }} />}
                {flat > 0 && <div style={{ flex: flat, background: 'rgba(var(--fg),.1)', transition: 'flex .6s ease' }} />}
                {decCount > 0 && <div style={{ flex: decCount, background: '#ff5252', borderRadius: '0 99px 99px 0', transition: 'flex .6s ease' }} />}
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                {advCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#00e676', fontFamily: MONO }}>↑ {advCount} up</span>}
                {flat > 0 && <span style={{ fontSize: 11, color: 'rgba(var(--fg),.28)', fontFamily: MONO }}>{flat} flat</span>}
                {decCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#ff5252', fontFamily: MONO }}>↓ {decCount} down</span>}
                <span style={{ fontSize: 10, color: 'rgba(var(--fg),.2)', fontFamily: SANS, marginLeft: 'auto' }}>{total} securities</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: status + volume */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
          {/* Status pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 99,
            background: mktOpen ? 'rgba(0,230,118,.12)' : 'rgba(var(--fg),.05)',
            border: `1px solid ${mktOpen ? 'rgba(0,230,118,.3)' : 'rgba(var(--fg),.08)'}`,
            boxShadow: mktOpen ? '0 0 24px rgba(0,230,118,.15)' : 'none',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', display: 'block',
              background: mktOpen ? '#00e676' : isConn ? '#ffd740' : 'rgba(var(--fg),.2)',
              boxShadow: mktOpen ? '0 0 10px rgba(0,230,118,.8)' : 'none',
            }} className={mktOpen ? 'animate-pulse-dot' : ''} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', fontFamily: SANS, color: mktOpen ? '#00e676' : 'rgba(var(--fg),.4)', textTransform: 'uppercase' }}>
              {mktOpen ? 'Market Open' : 'Closed'}
            </span>
          </div>
          <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(var(--fg),.28)', letterSpacing: '.04em', marginTop: -4 }}>
            Quotes may be delayed
          </span>

          {volume > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(var(--fg),.28)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: SANS }}>Volume</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: INTER, color: 'rgba(var(--fg),.85)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {fmtVol(volume)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── KPI tile ─────────────────────────────────────────────────── */
function KPITile({ label, value, sub, icon, accent, delay = 0 }: {
  label: string; value: string; sub?: string; icon: string; accent: string; delay?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 16,
      background: `linear-gradient(145deg, ${accent}08 0%, transparent 60%), var(--color-bg2)`,
      border: `1px solid ${hov ? accent + '30' : 'rgba(var(--fg),.055)'}`,
      padding: '20px 22px',
      transition: 'border-color .2s, box-shadow .2s, transform .2s',
      boxShadow: hov ? `0 8px 32px rgba(0,0,0,.4), 0 0 0 1px ${accent}14` : '0 2px 12px rgba(0,0,0,.3)',
      transform: hov ? 'translateY(-2px)' : 'none',
      cursor: 'default',
      animation: `fadeUp .4s cubic-bezier(.4,0,.2,1) ${delay}ms both`,
    }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* top accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}80, ${accent}00)`, opacity: hov ? 1 : 0.5, transition: 'opacity .2s' }} />
      <Grain />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(var(--fg),.3)', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: SANS }}>{label}</span>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: accent + '14', border: `1px solid ${accent}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`fa-solid ${icon}`} style={{ fontSize: 11, color: accent }} />
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: INTER, letterSpacing: "-0.02em", lineHeight: 1.1, color: 'rgba(var(--fg),1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: accent, fontFamily: MONO, marginTop: 6, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Section label ────────────────────────────────────────────── */
function SectionLabel({ children, count, right }: { children: React.ReactNode; count?: number; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 3, height: 14, borderRadius: 99, background: '#00e676' }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(var(--fg),.55)', textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: SANS }}>{children}</span>
        {count !== undefined && (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(var(--fg),.2)', fontFamily: MONO }}>{count}</span>
        )}
      </div>
      {right}
    </div>
  );
}

/* ── Mover card ───────────────────────────────────────────────── */
function MoverCard({ s, isSelected, onSelect, moverTab }: {
  s: { symbol: string; price?: number; pctChange?: number; volume?: number };
  isSelected: boolean; onSelect: () => void; moverTab: MoverTab;
}) {
  const [hov, setHov] = useState(false);
  const pos = (s.pctChange ?? 0) >= 0;
  const chgColor = moverTab === 'gainers' ? '#00e676' : moverTab === 'losers' ? '#ff5252' : '#ffd740';
  const active = isSelected || hov;

  return (
    <button onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
        padding: '12px 14px', borderRadius: 14, minWidth: 120, cursor: 'pointer', textAlign: 'left',
        background: isSelected ? chgColor + '14' : hov ? chgColor + '09' : 'rgba(var(--fg),.025)',
        border: `1px solid ${active ? chgColor + '40' : 'rgba(var(--fg),.05)'}`,
        transition: 'all .15s',
        boxShadow: isSelected ? `0 4px 20px ${chgColor}18` : 'none',
        position: 'relative', overflow: 'hidden',
      }}>
      {isSelected && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: chgColor, opacity: 0.7 }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(var(--fg),1)', fontFamily: MONO }}>{s.symbol}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: pos ? '#00e676' : '#ff5252', fontFamily: MONO }}>
          {pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%
        </span>
      </div>
      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: INTER, color: 'rgba(var(--fg),.9)', letterSpacing: '-0.01em' }}>
        ${fmt(s.price)}
      </span>
      {s.volume != null && (
        <span style={{ fontSize: 9, color: 'rgba(var(--fg),.22)', fontFamily: MONO }}>
          Vol: {fmtVol(s.volume)}
        </span>
      )}
    </button>
  );
}

/* ── New user welcome (empty state) ─────────────────────────── */
function NewUserWelcome({ firstName, navigate }: { firstName: string; navigate: (p: string) => void }) {
  const steps = [
    { n: 1, icon: 'fa-wallet',   label: 'Fund your account',    sub: 'Add cash to your portfolio wallet' },
    { n: 2, icon: 'fa-seedling', label: 'Make your first buy',  sub: 'Pick a JSE or US stock you believe in' },
    { n: 3, icon: 'fa-bullseye', label: 'Set a wealth goal',    sub: 'Give your money a destination' },
  ];
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 24,
      background: 'linear-gradient(135deg, var(--color-bg2), var(--color-bg2))',
      border: '1px solid rgba(0,230,118,.18)',
      boxShadow: '0 0 60px rgba(0,230,118,.07)',
      padding: '32px 28px',
    }}>
      <style>{GAME_STYLES}</style>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,230,118,.5), transparent)' }} />
      <div style={{ position: 'absolute', top: -80, right: -40, width: 300, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <Grain opacity={0.025} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 36, marginBottom: 12, animation: 'popIn .5s ease-out' }}>🌱</div>
        <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900, color: 'rgba(var(--fg),1)', letterSpacing: '-0.02em' }}>
          Welcome to Gotham, {firstName}.
        </p>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: 'rgba(var(--fg),.45)', lineHeight: 1.6, maxWidth: 400 }}>
          You're starting as a <strong style={{ color: '#78909c' }}>🌱 Seed</strong>. Complete your first 3 missions to reach <strong style={{ color: '#66bb6a' }}>🌿 Sapling</strong> and start building real wealth.
        </p>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 14px', borderRadius: 14,
              background: i === 0 ? 'rgba(0,230,118,.07)' : 'rgba(var(--fg),.03)',
              border: `1px solid ${i === 0 ? 'rgba(0,230,118,.2)' : 'rgba(var(--fg),.06)'}`,
              animation: `popIn .4s ${i * 80}ms ease-out both`,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                background: i === 0 ? 'rgba(0,230,118,.15)' : 'rgba(var(--fg),.05)',
                border: `1.5px solid ${i === 0 ? 'rgba(0,230,118,.35)' : 'rgba(var(--fg),.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className={`fa-solid ${s.icon}`} style={{ fontSize: 13, color: i === 0 ? '#00e676' : 'rgba(var(--fg),.3)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: i === 0 ? '#fff' : 'rgba(var(--fg),.4)' }}>{s.label}</p>
                <p style={{ margin: '1px 0 0', fontSize: 10, color: 'rgba(var(--fg),.25)' }}>{s.sub}</p>
              </div>
              {i === 0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#00e676', background: 'rgba(0,230,118,.12)', padding: '3px 8px', borderRadius: 99, border: '1px solid rgba(0,230,118,.2)' }}>START</span>}
              {i > 0 && <span style={{ fontSize: 16, opacity: .25 }}>🔒</span>}
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/portfolio')} style={{
          width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: '#00e676', color: '#000',
          fontSize: 14, fontWeight: 900, letterSpacing: '.02em', fontFamily: SANS,
          boxShadow: '0 6px 24px rgba(0,230,118,.35)',
          transition: 'opacity .15s, transform .15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.88'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
        >
          🚀 Start Your Wealth Journey
        </button>
      </div>
    </div>
  );
}

/* ── Paywall block ────────────────────────────────────────────── */
function PaywallBlock({ feature, tier }: { feature: string; tier: string }) {
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,200,83,.2)', background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(8px)', padding: '36px 24px', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,200,83,.1)', border: '1px solid rgba(0,200,83,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <i className="fa-solid fa-lock" style={{ fontSize: 20, color: '#00c853' }} />
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: 'rgba(var(--fg),1)' }}>{feature}</p>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: 'rgba(var(--fg),.45)' }}>Requires a <strong style={{ color: '#00c853' }}>{tier}</strong> plan or higher</p>
      <a href="/subscription" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 22px', borderRadius: 10, background: '#00c853', color: '#000', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>
        <i className="fa-solid fa-arrow-up" style={{ fontSize: 10 }} /> Upgrade Now
      </a>
    </div>
  );
}

/* ── Global keyframes (injected once) ───────────────────────── */
const GAME_STYLES = `
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes floatXP { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-52px) scale(1.3)} }
  @keyframes popIn   { 0%{opacity:0;transform:scale(.7)} 60%{transform:scale(1.12)} 100%{opacity:1;transform:scale(1)} }
  @keyframes barFill { from{width:0} to{width:var(--bar-w)} }
  @keyframes pulseGlow { 0%,100%{box-shadow:0 0 12px var(--glow)} 50%{box-shadow:0 0 28px var(--glow)} }
  .shimmer-box {
    background: linear-gradient(90deg, rgba(var(--fg),.04) 25%, rgba(var(--fg),.09) 50%, rgba(var(--fg),.04) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 12px;
  }
  @media (max-width:600px) { .wealth-score-grid { grid-template-columns: 1fr !important; } }
`;

/* ── Ranks ───────────────────────────────────────────────────── */
const RANKS = [
  { min: 0,  max: 19,  name: 'Seed',          emoji: '🌱', color: '#78909c', next: 'Make your first investment' },
  { min: 20, max: 39,  name: 'Sapling',        emoji: '🌿', color: '#66bb6a', next: 'Diversify to 3+ stocks' },
  { min: 40, max: 59,  name: 'Grower',         emoji: '🌳', color: '#26a69a', next: 'Build your J$50K milestone' },
  { min: 60, max: 79,  name: 'Builder',        emoji: '🏗️',  color: '#42a5f5', next: 'Grow to 5+ positions' },
  { min: 80, max: 100, name: 'Wealth Master',  emoji: '👑', color: '#ffd740', next: 'You\'ve mastered the basics!' },
];
function getRank(score: number) { return RANKS.find(r => score >= r.min && score <= r.max) ?? RANKS[0]; }

/* ── Skeleton ────────────────────────────────────────────────── */
function WealthSkeleton() {
  return (
    <>
      <style>{GAME_STYLES}</style>
      <div style={{ borderRadius: 24, background: 'var(--color-bg2)', border: '1px solid rgba(var(--fg),.06)', padding: '28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="shimmer-box" style={{ height: 12, width: '40%' }} />
        <div className="shimmer-box" style={{ height: 44, width: '70%' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="shimmer-box" style={{ height: 40, flex: 1 }} />
          <div className="shimmer-box" style={{ height: 40, flex: 1 }} />
          <div className="shimmer-box" style={{ height: 40, width: 40 }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="wealth-score-grid">
        <div style={{ borderRadius: 20, background: 'var(--color-bg2)', border: '1px solid rgba(var(--fg),.06)', padding: '22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="shimmer-box" style={{ height: 10, width: '50%' }} />
          <div className="shimmer-box" style={{ height: 8, borderRadius: 99 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[80, 110, 90, 120].map(w => <div key={w} className="shimmer-box" style={{ height: 22, width: w }} />)}
          </div>
        </div>
        <div style={{ borderRadius: 20, background: 'var(--color-bg2)', border: '1px solid rgba(var(--fg),.06)', padding: '22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="shimmer-box" style={{ height: 52 }} />)}
        </div>
      </div>
    </>
  );
}

/* ── Wealth Score + Missions (gamified) ──────────────────────── */
interface Mission { icon: string; label: string; sub: string; to: string; done: boolean; pts: number; }

function MissionButton({ m, navigate }: { m: Mission; navigate: (p: string) => void }) {
  const [pressed, setPressed] = useState(false);
  const [xpPos, setXpPos] = useState<{ x: number; y: number } | null>(null);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setXpPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setPressed(true);
    setTimeout(() => { setXpPos(null); setPressed(false); navigate(m.to); }, 420);
  }

  return (
    <button onClick={handleClick} style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 13px', borderRadius: 14,
      border: `1px solid ${pressed ? 'rgba(0,230,118,.4)' : 'rgba(var(--fg),.07)'}`,
      background: pressed ? 'rgba(0,230,118,.1)' : 'rgba(var(--fg),.03)',
      cursor: 'pointer', textAlign: 'left', width: '100%',
      transform: pressed ? 'scale(.97)' : 'scale(1)',
      transition: 'all .12s cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden',
    }}>
      {xpPos && (
        <span style={{
          position: 'absolute', left: xpPos.x, top: xpPos.y,
          fontSize: 12, fontWeight: 900, color: '#00e676',
          pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap',
          animation: 'floatXP .42s ease-out forwards',
        }}>+{m.pts} XP</span>
      )}
      <div style={{
        width: 34, height: 34, borderRadius: 11,
        background: pressed ? 'rgba(0,230,118,.2)' : 'rgba(0,230,118,.08)',
        border: `1px solid rgba(0,230,118,${pressed ? '.4' : '.15'})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        transition: 'all .12s',
      }}>
        <i className={`fa-solid ${m.icon}`} style={{ fontSize: 13, color: '#00e676' }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'rgba(var(--fg),1)', lineHeight: 1.2 }}>{m.label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'rgba(var(--fg),.35)', lineHeight: 1.3 }}>{m.sub}</p>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#00e676', background: 'rgba(0,230,118,.1)', padding: '2px 7px', borderRadius: 99, flexShrink: 0, border: '1px solid rgba(0,230,118,.2)' }}>+{m.pts}</span>
    </button>
  );
}

function WealthScoreCard({ score, factors, missions, navigate }: {
  score: number;
  factors: { label: string; pts: number; earned: boolean }[];
  missions: Mission[];
  navigate: (p: string) => void;
}) {
  const rank = getRank(score);
  const nextRank = RANKS[RANKS.indexOf(rank) + 1];
  const levelProgress = nextRank
    ? ((score - rank.min) / (rank.max - rank.min + 1)) * 100
    : 100;
  const pending = missions.filter(m => !m.done).slice(0, 3);
  const completedCount = missions.filter(m => m.done).length;

  return (
    <>
      <style>{GAME_STYLES}</style>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="wealth-score-grid">

        {/* ── Score + rank panel ── */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 20,
          background: 'linear-gradient(145deg, var(--color-bg2), var(--color-bg2))',
          border: `1px solid ${rank.color}25`,
          padding: '20px',
          '--glow': `${rank.color}40`,
        } as React.CSSProperties}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${rank.color}60, transparent)` }} />
          <Grain opacity={0.025} />
          <div style={{ position: 'relative', zIndex: 1 }}>

            {/* Rank badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: `${rank.color}15`, border: `1.5px solid ${rank.color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, animation: 'popIn .4s ease-out',
              }}>{rank.emoji}</div>
              <div>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '.12em', color: 'rgba(var(--fg),.3)', textTransform: 'uppercase' }}>Current Rank</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: rank.color, letterSpacing: '-0.01em' }}>{rank.name}</p>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 9, color: 'rgba(var(--fg),.25)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Score</p>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'rgba(var(--fg),1)', letterSpacing: '-0.04em', lineHeight: 1 }}>{score}</p>
              </div>
            </div>

            {/* XP bar to next rank */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(var(--fg),.3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  {nextRank ? `Progress to ${nextRank.name} ${nextRank.emoji}` : '🏆 Max Rank Reached'}
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, color: rank.color }}>{Math.round(levelProgress)}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: 'rgba(var(--fg),.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: `linear-gradient(90deg, ${rank.color}cc, ${rank.color})`,
                  width: `${levelProgress}%`,
                  boxShadow: `0 0 10px ${rank.color}60`,
                  transition: 'width 1s cubic-bezier(.4,0,.2,1)',
                }} />
              </div>
              {nextRank && (
                <p style={{ margin: '6px 0 0', fontSize: 9, color: 'rgba(var(--fg),.25)', fontFamily: SANS }}>
                  💡 {rank.next}
                </p>
              )}
            </div>

            {/* Earned factors */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {factors.map(f => (
                <span key={f.label} style={{
                  fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                  background: f.earned ? `${rank.color}14` : 'rgba(var(--fg),.04)',
                  border: `1px solid ${f.earned ? rank.color + '35' : 'rgba(var(--fg),.07)'}`,
                  color: f.earned ? rank.color : 'rgba(var(--fg),.2)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all .2s',
                }}>
                  <i className={`fa-solid ${f.earned ? 'fa-circle-check' : 'fa-circle'}`} style={{ fontSize: 7 }} />
                  +{f.pts}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Missions panel ── */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 20,
          background: 'var(--color-bg2)', border: '1px solid rgba(var(--fg),.06)',
          padding: '20px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Grain opacity={0.025} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '.13em', color: 'rgba(var(--fg),.3)', textTransform: 'uppercase' }}>Missions</p>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,215,64,.12)', border: '1px solid rgba(255,215,64,.2)', color: '#ffd740' }}>
                {completedCount}/{missions.length} done
              </span>
            </div>

            {pending.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 36, animation: 'popIn .5s ease-out' }}>🏆</div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#ffd740' }}>All missions done!</p>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(var(--fg),.35)', textAlign: 'center' }}>You're a Wealth Master. More coming soon.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(m => <MissionButton key={m.label} m={m} navigate={navigate} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Portfolio donut (instant "what do I own / how much did I make") ───── */
// Vibrant, high-contrast palette — each stock gets its own colour.
// Brand ramp — green / gold / navy / slate tints only (no rainbow). A holdings
// chart is a trust object in a money app; keep it on the brand axis.
const SLICE_COLORS = [
  '#00b85a', // brand green
  '#caa20a', // brand gold
  '#0a2540', // navy
  '#1f9e6b', // green tint
  '#5b6b7a', // slate
  '#b8902a', // gold tint
  '#2e5c4a', // forest
  '#46607a', // steel navy
  '#84a98c', // sage green
  '#9a7f2e', // olive gold
  '#6b8f7e', // eucalyptus
  '#34506a', // deep slate-navy
  '#a7c0ad', // pale sage
  '#cbb86a', // soft gold
  '#3c8f6e', // muted green
];

// Stable hash so a given ticker keeps the same colour across renders/sessions.
function symbolHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
// Map each symbol to a distinct colour (no two slices share one).
function assignSliceColors(symbols: string[]): Record<string, string> {
  const used = new Set<number>();
  const map: Record<string, string> = {};
  for (const sym of symbols) {
    let idx = symbolHash(sym) % SLICE_COLORS.length;
    let guard = 0;
    while (used.has(idx) && guard < SLICE_COLORS.length) { idx = (idx + 1) % SLICE_COLORS.length; guard++; }
    used.add(idx);
    map[sym] = SLICE_COLORS[idx];
  }
  return map;
}

interface PositionLite { symbol?: string; currentValue?: number; marketValue?: number; costBasis?: number; pnl?: number }

function PortfolioDonut({ positions, portfolioValue, totalGain, totalGainPct, navigate }: {
  positions: PositionLite[]; portfolioValue: number; totalGain: number; totalGainPct: number;
  navigate: (path: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 90); return () => clearTimeout(t); }, []);

  const up = totalGain >= 0;
  const accent = up ? '#00e676' : '#ff5252';

  const slices = useMemo(() => {
    const base = positions
      .map(p => {
        const value = p.currentValue ?? p.marketValue ?? 0;
        const cost = p.costBasis ?? 0;
        return { symbol: p.symbol ?? '—', value, pnl: p.pnl ?? (value - cost) };
      })
      .filter(s => s.value > 0)
      .sort((a, b) => b.value - a.value);
    const colors = assignSliceColors(base.map(s => s.symbol));
    return base.map(s => ({ ...s, pct: portfolioValue > 0 ? (s.value / portfolioValue) * 100 : 0, color: colors[s.symbol] }));
  }, [positions, portfolioValue]);

  const R = 56, SW = 16, C = 2 * Math.PI * R;
  // Precompute cumulative arc offsets without mutating captured state.
  const arcs = useMemo(() => {
    const fulls = slices.map(s => (s.pct / 100) * C);
    return slices.map((s, i) => ({
      ...s,
      full: fulls[i],
      start: fulls.slice(0, i).reduce((a, b) => a + b, 0),
    }));
  }, [slices, C]);

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20,
      background: 'linear-gradient(135deg, var(--color-bg2) 0%, var(--color-bg2) 100%)',
      border: `1px solid ${accent}22`,
      boxShadow: `0 0 50px ${accent}0d, 0 8px 36px rgba(0,0,0,.5)`,
      padding: '20px 22px',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}70 45%, transparent)` }} />
      <Grain opacity={0.022} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(var(--fg),.4)', textTransform: 'uppercase', fontFamily: SANS }}>
            <i className="fa-solid fa-chart-pie" style={{ color: accent, marginRight: 7 }} />Your Portfolio
          </span>
          <button onClick={() => navigate('/portfolio')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700,
            color: 'rgba(var(--fg),.4)', cursor: 'pointer', padding: '4px 10px', borderRadius: 8,
            border: '1px solid rgba(var(--fg),.08)', background: 'rgba(var(--fg),.03)', fontFamily: SANS,
          }}>View all →</button>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* donut */}
          <svg viewBox="0 0 140 140" style={{ width: 132, height: 132, flexShrink: 0 }}>
            <circle cx={70} cy={70} r={R} fill="none" stroke="rgba(var(--fg),.05)" strokeWidth={SW} />
            {arcs.map(s => {
              const len = mounted ? s.full : 0;
              return (
                <circle key={s.symbol} cx={70} cy={70} r={R} fill="none" stroke={s.color} strokeWidth={SW}
                  strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-s.start}
                  transform="rotate(-90 70 70)"
                  style={{ transition: 'stroke-dasharray .8s cubic-bezier(.22,1,.36,1)' }} />
              );
            })}
            <text x={70} y={64} textAnchor="middle" fill={accent} fontSize={20} fontWeight={900} fontFamily={MONO}>
              {up ? '+' : ''}{totalGainPct.toFixed(1)}%
            </text>
            <text x={70} y={80} textAnchor="middle" fill="rgba(var(--fg),.4)" fontSize={8} fontFamily={SANS}>total return</text>
          </svg>

          {/* value + gain */}
          <div style={{ flex: 1, minWidth: 140 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'rgba(var(--fg),.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Total value</p>
            <p style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 800, color: 'rgba(var(--fg),1)', fontFamily: MONO, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              J$<Counter value={portfolioValue} decimals={0} />
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '5px 10px', borderRadius: 9, background: `${accent}14`, border: `1px solid ${accent}30` }}>
              <i className={`fa-solid fa-arrow-${up ? 'up' : 'down'}`} style={{ fontSize: 10, color: accent }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: accent, fontFamily: MONO }}>
                {up ? '+' : ''}J${Math.abs(totalGain).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'rgba(var(--fg),.35)', fontFamily: SANS }}>
              across {slices.length} holding{slices.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 16 }}>
          {slices.slice(0, 5).map(s => {
            const sUp = s.pnl >= 0;
            return (
              <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(var(--fg),1)', fontFamily: MONO, width: 56 }}>{s.symbol}</span>
                <div style={{ flex: 1, height: 5, borderRadius: 99, background: 'rgba(var(--fg),.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: mounted ? `${s.pct}%` : '0%', background: s.color, borderRadius: 99, transition: 'width .8s cubic-bezier(.22,1,.36,1)' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(var(--fg),.62)', fontFamily: MONO, width: 38, textAlign: 'right' }}>{s.pct.toFixed(0)}%</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: sUp ? '#00e676' : '#ff5252', fontFamily: MONO, width: 30, textAlign: 'right' }}>{sUp ? '▲' : '▼'}</span>
              </div>
            );
          })}
          {slices.length > 5 && (
            <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'rgba(var(--fg),.3)', fontFamily: SANS }}>+ {slices.length - 5} more holdings</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Portfolio PREVIEW donut (guests + users with no holdings yet) ──────── */
const PREVIEW_SLICES = [
  { symbol: 'NCB', pct: 34 }, { symbol: 'GK', pct: 26 },
  { symbol: 'WISYNCO', pct: 22 }, { symbol: 'AAPL', pct: 18 },
];
function PortfolioPreviewCard({ mode, navigate, openAuthModal }: {
  mode: 'guest' | 'new';
  navigate: (path: string) => void;
  openAuthModal: (view?: 'login' | 'signup') => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 90); return () => clearTimeout(t); }, []);
  const R = 56, SW = 16, C = 2 * Math.PI * R;
  const colors = useMemo(() => assignSliceColors(PREVIEW_SLICES.map(s => s.symbol)), []);
  const arcs = useMemo(() => {
    const fulls = PREVIEW_SLICES.map(s => (s.pct / 100) * C);
    return PREVIEW_SLICES.map((s, i) => ({ ...s, full: fulls[i], start: fulls.slice(0, i).reduce((a, b) => a + b, 0), color: colors[s.symbol] }));
  }, [C, colors]);

  const headline = mode === 'guest' ? 'See your money grow here' : 'Your portfolio starts here';
  const sub = mode === 'guest'
    ? 'Track every JSE & US stock you own in one place — free, no card needed.'
    : 'Make your first investment and watch this fill up with your real holdings.';
  const ctaLabel = mode === 'guest' ? 'Sign up free' : 'Make your first investment';
  const onCta = () => (mode === 'guest' ? openAuthModal('signup') : navigate('/portfolio'));

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20,
      background: 'linear-gradient(135deg, #06100b 0%, var(--color-bg2) 100%)',
      border: '1px dashed rgba(0,230,118,.28)', padding: '20px 22px',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,230,118,.5) 45%, transparent)' }} />
      <Grain opacity={0.022} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(var(--fg),.4)', textTransform: 'uppercase', fontFamily: SANS }}>
            <i className="fa-solid fa-chart-pie" style={{ color: '#00e676', marginRight: 7 }} />Your Portfolio
          </span>
          <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.12em', color: '#ffd740', background: 'rgba(255,215,64,.12)', border: '1px solid rgba(255,215,64,.3)', borderRadius: 99, padding: '2px 8px' }}>PREVIEW</span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* sample donut (dimmed to signal it isn't real) */}
          <svg viewBox="0 0 140 140" style={{ width: 132, height: 132, flexShrink: 0, opacity: 0.92 }}>
            <circle cx={70} cy={70} r={R} fill="none" stroke="rgba(var(--fg),.05)" strokeWidth={SW} />
            {arcs.map(s => {
              const len = mounted ? s.full : 0;
              return (
                <circle key={s.symbol} cx={70} cy={70} r={R} fill="none" stroke={s.color} strokeWidth={SW}
                  strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-s.start}
                  transform="rotate(-90 70 70)"
                  style={{ transition: 'stroke-dasharray .8s cubic-bezier(.22,1,.36,1)' }} />
              );
            })}
            <text x={70} y={66} textAnchor="middle" fill="rgba(var(--fg),.85)" fontSize={12} fontWeight={800} fontFamily={SANS}>Sample</text>
            <text x={70} y={80} textAnchor="middle" fill="rgba(var(--fg),.35)" fontSize={8} fontFamily={SANS}>4 stocks</text>
          </svg>
          <div style={{ flex: 1, minWidth: 150 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'rgba(var(--fg),1)', fontFamily: SANS, lineHeight: 1.25 }}>{headline}</p>
            <p style={{ margin: '6px 0 14px', fontSize: 12, color: 'rgba(var(--fg),.5)', fontFamily: SANS, lineHeight: 1.55 }}>{sub}</p>
            <button onClick={onCta} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 18px', borderRadius: 12,
              background: 'linear-gradient(135deg, #00c853, #00e676)', color: '#04060d', fontWeight: 800, fontSize: 13.5,
              border: 'none', cursor: 'pointer', fontFamily: SANS, boxShadow: '0 6px 22px rgba(0,230,118,.3)',
            }}>{ctaLabel} →</button>
          </div>
        </div>
        {/* sample legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 16 }}>
          {arcs.map(s => (
            <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(var(--fg),.7)', fontFamily: MONO }}>{s.symbol}</span>
              <span style={{ fontSize: 10, color: 'rgba(var(--fg),.6)', fontFamily: MONO }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Wealth hero (logged-in users) ───────────────────────────── */
function WealthHero({ portfolioValue, totalGain, totalGainPct, walletBalance, firstName, navigate }: {
  portfolioValue: number; totalGain: number; totalGainPct: number;
  walletBalance: number; firstName: string;
  navigate: (path: string) => void;
}) {
  const pos = totalGain >= 0;
  const totalNet = portfolioValue + walletBalance;

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 24,
      background: 'linear-gradient(135deg, var(--color-bg2) 0%, var(--color-bg2) 50%, var(--color-bg2) 100%)',
      border: '1px solid rgba(0,230,118,.15)',
      boxShadow: '0 0 60px rgba(0,230,118,.07), 0 8px 40px rgba(0,0,0,.6)',
      padding: '28px 28px 24px',
    }}>
      {/* Subtle grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,230,118,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(0,230,118,.015) 1px,transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
      {/* Top gradient line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(0,230,118,.6) 40%, rgba(0,230,118,.2) 70%, transparent 100%)' }} />
      {/* Glow */}
      <div style={{ position: 'absolute', top: -120, right: -60, width: 360, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <Grain opacity={0.025} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.16em', color: 'rgba(0,230,118,.6)', textTransform: 'uppercase', fontFamily: SANS }}>
            {greet()}, {firstName}
          </span>
          <a href="/portfolio" onClick={e => { e.preventDefault(); navigate('/portfolio'); }} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 700, color: 'rgba(var(--fg),.35)',
            textDecoration: 'none', letterSpacing: '.04em',
            padding: '4px 10px', borderRadius: 8,
            border: '1px solid rgba(var(--fg),.07)',
            background: 'rgba(var(--fg),.03)',
            transition: 'all .15s',
          }}>
            View Portfolio <i className="fa-solid fa-arrow-right" style={{ fontSize: 8 }} />
          </a>
        </div>

        {/* Net worth headline */}
        <div style={{ marginBottom: 6 }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: 'rgba(var(--fg),.28)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: SANS }}>Total Wealth</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 40, fontWeight: 900, fontFamily: SANS, letterSpacing: '-0.04em', lineHeight: 1, color: 'rgba(var(--fg),1)' }}>
              J$<Counter value={totalNet} decimals={2} />
            </div>
            {totalGain !== 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 99,
                background: pos ? 'rgba(0,230,118,.12)' : 'rgba(255,82,82,.12)',
                border: `1px solid ${pos ? 'rgba(0,230,118,.25)' : 'rgba(255,82,82,.25)'}`,
              }}>
                <i className={`fa-solid ${pos ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} style={{ fontSize: 10, color: pos ? '#00e676' : '#ff5252' }} />
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: MONO, color: pos ? '#00e676' : '#ff5252' }}>
                  {pos ? '+' : ''}{totalGainPct.toFixed(2)}%
                </span>
                <span style={{ fontSize: 10, color: pos ? 'rgba(0,230,118,.6)' : 'rgba(255,82,82,.6)' }}>all-time</span>
              </div>
            )}
          </div>
        </div>

        {/* Sub-metrics row */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(var(--fg),.05)', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, color: 'rgba(var(--fg),.25)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Invested</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, fontFamily: MONO, color: 'rgba(var(--fg),.85)', letterSpacing: '-0.01em' }}>J${fmt(portfolioValue)}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, color: 'rgba(var(--fg),.25)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Cash</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, fontFamily: MONO, color: 'rgba(var(--fg),.85)', letterSpacing: '-0.01em' }}>J${fmt(walletBalance)}</p>
          </div>
          {totalGain !== 0 && (
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, color: 'rgba(var(--fg),.25)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Total Return</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, fontFamily: MONO, color: pos ? '#00e676' : '#ff5252', letterSpacing: '-0.01em' }}>
                {pos ? '+' : ''}J${fmt(Math.abs(totalGain))}
              </p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={() => navigate('/portfolio')} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: '#00e676', color: '#000',
            fontSize: 12, fontWeight: 800, fontFamily: SANS, letterSpacing: '.02em',
            boxShadow: '0 4px 20px rgba(0,230,118,.3)',
            transition: 'opacity .15s',
          }}>
            <i className="fa-solid fa-plus" style={{ fontSize: 11 }} />
            Invest
          </button>
          <button onClick={() => navigate('/planner')} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '11px 16px', borderRadius: 12, cursor: 'pointer',
            background: 'rgba(var(--fg),.05)', border: '1px solid rgba(var(--fg),.08)',
            color: 'rgba(var(--fg),.7)', fontSize: 12, fontWeight: 700, fontFamily: SANS,
            transition: 'all .15s',
          }}>
            <i className="fa-solid fa-bullseye" style={{ fontSize: 11 }} />
            Set a Goal
          </button>
          <button onClick={() => navigate('/chat')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
            background: 'rgba(var(--fg),.05)', border: '1px solid rgba(var(--fg),.08)',
            color: 'rgba(var(--fg),.7)', fontSize: 12, fontWeight: 700, fontFamily: SANS,
            transition: 'all .15s',
          }}>
            <i className="fa-solid fa-robot" style={{ fontSize: 12, color: '#00e676' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Long-term Goals ─────────────────────────────────────────── */
const WEALTH_MILESTONES = [
  { label: 'First Investment',  emoji: '🌱', target: 1,          unit: 'positions',  desc: 'Buy your first stock'            },
  { label: 'J$50K Invested',    emoji: '💰', target: 50_000,     unit: 'jmd',        desc: 'Your wealth foundation'          },
  { label: 'J$250K Milestone',  emoji: '🎯', target: 250_000,    unit: 'jmd',        desc: 'Growing serious'                 },
  { label: 'J$1M Milestone',    emoji: '🏆', target: 1_000_000,  unit: 'jmd',        desc: 'The million dollar club'        },
  { label: 'Diversified (5+)',  emoji: '🌿', target: 5,          unit: 'positions',  desc: 'Spread your risk'                },
  { label: 'J$5M Portfolio',    emoji: '👑', target: 5_000_000,  unit: 'jmd',        desc: 'Wealth Master territory'        },
];

function GoalsSection({ portfolioValue, positions }: { portfolioValue: number; positions: number }) {
  const positionCount = positions;
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20,
      background: 'linear-gradient(145deg, var(--color-bg2), var(--color-bg2))',
      border: '1px solid rgba(var(--fg),.07)',
      padding: '20px',
    }}>
      <style>{GAME_STYLES}</style>
      <Grain opacity={0.022} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(var(--fg),.3)', textTransform: 'uppercase' }}>Long-Term Goals</p>
          <a href="/planner" style={{ fontSize: 10, fontWeight: 700, color: '#00e676', textDecoration: 'none', letterSpacing: '.04em', opacity: .8 }}>
            Set Custom Goal <i className="fa-solid fa-arrow-right" style={{ fontSize: 8 }} />
          </a>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WEALTH_MILESTONES.map(m => {
            const current = m.unit === 'jmd' ? portfolioValue : positionCount;
            const pct = Math.min((current / m.target) * 100, 100);
            const done = pct >= 100;
            return (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: done ? 'rgba(0,230,118,.15)' : 'rgba(var(--fg),.04)',
                  border: `1px solid ${done ? 'rgba(0,230,118,.3)' : 'rgba(var(--fg),.07)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>
                  {done ? '✓' : m.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: done ? '#00e676' : 'rgba(var(--fg),.7)' }}>{m.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: done ? '#00e676' : 'rgba(var(--fg),.3)', fontFamily: MONO }}>
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: 'rgba(var(--fg),.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      background: done
                        ? 'linear-gradient(90deg, #00e676cc, #00e676)'
                        : 'linear-gradient(90deg, rgba(0,230,118,.4), rgba(0,230,118,.7))',
                      width: `${pct}%`,
                      boxShadow: done ? '0 0 8px rgba(0,230,118,.5)' : 'none',
                      transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
                    }} />
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 9, color: 'rgba(var(--fg),.2)' }}>{m.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const openAuthModal = useUIStore(s => s.openAuthModal);
  const stocks = useMarketStore(s => s.stocks);
  const isConn = useMarketStore(s => s.isConnected);
  const selectedSymbol = useMarketStore(s => s.selectedSymbol);
  const selectSymbol = useMarketStore(s => s.selectSymbol);
  const navigate = useNavigate();

  const [moverTab, setMoverTab] = useState<MoverTab>('gainers');
  const [clock, setClock] = useState(new Date());
  const [market, setMarket] = useState<'us' | 'caribbean'>('us');
  const [usSearch, setUsSearch] = useState('');

  // Wealth data for logged-in users
  const { data: walletData, isLoading: walletLoading } = useQuery<Record<string, number>>({
    queryKey: ['wallet'],
    queryFn: () => apiGet<Record<string, number>>('/api/wallet/balance'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
  const { data: posData, isLoading: posLoading } = useQuery<Record<string, unknown>>({
    queryKey: ['positions'],
    queryFn: () => apiGet<Record<string, unknown>>('/api/portfolio/positions'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
  const wealthLoading = isAuthenticated && (walletLoading || posLoading);

  const walletBalance = (walletData?.balance as number) ?? 0;
  const rawPositions = Array.isArray(posData)
    ? posData
    : Array.isArray((posData as Record<string, unknown>)?.positions)
      ? (posData as Record<string, unknown[]>).positions
      : [];
  const portfolioValue = rawPositions.reduce((sum: number, p: Record<string, number>) =>
    sum + (p.currentValue ?? p.marketValue ?? 0), 0);
  const totalCost = rawPositions.reduce((sum: number, p: Record<string, number>) =>
    sum + (p.costBasis ?? 0), 0);
  const totalGain = portfolioValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // ── Wealth Score (0–100) computed from real portfolio data ──
  const scoreFactors = useMemo(() => [
    { label: 'First investment',   pts: 25, earned: rawPositions.length > 0 },
    { label: 'Diversified (3+)',   pts: 20, earned: rawPositions.length >= 3 },
    { label: 'Cash buffer',        pts: 10, earned: walletBalance > 0 },
    { label: 'J$50K+ invested',    pts: 15, earned: portfolioValue >= 50_000 },
    { label: 'Positive return',    pts: 15, earned: totalGain > 0 },
    { label: 'Well diversified (5+)', pts: 10, earned: rawPositions.length >= 5 },
    { label: 'J$500K milestone',   pts:  5, earned: portfolioValue >= 500_000 },
  ], [rawPositions.length, walletBalance, portfolioValue, totalGain]);
  const wealthScore = useMemo(() => scoreFactors.reduce((s, f) => s + (f.earned ? f.pts : 0), 0), [scoreFactors]);

  // ── Missions — top 3 uncompleted ──
  const allMissions: Mission[] = useMemo(() => [
    { icon: 'fa-seedling',   pts: 25, label: 'Make your first investment',  sub: 'Buy your first JSE or US stock',         to: '/portfolio', done: rawPositions.length > 0 },
    { icon: 'fa-chart-pie',  pts: 20, label: 'Diversify to 3+ stocks',      sub: 'Spread risk across multiple securities', to: '/screener',  done: rawPositions.length >= 3 },
    { icon: 'fa-wallet',     pts: 10, label: 'Maintain a cash buffer',      sub: 'Keep funds ready for opportunities',     to: '/portfolio', done: walletBalance > 0 },
    { icon: 'fa-bullseye',   pts: 15, label: 'Set a wealth goal',           sub: 'Define what you\'re building toward',    to: '/planner',   done: false },
    { icon: 'fa-flag-usa',   pts: 10, label: 'Add US stock exposure',       sub: 'Hedge in USD with global leaders',       to: '/us-stocks', done: false },
    { icon: 'fa-robot',      pts: 10, label: 'Ask your AI advisor',         sub: 'Get a personalised investment plan',     to: '/chat',      done: false },
    { icon: 'fa-bell',       pts: 5,  label: 'Set a price alert',           sub: 'Never miss a buy or sell opportunity',   to: '/alerts',    done: false },
  ], [rawPositions.length, walletBalance]);

  const US_POPULAR = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'JPM', 'BRK/B', 'V', 'UNH', 'XOM', 'NFLX', 'AMD', 'DIS', 'BABA', 'PYPL', 'INTC'];

  const { data: usData, isError: usError } = useQuery<{ symbol: string; name: string; price: number; pctChange: number; volume: number }[]>({
    queryKey: ['us-dashboard', usSearch || 'popular'],
    queryFn: async () => {
      const symbols = usSearch.trim()
        ? [usSearch.trim().toUpperCase()]
        : US_POPULAR.filter(s => !s.includes('/'));
      const res = await apiPost<unknown>('/api/us/quotes', { symbols });
      if (Array.isArray(res)) return res as { symbol: string; name: string; price: number; pctChange: number; volume: number }[];
      if (res && typeof res === 'object') {
        return Object.entries(res as Record<string, Record<string, unknown>>).map(([sym, q]) => ({
          symbol: sym,
          name: (q.name as string) ?? sym,
          price: (q.price as number) ?? (q.ask as number) ?? 0,
          pctChange: typeof q.change === 'string' ? parseFloat(q.change) : ((q.change as number) ?? 0),
          volume: (q.volume as number) ?? 0,
        }));
      }
      return [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: market === 'us',
    retry: 0,
  });

  const usStocks = useMemo(() => Array.isArray(usData) ? usData.filter(s => s.price > 0) : [], [usData]);
  const activeStocks = market === 'us' ? usStocks : stocks;
  const usUnavailable = usError && market === 'us';

  useEffect(() => {
    if (market === 'us' && usStocks.length > 0 && (!selectedSymbol || stocks.find(s => s.symbol === selectedSymbol))) {
      selectSymbol(usStocks[0].symbol);
    } else if (market === 'caribbean' && stocks.length > 0 && !stocks.find(s => s.symbol === selectedSymbol)) {
      selectSymbol(stocks[0].symbol);
    }
  }, [market, usStocks.length, stocks.length]); // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: overview } = useQuery<Overview>({
    queryKey: ['market-overview'],
    queryFn: () => apiGet<Overview>('/api/market-overview'),
    refetchInterval: 30_000, retry: 1,
  });

  const jamTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Jamaica', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(clock);
  const local = new Date(clock.toLocaleString('en-US', { timeZone: 'America/Jamaica' }));
  const d = local.getDay(), m = local.getHours() * 60 + local.getMinutes();
  const mktOpen = d >= 1 && d <= 5 && m >= 570 && m < 810; // JSE 9:30–13:30 ET
  // US market hours: 9:30–16:00 ET, Mon–Fri (computed in real ET, not hardcoded).
  const etLocal = new Date(clock.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const etD = etLocal.getDay(), etM = etLocal.getHours() * 60 + etLocal.getMinutes();
  const usMktOpen = etD >= 1 && etD <= 5 && etM >= 570 && etM < 960;

  const jse = overview?.jseIndex ?? 0;
  const jseΔ = overview?.jseIndexChange ?? 0;
  const jsePos = jseΔ >= 0;

  const advCount = useMemo(() => stocks.filter(s => (s.pctChange ?? 0) > 0).length, [stocks]);
  const decCount = useMemo(() => stocks.filter(s => (s.pctChange ?? 0) < 0).length, [stocks]);
  const usAdvCount = useMemo(() => usStocks.filter(s => (s.pctChange ?? 0) > 0).length, [usStocks]);
  const usDecCount = useMemo(() => usStocks.filter(s => (s.pctChange ?? 0) < 0).length, [usStocks]);

  const movers = useMemo(() => ({
    gainers: [...activeStocks].sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0)).slice(0, 20),
    losers:  [...activeStocks].sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0)).slice(0, 20),
    active:  [...activeStocks].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 20),
  }), [activeStocks]);

  const currentMovers = movers[moverTab];
  const firstName = user?.name?.split(' ')[0] ?? 'Investor';
  const isFree = !user || (user.subscriptionTier === 'FREE');

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Goal-based next steps (from onboarding choice) ── */}
      <GoalNextSteps />

      {/* ── Wealth section (logged-in users) ─────────────── */}
      {isAuthenticated ? (
        wealthLoading ? <WealthSkeleton /> : (
          rawPositions.length > 0 ? (
            <>
              <WealthHero
                portfolioValue={portfolioValue}
                totalGain={totalGain}
                totalGainPct={totalGainPct}
                walletBalance={walletBalance}
                firstName={firstName}
                navigate={navigate}
              />
              <PortfolioDonut
                positions={rawPositions as PositionLite[]}
                portfolioValue={portfolioValue}
                totalGain={totalGain}
                totalGainPct={totalGainPct}
                navigate={navigate}
              />
              <WealthScoreCard
                score={wealthScore}
                factors={scoreFactors}
                missions={allMissions}
                navigate={navigate}
              />
              <GoalsSection portfolioValue={portfolioValue} positions={rawPositions.length} />
            </>
          ) : (
            <>
              <PortfolioPreviewCard mode="new" navigate={navigate} openAuthModal={openAuthModal} />
              <NewUserWelcome firstName={firstName} navigate={navigate} />
            </>
          )
        )
      ) : (
        <PortfolioPreviewCard mode="guest" navigate={navigate} openAuthModal={openAuthModal} />
      )}

      {/* ── FREE tier upgrade banner ──────────────────────── */}
      {isFree && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '14px 20px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,200,83,.08) 0%, rgba(0,180,255,.06) 100%)', border: '1px solid rgba(0,200,83,.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🚀</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(var(--fg),1)' }}>You're on the Free plan — limited to JSE preview only</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(var(--fg),.5)' }}>Upgrade to CORE for full JSE + US Markets, charts, portfolio, alerts & more.</p>
            </div>
          </div>
          <a href="/subscription" style={{ flexShrink: 0, padding: '8px 20px', borderRadius: 10, background: '#00c853', color: '#000', fontSize: 12, fontWeight: 800, textDecoration: 'none', letterSpacing: '.02em' }}>Upgrade — $14.99/mo</a>
        </div>
      )}

      {/* ── 0. Market toggle ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'rgba(var(--fg),.04)', border: '1px solid rgba(var(--fg),.07)' }}>
          {([['us', '🇺🇸 US Markets'], ['caribbean', '🌴 Caribbean']] as const).map(([key, label]) => (
            <button key={key} onClick={() => { if (isFree && key === 'us') { window.location.href = '/subscription'; return; } setMarket(key); }}
              style={{
                padding: '7px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: INTER, transition: 'all .15s',
                background: market === key ? (key === 'us' ? 'rgba(64,196,255,.15)' : 'rgba(0,230,118,.15)') : 'transparent',
                color: market === key ? (key === 'us' ? '#40c4ff' : '#00e676') : 'rgba(var(--fg),.35)',
                boxShadow: market === key ? `0 0 12px ${key === 'us' ? 'rgba(64,196,255,.2)' : 'rgba(0,230,118,.2)'}` : 'none',
              }}>{label}</button>
          ))}
        </div>
        {market === 'us' && (
          <input
            value={usSearch}
            onChange={e => setUsSearch(e.target.value)}
            placeholder="Filter US symbol…"
            style={{
              height: 34, paddingLeft: 12, paddingRight: 12, borderRadius: 10,
              background: 'rgba(var(--fg),.04)', border: '1px solid rgba(var(--fg),.08)',
              color: 'rgba(var(--fg),1)', fontSize: 12, fontFamily: INTER, outline: 'none', width: 160,
            }}
          />
        )}
      </div>

      {/* ── US unavailable notice ───────────────────────────────── */}
      {usUnavailable && (
        <div className="warn-amber" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, fontSize: 12, fontFamily: INTER }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 11, color: 'currentColor' }} />
          US market data unavailable — Alpaca API not configured. Switch to Caribbean markets to view live data.
          <button onClick={() => setMarket('caribbean')} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, background: 'rgba(0,230,118,.12)', border: '1px solid rgba(0,230,118,.25)', color: '#00e676', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Switch to Caribbean
          </button>
        </div>
      )}

      {/* ── 1. Hero ─────────────────────────────────────────────── */}
      <HeroCard
        jse={market === 'us' ? (usStocks.find(s => s.symbol === 'SPY')?.price ?? 0) : jse}
        jseΔ={market === 'us' ? (usStocks.find(s => s.symbol === 'SPY')?.pctChange ?? 0) : jseΔ}
        volume={market === 'us' ? usStocks.reduce((a, s) => a + (s.volume ?? 0), 0) : (overview?.totalVolume ?? 0)}
        firstName={firstName} jamTime={jamTime}
        mktOpen={market === 'us' ? usMktOpen : mktOpen}
        isConn={isConn}
        advCount={market === 'us' ? usStocks.filter(s => (s.pctChange ?? 0) > 0).length : advCount}
        decCount={market === 'us' ? usStocks.filter(s => (s.pctChange ?? 0) < 0).length : decCount}
        total={market === 'us' ? usStocks.length : stocks.length}
        marketLabel={market === 'us' ? 'S&P 500 (SPY)' : 'Caribbean Markets'}
        isUS={market === 'us'}
      />

      {/* ── 2. KPI tiles ────────────────────────────────────────── */}
      <div className="mobile-hide" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(162px, 1fr))', gap: 12 }}>
        {market === 'us' ? (
          <>
            {usStocks.find(s => s.symbol === 'SPY') && <KPITile label="S&P 500 (SPY)" value={`$${(usStocks.find(s => s.symbol === 'SPY')?.price ?? 0).toFixed(2)}`} sub={`${(usStocks.find(s => s.symbol === 'SPY')?.pctChange ?? 0) >= 0 ? '+' : ''}${(usStocks.find(s => s.symbol === 'SPY')?.pctChange ?? 0).toFixed(2)}% today`} icon="fa-chart-line" accent="#40c4ff" delay={0} />}
            {usStocks.find(s => s.symbol === 'QQQ') && <KPITile label="Nasdaq (QQQ)" value={`$${(usStocks.find(s => s.symbol === 'QQQ')?.price ?? 0).toFixed(2)}`} sub={`${(usStocks.find(s => s.symbol === 'QQQ')?.pctChange ?? 0) >= 0 ? '+' : ''}${(usStocks.find(s => s.symbol === 'QQQ')?.pctChange ?? 0).toFixed(2)}% today`} icon="fa-chart-bar" accent="#ce93d8" delay={60} />}
            <KPITile label="US Stocks" value={String(usStocks.length)} icon="fa-flag-usa" accent="#ffd740" delay={80} />
            <KPITile label="Advancing" value={String(usAdvCount)} icon="fa-arrow-trend-up" accent="#00e676" delay={120} />
            <KPITile label="Declining" value={String(usDecCount)} icon="fa-arrow-trend-down" accent="#ff5252" delay={180} />
          </>
        ) : (
          <>
            {jse > 0 && <KPITile label="JSE Index" value={jse.toLocaleString('en-US', { maximumFractionDigits: 0 })} sub={`${jsePos ? '+' : ''}${jseΔ.toFixed(2)}% today`} icon="fa-chart-line" accent="#00e676" delay={0} />}
            {(overview?.totalVolume ?? 0) > 0 && <KPITile label="Volume" value={fmtVol(overview?.totalVolume)} icon="fa-bars-progress" accent="#40c4ff" delay={60} />}
            <KPITile label="Securities" value={String(stocks.length)} icon="fa-list" accent="#ce93d8" delay={80} />
            <KPITile label="Advancers" value={String(advCount)} icon="fa-arrow-trend-up" accent="#00e676" delay={120} />
            <KPITile label="Decliners" value={String(decCount)} icon="fa-arrow-trend-down" accent="#ff5252" delay={180} />
          </>
        )}
      </div>

      {/* ── 3. Movers strip ─────────────────────────────────────── */}
      <div className="mobile-hide">
        <SectionLabel count={activeStocks.length}
          right={
            <div style={{ display: 'flex', gap: 2, padding: '3px', borderRadius: 12, background: 'rgba(var(--fg),.04)', border: '1px solid rgba(var(--fg),.06)' }}>
              {MOVER_TABS.map(tab => (
                <button key={tab.key} onClick={() => setMoverTab(tab.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 9,
                  fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                  fontFamily: SANS, letterSpacing: '.02em',
                  background: moverTab === tab.key ? tab.color + '18' : 'transparent',
                  color: moverTab === tab.key ? tab.color : 'rgba(var(--fg),.3)',
                  transition: 'all .15s',
                  boxShadow: moverTab === tab.key ? `0 0 12px ${tab.glow}` : 'none',
                }}>
                  <i className={`fa-solid ${tab.icon}`} style={{ fontSize: 9 }} />
                  {tab.label}
                </button>
              ))}
            </div>
          }
        >
          Market Movers
        </SectionLabel>

        <div className="scroll-x" style={{ display: 'flex', gap: 10, paddingBottom: 4 }}>
          {activeStocks.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 4px', color: 'rgba(var(--fg),.2)', fontSize: 12, fontFamily: SANS }}>
              <i className="fa-solid fa-satellite-dish" style={{ fontSize: 16, opacity: .3 }} />
              Connecting to live market data…
            </div>
          ) : currentMovers.map(s => (
            <MoverCard
              key={s.symbol} s={s}
              isSelected={s.symbol === selectedSymbol}
              onSelect={() => selectSymbol(s.symbol)}
              moverTab={moverTab}
            />
          ))}
        </div>
      </div>

      {/* ── 4. Chart + Panel ────────────────────────────────────── */}
      <div className="mobile-hide">
        <SectionLabel right={
          selectedSymbol ? (
            <a href={`/analysis?q=${selectedSymbol}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 8, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', color: '#00e676', fontSize: 11, fontWeight: 700, fontFamily: INTER, textDecoration: 'none', transition: 'opacity .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.75'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              <i className="fa-solid fa-brain" style={{ fontSize: 10 }} />
              AI Analysis
            </a>
          ) : undefined
        }>Chart &amp; Analysis</SectionLabel>
        {isFree ? (
          <PaywallBlock feature="Advanced Charts & Real-Time Data" tier="CORE" />
        ) : (
          <div className="dashboard-grid">
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(var(--fg),.055)', background: 'var(--color-bg2)', boxShadow: '0 4px 32px rgba(0,0,0,.4)' }}>
              <MainChart symbol={selectedSymbol} isUS={market === 'us'} />
            </div>
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(var(--fg),.055)', background: 'var(--color-bg2)' }}>
              <StockPanel stocks={market === 'us' ? usStocks : undefined} isUS={market === 'us'} />
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Securities table (market-aware) ─────────────────── */}
      <div style={{ position: 'relative' }}>
        <SectionLabel count={market === 'us' ? usStocks.length : stocks.filter(s => (s.price ?? 0) > 0).length}>
          {market === 'us' ? 'US Stocks — Browse & Invest' : 'JSE Securities — Browse & Invest'}
        </SectionLabel>
        {isFree ? (
          <>
            <div style={{ pointerEvents: 'none', filter: 'blur(4px)', opacity: 0.35, userSelect: 'none' }}>
              <StockTable defaultLimit={5} />
            </div>
            <PaywallBlock feature="Full JSE Securities Table" tier="CORE" />
          </>
        ) : market === 'us' ? (
          <StockTable stocks={usStocks} isUS title="US Equities" defaultLimit={20} />
        ) : (
          <StockTable defaultLimit={25} />
        )}
      </div>
    </div>
  );
}
