/**
 * Transaction edit types, ported from C# `TransactionEdit` and
 * `TransactionEdit.SubClasses`.
 *
 * A *transaction edit* captures a user's intent to change one or more field
 * values on transactions matched by a set of scope filters. Edits are
 * persisted independently and merged at runtime so that the original imported
 * data is never mutated.
 *
 * @module
 */

import type { AuditInfo } from './audit-info.js';

// ---------------------------------------------------------------------------
// ScopeType enum
// ---------------------------------------------------------------------------

/**
 * Discriminator for the different ways an edit can target transactions.
 *
 * Numeric values match the legacy C# enum.
 */
export enum ScopeType {
  /** No scope -- placeholder / default. */
  None = 0,
  /** Apply to every transaction. */
  All = 1,
  /** Match one or more specific transaction IDs. */
  TransactionId = 2,
  /** Match by exact entity name(s). */
  EntityName = 3,
  /** Match by normalised entity name(s). */
  EntityNameNormalized = 4,
  /** Match when *any* of the given tokens appear in the entity name. */
  EntityNameAnyTokens = 5,
  /** Match when *all* of the given tokens appear in the entity name. */
  EntityNameAllTokens = 6,
  /** Match by account ID(s). */
  AccountId = 7,
  /** Match by transaction reason value(s). */
  TransactionReason = 8,
  /** Match by an amount range (exactly two parameters: min, max). */
  AmountRange = 9,
}

// ---------------------------------------------------------------------------
// ScopeFilter
// ---------------------------------------------------------------------------

/**
 * Minimum and maximum parameter counts per {@link ScopeType}.
 *
 * The tuple is `[min, max, requiresReferenceParameters]`.
 */
const scopeParameterRules: Readonly<
  Record<ScopeType, readonly [min: number, max: number, requiresRef: boolean]>
> = {
  [ScopeType.None]: [0, 0, false],
  [ScopeType.All]: [0, 0, false],
  [ScopeType.TransactionId]: [1, Number.MAX_SAFE_INTEGER, false],
  [ScopeType.EntityName]: [1, Number.MAX_SAFE_INTEGER, false],
  [ScopeType.EntityNameNormalized]: [1, Number.MAX_SAFE_INTEGER, false],
  [ScopeType.EntityNameAnyTokens]: [1, Number.MAX_SAFE_INTEGER, false],
  [ScopeType.EntityNameAllTokens]: [1, Number.MAX_SAFE_INTEGER, false],
  [ScopeType.AccountId]: [1, Number.MAX_SAFE_INTEGER, false],
  [ScopeType.TransactionReason]: [1, Number.MAX_SAFE_INTEGER, false],
  [ScopeType.AmountRange]: [2, 3, false],
};

/**
 * Validate that the given parameters are acceptable for the specified
 * {@link ScopeType}.
 *
 * @param type   - The scope type to validate against.
 * @param params - The parameter array to check.
 * @returns An error message string, or an empty string when valid.
 */
export function validateScopeFilter(
  type: ScopeType,
  params: readonly string[],
): string {
  const rule = scopeParameterRules[type];
  if (rule === undefined) {
    return `Unknown ScopeType: ${type}`;
  }
  const [min, max] = rule;
  if (params.length < min || params.length > max) {
    return (
      `ScopeType ${ScopeType[type]} must have at least ${min} parameter(s) ` +
      `and no more than ${max} but it has ${params.length}`
    );
  }
  return '';
}

/**
 * A single filter that determines which transactions an edit applies to.
 *
 * Matches the JSON shape produced by the legacy C# serializer:
 * ```json
 * {
 *   "type": 2,
 *   "parameters": ["txn-id-1"],
 *   "referenceParameters": null,
 *   "contentHash": "abc123..."
 * }
 * ```
 */
export interface ScopeFilter {
  /** The kind of match this filter performs. */
  readonly type: ScopeType;

  /** Scope-specific parameter values (e.g. transaction IDs, entity names). */
  readonly parameters: readonly string[];

  /**
   * Optional reference parameters used by some scope types for secondary
   * matching. May be `null` or `undefined`.
   */
  readonly referenceParameters?: readonly string[] | null;

  /** Content-based hash used for deduplication of scope filters. */
  readonly contentHash: string;
}

/**
 * Create a new {@link ScopeFilter} with parameter validation.
 *
 * @param type      - The scope type.
 * @param params    - The scope parameters.
 * @param refParams - Optional reference parameters.
 * @returns A validated `ScopeFilter`.
 * @throws {Error} When parameter counts are invalid for the given scope type.
 */
export function createScopeFilter(
  type: ScopeType,
  params: string[],
  refParams?: string[] | null,
): ScopeFilter {
  const error = validateScopeFilter(type, params);
  if (error) {
    throw new Error(`EditScope parameters are invalid: ${error}`);
  }

  // Replicate the C# content-hash logic:
  // Hash = MD5( join("\t", [...parameters, String(scopeType)]) )
  // We use a simple string-based hash here; the actual MD5 is computed at
  // a higher layer when full parity with legacy hashing is needed.
  const hashInput = [...params, String(type as number)].join('\t');

  return {
    type,
    parameters: [...params],
    referenceParameters: refParams ?? null,
    contentHash: hashInput,
  };
}

