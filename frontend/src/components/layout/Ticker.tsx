import { useMarketStore } from '../../stores/market.ts';

export default function Ticker() {
  const stocks = useMarketStore((s) => s.stocks);

  if (stocks.length === 0) {
    return (
      <div className="fixed top-0 left-0 right-0 h-9 bg-bg2 border-b border-border z-50 flex items-center justify-center">
        <span className="text-muted text-xs">Loading market data...</span>
      </div>
    );
  }

  const tickerItems = stocks.map((stock) => (
    <span
      key={stock.symbol}
      className="inline-flex items-center gap-2 px-4 whitespace-nowrap"
    >
      <span className="text-green font-semibold text-xs">{stock.symbol}</span>
      <span className="font-mono text-xs text-text">
        ${stock.price.toFixed(2)}
      </span>
      <span
        className={`font-mono text-xs ${
          stock.pctChange >= 0 ? 'text-green' : 'text-red'
        }`}
      >
        {stock.pctChange >= 0 ? '+' : ''}
        {stock.pctChange.toFixed(2)}%
      </span>
    </span>
  ));

  return (
    <div className="fixed top-0 left-0 right-0 h-9 bg-bg2 border-b border-border z-50 overflow-hidden">
      <div className="h-full flex items-center animate-ticker hover:[animation-play-state:paused]">
        {/* Duplicate items for infinite scroll effect */}
        <div className="flex items-center shrink-0">{tickerItems}</div>
        <div className="flex items-center shrink-0" aria-hidden="true">
          {tickerItems}
        </div>
      </div>
    </div>
  );
}
