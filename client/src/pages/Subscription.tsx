import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubscription, subscribe, cancelSubscription } from '@/api/subscription';
import { useAuth } from '@/context/AuthContext';
import { TIER_CONFIGS } from '@/utils/constants';
import { fmtDate } from '@/utils/formatters';
import toast from 'react-hot-toast';

export default function Subscription() {
  const { isAuthenticated, tier, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: getSubscription,
    enabled: isAuthenticated,
  });

  const subscribeMut = useMutation({
    mutationFn: subscribe,
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        refreshUser();
        toast.success('Subscription updated!');
      }
    },
    onError: () => toast.error('Failed to subscribe'),
  });

  const cancelMut = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      refreshUser();
      toast.success('Subscription cancelled');
      setConfirmCancel(false);
    },
    onError: () => toast.error('Failed to cancel subscription'),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Current Plan */}
      {isAuthenticated && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Current Plan</h3>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gf-green to-gf-gold flex items-center justify-center">
              <i className="fas fa-crown text-xl text-bg" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-text-primary">
                {TIER_CONFIGS.find(t => t.plan === tier)?.name || 'Free'} Plan
              </p>
              {subscription?.currentPeriodEnd && (
                <p className="text-xs text-text-secondary">
                  {subscription.status === 'CANCELLED' ? 'Expires' : 'Renews'}: {fmtDate(subscription.currentPeriodEnd)}
                </p>
              )}
            </div>
            {tier !== 'FREE' && !confirmCancel && (
              <button onClick={() => setConfirmCancel(true)} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20">
                Cancel
              </button>
            )}
            {confirmCancel && (
              <div className="flex gap-2">
                <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold disabled:opacity-50">
                  Confirm Cancel
                </button>
                <button onClick={() => setConfirmCancel(false)} className="px-4 py-2 rounded-lg bg-white/5 text-text-muted text-xs font-semibold">
                  Keep Plan
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <h2 className="text-lg font-bold text-text-primary text-center mb-2">Choose Your Plan</h2>
        <p className="text-xs text-text-secondary text-center mb-6">Unlock premium features to power your investments</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIER_CONFIGS.map(config => {
            const isCurrentPlan = tier === config.plan;
            const isHighlighted = config.highlighted;

            return (
              <div
                key={config.plan}
                className={`glass-card p-6 relative transition-all ${
                  isHighlighted ? 'border-gf-green/30 scale-[1.02]' : ''
                } ${isCurrentPlan ? 'ring-1 ring-gf-green/50' : ''}`}
              >
                {isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-gf-green to-gf-gold text-bg text-[10px] font-bold uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 rounded bg-gf-green/10 text-gf-green text-[10px] font-semibold">Current</span>
                  </div>
                )}

                <div className="text-center mb-5">
                  <h3 className="text-lg font-bold text-text-primary">{config.name}</h3>
                  <p className="text-2xl font-bold gradient-text mt-2">{config.price}</p>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {config.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-text-secondary">
                      <i className="fas fa-check text-gf-green mt-0.5 text-[10px] shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <button disabled className="w-full py-2.5 rounded-lg bg-white/5 text-text-muted text-sm font-semibold cursor-default">
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (!isAuthenticated) return toast.error('Please log in first');
                      subscribeMut.mutate(config.plan);
                    }}
                    disabled={subscribeMut.isPending}
                    className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
                      isHighlighted
                        ? 'bg-gradient-to-r from-gf-green to-gf-gold text-bg hover:opacity-90'
                        : 'bg-white/10 text-text-primary hover:bg-white/20'
                    }`}
                  >
                    {subscribeMut.isPending ? 'Processing...' : config.priceAmount === 0 ? 'Get Started' : 'Upgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <FaqItem q="Can I switch plans anytime?" a="Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately." />
          <FaqItem q="How does billing work?" a="Plans are billed monthly in Jamaican Dollars (JMD). You can cancel anytime before the next billing cycle." />
          <FaqItem q="Is there a free trial?" a="The Free plan includes basic features at no cost. You can explore the platform before upgrading." />
          <FaqItem q="What payment methods do you accept?" a="We accept credit/debit cards and bank transfers. All payments are processed securely." />
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 pb-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-left py-1">
        <span className="text-xs font-semibold text-text-primary">{q}</span>
        <i className={`fas fa-chevron-down text-[10px] text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-xs text-text-secondary mt-2 leading-relaxed">{a}</p>}
    </div>
  );
}
