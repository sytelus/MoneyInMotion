/**
 * Date formatting and parsing utilities.
 *
 * All formatting functions produce UTC-based strings for consistency with
 * the original C# implementation and the stored JSON data files.
 *
 * @module
 */

/**
 * Format a {@link Date} as a UTC string matching C#'s universal sortable
 * date/time pattern (`"u"` format specifier): `yyyy-MM-dd HH:mm:ssZ`.
 *
 * @param date - The date to format.
 * @returns A UTC-formatted date string.
 *
 * @example
 * ```ts
 * formatDateUtc(new Date('2024-01-15T08:30:00Z'));
 * // => "2024-01-15 08:30:00Z"
 * ```
 */
export function formatDateUtc(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  const h = date.getUTCHours().toString().padStart(2, '0');
  const min = date.getUTCMinutes().toString().padStart(2, '0');
  const s = date.getUTCSeconds().toString().padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}Z`;
}

/**
 * Parse a date string into a {@link Date} object.
 *
 * Supports ISO 8601 strings (e.g. `2024-01-15T08:30:00Z`) as well as
 * common US date formats such as `MM/dd/yyyy` and `M/d/yyyy`. Strings
 * that contain only a date portion (no time component) are interpreted
 * as midnight UTC.
 *
 * @param value - The date string to parse.
 * @returns A {@link Date} instance.
 * @throws {Error} If the string cannot be parsed into a valid date.
 *
 * @example
 * ```ts
 * parseDate('2024-01-15T08:30:00Z');
 * // => Date representing 2024-01-15 08:30:00 UTC
 *
 * parseDate('01/15/2024');
 * // => Date representing 2024-01-15 00:00:00 UTC
 *
 * parseDate('2024-01-15');
 * // => Date representing 2024-01-15 00:00:00 UTC
 * ```
 */
export function parseDate(value: string): Date {
  const trimmed = value.trim();

  function invalidDate(): never {
    throw new Error(`Invalid date string: "${value}"`);
  }

  function utcDate(year: number, month: number, day: number): Date {
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return invalidDate();
    }

    // `Date.UTC` treats years 0 through 99 as 1900 through 1999. Setting the
    // full year explicitly preserves the literal input and lets validation
    // reject only genuinely impossible calendar dates.
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return invalidDate();
    }
    return date;
  }

  // Date.UTC silently normalizes impossible dates (for example February 30),
  // so date-only formats share strict component validation.
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (usMatch) {
    return utcDate(
      Number.parseInt(usMatch[3]!, 10),
      Number.parseInt(usMatch[1]!, 10),
      Number.parseInt(usMatch[2]!, 10),
    );
  }

  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDateOnly) {
    return utcDate(
      Number.parseInt(isoDateOnly[1]!, 10),
      Number.parseInt(isoDateOnly[2]!, 10),
      Number.parseInt(isoDateOnly[3]!, 10),
    );
  }

  // The built-in timestamp parser normalizes some impossible calendar dates
  // (for example, 2024-02-30T12:00:00Z). Validate an ISO timestamp's calendar
  // prefix ourselves before delegating its time and offset parsing.
  const isoTimestamp = /^(\d{4})-(\d{2})-(\d{2})[T ]/.exec(trimmed);
  if (isoTimestamp) {
    utcDate(
      Number.parseInt(isoTimestamp[1]!, 10),
      Number.parseInt(isoTimestamp[2]!, 10),
      Number.parseInt(isoTimestamp[3]!, 10),
    );
  }

  // Fall through to the built-in parser for timestamp formats.
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return invalidDate();
  }
  return date;
}

/**
 * Calculate the absolute number of whole days between two dates.
 *
 * Fractional days are truncated (floored).
 *
 * @param a - The first date.
 * @param b - The second date.
 * @returns The non-negative integer number of days between the two dates.
 *
 * @example
 * ```ts
 * daysBetween(
 *   new Date('2024-01-01'),
 *   new Date('2024-01-10'),
 * );
 * // => 9
 * ```
 */
const MS_PER_DAY = 86_400_000;

export function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY);
}
