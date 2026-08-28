/**
 * Statement folder upload and snapshot build API.
 *
 * POST /api/import/folder stages a browser-selected directory, promotes only
 * content-new statements, and immediately performs a full rebuild.
 * POST /api/import/scan remains as an explicit rebuild/repair action.
 *
 * @module
 */

import { Router } from 'express';
import multer from 'multer';
import type { TransactionCache } from '../cache/transaction-cache.js';
import type { ServerConfig } from '../config.js';
import {
    FolderUploadValidationError,
    stageAndPromoteFolder,
    type FolderUploadFile,
} from '../services/folder-import-service.js';

const folderUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 500,
        fields: 10,
        fileSize: 50 * 1024 * 1024,
        parts: 512,
    },
});

function parseRelativePaths(raw: unknown): string[] {
    if (typeof raw !== 'string') {
        throw new FolderUploadValidationError(
            'The upload is missing its relativePaths manifest.',
        );
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        throw new FolderUploadValidationError(
            'relativePaths must be valid JSON.',
        );
    }
    if (
        !Array.isArray(parsed)
        || parsed.some((item) => typeof item !== 'string')
    ) {
        throw new FolderUploadValidationError(
            'relativePaths must be a JSON array of strings.',
        );
    }
    return parsed;
}

export function createImportRouter(
    cache: TransactionCache,
    getConfig: () => ServerConfig,
): Router {
    const router = Router();

    router.post('/folder', (req, res, next) => {
        folderUpload.array('files')(req, res, async (uploadError) => {
            if (uploadError) {
                res.status(400).json({
                    error: uploadError.message,
                    status: 400,
                });
                return;
            }

            try {
                const files = (Array.isArray(req.files) ? req.files : []).map(
                    (file): FolderUploadFile => ({
                        originalName: file.originalname,
                        buffer: file.buffer,
                        size: file.size,
                    }),
                );
                const relativePaths = parseRelativePaths(req.body?.relativePaths);
                const staging = stageAndPromoteFolder(
                    getConfig(),
                    files,
                    relativePaths,
                );
                const rebuild = await cache.rebuildFromStatements();
                res.status(201).json({ staging, rebuild });
            } catch (err) {
                next(err);
            }
        });
    });

    router.post('/scan', async (_req, res, next) => {
        try {
            res.json(await cache.rebuildFromStatements());
        } catch (err) {
            next(err);
        }
    });

    return router;
}
