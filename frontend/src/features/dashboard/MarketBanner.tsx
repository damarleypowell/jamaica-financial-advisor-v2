import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMarketStore } from '../../stores/market';

export default function MarketBanner() {
  const [clock, setClock] = useState(new Date());
  const stocks = useMarketStore((s) => s.stocks);
  const isConnected = useMarketStore((s) => s.isConnected);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const jamaicaTimeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Jamaica',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(clock);

  const jamaicaDateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Jamaica',
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(clock);

  const local = new Date(clock.toLocaleString('en-US', { timeZone: 'America/Jamaica' }));
  const day = local.getDay();
  const mins = local.getHours() * 60 + local.getMinutes();
  const isOpen = day >= 1 && day <= 5 && mins >= 570 && mins < 810;

  const gainers = stocks.filter((s) => s.pctChange > 0).length;
  const losers = stocks.filter((s) => s.pctChange < 0).length;
  const total = stocks.length;

  const topGainer = stocks.length
    ? [...stocks].sort((a, b) => b.pctChange - a.pctChange)[0]
    : null;
  const topLoser = stocks.length
    ? [...stocks].sort((a, b) => a.pctChange - b.pctChange)[0]
    : null;

  return (
    <div className="rounded-xl border border-border bg-card backdrop-blur-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4 flex-wrap">

        {/* Status + clock */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`relative flex items-center justify-center w-9 h-9 rounded-xl ${isOpen ? 'bg-green/10' : 'bg-glass2'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${isOpen ? 'bg-green animate-pulse' : isConnected ? 'bg-gold' : 'bg-red/70'}`} />
              {isOpen && <span className="absolute inset-0 rounded-xl animate-ping opacity-20 bg-green" />}
            </div>
            <div>
              <p className={`text-sm font-bold leading-none ${isOpen ? 'text-green' : 'text-text2'}`}>
                {isOpen ? 'Market Open' : 'Market Closed'}
              </p>
              <p className="text-[11px] text-muted mt-0.5 leading-none">
                JSE &middot; {isOpen ? 'Closes 1:30 PM' : 'Opens 9:30 AM'}
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-border hidden sm:block" />

          <div>
            <p className="text-sm font-mono font-semibold text-text leading-none">{jamaicaTimeStr}</p>
            <p className="text-[11px] text-muted mt-0.5 leading-none">{jamaicaDateStr} &middot; Jamaica</p>
          </div>
        </div>

        {/* Breadth pills */}
        {total > 0 && (
          <>
            <div className="w-px h-8 bg-border hidden sm:block" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green/10 border border-green/20 text-xs font-semibold text-green">
                <i className="fa-solid fa-arrow-up text-[10px]" />
                {gainers} Gainers
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red/10 border border-red/20 text-xs font-semibold text-red">
                <i className="fa-solid fa-arrow-down text-[10px]" />
                {losers} Losers
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-glass2 border border-border text-xs text-muted">
                {total} Securities
              </span>
            </div>
          </>
        )}

        {/* Top movers + quick links */}
        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {topGainer && topGainer.pctChange > 0 && (
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-muted uppercase tracking-wider leading-none">Top Gainer</p>
              <p className="text-xs font-bold text-green mt-0.5">
                {topGainer.symbol}
                <span className="font-normal text-muted ml-1">+{topGainer.pctChange.toFixed(2)}%</span>
              </p>
            </div>
          )}
          {topLoser && topLoser.pctChange < 0 && (
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-muted uppercase tracking-wider leading-none">Top Loser</p>
              <p className="text-xs font-bold text-red mt-0.5">
                {topLoser.symbol}
                <span className="font-normal text-muted ml-1">{topLoser.pctChange.toFixed(2)}%</span>
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Link
              to="/screener"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-glass hover:bg-glass2 text-xs font-medium text-text2 hover:text-text transition-colors"
            >
              <i className="fa-solid fa-filter text-[10px]" />
              Screener
            </Link>
            <Link
              to="/watchlists"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-glass hover:bg-glass2 text-xs font-medium text-text2 hover:text-text transition-colors"
            >
              <i className="fa-solid fa-eye text-[10px]" />
              Watchlist
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
