import { useEffect, useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../../stores/market';
import { useAuthStore } from '../../stores/auth';
import { apiGet, apiPost } from '../../lib/api';
import MainChart from './MainChart';
import StockPanel from './StockPanel';
import StockTable from './StockTable';

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
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
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
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', fontFamily: SANS, fontWeight: 700 }}>{firstName}</span>
              <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,.1)', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.28)', fontFamily: MONO }}>{jamTime} · JA</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              {jse > 0 ? (
                <>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: INTER, marginBottom: 4 }}>{marketLabel}</div>
                    <div style={{ fontSize: 36, fontWeight: 800, fontFamily: INTER, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>
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
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontFamily: SANS }}>today</span>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: INTER, marginBottom: 8 }}>{marketLabel}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: INTER, color: 'rgba(255,255,255,.85)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
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
                {flat > 0 && <div style={{ flex: flat, background: 'rgba(255,255,255,.1)', transition: 'flex .6s ease' }} />}
                {decCount > 0 && <div style={{ flex: decCount, background: '#ff5252', borderRadius: '0 99px 99px 0', transition: 'flex .6s ease' }} />}
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                {advCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#00e676', fontFamily: MONO }}>↑ {advCount} up</span>}
                {flat > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.28)', fontFamily: MONO }}>{flat} flat</span>}
                {decCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#ff5252', fontFamily: MONO }}>↓ {decCount} down</span>}
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', fontFamily: SANS, marginLeft: 'auto' }}>{total} securities</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: status + volume */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
          {/* Status pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 99,
            background: mktOpen ? 'rgba(0,230,118,.12)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${mktOpen ? 'rgba(0,230,118,.3)' : 'rgba(255,255,255,.08)'}`,
            boxShadow: mktOpen ? '0 0 24px rgba(0,230,118,.15)' : 'none',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', display: 'block',
              background: mktOpen ? '#00e676' : isConn ? '#ffd740' : 'rgba(255,255,255,.2)',
              boxShadow: mktOpen ? '0 0 10px rgba(0,230,118,.8)' : 'none',
            }} className={mktOpen ? 'animate-pulse-dot' : ''} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', fontFamily: SANS, color: mktOpen ? '#00e676' : 'rgba(255,255,255,.4)', textTransform: 'uppercase' }}>
              {mktOpen ? 'Live' : 'Closed'}
            </span>
          </div>

          {volume > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.28)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: SANS }}>Volume</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: INTER, color: 'rgba(255,255,255,.85)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
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
      background: `linear-gradient(145deg, ${accent}08 0%, transparent 60%), #080d18`,
      border: `1px solid ${hov ? accent + '30' : 'rgba(255,255,255,.055)'}`,
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
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: SANS }}>{label}</span>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: accent + '14', border: `1px solid ${accent}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`fa-solid ${icon}`} style={{ fontSize: 11, color: accent }} />
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, fontFamily: INTER, letterSpacing: "-0.025em", lineHeight: 1, color: '#fff' }}>{value}</div>
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
        <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: SANS }}>{children}</span>
        {count !== undefined && (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.2)', fontFamily: MONO }}>{count}</span>
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
        background: isSelected ? chgColor + '14' : hov ? chgColor + '09' : 'rgba(255,255,255,.025)',
        border: `1px solid ${active ? chgColor + '40' : 'rgba(255,255,255,.05)'}`,
        transition: 'all .15s',
        boxShadow: isSelected ? `0 4px 20px ${chgColor}18` : 'none',
        position: 'relative', overflow: 'hidden',
      }}>
      {isSelected && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: chgColor, opacity: 0.7 }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: MONO }}>{s.symbol}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: pos ? '#00e676' : '#ff5252', fontFamily: MONO }}>
          {pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%
        </span>
      </div>
      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: INTER, color: 'rgba(255,255,255,.9)', letterSpacing: '-0.01em' }}>
        ${fmt(s.price)}
      </span>
      {s.volume != null && (
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.22)', fontFamily: MONO }}>
          Vol: {fmtVol(s.volume)}
        </span>
      )}
    </button>
  );
}

/* ── Paywall block ────────────────────────────────────────────── */
function PaywallBlock({ feature, tier }: { feature: string; tier: string }) {
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,200,83,.2)', background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(8px)', padding: '36px 24px', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,200,83,.1)', border: '1px solid rgba(0,200,83,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <i className="fa-solid fa-lock" style={{ fontSize: 20, color: '#00c853' }} />
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#fff' }}>{feature}</p>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: 'rgba(255,255,255,.45)' }}>Requires a <strong style={{ color: '#00c853' }}>{tier}</strong> plan or higher</p>
      <a href="/subscription" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 22px', borderRadius: 10, background: '#00c853', color: '#000', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>
        <i className="fa-solid fa-arrow-up" style={{ fontSize: 10 }} /> Upgrade Now
      </a>
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
      background: 'linear-gradient(135deg, #040e08 0%, #071209 50%, #030b06 100%)',
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
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)',
            textDecoration: 'none', letterSpacing: '.04em',
            padding: '4px 10px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,.07)',
            background: 'rgba(255,255,255,.03)',
            transition: 'all .15s',
          }}>
            View Portfolio <i className="fa-solid fa-arrow-right" style={{ fontSize: 8 }} />
          </a>
        </div>

        {/* Net worth headline */}
        <div style={{ marginBottom: 6 }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.28)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: SANS }}>Total Wealth</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 40, fontWeight: 900, fontFamily: SANS, letterSpacing: '-0.04em', lineHeight: 1, color: '#fff' }}>
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
        <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.05)', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.25)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Invested</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, fontFamily: MONO, color: 'rgba(255,255,255,.85)', letterSpacing: '-0.01em' }}>J${fmt(portfolioValue)}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.25)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Cash</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, fontFamily: MONO, color: 'rgba(255,255,255,.85)', letterSpacing: '-0.01em' }}>J${fmt(walletBalance)}</p>
          </div>
          {totalGain !== 0 && (
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.25)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Total Return</p>
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
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
            color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 700, fontFamily: SANS,
            transition: 'all .15s',
          }}>
            <i className="fa-solid fa-bullseye" style={{ fontSize: 11 }} />
            Set a Goal
          </button>
          <button onClick={() => navigate('/chat')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
            color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 700, fontFamily: SANS,
            transition: 'all .15s',
          }}>
            <i className="fa-solid fa-robot" style={{ fontSize: 12, color: '#00e676' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { user, isAuthenticated } = useAuthStore();
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
  const { data: walletData } = useQuery<Record<string, number>>({
    queryKey: ['wallet'],
    queryFn: () => apiGet<Record<string, number>>('/api/wallet/balance'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
  const { data: posData } = useQuery<Record<string, unknown>>({
    queryKey: ['positions'],
    queryFn: () => apiGet<Record<string, unknown>>('/api/portfolio/positions'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

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

  const US_POPULAR = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'JPM', 'BRK/B', 'V', 'UNH', 'XOM', 'NFLX', 'AMD', 'DIS', 'BABA', 'PYPL', 'INTC'];

  const { data: usData, isError: usError } = useQuery<Record<string, number>[]>({
    queryKey: ['us-dashboard', usSearch || 'popular'],
    queryFn: async () => {
      const symbols = usSearch.trim()
        ? [usSearch.trim().toUpperCase()]
        : US_POPULAR.filter(s => !s.includes('/'));
      const res = await apiPost<unknown>('/api/us/quotes', { symbols });
      if (Array.isArray(res)) return res as Record<string, number>[];
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
  const mktOpen = d >= 1 && d <= 5 && m >= 570 && m < 810;

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

      {/* ── Wealth hero (logged-in users) ─────────────────── */}
      {isAuthenticated && (
        <WealthHero
          portfolioValue={portfolioValue}
          totalGain={totalGain}
          totalGainPct={totalGainPct}
          walletBalance={walletBalance}
          firstName={firstName}
          navigate={navigate}
        />
      )}

      {/* ── FREE tier upgrade banner ──────────────────────── */}
      {isFree && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '14px 20px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,200,83,.08) 0%, rgba(0,180,255,.06) 100%)', border: '1px solid rgba(0,200,83,.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🚀</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>You're on the Free plan — limited to JSE preview only</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Upgrade to Basic for full JSE + US Markets, charts, portfolio, alerts & more.</p>
            </div>
          </div>
          <a href="/subscription" style={{ flexShrink: 0, padding: '8px 20px', borderRadius: 10, background: '#00c853', color: '#000', fontSize: 12, fontWeight: 800, textDecoration: 'none', letterSpacing: '.02em' }}>Upgrade — $19.99/mo</a>
        </div>
      )}

      {/* ── 0. Market toggle ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
          {([['us', '🇺🇸 US Markets'], ['caribbean', '🌴 Caribbean']] as const).map(([key, label]) => (
            <button key={key} onClick={() => { if (isFree && key === 'us') { window.location.href = '/subscription'; return; } setMarket(key); }}
              style={{
                padding: '7px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: INTER, transition: 'all .15s',
                background: market === key ? (key === 'us' ? 'rgba(64,196,255,.15)' : 'rgba(0,230,118,.15)') : 'transparent',
                color: market === key ? (key === 'us' ? '#40c4ff' : '#00e676') : 'rgba(255,255,255,.35)',
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
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              color: '#fff', fontSize: 12, fontFamily: INTER, outline: 'none', width: 160,
            }}
          />
        )}
      </div>

      {/* ── US unavailable notice ───────────────────────────────── */}
      {usUnavailable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, background: 'rgba(255,215,64,.06)', border: '1px solid rgba(255,215,64,.18)', fontSize: 12, color: 'rgba(255,215,64,.8)', fontFamily: INTER }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 11, color: '#ffd740' }} />
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
        mktOpen={market === 'us' ? true : mktOpen}
        isConn={isConn}
        advCount={market === 'us' ? usStocks.filter(s => (s.pctChange ?? 0) > 0).length : advCount}
        decCount={market === 'us' ? usStocks.filter(s => (s.pctChange ?? 0) < 0).length : decCount}
        total={market === 'us' ? usStocks.length : stocks.length}
        marketLabel={market === 'us' ? 'S&P 500 (SPY)' : 'Caribbean Markets'}
        isUS={market === 'us'}
      />

      {/* ── 2. KPI tiles ────────────────────────────────────────── */}
      <div className="mobile-hide" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
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
            <div style={{ display: 'flex', gap: 2, padding: '3px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
              {MOVER_TABS.map(tab => (
                <button key={tab.key} onClick={() => setMoverTab(tab.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 9,
                  fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                  fontFamily: SANS, letterSpacing: '.02em',
                  background: moverTab === tab.key ? tab.color + '18' : 'transparent',
                  color: moverTab === tab.key ? tab.color : 'rgba(255,255,255,.3)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 4px', color: 'rgba(255,255,255,.2)', fontSize: 12, fontFamily: SANS }}>
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
          <PaywallBlock feature="Advanced Charts & Real-Time Data" tier="BASIC" />
        ) : (
          <div className="dashboard-grid">
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.055)', background: '#080d18', boxShadow: '0 4px 32px rgba(0,0,0,.4)' }}>
              <MainChart symbol={selectedSymbol} isUS={market === 'us'} />
            </div>
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.055)', background: '#080d18' }}>
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
            <PaywallBlock feature="Full JSE Securities Table" tier="BASIC" />
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
