import React, { type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const toneStyles: Record<NoticeTone, { frame: string; icon: string }> = {
  info: {
    frame:
      'border-sky-300 bg-sky-50 text-slate-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-slate-50',
    icon: 'text-sky-700 dark:text-sky-300',
  },
  success: {
    frame:
      'border-emerald-300 bg-emerald-50 text-slate-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-slate-50',
    icon: 'text-emerald-700 dark:text-emerald-300',
  },
  warning: {
    frame:
      'border-amber-300 bg-amber-50 text-slate-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-slate-50',
    icon: 'text-amber-800 dark:text-amber-300',
  },
  error: {
    frame:
      'border-red-300 bg-red-50 text-slate-950 dark:border-red-800 dark:bg-red-950/50 dark:text-slate-50',
    icon: 'text-red-700 dark:text-red-300',
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
      className={cn('rounded-xl border p-4 text-sm shadow-sm', styles.frame, className)}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', styles.icon)} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-5">{title}</p>
          {children && <div className="mt-1 leading-6 text-current/90">{children}</div>}
          {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
