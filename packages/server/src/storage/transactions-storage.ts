/**
 * Transactions storage, ported from C# TransactionsStorage.
 *
 * Loads and saves LatestMerged.json.
 *
 * @module
 */

import * as fs from 'node:fs';
import { Transactions } from '@moneyinmotion/core';
import type { TransactionsData } from '@moneyinmotion/core';
import { parsePersistedTransactionEdits } from '../validation/transaction-edit-schema.js';
import { writeTextFileAtomically } from './atomic-file.js';
import { loadFailure } from './stored-data-error.js';

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
          throw new Error(`snapshot ${key} must be an object`);
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
      throw loadFailure(filePath, 'transactions JSON', err);
    }
  }

  /** Atomically replace the snapshot so a crash never leaves partial JSON. */
  save(filePath: string, transactions: Transactions): void {
    writeTextFileAtomically(filePath, JSON.stringify(transactions.serialize(), null, 2));
  }
}
