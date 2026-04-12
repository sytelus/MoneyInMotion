import { describe, it, expect } from 'vitest';
import { JsonFileParser } from '../../src/parsers/file-format/json-file-parser.js';

describe('JsonFileParser', () => {
    const parser = new JsonFileParser();

    it('parses a valid JSON array of objects', () => {
        const content = JSON.stringify([
            { Name: 'Whole Foods', Amount: '-45.99', Date: '01/15/2024' },
            { Name: 'Starbucks', Amount: '-5.50', Date: '01/16/2024' },
        ]);

        const rows = parser.parse(content);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({
            Name: 'Whole Foods',
            Amount: '-45.99',
            Date: '01/15/2024',
        });
        expect(rows[1]).toEqual({
            Name: 'Starbucks',
            Amount: '-5.50',
            Date: '01/16/2024',
        });
    });

    it('returns empty array for empty JSON array', () => {
        const rows = parser.parse('[]');
        expect(rows).toHaveLength(0);
    });

    it('throws on non-array JSON (e.g. plain object)', () => {
        // A plain object is not iterable as an array, so the for-of loop throws
        expect(() => parser.parse('{"key": "value"}')).toThrow();
    });

    it('throws on invalid JSON syntax', () => {
        expect(() => parser.parse('{bad json')).toThrow(/Failed to parse JSON content/);
    });

    it('skips non-object items in the array', () => {
        const content = JSON.stringify([
            { Name: 'Valid' },
            'string item',
            42,
            null,
            [1, 2, 3],
            { Name: 'Also Valid' },
        ]);

        const rows = parser.parse(content);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({ Name: 'Valid' });
        expect(rows[1]).toEqual({ Name: 'Also Valid' });
    });

    it('respects ignoreColumns setting', () => {
        const content = JSON.stringify([
            { description: 'Test Item', amount: '10.00', notes: 'some note' },
        ]);

        const rows = parser.parse(content, {
            ignoreColumns: new Set(['description']),
        });

        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveProperty('_description', 'Test Item');
        expect(rows[0]).not.toHaveProperty('description');
        expect(rows[0]).toHaveProperty('amount', '10.00');
    });

    it('handles objects with varying keys', () => {
        const content = JSON.stringify([
            { Name: 'Alice', Age: '30' },
            { Name: 'Bob', City: 'Seattle' },
            { Name: 'Charlie', Age: '25', City: 'Portland' },
        ]);

        const rows = parser.parse(content);

        expect(rows).toHaveLength(3);
        expect(rows[0]).toEqual({ Name: 'Alice', Age: '30' });
        expect(rows[1]).toEqual({ Name: 'Bob', City: 'Seattle' });
        expect(rows[2]).toEqual({ Name: 'Charlie', Age: '25', City: 'Portland' });
    });

    it('converts non-string values to strings', () => {
        const content = JSON.stringify([
            { name: 'Test', count: 42, active: true, score: 3.14 },
        ]);

        const rows = parser.parse(content);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual({
            name: 'Test',
            count: '42',
            active: 'true',
            score: '3.14',
        });
    });

    it('converts null values to empty strings', () => {
        const content = JSON.stringify([
            { name: 'Test', value: null },
        ]);

        const rows = parser.parse(content);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual({ name: 'Test', value: '' });
    });
});
