import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildConfig } from '../../src/config.js';
import { stageAndPromoteFolder } from '../../src/services/folder-import-service.js';

describe('stageAndPromoteFolder', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-folder-upload-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function arrangeAccount(scanSubFolders = true): ReturnType<typeof buildConfig> {
    const config = buildConfig(tempDir, 'alex', 3001);
    fs.mkdirSync(config.statementsDir, { recursive: true });
    fs.mkdirSync(config.mergedDir, { recursive: true });
    fs.mkdirSync(config.stagingDir, { recursive: true });
    const accountDir = path.join(config.statementsDir, 'Amex');
    fs.mkdirSync(accountDir, { recursive: true });
    // Original C# casing is intentional: upload discovery must be
    // compatible with existing MoneyAI data.
    fs.writeFileSync(
      path.join(accountDir, 'AccountConfig.json'),
      JSON.stringify({
        accountInfo: {
          Id: 'Amex-Gold',
          InstituteName: 'AmericanExpress',
          Title: 'Amex',
          Type: 1,
          InterAccountNameTags: ['amex'],
        },
        fileFilters: ['*.csv'],
        scanSubFolders,
      }),
    );
    return config;
  }

  it('stages all matched files, promotes new content, and records duplicates/rejections', () => {
    const config = arrangeAccount();
    const existingContent = Buffer.from('Date,Description,Amount\n01/01/2024,Existing,-1\n');
    fs.writeFileSync(path.join(config.statementsDir, 'Amex', 'existing.csv'), existingContent);

    const newContent = Buffer.from('Date,Description,Amount\n01/02/2024,New,-2\n');
    const result = stageAndPromoteFolder(
      config,
      [
        { buffer: newContent },
        {
          buffer: existingContent,
        },
        { buffer: Buffer.from('no') },
      ],
      [
        'browser-export/Amex/new.csv',
        'browser-export/Amex/same-again.csv',
        'browser-export/Amex/notes.txt',
      ],
    );

    expect(result.promotedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    expect(fs.readFileSync(path.join(config.statementsDir, 'Amex', 'new.csv'), 'utf-8')).toBe(
      newContent.toString(),
    );

    const manifestPath = path.join(config.userDataPath, result.manifestPath);
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.batchId).toBe(result.batchId);
    expect(manifest.files).toHaveLength(3);
    expect(
      fs.existsSync(path.join(path.dirname(manifestPath), 'files', 'Amex', 'same-again.csv')),
    ).toBe(true);
  });

  it('rejects misspelled account folders before staging or promoting anything', () => {
    const config = arrangeAccount();
    const newContent = Buffer.from('Date,Description,Amount\n01/02/2024,New,-2\n');

    expect(() =>
      stageAndPromoteFolder(
        config,
        [{ buffer: newContent }, { buffer: newContent }],
        ['browser-export/Amex/new.csv', 'browser-export/Amxe/orphan.csv'],
      ),
    ).toThrow(/No configured account folder matches.*Amxe\/orphan\.csv.*no files were staged/i);

    expect(fs.readdirSync(config.stagingDir)).toHaveLength(0);
    expect(fs.existsSync(path.join(config.statementsDir, 'Amex', 'new.csv'))).toBe(false);
  });

  it('keeps both files when a filename is reused for different content', () => {
    const config = arrangeAccount();
    const first = Buffer.from('Date,Description,Amount\n01/01/2024,A,-1\n');
    const second = Buffer.from('Date,Description,Amount\n01/02/2024,B,-2\n');
    fs.writeFileSync(path.join(config.statementsDir, 'Amex', 'statement.csv'), first);

    const result = stageAndPromoteFolder(
      config,
      [{ buffer: second }],
      ['upload/Amex/statement.csv'],
    );

    expect(result.promotedCount).toBe(1);
    expect(result.files[0]?.destinationPath).toBe('Amex/statement (1).csv');
    expect(
      fs.readFileSync(path.join(config.statementsDir, 'Amex', 'statement (1).csv'), 'utf-8'),
    ).toBe(second.toString());
  });

  it('rejects traversal paths before writing a staging batch', () => {
    const config = arrangeAccount();
    expect(() =>
      stageAndPromoteFolder(config, [{ buffer: Buffer.from('x') }], ['upload/../escape.csv']),
    ).toThrow(/Unsafe upload path/);
    expect(fs.readdirSync(config.stagingDir)).toHaveLength(0);
  });

  it('stages but does not promote nested files an account is configured not to scan', () => {
    const config = arrangeAccount(false);

    const result = stageAndPromoteFolder(
      config,
      [{ buffer: Buffer.from('Date,Description,Amount\n01/01/2024,A,-1\n') }],
      ['upload/Amex/2024/statement.csv'],
    );

    expect(result).toMatchObject({ promotedCount: 0, rejectedCount: 1 });
    expect(result.files[0]?.message).toContain('not to scan statement subfolders');
    expect(fs.existsSync(path.join(config.statementsDir, 'Amex', '2024', 'statement.csv'))).toBe(
      false,
    );
    const manifestPath = path.join(config.userDataPath, result.manifestPath);
    expect(
      fs.existsSync(
        path.join(path.dirname(manifestPath), 'files', 'Amex', '2024', 'statement.csv'),
      ),
    ).toBe(true);
  });
});
