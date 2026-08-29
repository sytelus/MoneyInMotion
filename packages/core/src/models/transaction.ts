/**
 * Core Transaction model, ported from C# `Transaction`, `Transaction.Display`,
 * and `Transaction.SubClasses`.
 *
 * The {@link TransactionData} interface defines the serialised JSON shape
 * (matching the existing LatestMerged.json wire format). The {@link Transaction}
 * class wraps that data and provides behaviour: construction from imported
 * values, edit application, validation, display properties, and parent/child
 * management.
 *
 * @module
 */

import type { AuditInfo } from './audit-info.js';
import { createAuditInfo, updateAuditInfo } from './audit-info.js';
import type { EditedValues, TransactionEditData } from './transaction-edit.js';
import { mergeEditedValues } from './transaction-edit.js';
import {
  TransactionReason,
  UnknownAdjustment,
  NetOutgoing,
  NetIncoming,
  NetInterAccount,
  intersects,
  transactionReasonInfo,
} from './transaction-reason.js';
import { LineItemType } from './line-item-type.js';
import { getMD5HashString } from '../utils/hash.js';
import { formatDateUtc, parseDate } from '../utils/date-utils.js';
import { isNullOrWhitespace } from '../utils/string-utils.js';
import { normalize } from '../normalization/entity-name-normalizer.js';

// ---------------------------------------------------------------------------
// ImportedValues — the input bag for constructing a new Transaction
// ---------------------------------------------------------------------------

/**
 * Input values provided by a statement parser when creating a new transaction.
 *
 * Mirrors the C# `Transaction.ImportedValues` class. Required fields (`amount`,
 * `transactionDate`, `entityName`) must be present; the constructor validates.
 */
export interface ImportedValues {
  amount: number;
  postedDate?: string | null;
  transactionDate: string;
  entityName: string;
  entityId?: string | null;
  entityNameNormalized?: string | null;
  transactionReason: number;
  lineItemType?: number;
  instituteReference?: string | null;
  providerCategoryName?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  subAccountName?: string | null;
  accountNumber?: string | null;
  checkReference?: string | null;
  requiresParent?: boolean | null;
  providerAttributes?: Record<string, string> | null;
  lineNumber?: number | null;
  parentChildMatchFilter?: string | null;
  contentHash?: string | null;
}

// ---------------------------------------------------------------------------
// TransactionData — serialised JSON shape
// ---------------------------------------------------------------------------

/** Serialised Transaction shape matching the existing LatestMerged.json wire format. */
export interface TransactionData {
  id: string;
  transactionReason: number;
  transactionDate: string;
  postedDate?: string | null;
  entityName: string;
  entityId?: string | null;
  amount: number;
  contentHash: string;
  accountId: string;
  importId: string;
  auditInfo: AuditInfo;
  lineNumber?: number | null;
  mergedEdit?: EditedValues | null;
  appliedEditIdsDescending?: string[] | null;
  entityNameNormalized?: string | null;
  instituteReference?: string | null;
  providerCategoryName?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  subAccountName?: string | null;
  accountNumber?: string | null;
  checkReference?: string | null;
  providerAttributes?: Record<string, string> | null;
  lineItemType?: number;
  parentChildMatchFilter?: string | null;
  requiresParent?: boolean;
  parentId?: string | null;
  children?: Record<string, TransactionData> | null;
  hasMissingChild?: boolean;
  combinedFromId?: string | null;
  combinedToId?: string | null;
  relatedTransferId?: string | null;
}

/**
 * Convert a dictionary emitted by the legacy C# data-contract serializer to
 * a normal JavaScript object. The old serializer represented dictionaries as
 * `[{ "Key": "...", "Value": ... }]`; modern snapshots use JSON objects.
 */
