/**
 * Configuration API routes.
 *
 * GET  /api/config - returns { port, dataPath, statementsDir, mergedDir }
 * PUT  /api/config - updates config and returns new config
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

export function createConfigRouter(getConfig: () => ServerConfig): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const config = getConfig();
        res.json({
            port: config.port,
            dataPath: config.dataPath,
            statementsDir: config.statementsDir,
            mergedDir: config.mergedDir,
        });
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

        // Reload config so derived dirs are correct
        const newConfig = loadConfig();
        res.json({
            port: newConfig.port,
            dataPath: newConfig.dataPath,
            statementsDir: newConfig.statementsDir,
            mergedDir: newConfig.mergedDir,
        });
    });

    return router;
}
