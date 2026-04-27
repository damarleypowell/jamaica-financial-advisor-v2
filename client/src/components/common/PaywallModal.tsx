import { useNavigate } from 'react-router-dom';
import { TIER_CONFIGS } from '@/utils/constants';
import type { SubscriptionPlan } from '@/types';

interface Props {
  requiredTier: SubscriptionPlan;
  onClose: () => void;
}

export default function PaywallModal({ requiredTier, onClose }: Props) {
  const navigate = useNavigate();
  const tierConfig = TIER_CONFIGS.find((t) => t.plan === requiredTier) || TIER_CONFIGS[1];

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-gf-gold/10 flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-crown text-2xl text-gf-gold" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">Upgrade to {tierConfig.name}</h3>
          <p className="text-sm text-text-secondary mt-1">
            This feature requires the {tierConfig.name} plan
          </p>
        </div>

        <div className="mb-5">
          {tierConfig.contactSales ? (
            <p className="text-xl font-bold text-gf-gold text-center mb-3">Contact Sales</p>
          ) : tierConfig.priceAmount === 0 ? (
            <p className="text-xl font-bold gradient-text text-center mb-3">Free</p>
          ) : (
            <div className="text-center mb-3">
              <p className="text-xl font-bold gradient-text">{tierConfig.price}</p>
              <p className="text-xs text-text-muted mt-0.5">{tierConfig.priceUSD} USD</p>
            </div>
          )}
          <ul className="space-y-2">
            {tierConfig.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-xs text-text-secondary">
                <i className="fas fa-check text-gf-green mt-0.5 text-[10px]" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => { navigate('/subscription'); onClose(); }}
          className="w-full py-2.5 bg-gradient-to-r from-gf-green to-gf-gold text-bg font-bold rounded-lg text-sm hover:opacity-90"
        >
          Upgrade Now
        </button>
        <button onClick={onClose} className="w-full mt-2 py-2 text-sm text-text-muted hover:text-text-secondary">
          Maybe later
        </button>
      </div>
    </div>
  );
}
