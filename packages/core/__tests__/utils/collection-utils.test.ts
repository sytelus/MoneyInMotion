import { describe, it, expect } from 'vitest';
import { groupBy, sumBy, mostOccurring } from '../../src/utils/collection-utils.js';

describe('groupBy', () => {
    it('should group items by a string key', () => {
        const data = [
            { name: 'Alice', dept: 'Eng' },
            { name: 'Bob', dept: 'Eng' },
            { name: 'Carol', dept: 'Sales' },
        ];
        const grouped = groupBy(data, (d) => d.dept);

        expect(grouped.size).toBe(2);
        expect(grouped.get('Eng')).toEqual([
            { name: 'Alice', dept: 'Eng' },
            { name: 'Bob', dept: 'Eng' },
        ]);
        expect(grouped.get('Sales')).toEqual([
            { name: 'Carol', dept: 'Sales' },
        ]);
    });

    it('should group items by a numeric key', () => {
        const data = [1, 2, 3, 4, 5, 6];
        const grouped = groupBy(data, (n) => n % 2);

        expect(grouped.size).toBe(2);
        expect(grouped.get(0)).toEqual([2, 4, 6]);
        expect(grouped.get(1)).toEqual([1, 3, 5]);
    });

    it('should return empty map for empty array', () => {
        const grouped = groupBy([], () => 'key');
        expect(grouped.size).toBe(0);
    });

    it('should preserve insertion order within groups', () => {
        const data = ['banana', 'apple', 'blueberry', 'avocado'];
        const grouped = groupBy(data, (s) => s[0]!);

        expect(grouped.get('b')).toEqual(['banana', 'blueberry']);
        expect(grouped.get('a')).toEqual(['apple', 'avocado']);
    });

    it('should handle all items in one group', () => {
        const data = [1, 2, 3];
        const grouped = groupBy(data, () => 'all');

        expect(grouped.size).toBe(1);
        expect(grouped.get('all')).toEqual([1, 2, 3]);
    });
});

describe('sumBy', () => {
    it('should sum numeric property values', () => {
        const orders = [{ total: 10 }, { total: 25 }, { total: 5 }];
        expect(sumBy(orders, (o) => o.total)).toBe(40);
    });

    it('should return 0 for empty array', () => {
        expect(sumBy([], () => 1)).toBe(0);
    });

    it('should handle negative values', () => {
        const data = [{ val: 10 }, { val: -3 }, { val: -7 }];
        expect(sumBy(data, (d) => d.val)).toBe(0);
    });

    it('should handle floating point values', () => {
        const data = [{ val: 0.1 }, { val: 0.2 }];
        expect(sumBy(data, (d) => d.val)).toBeCloseTo(0.3);
    });

    it('should work with computed values', () => {
        const data = [{ qty: 2, price: 5 }, { qty: 3, price: 10 }];
        expect(sumBy(data, (d) => d.qty * d.price)).toBe(40);
    });
});

describe('mostOccurring', () => {
    it('should return the most frequent element', () => {
        expect(mostOccurring(['a', 'b', 'a', 'c', 'a', 'b'])).toBe('a');
    });

    it('should return undefined for empty array', () => {
        expect(mostOccurring([])).toBeUndefined();
    });

    it('should return the first element when all are unique', () => {
        expect(mostOccurring(['a', 'b', 'c'])).toBe('a');
    });

    it('should handle single element', () => {
        expect(mostOccurring([42])).toBe(42);
    });

    it('should return the first of tied elements', () => {
        // 'x' and 'y' both appear twice; 'x' appears first
        expect(mostOccurring(['x', 'y', 'x', 'y'])).toBe('x');
    });

    it('should work with numbers', () => {
        expect(mostOccurring([1, 2, 3, 2, 2, 1])).toBe(2);
    });

    it('should handle all identical elements', () => {
        expect(mostOccurring([5, 5, 5, 5])).toBe(5);
    });
});
