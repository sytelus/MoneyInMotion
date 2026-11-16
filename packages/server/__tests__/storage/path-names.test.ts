import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasParentSegment, isPortableName, isWithinOrEqual } from '../../src/storage/path-names.js';
import { buildConfig, isValidUsername } from '../../src/config.js';

describe('portable path names', () => {
  it('rejects names Windows would silently change or treat as devices', () => {
    for (const name of [
      'amex.',
      'amex ',
      'CON',
      'nul.csv',
      'com1',
      'LPT9',
      'a:b',
      'a?b',
      'tab\tname',
    ]) {
      expect(isPortableName(name), name).toBe(false);
    }
    for (const name of ['amex', 'Opus-Chk', 'v1.2', 'console', 'My Statements']) {
      expect(isPortableName(name), name).toBe(true);
    }
  });

  it('finds parent segments with either separator', () => {
    expect(hasParentSegment('E:\\data\\..\\x')).toBe(true);
    expect(hasParentSegment('/srv/../x')).toBe(true);
    expect(hasParentSegment('/srv/..x/y')).toBe(false);
  });

  it('checks containment without being fooled by prefixes', () => {
    const root = path.resolve('/data/user');
    expect(isWithinOrEqual(root, root)).toBe(true);
    expect(isWithinOrEqual(root, path.join(root, 'Merged'))).toBe(true);
    expect(isWithinOrEqual(root, path.join(root, '..dots'))).toBe(true);
    expect(isWithinOrEqual(root, `${root}-other`)).toBe(false);
    expect(isWithinOrEqual(root, path.resolve('/data'))).toBe(false);
  });

  it.runIf(process.platform === 'win32')('compares Windows paths without regard to case', () => {
    expect(isWithinOrEqual('C:\\Users\\Me', 'c:\\users\\me\\backup.zip')).toBe(true);
  });

  it('applies the same rules to usernames and strips a trailing data-root separator', () => {
    expect(isValidUsername('alex.')).toBe(false);
    expect(isValidUsername('aux')).toBe(false);
    expect(isValidUsername('alex')).toBe(true);
    const root = path.resolve('/srv/mim_root');
    expect(buildConfig(`${root}${path.sep}`, 'alex', 3001).dataRoot).toBe(root);
  });
});
