import { useState, useMemo, useEffect, useRef } from 'react';

/**
 * Interactive, animated learning simulators for the Learning Hub.
 * Visual-first: every concept is something you DRAG and watch change,
 * not paragraphs to read. Matches the Gotham dark/green aesthetic.
 */

const FONT = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', 'Fira Mono', monospace";
const GREEN = '#00e676';
const BLUE = '#40c4ff';
const GOLD = '#ffd740';
const RED = '#ff5252';

const fmtJ = (n: number) =>
  'J$' + Math.round(n).toLocaleString('en-US');

/* ── Shared slider ─────────────────────────────────────────────────────── */
function Slider({ label, value, min, max, step, onChange, fmt, color = GREEN }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt: (v: number) => string; color?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(var(--fg),.55)', fontFamily: FONT }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: MONO }}>{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 6, borderRadius: 99, appearance: 'none', WebkitAppearance: 'none',
          background: `linear-gradient(90deg, ${color} ${pct}%, rgba(var(--fg),.1) ${pct}%)`,
          outline: 'none', cursor: 'pointer',
        }}
      />
    </div>
  );
}

/* Inject range-thumb styling once (exported so lesson-embedded sims can include it) */
export function SimStyles() {
  return (
    <style>{`
      input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 18px; height: 18px; border-radius: 50%;
        background: #fff; cursor: pointer; border: 3px solid var(--color-bg);
        box-shadow: 0 2px 8px rgba(0,0,0,.5); margin-top: -6px;
      }
      input[type=range]::-moz-range-thumb {
        width: 18px; height: 18px; border-radius: 50%;
        background: #fff; cursor: pointer; border: 3px solid var(--color-bg);
      }
      @keyframes simFadeUp { from { opacity:0; transform: translateY(6px);} to {opacity:1; transform: translateY(0);} }
      @keyframes simDraw { from { stroke-dashoffset: var(--len);} to { stroke-dashoffset: 0;} }
    `}</style>
  );
}

/* Animated count-up number */
function CountUp({ value, prefix = 'J$' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const dur = 500;
    const a = from.current;
    const b = value;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(a + (b - a) * eased);
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);
  return <>{prefix}{Math.round(display).toLocaleString('en-US')}</>;
}

const cardBox: React.CSSProperties = {
  background: 'rgba(var(--fg),.025)', border: '1px solid rgba(var(--fg),.07)',
  borderRadius: 14, padding: '16px 18px',
};

/* ════════════════════════════════════════════════════════════════════════
   1. COMPOUND GROWTH SIMULATOR — the most important wealth concept
   ════════════════════════════════════════════════════════════════════════ */
