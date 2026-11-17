import { describe, it, expect } from 'vitest';
import { toTitleCase, splitWhitespace, isNullOrWhitespace } from '../../src/utils/string-utils.js';

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
