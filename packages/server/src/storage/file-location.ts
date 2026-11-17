/**
 * File location abstraction, ported from C# FileLocation.
 *
 * Provides path management and content-type auto-detection from file extension.
 *
 * @module
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { AccountConfig, ImportInfo } from '@moneyinmotion/core';
import { getMD5HashString } from '@moneyinmotion/core';
import { ContentType } from '../parsers/file-format/types.js';

const CONTENT_TYPES: Record<string, ContentType> = {
  '.CSV': ContentType.Csv,
  '.JSON': ContentType.Json,
  '.IIF': ContentType.QuickBooksIif,
  '': ContentType.None,
};

export interface FileLocationOptions {
  accountConfig?: AccountConfig | null;
  isImportInfo?: boolean;
}

export class FileLocation {
  readonly address: string;
  readonly portableAddress: string;
  /** Null for an extension no parser reads; the rebuild reports that file. */
  readonly contentType: ContentType | null;
  readonly accountConfig: AccountConfig | null;
  readonly importInfo: ImportInfo | null;

  constructor(rootPath: string, relativeFilePath: string, options?: FileLocationOptions) {
    const normalizedRoot = path.resolve(rootPath);
    this.address = path.resolve(normalizedRoot, relativeFilePath);
    if (
      this.address !== normalizedRoot &&
      !this.address.startsWith(`${normalizedRoot}${path.sep}`)
    ) {
      throw new Error(`File path escapes repository root: "${relativeFilePath}"`);
    }
    this.portableAddress = relativeFilePath.split(path.sep).join('/');
    this.accountConfig = options?.accountConfig ?? null;

    const extension = path.extname(this.address).toUpperCase();

    if (options?.isImportInfo) {
      // These are filesystem times, not import events. If metadata cannot be
      // read, fail the scan; inventing "now" would misrepresent provenance.
      const stats = fs.statSync(this.address);
      // Hash the '/'-separated address so import IDs are identical on Windows
      // and Linux; the OS-specific relative path would change every ID.
      const importId = getMD5HashString(this.portableAddress, true);

      this.importInfo = {
        id: importId,
        portableAddress: this.portableAddress,
        updateDate: stats.mtime.toISOString(),
        createDate: stats.birthtime.toISOString(),
        contentHash: importId,
        format: extension.replace('.', '').toLowerCase() || null,
      };
    } else {
      this.importInfo = null;
    }

    this.contentType = CONTENT_TYPES[extension] ?? null;
  }
}
