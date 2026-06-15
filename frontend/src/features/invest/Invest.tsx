import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../../stores/market';
import type { Stock } from '../../types';

const HEAD = "'Syne', sans-serif";
const MONO = "'JetBrains Mono', monospace";
const f2 = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Curated blue chips matched flexibly against live data (symbol or name keyword),
// so it works regardless of the exact ticker the scraper uses.
const BLUE_CHIPS = [
  { match: ['NCBFG', 'NCB'],        why: "Jamaica's largest financial group" },
  { match: ['GK', 'GRACE'],         why: 'Food, banking & insurance giant' },
  { match: ['SJ', 'SAGICOR'],       why: 'A leading Caribbean insurer' },
  { match: ['JMMB'],                why: 'Regional investment & banking' },
  { match: ['WISYNCO', 'WIS'],      why: 'Beverages & distribution leader' },
  { match: ['PJAM', 'PANJAM'],      why: 'Property & investments' },
];

function PickCard({ stock, why, onClick }: { stock: Stock; why?: string; onClick: () => void }) {
  const pos = (stock.pctChange ?? 0) >= 0;
  return (
    <button onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderRadius: 14, background: 'var(--color-bg2)', border: '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s, transform .15s', width: '100%' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,230,118,.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = ''; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: pos ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 900, fontFamily: MONO, color: pos ? '#00e676' : '#ff5252' }}>{stock.symbol.slice(0, 3)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, fontFamily: MONO, color: 'var(--color-text)' }}>{stock.symbol}</p>
          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: MONO, color: 'var(--color-text)' }}>J${f2(stock.price)}</p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, fontFamily: MONO, color: pos ? '#00e676' : '#ff5252' }}>{pos ? '+' : ''}{(stock.pctChange ?? 0).toFixed(2)}%</p>
        </div>
      </div>
      {why && <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-text2)', lineHeight: 1.45 }}>{why}</p>}
    </button>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 17, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>{title}</h2>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{sub}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>{children}</div>
    </div>
  );
}

export default function Invest() {
  const stocks = useMarketStore(s => s.stocks);
  const navigate = useNavigate();
  const go = (sym: string) => navigate(`/technicals/${sym}`);

  const find = (tokens: string[]): Stock | undefined =>
    stocks.find(s => tokens.some(t => s.symbol.toUpperCase().includes(t) || (s.name ?? '').toUpperCase().includes(t)));

  const blueChips = useMemo(() =>
    BLUE_CHIPS.map(b => ({ stock: find(b.match), why: b.why })).filter((x): x is { stock: Stock; why: string } => !!x.stock),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [stocks]);

  const usedSymbols = new Set(blueChips.map(b => b.stock.symbol));

  const affordable = useMemo(() =>
    stocks.filter(s => (s.price ?? 0) > 0 && (s.price ?? 0) <= 15 && !usedSymbols.has(s.symbol))
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0)).slice(0, 6),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [stocks]);

  const movers = useMemo(() =>
    [...stocks].filter(s => (s.price ?? 0) > 0).sort((a, b) => Math.abs(b.pctChange ?? 0) - Math.abs(a.pctChange ?? 0)).slice(0, 6),
  [stocks]);

  const loading = stocks.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <div>
        <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>Start investing</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>A few good places to begin on the Jamaica Stock Exchange — not the whole market dumped on you.</p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 92, borderRadius: 14 }} />)}
        </div>
      ) : (
        <>
          {blueChips.length > 0 && (
            <Section title="Blue-chip leaders" sub="Large, established Caribbean companies — a steady core to build around.">
              {blueChips.map(b => <PickCard key={b.stock.symbol} stock={b.stock} why={b.why} onClick={() => go(b.stock.symbol)} />)}
            </Section>
          )}
          {affordable.length > 0 && (
            <Section title="Easy to start" sub="Lower-priced shares, so you can begin with a small amount.">
              {affordable.map(s => <PickCard key={s.symbol} stock={s} onClick={() => go(s.symbol)} />)}
            </Section>
          )}
          {movers.length > 0 && (
            <Section title="Moving today" sub="The biggest price moves in today's session — worth a look, not a reason to chase.">
              {movers.map(s => <PickCard key={s.symbol} stock={s} onClick={() => go(s.symbol)} />)}
            </Section>
          )}
        </>
      )}

      <button onClick={() => navigate('/screener')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 13, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', color: 'var(--color-text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        Browse all listed stocks <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} />
      </button>

      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        These are starting points for research, not recommendations. Educational only — always do your own research.
      </p>
    </div>
  );
}
