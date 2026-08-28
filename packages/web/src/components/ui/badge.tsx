/**
 * Small badge/pill component with color variants.
 *
 * @module
 */

import * as React from 'react';
import { cn } from '../../lib/utils.js';

type BadgeVariant =
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  outline: 'border border-input text-foreground',
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * A small badge/pill component for displaying status, type, or count
 * information. Supports `default`, `secondary`, `destructive`, `outline`,
 * `success`, `warning`, and `info` color variants.
 */
export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', ...props }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
};

Badge.displayName = 'Badge';
