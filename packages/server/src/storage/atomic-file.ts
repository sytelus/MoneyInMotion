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

/** Errors Windows raises while antivirus, indexing, or sync tools briefly hold a file. */
const TRANSIENT_LOCK_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RETRY_DELAYS_MS = [20, 50, 100, 200, 400, 800];

function pause(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

/**
 * Rename, retrying for about 1.5 s when Windows reports a transient lock.
 * Other platforms and other errors fail immediately.
 */
export function renameWithRetry(from: string, to: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      const retry =
        process.platform === 'win32' &&
        TRANSIENT_LOCK_CODES.has(code) &&
        attempt < RETRY_DELAYS_MS.length;
      if (!retry) throw error;
      pause(RETRY_DELAYS_MS[attempt]!);
    }
  }
}

/** Atomically replace UTF-8 text; optional mode keeps sensitive scratch/target files private. */
export function writeTextFileAtomically(filePath: string, contents: string, mode?: number): void {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, contents, { encoding: 'utf-8', mode });
    renameWithRetry(temporaryPath, filePath);
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
