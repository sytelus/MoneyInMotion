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

export interface FileLocationOptions {
    accountConfig?: AccountConfig | null;
    isImportInfo?: boolean;
}

export class FileLocation {
    readonly address: string;
    readonly portableAddress: string;
    readonly contentType: ContentType;
    readonly accountConfig: AccountConfig | null;
    readonly importInfo: ImportInfo | null;

    constructor(
        rootPath: string,
        relativeFilePath: string,
        options?: FileLocationOptions,
    ) {
        this.address = path.join(rootPath, relativeFilePath);
        this.portableAddress = relativeFilePath;
        this.accountConfig = options?.accountConfig ?? null;

        const extension = path.extname(this.address).toUpperCase();

        if (options?.isImportInfo) {
            let updateDate: string;
            let createDate: string;
            try {
                const stats = fs.statSync(this.address);
                updateDate = stats.mtime.toISOString();
                createDate = stats.birthtime.toISOString();
            } catch {
                // If we can't stat the file, use current time as fallback
                updateDate = new Date().toISOString();
                createDate = new Date().toISOString();
            }
            const importId = getMD5HashString(relativeFilePath, true);

            this.importInfo = {
                id: importId,
                portableAddress: relativeFilePath,
                updateDate,
                createDate,
                contentHash: importId,
                format: extension.replace('.', '').toLowerCase() || null,
            };
        } else {
            this.importInfo = null;
        }

        switch (extension) {
            case '.CSV':
                this.contentType = ContentType.Csv;
                break;
            case '.JSON':
                this.contentType = ContentType.Json;
                break;
            case '.IIF':
                this.contentType = ContentType.QuickBooksIif;
                break;
            case '':
            case '.':
                this.contentType = ContentType.None;
                break;
            default:
                throw new Error(`File extension "${extension}" is not supported for file "${this.address}"`);
        }
    }
}
