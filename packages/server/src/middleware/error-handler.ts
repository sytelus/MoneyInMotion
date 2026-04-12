/**
 * Express error-handler middleware.
 *
 * Catches errors and returns a consistent JSON response:
 * `{ error: string, status: number }`
 *
 * @module
 */

import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number }).status ?? 500;

    console.error(`[Error ${status}]`, message);

    res.status(status).json({ error: message, status });
}
