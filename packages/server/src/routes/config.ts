/**
 * Configuration API.
 *
 * The running repository and TCP listener remain bound to the
 * startup configuration. Updates are persisted for the next restart, and the
 * response makes this distinction explicit so the UI cannot imply otherwise.
 *
 * @module
 */

import * as path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { isValidHost, loadConfig, saveConfig, type ServerConfig } from '../config.js';
import { SAFE_IDENTIFIER_RULE, hasParentSegment, isSafeIdentifier } from '../storage/path-names.js';
import { parseRequest } from './request-validation.js';

const configUpdateSchema = z
  .object({
    dataRoot: z
      .string()
      .trim()
      .min(1, 'dataRoot is required')
      .refine(
        (value) => path.isAbsolute(value) && !hasParentSegment(value),
        'dataRoot must be an absolute path without ".." segments',
      )
      .optional(),
    username: z
      .string()
      .trim()
      .refine(isSafeIdentifier, `username ${SAFE_IDENTIFIER_RULE}`)
      .optional(),
    port: z.number().int().min(1).max(65535).optional(),
    host: z
      .string()
      .trim()
      .refine(isValidHost, 'host must be an IP address or hostname such as 127.0.0.1')
      .optional(),
  })
  .refine((value) => Object.values(value).some((field) => field != null), {
    message: 'At least one configuration field must be provided',
  });

/** Saved settings (used after restart) alongside the ones this process runs with. */
function buildResponse(saved: ServerConfig, active: ServerConfig) {
  return {
    ...saved,
    activePort: active.port,
    activeHost: active.host,
    activeDataRoot: active.dataRoot,
    activeUsername: active.username,
    activeUserDataPath: active.userDataPath,
    restartRequired:
      saved.port !== active.port ||
      saved.host !== active.host ||
      saved.dataRoot !== active.dataRoot ||
      saved.username !== active.username,
  };
}

export function createConfigRouter(activeConfig: ServerConfig, configFile?: string): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(buildResponse(loadConfig({ ensureDirectories: false, configFile }), activeConfig));
  });

  router.put('/', (req, res) => {
    saveConfig(parseRequest(configUpdateSchema, req.body), configFile);
    res.json(buildResponse(loadConfig({ ensureDirectories: false, configFile }), activeConfig));
  });

  return router;
}