export function CompoundGrowthSim() {
  const [initial, setInitial] = useState(50000);
  const [monthly, setMonthly] = useState(10000);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(20);

  const series = useMemo(() => {
    const out: { year: number; balance: number; contributed: number }[] = [];
    let bal = initial;
    let contributed = initial;
    const r = rate / 100 / 12;
    out.push({ year: 0, balance: bal, contributed });
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) { bal = bal * (1 + r) + monthly; contributed += monthly; }
      out.push({ year: y, balance: bal, contributed });
    }
    return out;
  }, [initial, monthly, rate, years]);

  const final = series[series.length - 1];
  const growth = final.balance - final.contributed;
  const maxBal = final.balance || 1;

  // Build SVG paths (0..100 viewBox, inverted Y)
  const W = 300, H = 140;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - (v / maxBal) * H;
  const linePts = series.map((p, i) => `${x(i)},${y(p.balance)}`).join(' ');
  const contribPts = series.map((p, i) => `${x(i)},${y(p.contributed)}`).join(' ');
  const areaPath = `M0,${H} L${series.map((p, i) => `${x(i)},${y(p.balance)}`).join(' L')} L${W},${H} Z`;
  const lineLen = 900;

  return (
    <div style={{ animation: 'simFadeUp .3s ease' }}>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'rgba(var(--fg),.5)', lineHeight: 1.6, fontFamily: FONT }}>
        The single most powerful force in investing. Drag the sliders and watch how small, consistent
        contributions snowball over time — the <span style={{ color: GREEN, fontWeight: 700 }}>green area</span> is
        what your money <em>earns on its own</em>.
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 150, marginBottom: 14, overflow: 'visible' }}>
        <defs>
          <linearGradient id="cgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity=".28" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map(g => (
          <line key={g} x1={0} y1={H * g} x2={W} y2={H * g} stroke="rgba(var(--fg),.05)" strokeWidth={1} />
        ))}
        <path d={areaPath} fill="url(#cgGrad)" style={{ transition: 'd .4s ease' }} />
        {/* contributions line (what you put in) */}
        <polyline points={contribPts} fill="none" stroke="rgba(var(--fg),.35)" strokeWidth={1.5} strokeDasharray="4 3" />
        {/* balance line */}
        <polyline
          key={`${initial}-${monthly}-${rate}-${years}`}
          points={linePts} fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round"
          style={{ ['--len' as string]: lineLen, strokeDasharray: lineLen, animation: 'simDraw .7s ease forwards' }}
        />
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div style={{ ...cardBox, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'rgba(var(--fg),.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>You put in</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: MONO, marginTop: 3 }}><CountUp value={final.contributed} /></div>
        </div>
        <div style={{ ...cardBox, padding: '10px 12px', textAlign: 'center', borderColor: 'rgba(0,230,118,.25)', background: 'rgba(0,230,118,.06)' }}>
          <div style={{ fontSize: 9, color: GREEN, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Growth (free)</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: GREEN, fontFamily: MONO, marginTop: 3 }}><CountUp value={growth} /></div>
        </div>
        <div style={{ ...cardBox, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'rgba(var(--fg),.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Final value</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: BLUE, fontFamily: MONO, marginTop: 3 }}><CountUp value={final.balance} /></div>
        </div>
      </div>

      <Slider label="Starting amount" value={initial} min={0} max={500000} step={5000} onChange={setInitial} fmt={fmtJ} />
      <Slider label="Monthly contribution" value={monthly} min={0} max={50000} step={1000} onChange={setMonthly} fmt={fmtJ} color={BLUE} />
      <Slider label="Annual return" value={rate} min={1} max={20} step={0.5} onChange={setRate} fmt={v => `${v}%`} color={GOLD} />
      <Slider label="Years invested" value={years} min={1} max={40} step={1} onChange={setYears} fmt={v => `${v} yr`} color={GREEN} />

      <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(0,230,118,.06)', border: '1px solid rgba(0,230,118,.18)' }}>
        <span style={{ fontSize: 11.5, color: 'rgba(var(--fg),.6)', fontFamily: FONT, lineHeight: 1.6 }}>
          💡 At these settings, <strong style={{ color: GREEN }}>{Math.round((growth / final.balance) * 100)}%</strong> of your
          final wealth came from <strong>growth</strong>, not from money you saved. That's compounding — and it gets
          dramatically bigger the longer you stay invested.
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   2. CANDLESTICK ANATOMY — drag O/H/L/C and watch the candle morph
   ════════════════════════════════════════════════════════════════════════ */
export function CandlestickSim() {
  const [open, setOpen] = useState(40);
  const [close, setClose] = useState(62);
  const [high, setHigh] = useState(75);
  const [low, setLow] = useState(28);

  // keep ordering sane
  const hi = Math.max(high, open, close);
  const lo = Math.min(low, open, close);
  const bull = close >= open;
  const color = bull ? GREEN : RED;

  // map price (0..100) to svg y (chart 0..200, inverted)
  const CH = 220;
  const yOf = (p: number) => CH - (p / 100) * CH;
  const bodyTop = yOf(Math.max(open, close));
  const bodyH = Math.max(4, Math.abs(yOf(open) - yOf(close)));
  const cx = 150;

  return (
    <div style={{ animation: 'simFadeUp .3s ease' }}>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'rgba(var(--fg),.5)', lineHeight: 1.6, fontFamily: FONT }}>
        Every candle tells a story of one time period. Drag the four prices and watch the candle rebuild itself.
        A <span style={{ color: GREEN, fontWeight: 700 }}>green</span> body means it closed higher than it opened;{' '}
        <span style={{ color: RED, fontWeight: 700 }}>red</span> means it fell.
      </p>

      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <svg viewBox="0 0 300 220" style={{ width: 150, height: 220, flexShrink: 0 }}>
          {/* upper wick */}
          <line x1={cx} y1={yOf(hi)} x2={cx} y2={bodyTop} stroke={color} strokeWidth={2.5} />
          {/* lower wick */}
          <line x1={cx} y1={bodyTop + bodyH} x2={cx} y2={yOf(lo)} stroke={color} strokeWidth={2.5} />
          {/* body */}
          <rect x={cx - 26} y={bodyTop} width={52} height={bodyH} rx={3} fill={color} fillOpacity={bull ? 0.85 : 0.85}
            style={{ transition: 'y .15s, height .15s' }} />
          {/* labels */}
          <line x1={cx + 34} y1={yOf(hi)} x2={cx + 70} y2={yOf(hi)} stroke="rgba(var(--fg),.2)" strokeWidth={1} strokeDasharray="2 2" />
          <text x={cx + 74} y={yOf(hi) + 3} fill="rgba(var(--fg),.5)" fontSize={9} fontFamily={MONO}>High</text>
          <line x1={cx + 34} y1={yOf(lo)} x2={cx + 70} y2={yOf(lo)} stroke="rgba(var(--fg),.2)" strokeWidth={1} strokeDasharray="2 2" />
          <text x={cx + 74} y={yOf(lo) + 3} fill="rgba(var(--fg),.5)" fontSize={9} fontFamily={MONO}>Low</text>
          <text x={cx - 90} y={yOf(open) + 3} fill={GREEN} fontSize={9} fontFamily={MONO}>Open</text>
          <text x={cx - 92} y={yOf(close) + 3} fill={BLUE} fontSize={9} fontFamily={MONO}>Close</text>
        </svg>

        <div style={{ flex: 1, minWidth: 180 }}>
          <Slider label="Open" value={open} min={5} max={95} step={1} onChange={setOpen} fmt={v => `J$${v}`} color={GREEN} />
          <Slider label="Close" value={close} min={5} max={95} step={1} onChange={setClose} fmt={v => `J$${v}`} color={BLUE} />
          <Slider label="High" value={high} min={5} max={100} step={1} onChange={setHigh} fmt={v => `J$${v}`} color={GOLD} />
          <Slider label="Low" value={low} min={0} max={95} step={1} onChange={setLow} fmt={v => `J$${v}`} color={RED} />
        </div>
      </div>

      <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: `${color}10`, border: `1px solid ${color}30` }}>
        <span style={{ fontSize: 11.5, color: 'rgba(var(--fg),.65)', fontFamily: FONT, lineHeight: 1.6 }}>
          {bull
            ? <>📈 <strong style={{ color: GREEN }}>Bullish candle.</strong> Buyers won this period — it closed J${close - open} above the open. The body is the open→close range; the thin wicks show how far price spiked before settling.</>
            : <>📉 <strong style={{ color: RED }}>Bearish candle.</strong> Sellers won — it closed J${open - close} below the open. Long wicks mean price tried to move but got rejected.</>}
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   3. DIVERSIFICATION — watch risk shrink as you add holdings
   ════════════════════════════════════════════════════════════════════════ */
export function DiversificationSim() {
  const [holdings, setHoldings] = useState(1);

  // Unsystematic (diversifiable) risk falls ~1/sqrt(n); market risk stays.
  const marketRisk = 18; // % floor
  const totalRisk = useMemo(() => marketRisk + 32 / Math.sqrt(holdings), [holdings]);
  const riskPct = Math.min(100, (totalRisk / 50) * 100);
  const riskColor = totalRisk > 38 ? RED : totalRisk > 26 ? GOLD : GREEN;

  return (
    <div style={{ animation: 'simFadeUp .3s ease' }}>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'rgba(var(--fg),.5)', lineHeight: 1.6, fontFamily: FONT }}>
        "Don't put all your eggs in one basket." Add more stocks and watch your portfolio's wild swings
        calm down. There's a floor though — <span style={{ color: BLUE, fontWeight: 700 }}>market risk</span> can
        never be fully removed.
      </p>

      {/* holdings dots */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, minHeight: 52 }}>
        {Array.from({ length: holdings }).map((_, i) => (
          <div key={i} style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: 'rgba(0,230,118,.12)', border: '1px solid rgba(0,230,118,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'simFadeUp .25s ease',
          }}>
            <span style={{ fontSize: 11 }}>📈</span>
          </div>
        ))}
      </div>

      {/* risk meter */}
      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(var(--fg),.55)', fontFamily: FONT }}>Portfolio volatility (risk)</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: riskColor, fontFamily: MONO }}>{totalRisk.toFixed(1)}%</span>
      </div>
      <div style={{ position: 'relative', height: 14, borderRadius: 99, background: 'rgba(var(--fg),.06)', overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ position: 'absolute', inset: 0, width: `${riskPct}%`, background: riskColor, borderRadius: 99, transition: 'width .35s cubic-bezier(.4,0,.2,1), background .35s' }} />
        {/* market-risk floor marker */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(marketRisk / 50) * 100}%`, width: 2, background: BLUE }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 6, marginBottom: 16 }}>
        <span style={{ fontSize: 9.5, color: BLUE, fontFamily: FONT }}>◀ market-risk floor (can't diversify away)</span>
      </div>

      <Slider label="Number of stocks" value={holdings} min={1} max={20} step={1} onChange={setHoldings} fmt={v => `${v} stock${v > 1 ? 's' : ''}`} />

      <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(64,196,255,.06)', border: '1px solid rgba(64,196,255,.18)' }}>
        <span style={{ fontSize: 11.5, color: 'rgba(var(--fg),.6)', fontFamily: FONT, lineHeight: 1.6 }}>
          {holdings === 1
            ? '⚠️ One stock = maximum risk. If that single company stumbles, your whole portfolio does too.'
            : holdings < 8
              ? `📊 ${holdings} stocks already cut a lot of company-specific risk. Most of the benefit comes from the first ~10–15 holdings.`
              : '✅ Well diversified. Adding more barely helps now — you\'re close to the market-risk floor. This is why index funds hold hundreds of stocks.'}
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Container with a segmented control
   ════════════════════════════════════════════════════════════════════════ */
const SIMS = [
  { key: 'compound', label: 'Compound Growth', icon: '🌱', el: <CompoundGrowthSim /> },
  { key: 'candle', label: 'Candle Anatomy', icon: '🕯️', el: <CandlestickSim /> },
  { key: 'diversify', label: 'Diversification', icon: '🧺', el: <DiversificationSim /> },
];

export default function InteractiveSimulators() {
  const [active, setActive] = useState('compound');
  const current = SIMS.find(s => s.key === active) ?? SIMS[0];

  return (
    <section>
      <SimStyles />
      <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT }}>
        <span style={{ fontSize: 16 }}>🎮</span> Interactive Simulators
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'rgba(var(--fg),.4)', fontFamily: FONT }}>
        Learn by doing — drag, tweak, and watch. No jargon walls.
      </p>

      {/* segmented control */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        {SIMS.map(s => {
          const on = s.key === active;
          return (
            <button key={s.key} onClick={() => setActive(s.key)} style={{
              display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
              padding: '9px 14px', borderRadius: 11, cursor: 'pointer', fontFamily: FONT,
              fontSize: 12.5, fontWeight: 700,
              background: on ? 'rgba(0,230,118,.12)' : 'rgba(var(--fg),.03)',
              border: `1px solid ${on ? 'rgba(0,230,118,.35)' : 'rgba(var(--fg),.08)'}`,
              color: on ? GREEN : 'rgba(var(--fg),.55)',
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span>{s.label}
            </button>
          );
        })}
      </div>

      <div style={{ ...cardBox, padding: '18px 18px 16px' }}>
        {current.el}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   LESSON-EMBEDDED INTERACTIVE WIDGETS (rendered inside individual lessons)
   ════════════════════════════════════════════════════════════════════════ */

/* Moving averages — drag the window and watch the line smooth + trend flip */
export function MovingAverageSim() {
  const [win, setWin] = useState(5);
  const prices = [42, 45, 41, 47, 52, 49, 55, 53, 60, 58, 64, 61, 68, 66, 72];
  const ma = prices.map((_, i) => {
    const slice = prices.slice(Math.max(0, i - win + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const min = 38, max = 76, W = 300, H = 150;
  const xs = (i: number) => (i / (prices.length - 1)) * W;
  const ys = (v: number) => H - ((v - min) / (max - min)) * H;
  const pricePts = prices.map((p, i) => `${xs(i)},${ys(p)}`).join(' ');
  const maPts = ma.map((v, i) => `${xs(i)},${ys(v)}`).join(' ');
  const bull = prices[prices.length - 1] > ma[ma.length - 1];
  return (
    <div style={{ animation: 'simFadeUp .3s ease' }}>
      <SimStyles />
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'rgba(var(--fg),.5)', lineHeight: 1.6, fontFamily: FONT }}>
        A moving average smooths out the noise to reveal the <em>trend</em>. Drag the window: a short average
        hugs the price and reacts fast; a long one is smoother but slower.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 150, marginBottom: 14, overflow: 'visible' }}>
        {[0.25, 0.5, 0.75].map(g => <line key={g} x1={0} y1={H * g} x2={W} y2={H * g} stroke="rgba(var(--fg),.05)" strokeWidth={1} />)}
        <polyline points={pricePts} fill="none" stroke="rgba(var(--fg),.4)" strokeWidth={1.5} />
        <polyline points={maPts} fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinejoin="round" style={{ transition: 'all .25s' }} />
        <circle cx={xs(prices.length - 1)} cy={ys(prices[prices.length - 1])} r={4} fill={bull ? GREEN : RED} />
      </svg>
      <div style={{ display: 'flex', gap: 14, marginBottom: 12, fontSize: 10.5, fontFamily: FONT }}>
        <span style={{ color: 'rgba(var(--fg),.5)' }}>▬ Price</span>
        <span style={{ color: GOLD }}>▬ {win}-period MA</span>
      </div>
      <Slider label="Moving-average window" value={win} min={2} max={10} step={1} onChange={setWin} fmt={v => `${v} periods`} color={GOLD} />
      <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 10, background: `${bull ? GREEN : RED}10`, border: `1px solid ${bull ? GREEN : RED}30` }}>
        <span style={{ fontSize: 11.5, color: 'rgba(var(--fg),.65)', fontFamily: FONT, lineHeight: 1.6 }}>
          {bull
            ? '📈 Price is ABOVE its moving average — generally read as an uptrend. A cross back below is a common exit signal.'
            : '📉 Price is BELOW its moving average — generally read as weakness or a downtrend.'}
        </span>
      </div>
    </div>
  );
}

/* RSI gauge — drag the value and see overbought / oversold */
export function RSISim() {
  const [rsi, setRsi] = useState(50);
  const zone = rsi >= 70 ? 'Overbought' : rsi <= 30 ? 'Oversold' : 'Neutral';
  const color = rsi >= 70 ? RED : rsi <= 30 ? GREEN : GOLD;
  return (
    <div style={{ animation: 'simFadeUp .3s ease' }}>
      <SimStyles />
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'rgba(var(--fg),.5)', lineHeight: 1.6, fontFamily: FONT }}>
        RSI measures momentum on a 0–100 scale. Drag it and watch the zone change — above 70 is often
        “overbought” (may pull back), below 30 is “oversold” (may bounce).
      </p>
      <div style={{ position: 'relative', height: 22, borderRadius: 99, overflow: 'hidden', marginBottom: 10,
        background: 'linear-gradient(90deg, #00e676 0%, #00e676 30%, #2a2f2a 30%, #2a2f2a 70%, #ff5252 70%, #ff5252 100%)' }}>
        <div style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${rsi}% - 2px)`, width: 4, background: '#fff', borderRadius: 2, boxShadow: '0 0 8px rgba(var(--fg),.6)', transition: 'left .15s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'rgba(var(--fg),.4)', fontFamily: MONO, marginBottom: 16 }}>
        <span style={{ color: GREEN }}>0 · Oversold</span><span>50</span><span style={{ color: RED }}>Overbought · 100</span>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 30, fontWeight: 900, color, fontFamily: MONO }}>{rsi}</span>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color, letterSpacing: '.08em', textTransform: 'uppercase' }}>{zone}</span>
      </div>
      <Slider label="RSI value" value={rsi} min={0} max={100} step={1} onChange={setRsi} fmt={v => `${v}`} color={color} />
      <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 10, background: `${color}10`, border: `1px solid ${color}30` }}>
        <span style={{ fontSize: 11.5, color: 'rgba(var(--fg),.65)', fontFamily: FONT, lineHeight: 1.6 }}>
          {rsi >= 70 ? '⚠️ Overbought: risen fast, may be due for a pause. Not an automatic “sell” — strong stocks can stay overbought.'
            : rsi <= 30 ? '💎 Oversold: selling may be overdone and a bounce is possible. Confirm with price action first.'
            : '⚖️ Neutral: no momentum extreme. RSI is most useful near the 30 and 70 edges.'}
        </span>
      </div>
    </div>
  );
}

