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
import { isValidUsername, loadConfig, saveConfig, type ServerConfig } from '../config.js';

const configUpdateSchema = z
  .object({
    dataRoot: z.string().trim().min(1, 'dataRoot is required').optional(),
    username: z.string().trim().min(1, 'username is required').optional(),
    port: z.number().int().min(1).max(65535).optional(),
  })
  .refine((value) => value.dataRoot != null || value.username != null || value.port != null, {
    message: 'At least one configuration field must be provided',
  });

interface ConfigResponse {
  port: number;
  dataRoot: string;
  username: string;
  userDataPath: string;
  statementsDir: string;
  mergedDir: string;
  stagingDir: string;
  activePort: number;
  activeDataRoot: string;
  activeUsername: string;
  activeUserDataPath: string;
  restartRequired: boolean;
}

function buildResponse(saved: ServerConfig, active: ServerConfig): ConfigResponse {
  return {
    port: saved.port,
    dataRoot: saved.dataRoot,
    username: saved.username,
    userDataPath: saved.userDataPath,
    statementsDir: saved.statementsDir,
    mergedDir: saved.mergedDir,
    stagingDir: saved.stagingDir,
    activePort: active.port,
    activeDataRoot: active.dataRoot,
    activeUsername: active.username,
    activeUserDataPath: active.userDataPath,
    restartRequired:
      saved.port !== active.port ||
      saved.dataRoot !== active.dataRoot ||
      saved.username !== active.username,
  };
}

export function createConfigRouter(activeConfig: ServerConfig): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(buildResponse(loadConfig(), activeConfig));
  });

  router.put('/', (req, res) => {
    const result = configUpdateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: result.error.issues.map((issue) => issue.message).join('; '),
        status: 400,
      });
      return;
    }

    const { dataRoot, username, port } = result.data;
    if (
      dataRoot != null &&
      (!path.isAbsolute(dataRoot) || dataRoot.split(path.sep).includes('..'))
    ) {
      res.status(400).json({
        error: 'dataRoot must be an absolute path without ".." segments',
        status: 400,
      });
      return;
    }
    if (username != null && !isValidUsername(username)) {
      res.status(400).json({
        error: 'username may contain only letters, numbers, dots, hyphens, and underscores',
        status: 400,
      });
      return;
    }

    saveConfig({ dataRoot, username, port });
    res.json(buildResponse(loadConfig(), activeConfig));
  });

  return router;
}
