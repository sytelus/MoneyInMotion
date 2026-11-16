import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverAccountConfigs } from '../../src/storage/account-config-repository.js';

/** Windows and macOS volumes usually cannot hold folders differing only by case. */
function caseSensitiveFilesystem(): boolean {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-Case-'));
  try {
    return !fs.existsSync(probe.toLowerCase()) || probe === probe.toLowerCase();
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
}

describe('account discovery identity boundaries', () => {
  let statements: string;
  beforeEach(() => {
    statements = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-account-discovery-'));
  });
  afterEach(() => {
    fs.rmSync(statements, { recursive: true, force: true });
  });

  function account(folder: string, id: string): void {
    fs.mkdirSync(path.join(statements, folder));
    fs.writeFileSync(
      path.join(statements, folder, 'AccountConfig.json'),
      JSON.stringify({
        accountInfo: { id, instituteName: 'Generic', type: 2, requiresParent: false },
        fileFilters: ['*.csv'],
        scanSubFolders: true,
      }),
    );
  }

  it('rejects duplicate account IDs ignoring case and identifies both configs', () => {
    account('First', 'checking');
    account('Second', 'CHECKING');
    expect(() => discoverAccountConfigs(statements)).toThrow(
      /Second\/AccountConfig.json.*First\/AccountConfig.json/,
    );
  });

  it.runIf(caseSensitiveFilesystem())(
    'rejects configured folder names that differ only in case',
    () => {
      account('Bank', 'first');
      account('bank', 'second');
      expect(() => discoverAccountConfigs(statements)).toThrow(
        /folder names must be unique ignoring case/,
      );
    },
  );

  it('does not silently ignore dangling config symlinks', () => {
    fs.mkdirSync(path.join(statements, 'Bank'));
    fs.symlinkSync(
      path.join(statements, 'missing.json'),
      path.join(statements, 'Bank', 'AccountConfig.json'),
    );
    expect(() => discoverAccountConfigs(statements)).toThrow(/regular file, not a symbolic link/);
  });
});
