/**
 * File repository, ported from C# FileRepository.
 *
 * Loads one AccountConfig.json from each top-level account folder and lists
 * matching statement files, optionally recursing within that account.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AccountConfig } from '@moneyinmotion/core';
import { FileLocation } from './file-location.js';
import {
  ACCOUNT_CONFIG_FILE_NAME,
  discoverAccountConfigs,
  matchesFileFilters,
} from './account-config-repository.js';

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

  private scanAccountDirectory(dirPath: string, accountConfig: AccountConfig): FileLocation[] {
    const results: FileLocation[] = [];
    const entries = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (
        !entry.isFile() ||
        entry.name === ACCOUNT_CONFIG_FILE_NAME ||
        !matchesFileFilters(entry.name, accountConfig.fileFilters)
      ) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.importFolderPath, fullPath);
      results.push(
        new FileLocation(this.importFolderPath, relativePath, {
          accountConfig,
          isImportInfo: true,
        }),
      );
    }

    if (accountConfig.scanSubFolders) {
      for (const entry of entries) {
        if (entry.isDirectory()) {
          results.push(...this.scanAccountDirectory(path.join(dirPath, entry.name), accountConfig));
        }
      }
    }
    return results;
  }

  /**
   * Scan statements for top-level accounts. Each account config must be at
   * `Statements/<account>/AccountConfig.json`; statement subfolders may still
   * be scanned recursively according to that account's `scanSubFolders` flag.
   */
  getStatementLocations(): FileLocation[] {
    return discoverAccountConfigs(this.importFolderPath).flatMap((account) =>
      this.scanAccountDirectory(account.accountDir, account.config),
    );
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
