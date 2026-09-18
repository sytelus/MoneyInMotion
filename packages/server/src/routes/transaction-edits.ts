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
import {
  transactionEditsRequestSchema,
  ruleChangesRequestSchema,
} from '../validation/transaction-edit-schema.js';
import { RuleConflictError, type RuleChange } from '../cache/rule-management.js';

export function createTransactionEditsRouter(cache: TransactionCache): Router {
  const router = Router();

  router.post('/manage', async (req, res, next) => {
    const parsed = ruleChangesRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        status: 400,
      });
      return;
    }
    try {
      res.json(
        await cache.manageRules(
          parsed.data.changes as RuleChange[],
          parsed.data.preview,
          parsed.data.expectedRevision,
        ),
      );
    } catch (err) {
      if (err instanceof RuleConflictError)
        res.status(409).json({ error: err.message, status: 409 });
      else next(err);
    }
  });

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
      if (err instanceof TransactionEditTargetError || err instanceof RuleConflictError) {
        res.status(409).json({ error: err.message, status: 409 });
        return;
      }
      next(err);
    }
  });

  return router;
}
