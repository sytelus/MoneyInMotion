/**
 * Transactions collection class, ported from C# `Transactions`.
 *
 * Provides storage, merging, matching, edit application, and
 * serialization/deserialization for a named collection of {@link Transaction}
 * objects.
 *
 * @module
 */

import type { AccountInfo } from './account-info.js';
import type { ImportInfo } from './import-info.js';
import type { TransactionEditData, ScopeFilter } from './transaction-edit.js';
import { ScopeType } from './transaction-edit.js';
import { TransactionEdits } from './transaction-edits.js';
import { Transaction, type TransactionData } from './transaction.js';
import { NetInterAccount, TransactionReason, intersects } from './transaction-reason.js';
import { AccountType } from './account-info.js';
import { parseDate } from '../utils/date-utils.js';
import type { ParentChildMatch } from '../matching/parent-child-match.js';
import { GenericTxParentChildMatcher } from '../matching/generic-tx-matcher.js';
import { AmazonOrderMatcher } from '../matching/amazon-order-matcher.js';
import { EtsyOrderMatcher } from '../matching/etsy-order-matcher.js';

const MS_PER_DAY = 86_400_000;

/** An exact-ID edit referenced transactions that are absent from a snapshot. */
export class TransactionEditTargetError extends Error {
  constructor(expected: number, actual: number) {
    super(
      `Edit targeted transactions with ${expected} IDs but only ${actual} were found in this collection`,
    );
    this.name = 'TransactionEditTargetError';
  }
}

// ---------------------------------------------------------------------------
// Helper: deserialize C# Dictionary format
// ---------------------------------------------------------------------------

/**
 * Deserialize data that may be in the C# `DataContractJsonSerializer` format
 * for `Dictionary<string, T>`, which serializes as:
 * ```json
 * [{"Key": "abc", "Value": {...}}, {"Key": "def", "Value": {...}}]
 * ```
 *
 * Also accepts a plain `Record<string, T>` object and passes it through.
 *
 * @param data - Either an array of `{Key, Value}` pairs or a plain object.
 * @returns A plain `Record<string, T>`.
 */
export function deserializeDictionary<T>(data: unknown): Record<string, T> {
  if (data == null) {
    return {};
  }

  // C# legacy format: array of {Key, Value}
  if (Array.isArray(data)) {
    // A null prototype makes even special keys such as "__proto__" ordinary
    // data and prevents legacy dictionary input from mutating object state.
    const result = Object.create(null) as Record<string, T>;
    for (const [index, item] of data.entries()) {
      if (
        item == null ||
        typeof item !== 'object' ||
        !('Key' in item) ||
        !('Value' in item) ||
        typeof item.Key !== 'string' ||
        item.Key.length === 0
      ) {
        throw new Error(`Malformed legacy dictionary entry at index ${index}`);
      }
      if (Object.hasOwn(result, item.Key)) {
        throw new Error(`Duplicate legacy dictionary key: ${item.Key}`);
      }
      result[item.Key] = item.Value as T;
    }
    return result;
  }

  // Normal object format
  if (typeof data === 'object') {
    return Object.assign(Object.create(null) as Record<string, T>, data);
  }

  throw new Error('Dictionary value must be an object, an array of Key/Value pairs, or null');
}

// ---------------------------------------------------------------------------
// TransactionsData — serialised JSON shape
// ---------------------------------------------------------------------------

/**
 * Serialised shape for a {@link Transactions} collection, matching the
 * existing JSON wire format.
 */
