import { useNavigate } from 'react-router-dom';
import type { Stock } from '@/types';
import { fmt, fmtPercent, fmtLargeNum, fmtInt, changeColor } from '@/utils/formatters';

interface Props {
  stock: Stock;
  onClose: () => void;
}

export default function StockDetailModal({ stock, onClose }: Props) {
  const navigate = useNavigate();

  const details = [
    { label: 'Open', value: fmt(stock.open) },
    { label: 'High', value: fmt(stock.high) },
    { label: 'Low', value: fmt(stock.low) },
    { label: 'Volume', value: fmtInt(stock.volume) },
    { label: 'Market Cap', value: fmtLargeNum(stock.marketCap) },
    { label: 'P/E Ratio', value: stock.peRatio ? fmt(stock.peRatio) : '—' },
    { label: 'Div Yield', value: stock.dividendYield ? fmtPercent(stock.dividendYield) : '—' },
    { label: '52W High', value: fmt(stock.week52High) },
    { label: '52W Low', value: fmt(stock.week52Low) },
  ];

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-text-primary">{stock.symbol}</h3>
            <p className="text-sm text-text-secondary">{stock.name}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Price */}
        <div className="mb-4">
          <span className="text-2xl font-bold font-num text-text-primary">
            J${fmt(stock.price)}
          </span>
          <span className={`ml-2 text-sm font-num ${changeColor(stock.changePercent)}`}>
            {stock.change >= 0 ? '+' : ''}{fmt(stock.change)} ({fmtPercent(stock.changePercent)})
          </span>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {details.map((d) => (
            <div key={d.label} className="bg-bg3/50 rounded-lg p-2">
              <p className="text-[10px] text-text-muted">{d.label}</p>
              <p className="text-sm font-num text-text-primary">{d.value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => { navigate(`/technicals?symbol=${stock.symbol}`); onClose(); }}
            className="flex-1 py-2 bg-gf-blue/10 text-gf-blue text-sm font-semibold rounded-lg hover:bg-gf-blue/20"
          >
            <i className="fas fa-chart-bar mr-1" /> Advanced Chart
          </button>
          <button
            onClick={() => { navigate(`/orders?symbol=${stock.symbol}`); onClose(); }}
            className="flex-1 py-2 bg-gf-green/10 text-gf-green text-sm font-semibold rounded-lg hover:bg-gf-green/20"
          >
            <i className="fas fa-exchange-alt mr-1" /> Trade
          </button>
        </div>
      </div>
    </div>
  );
}
