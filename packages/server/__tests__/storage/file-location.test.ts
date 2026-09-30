import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
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

  it('does not invent source timestamps when file metadata cannot be read', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-location-test-'));
    try {
      expect(() => new FileLocation(temporary, 'missing.csv', { isImportInfo: true })).toThrow(
        /ENOENT/,
      );
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
});
