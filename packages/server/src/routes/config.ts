/**
 * Configuration API routes.
 *
 * GET  /api/config - returns the saved config (from disk) plus fields that
 *                    describe whether a server restart is required
 * PUT  /api/config - persists a new dataPath and/or port to disk
 *
 * Note on semantics: the running server's FileRepository and
 * TransactionCache are bound to the config read at process start. PUT
 * only updates the persisted config; the active data-path and port are
 * not swapped live because that would require re-opening files, moving
 * the chokidar watcher, and re-binding the TCP port mid-flight.
 *
 * So GET returns the *saved* config (what the next server start will
 * use), along with `activeDataPath` / `activePort` / `restartRequired`
 * so the UI can show both values and warn when they disagree.
 *
 * @module
 */

import * as path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { loadConfig, saveConfig, type ServerConfig } from '../config.js';

const configUpdateSchema = z.object({
    dataPath: z.string().trim().min(1, 'dataPath is required').optional(),
    port: z
        .number({
            invalid_type_error: 'port must be a number',
        })
        .int('port must be an integer')
        .min(1, 'port must be between 1 and 65535')
        .max(65535, 'port must be between 1 and 65535')
        .optional(),
}).refine(
    (value) => value.dataPath != null || value.port != null,
    {
        message: 'At least one configuration field must be provided',
    },
);

function buildResponse(
    saved: ServerConfig,
    active: ServerConfig,
): {
    port: number;
    dataPath: string;
    statementsDir: string;
    mergedDir: string;
    activePort: number;
    activeDataPath: string;
    restartRequired: boolean;
} {
    return {
        port: saved.port,
        dataPath: saved.dataPath,
        statementsDir: saved.statementsDir,
        mergedDir: saved.mergedDir,
        activePort: active.port,
        activeDataPath: active.dataPath,
        restartRequired:
            saved.port !== active.port || saved.dataPath !== active.dataPath,
    };
}

export function createConfigRouter(getConfig: () => ServerConfig): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const active = getConfig();
        const saved = loadConfig();
        res.json(buildResponse(saved, active));
    });

    router.put('/', (req, res) => {
        const result = configUpdateSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                error: result.error.issues.map((i) => i.message).join('; '),
                status: 400,
            });
            return;
        }

        const partialConfig: Partial<ServerConfig> = {};
        const dataPath = result.data.dataPath;

        // Validate dataPath: must be absolute and must not contain '..' segments
        if (
            dataPath != null
            && (!path.isAbsolute(dataPath) || dataPath.includes('..'))
        ) {
            res.status(400).json({
                error: 'dataPath must be an absolute path without ".." segments',
                status: 400,
            });
            return;
        }

        if (dataPath != null) {
            partialConfig.dataPath = dataPath;
        }
        if (result.data.port != null) {
            partialConfig.port = result.data.port;
        }

        saveConfig(partialConfig);

        const active = getConfig();
        const saved = loadConfig();
        res.json(buildResponse(saved, active));
    });

    return router;
}
