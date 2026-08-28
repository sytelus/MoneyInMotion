import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Transactions } from '@moneyinmotion/core';
import { TransactionsStorage } from '../../src/storage/transactions-storage.js';

describe('TransactionsStorage', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyai-storage-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('round-trips an empty Transactions collection', () => {
        const storage = new TransactionsStorage();
        const filePath = path.join(tempDir, 'LatestMerged.json');

        const original = new Transactions('test');
        storage.save(filePath, original);

        expect(fs.existsSync(filePath)).toBe(true);
        const loaded = storage.load(filePath);
        expect(loaded).toBeInstanceOf(Transactions);
        expect(loaded.allTransactionCount).toBe(0);
    });

    it('writes atomically via a temp file then rename', () => {
        const storage = new TransactionsStorage();
        const filePath = path.join(tempDir, 'LatestMerged.json');
        const tmpPath = `${filePath}.tmp`;

        // Pre-seed existing content so we can detect mid-write corruption.
        fs.writeFileSync(filePath, '{"name":"old","topItems":{},"accountInfos":{},"importInfos":{},"edits":[]}');

        storage.save(filePath, new Transactions('fresh'));

        // The temp file should be gone after rename completes.
        expect(fs.existsSync(tmpPath)).toBe(false);
        expect(fs.existsSync(filePath)).toBe(true);

        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(parsed.name).toBe('fresh');
    });

    it('throws a helpful error when loading malformed JSON', () => {
        const storage = new TransactionsStorage();
        const filePath = path.join(tempDir, 'bad.json');
        fs.writeFileSync(filePath, '{ not valid json');

        expect(() => storage.load(filePath)).toThrow(/Failed to parse transactions JSON/);
    });

    it('exists() reflects filesystem state', () => {
        const storage = new TransactionsStorage();
        const filePath = path.join(tempDir, 'LatestMerged.json');

        expect(storage.exists(filePath)).toBe(false);
        fs.writeFileSync(filePath, '{}');
        expect(storage.exists(filePath)).toBe(true);
    });
});
