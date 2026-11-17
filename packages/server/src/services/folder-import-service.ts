/**
 * Browser folder upload staging and content-based promotion.
 *
 * Paths and account mappings are validated before any filesystem writes.
 * Every accepted path is then written beneath a unique staging batch. The
 * service compares SHA-256
 * content against that account's current statements, and promotes only new
 * content. A durable manifest records every decision for support and audit.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config.js';
import { writeTextFileAtomically } from '../storage/atomic-file.js';
import {
  isAccountConfigFileName,
  discoverAccountConfigs,
  matchesFileFilters,
  type DiscoveredAccountConfig,
} from '../storage/account-config-repository.js';
import { isPortableName } from '../storage/path-names.js';

export interface FolderUploadFile {
  buffer: Buffer;
}

/** A browser-supplied folder manifest failed validation. */
export class FolderUploadValidationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'FolderUploadValidationError';
  }
}

type StagedFileStatus = 'promoted' | 'duplicate' | 'rejected';

interface StagedFileResult {
  relativePath: string;
  accountId: string | null;
  status: StagedFileStatus;
  sha256: string;
  destinationPath: string | null;
  duplicateOf: string | null;
  message: string;
  sizeBytes: number;
}

export interface FolderStagingResult {
  batchId: string;
  stagedAt: string;
  manifestPath: string;
  promotedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  files: StagedFileResult[];
}

function portable(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

/**
 * Reject absolute, empty, "." and ".." segments, and names Windows would write
 * somewhere other than the recorded path ("a.csv:x", "CON.csv", "a.csv.").
 */
function normalizeRelativePath(value: string): string {
  const parts = value.replaceAll('\\', '/').replace(/^\.\//, '').split('/');
  if (!parts.every(isPortableName)) {
    throw new FolderUploadValidationError(`Unsafe upload path: "${value}"`);
  }
  return parts.join('/');
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function sha256File(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

function safeJoin(root: string, relativePath: string): string {
  const result = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root);
  if (result !== normalizedRoot && !result.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new FolderUploadValidationError(`Path escapes its storage root: "${relativePath}"`);
  }
  return result;
}

function createBatchId(): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  return `${timestamp}-${randomUUID().slice(0, 8)}`;
}

/**
 * Directory pickers include the selected root folder as the first path
 * component. Remove it only when every file shares it and it is not itself an
 * account directory.
 */
function stripPickerRoot(paths: string[], accounts: DiscoveredAccountConfig[]): string[] {
  const splitPaths = paths.map((filePath) => filePath.split('/'));
  const first = splitPaths[0]?.[0];
  if (!first || !splitPaths.every((parts) => parts[0]?.toLowerCase() === first.toLowerCase())) {
    return paths;
  }

  const firstIsAccount = accounts.some(
    (account) => account.relativeDirectory.toLowerCase() === first.toLowerCase(),
  );
  return firstIsAccount ? paths : splitPaths.map((parts) => parts.slice(1).join('/'));
}

function findAccountForPath(
  relativePath: string,
  accounts: DiscoveredAccountConfig[],
): DiscoveredAccountConfig | null {
  // Only the first segment identifies an account; nested configs are not
  // supported. Discovery already enforces case-insensitive uniqueness.
  const segments = relativePath.split('/');
  if (segments.length < 2) return null;
  return (
    accounts.find(
      (account) => account.relativeDirectory.toLowerCase() === segments[0]!.toLowerCase(),
    ) ?? null
  );
}

/** Lexical containment alone does not prevent writes through existing links. */
function validateDestinationPath(account: DiscoveredAccountConfig, relativePath: string): void {
  const parts = relativePath.split('/').slice(1);
  let current = account.accountDir;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) break;
    if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory())) {
      throw new FolderUploadValidationError(
        `Cannot import "${relativePath}": its destination contains a symbolic link or a non-directory parent. Choose a regular account subfolder; no files were staged or imported.`,
      );
    }
  }
}

function listStatementHashes(account: DiscoveredAccountConfig): Map<string, string> {
  const hashes = new Map<string, string>();
  const stack = [account.accountDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (account.config.scanSubFolders) stack.push(fullPath);
        continue;
      }
      if (
        !entry.isFile() ||
        isAccountConfigFileName(entry.name) ||
        !matchesFileFilters(entry.name, account.config.fileFilters)
      ) {
        continue;
      }
      hashes.set(sha256File(fullPath), portable(path.relative(account.accountDir, fullPath)));
    }
  }
  return hashes;
}

function uniqueDestination(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;

  const parsed = path.parse(filePath);
  let counter = 1;
  let candidate: string;
  do {
    candidate = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
    counter += 1;
  } while (fs.existsSync(candidate));
  return candidate;
}

/**
 * Stage a complete browser-selected folder and promote new statement files.
 *
 * The arrays are positional: `relativePaths[i]` describes `files[i]`.
 */