// ---------------------------------------------------------------------------
// EditValue<T>
// ---------------------------------------------------------------------------

/**
 * A wrapper that carries either a replacement value or a "voided" marker.
 *
 * The three-state semantics enable the 3-way merge used by
 * {@link mergeEditedValues}:
 *
 * | `EditValue` state    | Merge behaviour                         |
 * |----------------------|-----------------------------------------|
 * | Present, not voided  | Apply the contained value               |
 * | `null` / `undefined` | Leave the target field unchanged        |
 * | Present, voided      | Revert the target field to `null`       |
 *
 * Matches the JSON shape produced by the legacy C# serializer:
 * ```json
 * { "value": "Groceries", "isVoided": false }
 * ```
 */
export interface EditValue<T> {
  /** The replacement value. Meaningless when {@link isVoided} is `true`. */
  readonly value: T;

  /**
   * When `true`, the field should revert to its original (un-edited) state,
   * effectively removing any prior edit.
   */
  readonly isVoided: boolean;
}

/**
 * Convenience factory: create an {@link EditValue} that carries a real value.
 *
 * @param value - The replacement value.
 */
export function editValue<T>(value: T): EditValue<T> {
  return { value, isVoided: false };
}

/**
 * Convenience factory: create a voided {@link EditValue}.
 *
 * The `value` field is set to `null` (matching the C# `default(T)` behaviour
 * for reference types).
 */
export function voidedEditValue<T>(): EditValue<T> {
  return { value: null as unknown as T, isVoided: true };
}

// ---------------------------------------------------------------------------
// EditedValues
// ---------------------------------------------------------------------------

/**
 * The set of field-level edits that can be applied to a transaction.
 *
 * Every field is nullable: a `null` field means "no change to that field".
 * A non-null field carries an {@link EditValue} whose `isVoided` flag
 * determines whether to apply or revert.
 *
 * Matches the JSON shape produced by the legacy C# serializer.
 */
export interface EditedValues {
  /** Override for the transaction reason. */
  transactionReason?: EditValue<number> | null;

  /** Override for the transaction date (ISO-8601 string). */
  transactionDate?: EditValue<string> | null;

  /** Override for the amount. */
  amount?: EditValue<number> | null;

  /** Override for the entity (merchant / payee) name. */
  entityName?: EditValue<string> | null;

  /** Override for the user-flagged state. */
  isFlagged?: EditValue<boolean> | null;

  /** Override for the free-text note. */
  note?: EditValue<string> | null;

  /** Override for the category path (array of path segments). */
  categoryPath?: EditValue<string[]> | null;
}

/**
 * Merge `source` edits into `target` using the 3-way merge semantics from
 * the legacy C# `EditedValues.Merge` method.
 *
 * For each field in `source`:
 *
 * 1. **`source` field is non-null and not voided** -- apply the source value
 *    to `target`.
 * 2. **`source` field is `null` / `undefined`** -- leave the `target` field
 *    unchanged (no-op).
 * 3. **`source` field is non-null and voided** -- set the `target` field to
 *    `null` (revert to original imported value).
 *
 * @param target - The accumulated edits so far (mutated in place).
 * @param source - The new edits to merge in.
 * @returns The mutated `target` for convenience.
 */
export function mergeEditedValues(
  target: EditedValues,
  source: Readonly<EditedValues>,
): EditedValues {
  // Helper that implements the 3-way rule for a single field.
  function mergeField<K extends keyof EditedValues>(key: K): void {
    const srcField = source[key];
    if (srcField != null) {
      // srcField is present
      if (srcField.isVoided) {
        // Case 3: revert -- clear the field on the target
        target[key] = null;
      } else {
        // Case 1: apply the new value
        target[key] = srcField;
      }
    }
    // Case 2 (srcField is null/undefined): leave target[key] as-is
  }

  mergeField('transactionReason');
  mergeField('transactionDate');
  mergeField('amount');
  mergeField('entityName');
  mergeField('isFlagged');
  mergeField('note');
  mergeField('categoryPath');

  return target;
}

// ---------------------------------------------------------------------------
// TransactionEditData (the full persisted edit object)
// ---------------------------------------------------------------------------

/**
 * The full persisted representation of a transaction edit.
 *
 * Matches the JSON shape produced by the legacy C# `TransactionEdit`
 * serializer:
 * ```json
 * {
 *   "id": "base64-guid",
 *   "auditInfo": { ... },
 *   "scopeFilters": [ ... ],
 *   "values": { ... },
 *   "sourceId": "some-source"
 * }
 * ```
 */
export interface TransactionEditData {
  /** Unique identifier for this edit (base-64 encoded GUID in legacy). */
  readonly id: string;

  /** Audit trail for this edit. */
  readonly auditInfo: AuditInfo;

  /** One or more filters determining which transactions this edit targets. */
  readonly scopeFilters: readonly ScopeFilter[];

  /** The field-level changes to apply. May be `null` if the edit is empty. */
  readonly values: EditedValues | null;

  /**
   * Identifier of the source that produced this edit (e.g. the UI session
   * or import job that created it).
   */
  readonly sourceId: string;
}
