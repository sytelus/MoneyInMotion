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
import { z } from 'zod';
import {
  ScopeType,
  TransactionEditTargetError,
  createScopeFilter,
  parseDate,
  validateScopeFilter,
  type TransactionEditData,
} from '@moneyinmotion/core';
import type { TransactionCache } from '../cache/transaction-cache.js';

const nonEmptyString = z.string().trim().min(1).max(10_000);
const validDate = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => {
      try {
        parseDate(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid date.' },
  );

function editValueSchema<T extends z.ZodType>(valueSchema: T) {
  return z
    .union([
      z.object({ value: valueSchema, isVoided: z.literal(false) }).strict(),
      z.object({ value: z.null(), isVoided: z.literal(true) }).strict(),
    ])
    .nullable()
    .optional();
}

const knownScopeTypes = new Set<number>(
  Object.values(ScopeType).filter((value): value is number => typeof value === 'number'),
);

const scopeFilterSchema = z
  .object({
    type: z
      .number()
      .int()
      .refine((value) => knownScopeTypes.has(value), {
        message: 'Unknown scope-filter type.',
      }),
    parameters: z.array(z.string().max(1_000)).max(1_000),
    referenceParameters: z.array(z.string().max(1_000)).max(1_000).nullable().optional(),
    contentHash: z.string().regex(/^[0-9a-f]{32}$/i, 'Invalid scope content hash.'),
  })
  .strict()
  .superRefine((scope, context) => {
    const type = scope.type as ScopeType;
    const parameterError = validateScopeFilter(type, scope.parameters);
    if (parameterError) {
      context.addIssue({ code: 'custom', path: ['parameters'], message: parameterError });
      return;
    }

    if (type === ScopeType.AmountRange) {
      const minimum = Number(scope.parameters[0]);
      const maximum = Number(scope.parameters[1]);
      const negative = scope.parameters[2]?.toLowerCase();
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
        context.addIssue({
          code: 'custom',
          path: ['parameters'],
          message: 'Amount-range bounds must be finite numbers.',
        });
      } else if (minimum > maximum) {
        context.addIssue({
          code: 'custom',
          path: ['parameters'],
          message: 'Amount-range minimum cannot exceed its maximum.',
        });
      }
      if (negative != null && negative !== 'true' && negative !== 'false') {
        context.addIssue({
          code: 'custom',
          path: ['parameters', 2],
          message: 'Amount-range direction must be "true" or "false".',
        });
      }
    }

    const expectedHash = createScopeFilter(
      type,
      [...scope.parameters],
      scope.referenceParameters == null ? null : [...scope.referenceParameters],
    ).contentHash;
    if (scope.contentHash.toLowerCase() !== expectedHash) {
      context.addIssue({
        code: 'custom',
        path: ['contentHash'],
        message: 'Scope content hash does not match its type and parameters.',
      });
    }
  });

const editedValuesSchema = z
  .object({
    transactionReason: editValueSchema(z.number().int().min(0).max(0x7fffffff)),
    transactionDate: editValueSchema(validDate),
    amount: editValueSchema(z.number().finite()),
    entityName: editValueSchema(nonEmptyString),
    isFlagged: editValueSchema(z.boolean()),
    note: editValueSchema(nonEmptyString),
    categoryPath: editValueSchema(z.array(nonEmptyString).min(1).max(20)),
  })
  .strict()
  .refine((values) => Object.values(values).some((value) => value != null), {
    message: 'At least one edited field is required.',
  });

const transactionEditSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    auditInfo: z
      .object({
        createDate: validDate,
        createdBy: z.string().trim().min(1).max(200),
        updateDate: validDate.nullable().optional(),
        updatedBy: z.string().trim().min(1).max(200).nullable().optional(),
      })
      .strict(),
    scopeFilters: z.array(scopeFilterSchema).min(1).max(20),
    values: editedValuesSchema,
    sourceId: z.string().trim().min(1).max(200),
  })
  .strict();

const editsArraySchema = z.array(transactionEditSchema).min(1).max(100);

export function createTransactionEditsRouter(cache: TransactionCache): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const result = editsArraySchema.safeParse(req.body);
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
