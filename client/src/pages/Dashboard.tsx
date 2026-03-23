import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStocks, getMarketOverview } from '@/api/market';
import { useSSE } from '@/hooks/useSSE';
import { fmt, fmtInt, fmtLargeNum, fmtPercent, fmtJMD, changeColor, changeBg } from '@/utils/formatters';
import { SECTOR_COLORS } from '@/utils/constants';
import { SkeletonCard, SkeletonTable } from '@/components/common/LoadingSpinner';
import StockDetailModal from '@/components/common/StockDetailModal';
import type { Stock } from '@/types';
import { createChart, type IChartApi } from 'lightweight-charts';

type SortKey = 'symbol' | 'price' | 'change' | 'changePercent' | 'volume' | 'marketCap';
type SortDir = 'asc' | 'desc';
type PanelTab = 'gainers' | 'losers' | 'active';

export default function Dashboard() {
  const [sortKey, setSortKey] = useState<SortKey>('changePercent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [panelTab, setPanelTab] = useState<PanelTab>('gainers');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const { stocks: liveStocks } = useSSE();

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['market-overview'],
    queryFn: getMarketOverview,
    refetchInterval: 60_000,
  });

  const { data: fetchedStocks, isLoading: stocksLoading } = useQuery({
    queryKey: ['stocks'],
    queryFn: getStocks,
    refetchInterval: 60_000,
  });

  const stocks = liveStocks.length > 0 ? liveStocks : fetchedStocks || [];

  // Mini chart
  useEffect(() => {
    if (!chartContainerRef.current || stocks.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      layout: { background: { color: 'transparent' }, textColor: '#8892a0' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)' },
    });
    chartRef.current = chart;

    const sym = chartSymbol || stocks[0]?.symbol;
    if (sym) {
      const stock = stocks.find(s => s.symbol === sym);
      if (stock) {
        const series = chart.addAreaSeries({
          topColor: (stock.change ?? 0) >= 0 ? 'rgba(0,200,83,0.3)' : 'rgba(255,23,68,0.3)',
          bottomColor: 'transparent',
          lineColor: (stock.change ?? 0) >= 0 ? '#00c853' : '#ff1744',
          lineWidth: 2,
        });
        // Generate intraday-style data from the stock's OHLC
        const now = Math.floor(Date.now() / 1000);
        const base = stock.previousClose || stock.price * 0.99;
        const points = 78; // ~6.5 hours of trading
        const data = [];
        for (let i = 0; i < points; i++) {
          const t = now - (points - i) * 300;
          const progress = i / points;
          const price = base + (stock.price - base) * progress + (Math.random() - 0.5) * (stock.price * 0.005);
          data.push({ time: t as unknown as string, value: price });
        }
        series.setData(data);
        chart.timeScale().fitContent();
      }
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [stocks, chartSymbol]);

  // Sorting
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedStocks = useMemo(() => {
    let list = [...stocks];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [stocks, sortKey, sortDir, search]);

  // Panel data
  const panelStocks = useMemo(() => {
    if (panelTab === 'gainers') return overview?.gainers || [...stocks].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)).slice(0, 10);
    if (panelTab === 'losers') return overview?.losers || [...stocks].sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0)).slice(0, 10);
    return overview?.mostActive || [...stocks].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 10);
  }, [panelTab, overview, stocks]);

  // Heatmap
  const heatmapStocks = useMemo(() =>
    [...stocks].sort((a, b) => (b.marketCap ?? b.volume ?? 0) - (a.marketCap ?? a.volume ?? 0)).slice(0, 30),
    [stocks]
  );

  const SortIcon = ({ col }: { col: SortKey }) => (
    sortKey === col
      ? <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'} ml-1 text-gf-green text-[10px]`} />
      : <i className="fas fa-sort ml-1 text-text-muted text-[10px]" />
  );

  if (overviewLoading && stocksLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Stocks" value={fmtInt(overview?.totalStocks ?? stocks.length)} icon="fa-chart-line" color="text-gf-green" />
        <StatCard label="Market Cap" value={fmtLargeNum(overview?.totalMarketCap)} icon="fa-building" color="text-gf-blue" />
        <StatCard label="Volume" value={fmtLargeNum(overview?.totalVolume)} icon="fa-exchange-alt" color="text-gf-gold" />
        <StatCard
          label="Advancers / Decliners"
          value={`${overview?.advancers ?? '—'} / ${overview?.decliners ?? '—'}`}
          icon="fa-arrows-alt-v"
          color="text-gf-purple"
        />
      </div>

      {/* Main Chart + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {chartSymbol || stocks[0]?.symbol || 'Market'} — Intraday
            </h3>
            <div className="flex gap-1">
              {stocks.slice(0, 5).map(s => (
                <button
                  key={s.symbol}
                  onClick={() => setChartSymbol(s.symbol)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    (chartSymbol || stocks[0]?.symbol) === s.symbol
                      ? 'bg-gf-green/20 text-gf-green'
                      : 'bg-white/5 text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {s.symbol}
                </button>
              ))}
            </div>
          </div>
          <div ref={chartContainerRef} className="w-full" />
        </div>

        {/* Side Panel */}
        <div className="glass-card p-4">
          <div className="flex gap-1 mb-3">
            {(['gainers', 'losers', 'active'] as PanelTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setPanelTab(tab)}
                className={`flex-1 py-1.5 rounded text-xs font-semibold capitalize transition-colors ${
                  panelTab === tab ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab === 'active' ? 'Most Active' : tab}
              </button>
            ))}
          </div>
          <div className="space-y-1 max-h-[280px] overflow-y-auto custom-scrollbar">
            {panelStocks.map((s: Stock) => (
              <button
                key={s.symbol}
                onClick={() => { setSelectedStock(s); setChartSymbol(s.symbol); }}
                className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-white/5 transition-colors text-left"
              >
                <div>
                  <span className="text-xs font-semibold text-text-primary">{s.symbol}</span>
                  <span className="text-[10px] text-text-muted ml-2 hidden sm:inline">{s.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-num text-text-primary">{fmtJMD(s.price)}</div>
                  <div className={`text-[10px] font-num ${changeColor(s.changePercent)}`}>
                    {fmtPercent(s.changePercent)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Market Heatmap</h3>
        <div className="flex flex-wrap gap-1">
          {heatmapStocks.map(s => {
            const pct = s.changePercent ?? 0;
            const size = Math.max(60, Math.min(120, Math.sqrt((s.marketCap ?? s.volume ?? 1000) / 1e6) * 10));
            const bg = pct > 2 ? 'bg-green-600/80' : pct > 0 ? 'bg-green-800/60' : pct < -2 ? 'bg-red-600/80' : pct < 0 ? 'bg-red-800/60' : 'bg-gray-700/50';
            return (
              <button
                key={s.symbol}
                onClick={() => setSelectedStock(s)}
                className={`${bg} rounded px-2 py-1.5 flex flex-col items-center justify-center hover:opacity-80 transition-opacity`}
                style={{ minWidth: size, minHeight: size * 0.6 }}
              >
                <span className="text-[10px] font-bold text-white">{s.symbol}</span>
                <span className="text-[9px] font-num text-white/80">{fmtPercent(pct, 1)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stock Table */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">All Stocks</h3>
          <div className="relative">
            <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary placeholder:text-text-muted focus:border-gf-green/50 focus:outline-none w-48"
            />
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted border-b border-white/5">
                <th className="py-2 px-3 text-left cursor-pointer hover:text-text-secondary" onClick={() => toggleSort('symbol')}>
                  Symbol <SortIcon col="symbol" />
                </th>
                <th className="py-2 px-3 text-left hidden md:table-cell">Name</th>
                <th className="py-2 px-3 text-right cursor-pointer hover:text-text-secondary" onClick={() => toggleSort('price')}>
                  Price <SortIcon col="price" />
                </th>
                <th className="py-2 px-3 text-right cursor-pointer hover:text-text-secondary" onClick={() => toggleSort('change')}>
                  Change <SortIcon col="change" />
                </th>
                <th className="py-2 px-3 text-right cursor-pointer hover:text-text-secondary" onClick={() => toggleSort('changePercent')}>
                  % <SortIcon col="changePercent" />
                </th>
                <th className="py-2 px-3 text-right cursor-pointer hover:text-text-secondary hidden sm:table-cell" onClick={() => toggleSort('volume')}>
                  Volume <SortIcon col="volume" />
                </th>
                <th className="py-2 px-3 text-right hidden lg:table-cell cursor-pointer hover:text-text-secondary" onClick={() => toggleSort('marketCap')}>
                  Mkt Cap <SortIcon col="marketCap" />
                </th>
                <th className="py-2 px-3 text-center hidden lg:table-cell">Sector</th>
              </tr>
            </thead>
            <tbody>
              {sortedStocks.map(s => (
                <tr
                  key={s.symbol}
                  onClick={() => setSelectedStock(s)}
                  className="border-b border-white/[0.02] hover:bg-white/[0.03] cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-semibold text-text-primary">{s.symbol}</td>
                  <td className="py-2.5 px-3 text-text-secondary hidden md:table-cell">{s.name}</td>
                  <td className="py-2.5 px-3 text-right font-num text-text-primary">{fmtJMD(s.price)}</td>
                  <td className={`py-2.5 px-3 text-right font-num ${changeColor(s.change)}`}>{fmt(s.change)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-num font-semibold ${changeBg(s.changePercent)} ${changeColor(s.changePercent)}`}>
                      {fmtPercent(s.changePercent)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-num text-text-secondary hidden sm:table-cell">{fmtInt(s.volume)}</td>
                  <td className="py-2.5 px-3 text-right font-num text-text-secondary hidden lg:table-cell">{fmtLargeNum(s.marketCap)}</td>
                  <td className="py-2.5 px-3 text-center hidden lg:table-cell">
                    {s.sector && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: `${SECTOR_COLORS[s.sector] || '#9e9e9e'}20`, color: SECTOR_COLORS[s.sector] || '#9e9e9e' }}>
                        {s.sector}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedStocks.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-text-muted">No stocks found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} bg-current/10 flex items-center justify-center`}>
          <i className={`fas ${icon} ${color} text-sm`} />
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-text-primary font-num">{value}</p>
        </div>
      </div>
    </div>
  );
}
