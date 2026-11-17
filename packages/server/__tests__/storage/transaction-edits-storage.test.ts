import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ScopeType,
  TransactionEdits,
  createAuditInfo,
  createScopeFilter,
  editValue,
} from '@moneyinmotion/core';
import { TransactionEditsStorage } from '../../src/storage/transaction-edits-storage.js';

describe('TransactionEditsStorage', () => {
  let tempDir: string;
  let filePath: string;
  const storage = new TransactionEditsStorage();

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-edits-storage-'));
    filePath = path.join(tempDir, 'LatestMergedEdits.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('round-trips an empty aggregate', () => {
    storage.save(filePath, new TransactionEdits('test'));

    const loaded = storage.load(filePath);
    expect(loaded.count).toBe(0);
    expect(loaded.sourceId).toBe('test');
  });

  it('rejects malformed JSON and invalid root shapes with a safe filename', () => {
    fs.writeFileSync(filePath, '{bad');
    expect(() => storage.load(filePath)).toThrow(
      'Failed to load transaction edits JSON from "LatestMergedEdits.json"',
    );

    fs.writeFileSync(filePath, '[]');
    expect(() => storage.load(filePath)).toThrow('edit aggregate root');
  });

  it('validates every persisted edit and rejects the C# base64 scope hashes', () => {
    const base64Scope = {
      ...createScopeFilter(ScopeType.All, []),
      contentHash: 'QjoA4VlkAWavNQgVyBr6TA==',
    };
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        sourceId: 'test',
        edits: [
          {
            id: 'base64-edit',
            auditInfo: createAuditInfo(),
            scopeFilters: [base64Scope],
            values: { note: editValue('note') },
            sourceId: 'test',
          },
        ],
      }),
    );
    expect(() => storage.load(filePath)).toThrow(/Invalid scope content hash/);

    fs.writeFileSync(filePath, JSON.stringify({ sourceId: 'bad', edits: [{ id: 42 }] }));
    expect(() => storage.load(filePath)).toThrow(/edits\[0\] is invalid/i);
  });

  it('backs up changed rules, keeping distinct backups when saves share a timestamp', () => {
    const backups = () =>
      fs
        .readdirSync(tempDir)
        .filter(
          (name) => name.startsWith('LatestMergedEdits.') && name !== 'LatestMergedEdits.json',
        );
    const edits = new TransactionEdits('test');
    storage.save(filePath, edits);
    const fixedTime = new Date('2024-01-02T03:04:05.006Z');
    for (const category of ['First', 'Second']) {
      fs.utimesSync(filePath, fixedTime, fixedTime);
      edits.createEditCategory([createScopeFilter(ScopeType.All, [])], [category]);
      storage.save(filePath, edits);
    }
    expect(backups()).toHaveLength(2);
    expect(new Set(backups()).size).toBe(2);

    // A rebuild that leaves the rules unchanged must not add another copy.
    storage.save(filePath, edits);
    expect(backups()).toHaveLength(2);
  });
});