/* P/E ratio calculator — set price & earnings, compare to sector */
export function PEComparisonSim() {
  const [price, setPrice] = useState(60);
  const [eps, setEps] = useState(5);
  const sectorAvg = 12;
  const pe = eps > 0 ? price / eps : 0;
  const verdict = eps <= 0 ? 'No earnings' : pe < sectorAvg * 0.8 ? 'Cheap vs sector' : pe > sectorAvg * 1.2 ? 'Expensive vs sector' : 'Fairly valued';
  const vColor = eps <= 0 ? RED : pe < sectorAvg * 0.8 ? GREEN : pe > sectorAvg * 1.2 ? RED : GOLD;
  const barMax = 30;
  const bars: [string, number, string][] = [['This stock', Math.min(pe, barMax), vColor], ['Sector avg', sectorAvg, 'rgba(var(--fg),.4)']];
  return (
    <div style={{ animation: 'simFadeUp .3s ease' }}>
      <SimStyles />
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'rgba(var(--fg),.5)', lineHeight: 1.6, fontFamily: FONT }}>
        The P/E ratio = price ÷ earnings per share — how many dollars you pay for J$1 of annual profit.
        Set a price and EPS, then compare to a typical sector average of {sectorAvg}×.
      </p>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 30, fontWeight: 900, color: vColor, fontFamily: MONO }}>{eps > 0 ? pe.toFixed(1) + '×' : '—'}</span>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: vColor }}>{verdict}</span>
      </div>
      {bars.map(([label, val, c]) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(var(--fg),.5)', marginBottom: 3, fontFamily: FONT }}>
            <span>{label}</span><span style={{ fontFamily: MONO }}>{val.toFixed(1)}×</span>
          </div>
          <div style={{ height: 12, borderRadius: 99, background: 'rgba(var(--fg),.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(val / barMax) * 100}%`, background: c, borderRadius: 99, transition: 'width .3s' }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <Slider label="Share price" value={price} min={5} max={300} step={5} onChange={setPrice} fmt={fmtJ} color={BLUE} />
        <Slider label="Earnings per share (annual)" value={eps} min={0} max={25} step={0.5} onChange={setEps} fmt={v => `J$${v}`} color={GREEN} />
      </div>
      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(64,196,255,.06)', border: '1px solid rgba(64,196,255,.18)' }}>
        <span style={{ fontSize: 11.5, color: 'rgba(var(--fg),.6)', fontFamily: FONT, lineHeight: 1.6 }}>
          💡 A high P/E isn’t automatically “bad” — it can mean investors expect fast growth. Always compare within the same sector.
        </span>
      </div>
    </div>
  );
}

/* Risk profile — slide your age, watch your suggested allocation shift */
export function RiskProfileSim() {
  const [age, setAge] = useState(28);
  const stocks = Math.max(20, Math.min(95, 110 - age));
  const bonds = Math.round((100 - stocks) * 0.65);
  const cash = 100 - stocks - bonds;
  const segs = [
    { label: 'Stocks', val: stocks, color: GREEN },
    { label: 'Bonds', val: bonds, color: BLUE },
    { label: 'Cash', val: cash, color: GOLD },
  ];
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={{ animation: 'simFadeUp .3s ease' }}>
      <SimStyles />
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'rgba(var(--fg),.5)', lineHeight: 1.6, fontFamily: FONT }}>
        A classic rule of thumb: hold roughly <strong style={{ color: '#fff' }}>(110 − your age)%</strong> in
        stocks, with the rest in safer bonds and cash. Drag your age and watch the mix shift from
        growth-focused to safety-focused.
      </p>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <svg viewBox="0 0 140 140" style={{ width: 130, height: 130, flexShrink: 0 }}>
          <circle cx={70} cy={70} r={R} fill="none" stroke="rgba(var(--fg),.06)" strokeWidth={16} />
          {segs.map(s => {
            const len = (s.val / 100) * C;
            const el = (
              <circle key={s.label} cx={70} cy={70} r={R} fill="none" stroke={s.color} strokeWidth={16}
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
                transform="rotate(-90 70 70)" style={{ transition: 'stroke-dasharray .35s, stroke-dashoffset .35s' }} />
            );
            offset += len;
            return el;
          })}
          <text x={70} y={66} textAnchor="middle" fill="#fff" fontSize={18} fontWeight={800} fontFamily={MONO}>{stocks}%</text>
          <text x={70} y={82} textAnchor="middle" fill="rgba(var(--fg),.4)" fontSize={8} fontFamily={FONT}>in stocks</text>
        </svg>
        <div style={{ flex: 1, minWidth: 140 }}>
          {segs.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(var(--fg),.6)', fontFamily: FONT, flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: s.color, fontFamily: MONO }}>{s.val}%</span>
            </div>
          ))}
        </div>
      </div>
      <Slider label="Your age" value={age} min={18} max={70} step={1} onChange={setAge} fmt={v => `${v} yrs`} color={GREEN} />
      <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(0,230,118,.06)', border: '1px solid rgba(0,230,118,.18)' }}>
        <span style={{ fontSize: 11.5, color: 'rgba(var(--fg),.6)', fontFamily: FONT, lineHeight: 1.6 }}>
          {age <= 30 ? '🚀 Young = long runway. You can ride out crashes, so a higher stock weighting captures more growth.'
            : age <= 50 ? '⚖️ Mid-career: still growth-tilted, but bonds start cushioning the ride.'
            : '🛡️ Closer to needing the money: safety matters more, so the mix leans to bonds and cash. Adjust to your own comfort.'}
        </span>
      </div>
    </div>
  );
}
