import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getMD5HashString } from '@moneyinmotion/core';
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

  it('derives import identity from the portable address on every platform', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-location-test-'));
    try {
      fs.mkdirSync(path.join(temporary, 'Amex', '2024'), { recursive: true });
      fs.writeFileSync(path.join(temporary, 'Amex', '2024', 'jan.csv'), 'Date,Amount\n');
      // path.join yields backslashes on Windows; the stored address and hashed
      // ID must still match the Linux/WSL result so snapshots stay portable.
      const location = new FileLocation(temporary, path.join('Amex', '2024', 'jan.csv'), {
        isImportInfo: true,
      });
      expect(location.importInfo?.portableAddress).toBe('Amex/2024/jan.csv');
      expect(location.importInfo?.id).toBe(getMD5HashString('Amex/2024/jan.csv', true));
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
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
