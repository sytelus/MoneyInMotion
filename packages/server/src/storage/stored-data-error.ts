/**
 * A file the app reads back (config, snapshot, rules, account config) is
 * invalid. The message names the file but not its folder, so it is safe to show
 * to the user even in production, where other server errors are hidden.
 *
 * @module
 */
import * as path from 'node:path';

export class StoredDataError extends Error {
  readonly status = 422;
}

/** Wrap a read or validation failure, naming the file without its folder. */
export function loadFailure(filePath: string, what: string, error: unknown): StoredDataError {
  const name = path.basename(filePath);
  const reason = (error instanceof Error ? error.message : String(error))
    .split(filePath)
    .join(name);
  return new StoredDataError(`Failed to load ${what} from "${name}": ${reason}`, { cause: error });
}
