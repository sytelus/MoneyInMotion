/**
 * Generic key-counting utility, ported from the legacy JS `KeyCounter.js`.
 *
 * Tracks how many times each key is added and provides helpers for
 * retrieving the most common key, sorted results, and aggregate stats.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// KeyCounter
// ---------------------------------------------------------------------------

/**
 * A generic counter that tallies occurrences of keys.
 *
 * @typeParam T - The key type (defaults to `string`).
 */
export class KeyCounter<T = string> {
    private counts: Map<T, number> = new Map();
    private _count: number = 0;
    private _missedCount: number = 0;

    /**
     * @param keyMapper - Optional function that transforms a key before
     *   counting. If the mapper returns `undefined` the key is treated as
     *   "missed" (increments {@link missedCount} but not the key tallies).
     */
    constructor(private keyMapper?: (key: T | undefined) => T | undefined) {}

    /**
     * Record one occurrence of {@link key}.
     *
     * If a `keyMapper` was provided it is applied first. When the (mapped)
     * key is `undefined` the call increments {@link missedCount} instead of
     * the key tallies.
     */
    add(key: T | undefined): void {
        this._count++;

        if (this.keyMapper) {
            key = this.keyMapper(key);
        }

        if (key === undefined) {
            this._missedCount++;
            return;
        }

        const current = this.counts.get(key) ?? 0;
        this.counts.set(key, current + 1);
    }

    /** Number of distinct keys that have been counted. */
    get keyCount(): number {
        return this.counts.size;
    }

    /** Total number of calls to {@link add} (including missed). */
    get count(): number {
        return this._count;
    }

    /** Number of calls to {@link add} where the (mapped) key was `undefined`. */
    get missedCount(): number {
        return this._missedCount;
    }

    /**
     * Return the key with the highest count, or `undefined` if nothing has
     * been counted.
     *
     * When multiple keys share the same highest count, the key that was
     * added first is returned (i.e. insertion-order tie-breaking via the
     * underlying `Map` iteration order).
     */
    getTop(): { key: T; count: number } | undefined {
        let maxKey: T | undefined;
        let maxCount = -1;

        for (const [key, count] of this.counts) {
            if (count > maxCount) {
                maxKey = key;
                maxCount = count;
            }
        }

        if (maxKey === undefined) return undefined;
        return { key: maxKey, count: maxCount };
    }

    /**
     * Return all key/count pairs sorted by count.
     *
     * @param descending - When `true` (default) the highest count comes
     *   first; when `false` the lowest count comes first.
     */
    getSorted(descending: boolean = true): Array<{ key: T; count: number }> {
        const entries = Array.from(this.counts.entries()).map(([key, count]) => ({
            key,
            count,
        }));

        entries.sort((a, b) => descending ? b.count - a.count : a.count - b.count);
        return entries;
    }

    /**
     * `true` when every non-missed addition used the same key.
     *
     * Returns `false` when there are no counted keys at all, or when more
     * than one distinct key has been seen.
     */
    get allSame(): boolean {
        const notMissed = this._count - this._missedCount;
        return notMissed > 0 && this.counts.size === 1;
    }
}
