/**
 * Styled HTML select component with Tailwind classes.
 *
 * Uses a plain HTML `<select>` for simplicity rather than Radix Select.
 *
 * @module
 */

import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface SelectOption {
  /** The value attribute of the option. */
  value: string;
  /** The display label shown to the user. */
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** The list of options to render. */
  options: SelectOption[];
  /** Optional placeholder text shown as the first disabled option. */
  placeholder?: string;
}

/**
 * A styled `<select>` element consistent with the application design system.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  },
);

Select.displayName = 'Select';
