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
import { isSupportedAccountType, normalizeInstituteName } from './account-config.js';
import { parseDate } from '../utils/date-utils.js';
import { containsWordStart } from '../utils/string-utils.js';
import { deserializeDictionary } from '../utils/collection-utils.js';
import type { ParentChildMatch } from '../matching/parent-child-match.js';
import { GenericTxParentChildMatcher } from '../matching/generic-tx-matcher.js';
import { AmazonOrderMatcher } from '../matching/amazon-order-matcher.js';
import { EtsyOrderMatcher } from '../matching/etsy-order-matcher.js';

const MS_PER_DAY = 86_400_000;

/**
 * Days allowed between the two sides of an account payment. A bank debit can
 * post several days after the card credit, for example from a Friday to the
 * Tuesday after a Monday holiday.
 */
const PAYMENT_DAY_TOLERANCE = 5;

/** An exact-ID edit referenced transactions that are absent from a snapshot. */
export class TransactionEditTargetError extends Error {
  constructor(expected: number, actual: number) {
    super(
      `Edit targeted transactions with ${expected} IDs but only ${actual} were found in this collection`,
    );
    this.name = 'TransactionEditTargetError';
  }
}

export { deserializeDictionary };

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

/** Validate persisted account metadata. */
function normalizeAccountInfo(value: unknown): AccountInfo {
  const raw = asRecord(value, 'AccountInfo');
  const { type, requiresParent, interAccountNameTags: tags } = raw;

  if (typeof type !== 'number' || !isSupportedAccountType(type)) {
    throw new Error(`AccountInfo.type is not a supported AccountType: ${String(type)}`);
  }
  if (typeof requiresParent !== 'boolean') {
    throw new Error('AccountInfo.requiresParent must be a boolean');
  }
  if (tags != null && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string'))) {
    throw new Error('AccountInfo.interAccountNameTags must be an array of strings or null');
  }

  return {
    id: requiredString(raw.id, 'AccountInfo.id'),
    instituteName: requiredString(raw.instituteName, 'AccountInfo.instituteName'),
    title: optionalString(raw.title, 'AccountInfo.title'),
    type,
    requiresParent,
    interAccountNameTags: tags == null ? null : [...(tags as string[])],
  };
}

