import { describe, expect, it } from 'vitest';
import { FileLocation } from '../../src/storage/file-location.js';

describe('FileLocation', () => {
  it('rejects relative paths that escape the repository root', () => {
    expect(() => new FileLocation('/tmp/mim-root', '../secret.csv')).toThrow(
      'escapes repository root',
    );
  });

  it('normalizes portable addresses to forward slashes', () => {
    const location = new FileLocation('/tmp/mim-root', 'account/statement.csv');
    expect(location.portableAddress).toBe('account/statement.csv');
  });
});
