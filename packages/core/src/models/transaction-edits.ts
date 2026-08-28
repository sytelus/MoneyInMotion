/**
 * Collection of transaction edits, ported from C# `TransactionEdits`.
 *
 * Provides indexed storage, factory helpers for common edit patterns, and
 * iteration. Edits are stored in insertion order and can be looked up by ID.
 *
 * @module
 */

import type { TransactionEditData, ScopeFilter } from './transaction-edit.js';
import {
    ScopeType,
    createScopeFilter,
    editValue,
    voidedEditValue,
} from './transaction-edit.js';
import { createAuditInfo } from './audit-info.js';
import { createUUID } from '../utils/hash.js';

// ---------------------------------------------------------------------------
// TransactionEdits class
// ---------------------------------------------------------------------------

/**
 * An ordered, indexed collection of {@link TransactionEditData} objects.
 *
 * Mirrors the C# `TransactionEdits` class. The collection is iterable and
 * provides factory helpers for common edit operations (flag, category, note).
 */
export class TransactionEdits {
    private edits: TransactionEditData[] = [];
    private editsById: Map<string, TransactionEditData> = new Map();

    /** Optional source identifier for edits created by this collection. */
    readonly sourceId: string;

    constructor(sourceId?: string) {
        this.sourceId = sourceId ?? 'default';
    }

    // -----------------------------------------------------------------------
    // Core CRUD
    // -----------------------------------------------------------------------

    /** Add an edit to the collection. */
    add(edit: TransactionEditData): void {
        const existing = this.editsById.get(edit.id);
        if (existing != null) {
            if (JSON.stringify(existing) !== JSON.stringify(edit)) {
                throw new Error(
                    `Conflicting TransactionEditData detected for duplicate id "${edit.id}"`,
                );
            }
            return;
        }

        this.edits.push(edit);
        this.editsById.set(edit.id, edit);
    }

    /** Retrieve an edit by its ID, or `undefined` if not found. */
    get(id: string): TransactionEditData | undefined {
        return this.editsById.get(id);
    }

    /** The number of edits in the collection. */
    get count(): number {
        return this.edits.length;
    }

    // -----------------------------------------------------------------------
    // Factory helpers
    // -----------------------------------------------------------------------

    /**
     * Create and add an edit that sets the user-flagged state for one or more
     * transactions.
     *
     * @param txIds        - Transaction IDs to target.
     * @param isUserFlagged - `true` to flag, `false` to unflag, `null` to void.
     * @returns The newly created edit.
     */
    createEditIsUserFlagged(
        txIds: string[],
        isUserFlagged: boolean | null,
    ): TransactionEditData {
        const scopeFilter = createScopeFilter(ScopeType.TransactionId, txIds);
        const edit: TransactionEditData = {
            id: createUUID(),
            auditInfo: createAuditInfo(),
            scopeFilters: [scopeFilter],
            values: {
                isFlagged: isUserFlagged != null
                    ? editValue(isUserFlagged)
                    : voidedEditValue<boolean>(),
            },
            sourceId: this.sourceId,
        };
        this.add(edit);
        return edit;
    }

    /**
     * Create and add an edit that sets the category path for transactions
     * matching the given scope filters.
     *
     * @param scopeFilters - Scope filters determining which transactions to target.
     * @param categoryPath - The category path segments, or `null` to void.
     * @returns The newly created edit.
     */
    createEditCategory(
        scopeFilters: ScopeFilter[],
        categoryPath: string[] | null,
    ): TransactionEditData {
        const edit: TransactionEditData = {
            id: createUUID(),
            auditInfo: createAuditInfo(),
            scopeFilters,
            values: {
                categoryPath: categoryPath != null
                    ? editValue(categoryPath)
                    : voidedEditValue<string[]>(),
            },
            sourceId: this.sourceId,
        };
        this.add(edit);
        return edit;
    }

    /**
     * Create and add an edit that sets a note for one or more transactions.
     *
     * @param txIds - Transaction IDs to target.
     * @param note  - The note text, or `null` to void.
     * @returns The newly created edit.
     */
    createEditNote(
        txIds: string[],
        note: string | null,
    ): TransactionEditData {
        const scopeFilter = createScopeFilter(ScopeType.TransactionId, txIds);
        const edit: TransactionEditData = {
            id: createUUID(),
            auditInfo: createAuditInfo(),
            scopeFilters: [scopeFilter],
            values: {
                note: note != null
                    ? editValue(note)
                    : voidedEditValue<string>(),
            },
            sourceId: this.sourceId,
        };
        this.add(edit);
        return edit;
    }

    // -----------------------------------------------------------------------
    // Merge / clone
    // -----------------------------------------------------------------------

    /**
     * Merge all edits from `other` into this collection (deep-copied).
     */
    merge(other: TransactionEdits): void {
        for (const edit of other) {
            const cloned = JSON.parse(JSON.stringify(edit)) as TransactionEditData;
            this.add(cloned);
        }
    }

    /**
     * Serialize to a plain object suitable for JSON persistence.
     *
     * @returns An object with `name` and `edits` fields.
     */
    serialize(): { name: string; edits: TransactionEditData[] } {
        return { name: this.sourceId, edits: [...this.edits] };
    }

    /** Deep-copy this collection via JSON round-trip. */
    clone(): TransactionEdits {
        const copy = new TransactionEdits(this.sourceId);
        for (const edit of this.edits) {
            const cloned = JSON.parse(JSON.stringify(edit)) as TransactionEditData;
            copy.add(cloned);
        }
        return copy;
    }

    // -----------------------------------------------------------------------
    // Iteration
    // -----------------------------------------------------------------------

    *[Symbol.iterator](): Generator<TransactionEditData> {
        yield* this.edits;
    }
}