export interface TransactionsData {
  name: string;
  topItems: Record<string, TransactionData>;
  accountInfos: Record<string, AccountInfo>;
  importInfos: Record<string, ImportInfo>;
  edits:
    | TransactionEditData[]
    | {
        sourceId?: string;
        name?: string;
        edits?: TransactionEditData[];
      };
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): UnknownRecord {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as UnknownRecord;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null`);
  return value;
}

/** Decode both current camelCase and historical PascalCase account metadata. */
function normalizeAccountInfo(value: unknown): AccountInfo {
  const raw = asRecord(value, 'AccountInfo');
  const type = raw.type ?? raw.Type;
  const requiresParent = raw.requiresParent ?? raw.RequiresParent;
  const tags = raw.interAccountNameTags ?? raw.InterAccountNameTags;
  const validAccountTypes = new Set<number>([
    AccountType.CreditCard,
    AccountType.BankChecking,
    AccountType.BankSavings,
    AccountType.OrderHistory,
    AccountType.EPayment,
  ]);

  if (typeof type !== 'number' || !validAccountTypes.has(type)) {
    throw new Error(`AccountInfo.type is not a supported AccountType: ${String(type)}`);
  }
  if (typeof requiresParent !== 'boolean') {
    throw new Error('AccountInfo.requiresParent must be a boolean');
  }
  if (tags != null && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string'))) {
    throw new Error('AccountInfo.interAccountNameTags must be an array of strings or null');
  }

  return {
    id: requiredString(raw.id ?? raw.Id, 'AccountInfo.id'),
    instituteName: requiredString(
      raw.instituteName ?? raw.InstituteName,
      'AccountInfo.instituteName',
    ),
    title: optionalString(raw.title ?? raw.Title, 'AccountInfo.title'),
    type,
    requiresParent,
    interAccountNameTags: tags == null ? null : [...(tags as string[])],
  };
}

/** Decode both current camelCase and historical PascalCase import metadata. */
function normalizeImportInfo(value: unknown): ImportInfo {
  const raw = asRecord(value, 'ImportInfo');
  const updateDate = raw.updateDate ?? raw.UpdateDate;
  const createDate = raw.createDate ?? raw.CreateDate;
  const format = raw.format ?? raw.Format;
  const result: ImportInfo = {
    id: requiredString(raw.id ?? raw.Id, 'ImportInfo.id'),
    portableAddress: requiredString(
      raw.portableAddress ?? raw.PortableAddress,
      'ImportInfo.portableAddress',
    ),
    contentHash: requiredString(raw.contentHash ?? raw.ContentHash, 'ImportInfo.contentHash'),
  };
  if (updateDate != null) {
    Object.assign(result, { updateDate: optionalString(updateDate, 'ImportInfo.updateDate') });
  }
  if (createDate != null) {
    Object.assign(result, { createDate: optionalString(createDate, 'ImportInfo.createDate') });
  }
  if (format != null) {
    Object.assign(result, { format: optionalString(format, 'ImportInfo.format') });
  }
  return result;
}

function normalizeEmbeddedEdits(
  value: TransactionsData['edits'] | undefined,
): TransactionEditData[] {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.edits) ? value.edits : [];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a transaction and its children into a flat list.
 */
function flattenTransactions(transactions: Iterable<Transaction>): Transaction[] {
  const result: Transaction[] = [];
  const seenIds = new Set<string>();

  const visit = (tx: Transaction): void => {
    if (seenIds.has(tx.id)) {
      throw new Error(`Duplicate transaction ID in hierarchy: ${tx.id}`);
    }
    seenIds.add(tx.id);
    result.push(tx);
    if (tx.children) {
      const childTxs = Object.values(tx.children).map((childData) =>
        Transaction.fromNormalizedDataReference(childData),
      );
      childTxs.forEach(visit);
    }
  };

  for (const tx of transactions) {
    visit(tx);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Transactions class
// ---------------------------------------------------------------------------

/**
 * A named collection of transactions with accounts, imports, edits,
 * and matching capabilities.
 *
 * Mirrors the C# `Transactions` class.
 */
export class Transactions {
  private name: string;
  private topItemsById: Map<string, Transaction>;
  private allItemsById: Map<string, Transaction>;
  private uniqueContentHashes: Map<string, string[]>;
  private accountInfos: Map<string, AccountInfo>;
  private importInfos: Map<string, ImportInfo>;
  private edits: TransactionEdits;

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  constructor(name: string) {
    this.name = name;
    this.topItemsById = new Map();
    this.allItemsById = new Map();
    this.uniqueContentHashes = new Map();
    this.accountInfos = new Map();
    this.importInfos = new Map();
    this.edits = new TransactionEdits(name);
  }

  // -----------------------------------------------------------------------
  // Deserialization
  // -----------------------------------------------------------------------

  /**
   * Deserialize from a {@link TransactionsData} JSON payload.
   *
   * Handles both the C# legacy `[{Key,Value}]` array format and
   * normal `Record<string, T>` for dictionary fields.
   */
  static fromData(data: TransactionsData): Transactions {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new Error('Transactions name must be a non-empty string');
    }
    const txns = new Transactions(data.name);

    // Deserialize dictionaries (handle legacy format)
    const topItemsRaw = deserializeDictionary<TransactionData>(data.topItems);
    const accountInfosRaw = deserializeDictionary<AccountInfo>(data.accountInfos);
    const importInfosRaw = deserializeDictionary<ImportInfo>(data.importInfos);

    // Populate account and import infos first (needed by transactions)
    for (const [key, value] of Object.entries(accountInfosRaw)) {
      const normalized = normalizeAccountInfo(value);
      if (normalized.id !== key) {
        throw new Error(
          `AccountInfo dictionary key "${key}" does not match metadata ID "${normalized.id}"`,
        );
      }
      txns.accountInfos.set(key, normalized);
    }
    for (const [key, value] of Object.entries(importInfosRaw)) {
      const normalized = normalizeImportInfo(value);
      if (normalized.id !== key) {
        throw new Error(
          `ImportInfo dictionary key "${key}" does not match metadata ID "${normalized.id}"`,
        );
      }
      txns.importInfos.set(key, normalized);
    }

    // Rehydrate top-level transactions
    for (const [key, txData] of Object.entries(topItemsRaw)) {
      const tx = Transaction.fromData(txData);
      if (tx.id !== key) {
        throw new Error(
          `Transaction dictionary key "${key}" does not match transaction ID "${tx.id}"`,
        );
      }
      if (tx.parentId != null) {
        throw new Error(`Top-level transaction ${tx.id} cannot reference parent ${tx.parentId}`);
      }
      txns.topItemsById.set(key, tx);
    }

    // Build allItemsById and uniqueContentHashes from flattened transactions
    const allFlat = flattenTransactions(txns.topItemsById.values());
    for (const tx of allFlat) {
      if (!txns.accountInfos.has(tx.accountId)) {
        throw new Error(`AccountInfo not found for transaction ${tx.id}: ${tx.accountId}`);
      }
      if (!txns.importInfos.has(tx.importId)) {
        throw new Error(`ImportInfo not found for transaction ${tx.id}: ${tx.importId}`);
      }
      txns.allItemsById.set(tx.id, tx);
      const existing = txns.uniqueContentHashes.get(tx.contentHash) ?? [];
      existing.push(tx.id);
      txns.uniqueContentHashes.set(tx.contentHash, existing);
    }

    // Restore edits
    if (data.edits) {
      for (const editData of normalizeEmbeddedEdits(data.edits)) {
        txns.edits.add(editData);
      }
    }

    return txns;
  }

  // -----------------------------------------------------------------------
  // Lookups
  // -----------------------------------------------------------------------

  /** Get the account info for the given account ID. Throws if not found. */
  getAccountInfo(accountId: string): AccountInfo {
    const info = this.accountInfos.get(accountId);
    if (!info) {
      throw new Error(`AccountInfo not found for id: ${accountId}`);
    }
    return info;
  }

  /** Get the import info for the given import ID. Throws if not found. */
  getImportInfo(importId: string): ImportInfo {
    const info = this.importInfos.get(importId);
    if (!info) {
      throw new Error(`ImportInfo not found for id: ${importId}`);
    }
    return info;
  }

  /** Check whether a content hash exists in the collection. */
  hasContentHash(hash: string): boolean {
    return this.uniqueContentHashes.has(hash);
  }

  /** Check whether an import info exists in the collection. */
  hasImportInfo(id: string): boolean {
    return this.importInfos.has(id);
  }

  /** Check whether an account info exists in the collection. */
  hasAccountInfo(id: string): boolean {
    return this.accountInfos.has(id);
  }

  /** Get a transaction by ID from the full (flattened) collection. */
  getTransaction(id: string): Transaction | undefined {
    return this.allItemsById.get(id);
  }

  // -----------------------------------------------------------------------
  // Iterables
  // -----------------------------------------------------------------------

  /** Iterable of top-level transactions (excludes children). */
  get topLevelTransactions(): Iterable<Transaction> {
    return this.topItemsById.values();
  }

  /** The number of top-level transactions (excludes children). */
  get topLevelTransactionCount(): number {
    return this.topItemsById.size;
  }

  /** The total number of transactions (including children). */
  get allTransactionCount(): number {
    return this.allItemsById.size;
  }

  /** Iterable of all transactions including children (flattened). */
  get allParentChildTransactions(): Iterable<Transaction> {
    return this.allItemsById.values();
  }

  // -----------------------------------------------------------------------
  // Add
  // -----------------------------------------------------------------------

  /**
   * Add a new transaction to the collection.
   *
   * @param tx             - The transaction to add.
   * @param accountInfo    - Account metadata.
   * @param importInfo     - Import metadata.
   * @param allowDuplicate - When `true`, allows adding transactions with
   *                         duplicate content hashes (used during import).
   * @returns `true` if the transaction was added, `false` if it was a
   *          duplicate and `allowDuplicate` is `false`.
   */
  addNew(
    tx: Transaction,
    accountInfo: AccountInfo,
    importInfo: ImportInfo,
    allowDuplicate: boolean,
  ): boolean {
    if (!allowDuplicate && this.uniqueContentHashes.has(tx.contentHash)) {
      return false;
    }

    if (tx.accountId !== accountInfo.id) {
      throw new Error(
        `Transaction account ID "${tx.accountId}" does not match AccountInfo ID "${accountInfo.id}"`,
      );
    }
    if (tx.importId !== importInfo.id) {
      throw new Error(
        `Transaction import ID "${tx.importId}" does not match ImportInfo ID "${importInfo.id}"`,
      );
    }

    const flattened = flattenTransactions([tx]);
    this.assertTransactionIdsAvailable(flattened);

    this.topItemsById.set(tx.id, tx);

    for (const flatTx of flattened) {
      this.allItemsById.set(flatTx.id, flatTx);
    }

    if (!this.accountInfos.has(accountInfo.id)) {
      this.accountInfos.set(accountInfo.id, accountInfo);
    }
    if (!this.importInfos.has(importInfo.id)) {
      this.importInfos.set(importInfo.id, importInfo);
    }

    this.updateStateForFlattenedTransactions(flattened);

    return true;
  }

  // -----------------------------------------------------------------------
  // Merge
  // -----------------------------------------------------------------------

  /**
   * Merge another {@link Transactions} collection into this one.
   *
   * - Enriches existing transactions from different-format duplicates
   *   via {@link Transaction.combineAttributes}.
   * - Adds new transactions (no content hash match).
   * - Updates account/import metadata.
   * - Optionally runs matching.
   *
   * @param other          - The collection to merge in.
   * @param enableMatching - When `true`, run matching after merge.
   */
  merge(other: Transactions, enableMatching: boolean): void {
    const emptyStringArray: string[] = [];

    // Enrich existing transactions from different-format duplicates
    for (const otherTx of other.allParentChildTransactions) {
      if (otherTx.combinedToId != null) {
        continue;
      }

      const thisIds = this.uniqueContentHashes.get(otherTx.contentHash) ?? emptyStringArray;
      const otherIds = other.uniqueContentHashes.get(otherTx.contentHash) ?? emptyStringArray;

      if (thisIds.length !== 1 || otherIds.length !== 1) {
        continue;
      }

      const tx = this.allItemsById.get(thisIds[0]!);
      if (!tx) {
        continue;
      }

      const thisFormat = this.getImportInfo(tx.importId).format;
      const otherFormat = other.getImportInfo(otherTx.importId).format;

      if (
        tx.combinedFromId != null ||
        thisFormat === otherFormat ||
        thisFormat == null ||
        otherFormat == null ||
        tx.accountId !== otherTx.accountId
      ) {
        continue;
      }

      tx.combineAttributes(otherTx);
    }

    // Add new transactions
    const newItems: Transaction[] = [];
    for (const tx of other.topLevelTransactions) {
      if (!this.uniqueContentHashes.has(tx.contentHash)) {
        newItems.push(tx.clone());
      }
    }

    const allParentChildNewItems = flattenTransactions(newItems);
    this.assertTransactionIdsAvailable(allParentChildNewItems);

    for (const newTx of newItems) {
      this.topItemsById.set(newTx.id, newTx);
    }
    for (const tx of allParentChildNewItems) {
      this.allItemsById.set(tx.id, tx);
    }

    this.updateStateForFlattenedTransactionsFromSource(allParentChildNewItems, other);
    this.edits.merge(other.edits);

    if (enableMatching) {
      this.matchTransactions();
    }
  }

  // -----------------------------------------------------------------------
  // Matching
  // -----------------------------------------------------------------------

  /** Run all matching algorithms (parent-child + inter-account). */
  matchTransactions(): void {
    this.matchParentChild();

    // Cross-institute transfer matching
    this.matchInterAccountTransfer((tx) =>
      intersects(tx.transactionReason, NetInterAccount | TransactionReason.OtherCredit),
    );

    // Inter-institute transfer matching
    this.matchInterAccountTransfer(
      (tx) => tx.entityName.toLowerCase().includes('transfer'),
      (unmatchedTx, candidateTx) => {
        const unmatchedInstitute = this.getAccountInfo(unmatchedTx.accountId).instituteName;
        const candidateInstitute = this.getAccountInfo(candidateTx.accountId).instituteName;
        return (
          unmatchedInstitute != null &&
          unmatchedInstitute.toLowerCase() === candidateInstitute?.toLowerCase() &&
          candidateTx.entityName.toLowerCase().includes('transfer')
        );
      },
      0.5,
      false,
    );
  }

  /**
   * Match inter-account transfers using a two-pass algorithm.
   *
   * First pass identifies unmatched transfers using `unmatchedFilter`.
   * For each unmatched transfer, find candidates with opposite amount,
   * different account, within `dayTolerance` days, optionally filtered by
   * `matchedFilter` and name tags.
   *
   * @param unmatchedFilter      - Predicate selecting unmatched transfer candidates.
   * @param matchedFilter        - Optional secondary filter for candidate matches.
   * @param dayTolerance         - Number of days tolerance for date matching (default 3).
   * @param enableNameTagFilter  - Whether to check interAccountNameTags (default true).
   */
  matchInterAccountTransfer(
    unmatchedFilter: (tx: Transaction) => boolean,
    matchedFilter?: (unmatchedTx: Transaction, candidateTx: Transaction) => boolean,
    dayTolerance: number = 3,
    enableNameTagFilter: boolean = true,
  ): void {
    const txs = [...this.topLevelTransactions];

    // Find unmatched transfers
    const unmatchedTransfers = txs.filter(
      (tx) =>
        unmatchedFilter(tx) &&
        tx.relatedTransferId == null &&
        !this.getAccountInfo(tx.accountId).requiresParent,
    );

    const toleranceMs = dayTolerance * MS_PER_DAY;

    for (const unmatchedTx of unmatchedTransfers) {
      // The candidate list was captured before matching began. A transaction
      // paired earlier in this loop is no longer unmatched and must not be
      // considered again as the left-hand side of another relationship.
      if (unmatchedTx.relatedTransferId != null) continue;

      const searchAmount = unmatchedTx.amount * -1;
      const unmatchedDate = parseDate(unmatchedTx.transactionDate);
      const searchDateMin = unmatchedDate.getTime() - toleranceMs;
      const searchDateMax = unmatchedDate.getTime() + toleranceMs;
      const nameTags = this.getAccountInfo(unmatchedTx.accountId).interAccountNameTags ?? [];

      // Find candidates sorted by date proximity
      const candidates = txs
        .filter((ctx) => {
          if (ctx.amount !== searchAmount) return false;
          if (ctx.accountId === unmatchedTx.accountId) return false;
          if (matchedFilter && !matchedFilter(unmatchedTx, ctx)) return false;

          const ctxDate = parseDate(ctx.transactionDate);
          if (ctxDate.getTime() < searchDateMin || ctxDate.getTime() > searchDateMax) return false;

          if (ctx.relatedTransferId != null) return false;
          if (this.getAccountInfo(ctx.accountId).requiresParent) return false;

          if (enableNameTagFilter && nameTags.length > 0) {
            const entityLower = ctx.entityName.toLowerCase();
            if (!nameTags.some((nt) => entityLower.includes(nt.toLowerCase()))) {
              return false;
            }
          }

          return true;
        })
        .sort((a, b) => {
          const aDiff = Math.abs(parseDate(a.transactionDate).getTime() - unmatchedDate.getTime());
          const bDiff = Math.abs(parseDate(b.transactionDate).getTime() - unmatchedDate.getTime());
          return aDiff - bDiff;
        });

      const matchedTx = candidates[0];
      if (matchedTx) {
        unmatchedTx.matchInterAccount(matchedTx);
      }
    }
  }

  /**
   * Match child transactions to parents and handle incomplete parents.
   *
   * Ported from C# `Transactions.MatchParentChild()`.
   *
   * 1. Find all top-level transactions where `requiresParent` is true.
   * 2. Group by matcher (determined by account's instituteName + type).
   * 3. For each group, call `matcher.getParents()` to find parent-child pairs.
   * 4. Relate each parent-child pair.
   * 5. For each parent, call `completeParent`; if incomplete, delegate to
   *    `matcher.handleIncompleteParent()`.
   */
  matchParentChild(): void {
    // Find all top-level transactions requiring a parent, grouped by matcher
    const childrenByMatcher = new Map<ParentChildMatch, Transaction[]>();

    for (const tx of this.topLevelTransactions) {
      if (!tx.requiresParent || tx.parentId != null) continue;

      const matcher = this.getParentChildMatcher(tx);
      const arr = childrenByMatcher.get(matcher) ?? [];
      arr.push(tx);
      childrenByMatcher.set(matcher, arr);
    }

    const allParents = new Set<Transaction>();

    for (const [matcher, children] of childrenByMatcher) {
      const childParents = matcher.getParents(children, this);

      for (const { child, parent } of childParents) {
        this.relateParentChild(parent.id, child.id);
        allParents.add(parent);
      }
    }

    for (const parent of allParents) {
      this.completeParentWithMatcher(parent);
    }
  }

  /**
   * Complete a parent transaction. If the parent is incomplete, try to
   * handle the missing amount using the appropriate matcher.
   */
  private completeParentWithMatcher(parent: Transaction): void {
    const result = parent.completeParent();
    if (!result.isComplete) {
      const matcher = this.getParentChildMatcher(parent, true);
      if (matcher.handleIncompleteParent(parent, this, result.missingChildAmount)) {
        parent.completeParent();
      }
    }
  }

  /** Cache of parent-child matchers keyed by "instituteName|AccountType". */
  private parentChildMatchers = new Map<string, ParentChildMatch>();

  /** The shared generic matcher instance (used for handleIncompleteParent only). */
  private static readonly genericMatcher = new GenericTxParentChildMatcher();

  /**
   * Resolve the parent-child matcher for a transaction based on its account.
   *
   * @param tx                  - The transaction to get a matcher for.
   * @param allowGenericMatcher - When `true`, falls back to the generic matcher
   *                              instead of throwing for unknown account types.
   */
  private getParentChildMatcher(
    tx: Transaction,
    allowGenericMatcher: boolean = false,
  ): ParentChildMatch {
    const accountInfo = this.getAccountInfo(tx.accountId);
    const key = `${accountInfo.instituteName}|${AccountType[accountInfo.type]}`;

    let existing = this.parentChildMatchers.get(key);
    if (existing != null) {
      return existing;
    }

    switch (key) {
      case 'Amazon|OrderHistory':
        existing = new AmazonOrderMatcher(accountInfo);
        break;
      case 'Etsy|OrderHistory':
        existing = new EtsyOrderMatcher(accountInfo);
        break;
      default:
        if (!allowGenericMatcher) {
          throw new Error(`ParentChildMatcher for the key ${key} is not supported`);
        }
        return Transactions.genericMatcher;
    }

    this.parentChildMatchers.set(key, existing);
    return existing;
  }

  // -----------------------------------------------------------------------
  // Parent-child relation
  // -----------------------------------------------------------------------

  /**
   * Link a parent and child transaction.
   *
   * @param parentId - ID of the parent transaction.
   * @param childId  - ID of the child transaction.
   */
  relateParentChild(parentId: string, childId: string): void {
    const parent = this.allItemsById.get(parentId);
    const child = this.allItemsById.get(childId);
    if (!parent) throw new Error(`Parent transaction not found: ${parentId}`);
    if (!child) throw new Error(`Child transaction not found: ${childId}`);

    parent.addChild(child);
    if (this.topItemsById.has(childId)) {
      this.topItemsById.delete(childId);
    }
  }

  // -----------------------------------------------------------------------
  // Filter & Apply edits
  // -----------------------------------------------------------------------

  /**
   * Filter all transactions by the scope filters of an edit.
   * Filters are ANDed: a transaction must pass every scope filter.
   *
   * @param edit - The edit whose scope filters to apply.
   * @returns An array of matching transactions.
   */
  filterTransactions(edit: TransactionEditData): Transaction[] {
    let filtered = [...this.allParentChildTransactions];
    for (const scopeFilter of edit.scopeFilters) {
      filtered = filtered.filter((t) => Transactions.filterTransaction(scopeFilter, t));
    }
    return filtered;
  }

  /**
   * Evaluate a single scope filter against a transaction.
   *
   * @param scopeFilter - The filter to evaluate.
   * @param transaction - The transaction to test.
   * @returns `true` if the transaction matches the filter.
   */
  static filterTransaction(scopeFilter: ScopeFilter, transaction: Transaction): boolean {
    switch (scopeFilter.type) {
      case ScopeType.All:
        return true;
      case ScopeType.None:
        return false;
      case ScopeType.EntityName:
        return scopeFilter.parameters.some(
          (p) => transaction.entityName.toLowerCase() === p.toLowerCase(),
        );
      case ScopeType.EntityNameNormalized:
        return scopeFilter.parameters.some(
          (p) => (transaction.entityNameNormalized ?? '').toLowerCase() === p.toLowerCase(),
        );
      case ScopeType.TransactionId:
        return scopeFilter.parameters.some((p) => transaction.id === p);
      case ScopeType.EntityNameAnyTokens:
        return scopeFilter.parameters.some((p) =>
          transaction.entityNameTokens.some((t) => t.toLowerCase() === p.toLowerCase()),
        );
      case ScopeType.EntityNameAllTokens:
        return scopeFilter.parameters.every((p) =>
          transaction.entityNameTokens.some((t) => t.toLowerCase() === p.toLowerCase()),
        );
      case ScopeType.AccountId:
        return scopeFilter.parameters.some((p) => transaction.accountId === p);
      case ScopeType.TransactionReason:
        return scopeFilter.parameters.some(
          (p) => Number(p) === transaction.correctedTransactionReason,
        );
      case ScopeType.AmountRange: {
        const minVal = Number(scopeFilter.parameters[0]);
        const maxVal = Number(scopeFilter.parameters[1]);
        if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
          return false;
        }
        const isNegative =
          scopeFilter.parameters.length > 2 && scopeFilter.parameters[2]?.toLowerCase() === 'true';
        if (isNegative) {
          return (
            transaction.correctedAmount <= minVal * -1 && transaction.correctedAmount >= maxVal * -1
          );
        } else {
          return transaction.correctedAmount >= minVal && transaction.correctedAmount <= maxVal;
        }
      }
      default:
        throw new Error(`Unsupported ScopeType: ${scopeFilter.type}`);
    }
  }

  /**
   * Apply an edit to all matching transactions, adding it to the edits
   * collection.
   *
   * @param edit             - The edit to apply.
   * @param ignoreMissingIds - When `false`, throws if a TransactionId scope
   *                           filter did not match all IDs.
   * @returns The array of transactions that were modified.
   */
  apply(edit: TransactionEditData, ignoreMissingIds: boolean = true): Transaction[] {
    const filtered = this.prepareEdit(edit, ignoreMissingIds);

    // Validate duplicate IDs before mutating either the edit collection or
    // any transaction. This keeps rejected requests side-effect free.
    const proposedEdits = this.edits.clone();
    proposedEdits.add(edit);
    this.edits.add(edit);
    this.applyPreparedEdit(edit, filtered);
    return filtered;
  }

  /**
   * Apply multiple edits.
   *
   * @param editsToApply     - The edits collection to apply.
   * @param ignoreMissingIds - When `false`, throws if any TransactionId scope
   *                           filter did not match all IDs.
   * @returns All transactions that were modified across all edits.
   */
  applyEdits(editsToApply: TransactionEdits, ignoreMissingIds: boolean = true): Transaction[] {
    const proposedEdits = this.edits.clone();
    const prepared: Array<{ edit: TransactionEditData; filtered: Transaction[] }> = [];

    // Preflight the complete request before changing live state. A bad
    // target or conflicting duplicate therefore rejects the entire batch.
    for (const edit of editsToApply) {
      proposedEdits.add(edit);
      prepared.push({
        edit,
        filtered: this.prepareEdit(edit, ignoreMissingIds),
      });
    }

    const result: Transaction[] = [];
    for (const { edit, filtered } of prepared) {
      this.edits.add(edit);
      this.applyPreparedEdit(edit, filtered);
      result.push(...filtered);
    }
    return result;
  }

  /** Resolve and validate an edit without mutating transaction state. */
  private prepareEdit(edit: TransactionEditData, ignoreMissingIds: boolean): Transaction[] {
    if (!ignoreMissingIds) {
      for (const scopeFilter of edit.scopeFilters) {
        if (scopeFilter.type !== ScopeType.TransactionId) continue;

        // Validate identity independently from the other ANDed filters. An
        // existing transaction may legitimately fail a second condition; that
        // makes the edit a no-op, not a stale-target conflict.
        const targetIds = new Set(scopeFilter.parameters);
        const existingTargetCount = [...targetIds].filter((id) => this.allItemsById.has(id)).length;
        if (existingTargetCount !== targetIds.size) {
          throw new TransactionEditTargetError(targetIds.size, existingTargetCount);
        }
      }
    }
    return this.filterTransactions(edit);
  }

  /** Apply an edit after the complete request has passed preflight. */
  private applyPreparedEdit(edit: TransactionEditData, filtered: Transaction[]): void {
    for (const tx of filtered) {
      tx.applyEdit(edit);
    }

    if (edit.values?.amount != null) {
      this.refreshEditedParentCompleteness(filtered);
    }
  }

  /**
   * Recalculate parent/child completeness after effective amounts change.
   * Edits are applied to the entire scope first so a rule that updates a
   * parent and its children observes one consistent final state.
   */
  private refreshEditedParentCompleteness(editedTransactions: Transaction[]): void {
    const parents = new Map<string, Transaction>();

    for (const tx of editedTransactions) {
      if (tx.children != null && Object.keys(tx.children).length > 0) {
        parents.set(tx.id, tx);
      }
      if (tx.parentId != null) {
        const parent = this.allItemsById.get(tx.parentId);
        if (parent != null) parents.set(parent.id, parent);
      }
    }

    for (const parent of parents.values()) {
      parent.completeParent();
    }
  }

  // -----------------------------------------------------------------------
  // Convenience edit methods
  // -----------------------------------------------------------------------

  /**
   * Set the category for transactions matching the given scope filters.
   *
   * @param scopeFilters - Scope filters to target.
   * @param categoryPath - The category path to assign.
   * @returns The modified transactions.
   */
  setCategory(scopeFilters: ScopeFilter[], categoryPath: string[]): Transaction[] {
    const edit = new TransactionEdits(this.name).createEditCategory(scopeFilters, categoryPath);
    return this.apply(edit, false);
  }

  /**
   * Set the user-flagged state for transactions by ID.
   *
   * @param txIds - Transaction IDs to target.
   * @param flag  - The flag state.
   * @returns The modified transactions.
   */
  setIsUserFlagged(txIds: string[], flag: boolean): Transaction[] {
    const edit = new TransactionEdits(this.name).createEditIsUserFlagged(txIds, flag);
    return this.apply(edit, false);
  }

  /**
   * Set a note for transactions by ID.
   *
   * @param txIds - Transaction IDs to target.
   * @param note  - The note text.
   * @returns The modified transactions.
   */
  setNote(txIds: string[], note: string): Transaction[] {
    const edit = new TransactionEdits(this.name).createEditNote(txIds, note);
    return this.apply(edit, false);
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /**
   * Build a new view from the same imported records and a replacement rule set.
   * Identities, source values, hierarchy and transfer links are never rewritten.
   * Like statement rebuilds, scopes are resolved against the imported baseline;
   * later rules win when more than one rule changes the same field.
   */
  withReplayedEdits(edits: TransactionEdits): Transactions {
    const data = structuredClone(this.serialize());
    const clear = (tx: TransactionData): void => {
      tx.mergedEdit = null;
      tx.appliedEditIdsDescending = [];
      for (const child of Object.values(tx.children ?? {})) clear(child);
    };
    for (const tx of Object.values(data.topItems)) clear(tx);
    data.edits = [];
    const candidate = Transactions.fromData(data);
    for (const tx of candidate.allParentChildTransactions) {
      if (tx.children && Object.keys(tx.children).length > 0) tx.completeParent();
    }
    candidate.applyEdits(edits, true);
    return candidate;
  }

  /**
   * Serialize to a {@link TransactionsData} object suitable for JSON
   * persistence.
   */
  serialize(): TransactionsData {
    const topItems: Record<string, TransactionData> = {};
    for (const [key, tx] of this.topItemsById) {
      topItems[key] = tx.toData();
    }

    const accountInfos: Record<string, AccountInfo> = {};
    for (const [key, info] of this.accountInfos) {
      accountInfos[key] = info;
    }

    const importInfos: Record<string, ImportInfo> = {};
    for (const [key, info] of this.importInfos) {
      importInfos[key] = info;
    }

    const edits: TransactionEditData[] = [];
    for (const edit of this.edits) {
      edits.push(edit);
    }

    return {
      name: this.name,
      topItems,
      accountInfos,
      importInfos,
      edits,
    } satisfies TransactionsData;
  }

  // -----------------------------------------------------------------------
  // Edits accessors
  // -----------------------------------------------------------------------

  /** The number of edits in the collection. */
  get editsCount(): number {
    return this.edits.count;
  }

  /** Get a deep-cloned copy of the edits collection. */
  getClonedEdits(): TransactionEdits {
    return this.edits.clone();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Update content hash tracking for newly added flattened transactions.
   */
  private updateStateForFlattenedTransactions(transactions: Transaction[]): void {
    for (const tx of transactions) {
      const existing = this.uniqueContentHashes.get(tx.contentHash) ?? [];
      existing.push(tx.id);
      this.uniqueContentHashes.set(tx.contentHash, existing);
    }
  }

  /** Reject additions that would silently overwrite an indexed transaction. */
  private assertTransactionIdsAvailable(transactions: Transaction[]): void {
    for (const tx of transactions) {
      if (this.allItemsById.has(tx.id)) {
        throw new Error(`Transaction ID already exists in collection: ${tx.id}`);
      }
    }
  }

  /**
   * Update content hash tracking and copy account/import infos from a
   * source collection for newly added flattened transactions.
   */
  private updateStateForFlattenedTransactionsFromSource(
    transactions: Transaction[],
    source: Transactions,
  ): void {
    this.updateStateForFlattenedTransactions(transactions);

    // Collect unique account IDs and import IDs from the new transactions
    const accountIds = new Set(transactions.map((t) => t.accountId));
    const importIds = new Set(transactions.map((t) => t.importId));

    for (const aid of accountIds) {
      if (!this.accountInfos.has(aid)) {
        this.accountInfos.set(aid, source.getAccountInfo(aid));
      }
    }
    for (const iid of importIds) {
      if (!this.importInfos.has(iid)) {
        this.importInfos.set(iid, source.getImportInfo(iid));
      }
    }
  }
}
