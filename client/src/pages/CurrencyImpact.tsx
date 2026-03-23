import { useQuery } from '@tanstack/react-query';
import { getCurrencyImpact, getForex } from '@/api/market';
import { fmt, fmtJMD, fmtUSD, fmtPercent, changeColor, changeBg } from '@/utils/formatters';
import { SkeletonCard, SkeletonTable } from '@/components/common/LoadingSpinner';

export default function CurrencyImpact() {
  const { data: impact, isLoading: impactLoading } = useQuery({
    queryKey: ['currency-impact'],
    queryFn: getCurrencyImpact,
    refetchInterval: 300_000,
  });

  const { data: forex = [], isLoading: forexLoading } = useQuery({
    queryKey: ['forex'],
    queryFn: getForex,
    refetchInterval: 300_000,
  });

  const isLoading = impactLoading || forexLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={6} />
      </div>
    );
  }

  const usdJmd = forex.find(r => r.pair === 'USD/JMD' || r.pair === 'USDJMD');

  return (
    <div className="space-y-6">
      {/* Main Rate Card */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gf-green/20 to-gf-gold/20 flex items-center justify-center">
              <span className="text-2xl">🇺🇸🇯🇲</span>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">USD / JMD</p>
              <p className="text-3xl font-bold text-text-primary font-num">
                {impact?.usdJmdRate ? fmt(impact.usdJmdRate, 2) : usdJmd ? fmt(usdJmd.rate, 2) : '—'}
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] text-text-muted">Change</p>
              <p className={`text-sm font-bold font-num ${changeColor(impact?.change ?? usdJmd?.change)}`}>
                {fmt(impact?.change ?? usdJmd?.change)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">Change %</p>
              <p className={`text-sm font-bold font-num ${changeColor(impact?.changePercent ?? usdJmd?.changePercent)}`}>
                {fmtPercent(impact?.changePercent ?? usdJmd?.changePercent)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Forex Rates */}
      {forex.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {forex.map(r => (
            <div key={r.pair} className="glass-card p-4">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">{r.pair}</p>
              <p className="text-lg font-bold text-text-primary font-num">{fmt(r.rate, 4)}</p>
              <p className={`text-xs font-num ${changeColor(r.changePercent)}`}>{fmtPercent(r.changePercent)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Impact on Holdings */}
      {impact?.holdings && impact.holdings.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Impact on Your Holdings</h3>
          <p className="text-[10px] text-text-muted mb-4">How currency fluctuations affect the JMD value of your positions</p>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-white/5">
                  <th className="py-2 px-3 text-left">Symbol</th>
                  <th className="py-2 px-3 text-right">Currency Impact</th>
                  <th className="py-2 px-3 text-right">Impact %</th>
                  <th className="py-2 px-3 text-center">Effect</th>
                </tr>
              </thead>
              <tbody>
                {impact.holdings.map(h => (
                  <tr key={h.symbol} className="border-b border-white/[0.02] hover:bg-white/[0.03]">
                    <td className="py-2.5 px-3 font-semibold text-text-primary">{h.symbol}</td>
                    <td className={`py-2.5 px-3 text-right font-num ${changeColor(h.impact)}`}>{fmtJMD(h.impact)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-num font-semibold ${changeBg(h.impactPercent)} ${changeColor(h.impactPercent)}`}>
                        {fmtPercent(h.impactPercent)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {h.impact > 0 ? (
                        <span className="text-gf-green text-[10px]"><i className="fas fa-arrow-up mr-1" />Favorable</span>
                      ) : h.impact < 0 ? (
                        <span className="text-red-400 text-[10px]"><i className="fas fa-arrow-down mr-1" />Adverse</span>
                      ) : (
                        <span className="text-text-muted text-[10px]">Neutral</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">
          <i className="fas fa-info-circle text-gf-blue mr-2" />Understanding Currency Impact
        </h3>
        <div className="text-xs text-text-secondary leading-relaxed space-y-2">
          <p>
            Currency fluctuations between the USD and JMD affect the value of investments denominated in foreign currencies.
            When the JMD weakens against the USD, holdings priced in USD gain value in JMD terms — and vice versa.
          </p>
          <p>
            This page shows the current exchange rate and calculates how recent currency movements have impacted
            the JMD-equivalent value of your portfolio holdings.
          </p>
        </div>
      </div>
    </div>
  );
}
