/**
 * Transaction edits API routes.
 *
 * POST /api/transaction-edits - apply edits, return { affectedTransactionsCount }
 *
 * @module
 */

import { Router } from 'express';
import { z } from 'zod';
import type { TransactionEditData } from '@moneyinmotion/core';
import type { TransactionCache } from '../cache/transaction-cache.js';

const editValueSchema = z.object({
    value: z.unknown(),
    isVoided: z.boolean(),
}).nullable().optional();

const editsArraySchema: z.ZodType<TransactionEditData[]> = z.array(
    z.object({
        id: z.string(),
        auditInfo: z.object({
            createDate: z.string(),
            createdBy: z.string(),
            updateDate: z.string().nullable().optional(),
            updatedBy: z.string().nullable().optional(),
        }),
        scopeFilters: z.array(
            z.object({
                type: z.number(),
                parameters: z.array(z.string()),
                referenceParameters: z.array(z.string()).nullable().optional(),
                contentHash: z.string(),
            }),
        ),
        values: z
            .object({
                transactionReason: editValueSchema,
                transactionDate: editValueSchema,
                amount: editValueSchema,
                entityName: editValueSchema,
                isFlagged: editValueSchema,
                note: editValueSchema,
                categoryPath: editValueSchema,
            })
            .nullable(),
        sourceId: z.string(),
    }),
) as z.ZodType<TransactionEditData[]>;

export function createTransactionEditsRouter(
    cache: TransactionCache,
): Router {
    const router = Router();

    router.post('/', async (req, res, next) => {
        try {
            const result = editsArraySchema.safeParse(req.body);
            if (!result.success) {
                res.status(400).json({
                    error: result.error.issues.map((i) => i.message).join('; '),
                    status: 400,
                });
                return;
            }

            const edits = result.data;
            const response = await cache.applyEdits(edits);
            res.json(response);
        } catch (err) {
            next(err);
        }
    });

    return router;
}
