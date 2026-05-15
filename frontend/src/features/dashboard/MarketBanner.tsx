import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMarketStore } from '../../stores/market';

export default function MarketBanner() {
  const [clock, setClock] = useState(new Date());
  const stocks    = useMarketStore(s => s.stocks);
  const isConn    = useMarketStore(s => s.isConnected);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const jamTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Jamaica', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(clock);
  const jamDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Jamaica', weekday: 'short', month: 'short', day: 'numeric',
  }).format(clock);

  const local   = new Date(clock.toLocaleString('en-US', { timeZone: 'America/Jamaica' }));
  const d = local.getDay(), m = local.getHours() * 60 + local.getMinutes();
  const open = d >= 1 && d <= 5 && m >= 570 && m < 810;

  const gainers = stocks.filter(s => (s.pctChange ?? 0) > 0).length;
  const losers  = stocks.filter(s => (s.pctChange ?? 0) < 0).length;
  const flat    = stocks.length - gainers - losers;

  const topG = stocks.length ? [...stocks].sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0))[0] : null;
  const topL = stocks.length ? [...stocks].sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0))[0] : null;

  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '11px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 20px' }}>
      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: open ? 'rgba(0,230,118,.1)' : 'rgba(255,255,255,.04)', border: `1px solid ${open ? 'rgba(0,230,118,.2)' : 'var(--color-border)'}` }}>
          <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: open ? '#00e676' : isConn ? '#ffd740' : 'rgba(255,255,255,.2)' }} className={open ? 'animate-pulse-dot' : ''} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, lineHeight: 1, color: open ? '#00e676' : 'var(--color-text2)' }}>{open ? 'JSE Open' : 'JSE Closed'}</p>
          <p style={{ margin: 0, fontSize: 9.5, lineHeight: 1, marginTop: 1, color: 'var(--color-muted)' }}>{open ? 'Closes 1:30 PM' : 'Opens 9:30 AM'}</p>
        </div>
      </div>

      <div style={{ width: 1, height: 22, background: 'var(--color-border)', flexShrink: 0 }} className="hidden sm:block" />

      {/* Clock */}
      <div style={{ flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1, color: 'var(--color-text)' }}>{jamTime}</p>
        <p style={{ margin: 0, fontSize: 9.5, lineHeight: 1, marginTop: 1, color: 'var(--color-muted)' }}>{jamDate} · JAM</p>
      </div>

      {/* Breadth */}
      {stocks.length > 0 && (
        <>
          <div style={{ width: 1, height: 22, background: 'var(--color-border)', flexShrink: 0 }} className="hidden sm:block" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="badge badge-green"><i className="fa-solid fa-arrow-up" style={{ fontSize: 7 }} />{gainers}</span>
            <span className="badge badge-red"><i className="fa-solid fa-arrow-down" style={{ fontSize: 7 }} />{losers}</span>
            <span className="badge badge-muted">{flat} flat</span>
          </div>
        </>
      )}

      {/* Top movers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
        {topG && (topG.pctChange ?? 0) > 0 && (
          <div className="hidden md:block">
            <p style={{ margin: 0, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 600, color: 'var(--color-muted)' }}>Top Gainer</p>
            <p style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00e676' }}>
              {topG.symbol} <span style={{ opacity: .65 }}>+{(topG.pctChange ?? 0).toFixed(2)}%</span>
            </p>
          </div>
        )}
        {topL && (topL.pctChange ?? 0) < 0 && (
          <div className="hidden md:block">
            <p style={{ margin: 0, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 600, color: 'var(--color-muted)' }}>Top Loser</p>
            <p style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ff5252' }}>
              {topL.symbol} <span style={{ opacity: .65 }}>{(topL.pctChange ?? 0).toFixed(2)}%</span>
            </p>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <Link to="/screener" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text2)', transition: 'all 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,230,118,.3)'; (e.currentTarget as HTMLElement).style.color = '#00e676'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text2)'; }}>
            <i className="fa-solid fa-filter" style={{ fontSize: 9 }} />Screener
          </Link>
          <Link to="/watchlists" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text2)', transition: 'all 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,230,118,.3)'; (e.currentTarget as HTMLElement).style.color = '#00e676'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text2)'; }}>
            <i className="fa-solid fa-eye" style={{ fontSize: 9 }} />Watchlist
          </Link>
        </div>
      </div>
    </div>
  );
}
