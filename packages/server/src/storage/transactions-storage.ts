/**
 * Transactions storage, ported from C# TransactionsStorage.
 *
 * Loads LatestMerged.json (using deserializeDictionary from core for
 * C# wire format compatibility) and saves with JSON.stringify.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Transactions } from '@moneyinmotion/core';
import type { TransactionsData } from '@moneyinmotion/core';
import { parsePersistedTransactionEdits } from '../validation/transaction-edit-schema.js';
import { writeTextFileAtomically } from './atomic-file.js';

export class TransactionsStorage {
  /**
   * Load transactions from a JSON file.
   *
   * @param filePath - The path to the LatestMerged.json file.
   * @returns A Transactions instance.
   */
  load(filePath: string): Transactions {
    try {
      const serializedData = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(serializedData) as unknown;
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('snapshot root must be a JSON object');
      }
      const data = parsed as Partial<TransactionsData>;
      if (typeof data.name !== 'string' || !data.name.trim()) {
        throw new Error('snapshot name must be a non-empty string');
      }
      for (const key of ['topItems', 'accountInfos', 'importInfos'] as const) {
        const value = data[key];
        if (value == null || typeof value !== 'object') {
          throw new Error(`snapshot ${key} must be an object or legacy dictionary array`);
        }
      }
      if (data.edits != null) {
        const embeddedEdits = Array.isArray(data.edits)
          ? data.edits
          : data.edits != null && typeof data.edits === 'object' && 'edits' in data.edits
            ? data.edits.edits
            : null;
        parsePersistedTransactionEdits(embeddedEdits, 'snapshot edits');
      }
      return Transactions.fromData(data as TransactionsData);
    } catch (err) {
      throw new Error(
        `Failed to load transactions JSON from "${path.basename(filePath)}": ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
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
    writeTextFileAtomically(filePath, serializedData);
  }

  /**
   * Check if a transactions file exists.
   */
  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}
