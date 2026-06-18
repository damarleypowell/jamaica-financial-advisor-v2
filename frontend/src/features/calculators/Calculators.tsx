import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api';
import { useMarketStore } from '../../stores/market';

type Calc = 'compound' | 'returns' | 'dividend' | 'position' | 'optimizer';

const fmt2  = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtJMD = (n: number) => `J$${fmt2(n)}`;

function Field({ label, value, onChange, prefix, suffix, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(var(--fg),.05)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', transition: 'border-color .15s' }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(0,230,118,.4)')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
        {prefix && <span style={{ padding: '0 10px', fontSize: 12, color: 'var(--color-muted)', borderRight: '1px solid var(--color-border)', height: '100%', display: 'flex', alignItems: 'center', background: 'rgba(var(--fg),.02)' }}>{prefix}</span>}
        <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? '0'}
          style={{ flex: 1, padding: '9px 12px', background: 'transparent', border: 'none', fontSize: 13, color: 'var(--color-text)', outline: 'none', fontFamily: 'var(--font-mono)' }} />
        {suffix && <span style={{ padding: '0 10px', fontSize: 12, color: 'var(--color-muted)', borderLeft: '1px solid var(--color-border)', background: 'rgba(var(--fg),.02)' }}>{suffix}</span>}
      </div>
    </div>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: highlight ? 'rgba(0,230,118,.08)' : 'rgba(var(--fg),.03)', border: `1px solid ${highlight ? 'rgba(0,230,118,.2)' : 'rgba(var(--fg),.05)'}` }}>
      <span style={{ fontSize: 12, color: highlight ? 'var(--color-green)' : 'var(--color-text2)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: highlight ? 'var(--color-green)' : 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

function CompoundCalc() {
  const [principal, setPrincipal] = useState('500000');
  const [rate, setRate] = useState('12');
  const [years, setYears] = useState('5');
  const [freq, setFreq] = useState('12');

  const P = parseFloat(principal) || 0;
  const r = (parseFloat(rate) || 0) / 100;
  const t = parseFloat(years) || 0;
  const n = parseFloat(freq) || 12;

  const A = P * Math.pow(1 + r / n, n * t);
  const interest = A - P;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Principal Amount" value={principal} onChange={setPrincipal} prefix="J$" placeholder="500000" />
      <Field label="Annual Interest Rate" value={rate} onChange={setRate} suffix="%" placeholder="12" />
      <Field label="Time Period" value={years} onChange={setYears} suffix="Years" placeholder="5" />
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.1em' }}>Compounding Frequency</label>
        <select value={freq} onChange={e => setFreq(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', background: 'rgba(var(--fg),.05)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, color: 'var(--color-text)', outline: 'none' }}>
          {[['1','Annually'],['4','Quarterly'],['12','Monthly'],['52','Weekly'],['365','Daily']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ResultRow label="Final Amount" value={fmtJMD(A)} highlight />
        <ResultRow label="Interest Earned" value={fmtJMD(interest)} />
        <ResultRow label="Return" value={`${P > 0 ? ((interest/P)*100).toFixed(2) : '0.00'}%`} />
      </div>
    </div>
  );
}

function ReturnsCalc() {
  const [buyPrice, setBuyPrice] = useState('50');
  const [sellPrice, setSellPrice] = useState('65');
  const [shares, setShares] = useState('1000');
  const [fee, setFee] = useState('1');

  const B = parseFloat(buyPrice) || 0;
  const S = parseFloat(sellPrice) || 0;
  const Q = parseFloat(shares) || 0;
  const F = (parseFloat(fee) || 0) / 100;

  const cost     = B * Q * (1 + F);
  const proceeds = S * Q * (1 - F);
  const profit   = proceeds - cost;
  const pct      = cost > 0 ? (profit / cost) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Buy Price (J$)" value={buyPrice} onChange={setBuyPrice} prefix="$" placeholder="50.00" />
      <Field label="Sell Price (J$)" value={sellPrice} onChange={setSellPrice} prefix="$" placeholder="65.00" />
      <Field label="Number of Shares" value={shares} onChange={setShares} placeholder="1000" />
      <Field label="Brokerage Fee" value={fee} onChange={setFee} suffix="%" placeholder="1.0" />
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ResultRow label="Total Cost" value={fmtJMD(cost)} />
        <ResultRow label="Total Proceeds" value={fmtJMD(proceeds)} />
        <ResultRow label="Net Profit/Loss" value={`${profit >= 0 ? '+' : ''}${fmtJMD(profit)}`} highlight />
        <ResultRow label="Return %" value={`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`} />
      </div>
    </div>
  );
}

function DividendCalc() {
  const [price, setPrice] = useState('100');
  const [divPerShare, setDivPerShare] = useState('5');
  const [shares, setShares] = useState('500');

  const P = parseFloat(price) || 0;
  const D = parseFloat(divPerShare) || 0;
  const Q = parseFloat(shares) || 0;

  const yld      = P > 0 ? (D / P) * 100 : 0;
  const annual   = D * Q;
  const monthly  = annual / 12;
  const invested = P * Q;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Stock Price (J$)" value={price} onChange={setPrice} prefix="$" placeholder="100.00" />
      <Field label="Annual Dividend Per Share" value={divPerShare} onChange={setDivPerShare} prefix="$" placeholder="5.00" />
      <Field label="Number of Shares" value={shares} onChange={setShares} placeholder="500" />
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ResultRow label="Dividend Yield" value={`${yld.toFixed(2)}%`} highlight />
        <ResultRow label="Annual Income" value={fmtJMD(annual)} />
        <ResultRow label="Monthly Income" value={fmtJMD(monthly)} />
        <ResultRow label="Amount Invested" value={fmtJMD(invested)} />
      </div>
    </div>
  );
}

function PositionCalc() {
  const [capital, setCapital] = useState('1000000');
  const [risk, setRisk] = useState('2');
  const [entry, setEntry] = useState('50');
  const [stop, setStop] = useState('47');

  const C    = parseFloat(capital) || 0;
  const R    = (parseFloat(risk) || 0) / 100;
  const E    = parseFloat(entry) || 0;
  const SL   = parseFloat(stop) || 0;

  const riskAmt    = C * R;
  const slDiff     = Math.abs(E - SL);
  const shares     = slDiff > 0 ? Math.floor(riskAmt / slDiff) : 0;
  const posValue   = shares * E;
  const posPercent = C > 0 ? (posValue / C) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Account Capital (J$)" value={capital} onChange={setCapital} prefix="$" placeholder="1000000" />
      <Field label="Risk Per Trade" value={risk} onChange={setRisk} suffix="%" placeholder="2" />
      <Field label="Entry Price (J$)" value={entry} onChange={setEntry} prefix="$" placeholder="50.00" />
      <Field label="Stop Loss Price (J$)" value={stop} onChange={setStop} prefix="$" placeholder="47.00" />
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ResultRow label="Max Risk Amount" value={fmtJMD(riskAmt)} />
        <ResultRow label="Shares to Buy" value={shares.toLocaleString()} highlight />
        <ResultRow label="Position Value" value={fmtJMD(posValue)} />
        <ResultRow label="% of Portfolio" value={`${posPercent.toFixed(1)}%`} />
      </div>
    </div>
  );
}

