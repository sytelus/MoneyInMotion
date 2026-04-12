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

    // Try US-style MM/dd/yyyy (with optional time)
    const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (usMatch) {
        const [, month, day, year] = usMatch;
        const date = new Date(Date.UTC(
            parseInt(year!, 10),
            parseInt(month!, 10) - 1,
            parseInt(day!, 10),
        ));
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date string: "${value}"`);
        }
        return date;
    }

    // Try yyyy-MM-dd (date only, no time) -> interpret as UTC midnight
    const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed);
    if (isoDateOnly) {
        const date = new Date(trimmed + 'T00:00:00Z');
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date string: "${value}"`);
        }
        return date;
    }

    // Fall through to built-in Date parser for ISO 8601 and other formats
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date string: "${value}"`);
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
