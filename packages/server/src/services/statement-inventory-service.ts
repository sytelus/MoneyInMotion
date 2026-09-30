/** Read-only statement filesystem inventory. Counts describe disk contents, not import events. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ServerConfig } from '../config.js';
import {
  ACCOUNT_CONFIG_FILE_NAME,
  discoverAccountConfigs,
  matchesFileFilters,
} from '../storage/account-config-repository.js';

type FileStatus =
  | 'eligible'
  | 'ignored'
  | 'unsupported'
  | 'unconfigured'
  | 'configuration'
  | 'symlink'
  | 'unreadable';
interface StatementEntry {
  path: string;
  name: string;
  kind: 'folder' | 'file' | 'symlink';
  accountId: string | null;
  status: FileStatus;
  reason: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
  /** Descendant statement files; excludes AccountConfig.json and symbolic links. */
  fileCount: number;
  eligibleCount: number;
}

/** Read account settings and metadata, never statement bodies; bound traversal and disclose limits. */
export function readStatementInventory(
  config: ServerConfig,
  limits = { maxEntries: 20_000, maxDepth: 40 },
) {
  const entries: StatementEntry[] = [];
  const result = { entries, truncated: false, unreadableFolders: 0 };
  if (!fs.existsSync(config.statementsDir)) return result;
  if (!fs.lstatSync(config.statementsDir).isDirectory())
    throw new Error('Statements must be a real directory.');
  const accounts = new Map(
    discoverAccountConfigs(config.statementsDir).map((account) => [
      account.relativeDirectory,
      account.config,
    ]),
  );

  const walk = (
    directory: string,
    relative: string,
    depth: number,
  ): { files: number; eligible: number; unreadable: boolean } => {
    let files = 0;
    let eligible = 0;
    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      result.unreadableFolders += 1;
      return { files, eligible, unreadable: true };
    }
    children.sort(
      (a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name),
    );
    for (const child of children) {
      if (entries.length >= limits.maxEntries) {
        result.truncated = true;
        break;
      }
      const relativePath = relative ? `${relative}/${child.name}` : child.name;
      const account = accounts.get(relativePath.split('/')[0]!);
      const entry: StatementEntry = {
        path: relativePath,
        name: child.name,
        kind: child.isDirectory() ? 'folder' : child.isSymbolicLink() ? 'symlink' : 'file',
        accountId: account?.accountInfo.id ?? null,
        status: account ? 'eligible' : 'unconfigured',
        reason: account
          ? 'Matches the account’s settings. Parsing is checked during rebuild.'
          : 'Configure this account folder before importing its statements.',
        sizeBytes: null,
        modifiedAt: null,
        fileCount: 0,
        eligibleCount: 0,
      };
      entries.push(entry);
      if (child.isSymbolicLink() || (!child.isDirectory() && !child.isFile())) {
        entry.status = 'symlink';
        entry.reason = 'Links and special files are not followed or imported.';
        continue;
      }
      if (child.isDirectory()) {
        // Recheck entries before traversing in case a folder became a link.
        try {
          if (!fs.lstatSync(path.join(directory, child.name)).isDirectory()) {
            entry.status = 'symlink';
            entry.reason = 'The folder changed during inspection. Refresh the explorer.';
            continue;
          }
        } catch {
          entry.status = 'unreadable';
          entry.reason = 'The folder could not be read. Refresh or check permissions.';
          result.unreadableFolders += 1;
          continue;
        }
        if (depth >= limits.maxDepth) {
          result.truncated = true;
          entry.reason = 'Folder depth limit reached; counts are incomplete.';
          continue;
        }
        const counts = walk(path.join(directory, child.name), relativePath, depth + 1);
        entry.fileCount = counts.files;
        entry.eligibleCount = counts.eligible;
        if (counts.unreadable) {
          entry.status = 'unreadable';
          entry.reason = 'The server cannot read this folder. Check its permissions.';
        } else if (account)
          entry.reason = `${counts.eligible} of ${counts.files} statement files match the account’s settings.`;
        files += counts.files;
        eligible += counts.eligible;
        continue;
      }
      try {
        // Recheck without following links in case a directory entry changed.
        const stat = fs.lstatSync(path.join(directory, child.name));
        if (!stat.isFile()) {
          entry.status = 'symlink';
          entry.reason = 'The file changed during inspection. Refresh the explorer.';
          continue;
        }
        entry.sizeBytes = stat.size;
        entry.modifiedAt = stat.mtime.toISOString();
      } catch {
        entry.status = 'unreadable';
        entry.reason = 'The server cannot read this file’s metadata. Refresh or check permissions.';
      }
      if (child.name === ACCOUNT_CONFIG_FILE_NAME) {
        entry.status = 'configuration';
        entry.reason =
          depth === 1
            ? 'Account settings; not a statement.'
            : 'Only account-root settings are used. Nested AccountConfig.json files are ignored.';
        continue;
      }
      files += 1;
      if (entry.status === 'unreadable' || !account) continue;
      if (
        (depth > 1 && !account.scanSubFolders) ||
        !matchesFileFilters(child.name, account.fileFilters)
      ) {
        entry.status = 'ignored';
        entry.reason =
          depth > 1 && !account.scanSubFolders
            ? 'Subfolders are disabled for this account.'
            : `Does not match ${account.fileFilters.join(', ')}.`;
      } else if (!['.csv', '.json', '.iif'].includes(path.extname(child.name).toLowerCase())) {
        entry.status = 'unsupported';
        entry.reason =
          'Matches the filename settings, but this format cannot be read. Export as CSV, JSON or IIF before rebuilding.';
      } else eligible += 1;
    }
    return { files, eligible, unreadable: false };
  };
  walk(config.statementsDir, '', 0);
  return result;
}
