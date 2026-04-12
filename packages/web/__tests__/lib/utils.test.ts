import { describe, it, expect } from 'vitest';
import { formatDate } from '../../src/lib/utils.js';

describe('formatDate', () => {
  it('formats ISO dates in UTC so statement dates do not shift by local timezone', () => {
    expect(formatDate('2024-02-01T00:00:00.000Z')).toBe('Feb 1, 2024');
  });
});
