/**
 * Small badge/pill component with color variants.
 *
 * @module
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input text-foreground',
        success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * A small badge/pill component for displaying status, type, or count
 * information. Supports `default`, `secondary`, `destructive`, `outline`,
 * `success`, `warning`, and `info` color variants.
 */
export const Badge: React.FC<BadgeProps> = ({ className, variant, ...props }) => {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
};

Badge.displayName = 'Badge';

export { badgeVariants };
