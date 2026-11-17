/**
 * Shared utility functions for the web package.
 *
 * Provides the shadcn/ui `cn` classname helper along with domain-specific
 * formatters for currency and dates.
 *
 * @module
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseDate } from '@moneyinmotion/core';

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
 * A count with its noun in the right number: `countLabel(1, 'item')` is
 * "1 item", `countLabel(1200, 'item')` is "1,200 items".
 */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

/** Format a byte count for people: "512 B", "3.4 KB", "12.5 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Format a numeric amount as a US-dollar currency string.
 *
 * @param amount - The numeric amount to format.
 * @returns A string like `"$1,234.56"` or `"-$42.00"`.
 */
export function formatCurrency(amount: number): string {
  const cents = roundToCents(amount);
  const formatted = usd.format(Math.abs(cents));
  return cents < 0 ? `-${formatted}` : formatted;
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Round to whole cents, so floating-point leftovers such as -5.5e-17 count as
 * zero (never "-$0.00"), and -0 becomes 0.
 */
export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100 || 0;
}

/**
 * Format an ISO-8601 date string into a human-readable short form.
 *
 * @param dateStr - An ISO-8601 date string (e.g. `"2024-03-15T00:00:00Z"`).
 * @returns A string like `"Mar 15, 2024"`.
 */
export function formatDate(dateStr: string): string {
  let date: Date;
  try {
    date = parseDate(dateStr);
  } catch {
    return dateStr;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Label a report period key for people: `"2026-10"` is "October 2026" and
 * `"2026-10-08"` is "Oct 8, 2026". Other strings are returned unchanged.
 */
export function formatPeriodKey(key: string): string {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(key);
  if (!match) return key;
  const [, year, month, day] = match;
  if (day) return formatDate(key);
  return `${getMonthName(Number(month))} ${year}`;
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
