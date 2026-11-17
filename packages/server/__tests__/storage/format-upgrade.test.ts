import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ScopeType, createScopeFilter } from '@moneyinmotion/core';
import { upgradeStoredFormats } from '../../src/storage/format-upgrade.js';

const legacyConfig = {
  accountInfo: {
    Id: 'Bank-Checking',
    InstituteName: 'Bank',
    AccountBrand: 'Unused',
    Title: 'Checking',
    Type: 2,
    InterAccountNameTags: ['bank'],
  },
  fileFilters: ['*.csv'],
  scanSubFolders: true,
};

function rule(contentHash: string) {
  return {
    id: 'rule-1',
    auditInfo: { createDate: '2014-01-23T05:28:43.414Z', createdBy: 'owner' },
    scopeFilters: [
      {
        type: ScopeType.EntityNameNormalized,
        parameters: ['Coffee'],
        referenceParameters: ['COFFEE 123'],
        contentHash,
      },
    ],
    values: { categoryPath: { value: ['Food'], isVoided: false } },
    sourceId: 'Trial',
  };
}

describe('upgradeStoredFormats', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-format-upgrade-'));
    fs.mkdirSync(path.join(root, 'Statements', 'Checking'), { recursive: true });
    fs.mkdirSync(path.join(root, 'Merged'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rewrites PascalCase account configs once', () => {
    const configPath = path.join(root, 'Statements', 'Checking', 'AccountConfig.json');
    fs.writeFileSync(configPath, JSON.stringify(legacyConfig));

    expect(upgradeStoredFormats(root).accountConfigs).toEqual(['Checking']);
    expect(JSON.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual({
      accountInfo: {
        id: 'Bank-Checking',
        instituteName: 'Bank',
        title: 'Checking',
        type: 2,
        requiresParent: false,
        interAccountNameTags: ['bank'],
      },
      fileFilters: ['*.csv'],
      scanSubFolders: true,
    });

    const before = fs.readFileSync(configPath, 'utf-8');
    expect(upgradeStoredFormats(root).accountConfigs).toEqual([]);
    expect(fs.readFileSync(configPath, 'utf-8')).toBe(before);
  });

  it('recomputes base64 scope hashes in the rules and the snapshot', () => {
    const editsPath = path.join(root, 'Merged', 'LatestMergedEdits.json');
    const snapshotPath = path.join(root, 'Merged', 'LatestMerged.json');
    const legacyHash = 'QjoA4VlkAWavNQgVyBr6TA==';
    fs.writeFileSync(editsPath, JSON.stringify({ name: 'Trial', edits: [rule(legacyHash)] }));
    fs.writeFileSync(
      snapshotPath,
      JSON.stringify({
        name: 'Trial',
        topItems: {},
        accountInfos: {},
        importInfos: {},
        edits: [rule(legacyHash)],
      }),
    );
    const expected = createScopeFilter(ScopeType.EntityNameNormalized, ['Coffee'], ['COFFEE 123']);

    expect(upgradeStoredFormats(root)).toMatchObject({ editHashes: 1, snapshotHashes: 1 });

    const edits = JSON.parse(fs.readFileSync(editsPath, 'utf-8'));
    expect(edits.edits[0].scopeFilters[0].contentHash).toBe(expected.contentHash);
    expect(edits.edits[0].values).toEqual(rule(legacyHash).values);
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    expect(snapshot.edits[0].scopeFilters[0].contentHash).toBe(expected.contentHash);
    // The previous rules file is kept as a timestamped copy.
    expect(
      fs
        .readdirSync(path.join(root, 'Merged'))
        .filter((name) => /^LatestMergedEdits\.\d/.test(name)),
    ).toHaveLength(1);

    expect(upgradeStoredFormats(root)).toEqual({
      accountConfigs: [],
      editHashes: 0,
      snapshotHashes: 0,
    });
  });
});
