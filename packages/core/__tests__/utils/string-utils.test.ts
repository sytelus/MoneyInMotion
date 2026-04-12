import { describe, it, expect } from 'vitest';
import {
    toTitleCase,
    splitWhitespace,
    isNullOrEmpty,
    isNullOrWhitespace,
    compareStringsInsensitive,
} from '../../src/utils/string-utils.js';

describe('toTitleCase', () => {
    it('should convert uppercase words to title case', () => {
        expect(toTitleCase('WHOLE FOODS')).toBe('Whole Foods');
    });

    it('should convert lowercase words to title case', () => {
        expect(toTitleCase('hello world')).toBe('Hello World');
    });

    it('should handle mixed case input', () => {
        expect(toTitleCase('hELLO wORLD')).toBe('Hello World');
    });

    it('should return empty string for empty input', () => {
        expect(toTitleCase('')).toBe('');
    });

    it('should handle single character', () => {
        expect(toTitleCase('a')).toBe('A');
    });

    it('should handle single word', () => {
        expect(toTitleCase('AMAZON')).toBe('Amazon');
    });

    it('should handle multiple spaces between words', () => {
        expect(toTitleCase('WHOLE  FOODS  MARKET')).toBe('Whole  Foods  Market');
    });
});

describe('splitWhitespace', () => {
    it('should split by spaces', () => {
        expect(splitWhitespace('foo bar baz')).toEqual(['foo', 'bar', 'baz']);
    });

    it('should handle multiple spaces', () => {
        expect(splitWhitespace('  foo   bar  baz ')).toEqual(['foo', 'bar', 'baz']);
    });

    it('should handle tabs and newlines', () => {
        expect(splitWhitespace('foo\tbar\nbaz')).toEqual(['foo', 'bar', 'baz']);
    });

    it('should return empty array for empty string', () => {
        expect(splitWhitespace('')).toEqual([]);
    });

    it('should return empty array for whitespace-only string', () => {
        expect(splitWhitespace('   ')).toEqual([]);
    });

    it('should handle single word', () => {
        expect(splitWhitespace('hello')).toEqual(['hello']);
    });
});

describe('isNullOrEmpty', () => {
    it('should return true for null', () => {
        expect(isNullOrEmpty(null)).toBe(true);
    });

    it('should return true for undefined', () => {
        expect(isNullOrEmpty(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
        expect(isNullOrEmpty('')).toBe(true);
    });

    it('should return false for whitespace string', () => {
        expect(isNullOrEmpty(' ')).toBe(false);
    });

    it('should return false for non-empty string', () => {
        expect(isNullOrEmpty('hello')).toBe(false);
    });
});

describe('isNullOrWhitespace', () => {
    it('should return true for null', () => {
        expect(isNullOrWhitespace(null)).toBe(true);
    });

    it('should return true for undefined', () => {
        expect(isNullOrWhitespace(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
        expect(isNullOrWhitespace('')).toBe(true);
    });

    it('should return true for whitespace-only string', () => {
        expect(isNullOrWhitespace('   ')).toBe(true);
    });

    it('should return true for tabs and newlines', () => {
        expect(isNullOrWhitespace('\t\n ')).toBe(true);
    });

    it('should return false for non-whitespace string', () => {
        expect(isNullOrWhitespace('hello')).toBe(false);
    });

    it('should return false for string with leading/trailing whitespace', () => {
        expect(isNullOrWhitespace('  hello  ')).toBe(false);
    });
});

describe('compareStringsInsensitive', () => {
    it('should return 0 for identical strings', () => {
        expect(compareStringsInsensitive('hello', 'hello')).toBe(0);
    });

    it('should return 0 for case-different strings', () => {
        expect(compareStringsInsensitive('Hello', 'hello')).toBe(0);
        expect(compareStringsInsensitive('HELLO', 'hello')).toBe(0);
    });

    it('should return negative when first sorts before second', () => {
        expect(compareStringsInsensitive('apple', 'banana')).toBeLessThan(0);
    });

    it('should return positive when first sorts after second', () => {
        expect(compareStringsInsensitive('banana', 'apple')).toBeGreaterThan(0);
    });

    it('should be usable as a sort comparator', () => {
        const arr = ['Banana', 'apple', 'Cherry'];
        arr.sort(compareStringsInsensitive);
        expect(arr).toEqual(['apple', 'Banana', 'Cherry']);
    });
});
