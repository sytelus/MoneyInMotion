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

    // Validation errors are actionable and safe to return. Unexpected server
    // failures may contain paths or implementation details, so production
    // responses use a neutral message while the full error stays in logs.
    const publicMessage = status >= 500 && process.env.NODE_ENV === 'production'
        ? 'Internal server error.'
        : message;
    res.status(status).json({ error: publicMessage, status });
}
