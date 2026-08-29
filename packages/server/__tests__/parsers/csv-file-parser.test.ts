import { describe, it, expect } from 'vitest';
import { CsvFileParser } from '../../src/parsers/file-format/csv-file-parser.js';

describe('CsvFileParser', () => {
  const parser = new CsvFileParser();

  it('parses CSV with header row', () => {
    const content = [
      'Name,Amount,Date',
      'Whole Foods,-45.99,01/15/2024',
      'Starbucks,-5.50,01/16/2024',
    ].join('\n');

    const rows = parser.parse(content);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      name: 'Whole Foods',
      amount: '-45.99',
      date: '01/15/2024',
    });
    expect(rows[1]).toEqual({
      name: 'Starbucks',
      amount: '-5.50',
      date: '01/16/2024',
    });
  });

  it('converts header names to lowercase', () => {
    const content = 'DESCRIPTION,AMOUNT\nTest,-10.00\n';
    const rows = parser.parse(content);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('description', 'Test');
    expect(rows[0]).toHaveProperty('amount', '-10.00');
  });

  it('handles banner lines when hasBannerLines is true', () => {
    const content = [
      'Some Banner', // short line, skipped
      'Another Banner Line', // short line, skipped
      'Date,Description,Amount,Balance', // real header (4 cols)
      '01/01/2024,Grocery Store,-50.00,1000.00',
      '01/02/2024,Gas Station,-30.00,970.00',
    ].join('\n');

    const rows = parser.parse(content, { hasBannerLines: true });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveProperty('date', '01/01/2024');
    expect(rows[0]).toHaveProperty('description', 'Grocery Store');
    expect(rows[0]).toHaveProperty('amount', '-50.00');
  });

  it('prefixes ignored columns with underscore', () => {
    const content = ['Name,Amount,Notes', 'Test,-10.00,some note'].join('\n');

    const rows = parser.parse(content, {
      ignoreColumns: new Set(['notes']),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('_notes', 'some note');
    expect(rows[0]).not.toHaveProperty('notes');
  });

  it('skips empty lines', () => {
    const content = ['Name,Amount', '', 'Test,-10.00', '', 'Test2,-20.00'].join('\n');

    const rows = parser.parse(content);
    expect(rows).toHaveLength(2);
  });

  it('removes trailing blank columns', () => {
    const content = ['Name,Amount', 'Test,-10.00,', 'Test2,-20.00,,'].join('\n');

    const rows = parser.parse(content);
    expect(rows).toHaveLength(2);
    expect(Object.keys(rows[0]!)).toEqual(['name', 'amount']);
  });

  it('recovers an unquoted thousands separator in a final amount column', () => {
    const rows = parser.parse(
      'Type,Date,Description,Amount\nPayment,09/01/2015,Thank you,--6,408.99\n',
    );

    expect(rows).toEqual([
      {
        type: 'Payment',
        date: '09/01/2015',
        description: 'Thank you',
        amount: '--6,408.99',
      },
    ]);
  });

  it('rejects ambiguous extra fields instead of silently truncating them', () => {
    expect(() => parser.parse('Name,Amount,Date\nShop,-5.00,2024-01-01,extra\n')).toThrow(
      /Quote values that contain commas/,
    );
  });

  it('rejects malformed quoting reported by the CSV parser', () => {
    expect(() => parser.parse('Name,Amount\n"unterminated,-5.00\n')).toThrow(/CSV parsing failed/i);
  });

  it('rejects duplicate header names that would overwrite financial fields', () => {
    expect(() => parser.parse('Name,Amount,Amount\nShop,-5.00,-6.00\n')).toThrow(
      /duplicate column names/i,
    );
  });

  it('returns empty array for empty content', () => {
    const rows = parser.parse('');
    expect(rows).toHaveLength(0);
  });
});
