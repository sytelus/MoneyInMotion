/**
 * Browser folder upload staging and content-based promotion.
 *
 * Every supplied file is first written beneath a unique staging batch. The
 * service then maps it to an existing account directory, compares SHA-256
 * content against that account's current statements, and promotes only new
 * content. A durable manifest records every decision for support and audit.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config.js';
import {
    ACCOUNT_CONFIG_FILE_NAME,
    discoverAccountConfigs,
    matchesFileFilters,
    type DiscoveredAccountConfig,
} from '../storage/account-config-repository.js';

export interface FolderUploadFile {
    originalName: string;
    buffer: Buffer;
    size: number;
}

/** A browser-supplied folder manifest failed validation. */
export class FolderUploadValidationError extends Error {
    readonly status = 400;

    constructor(message: string) {
        super(message);
        this.name = 'FolderUploadValidationError';
    }
}

export type StagedFileStatus = 'promoted' | 'duplicate' | 'rejected';

export interface StagedFileResult {
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

function normalizeRelativePath(value: string): string {
    const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
    const parts = normalized.split('/');
    if (
        !normalized
        || normalized.startsWith('/')
        || parts.some(
            (part) =>
                !part
                || part === '.'
                || part === '..'
                || part.includes('\0'),
        )
    ) {
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
        throw new FolderUploadValidationError(
            `Path escapes its storage root: "${relativePath}"`,
        );
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
function stripPickerRoot(
    paths: string[],
    accounts: DiscoveredAccountConfig[],
): string[] {
    const splitPaths = paths.map((filePath) => filePath.split('/'));
    const first = splitPaths[0]?.[0];
    if (
        !first
        || !splitPaths.every((parts) => parts[0]?.toLowerCase() === first.toLowerCase())
    ) {
        return paths;
    }

    const firstIsAccount = accounts.some(
        (account) =>
            account.relativeDirectory.split('/')[0]?.toLowerCase()
            === first.toLowerCase(),
    );
    return firstIsAccount
        ? paths
        : splitPaths.map((parts) => parts.slice(1).join('/'));
}

function findAccountForPath(
    relativePath: string,
    accounts: DiscoveredAccountConfig[],
): DiscoveredAccountConfig | null {
    const lower = relativePath.toLowerCase();
    // Prefer the most specific account directory in case configs are nested.
    return (
        [...accounts]
            .sort(
                (left, right) =>
                    right.relativeDirectory.length - left.relativeDirectory.length,
            )
            .find((account) => {
                const accountPath = account.relativeDirectory.toLowerCase();
                return lower.startsWith(`${accountPath}/`);
            }) ?? null
    );
}

function listStatementHashes(
    account: DiscoveredAccountConfig,
): Map<string, string> {
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
                !entry.isFile()
                || entry.name === ACCOUNT_CONFIG_FILE_NAME
                || !matchesFileFilters(entry.name, account.config.fileFilters)
            ) {
                continue;
            }
            hashes.set(
                sha256File(fullPath),
                portable(path.relative(account.accountDir, fullPath)),
            );
        }
    }
    return hashes;
}

function uniqueDestination(filePath: string, digest: string): string {
    if (!fs.existsSync(filePath)) return filePath;
    if (sha256File(filePath) === digest) return filePath;

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
        throw new FolderUploadValidationError(
            'Each uploaded file must include one relative path.',
        );
    }

    const accounts = discoverAccountConfigs(config.statementsDir);
    const normalizedPaths = relativePaths.map(normalizeRelativePath);
    if (new Set(normalizedPaths.map((item) => item.toLowerCase())).size
        !== normalizedPaths.length) {
        throw new FolderUploadValidationError(
            'The selected folder contains duplicate relative file paths.',
        );
    }
    const accountRelativePaths = stripPickerRoot(normalizedPaths, accounts);
    const batchId = createBatchId();
    const batchDir = path.join(config.stagingDir, batchId);
    const stagedFilesDir = path.join(batchDir, 'files');
    fs.mkdirSync(stagedFilesDir, { recursive: true });

    const hashesByAccount = new Map<string, Map<string, string>>();
    const getHashes = (account: DiscoveredAccountConfig): Map<string, string> => {
        let hashes = hashesByAccount.get(account.accountDir);
        if (!hashes) {
            hashes = listStatementHashes(account);
            hashesByAccount.set(account.accountDir, hashes);
        }
        return hashes;
    };

    const results: StagedFileResult[] = [];
    for (let index = 0; index < files.length; index += 1) {
        const file = files[index]!;
        const relativePath = accountRelativePaths[index]!;
        const digest = sha256(file.buffer);
        const stagePath = safeJoin(stagedFilesDir, relativePath);
        fs.mkdirSync(path.dirname(stagePath), { recursive: true });
        fs.writeFileSync(stagePath, file.buffer, { flag: 'wx' });

        const account = findAccountForPath(relativePath, accounts);
        const baseResult = {
            relativePath,
            sha256: digest,
            sizeBytes: file.size,
        };
        if (!account) {
            results.push({
                ...baseResult,
                accountId: null,
                status: 'rejected',
                destinationPath: null,
                duplicateOf: null,
                message: 'No configured account folder matches this path.',
            });
            continue;
        }

        const accountPrefix = account.relativeDirectory.split('/');
        const tailParts = relativePath.split('/').slice(accountPrefix.length);
        const fileName = tailParts.at(-1) ?? file.originalName;
        if (
            fileName === ACCOUNT_CONFIG_FILE_NAME
            || !matchesFileFilters(fileName, account.config.fileFilters)
        ) {
            results.push({
                ...baseResult,
                accountId: account.config.accountInfo.id,
                status: 'rejected',
                destinationPath: null,
                duplicateOf: null,
                message:
                    fileName === ACCOUNT_CONFIG_FILE_NAME
                        ? 'AccountConfig.json is managed in the web account editor.'
                        : `File does not match ${account.config.fileFilters.join(', ')}.`,
            });
            continue;
        }

        const existingHashes = getHashes(account);
        const duplicateOf = existingHashes.get(digest);
        if (duplicateOf) {
            results.push({
                ...baseResult,
                accountId: account.config.accountInfo.id,
                status: 'duplicate',
                destinationPath: null,
                duplicateOf: portable(
                    path.join(account.relativeDirectory, duplicateOf),
                ),
                message: 'Identical statement content is already present.',
            });
            continue;
        }

        const requestedDestination = safeJoin(
            account.accountDir,
            tailParts.join('/'),
        );
        const destination = uniqueDestination(requestedDestination, digest);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, file.buffer, { flag: 'wx' });
        const destinationRelative = portable(
            path.relative(config.statementsDir, destination),
        );
        existingHashes.set(digest, portable(path.relative(account.accountDir, destination)));
        results.push({
            ...baseResult,
            accountId: account.config.accountInfo.id,
            status: 'promoted',
            destinationPath: destinationRelative,
            duplicateOf: null,
            message: 'New statement promoted and ready for snapshot rebuild.',
        });
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
    fs.writeFileSync(
        `${manifestPath}.tmp`,
        JSON.stringify(manifest, null, 2),
        'utf-8',
    );
    fs.renameSync(`${manifestPath}.tmp`, manifestPath);

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
