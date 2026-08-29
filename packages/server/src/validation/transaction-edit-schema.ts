/**
 * Runtime schemas for transaction edits at HTTP and persistence boundaries.
 *
 * The browser API requires the current hexadecimal scope hash and verifies it
 * against the scope contents. Persisted data additionally accepts the base64
 * MD5 representation written by the legacy C# application, while retaining
 * the same structural and value validation for every other field.
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
const legacyBase64Md5 = /^[A-Za-z0-9+/]{22}==$/;
const currentHexMd5 = /^[0-9a-f]{32}$/i;

function buildScopeFilterSchema(allowLegacyHash: boolean) {
  return z
    .object({
      type: z
        .number()
        .int()
        .refine((value) => knownScopeTypes.has(value), {
          message: 'Unknown scope-filter type.',
        }),
      parameters: z.array(z.string().max(1_000)).max(1_000),
      referenceParameters: z.array(z.string().max(1_000)).max(1_000).nullable().optional(),
      contentHash: z
        .string()
        .refine(
          (value) => currentHexMd5.test(value) || (allowLegacyHash && legacyBase64Md5.test(value)),
          'Invalid scope content hash.',
        ),
    })
    .strict()
    .superRefine((scope, context) => {
      const type = scope.type as ScopeType;
      const parameterError = validateScopeFilter(type, scope.parameters);
      if (parameterError) {
        context.addIssue({ code: 'custom', path: ['parameters'], message: parameterError });
        return;
      }

      // Legacy base64 hashes were calculated by the C# implementation and
      // use a different output encoding. Current hex hashes can be fully
      // recomputed and must match their declared scope contents.
      if (currentHexMd5.test(scope.contentHash)) {
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
}

function buildEditedValuesSchema(allowLegacyEmptyValues: boolean) {
  const editableString = allowLegacyEmptyValues ? z.string().max(10_000) : nonEmptyString;
  const categorySegment = allowLegacyEmptyValues ? z.string().max(10_000) : nonEmptyString;
  const categoryPath = allowLegacyEmptyValues
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

  return allowLegacyEmptyValues
    ? schema
    : schema.refine((values) => Object.values(values).some((value) => value != null), {
        message: 'At least one edited field is required.',
      });
}

function buildTransactionEditSchema(allowLegacyHash: boolean) {
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
      scopeFilters: z.array(buildScopeFilterSchema(allowLegacyHash)).min(1).max(20),
      values: buildEditedValuesSchema(allowLegacyHash),
      sourceId: z.string().trim().min(1).max(200),
    })
    .strict();
}

/** Strict schema for new browser-submitted edits. */
export const transactionEditsRequestSchema = z
  .array(buildTransactionEditSchema(false))
  .min(1)
  .max(100);

/** Compatibility schema for one edit loaded from durable JSON. */
export const persistedTransactionEditSchema = buildTransactionEditSchema(true);

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
