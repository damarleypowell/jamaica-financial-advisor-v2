import { useEffect } from 'react';
import { useMarketStore } from '../../stores/market';
import { useSSE } from '../../hooks/useSSE';
import StatsGrid from './StatsGrid';
import MainChart from './MainChart';
import StockPanel from './StockPanel';
import Heatmap from './Heatmap';
import StockTable from './StockTable';
import StockDetailModal from '../../components/modals/StockDetailModal';

/* ------------------------------------------------------------------ */
/*  Dashboard                                                         */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const stocks = useMarketStore((s) => s.stocks);
  const selectSymbol = useMarketStore((s) => s.selectSymbol);

  // Keep SSE connected while dashboard is mounted
  useSSE();

  // Auto-select first stock if none selected
  useEffect(() => {
    if (!selectedSymbol && stocks.length > 0) {
      selectSymbol(stocks[0].symbol);
    }
  }, [selectedSymbol, stocks, selectSymbol]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Jamaica Stock Exchange -- Real-time market overview
          </p>
        </div>

        {/* Stats cards */}
        <StatsGrid />

        {/* Two-column layout: chart + stock panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Left column: main chart */}
          <div className="space-y-6">
            <MainChart symbol={selectedSymbol} />
          </div>

          {/* Right column: stock panel */}
          <div className="lg:h-[464px]">
            <StockPanel />
          </div>
        </div>

        {/* Heatmap */}
        <Heatmap />

        {/* Full stock table */}
        <StockTable />
      </div>

      {/* Stock detail modal (rendered at root level) */}
      <StockDetailModal />
    </div>
  );
}
