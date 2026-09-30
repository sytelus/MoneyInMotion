import React, { type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../../lib/utils.js';

type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const toneStyles: Record<NoticeTone, { frame: string; icon: string }> = {
  info: {
    frame: 'border-info-border bg-info text-info-foreground',
    icon: 'text-info-foreground',
  },
  success: {
    frame: 'border-success-border bg-success text-success-foreground',
    icon: 'text-success-foreground',
  },
  warning: {
    frame: 'border-warning-border bg-warning text-warning-foreground',
    icon: 'text-warning-foreground',
  },
  error: {
    frame: 'border-red-300 bg-red-50 text-red-950',
    icon: 'text-red-800',
  },
};

const toneIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

interface NoticeProps {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  role?: 'alert' | 'status';
  className?: string;
}

/**
 * A consistent, high-contrast explanation for important state changes and
 * recoverable problems. Titles state what happened; body copy states impact and
 * recovery. Keep raw implementation errors out of this component's user copy.
 */
export function Notice({
  tone,
  title,
  children,
  actions,
  role = tone === 'error' ? 'alert' : 'status',
  className,
}: NoticeProps) {
  const Icon = toneIcons[tone];
  const styles = toneStyles[tone];

  return (
    <div
      role={role}
      className={cn('rounded-lg border border-l-4 p-3 text-sm', styles.frame, className)}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', styles.icon)} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-5">{title}</p>
          {children && <div className="mt-1 leading-6">{children}</div>}
          {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
