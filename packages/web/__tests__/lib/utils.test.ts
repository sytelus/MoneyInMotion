import { describe, it, expect } from 'vitest';
import {
  countLabel,
  formatBytes,
  formatCurrency,
  formatDate,
  formatPeriodKey,
} from '../../src/lib/utils.js';
import { periodFromRange } from '../../src/store/transactions-store.js';
import { accountIdFromTitle } from '../../src/components/accounts/AccountFormDialog.js';

describe('formatting', () => {
  it('formats ISO dates in UTC so statement dates do not shift by local timezone', () => {
    expect(formatDate('2024-02-01T00:00:00.000Z')).toBe('Feb 1, 2024');
  });

  it('never shows floating-point leftovers as "-$0.00"', () => {
    expect(formatCurrency(-5.5e-17)).toBe('$0.00');
    expect(formatCurrency(-0)).toBe('$0.00');
    expect(formatCurrency(-1234.5)).toBe('-$1,234.50');
  });

  it('labels counts, periods and sizes for people', () => {
    expect(countLabel(1, 'item')).toBe('1 item');
    expect(countLabel(1200, 'item')).toBe('1,200 items');
    expect(formatPeriodKey('2026-10')).toBe('October 2026');
    expect(formatPeriodKey('2026-10-08')).toBe('Oct 8, 2026');
    expect(formatBytes(3_500)).toBe('3.4 KB');
  });
});

describe('periodFromRange', () => {
  it('recognizes whole months and years so a reload keeps the selected period', () => {
    expect(periodFromRange('2024-02-01', '2024-02-29')).toEqual({ year: '2024', month: '02' });
    expect(periodFromRange('2024-01-01', '2024-12-31')).toEqual({ year: '2024', month: null });
    expect(periodFromRange('2024-02-02', '2024-02-29')).toBeNull();
    expect(periodFromRange('', '')).toBeNull();
  });
});

describe('accountIdFromTitle', () => {
  it('turns a title into a safe folder name', () => {
    expect(accountIdFromTitle(' Visa Card / Joint ')).toBe('Visa-Card-Joint');
    expect(accountIdFromTitle('..')).toBe('');
  });
});
