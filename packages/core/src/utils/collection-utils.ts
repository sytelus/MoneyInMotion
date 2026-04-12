/**
 * Generic collection helpers used across the domain layer.
 *
 * These are small, dependency-free functions that complement the built-in
 * `Array` and `Map` APIs with patterns frequently needed in financial
 * transaction processing.
 *
 * @module
 */

/**
 * Group an array of items by a computed key.
 *
 * @typeParam T - The element type.
 * @typeParam K - The key type (must be usable as a `Map` key).
 * @param items  - The items to group.
 * @param keyFn  - A function that derives the grouping key from an item.
 * @returns A {@link Map} whose keys are the distinct grouping values and
 *          whose values are arrays of items sharing that key, in their
 *          original order.
 *
 * @example
 * ```ts
 * const data = [
 *   { name: 'Alice', dept: 'Eng' },
 *   { name: 'Bob',   dept: 'Eng' },
 *   { name: 'Carol', dept: 'Sales' },
 * ];
 * const grouped = groupBy(data, (d) => d.dept);
 * // Map { 'Eng' => [Alice, Bob], 'Sales' => [Carol] }
 * ```
 */
export function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of items) {
        const key = keyFn(item);
        const group = map.get(key);
        if (group) {
            group.push(item);
        } else {
            map.set(key, [item]);
        }
    }
    return map;
}

/**
 * Sum the numeric values derived from each item in an array.
 *
 * @typeParam T - The element type.
 * @param items   - The items to sum over.
 * @param valueFn - A function that extracts or computes the numeric
 *                  value from each item.
 * @returns The sum of all values. Returns `0` for an empty array.
 *
 * @example
 * ```ts
 * const orders = [{ total: 10 }, { total: 25 }, { total: 5 }];
 * sumBy(orders, (o) => o.total);
 * // => 40
 * ```
 */
export function sumBy<T>(items: T[], valueFn: (item: T) => number): number {
    let sum = 0;
    for (const item of items) {
        sum += valueFn(item);
    }
    return sum;
}

/**
 * Find the most frequently occurring element in an array.
 *
 * When multiple elements share the highest frequency, the one that
 * appears first in the array is returned. Comparison uses `===`
 * (strict equality).
 *
 * @typeParam T - The element type.
 * @param items - The array to inspect.
 * @returns The most common element, or `undefined` if the array is empty.
 *
 * @example
 * ```ts
 * mostOccurring(['a', 'b', 'a', 'c', 'a', 'b']);
 * // => 'a'
 *
 * mostOccurring([]);
 * // => undefined
 * ```
 */
export function mostOccurring<T>(items: T[]): T | undefined {
    if (items.length === 0) {
        return undefined;
    }

    const counts = new Map<T, number>();
    let maxCount = 0;
    let maxItem: T = items[0]!;

    for (const item of items) {
        const count = (counts.get(item) ?? 0) + 1;
        counts.set(item, count);
        if (count > maxCount) {
            maxCount = count;
            maxItem = item;
        }
    }

    return maxItem;
}
