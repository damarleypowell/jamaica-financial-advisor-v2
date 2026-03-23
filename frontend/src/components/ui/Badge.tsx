import type { ReactNode } from 'react';

type BadgeVariant = 'green' | 'red' | 'gold' | 'blue' | 'purple' | 'muted';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-green/15 text-green border-green/30',
  red: 'bg-red/15 text-red border-red/30',
  gold: 'bg-gold/15 text-gold border-gold/30',
  blue: 'bg-blue/15 text-blue border-blue/30',
  purple: 'bg-purple/15 text-purple border-purple/30',
  muted: 'bg-glass text-muted border-border',
};

export default function Badge({
  variant = 'muted',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
