import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

interface ConfettiOverlayProps {
  /** Trigger the confetti. When this flips from falsetrue, animation plays once. */
  trigger: boolean;
  /** Optional message shown below animation */
  message?: string;
  /** Optional sub-message */
  subMessage?: string;
  onComplete?: () => void;
}

// Inline minimal confetti Lottie JSON (no external fetch needed)
// This is a simple colored-dots burst, ~3KB
const CONFETTI_LOTTIE = {
  v: '5.9.0', fr: 30, ip: 0, op: 60, w: 400, h: 400, nm: 'confetti', ddd: 0,
  assets: [],
  layers: Array.from({ length: 16 }, (_, i) => ({
    ddd: 0, ind: i + 1, ty: 4, nm: `dot${i}`,
    sr: 1, ks: {
      o: { a: 1, k: [{ t: 0, s: [100], e: [100] }, { t: 45, s: [100], e: [0] }, { t: 60, s: [0] }] },
      p: {
        a: 1, k: [
          { t: 0, s: [200, 200, 0], e: [200 + Math.cos(i * 22.5 * Math.PI / 180) * 120, 200 + Math.sin(i * 22.5 * Math.PI / 180) * 120, 0] },
          { t: 60, s: [200 + Math.cos(i * 22.5 * Math.PI / 180) * 160, 200 + Math.sin(i * 22.5 * Math.PI / 180) * 200, 0] },
        ]
      },
      s: { a: 1, k: [{ t: 0, s: [100, 100, 100], e: [80, 80, 100] }, { t: 60, s: [60, 60, 100] }] },
    },
    ao: 0,
    shapes: [{
      ty: 'gr', nm: 'g', it: [
        { ty: 'el', nm: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [14, 14] } },
        { ty: 'fl', nm: 'fl', c: { a: 0, k: [[1, 0.85, 0.2, 1], [0, 0.9, 0.46, 1], [0.25, 0.77, 1, 1], [0.8, 0.57, 0.85, 1], [1, 0.33, 0.33, 1]][i % 5] }, o: { a: 0, k: 100 } },
        { ty: 'tr', nm: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
      ],
    }],
    ip: 0, op: 60, st: 0,
  })),
};

export function ConfettiOverlay({ trigger, message, subMessage, onComplete }: ConfettiOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger) {
      // Trigger-driven, self-clearing animation: show now, auto-hide after 2.8s.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [trigger]); // eslint-disable-line

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)',
      animation: 'fadeIn .2s ease',
      pointerEvents: 'none',
    }}>
      <div style={{ width: 260, height: 260, pointerEvents: 'none' }}>
        <Lottie animationData={CONFETTI_LOTTIE} loop={false} style={{ width: '100%', height: '100%' }} />
      </div>
      {message && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <p style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: 'rgba(var(--fg),1)', letterSpacing: '-0.02em' }}>{message}</p>
          {subMessage && <p style={{ margin: 0, fontSize: 14, color: 'rgba(var(--fg),.6)' }}>{subMessage}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to fire confetti once per session for a given key.
 * Usage: const { fire, ConfettiEl } = useConfetti('first_investment');
 * Co-located with the component by design — it shares the same module.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useConfetti(key: string) {
  const storageKey = `gotham_confetti_${key}`;
  const [fired, setFired] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [subMessage, setSubMessage] = useState<string | undefined>();

  const alreadyShown = typeof window !== 'undefined' && !!localStorage.getItem(storageKey);

  function fire(msg?: string, sub?: string) {
    if (alreadyShown) return;
    setMessage(msg);
    setSubMessage(sub);
    setFired(true);
  }

  function handleComplete() {
    localStorage.setItem(storageKey, '1');
    setFired(false);
  }

  const ConfettiEl = (
    <ConfettiOverlay
      trigger={fired}
      message={message}
      subMessage={subMessage}
      onComplete={handleComplete}
    />
  );

  return { fire, ConfettiEl };
}

export default ConfettiOverlay;
