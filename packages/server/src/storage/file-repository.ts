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
import { decodeAccountConfig } from './account-config-codec.js';
import { ACCOUNT_CONFIG_FILE_NAME, matchesFileFilters } from './account-config-repository.js';

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
    portableRootPath?: string,
  ): FileLocation[] {
    const dirPath = startPath ?? this.importFolderPath;
    const rootPath = portableRootPath ?? dirPath;

    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const results: FileLocation[] = [];

    // Try to load AccountConfig.json from this directory
    const accountConfigPath = path.join(dirPath, ACCOUNT_CONFIG_FILE_NAME);
    let accountConfig: AccountConfig | null = parentAccountConfig ?? null;

    if (fs.existsSync(accountConfigPath)) {
      try {
        const configJson = fs.readFileSync(accountConfigPath, 'utf-8');
        accountConfig = decodeAccountConfig(JSON.parse(configJson));
      } catch (err) {
        // A broken child config must not silently inherit its parent's
        // account identity; doing so imports files into the wrong
        // account. Continue walking so a deeper valid config can heal
        // the tree.
        accountConfig = null;
        const portableConfigPath = path
          .relative(this.importFolderPath, accountConfigPath)
          .split(path.sep)
          .join('/');
        const message = (err instanceof Error ? err.message : String(err))
          .split(accountConfigPath)
          .join(portableConfigPath);
        console.warn(`Skipping corrupted AccountConfig "${portableConfigPath}": ${message}`);
      }
    }

    const entries = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    // If we have a config, enumerate matching files
    if (accountConfig) {
      for (const entry of entries) {
        if (
          !entry.isFile() ||
          entry.name === ACCOUNT_CONFIG_FILE_NAME ||
          !matchesFileFilters(entry.name, accountConfig.fileFilters)
        ) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);
        results.push(
          new FileLocation(rootPath, relativePath, {
            accountConfig,
            isImportInfo: true,
          }),
        );
      }
    }

    // Recurse into subdirectories if configured or no config
    if (!accountConfig || accountConfig.scanSubFolders) {
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);
          results.push(...this.getStatementLocations(fullPath, accountConfig, rootPath));
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
