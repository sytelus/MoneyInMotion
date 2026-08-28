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
  const candidateStatus =
    err != null && typeof err === 'object' && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined;
  const status =
    typeof candidateStatus === 'number' &&
    Number.isInteger(candidateStatus) &&
    candidateStatus >= 400 &&
    candidateStatus <= 599
      ? candidateStatus
      : 500;
  const isJsonParseError =
    status === 400 &&
    err != null &&
    typeof err === 'object' &&
    'type' in err &&
    (err as { type?: unknown }).type === 'entity.parse.failed';
  // body-parser parse errors can embed a fragment of the rejected payload in
  // their message. Do not copy financial request content into logs or replies.
  const message = isJsonParseError
    ? 'Malformed JSON request body.'
    : err instanceof Error
      ? err.message
      : String(err);

  console.error(`[Error ${status}]`, message);

  // Validation errors are actionable and safe to return. Unexpected server
  // failures may contain paths or implementation details, so production
  // responses use a neutral message while the full error stays in logs.
  const publicMessage =
    status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal server error.' : message;
  res.status(status).json({ error: publicMessage, status });
}
