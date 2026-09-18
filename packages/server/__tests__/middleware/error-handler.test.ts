import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../src/middleware/error-handler.js';

function responseDouble() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return {
    response: { status } as unknown as Response,
    status,
    json,
  };
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('safely handles non-Error values', () => {
    const { response, status, json } = responseDouble();

    errorHandler(null, {} as Request, response, vi.fn() as NextFunction);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'null', status: 500 });
  });

  it('accepts only valid HTTP error statuses', () => {
    const invalid = responseDouble();
    errorHandler(
      { status: 999, toString: () => 'bad status' },
      {} as Request,
      invalid.response,
      vi.fn() as NextFunction,
    );
    expect(invalid.status).toHaveBeenCalledWith(500);

    const valid = responseDouble();
    errorHandler(
      { status: 409, toString: () => 'conflict' },
      {} as Request,
      valid.response,
      vi.fn() as NextFunction,
    );
    expect(valid.status).toHaveBeenCalledWith(409);
  });

  it('does not log or return malformed JSON payload fragments', () => {
    const { response, json } = responseDouble();
    const parseError = Object.assign(new SyntaxError('Unexpected token in {"amount": 123}'), {
      status: 400,
      type: 'entity.parse.failed',
      body: '{"amount": 123}',
    });

    errorHandler(parseError, {} as Request, response, vi.fn() as NextFunction);

    expect(json).toHaveBeenCalledWith({ error: 'Malformed JSON request body.', status: 400 });
    expect(console.error).toHaveBeenCalledWith('[Error 400]', 'Malformed JSON request body.');
  });

  it('hides unexpected error details in production responses', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { response, json } = responseDouble();

    errorHandler(
      new Error('private path: /srv/finance/secret.json'),
      {} as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(json).toHaveBeenCalledWith({ error: 'Internal server error.', status: 500 });
    expect(console.error).toHaveBeenCalledWith(
      '[Error 500]',
      'private path: /srv/finance/secret.json',
    );
  });
});
