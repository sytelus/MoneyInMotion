/**
 * Transaction-edit API boundary.
 *
 * Financial edits are persisted and replayed indefinitely, so this route
 * validates the complete domain shape instead of trusting TypeScript types
 * supplied by a browser. Invalid batches never reach the transaction cache.
 *
 * @module
 */

import { Router } from 'express';
import { TransactionEditTargetError, type TransactionEditData } from '@moneyinmotion/core';
import type { TransactionCache } from '../cache/transaction-cache.js';
import { transactionEditsRequestSchema } from '../validation/transaction-edit-schema.js';

export function createTransactionEditsRouter(cache: TransactionCache): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const result = transactionEditsRequestSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: result.error.issues
            .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
            .join('; '),
          status: 400,
        });
        return;
      }

      const response = await cache.applyEdits(result.data as TransactionEditData[]);
      res.json(response);
    } catch (err) {
      if (err instanceof TransactionEditTargetError) {
        res.status(409).json({ error: err.message, status: 409 });
        return;
      }
      next(err);
    }
  });

  return router;
}