export function stageAndPromoteFolder(
  config: ServerConfig,
  files: FolderUploadFile[],
  relativePaths: string[],
): FolderStagingResult {
  if (files.length === 0) {
    throw new FolderUploadValidationError('At least one file is required.');
  }
  if (files.length !== relativePaths.length) {
    throw new FolderUploadValidationError('Each uploaded file must include one relative path.');
  }

  const accounts = discoverAccountConfigs(config.statementsDir);
  const normalizedPaths = relativePaths.map(normalizeRelativePath);
  if (new Set(normalizedPaths.map((item) => item.toLowerCase())).size !== normalizedPaths.length) {
    throw new FolderUploadValidationError(
      'The selected folder contains duplicate relative file paths.',
    );
  }
  const uploads = stripPickerRoot(normalizedPaths, accounts).map((relativePath, index) => ({
    relativePath,
    buffer: files[index]!.buffer,
    account: findAccountForPath(relativePath, accounts),
  }));
  const unmatchedPaths = uploads.filter((upload) => !upload.account).map((u) => u.relativePath);
  if (unmatchedPaths.length > 0) {
    const expected = accounts.map((account) => account.relativeDirectory).sort();
    throw new FolderUploadValidationError(
      `No configured account folder matches: ${unmatchedPaths.map((item) => `"${item}"`).join(', ')}. ` +
        `Expected account folders: ${expected.length > 0 ? expected.join(', ') : '(none configured)'}. ` +
        'Fix the selected folder names and try again; no files were staged or imported.',
    );
  }
  // Check the entire batch before staging, not just each file as it is written.
  // The supported single writer performs these checks and promotions without
  // yielding; external administrators must not change folders during imports.
  for (const { relativePath, account } of uploads) validateDestinationPath(account!, relativePath);

  const batchId = createBatchId();
  const batchDir = path.join(config.stagingDir, batchId);
  const stagedFilesDir = path.join(batchDir, 'files');
  fs.mkdirSync(stagedFilesDir, { recursive: true });

  const hashesByAccount = new Map<string, Map<string, string>>();
  const results: StagedFileResult[] = [];
  for (const { relativePath, buffer, account: matchedAccount } of uploads) {
    const account = matchedAccount!;
    const stagePath = safeJoin(stagedFilesDir, relativePath);
    fs.mkdirSync(path.dirname(stagePath), { recursive: true });
    fs.writeFileSync(stagePath, buffer, { flag: 'wx' });

    const digest = sha256(buffer);
    const record = (
      status: StagedFileStatus,
      message: string,
      destinationPath: string | null = null,
      duplicateOf: string | null = null,
    ): void => {
      results.push({
        relativePath,
        accountId: account.config.accountInfo.id,
        status,
        sha256: digest,
        destinationPath,
        duplicateOf,
        message,
        // The received bytes are authoritative; multipart metadata is
        // supplied by the client and must not affect the audit manifest.
        sizeBytes: buffer.byteLength,
      });
    };

    // Account folders are one top-level segment, so the rest is the path inside it.
    const tailParts = relativePath.split('/').slice(1);
    const fileName = tailParts.at(-1)!;
    if (!account.config.scanSubFolders && tailParts.length > 1) {
      record('rejected', 'This account is configured not to scan statement subfolders.');
      continue;
    }
    if (isAccountConfigFileName(fileName)) {
      record('rejected', 'AccountConfig.json is managed in the web account editor.');
      continue;
    }
    if (!matchesFileFilters(fileName, account.config.fileFilters)) {
      record('rejected', `File does not match ${account.config.fileFilters.join(', ')}.`);
      continue;
    }

    let existingHashes = hashesByAccount.get(account.accountDir);
    if (!existingHashes) {
      existingHashes = listStatementHashes(account);
      hashesByAccount.set(account.accountDir, existingHashes);
    }
    const duplicateOf = existingHashes.get(digest);
    if (duplicateOf) {
      record(
        'duplicate',
        'Identical statement content is already present.',
        null,
        portable(path.join(account.relativeDirectory, duplicateOf)),
      );
      continue;
    }

    const destination = uniqueDestination(safeJoin(account.accountDir, tailParts.join('/')));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, buffer, { flag: 'wx' });
    existingHashes.set(digest, portable(path.relative(account.accountDir, destination)));
    record(
      'promoted',
      'New statement promoted and ready for snapshot rebuild.',
      portable(path.relative(config.statementsDir, destination)),
    );
  }

  const stagedAt = new Date().toISOString();
  const manifestPath = path.join(batchDir, 'manifest.json');
  const manifest = {
    batchId,
    stagedAt,
    username: config.username,
    sourceFileCount: files.length,
    files: results,
  };
  writeTextFileAtomically(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    batchId,
    stagedAt,
    manifestPath: portable(path.relative(config.userDataPath, manifestPath)),
    promotedCount: results.filter((item) => item.status === 'promoted').length,
    duplicateCount: results.filter((item) => item.status === 'duplicate').length,
    rejectedCount: results.filter((item) => item.status === 'rejected').length,
    files: results,
  };
}
