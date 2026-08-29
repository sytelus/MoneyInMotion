/**
 * Small filesystem helpers shared by the JSON persistence adapters.
 *
 * Writing a sibling file and renaming it prevents readers from observing a
 * partially written document. A unique temporary name also keeps independent
 * writes from sharing scratch state, even if two HTTP requests overlap.
 *
 * @module
 */

import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';

/** Atomically replace a UTF-8 text file on the same filesystem. */
export function writeTextFileAtomically(filePath: string, contents: string): void {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, contents, 'utf-8');
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    // Best-effort cleanup must never hide the write/rename failure that caused
    // the operation to fail. `force` also handles a rename that already moved
    // the temporary file.
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // The original error carries the actionable persistence failure.
    }
    throw error;
  }
}
