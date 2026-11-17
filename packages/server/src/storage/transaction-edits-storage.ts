/**
 * Transaction edits storage, ported from C# TransactionEditsStorage.
 *
 * Loads and saves LatestMergedEdits.json with timestamped backup on save.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { TransactionEdits } from '@moneyinmotion/core';
import { parsePersistedTransactionEdits } from '../validation/transaction-edit-schema.js';
import { writeTextFileAtomically } from './atomic-file.js';
import { loadFailure } from './stored-data-error.js';

export class TransactionEditsStorage {
  /**
   * Load transaction edits from a JSON file.
   *
   * @param filePath - The path to the LatestMergedEdits.json file.
   * @returns A TransactionEdits instance.
   */
  load(filePath: string): TransactionEdits {
    try {
      const serializedData = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(serializedData) as unknown;
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('edit aggregate root must be a JSON object');
      }
      const data = parsed as {
        name?: unknown;
        sourceId?: unknown;
        edits?: unknown;
      };
      if (data.name != null && typeof data.name !== 'string') {
        throw new Error('edit aggregate name must be a string');
      }
      if (data.sourceId != null && typeof data.sourceId !== 'string') {
        throw new Error('edit aggregate sourceId must be a string');
      }
      if (data.edits != null && !Array.isArray(data.edits)) {
        throw new Error('edit aggregate edits must be an array');
      }

      const edits = new TransactionEdits(
        (data.sourceId as string | undefined) ??
          (data.name as string | undefined) ??
          'LatestMerged.json',
      );
      const persistedEdits = parsePersistedTransactionEdits(
        data.edits ?? [],
        'edit aggregate edits',
      );
      for (const edit of persistedEdits) {
        edits.add(edit);
      }
      return edits;
    } catch (err) {
      throw loadFailure(filePath, 'transaction edits JSON', err);
    }
  }

  /**
   * Save the rules, first copying a changed existing file to
   * `LatestMergedEdits.<mtime>.json`. Unchanged rules (as after most
   * rebuilds) are neither rewritten nor backed up again.
   */
  save(filePath: string, edits: TransactionEdits): void {
    const serializedData = JSON.stringify(edits.serialize(), null, 2);
    if (fs.existsSync(filePath)) {
      if (fs.readFileSync(filePath, 'utf-8') === serializedData) return;
      const timestamp = formatTimestamp(fs.statSync(filePath).mtime);
      const ext = path.extname(filePath);
      const baseName = filePath.slice(0, filePath.length - ext.length);
      let archiveFilePath = `${baseName}.${timestamp}${ext}`;
      for (let suffix = 1; fs.existsSync(archiveFilePath); suffix += 1) {
        archiveFilePath = `${baseName}.${timestamp}.${suffix}${ext}`;
      }
      fs.copyFileSync(filePath, archiveFilePath);
    }
    writeTextFileAtomically(filePath, serializedData);
  }
}

/**
 * Format a Date as a compact timestamp string: yyyyMMddHHmmssffff.
 */
function formatTimestamp(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const mo = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  const h = date.getUTCHours().toString().padStart(2, '0');
  const mi = date.getUTCMinutes().toString().padStart(2, '0');
  const s = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(4, '0');
  return `${y}${mo}${d}${h}${mi}${s}${ms}`;
}