function normalizeDictionary<T>(value: unknown): Record<string, T> | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const normalized = Object.create(null) as Record<string, T>;
    for (const [index, entry] of value.entries()) {
      if (
        entry == null ||
        typeof entry !== 'object' ||
        !('Key' in entry) ||
        !('Value' in entry) ||
        typeof entry.Key !== 'string' ||
        entry.Key.length === 0
      ) {
        throw new Error(`Malformed legacy dictionary entry at index ${index}`);
      }
      if (Object.hasOwn(normalized, entry.Key)) {
        throw new Error(`Duplicate legacy dictionary key: ${entry.Key}`);
      }
      normalized[entry.Key] = entry.Value as T;
    }
    return normalized;
  }
  if (typeof value !== 'object') {
    throw new Error('Dictionary value must be an object, an array of Key/Value pairs, or null');
  }
  return Object.assign(Object.create(null) as Record<string, T>, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Validate the runtime shape of values embedded in a persisted transaction. */
function validateMergedEdit(value: unknown, errors: string[]): void {
  if (value == null) return;
  if (!isRecord(value)) {
    errors.push('MergedEdit must be an object or null.');
    return;
  }

  const validators: Readonly<Record<string, (candidate: unknown) => boolean>> = {
    transactionReason: (candidate) => Number.isInteger(candidate),
    transactionDate: (candidate) => {
      if (typeof candidate !== 'string') return false;
      try {
        parseDate(candidate);
        return true;
      } catch {
        return false;
      }
    },
    amount: (candidate) => typeof candidate === 'number' && Number.isFinite(candidate),
    entityName: (candidate) => typeof candidate === 'string',
    isFlagged: (candidate) => typeof candidate === 'boolean',
    note: (candidate) => typeof candidate === 'string',
    categoryPath: (candidate) =>
      Array.isArray(candidate) && candidate.every((part) => typeof part === 'string'),
  };

  for (const [field, editValue] of Object.entries(value)) {
    if (editValue == null) continue;
    const validateValue = validators[field];
    if (validateValue == null || !isRecord(editValue) || typeof editValue.isVoided !== 'boolean') {
      errors.push(`MergedEdit.${field} is invalid.`);
      continue;
    }
    if (editValue.isVoided) {
      if (editValue.value !== null)
        errors.push(`MergedEdit.${field}.value must be null when voided.`);
    } else if (!validateValue(editValue.value)) {
      errors.push(`MergedEdit.${field}.value is invalid.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the content fields used for hash computation.
 * Matches the C# `GetContent()` method.
 */
function getContentFields(
  accountId: string,
  transactionReason: number,
  amount: number,
  entityIdOrName: string,
  postedDate: string | null | undefined,
  transactionDate: string,
  instituteReference: string | null | undefined,
): string[] {
  const postedDateFormatted = postedDate ? formatDateUtc(parseDate(postedDate)) : '';
  const transactionDateFormatted = formatDateUtc(parseDate(transactionDate));

  return [
    accountId,
    // C# Enum.ToString() persisted the symbolic primitive name (for
    // example "Purchase"), not its numeric wire value ("0"). Keeping
    // that representation is required for legacy content hashes and IDs.
    transactionReasonInfo.find((item) => item.value === transactionReason)?.key ??
      transactionReason.toString(),
    amount.toString(),
    (entityIdOrName ?? '').toUpperCase(),
    postedDateFormatted,
    transactionDateFormatted,
    instituteReference ?? '',
  ];
}

/** Compute the content hash from the content fields. */
function computeContentHash(contentFields: string[]): string {
  return getMD5HashString(contentFields.join('\t'), true);
}

/** Compute the transaction ID from content hash + line info. */
function computeId(
  contentFields: string[],
  lineNumber: number | null | undefined,
  instituteReference: string | null | undefined,
): string {
  const parts = [
    // The legacy constructor hashes GetContent() again here. It does not
    // hash the already-derived ContentHash; PayPal can supply a custom
    // content hash while its transaction identity still uses these raw
    // canonical content fields.
    ...contentFields,
    lineNumber != null ? lineNumber.toString() : '',
    instituteReference ?? '',
  ];
  return getMD5HashString(parts.join('\t'), true);
}

/**
 * Compare two string values; returns `true` when value1 is "better"
 * (longer or equal length).
 */
function isStringBetter(
  value1: string | null | undefined,
  value2: string | null | undefined,
): boolean {
  const len1 = (value1 ?? '').length;
  const len2 = (value2 ?? '').length;
  return len2 <= len1;
}

/**
 * Compare two date strings; returns `true` when value1 is "better"
 * (has time component or is non-null when value2 is null).
 */
function isDateBetter(
  value1: string | null | undefined,
  value2: string | null | undefined,
): boolean {
  if (value2 == null) return true;
  if (value1 == null) return false;

  const d1 = parseDate(value1);
  const d2 = parseDate(value2);

  // Check if date has a time-of-day component (non-midnight)
  const d2HasTime = d2.getUTCHours() !== 0 || d2.getUTCMinutes() !== 0 || d2.getUTCSeconds() !== 0;
  const d1HasTime = d1.getUTCHours() !== 0 || d1.getUTCMinutes() !== 0 || d1.getUTCSeconds() !== 0;

  if (d2HasTime && !d1HasTime) return false;
  if (d2.getTime() !== 0 && d1.getTime() === 0) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Transaction class
// ---------------------------------------------------------------------------

/**
 * The core Transaction domain object.
 *
 * Wraps a {@link TransactionData} payload and provides construction,
 * validation, edit application, display properties, and parent/child
 * management.
 */
export class Transaction {
  /** The underlying serialisable data. */
  private data: TransactionData;

  // Lazy-cached display properties
  private _cachedCorrectedEntityName: string | null | undefined = undefined;
  private _cachedDisplayEntityNameNormalized: string | null | undefined = undefined;
  private _cachedIsUserFlagged: boolean | null | undefined = undefined;
  private _cachedNote: string | null | undefined = undefined;
  private _cachedCategoryPath: string[] | null | undefined = undefined;
  private _cachedCorrectedTransactionDate: string | undefined = undefined;
  private _cachedEntityNameTokens: string[] | undefined = undefined;

  // -----------------------------------------------------------------------
  // Constructors
  // -----------------------------------------------------------------------

  private constructor(data: TransactionData) {
    this.data = data;
  }

  /**
   * Construct a new Transaction from imported values, mirroring the C#
   * `Transaction(string importId, AccountInfo accountInfo, ImportedValues importedValues)`
   * constructor.
   */
  static create(
    importId: string,
    accountId: string,
    accountRequiresParent: boolean,
    importedValues: ImportedValues,
  ): Transaction {
    // Validate required fields
    const errors: string[] = [];
    if (importedValues.amount == null) errors.push('Amount must have value.');
    if (!importedValues.transactionDate) errors.push('TransactionDate must have value.');
    if (isNullOrWhitespace(importedValues.entityName)) errors.push('EntityName must have value.');
    if (errors.length > 0) throw new Error(errors.join(' '));

    const entityIdOrName = isNullOrWhitespace(importedValues.entityId)
      ? importedValues.entityName
      : importedValues.entityId!;

    const entityNameNormalized =
      importedValues.entityNameNormalized ?? normalize(importedValues.entityName);

    const contentFields = getContentFields(
      accountId,
      importedValues.transactionReason,
      importedValues.amount,
      entityIdOrName,
      importedValues.postedDate,
      importedValues.transactionDate,
      importedValues.instituteReference,
    );

    const contentHash = importedValues.contentHash ?? computeContentHash(contentFields);
    const id = computeId(
      contentFields,
      importedValues.lineNumber,
      importedValues.instituteReference,
    );

    const data: TransactionData = {
      id,
      transactionReason: importedValues.transactionReason,
      transactionDate: importedValues.transactionDate,
      postedDate: importedValues.postedDate ?? null,
      entityName: importedValues.entityName,
      entityId: importedValues.entityId ?? null,
      amount: importedValues.amount,
      contentHash,
      accountId,
      importId,
      auditInfo: createAuditInfo(),
      lineNumber: importedValues.lineNumber ?? null,
      mergedEdit: null,
      appliedEditIdsDescending: null,
      entityNameNormalized,
      instituteReference: importedValues.instituteReference ?? null,
      providerCategoryName: importedValues.providerCategoryName ?? null,
      phoneNumber: importedValues.phoneNumber ?? null,
      address: importedValues.address ?? null,
      subAccountName: importedValues.subAccountName ?? null,
      accountNumber: importedValues.accountNumber ?? null,
      checkReference: importedValues.checkReference ?? null,
      providerAttributes: importedValues.providerAttributes ?? null,
      lineItemType: importedValues.lineItemType ?? LineItemType.None,
      parentChildMatchFilter: importedValues.parentChildMatchFilter ?? null,
      requiresParent: importedValues.requiresParent ?? accountRequiresParent,
      parentId: null,
      children: null,
      hasMissingChild: false,
      combinedFromId: null,
      combinedToId: null,
      relatedTransferId: null,
    };

    const tx = new Transaction(data);
    tx.validate();
    return tx;
  }

  /**
   * Re-hydrate a Transaction from its serialised {@link TransactionData}
   * (e.g. loaded from LatestMerged.json).
   */
  static fromData(data: TransactionData): Transaction {
    if (!isRecord(data)) {
      throw new Error('Transaction data must be an object.');
    }
    const providerAttributes = normalizeDictionary<string>(data.providerAttributes);
    const rawChildren = normalizeDictionary<TransactionData>(data.children);
    const children: Record<string, TransactionData> | null =
      rawChildren == null
        ? null
        : Object.fromEntries(
            Object.entries(rawChildren).map(([id, child]) => {
              if (!isRecord(child)) {
                throw new Error(`Child transaction "${id}" must be an object`);
              }
              const normalizedChild = Transaction.fromData(child).toData();
              if (normalizedChild.id !== id) {
                throw new Error(
                  `Child transaction dictionary key "${id}" does not match transaction ID "${normalizedChild.id}"`,
                );
              }
              if (normalizedChild.parentId !== data.id) {
                throw new Error(
                  `Child transaction "${id}" references parent "${normalizedChild.parentId ?? ''}" instead of "${String(data.id)}"`,
                );
              }
              return [id, normalizedChild];
            }),
          );

    const transaction = new Transaction({
      ...data,
      providerAttributes,
      children,
    });
    transaction.validate();
    return transaction;
  }

  /**
   * Wrap an already-normalized child data object without copying it.
   *
   * Parent dictionaries and the collection's flattened index must point to
   * the same mutable data object. Otherwise matching/edit updates made via
   * the flattened child wrapper would not appear when the parent graph is
   * serialized. Callers should use {@link fromData} at trust boundaries and
   * reserve this method for descendants that `fromData` already normalized.
   */
  static fromNormalizedDataReference(data: TransactionData): Transaction {
    return new Transaction(data);
  }

  // -----------------------------------------------------------------------
  // Data accessors
  // -----------------------------------------------------------------------

  get id(): string {
    return this.data.id;
  }
  get transactionReason(): number {
    return this.data.transactionReason;
  }
  get transactionDate(): string {
    return this.data.transactionDate;
  }
  get postedDate(): string | null | undefined {
    return this.data.postedDate;
  }
  get entityName(): string {
    return this.data.entityName;
  }
  get entityId(): string | null | undefined {
    return this.data.entityId;
  }
  get amount(): number {
    return this.data.amount;
  }
  get contentHash(): string {
    return this.data.contentHash;
  }
  get accountId(): string {
    return this.data.accountId;
  }
  get importId(): string {
    return this.data.importId;
  }
  get auditInfo(): AuditInfo {
    return this.data.auditInfo;
  }
  get lineNumber(): number | null | undefined {
    return this.data.lineNumber;
  }
  get mergedEdit(): EditedValues | null | undefined {
    return this.data.mergedEdit;
  }
  get appliedEditIdsDescending(): string[] | null | undefined {
    return this.data.appliedEditIdsDescending;
  }
  get entityNameNormalized(): string | null | undefined {
    return this.data.entityNameNormalized;
  }
  get instituteReference(): string | null | undefined {
    return this.data.instituteReference;
  }
  get providerCategoryName(): string | null | undefined {
    return this.data.providerCategoryName;
  }
  get phoneNumber(): string | null | undefined {
    return this.data.phoneNumber;
  }
  get address(): string | null | undefined {
    return this.data.address;
  }
  get subAccountName(): string | null | undefined {
    return this.data.subAccountName;
  }
  get accountNumber(): string | null | undefined {
    return this.data.accountNumber;
  }
  get checkReference(): string | null | undefined {
    return this.data.checkReference;
  }
  get providerAttributes(): Record<string, string> | null | undefined {
    return this.data.providerAttributes;
  }
  get lineItemType(): number {
    return this.data.lineItemType ?? LineItemType.None;
  }
  get parentChildMatchFilter(): string | null | undefined {
    return this.data.parentChildMatchFilter;
  }
  get requiresParent(): boolean {
    return this.data.requiresParent ?? false;
  }
  get parentId(): string | null | undefined {
    return this.data.parentId;
  }
  get children(): Record<string, TransactionData> | null | undefined {
    return this.data.children;
  }
  get hasMissingChild(): boolean {
    return this.data.hasMissingChild ?? false;
  }
  get combinedFromId(): string | null | undefined {
    return this.data.combinedFromId;
  }
  get combinedToId(): string | null | undefined {
    return this.data.combinedToId;
  }
  get relatedTransferId(): string | null | undefined {
    return this.data.relatedTransferId;
  }

  /**
   * Effective amount after replaying the edit history. The immutable
   * imported amount remains available through {@link amount}; calculations
   * and UI code should normally use this value.
   */
  get correctedAmount(): number {
    const edited = this.data.mergedEdit?.amount;
    return edited != null && !edited.isVoided ? edited.value : this.data.amount;
  }

  /**
   * Effective transaction reason after replaying the edit history. The raw
   * imported value remains available through {@link transactionReason}.
   */
  get correctedTransactionReason(): number {
    const edited = this.data.mergedEdit?.transactionReason;
    return edited != null && !edited.isVoided ? edited.value : this.data.transactionReason;
  }

  /** Return the underlying data for serialisation. */
  toData(): TransactionData {
    return { ...this.data };
  }

  // -----------------------------------------------------------------------
  // Content hash / ID computation (static, for external use)
  // -----------------------------------------------------------------------

  /**
   * Compute a content hash from raw content fields.
   * Matches the C# `Transaction.GetContentHash`.
   */
  static computeContentHash(contentFields: string[]): string {
    return computeContentHash(contentFields);
  }

  /**
   * Compute a transaction ID from canonical content fields, line number,
   * and institute reference.
   */
  static computeId(
    contentFields: string[],
    lineNumber: number | null | undefined,
    instituteReference: string | null | undefined,
  ): string {
    return computeId(contentFields, lineNumber, instituteReference);
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /** Validate the transaction, throwing on constraint violations. */
  private validate(): void {
    const errors: string[] = [];

    if (!Number.isFinite(this.data.amount)) {
      errors.push('Amount must be a finite number.');
    }
    if (!Number.isInteger(this.data.transactionReason)) {
      errors.push('TransactionReason must be an integer.');
    }
    if (typeof this.data.id !== 'string' || !this.data.id) {
      errors.push('Id must have value.');
    }
    if (typeof this.data.contentHash !== 'string' || !this.data.contentHash) {
      errors.push('ContentHash must have value.');
    }
    if (typeof this.data.importId !== 'string' || !this.data.importId) {
      errors.push('ImportId must have value.');
    }
    if (typeof this.data.accountId !== 'string' || !this.data.accountId) {
      errors.push('AccountId must have value.');
    }
    if (typeof this.data.entityName !== 'string' || !this.data.entityName) {
      errors.push('EntityName must have value.');
    }
    try {
      parseDate(this.data.transactionDate);
    } catch {
      errors.push('TransactionDate must be a valid date.');
    }
    if (this.data.postedDate != null) {
      try {
        parseDate(this.data.postedDate);
      } catch {
        errors.push('PostedDate must be a valid date when provided.');
      }
    }
    if (!isRecord(this.data.auditInfo)) {
      errors.push('AuditInfo must be an object.');
    } else {
      try {
        parseDate(this.data.auditInfo.createDate);
      } catch {
        errors.push('AuditInfo.createDate must be a valid date.');
      }
      if (typeof this.data.auditInfo.createdBy !== 'string' || !this.data.auditInfo.createdBy) {
        errors.push('AuditInfo.createdBy must have value.');
      }
      if (this.data.auditInfo.updateDate != null) {
        try {
          parseDate(this.data.auditInfo.updateDate);
        } catch {
          errors.push('AuditInfo.updateDate must be a valid date when provided.');
        }
      }
      if (
        this.data.auditInfo.updatedBy != null &&
        (typeof this.data.auditInfo.updatedBy !== 'string' || !this.data.auditInfo.updatedBy)
      ) {
        errors.push('AuditInfo.updatedBy must be a non-empty string when provided.');
      }
    }
    if (this.data.lineNumber != null && !Number.isInteger(this.data.lineNumber)) {
      errors.push('LineNumber must be an integer when provided.');
    }
    if (
      this.data.lineItemType != null &&
      (!Number.isInteger(this.data.lineItemType) || !(this.data.lineItemType in LineItemType))
    ) {
      errors.push('LineItemType must be a known integer value.');
    }
    if (this.data.requiresParent != null && typeof this.data.requiresParent !== 'boolean') {
      errors.push('RequiresParent must be a boolean when provided.');
    }
    if (this.data.hasMissingChild != null && typeof this.data.hasMissingChild !== 'boolean') {
      errors.push('HasMissingChild must be a boolean when provided.');
    }
    if (
      this.data.appliedEditIdsDescending != null &&
      (!Array.isArray(this.data.appliedEditIdsDescending) ||
        this.data.appliedEditIdsDescending.some((id) => typeof id !== 'string' || !id))
    ) {
      errors.push('AppliedEditIdsDescending must contain only non-empty strings.');
    }
    const optionalStrings: ReadonlyArray<[label: string, value: unknown]> = [
      ['EntityId', this.data.entityId],
      ['EntityNameNormalized', this.data.entityNameNormalized],
      ['InstituteReference', this.data.instituteReference],
      ['ProviderCategoryName', this.data.providerCategoryName],
      ['PhoneNumber', this.data.phoneNumber],
      ['Address', this.data.address],
      ['SubAccountName', this.data.subAccountName],
      ['AccountNumber', this.data.accountNumber],
      ['CheckReference', this.data.checkReference],
      ['ParentChildMatchFilter', this.data.parentChildMatchFilter],
      ['ParentId', this.data.parentId],
      ['CombinedFromId', this.data.combinedFromId],
      ['CombinedToId', this.data.combinedToId],
      ['RelatedTransferId', this.data.relatedTransferId],
    ];
    for (const [label, value] of optionalStrings) {
      if (value != null && typeof value !== 'string') {
        errors.push(`${label} must be a string when provided.`);
      }
    }
    if (
      this.data.providerAttributes != null &&
      Object.values(this.data.providerAttributes).some((value) => typeof value !== 'string')
    ) {
      errors.push('ProviderAttributes values must be strings.');
    }
    validateMergedEdit(this.data.mergedEdit, errors);

    // Amount sign must match reason direction.
    // Note: Purchase (value 0) is excluded automatically because
    // intersects(0, NetOutgoing) is always false.
    if (this.data.amount > 0 && intersects(this.data.transactionReason, NetOutgoing)) {
      errors.push(
        `Transaction amount is positive ${this.data.amount} but it is set for outgoing TransactionReason ${this.data.transactionReason}.`,
      );
    }
    if (this.data.amount < 0 && intersects(this.data.transactionReason, NetIncoming)) {
      errors.push(
        `Transaction amount is negative ${this.data.amount} but it is set for incoming TransactionReason ${this.data.transactionReason}.`,
      );
    }
    if (this.data.transactionReason === UnknownAdjustment) {
      errors.push('TransactionReason should not be UnknownAdjustment.');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }
  }

  // -----------------------------------------------------------------------
  // Edit application
  // -----------------------------------------------------------------------

  /**
   * Apply an edit to this transaction.
   *
   * Merges the edit's values into the transaction's `mergedEdit`, records the
   * edit ID, and updates the audit trail.
   */
  applyEdit(edit: TransactionEditData): void {
    if (this.data.appliedEditIdsDescending?.includes(edit.id)) {
      return;
    }

    if (this.data.mergedEdit == null) {
      // Deep-copy the edit values as the initial merged edit
      this.data.mergedEdit = edit.values ? { ...edit.values } : {};
      this.data.appliedEditIdsDescending = [];
    } else {
      if (edit.values) {
        mergeEditedValues(this.data.mergedEdit, edit.values);
      }
    }

    this.data.appliedEditIdsDescending!.unshift(edit.id);
    this.completeUpdate();
  }

  private completeUpdate(): void {
    this.data.auditInfo = updateAuditInfo(this.data.auditInfo);
    this.invalidateCachedValues();
  }

  private invalidateCachedValues(): void {
    this._cachedCorrectedEntityName = undefined;
    this._cachedDisplayEntityNameNormalized = undefined;
    this._cachedIsUserFlagged = undefined;
    this._cachedNote = undefined;
    this._cachedCategoryPath = undefined;
    this._cachedCorrectedTransactionDate = undefined;
    this._cachedEntityNameTokens = undefined;
  }

  // -----------------------------------------------------------------------
  // Clone
  // -----------------------------------------------------------------------

  /** Deep-copy via JSON round-trip (matches the C# Clone implementation). */
  clone(): Transaction {
    const serialised = JSON.stringify(this.data);
    return new Transaction(JSON.parse(serialised) as TransactionData);
  }

  // -----------------------------------------------------------------------
  // Display properties (lazily cached)
  // -----------------------------------------------------------------------

  /**
   * The entity name override from merged edits, or `null` if no edit
   * has changed the entity name.
   */
  get correctedEntityName(): string | null {
    if (this._cachedCorrectedEntityName === undefined) {
      const ev = this.data.mergedEdit?.entityName;
      this._cachedCorrectedEntityName = ev && !ev.isVoided ? ev.value : null;
    }
    return this._cachedCorrectedEntityName;
  }

  /**
   * The normalised entity name for display.
   * Uses the corrected (edited) name if available, otherwise the
   * original normalised name.
   */
  get displayEntityNameNormalized(): string {
    if (this._cachedDisplayEntityNameNormalized === undefined) {
      this._cachedDisplayEntityNameNormalized =
        this.correctedEntityName ?? this.data.entityNameNormalized ?? this.data.entityName;
    }
    return this._cachedDisplayEntityNameNormalized!;
  }

  /**
   * Whether the user has flagged this transaction, or `null` if not set.
   */
  get isUserFlagged(): boolean | null {
    if (this._cachedIsUserFlagged === undefined) {
      const ev = this.data.mergedEdit?.isFlagged;
      if (ev == null) {
        this._cachedIsUserFlagged = null;
      } else {
        this._cachedIsUserFlagged = ev.isVoided ? null : ev.value;
      }
    }
    return this._cachedIsUserFlagged;
  }

  /** The user note from merged edits, or `null`. */
  get note(): string | null {
    if (this._cachedNote === undefined) {
      const ev = this.data.mergedEdit?.note;
      this._cachedNote = ev && !ev.isVoided ? ev.value : null;
    }
    return this._cachedNote;
  }

  /** The category path from merged edits, or an empty array. */
  get categoryPath(): string[] {
    if (this._cachedCategoryPath === undefined) {
      const ev = this.data.mergedEdit?.categoryPath;
      this._cachedCategoryPath = ev && !ev.isVoided ? ev.value : [];
    }
    return this._cachedCategoryPath!;
  }

  /**
   * The effective transaction date, taking edits into account.
   * Falls back to the original transaction date if no edit overrides it.
   */
  get correctedTransactionDate(): string {
    if (this._cachedCorrectedTransactionDate === undefined) {
      const ev = this.data.mergedEdit?.transactionDate;
      if (ev && !ev.isVoided) {
        this._cachedCorrectedTransactionDate = ev.value;
      } else {
        this._cachedCorrectedTransactionDate = this.data.transactionDate;
      }
    }
    return this._cachedCorrectedTransactionDate!;
  }

  /** Whitespace-split tokens of {@link displayEntityNameNormalized}. */
  get entityNameTokens(): string[] {
    if (this._cachedEntityNameTokens === undefined) {
      const name = this.displayEntityNameNormalized ?? '';
      this._cachedEntityNameTokens = name.trim().length > 0 ? name.trim().split(/\s+/) : [];
    }
    return this._cachedEntityNameTokens;
  }

  // -----------------------------------------------------------------------
  // Parent / child management
  // -----------------------------------------------------------------------

  /**
   * Add a child transaction to this parent.
   * Throws if the child already has a parent or the link would introduce a
   * cycle. Cyclic graphs cannot be serialized and would make recursive
   * aggregation non-terminating, so the invariant is enforced here at the
   * lowest public mutation boundary.
   */
  addChild(child: Transaction): void {
    if (child.id === this.id || child.hasDescendant(this.id)) {
      throw new Error(
        `Cannot add child transaction ${child.id} to parent ${this.id} because the relationship would create a cycle`,
      );
    }

    if (child.data.parentId != null) {
      throw new Error(
        `Cannot add child transaction ${child.id} to parent ${this.id} because it already has other parent ${child.data.parentId}`,
      );
    }

    child.data.parentId = this.id;

    if (this.data.children == null) {
      this.data.children = {};
    }

    // Keep the exact child data object in the hierarchy. The flattened
    // Transactions index wraps this same object, reproducing the C#
    // reference semantics and ensuring later child edits/relationships
    // survive serialization.
    this.data.children[child.id] = child.data;
    this.data.hasMissingChild = true;

    this.completeUpdate();
  }

  /** Return whether this transaction's descendant graph contains `id`. */
  private hasDescendant(id: string): boolean {
    const pending = Object.values(this.data.children ?? {});
    const visited = new Set<string>();

    while (pending.length > 0) {
      const descendant = pending.pop()!;
      if (descendant.id === id) return true;
      if (visited.has(descendant.id)) continue;

      visited.add(descendant.id);
      pending.push(...Object.values(descendant.children ?? {}));
    }

    return false;
  }

  /**
   * Mark the parent as complete and compute the missing child amount.
   *
   * Uses effective (edited) amounts and a half-cent epsilon when checking
   * whether the remainder is zero. Using raw imported amounts here would
   * leave reconciliation state stale after a user corrects an amount.
   *
   * @returns An object with `isComplete` (true when amounts balance) and
   *          `missingChildAmount` (the unmatched remainder).
   */
  completeParent(): { isComplete: boolean; missingChildAmount: number } {
    const childrenValues = this.data.children ? Object.values(this.data.children) : [];
    const childSum = childrenValues.reduce(
      (sum, child) => sum + Transaction.fromNormalizedDataReference(child).correctedAmount,
      0,
    );
    const missingChildAmount = this.correctedAmount - childSum;
    this.data.hasMissingChild = Math.abs(missingChildAmount) >= 0.005;

    this.completeUpdate();

    return { isComplete: !this.data.hasMissingChild, missingChildAmount };
  }

  // -----------------------------------------------------------------------
  // Inter-account matching
  // -----------------------------------------------------------------------

  /**
   * Match this transaction with another as an inter-account transfer pair.
   * Amounts must be equal and opposite; neither may already be matched.
   */
  matchInterAccount(other: Transaction): void {
    if (this.data.amount !== other.data.amount * -1) {
      throw new Error(
        `Cannot match ID '${this.id}' with '${other.id}' because amounts are not equal or opposite, i.e., ${this.data.amount} and ${other.data.amount}`,
      );
    }

    if (this.data.relatedTransferId != null || other.data.relatedTransferId != null) {
      throw new Error(
        `Cannot match ID '${this.id}' with '${other.id}' because one of them is already matched to '${this.data.relatedTransferId}' or '${other.data.relatedTransferId}'`,
      );
    }

    this.data.relatedTransferId = other.id;
    other.data.relatedTransferId = this.id;

    if (!intersects(this.data.transactionReason, NetInterAccount)) {
      this.data.transactionReason = TransactionReason.InterAccountTransfer;
    }
    if (!intersects(other.data.transactionReason, NetInterAccount)) {
      other.data.transactionReason = TransactionReason.InterAccountTransfer;
    }

    this.completeUpdate();
    other.completeUpdate();
  }

  // -----------------------------------------------------------------------
  // Combine attributes
  // -----------------------------------------------------------------------

  /**
   * Merge attributes from `other` into this transaction, keeping the
   * "better" (longer or more specific) value for each field.
   */
  combineAttributes(other: Transaction): void {
    if (this.data.combinedFromId != null || other.data.combinedToId != null) {
      throw new Error(
        `Attempt to combine transaction again. Current ID ${this.id}, CombinedFromId ${this.data.combinedFromId}, other ID ${other.id}`,
      );
    }

    if (!isStringBetter(this.data.entityName, other.data.entityName)) {
      this.data.entityName = other.data.entityName;
      this.data.entityNameNormalized = other.data.entityNameNormalized;
      this._cachedEntityNameTokens = undefined;
    }
    if (!isDateBetter(this.data.transactionDate, other.data.transactionDate)) {
      this.data.transactionDate = other.data.transactionDate;
    }
    if (!isStringBetter(this.data.subAccountName, other.data.subAccountName)) {
      this.data.subAccountName = other.data.subAccountName;
    }
    if (!isStringBetter(this.data.providerCategoryName, other.data.providerCategoryName)) {
      this.data.providerCategoryName = other.data.providerCategoryName;
    }
    if (!isDateBetter(this.data.postedDate, other.data.postedDate)) {
      this.data.postedDate = other.data.postedDate;
    }
    if (!isStringBetter(this.data.phoneNumber, other.data.phoneNumber)) {
      this.data.phoneNumber = other.data.phoneNumber;
    }
    if (!isStringBetter(this.data.instituteReference, other.data.instituteReference)) {
      this.data.instituteReference = other.data.instituteReference;
    }
    if (!isStringBetter(this.data.checkReference, other.data.checkReference)) {
      this.data.checkReference = other.data.checkReference;
    }
    if (!isStringBetter(this.data.accountNumber, other.data.accountNumber)) {
      this.data.accountNumber = other.data.accountNumber;
    }

    this.data.combinedFromId = other.id;
    other.data.combinedToId = this.id;

    this.completeUpdate();
  }

  // -----------------------------------------------------------------------
  // toString
  // -----------------------------------------------------------------------

  toString(): string {
    return `${this.data.amount}, ${this.data.transactionDate}, ${this.data.entityName}`;
  }
}
