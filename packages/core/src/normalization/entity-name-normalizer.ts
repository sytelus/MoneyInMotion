/**
 * Entity name normalization, ported from C# `EntityNameNormalizer`.
 *
 * Cleans merchant / payee names from bank statements by stripping trailing
 * reference numbers, normalising punctuation, and applying case conversion
 * rules so that visually similar names collapse to the same canonical form.
 *
 * @module
 */

import { toTitleCase } from '../utils/string-utils.js';

// ---------------------------------------------------------------------------
// Pre-compiled patterns (mirrors the static Regex fields in the C# class)
// ---------------------------------------------------------------------------

/**
 * Slice a token into three groups:
 *   1. Leading non-letter characters
 *   2. Middle part starting with a letter (the meaningful payload)
 *   3. Trailing non-letter characters
 *
 * Uses Unicode property escapes (`\p{L}`) so that accented characters and
 * non-Latin scripts are treated as letters, matching the .NET behaviour.
 */
const slicerRegex = /([^\p{L}]*)([\p{L}]+.*?)([^\p{L}]*)/gu;

/**
 * Matches any non-digit character, used to strip trailing non-numeric chars.
 * Equivalent to the C# `nonDigits` pattern `[^\p{N}]*`.
 */
const nonDigitsRegex = /[^\p{N}]/gu;

// ---------------------------------------------------------------------------
// Token-level normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a single whitespace-delimited token.
 *
 * The algorithm slices the token using {@link slicerRegex} and reassembles it:
 * - For the *first* match: the leading non-letter part is dropped.
 * - For *non-last* matches: trailing non-letter parts are kept.
 * - For the *last* match: trailing non-letter chars are stripped, then only
 *   digits shorter than 4 characters are re-appended.
 *
 * @param token - A single whitespace-free token from the entity name.
 * @returns The cleaned token string.
 */
function normalizeToken(token: string): string {
    let cleaned = '';

    // Reset the regex (it has the `g` flag so `lastIndex` must be reset).
    slicerRegex.lastIndex = 0;

    // Collect all matches first so we know which is the last one.
    const matches: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = slicerRegex.exec(token)) !== null) {
        matches.push(m);
    }

    for (let i = 0; i < matches.length; i++) {
        const groups = matches[i]!;
        const startingNonLetterPart = groups[1]!;
        const middlePart = groups[2]!;
        const finalNonLetterPart = groups[3]!;

        // Skip leading non-letters of the first match
        if (i > 0) {
            cleaned += startingNonLetterPart;
        }

        cleaned += middlePart;

        if (i === matches.length - 1) {
            // Last match: strip non-digits, keep only if < 4 chars
            const digitsOnly = finalNonLetterPart.replace(nonDigitsRegex, '');
            if (digitsOnly.length < 4) {
                cleaned += digitsOnly;
            }
        } else {
            cleaned += finalNonLetterPart;
        }
    }

    return cleaned;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalise an entity (merchant / payee) name from a bank statement.
 *
 * The normalisation pipeline:
 * 1. Split the input into whitespace-delimited tokens.
 * 2. Apply {@link normalizeToken} to each token.
 * 3. Filter out null / whitespace-only results and re-join with a single space.
 * 4. Apply case-conversion rules:
 *    - If the result has mixed case (both upper and lower): leave as-is.
 *    - If all-uppercase *and* contains a dot after position 1: lowercase
 *      (likely a domain name such as `AMAZON.COM`).
 *    - If all-uppercase with no qualifying dot: title case.
 * 5. If the cleaned result is empty, fall back to the original trimmed input.
 *
 * @param text - The raw entity name string.
 * @returns The normalised entity name.
 */
export function normalize(text: string): string {
    const input = text ?? '';
    const tokens = input.split(/\s+/);

    const cleanedTokens = tokens
        .map((t) => normalizeToken(t))
        .filter((t) => t.trim().length > 0);

    let cleanedName = cleanedTokens.join(' ').trim();

    // Case conversion logic
    const hasAnyUpperCase = /\p{Lu}/u.test(cleanedName);
    const hasAnyLowerCase = /\p{Ll}/u.test(cleanedName);

    // Only convert case when NOT mixed case
    if (!(hasAnyLowerCase && hasAnyUpperCase)) {
        const isAllUpperCase =
            !hasAnyLowerCase &&
            [...cleanedName].every((c) => /\p{Lu}/u.test(c) || !/\p{L}/u.test(c));
        const hasDot = cleanedName.indexOf('.') > 1; // Possible .com names

        if (isAllUpperCase) {
            cleanedName = hasDot ? cleanedName.toLowerCase() : toTitleCase(cleanedName);
        }
    }

    if (cleanedName.length === 0) {
        cleanedName = input.trim();
    }

    return cleanedName;
}
