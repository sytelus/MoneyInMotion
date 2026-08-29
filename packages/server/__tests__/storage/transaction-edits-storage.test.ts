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

  it('validates every persisted edit while accepting legacy base64 scope hashes', () => {
    const legacyScope = {
      ...createScopeFilter(ScopeType.All, []),
      contentHash: 'QjoA4VlkAWavNQgVyBr6TA==',
    };
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        sourceId: 'legacy',
        edits: [
          {
            id: 'legacy-edit',
            auditInfo: createAuditInfo(),
            scopeFilters: [legacyScope],
            values: { note: editValue('legacy note') },
            sourceId: 'legacy',
          },
        ],
      }),
    );
    expect(storage.load(filePath).count).toBe(1);

    fs.writeFileSync(filePath, JSON.stringify({ sourceId: 'bad', edits: [{ id: 42 }] }));
    expect(() => storage.load(filePath)).toThrow(/edits\[0\] is invalid/i);
  });

  it('keeps distinct backups when consecutive saves share a timestamp', () => {
    const edits = new TransactionEdits('test');
    storage.save(filePath, edits);
    const fixedTime = new Date('2024-01-02T03:04:05.006Z');
    fs.utimesSync(filePath, fixedTime, fixedTime);
    storage.save(filePath, edits);

    fs.utimesSync(filePath, fixedTime, fixedTime);
    storage.save(filePath, edits);

    const backups = fs
      .readdirSync(tempDir)
      .filter((name) => name.startsWith('LatestMergedEdits.') && name !== 'LatestMergedEdits.json');
    expect(backups).toHaveLength(2);
    expect(new Set(backups).size).toBe(2);
  });
});
