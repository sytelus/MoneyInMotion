/**
 * Transaction-edit (rule) API.
 *
 * POST /api/transaction-edits        - add new rules
 * POST /api/transaction-edits/manage - preview or commit edits/deletions of saved rules
 *
 * Rules are persisted and replayed indefinitely, so each request is validated
 * against the complete domain shape instead of trusting browser-side types.
 * Invalid batches never reach the transaction cache; conflicts return 409.
 *
 * @module
 */

import { Router } from 'express';
import type { TransactionEditData } from '@moneyinmotion/core';
import type { TransactionCache } from '../cache/transaction-cache.js';
import type { RuleChange } from '../cache/rule-management.js';
import {
  transactionEditsRequestSchema,
  ruleChangesRequestSchema,
} from '../validation/transaction-edit-schema.js';
import { parseRequest } from './request-validation.js';

export function createTransactionEditsRouter(cache: TransactionCache): Router {
  const router = Router();

  router.post('/manage', async (req, res) => {
    const { changes, preview, expectedRevision } = parseRequest(ruleChangesRequestSchema, req.body);
    res.json(await cache.manageRules(changes as RuleChange[], preview, expectedRevision));
  });

  router.post('/', async (req, res) => {
    const edits = parseRequest(transactionEditsRequestSchema, req.body);
    res.json(await cache.applyEdits(edits as TransactionEditData[]));
  });

  return router;
}
