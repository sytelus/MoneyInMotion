import { describe, it, expect } from 'vitest';
import { normalize } from '../../src/normalization/entity-name-normalizer.js';

describe('EntityNameNormalizer', () => {
    // -----------------------------------------------------------------------
    // Basic normalisation
    // -----------------------------------------------------------------------

    it('should normalise an Amazon-style name with trailing reference', () => {
        const result = normalize('AMAZON.COM*MK4TL02S3');
        // Single token: regex splits into AMAZON, COM, MK, TL, S sub-matches.
        // Intermediate non-letter separators are kept; trailing digits on last
        // match that are < 4 chars are kept. Then all-uppercase + dot at
        // position > 1 => lowercase.
        expect(result).toBe('amazon.com*mk4tl02s3');
    });

    it('should normalise an all-uppercase multi-word name to title case', () => {
        const result = normalize('WHOLE FOODS MKT 10234');
        // All-uppercase, no dots => title case
        // Trailing "10234" is 5 digits (>= 4 chars) => stripped
        expect(result).toBe('Whole Foods Mkt');
    });

    it('should leave mixed case input unchanged', () => {
        const result = normalize('Trader Joes');
        // Mixed case: has both upper and lower => no conversion
        expect(result).toBe('Trader Joes');
    });

    it('should return trimmed original for empty input', () => {
        const result = normalize('');
        expect(result).toBe('');
    });

    it('should return trimmed original for whitespace-only input', () => {
        const result = normalize('   ');
        expect(result).toBe('');
    });

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    it('should handle null input gracefully', () => {
        // TypeScript would normally prevent null, but runtime safety matters
        const result = normalize(null as unknown as string);
        expect(result).toBe('');
    });

    it('should drop token with no letters (pure digits)', () => {
        // "123" token has no letter characters so the slicer regex produces no
        // match; the token normalises to "" and is filtered out.
        const result = normalize('STORE 123');
        expect(result).toBe('Store');
    });

    it('should drop standalone number tokens (4+ digits or any pure-number token)', () => {
        // "1234" has no letters => produces no regex match => filtered out
        const result = normalize('STORE 1234');
        expect(result).toBe('Store');
    });

    it('should keep short trailing digits on a letter token', () => {
        // In "MKT12", the slicer splits to "MKT" + "12". Since "12" has < 4
        // digits and is the trailing non-letter part of the last match, it
        // is kept.
        const result = normalize('MKT12');
        expect(result).toBe('Mkt12');
    });

    it('should handle a name with dots indicating a domain', () => {
        const result = normalize('PAYPAL.COM');
        // All uppercase + dot at position > 1 => lowercase
        expect(result).toBe('paypal.com');
    });

    it('should handle tokens with leading non-letter characters', () => {
        const result = normalize('*AMAZON STORE');
        // Leading * should be stripped from first match
        expect(result).toBe('Amazon Store');
    });

    it('should handle already lower-case input', () => {
        const result = normalize('some merchant');
        // All lowercase, no uppercase => not mixed, but isAllUpperCase = false
        // so no conversion applied
        expect(result).toBe('some merchant');
    });

    it('should handle single-word input', () => {
        const result = normalize('WALMART');
        expect(result).toBe('Walmart');
    });

    it('should keep non-letter separators between multiple regex matches in a token', () => {
        // A token like "FOO*BAR" stays as "FOO*BAR" after normalisation, then
        // title-case lowercases everything and uppercases only after whitespace,
        // so * does not trigger a capital letter.
        const result = normalize('FOO*BAR');
        expect(result).toBe('Foo*bar');
    });
});
