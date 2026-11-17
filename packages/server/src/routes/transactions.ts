/**
 * Transactions API routes.
 *
 * GET  /api/transactions - returns serialized Transactions JSON from cache
 *
 * @module
 */

import { Router } from 'express';
import type { TransactionCache } from '../cache/transaction-cache.js';

export function createTransactionsRouter(cache: TransactionCache): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json((await cache.getTransactions()).serialize());
  });

  return router;
}
