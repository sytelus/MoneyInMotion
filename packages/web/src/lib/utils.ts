/**
 * Shared utility functions for the web package.
 *
 * Provides the shadcn/ui `cn` classname helper along with domain-specific
 * formatters for currency, dates, and category paths.
 *
 * @module
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS class names, resolving conflicts automatically.
 *
 * Combines `clsx` (conditional class joining) with `tailwind-merge`
 * (deduplication of conflicting Tailwind utilities).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric amount as a US-dollar currency string.
 *
 * @param amount - The numeric amount to format.
 * @returns A string like `"$1,234.56"` or `"-$42.00"`.
 */
export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return amount < 0 ? `-${formatted}` : formatted;
}

/**
 * Format an ISO-8601 date string into a human-readable short form.
 *
 * @param dateStr - An ISO-8601 date string (e.g. `"2024-03-15T00:00:00Z"`).
 * @returns A string like `"Mar 15, 2024"`.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Format a category path array into a human-readable breadcrumb string.
 *
 * @param path - An array of category path segments, or `null`/`undefined`.
 * @returns A string like `"Food > Groceries"`, or `"Uncategorized"` when empty.
 */
export function formatCategoryPath(path: string[] | null | undefined): string {
  if (!path || path.length === 0) {
    return 'Uncategorized';
  }
  return path.join(' > ');
}

/**
 * Return the month name for a 1-based month number.
 *
 * @param month - Month number (1 = January, 12 = December).
 * @returns The full month name (e.g. `"January"`).
 */
export function getMonthName(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Month must be an integer from 1 through 12.');
  }
  const date = new Date(2000, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long' });
}
