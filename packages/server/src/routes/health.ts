/**
 * Health-check API routes.
 *
 * GET /api/health - returns a lightweight liveness payload suitable for
 * container health checks and external monitoring.
 *
 * @module
 */

import { Router } from 'express';

export function createHealthRouter(): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        res.json({
            status: 'ok',
            environment: process.env['NODE_ENV'] ?? 'development',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.round(process.uptime() * 1000) / 1000,
        });
    });

    return router;
}
