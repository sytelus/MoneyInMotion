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
import type { TransactionEditData } from '@moneyinmotion/core';

export class TransactionEditsStorage {
    /**
     * Load transaction edits from a JSON file.
     *
     * @param filePath - The path to the LatestMergedEdits.json file.
     * @returns A TransactionEdits instance.
     */
    load(filePath: string): TransactionEdits {
        const serializedData = fs.readFileSync(filePath, 'utf-8');
        let data: { name: string; edits: TransactionEditData[] };
        try {
            data = JSON.parse(serializedData) as { name: string; edits: TransactionEditData[] };
        } catch (err) {
            throw new Error(
                `Failed to parse transaction edits JSON from "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
            );
        }
        const edits = new TransactionEdits(data.name ?? 'edits');
        if (data.edits) {
            for (const edit of data.edits) {
                edits.add(edit);
            }
        }
        return edits;
    }

    /**
     * Save transaction edits to a JSON file with timestamped backup.
     *
     * If the file already exists, creates a backup copy with a timestamp
     * suffix before overwriting.
     *
     * @param filePath - The path to write the file to.
     * @param edits    - The TransactionEdits instance to save.
     */
    save(filePath: string, edits: TransactionEdits): void {
        if (this.exists(filePath)) {
            // Create backup
            const stats = fs.statSync(filePath);
            const existingFileDateTime = stats.mtime;
            const timestamp = formatTimestamp(existingFileDateTime);
            const ext = path.extname(filePath);
            const baseName = filePath.slice(0, filePath.length - ext.length);
            const archiveFilePath = `${baseName}.${timestamp}${ext}`;
            fs.copyFileSync(filePath, archiveFilePath);
        }

        const serializedData = JSON.stringify(edits.serialize(), null, 2);
        fs.writeFileSync(filePath, serializedData, 'utf-8');
    }

    /**
     * Check if an edits file exists.
     */
    exists(filePath: string): boolean {
        return fs.existsSync(filePath);
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
