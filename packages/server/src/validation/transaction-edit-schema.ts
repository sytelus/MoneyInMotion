/**
 * Runtime schemas for transaction edits at HTTP and persistence boundaries.
 *
 * Every scope hash must be the hex MD5 of its type and parameters. New rules
 * must change at least one field to a non-empty value; saved rules may also
 * clear a field (an empty value) and are kept even when they change nothing.
 *
 * @module
 */

import { z } from 'zod';
import {
  ScopeType,
  createScopeFilter,
  parseDate,
  validateScopeFilter,
  type TransactionEditData,
} from '@moneyinmotion/core';

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
const hexMd5 = /^[0-9a-f]{32}$/i;

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
    contentHash: z.string().refine((value) => hexMd5.test(value), 'Invalid scope content hash.'),
  })
  .strict()
  .superRefine((scope, context) => {
    const type = scope.type as ScopeType;
    const parameterError = validateScopeFilter(type, scope.parameters);
    if (parameterError) {
      context.addIssue({ code: 'custom', path: ['parameters'], message: parameterError });
      return;
    }

    if (hexMd5.test(scope.contentHash)) {
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
    }
  });

function buildEditedValuesSchema(allowEmptyValues: boolean) {
  const editableString = allowEmptyValues ? z.string().max(10_000) : nonEmptyString;
  const categorySegment = allowEmptyValues ? z.string().max(10_000) : nonEmptyString;
  const categoryPath = allowEmptyValues
    ? z.array(categorySegment).max(20)
    : z.array(categorySegment).min(1).max(20);

  const schema = z
    .object({
      transactionReason: editValueSchema(z.number().int().min(0).max(0x7fffffff)),
      transactionDate: editValueSchema(validDate),
      amount: editValueSchema(z.number().finite()),
      entityName: editValueSchema(editableString),
      isFlagged: editValueSchema(z.boolean()),
      note: editValueSchema(editableString),
      categoryPath: editValueSchema(categoryPath),
    })
    .strict();

  return allowEmptyValues
    ? schema
    : schema.refine((values) => Object.values(values).some((value) => value != null), {
        message: 'At least one edited field is required.',
      });
}

function buildTransactionEditSchema(allowEmptyValues: boolean) {
  return z
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
      values: buildEditedValuesSchema(allowEmptyValues),
      sourceId: z.string().trim().min(1).max(200),
    })
    .strict();
}

/** Strict schema for new browser-submitted edits. */
export const transactionEditsRequestSchema = z
  .array(buildTransactionEditSchema(false))
  .min(1)
  .max(100);

/** Schema for one saved edit. */
const persistedTransactionEditSchema = buildTransactionEditSchema(true);

export const ruleChangesRequestSchema = z
  .object({
    preview: z.boolean(),
    expectedRevision: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    changes: z
      .array(
        z
          .object({
            previous: persistedTransactionEditSchema.nullable(),
            next: buildTransactionEditSchema(true).nullable(),
          })
          .strict()
          .refine(
            (change) => change.previous != null || change.next != null,
            'A rule change is required.',
          )
          .superRefine((change, context) => {
            // A saved rule may clear a field (empty value). Keep that when
            // another field is edited; new rules remain strict.
            if (change.previous == null && change.next != null) {
              const result = buildTransactionEditSchema(false).safeParse(change.next);
              if (!result.success)
                for (const issue of result.error.issues) {
                  context.addIssue({
                    code: 'custom',
                    path: ['next', ...issue.path],
                    message: issue.message,
                  });
                }
            }
          }),
      )
      .min(1)
      .max(1000),
  })
  .strict();

/** Validate and return a complete persisted edit array with useful paths. */
export function parsePersistedTransactionEdits(
  value: unknown,
  label: string,
): TransactionEditData[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  return value.map((edit, index) => {
    const result = persistedTransactionEditSchema.safeParse(edit);
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'edit'}: ${issue.message}`)
        .join('; ');
      throw new Error(`${label}[${index}] is invalid: ${details}`);
    }
    return result.data as TransactionEditData;
  });
}
