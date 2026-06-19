import { useMarketStore } from '../../stores/market.ts';

export default function Ticker() {
  const stocks = useMarketStore(s => s.stocks);

  const items = stocks.filter(s => s.price != null);

  if (items.length === 0) {
    return (
      <div className="ticker-strip" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 32, zIndex: 50, background: 'rgba(var(--surf),.98)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>Connecting to market data...</span>
      </div>
    );
  }

  const row = items.map(s => {
    const pos = (s.pctChange ?? 0) > 0, neg = (s.pctChange ?? 0) < 0;
    return (
      <span key={s.symbol} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', whiteSpace: 'nowrap', borderRight: '1px solid rgba(var(--fg),.04)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: pos ? 'var(--color-green2)' : neg ? '#ff5252' : 'var(--color-text2)' }}>{s.symbol}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>${(s.price ?? 0).toFixed(2)}</span>
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: pos ? 'var(--color-green2)' : neg ? '#ff5252' : 'var(--color-muted)' }}>
          {pos ? '▲' : neg ? '▼' : '–'}{pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%
        </span>
      </span>
    );
  });

  return (
    <div className="ticker-strip" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 32, zIndex: 50, background: 'rgba(var(--surf),.98)', borderBottom: '1px solid var(--color-border)', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      {/* Gradient fade left */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(90deg, var(--color-bg), transparent)', zIndex: 2, pointerEvents: 'none' }} />
      {/* Gradient fade right */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(270deg, var(--color-bg), transparent)', zIndex: 2, pointerEvents: 'none' }} />
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', flexShrink: 0, zIndex: 3, borderRight: '1px solid rgba(var(--fg),.06)', background: 'rgba(var(--surf),.98)' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-green2)', display: 'inline-block' }} className="animate-pulse-dot" />
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.12em', color: 'var(--color-green2)' }}>JSE</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }} className="animate-ticker">
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{row}</div>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-hidden="true">{row}</div>
        </div>
      </div>
    </div>
  );
}
