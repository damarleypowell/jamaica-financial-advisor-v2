import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type NudgeContext =
  | 'ai_limit'
  | 'portfolio_risk'
  | 'portfolio_growth'
  | 'trade_limit'
  | 'screener'
  | 'us_stocks'
  | 'watchlist_limit'
  | 'alert_limit'
  | 'generic';

interface UpgradeNudgeProps {
  context: NudgeContext;
  /** Pass extra data to generate personalized copy (e.g. portfolioReturn, volatility) */
  data?: { portfolioReturn?: number; volatility?: string; symbol?: string };
  /** If true, renders a compact inline badge instead of a card */
  compact?: boolean;
  /** Required tier to unlock */
  requiredTier?: 'CORE' | 'PRO';
}

const COPY: Record<NudgeContext, (data?: UpgradeNudgeProps['data']) => { headline: string; sub: string; cta: string }> = {
  ai_limit:        () => ({ headline: "You've used your free AI insights for today", sub: "Upgrade to continue building your strategy with unlimited AI guidance.", cta: "Unlock AI advisor" }),
  portfolio_risk:  (d) => ({ headline: `Your portfolio volatility is ${d?.volatility ?? 'high'}`, sub: "CORE unlocks risk analytics to help stabilize your returns.", cta: "Reduce my risk" }),
  portfolio_growth:(d) => ({ headline: `You're up ${d?.portfolioReturn?.toFixed(1) ?? '--'}% -- great start`, sub: "PRO can optimize further with AI rebalancing and drawdown modeling.", cta: "Optimize my portfolio" }),
  trade_limit:     () => ({ headline: "You've reached your monthly investment limit", sub: "Upgrade CORE for more transactions and full portfolio flexibility.", cta: "Increase my limit" }),
  screener:        () => ({ headline: "Advanced screening filters -- CORE feature", sub: "Filter JSE + US stocks by valuation, momentum, and sector to find better opportunities.", cta: "Unlock screener" }),
  us_stocks:       () => ({ headline: "US market access -- CORE feature", sub: "Invest in NYSE and NASDAQ stocks alongside your JSE portfolio.", cta: "Unlock US markets" }),
  watchlist_limit: () => ({ headline: "You've reached your watchlist limit", sub: "CORE gives you 5 watchlists to organize your Caribbean and US picks.", cta: "Expand my watchlists" }),
  alert_limit:     () => ({ headline: "Alert limit reached", sub: "CORE gives you 20 price alerts -- never miss a JSE or US move again.", cta: "Unlock more alerts" }),
  generic:         () => ({ headline: "Unlock your full wealth intelligence system", sub: "CORE starts at J$2,400/mo -- less than a lunch. Start building structured wealth today.", cta: "See plans" }),
};

export function UpgradeNudge({ context, data, compact = false, requiredTier = 'CORE' }: UpgradeNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  if (dismissed) return null;

  const { headline, sub, cta } = COPY[context](data);
  const color = requiredTier === 'PRO' ? '#0052FF' : '#40c4ff';

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 10,
        background: `${color}0f`, border: `1px solid ${color}25`,
      }}>
        <span style={{ fontSize: 11, color }}></span>
        <span style={{ fontSize: 12, color: 'rgba(var(--fg),.7)' }}>{headline}</span>
        <button
          onClick={() => navigate('/subscription')}
          style={{ fontSize: 11, fontWeight: 700, color, background: 'none', border: 'none', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
        >
          {cta} '
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '16px 18px', borderRadius: 16,
      background: `linear-gradient(135deg, ${color}08, ${color}04)`,
      border: `1px solid ${color}20`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color}12`, border: `1px solid ${color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>
        {context === 'ai_limit' ? 'AI'
          : context === 'portfolio_risk' ? 'Risk'
          : context === 'portfolio_growth' ? 'Growth'
          : context === 'trade_limit' ? 'Trade'
          : context === 'screener' ? 'Filter'
          : context === 'us_stocks' ? 'US'
          : 'Pro'}
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'rgba(var(--fg),1)' }}>{headline}</p>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(var(--fg),.5)', lineHeight: 1.5 }}>{sub}</p>
        <button
          onClick={() => navigate('/subscription')}
          style={{
            padding: '8px 18px', borderRadius: 10,
            background: color, color: '#04060d',
            fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer',
            boxShadow: `0 2px 12px ${color}35`,
          }}
        >
          {cta} '
        </button>
      </div>

      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(var(--fg),.25)', fontSize: 16, padding: 0, flexShrink: 0, lineHeight: 1 }}
      >
        
      </button>
    </div>
  );
}

export default UpgradeNudge;
