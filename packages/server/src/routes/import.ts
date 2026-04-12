/**
 * Import API routes.
 *
 * POST /api/import/scan - trigger scan + merge, return import stats
 * POST /api/import/save - persist to disk, return { success }
 *
 * @module
 */

import { Router } from 'express';
import { z } from 'zod';
import type { TransactionCache } from '../cache/transaction-cache.js';

const saveBodySchema = z.object({
    saveMerged: z.boolean().default(true),
    saveEdits: z.boolean().default(true),
});

export function createImportRouter(cache: TransactionCache): Router {
    const router = Router();

    router.post('/scan', async (_req, res, next) => {
        try {
            const result = await cache.scanAndImport();
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    router.post('/save', async (req, res, next) => {
        try {
            const parsed = saveBodySchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: parsed.error.issues.map((i) => i.message).join('; '),
                    status: 400,
                });
                return;
            }

            await cache.save(parsed.data.saveMerged, parsed.data.saveEdits);
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
