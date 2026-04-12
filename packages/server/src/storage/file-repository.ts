/**
 * File repository, ported from C# FileRepository.
 *
 * Scans the Statements directory for AccountConfig.json files and
 * lists statement files matching configured file filters.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AccountConfig } from '@moneyinmotion/core';
import { FileLocation } from './file-location.js';

const ACCOUNT_CONFIG_FILE_NAME = 'AccountConfig.json';
const DEFAULT_RELATIVE_IMPORT_FOLDER = 'Statements';
const DEFAULT_RELATIVE_MERGED_FOLDER = 'Merged';
const DEFAULT_LATEST_MERGED_FILE_NAME = 'LatestMerged.json';
const DEFAULT_TRANSACTION_EDITS_FILE_NAME = 'LatestMergedEdits.json';

export class FileRepository {
    readonly rootFolderPath: string;
    readonly importFolderPath: string;
    readonly mergedFolderPath: string;

    constructor(rootFolderPath: string) {
        this.rootFolderPath = rootFolderPath;
        this.importFolderPath = path.join(rootFolderPath, DEFAULT_RELATIVE_IMPORT_FOLDER);
        this.mergedFolderPath = path.join(rootFolderPath, DEFAULT_RELATIVE_MERGED_FOLDER);
    }

    /** Get the path to the latest merged transactions file. */
    get latestMergedPath(): string {
        return path.join(this.mergedFolderPath, DEFAULT_LATEST_MERGED_FILE_NAME);
    }

    /** Get the path to the latest merged edits file. */
    get latestMergedEditsPath(): string {
        return path.join(this.mergedFolderPath, DEFAULT_TRANSACTION_EDITS_FILE_NAME);
    }

    /**
     * Scan the Statements directory tree for statement file locations.
     *
     * Recursively walks from `startPath` (default: import folder),
     * loading AccountConfig.json when found, and yielding FileLocation
     * objects for each matching statement file.
     *
     * @param startPath           - The directory to start scanning from.
     * @param parentAccountConfig - The parent account config (inherited).
     * @returns An array of FileLocation objects for matching files.
     */
    getStatementLocations(
        startPath?: string,
        parentAccountConfig?: AccountConfig | null,
    ): FileLocation[] {
        const dirPath = startPath ?? this.importFolderPath;

        if (!fs.existsSync(dirPath)) {
            return [];
        }

        const results: FileLocation[] = [];

        // Try to load AccountConfig.json from this directory
        const accountConfigPath = path.join(dirPath, ACCOUNT_CONFIG_FILE_NAME);
        let accountConfig: AccountConfig | null = null;

        if (fs.existsSync(accountConfigPath)) {
            try {
                const configJson = fs.readFileSync(accountConfigPath, 'utf-8');
                accountConfig = JSON.parse(configJson) as AccountConfig;
            } catch (err) {
                console.warn(
                    `Skipping corrupted AccountConfig at "${accountConfigPath}": ${err instanceof Error ? err.message : String(err)}`,
                );
                accountConfig = parentAccountConfig ?? null;
            }
        } else {
            accountConfig = parentAccountConfig ?? null;
        }

        // If we have a config, enumerate matching files
        if (accountConfig) {
            for (const fileFilter of accountConfig.fileFilters) {
                const extension = fileFilter.replace('*', '');
                const entries = fs.readdirSync(dirPath);

                for (const entry of entries) {
                    if (entry === ACCOUNT_CONFIG_FILE_NAME) continue;

                    const fullPath = path.join(dirPath, entry);
                    let stat;
                    try {
                        stat = fs.statSync(fullPath);
                    } catch {
                        continue; // Skip files we can't access
                    }
                    if (!stat.isFile()) continue;

                    if (entry.endsWith(extension)) {
                        const relativePath = path.relative(
                            path.dirname(dirPath),
                            fullPath,
                        );
                        results.push(
                            new FileLocation(path.dirname(dirPath), relativePath, {
                                accountConfig,
                                isImportInfo: true,
                            }),
                        );
                    }
                }
            }
        }

        // Recurse into subdirectories if configured or no config
        if (!accountConfig || accountConfig.scanSubFolders) {
            const entries = fs.readdirSync(dirPath);
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry);
                let stat;
                try {
                    stat = fs.statSync(fullPath);
                } catch {
                    continue; // Skip files we can't access
                }
                if (stat.isDirectory()) {
                    results.push(
                        ...this.getStatementLocations(fullPath, accountConfig),
                    );
                }
            }
        }

        return results;
    }

    /**
     * Check if the latest merged file exists.
     */
    latestMergedExists(): boolean {
        return fs.existsSync(this.latestMergedPath);
    }

    /**
     * Check if the latest merged edits file exists.
     */
    latestMergedEditsExists(): boolean {
        return fs.existsSync(this.latestMergedEditsPath);
    }
}
