/**
 * Styled text input component with Tailwind classes.
 *
 * @module
 */

import * as React from 'react';
import { cn } from '../../lib/utils.js';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * A styled input element consistent with the application design system.
 * Supports all standard HTML input attributes via prop spreading.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
