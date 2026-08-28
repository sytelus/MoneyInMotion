import { describe, it, expect } from 'vitest';
import { formatDateUtc, parseDate, daysBetween } from '../../src/utils/date-utils.js';

describe('formatDateUtc', () => {
    it('should format a date in C# universal sortable format', () => {
        const date = new Date('2024-01-15T08:30:00Z');
        expect(formatDateUtc(date)).toBe('2024-01-15 08:30:00Z');
    });

    it('should zero-pad single-digit components', () => {
        const date = new Date('2024-03-05T01:02:03Z');
        expect(formatDateUtc(date)).toBe('2024-03-05 01:02:03Z');
    });

    it('should handle midnight', () => {
        const date = new Date('2024-12-31T00:00:00Z');
        expect(formatDateUtc(date)).toBe('2024-12-31 00:00:00Z');
    });

    it('should handle end of day', () => {
        const date = new Date('2024-06-15T23:59:59Z');
        expect(formatDateUtc(date)).toBe('2024-06-15 23:59:59Z');
    });

    it('should always use UTC regardless of local timezone', () => {
        // Create a date from a non-UTC string; formatDateUtc should still use UTC
        const date = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
        expect(formatDateUtc(date)).toBe('2024-01-15 12:00:00Z');
    });
});

describe('parseDate', () => {
    it('should parse ISO 8601 with timezone', () => {
        const date = parseDate('2024-01-15T08:30:00Z');
        expect(date.toISOString()).toBe('2024-01-15T08:30:00.000Z');
    });

    it('should parse ISO 8601 date-only as UTC midnight', () => {
        const date = parseDate('2024-01-15');
        expect(date.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    });

    it('should parse US date format MM/dd/yyyy', () => {
        const date = parseDate('01/15/2024');
        expect(date.getUTCFullYear()).toBe(2024);
        expect(date.getUTCMonth()).toBe(0); // January
        expect(date.getUTCDate()).toBe(15);
    });

    it('should parse US date format with single-digit month/day', () => {
        const date = parseDate('1/5/2024');
        expect(date.getUTCFullYear()).toBe(2024);
        expect(date.getUTCMonth()).toBe(0);
        expect(date.getUTCDate()).toBe(5);
    });

    it('should trim whitespace before parsing', () => {
        const date = parseDate('  2024-01-15T08:30:00Z  ');
        expect(date.toISOString()).toBe('2024-01-15T08:30:00.000Z');
    });

    it('should throw on invalid date string', () => {
        expect(() => parseDate('not-a-date')).toThrow('Invalid date string');
    });

    it('should throw on empty string', () => {
        expect(() => parseDate('')).toThrow('Invalid date string');
    });

    it('should reject out-of-range month in US format', () => {
        expect(() => parseDate('13/01/2024')).toThrow('Invalid date string');
    });

    it('should reject out-of-range day in US format', () => {
        expect(() => parseDate('01/32/2024')).toThrow('Invalid date string');
    });

    it('should reject day that overflows month length (e.g. Feb 30)', () => {
        expect(() => parseDate('02/30/2024')).toThrow('Invalid date string');
    });

    it('should accept Feb 29 in a leap year', () => {
        const date = parseDate('02/29/2024');
        expect(date.getUTCMonth()).toBe(1);
        expect(date.getUTCDate()).toBe(29);
    });

    it('should reject Feb 29 in a non-leap year', () => {
        expect(() => parseDate('02/29/2023')).toThrow('Invalid date string');
    });
});

describe('daysBetween', () => {
    it('should return 0 for the same date', () => {
        const date = new Date('2024-01-15T00:00:00Z');
        expect(daysBetween(date, date)).toBe(0);
    });

    it('should return correct days for dates in order', () => {
        const a = new Date('2024-01-01T00:00:00Z');
        const b = new Date('2024-01-10T00:00:00Z');
        expect(daysBetween(a, b)).toBe(9);
    });

    it('should return absolute value regardless of order', () => {
        const a = new Date('2024-01-10T00:00:00Z');
        const b = new Date('2024-01-01T00:00:00Z');
        expect(daysBetween(a, b)).toBe(9);
    });

    it('should handle cross-month boundaries', () => {
        const a = new Date('2024-01-30T00:00:00Z');
        const b = new Date('2024-02-02T00:00:00Z');
        expect(daysBetween(a, b)).toBe(3);
    });

    it('should handle cross-year boundaries', () => {
        const a = new Date('2023-12-31T00:00:00Z');
        const b = new Date('2024-01-01T00:00:00Z');
        expect(daysBetween(a, b)).toBe(1);
    });

    it('should truncate fractional days', () => {
        const a = new Date('2024-01-01T00:00:00Z');
        const b = new Date('2024-01-02T12:00:00Z'); // 1.5 days
        expect(daysBetween(a, b)).toBe(1);
    });

    it('should handle large ranges', () => {
        const a = new Date('2020-01-01T00:00:00Z');
        const b = new Date('2024-01-01T00:00:00Z'); // 4 years, includes leap year
        expect(daysBetween(a, b)).toBe(1461); // 365*4 + 1 leap day
    });
});
