/**
 * String manipulation utilities used throughout the domain layer.
 *
 * @module
 */

/**
 * Convert a string to title case (first letter of each word uppercased,
 * remaining letters lowercased).
 *
 * @param str - The input string.
 * @returns The title-cased string.
 *
 * @example
 * ```ts
 * toTitleCase('WHOLE FOODS');   // => "Whole Foods"
 * toTitleCase('hello world');   // => "Hello World"
 * toTitleCase('');              // => ""
 * ```
 */
export function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (ch) => ch.toUpperCase());
}

/**
 * Split a string by any contiguous whitespace, filtering out empty
 * segments that result from leading/trailing whitespace.
 *
 * @param str - The input string.
 * @returns An array of non-empty tokens.
 *
 * @example
 * ```ts
 * splitWhitespace('  foo   bar  baz ');
 * // => ["foo", "bar", "baz"]
 * ```
 */
export function splitWhitespace(str: string): string[] {
  const trimmed = str.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return trimmed.split(/\s+/);
}

/**
 * Test whether a string is `null`, `undefined`, empty, or contains
 * only whitespace characters.
 *
 * @param str - The value to test.
 * @returns `true` if the value is nullish, empty, or whitespace-only.
 *
 * @example
 * ```ts
 * isNullOrWhitespace(null);      // => true
 * isNullOrWhitespace(undefined); // => true
 * isNullOrWhitespace('');        // => true
 * isNullOrWhitespace('   ');     // => true
 * isNullOrWhitespace('hi');      // => false
 * ```
 */
export function isNullOrWhitespace(str: string | null | undefined): boolean {
  return str == null || str.trim().length === 0;
}
