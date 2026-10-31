import React from 'react';
import { cn } from '../../lib/utils';
import { FreshnessStatus } from '../../types/api';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'fefo-fresh'
    | 'fefo-warning'
    | 'fefo-critical'
    | 'fefo-expired'
    | 'offline';
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-zinc-800 text-zinc-200 border-zinc-700/60',
    secondary: 'bg-zinc-900 text-zinc-400 border-zinc-800',
    outline: 'bg-transparent text-zinc-300 border-zinc-700',
    'fefo-fresh':
      'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 font-mono text-xs',
    'fefo-warning':
      'bg-amber-950/40 text-amber-300 border-amber-800/60 font-mono text-xs',
    'fefo-critical':
      'bg-rose-950/50 text-rose-300 border-rose-800/70 font-mono text-xs animate-pulse-subtle',
    'fefo-expired':
      'bg-zinc-900/80 text-zinc-500 border-zinc-800 font-mono text-xs line-through',
    offline:
      'bg-zinc-800/50 text-zinc-400 border-dashed border-zinc-600 font-mono text-xs',
  };

  const dotColors = {
    default: 'bg-zinc-400',
    secondary: 'bg-zinc-500',
    outline: 'bg-zinc-400',
    'fefo-fresh': 'bg-emerald-400',
    'fefo-warning': 'bg-amber-400',
    'fefo-critical': 'bg-rose-400 animate-ping',
    'fefo-expired': 'bg-zinc-600',
    offline: 'bg-zinc-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border select-none transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColors[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/**
 * Convenience helper to render a FEFO badge automatically given a FreshnessStatus enum
 */
export function FreshnessBadge({
  status,
  days,
  className,
}: {
  status: FreshnessStatus;
  days?: number;
  className?: string;
}) {
  switch (status) {
    case 'FRESH':
      return (
        <Badge variant="fefo-fresh" dot className={className}>
          {days !== undefined ? `${days}д до кінця` : 'Свіжий'}
        </Badge>
      );
    case 'EXPIRING_SOON':
      return (
        <Badge variant="fefo-warning" dot className={className}>
          {days !== undefined ? `Спливає (${days}д)` : 'Спливає незабаром'}
        </Badge>
      );
    case 'CRITICAL':
      return (
        <Badge variant="fefo-critical" dot className={className}>
          {days !== undefined && days === 0 ? '< 24 год!' : `Критично (${days}д)`}
        </Badge>
      );
    case 'EXPIRED':
      return (
        <Badge variant="fefo-expired" className={className}>
          Прострочено
        </Badge>
      );
  }
}