/** Validate persisted import metadata. */
function normalizeImportInfo(value: unknown): ImportInfo {
  const raw = asRecord(value, 'ImportInfo');
  const { updateDate, createDate, format } = raw;
  const result: ImportInfo = {
    id: requiredString(raw.id, 'ImportInfo.id'),
    portableAddress: requiredString(raw.portableAddress, 'ImportInfo.portableAddress'),
    contentHash: requiredString(raw.contentHash, 'ImportInfo.contentHash'),
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

/**
 * Compile a scope filter into a predicate over imported values. Name
 * conditions are case-insensitive; amount ranges are magnitudes, with the
 * optional third parameter `"true"` selecting outgoing (negative) amounts.
 */
function scopePredicate(scopeFilter: ScopeFilter): (tx: Transaction) => boolean {
  const lowered = () => new Set(scopeFilter.parameters.map((p) => p.toLowerCase()));
  switch (scopeFilter.type) {
    case ScopeType.All:
      return () => true;
    case ScopeType.None:
      return () => false;
    case ScopeType.TransactionId: {
      const ids = new Set(scopeFilter.parameters);
      return (tx) => ids.has(tx.id);
    }
    case ScopeType.EntityName: {
      const names = lowered();
      return (tx) => names.has(tx.entityName.toLowerCase());
    }
    case ScopeType.EntityNameNormalized: {
      const names = lowered();
      return (tx) => names.has((tx.entityNameNormalized ?? '').toLowerCase());
    }
    case ScopeType.EntityNameAnyTokens: {
      const words = lowered();
      return (tx) => tx.entityNameTokens.some((token) => words.has(token.toLowerCase()));
    }
    case ScopeType.EntityNameAllTokens: {
      const words = lowered();
      return (tx) => {
        const tokens = new Set(tx.entityNameTokens.map((token) => token.toLowerCase()));
        return [...words].every((word) => tokens.has(word));
      };
    }
    case ScopeType.AccountId: {
      const accountIds = new Set(scopeFilter.parameters);
      return (tx) => accountIds.has(tx.accountId);
    }
    case ScopeType.TransactionReason: {
      const reasons = new Set(scopeFilter.parameters.map(Number));
      return (tx) => reasons.has(tx.transactionReason);
    }
    case ScopeType.AmountRange: {
      const minimum = Number(scopeFilter.parameters[0]);
      const maximum = Number(scopeFilter.parameters[1]);
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return () => false;
      const outgoing = scopeFilter.parameters[2]?.toLowerCase() === 'true';
      return outgoing
        ? (tx) => tx.amount <= -minimum && tx.amount >= -maximum
        : (tx) => tx.amount >= minimum && tx.amount <= maximum;
    }
    default:
      throw new Error(`Unsupported ScopeType: ${String(scopeFilter.type)}`);
  }
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
  /** Built on demand by {@link scopeCandidates}; reset when records are added. */
  private nameIndex?: {
    imported: Map<string, Transaction[]>;
    normalized: Map<string, Transaction[]>;
  };

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
   * Dictionary fields are plain `Record<string, T>` objects.
   */
  static fromData(data: TransactionsData): Transactions {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new Error('Transactions name must be a non-empty string');
    }
    const txns = new Transactions(data.name);

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

  /** Run order matching, then the two transfer-matching passes. */
  matchTransactions(): void {
    this.matchParentChild();

    // Account payments, transfers and credits, recognized by name tags.
    this.matchInterAccountTransfer(
      (tx) => intersects(tx.transactionReason, NetInterAccount | TransactionReason.OtherCredit),
      undefined,
      PAYMENT_DAY_TOLERANCE,
    );

    // "Transfer" rows between two accounts at the same institution.
    const institute = (tx: Transaction) =>
      this.getAccountInfo(tx.accountId).instituteName.toLowerCase();
    const mentionsTransfer = (tx: Transaction) => tx.entityName.toLowerCase().includes('transfer');
    this.matchInterAccountTransfer(
      mentionsTransfer,
      (unmatchedTx, candidateTx) =>
        institute(unmatchedTx) === institute(candidateTx) && mentionsTransfer(candidateTx),
      0.5,
      false,
    );
  }

  /**
   * Pair unmatched transfers with their counterpart in another account.
   *
   * Each top-level record selected by `unmatchedFilter` is paired with the
   * closest-dated record that has exactly the opposite imported amount, is in
   * a different account, lies within `dayTolerance` days, passes
   * `matchedFilter`, and (when `enableNameTagFilter` and the first account
   * has tags) has a name containing one of the first account's
   * `interAccountNameTags` at the start of a word (so "chase" doesn't match
   * "purchase"). Order-history records and records already paired never take
   * part. Ties keep collection order.
   */
  matchInterAccountTransfer(
    unmatchedFilter: (tx: Transaction) => boolean,
    matchedFilter?: (unmatchedTx: Transaction, candidateTx: Transaction) => boolean,
    dayTolerance: number = PAYMENT_DAY_TOLERANCE,
    enableNameTagFilter: boolean = true,
  ): void {
    const eligible = [...this.topLevelTransactions].filter(
      (tx) => !this.getAccountInfo(tx.accountId).requiresParent,
    );
    // Index by amount: the exact-opposite-amount condition is the most
    // selective, and scanning every record per transfer is quadratic.
    const byAmount = new Map<number, Transaction[]>();
    const timeOf = new Map<Transaction, number>();
    for (const tx of eligible) {
      const sameAmount = byAmount.get(tx.amount);
      if (sameAmount) sameAmount.push(tx);
      else byAmount.set(tx.amount, [tx]);
      timeOf.set(tx, parseDate(tx.transactionDate).getTime());
    }
    const unmatchedTransfers = eligible.filter(
      (tx) => tx.relatedTransferId == null && unmatchedFilter(tx),
    );
    const toleranceMs = dayTolerance * MS_PER_DAY;

    for (const unmatchedTx of unmatchedTransfers) {
      // Paired earlier in this loop as somebody's counterpart.
      if (unmatchedTx.relatedTransferId != null) continue;

      const unmatchedTime = timeOf.get(unmatchedTx)!;
      const nameTags = enableNameTagFilter
        ? (this.getAccountInfo(unmatchedTx.accountId).interAccountNameTags ?? [])
        : [];

      let best: Transaction | undefined;
      let bestDistance = Infinity;
      for (const candidate of byAmount.get(-unmatchedTx.amount) ?? []) {
        const distance = Math.abs(timeOf.get(candidate)! - unmatchedTime);
        if (
          distance > toleranceMs ||
          distance >= bestDistance ||
          candidate.accountId === unmatchedTx.accountId ||
          candidate.relatedTransferId != null ||
          (matchedFilter && !matchedFilter(unmatchedTx, candidate))
        ) {
          continue;
        }
        if (nameTags.length > 0) {
          if (!nameTags.some((tag) => containsWordStart(candidate.entityName, tag))) continue;
        }
        best = candidate;
        bestDistance = distance;
      }
      if (best) unmatchedTx.matchInterAccount(best);
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

  /** Order matchers by order-history account ID (each uses its own account's tags). */
  private orderMatchers = new Map<string, ParentChildMatch>();

  /** Stateless matcher that only adds small adjustment children. */
  private static readonly genericMatcher = new GenericTxParentChildMatcher();

  /**
   * Resolve the parent-child matcher for a transaction's account: the Amazon
   * or Etsy order matcher for an order-history account, otherwise the generic
   * matcher when `allowGenericMatcher` is set.
   */
  private getParentChildMatcher(
    tx: Transaction,
    allowGenericMatcher: boolean = false,
  ): ParentChildMatch {
    const accountInfo = this.getAccountInfo(tx.accountId);
    let matcher = this.orderMatchers.get(accountInfo.id);
    if (matcher != null) return matcher;

    const institution = normalizeInstituteName(accountInfo.instituteName);
    if (accountInfo.type === AccountType.OrderHistory && institution === 'amazon') {
      matcher = new AmazonOrderMatcher(accountInfo);
    } else if (accountInfo.type === AccountType.OrderHistory && institution === 'etsy') {
      matcher = new EtsyOrderMatcher(accountInfo);
    } else if (allowGenericMatcher) {
      return Transactions.genericMatcher;
    } else {
      throw new Error(
        `No parent matcher for ${accountInfo.instituteName} ${AccountType[accountInfo.type]} account ${accountInfo.id}`,
      );
    }
    this.orderMatchers.set(accountInfo.id, matcher);
    return matcher;
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
   * Transactions (parents and children) that pass every scope filter of an
   * edit. Conditions test imported values, never earlier corrections, so a
   * rule matches the same records whatever other rules exist.
   */
  filterTransactions(edit: TransactionEditData): Transaction[] {
    const predicates = edit.scopeFilters.map(scopePredicate);
    const result: Transaction[] = [];
    for (const tx of this.scopeCandidates(edit.scopeFilters)) {
      if (predicates.every((matches) => matches(tx))) result.push(tx);
    }
    return result;
  }

  /**
   * A superset of the records an edit can match. Replay runs every rule over
   * the whole graph, so exact-ID and exact-name rules (the common kinds) look
   * their records up instead of scanning every transaction per rule.
   */
  private scopeCandidates(scopeFilters: readonly ScopeFilter[]): Iterable<Transaction> {
    const idScope = scopeFilters.find((scope) => scope.type === ScopeType.TransactionId);
    if (idScope) {
      return [...new Set(idScope.parameters)].flatMap((id) => this.allItemsById.get(id) ?? []);
    }
    const nameScope = scopeFilters.find(
      (scope) =>
        scope.type === ScopeType.EntityName || scope.type === ScopeType.EntityNameNormalized,
    );
    if (nameScope) {
      this.nameIndex ??= this.buildNameIndex();
      const index =
        nameScope.type === ScopeType.EntityName
          ? this.nameIndex.imported
          : this.nameIndex.normalized;
      const names = new Set(nameScope.parameters.map((name) => name.toLowerCase()));
      return [...names].flatMap((name) => index.get(name) ?? []);
    }
    return this.allItemsById.values();
  }

  /** Lowercased imported names → records. Edits never change imported names. */
  private buildNameIndex(): NonNullable<Transactions['nameIndex']> {
    const imported = new Map<string, Transaction[]>();
    const normalized = new Map<string, Transaction[]>();
    const add = (index: Map<string, Transaction[]>, key: string, tx: Transaction) => {
      const list = index.get(key);
      if (list) list.push(tx);
      else index.set(key, [tx]);
    };
    for (const tx of this.allItemsById.values()) {
      add(imported, tx.entityName.toLowerCase(), tx);
      add(normalized, (tx.entityNameNormalized ?? '').toLowerCase(), tx);
    }
    return { imported, normalized };
  }

  /** Whether one scope filter matches a transaction's imported values. */
  static filterTransaction(scopeFilter: ScopeFilter, transaction: Transaction): boolean {
    return scopePredicate(scopeFilter)(transaction);
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
    // Throws on a conflicting duplicate ID before any transaction changes.
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
    this.nameIndex = undefined;
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
