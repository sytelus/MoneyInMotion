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
        const result: Record<string, T> = {};
        for (const item of data) {
            if (item != null && typeof item === 'object' && 'Key' in item && 'Value' in item) {
                result[(item as { Key: string; Value: T }).Key] = (item as { Key: string; Value: T }).Value;
            }
        }
        return result;
    }

    // Normal object format
    if (typeof data === 'object') {
        return data as Record<string, T>;
    }

    return {};
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
    edits: TransactionEditData[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a transaction and its children into a flat list.
 */
function flattenTransactions(transactions: Iterable<Transaction>): Transaction[] {
    const result: Transaction[] = [];
    for (const tx of transactions) {
        result.push(tx);
        if (tx.children) {
            const childTxs = Object.values(tx.children).map((cd) => Transaction.fromData(cd));
            result.push(...flattenTransactions(childTxs));
        }
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
        const txns = new Transactions(data.name);

        // Deserialize dictionaries (handle legacy format)
        const topItemsRaw = deserializeDictionary<TransactionData>(data.topItems);
        const accountInfosRaw = deserializeDictionary<AccountInfo>(data.accountInfos);
        const importInfosRaw = deserializeDictionary<ImportInfo>(data.importInfos);

        // Populate account and import infos first (needed by transactions)
        for (const [key, value] of Object.entries(accountInfosRaw)) {
            txns.accountInfos.set(key, value);
        }
        for (const [key, value] of Object.entries(importInfosRaw)) {
            txns.importInfos.set(key, value);
        }

        // Rehydrate top-level transactions
        for (const [key, txData] of Object.entries(topItemsRaw)) {
            const tx = Transaction.fromData(txData);
            txns.topItemsById.set(key, tx);
        }

        // Build allItemsById and uniqueContentHashes from flattened transactions
        const allFlat = flattenTransactions(txns.topItemsById.values());
        for (const tx of allFlat) {
            txns.allItemsById.set(tx.id, tx);
            const existing = txns.uniqueContentHashes.get(tx.contentHash) ?? [];
            existing.push(tx.id);
            txns.uniqueContentHashes.set(tx.contentHash, existing);
        }

        // Restore edits
        if (data.edits) {
            for (const editData of data.edits) {
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

        this.topItemsById.set(tx.id, tx);

        const flattened = flattenTransactions([tx]);
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

        for (const newTx of newItems) {
            this.topItemsById.set(newTx.id, newTx);
        }

        const allParentChildNewItems = flattenTransactions(newItems);
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
        this.matchInterAccountTransfer(
            (tx) => intersects(
                tx.transactionReason,
                NetInterAccount | TransactionReason.OtherCredit,
            ),
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
            if (!tx.requiresParent) continue;

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
    private getParentChildMatcher(tx: Transaction, allowGenericMatcher: boolean = false): ParentChildMatch {
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
                    transaction.entityNameTokens.some(
                        (t) => t.toLowerCase() === p.toLowerCase(),
                    ),
                );
            case ScopeType.EntityNameAllTokens:
                return scopeFilter.parameters.every((p) =>
                    transaction.entityNameTokens.some(
                        (t) => t.toLowerCase() === p.toLowerCase(),
                    ),
                );
            case ScopeType.AccountId:
                return scopeFilter.parameters.some((p) => transaction.accountId === p);
            case ScopeType.TransactionReason:
                return scopeFilter.parameters.some(
                    (p) => Number(p) === transaction.transactionReason,
                );
            case ScopeType.AmountRange: {
                const minVal = parseFloat(scopeFilter.parameters[0]!);
                const maxVal = parseFloat(scopeFilter.parameters[1]!);
                if (Number.isNaN(minVal) || Number.isNaN(maxVal)) {
                    return false;
                }
                const isNegative = scopeFilter.parameters.length > 2 &&
                    scopeFilter.parameters[2]?.toLowerCase() === 'true';
                if (isNegative) {
                    return transaction.amount <= minVal * -1 && transaction.amount >= maxVal * -1;
                } else {
                    return transaction.amount >= minVal && transaction.amount <= maxVal;
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
        this.edits.add(edit);
        return this.applyInternal(edit, ignoreMissingIds);
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
        const result: Transaction[] = [];
        for (const edit of editsToApply) {
            result.push(...this.apply(edit, ignoreMissingIds));
        }
        return result;
    }

    /**
     * Internal apply that assumes the edit has already been added to
     * `this.edits`.
     */
    private applyInternal(edit: TransactionEditData, ignoreMissingIds: boolean = false): Transaction[] {
        const filtered = this.filterTransactions(edit);
        for (const tx of filtered) {
            tx.applyEdit(edit);
        }

        if (
            !ignoreMissingIds &&
            edit.scopeFilters.length === 1 &&
            edit.scopeFilters[0]!.type === ScopeType.TransactionId &&
            filtered.length !== edit.scopeFilters[0]!.parameters.length
        ) {
            throw new Error(
                `Edit targeted transactions with ${edit.scopeFilters[0]!.parameters.length} IDs but only ${filtered.length} were found in this collection`,
            );
        }

        return filtered;
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
        const edit = this.edits.createEditCategory(scopeFilters, categoryPath);
        return this.applyInternal(edit);
    }

    /**
     * Set the user-flagged state for transactions by ID.
     *
     * @param txIds - Transaction IDs to target.
     * @param flag  - The flag state.
     * @returns The modified transactions.
     */
    setIsUserFlagged(txIds: string[], flag: boolean): Transaction[] {
        const edit = this.edits.createEditIsUserFlagged(txIds, flag);
        return this.applyInternal(edit);
    }

    /**
     * Set a note for transactions by ID.
     *
     * @param txIds - Transaction IDs to target.
     * @param note  - The note text.
     * @returns The modified transactions.
     */
    setNote(txIds: string[], note: string): Transaction[] {
        const edit = this.edits.createEditNote(txIds, note);
        return this.applyInternal(edit);
    }

    // -----------------------------------------------------------------------
    // Serialization
    // -----------------------------------------------------------------------

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
        };
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
