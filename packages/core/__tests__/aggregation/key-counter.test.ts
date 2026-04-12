import { describe, it, expect } from 'vitest';
import { KeyCounter } from '../../src/aggregation/key-counter.js';

// ---------------------------------------------------------------------------
// Basic counting
// ---------------------------------------------------------------------------

describe('KeyCounter', () => {
    it('should count occurrences of keys', () => {
        const counter = new KeyCounter<string>();
        counter.add('a');
        counter.add('b');
        counter.add('a');
        counter.add('a');

        expect(counter.count).toBe(4);
        expect(counter.keyCount).toBe(2);
        expect(counter.missedCount).toBe(0);
    });

    it('should return 0 counts when nothing has been added', () => {
        const counter = new KeyCounter<string>();

        expect(counter.count).toBe(0);
        expect(counter.keyCount).toBe(0);
        expect(counter.missedCount).toBe(0);
    });

    // -----------------------------------------------------------------------
    // getTop
    // -----------------------------------------------------------------------

    describe('getTop', () => {
        it('should return the key with the highest count', () => {
            const counter = new KeyCounter<string>();
            counter.add('x');
            counter.add('y');
            counter.add('y');
            counter.add('z');
            counter.add('y');

            const top = counter.getTop();
            expect(top).toEqual({ key: 'y', count: 3 });
        });

        it('should return undefined when no keys have been counted', () => {
            const counter = new KeyCounter<string>();
            expect(counter.getTop()).toBeUndefined();
        });

        it('should return undefined when all adds were missed', () => {
            const counter = new KeyCounter<string>(() => undefined);
            counter.add('a');
            counter.add('b');

            expect(counter.getTop()).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // getSorted
    // -----------------------------------------------------------------------

    describe('getSorted', () => {
        it('should return entries sorted descending by default', () => {
            const counter = new KeyCounter<string>();
            counter.add('a');
            counter.add('b');
            counter.add('b');
            counter.add('c');
            counter.add('c');
            counter.add('c');

            const sorted = counter.getSorted();
            expect(sorted).toEqual([
                { key: 'c', count: 3 },
                { key: 'b', count: 2 },
                { key: 'a', count: 1 },
            ]);
        });

        it('should return entries sorted ascending when descending is false', () => {
            const counter = new KeyCounter<string>();
            counter.add('a');
            counter.add('b');
            counter.add('b');

            const sorted = counter.getSorted(false);
            expect(sorted).toEqual([
                { key: 'a', count: 1 },
                { key: 'b', count: 2 },
            ]);
        });

        it('should return an empty array when nothing has been counted', () => {
            const counter = new KeyCounter<string>();
            expect(counter.getSorted()).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // allSame
    // -----------------------------------------------------------------------

    describe('allSame', () => {
        it('should be true when all non-missed adds used the same key', () => {
            const counter = new KeyCounter<string>();
            counter.add('x');
            counter.add('x');
            counter.add('x');

            expect(counter.allSame).toBe(true);
        });

        it('should be false when multiple distinct keys have been added', () => {
            const counter = new KeyCounter<string>();
            counter.add('x');
            counter.add('y');

            expect(counter.allSame).toBe(false);
        });

        it('should be false when nothing has been counted', () => {
            const counter = new KeyCounter<string>();
            expect(counter.allSame).toBe(false);
        });

        it('should be true with missed keys as long as only one real key', () => {
            const counter = new KeyCounter<string>((key) => {
                return key === 'skip' ? undefined : key;
            });
            counter.add('a');
            counter.add('skip');
            counter.add('a');

            expect(counter.missedCount).toBe(1);
            expect(counter.allSame).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // missedCount
    // -----------------------------------------------------------------------

    describe('missedCount', () => {
        it('should track undefined keys as missed when keyMapper returns undefined', () => {
            const counter = new KeyCounter<string>(() => undefined);
            counter.add('a');
            counter.add('b');

            expect(counter.count).toBe(2);
            expect(counter.missedCount).toBe(2);
            expect(counter.keyCount).toBe(0);
        });

        it('should track undefined raw keys as missed without a mapper', () => {
            const counter = new KeyCounter<string>();
            counter.add(undefined);
            counter.add('a');

            expect(counter.count).toBe(2);
            expect(counter.missedCount).toBe(1);
            expect(counter.keyCount).toBe(1);
        });
    });

    // -----------------------------------------------------------------------
    // keyMapper
    // -----------------------------------------------------------------------

    describe('keyMapper', () => {
        it('should transform keys before counting', () => {
            const counter = new KeyCounter<string>((key) =>
                key ? key.toUpperCase() : undefined,
            );
            counter.add('hello');
            counter.add('Hello');
            counter.add('HELLO');

            expect(counter.keyCount).toBe(1);
            expect(counter.getTop()).toEqual({ key: 'HELLO', count: 3 });
        });
    });

    // -----------------------------------------------------------------------
    // Numeric keys
    // -----------------------------------------------------------------------

    describe('numeric keys', () => {
        it('should work with number keys', () => {
            const counter = new KeyCounter<number>();
            counter.add(1);
            counter.add(2);
            counter.add(1);

            expect(counter.keyCount).toBe(2);
            expect(counter.getTop()).toEqual({ key: 1, count: 2 });
        });
    });
});
