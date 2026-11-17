/** Request-body and query validation shared by the API routes. */
import type { z } from 'zod';

/** A client-correctable request problem; the error handler replies 400 with this text. */
export class RequestValidationError extends Error {
  readonly status = 400;
}

/** Parse `value` or throw a 400 naming every invalid field ("values.note: ..."). */
export function parseRequest<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new RequestValidationError(
    result.error.issues
      .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ` : '') + issue.message)
      .join('; '),
  );
}
