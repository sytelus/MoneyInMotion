/**
 * Configuration API routes.
 *
 * GET  /api/config - returns { dataPath, statementsDir, mergedDir }
 * PUT  /api/config - updates config and returns new config
 *
 * @module
 */

import * as path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { loadConfig, saveConfig, type ServerConfig } from '../config.js';

const configUpdateSchema = z.object({
    dataPath: z.string().min(1, 'dataPath is required'),
});

export function createConfigRouter(getConfig: () => ServerConfig): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        const config = getConfig();
        res.json({
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

        const dataPath = result.data.dataPath;

        // Validate dataPath: must be absolute and must not contain '..' segments
        if (!path.isAbsolute(dataPath) || dataPath.includes('..')) {
            res.status(400).json({
                error: 'dataPath must be an absolute path without ".." segments',
                status: 400,
            });
            return;
        }

        saveConfig({ dataPath });

        // Reload config so derived dirs are correct
        const newConfig = loadConfig();
        res.json({
            dataPath: newConfig.dataPath,
            statementsDir: newConfig.statementsDir,
            mergedDir: newConfig.mergedDir,
        });
    });

    return router;
}
