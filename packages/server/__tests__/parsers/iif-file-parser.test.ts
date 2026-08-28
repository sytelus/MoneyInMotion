import { describe, it, expect } from 'vitest';
import { IifFileParser } from '../../src/parsers/file-format/iif-file-parser.js';

describe('IifFileParser', () => {
    const parser = new IifFileParser();

    it('parses a simple IIF file with !TRNS header and TRNS data rows', () => {
        const content = [
            '!TRNS\tdate\taccnt\tname\tamount',
            'TRNS\t01/15/2024\tChecking\tWhole Foods\t-45.99',
            'TRNS\t01/16/2024\tChecking\tStarbucks\t-5.50',
        ].join('\n');

        const rows = parser.parse(content);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({
            date: '01/15/2024',
            accnt: 'Checking',
            name: 'Whole Foods',
            amount: '-45.99',
        });
        expect(rows[1]).toEqual({
            date: '01/16/2024',
            accnt: 'Checking',
            name: 'Starbucks',
            amount: '-5.50',
        });
    });

    it('returns empty array for file with no TRNS section', () => {
        const content = [
            '!SPL\tdate\taccnt\tamount',
            'SPL\t01/15/2024\tExpenses\t45.99',
        ].join('\n');

        const rows = parser.parse(content);

        expect(rows).toHaveLength(0);
    });

    it('handles multiple sections and only returns TRNS rows', () => {
        const content = [
            '!TRNS\tdate\tname\tamount',
            '!SPL\tdate\taccnt\tamount',
            'TRNS\t01/15/2024\tWhole Foods\t-45.99',
            'SPL\t01/15/2024\tExpenses\t45.99',
            'TRNS\t01/16/2024\tStarbucks\t-5.50',
            'SPL\t01/16/2024\tExpenses\t5.50',
        ].join('\n');

        const rows = parser.parse(content);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveProperty('name', 'Whole Foods');
        expect(rows[1]).toHaveProperty('name', 'Starbucks');
    });

    it('handles empty fields in the middle of a row', () => {
        const content = [
            '!TRNS\tdate\tname\tamount\tmemo',
            'TRNS\t01/15/2024\t\t-45.99\tgroceries',
            'TRNS\t01/16/2024\t\t-5.50\tsome memo',
        ].join('\n');

        const rows = parser.parse(content);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveProperty('date', '01/15/2024');
        expect(rows[0]).toHaveProperty('name', '');
        expect(rows[0]).toHaveProperty('memo', 'groceries');
        expect(rows[1]).toHaveProperty('name', '');
        expect(rows[1]).toHaveProperty('memo', 'some memo');
    });

    it('trailing tabs are trimmed and do not produce extra fields', () => {
        const content = [
            '!TRNS\tdate\tname\tamount\tmemo',
            'TRNS\t01/15/2024\tWhole Foods\t-45.99\t',
        ].join('\n');

        const rows = parser.parse(content);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveProperty('date', '01/15/2024');
        // trailing tab is stripped by trim(), so memo field is not included
        expect(rows[0]).not.toHaveProperty('memo');
    });

    it('skips empty lines', () => {
        const content = [
            '!TRNS\tdate\tname\tamount',
            '',
            'TRNS\t01/15/2024\tWhole Foods\t-45.99',
            '',
            'TRNS\t01/16/2024\tStarbucks\t-5.50',
        ].join('\n');

        const rows = parser.parse(content);

        expect(rows).toHaveLength(2);
    });

    it('removes surrounding double quotes from values', () => {
        const content = [
            '!TRNS\tdate\tname\tamount',
            'TRNS\t01/15/2024\t"Whole Foods Market"\t-45.99',
        ].join('\n');

        const rows = parser.parse(content);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveProperty('name', 'Whole Foods Market');
    });

    it('converts header names to lowercase', () => {
        const content = [
            '!TRNS\tDATE\tNAME\tAMOUNT',
            'TRNS\t01/15/2024\tWhole Foods\t-45.99',
        ].join('\n');

        const rows = parser.parse(content);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveProperty('date', '01/15/2024');
        expect(rows[0]).toHaveProperty('name', 'Whole Foods');
        expect(rows[0]).toHaveProperty('amount', '-45.99');
    });

    it('returns empty array for empty content', () => {
        const rows = parser.parse('');
        expect(rows).toHaveLength(0);
    });

    it('ignores TRNS data rows that appear before the header definition', () => {
        const content = [
            'TRNS\t01/15/2024\tOrphan\t-10.00',
            '!TRNS\tdate\tname\tamount',
            'TRNS\t01/16/2024\tStarbucks\t-5.50',
        ].join('\n');

        const rows = parser.parse(content);

        // The first TRNS row has no header defined yet, so columns is undefined and it is skipped
        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveProperty('name', 'Starbucks');
    });
});
