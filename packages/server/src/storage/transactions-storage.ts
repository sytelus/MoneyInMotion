/**
 * Transactions storage, ported from C# TransactionsStorage.
 *
 * Loads LatestMerged.json (using deserializeDictionary from core for
 * C# wire format compatibility) and saves with JSON.stringify.
 *
 * @module
 */

import * as fs from 'node:fs';
import { Transactions } from '@moneyinmotion/core';
import type { TransactionsData } from '@moneyinmotion/core';

export class TransactionsStorage {
    /**
     * Load transactions from a JSON file.
     *
     * @param filePath - The path to the LatestMerged.json file.
     * @returns A Transactions instance.
     */
    load(filePath: string): Transactions {
        const serializedData = fs.readFileSync(filePath, 'utf-8');
        let data: TransactionsData;
        try {
            data = JSON.parse(serializedData) as TransactionsData;
        } catch (err) {
            throw new Error(
                `Failed to parse transactions JSON from "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
            );
        }
        return Transactions.fromData(data);
    }

    /**
     * Save transactions to a JSON file.
     *
     * Writes to a sibling `.tmp` file first, then renames it into place so
     * that a crash or full disk mid-write cannot leave a half-written
     * `LatestMerged.json` on disk. The rename is atomic on POSIX; on
     * Windows the pre-existing target is replaced.
     *
     * @param filePath     - The path to write the file to.
     * @param transactions - The Transactions instance to save.
     */
    save(filePath: string, transactions: Transactions): void {
        const data = transactions.serialize();
        const serializedData = JSON.stringify(data, null, 2);
        const tmpPath = `${filePath}.tmp`;
        fs.writeFileSync(tmpPath, serializedData, 'utf-8');
        fs.renameSync(tmpPath, filePath);
    }

    /**
     * Check if a transactions file exists.
     */
    exists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }
}
