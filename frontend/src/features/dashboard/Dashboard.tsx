import { useEffect } from 'react';
import { useMarketStore } from '../../stores/market';
import { useSSE } from '../../hooks/useSSE';
import StatsGrid from './StatsGrid';
import MainChart from './MainChart';
import StockPanel from './StockPanel';
import Heatmap from './Heatmap';
import StockTable from './StockTable';
import MarketBanner from './MarketBanner';

export default function Dashboard() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const stocks = useMarketStore((s) => s.stocks);
  const selectSymbol = useMarketStore((s) => s.selectSymbol);

  useSSE();

  useEffect(() => {
    if (!selectedSymbol && stocks.length > 0) {
      selectSymbol(stocks[0].symbol);
    }
  }, [selectedSymbol, stocks, selectSymbol]);

  return (
    <div className="relative min-h-screen text-text">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 left-1/4 w-[700px] h-[500px] rounded-full bg-green/[0.05] blur-[140px]" />
        <div className="absolute top-10 right-1/3 w-[500px] h-[400px] rounded-full bg-blue/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 w-[400px] h-[300px] rounded-full bg-purple/[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 py-5 space-y-5">

        {/* Market status banner */}
        <MarketBanner />

        {/* Stats row */}
        <StatsGrid />

        {/* Chart + movers */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <MainChart symbol={selectedSymbol} />
          <div className="lg:min-h-[430px]">
            <StockPanel />
          </div>
        </div>

        {/* Heatmap (collapsible) */}
        <Heatmap />

        {/* All securities table */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full bg-green" />
            <h2 className="text-sm font-semibold text-text">All Securities</h2>
            {stocks.length > 0 && (
              <span className="text-xs text-muted bg-glass border border-border rounded-full px-2 py-0.5">
                {stocks.length} listed
              </span>
            )}
          </div>
          <StockTable />
        </div>

      </div>
    </div>
  );
}