interface OptPosition { symbol: string; shares: string; avgCost: string; }
interface OptResult {
  optimized_weights?: Record<string, number>;
  expected_return?: number;
  expected_volatility?: number;
  sharpe_ratio?: number;
  min_variance_weights?: Record<string, number>;
  max_sharpe_weights?: Record<string, number>;
  note?: string;
}

function PortfolioOptCalc() {
  const stocks = useMarketStore(s => s.stocks);
  const [positions, setPositions] = useState<OptPosition[]>([
    { symbol: '', shares: '100', avgCost: '' },
    { symbol: '', shares: '100', avgCost: '' },
  ]);
  const [riskTolerance, setRiskTolerance] = useState(5);

  const mutation = useMutation<OptResult, Error, void>({
    mutationFn: () => {
      const valid = positions.filter(p => p.symbol.trim());
      if (valid.length < 2) throw new Error('Enter at least 2 symbols');
      const enriched = valid.map(p => {
        const live = stocks.find(s => s.symbol.toUpperCase() === p.symbol.trim().toUpperCase());
        return {
          symbol: p.symbol.trim().toUpperCase(),
          shares: parseInt(p.shares) || 100,
          avgCost: parseFloat(p.avgCost) || live?.price || 0,
          currentPrice: live?.price,
        };
      });
      return apiPost<OptResult>('/api/analytics/portfolio/optimize', { positions: enriched, riskTolerance });
    },
  });

  const updatePos = (i: number, field: keyof OptPosition, val: string) => {
    setPositions(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  };
  const addPos = () => setPositions(prev => [...prev, { symbol: '', shares: '100', avgCost: '' }]);
  const removePos = (i: number) => setPositions(prev => prev.filter((_, idx) => idx !== i));

  const result = mutation.data;
  const weights = result?.max_sharpe_weights ?? result?.optimized_weights;

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '8px 10px', background: 'rgba(var(--fg),.05)',
    border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12,
    color: 'var(--color-text)', outline: 'none', fontFamily: 'var(--font-mono)',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Positions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Portfolio Positions</label>
          {positions.length < 6 && (
            <button onClick={addPos} style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-green)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="fa-solid fa-plus" style={{ fontSize: 9 }} /> Add Stock
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 2fr auto', gap: 6, marginBottom: 2 }}>
          {(['Symbol', 'Shares', 'Avg Cost (J$)', ''] as const).map((h, i) => (
            <span key={i} style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 2px' }}>{h}</span>
          ))}
        </div>
        {positions.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 2fr auto', gap: 6, alignItems: 'center' }}>
            <input value={p.symbol} onChange={e => updatePos(i, 'symbol', e.target.value.toUpperCase())}
              placeholder="e.g. NCB" style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '.05em' }} />
            <input type="number" value={p.shares} onChange={e => updatePos(i, 'shares', e.target.value)}
              placeholder="100" style={inputStyle} />
            <input type="number" value={p.avgCost} onChange={e => updatePos(i, 'avgCost', e.target.value)}
              placeholder="auto" style={inputStyle} />
            <button onClick={() => removePos(i)} disabled={positions.length <= 2}
              style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,82,82,.08)', border: '1px solid rgba(255,82,82,.15)', color: 'var(--color-red)', cursor: positions.length <= 2 ? 'not-allowed' : 'pointer', opacity: positions.length <= 2 ? .3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-xmark" style={{ fontSize: 10 }} />
            </button>
          </div>
        ))}
      </div>

      {/* Risk Tolerance */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Risk Tolerance</label>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>
            {riskTolerance <= 3 ? 'Conservative' : riskTolerance <= 6 ? 'Moderate' : 'Aggressive'} ({riskTolerance}/10)
          </span>
        </div>
        <input type="range" min={1} max={10} value={riskTolerance} onChange={e => setRiskTolerance(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--color-green)', cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 9, color: 'var(--color-muted)' }}>Min Variance</span>
          <span style={{ fontSize: 9, color: 'var(--color-muted)' }}>Max Sharpe</span>
        </div>
      </div>

      <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
        style={{ padding: '11px', borderRadius: 12, background: 'var(--color-green)', border: 'none', fontSize: 13, fontWeight: 800, color: 'var(--color-bg)', cursor: mutation.isPending ? 'not-allowed' : 'pointer', opacity: mutation.isPending ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity .15s' }}>
        {mutation.isPending ? (
          <><div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,.25)', borderTopColor: 'var(--color-bg)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Optimizing...</>
        ) : (
          <><i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: 12 }} /> Run Markowitz Optimization</>
        )}
      </button>

      {mutation.isError && (
        <div style={{ padding: '12px 14px', background: 'rgba(255,82,82,.08)', border: '1px solid rgba(255,82,82,.2)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 12, color: 'var(--color-red)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-red)' }}>
              {mutation.error.message === 'Enter at least 2 symbols'
                ? mutation.error.message
                : 'Optimization service unavailable. Please try again later.'}
            </span>
          </div>
          {mutation.error.message !== 'Enter at least 2 symbols' && (
            <button onClick={() => mutation.mutate()}
              style={{ alignSelf: 'flex-start', padding: '6px 16px', borderRadius: 8, background: 'var(--color-green)', color: 'var(--color-bg)', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Retry
            </button>
          )}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          {result.note && (
            <div style={{ padding: '10px 12px', background: 'rgba(255,215,64,.06)', border: '1px solid rgba(255,215,64,.15)', borderRadius: 10, fontSize: 11, color: 'var(--color-gold)' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />{result.note}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Optimization Results</p>

          {/* Summary metrics */}
          {(result.expected_return !== undefined || result.sharpe_ratio !== undefined) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Exp. Return', value: result.expected_return !== undefined ? `${(result.expected_return * 100).toFixed(2)}%` : '—', color: 'var(--color-green)' },
                { label: 'Volatility', value: result.expected_volatility !== undefined ? `${(result.expected_volatility * 100).toFixed(2)}%` : '—', color: 'var(--color-red)' },
                { label: 'Sharpe Ratio', value: result.sharpe_ratio !== undefined ? result.sharpe_ratio.toFixed(3) : '—', color: 'var(--color-blue)' },
              ].map(m => (
                <div key={m.label} style={{ padding: '10px 12px', background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.06)', borderRadius: 10, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{m.label}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Optimal weights */}
          {weights && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Optimal Allocation</p>
              {Object.entries(weights).sort((a, b) => b[1] - a[1]).map(([sym, w]) => (
                <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-mono)', width: 60, flexShrink: 0 }}>{sym}</span>
                  <div style={{ flex: 1, height: 8, background: 'rgba(var(--fg),.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(w * 100).toFixed(1)}%`, background: 'var(--color-green)', borderRadius: 99, transition: 'width .6s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-green)', width: 52, textAlign: 'right', flexShrink: 0 }}>{(w * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Calculators() {
  const [calc, setCalc] = useState<Calc>('compound');

  const CALCS: { key: Calc; label: string; icon: string; sub: string }[] = [
    { key: 'compound',  label: 'Compound Interest',    icon: 'fa-solid fa-chart-line',            sub: 'Grow your savings over time' },
    { key: 'returns',   label: 'Trade Returns',         icon: 'fa-solid fa-arrow-trend-up',        sub: 'Calculate profit/loss on a trade' },
    { key: 'dividend',  label: 'Dividend Income',       icon: 'fa-solid fa-money-bill-trend-up',   sub: 'Annual dividend yield & income' },
    { key: 'position',  label: 'Position Sizing',       icon: 'fa-solid fa-scale-balanced',        sub: 'Risk-based position sizing' },
    { key: 'optimizer', label: 'Portfolio Optimizer',   icon: 'fa-solid fa-wand-magic-sparkles',   sub: 'Markowitz efficient frontier' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
      {/* Sidebar */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>Calculators</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>Investment tools for JSE traders</p>
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CALCS.map(c => (
            <button key={c.key} onClick={() => setCalc(c.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                background: calc === c.key ? 'rgba(0,230,118,.1)' : 'transparent',
                outline: calc === c.key ? '1px solid rgba(0,230,118,.2)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: calc === c.key ? 'rgba(0,230,118,.15)' : 'rgba(var(--fg),.05)' }}>
                <i className={c.icon} style={{ fontSize: 12, color: calc === c.key ? 'var(--color-green)' : 'var(--color-muted)' }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: calc === c.key ? 'var(--color-green)' : 'var(--color-text)' }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>{c.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Calculator */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>{CALCS.find(c => c.key === calc)?.label}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{CALCS.find(c => c.key === calc)?.sub}</p>
        </div>
        <div style={{ padding: 24 }}>
          {calc === 'compound'  && <CompoundCalc />}
          {calc === 'returns'   && <ReturnsCalc />}
          {calc === 'dividend'  && <DividendCalc />}
          {calc === 'position'  && <PositionCalc />}
          {calc === 'optimizer' && <PortfolioOptCalc />}
        </div>
      </div>
    </div>
  );
}
