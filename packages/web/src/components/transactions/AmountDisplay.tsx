/**
 * Reusable component for displaying monetary amounts with color coding.
 *
 * Negative amounts are displayed in red (expense), positive in green (income).
 *
 * @module
 */

import React from 'react';
import { cn } from '../../lib/utils.js';
import { formatCurrency } from '../../lib/utils.js';

export interface AmountDisplayProps {
  /** The numeric amount to display. */
  amount: number;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * Display a currency amount with color coding: red for expenses (negative),
 * green for income (positive).
 */
export const AmountDisplay: React.FC<AmountDisplayProps> = ({ amount, className }) => {
  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        amount < 0 ? 'text-expense' : 'text-income',
        className,
      )}
    >
      {formatCurrency(amount)}
    </span>
  );
};

AmountDisplay.displayName = 'AmountDisplay';
