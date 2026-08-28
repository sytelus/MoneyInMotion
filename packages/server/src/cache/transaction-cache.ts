/**
 * In-memory cache of loaded Transactions with file watcher.
 *
 * Ported from C# TransactionCache. Lazily loads transactions from the
 * LatestMerged.json file, watches the Merged directory for changes,
 * and invalidates the cache when external modifications are detected.
 *
 * @module
 */

import * as fs from 'node:fs';
import type { FSWatcher } from 'chokidar';
import { watch } from 'chokidar';
import {
    Transactions,
    Transaction,
    migrateLegacyEditTargets,
    type TransactionEditData,
    type AccountInfo,
} from '@moneyinmotion/core';
import type { ServerConfig } from '../config.js';
import { FileRepository } from '../storage/file-repository.js';
import { TransactionsStorage } from '../storage/transactions-storage.js';
import { TransactionEditsStorage } from '../storage/transaction-edits-storage.js';
import { getStatementParser } from '../parsers/statement/index.js';
import { FileLocation } from '../storage/file-location.js';

export interface SnapshotBuildResult {
    /** True only when every statement parsed and the new snapshot was saved. */
    committed: boolean;
    previousTransactionCount: number;
    newTransactions: number;
    totalTransactions: number;
    importedFiles: string[];
    failedFiles: Array<{ path: string; error: string }>;
    appliedEdits: number;
    /** Legacy exact-ID edit targets safely retargeted to rebuilt identities. */
    migratedEditTargets: number;
    /** Missing/ambiguous exact-ID targets retained for manual investigation. */
    unresolvedEditTargets: number;
}

// ---------------------------------------------------------------------------
// TransactionCache
// ---------------------------------------------------------------------------

export class TransactionCache {
    private transactions: Transactions | null = null;
    private watcher: FSWatcher | null = null;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private isSaving = false;
    private lastSaveTime = 0;
    /**
     * Serializes concurrent `save()` calls so that two overlapping writes
     * cannot interleave and corrupt the merged JSON.
     */
    private savePromise: Promise<void> = Promise.resolve();

    private readonly transactionsStorage = new TransactionsStorage();
    private readonly editsStorage = new TransactionEditsStorage();

    constructor(
        private readonly config: ServerConfig,
        private readonly repo: FileRepository,
    ) {
        this.startWatcher();
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Get the cached Transactions instance.
     * Lazy-loads from disk on first call.
     */
    async getTransactions(): Promise<Transactions> {
        if (this.transactions == null) {
            await this.loadFromDisk();
        }
        return this.transactions!;
    }

    /**
     * Invalidate the cached transactions, forcing a reload on next access.
     */
    invalidate(): void {
        if (this.debounceTimer != null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.transactions = null;
    }

    /**
     * Apply an array of edits to the cached transactions.
     *
     * @returns The number of transactions affected.
     */
    async applyEdits(
        edits: TransactionEditData[],
    ): Promise<{ affectedTransactionsCount: number }> {
        const txns = await this.getTransactions();
        let affectedTransactionsCount = 0;

        for (const edit of edits) {
            const affected = txns.apply(edit, false);
            affectedTransactionsCount += affected.length;
        }

        // Auto-save after edits (both merged and edits)
        await this.save(true, true);

        return { affectedTransactionsCount };
    }

    /**
     * Persist the current cached transactions to disk.
     *
     * Concurrent calls are serialized via {@link savePromise} so that two
     * simultaneous save requests (for example an edit auto-save arriving
     * while an automatic rebuild is committing) cannot interleave and corrupt
     * the JSON files.
     *
     * @param saveMerged - Whether to save the LatestMerged.json file.
     * @param saveEdits  - Whether to save the LatestMergedEdits.json file.
     */
    async save(saveMerged: boolean, saveEdits: boolean): Promise<void> {
        const next = this.savePromise.then(() =>
            this.saveInternal(saveMerged, saveEdits),
        );
        // Swallow errors on the chained promise so that one failed save
        // does not permanently block every subsequent save; the original
        // caller still sees the rejection via `next`.
        this.savePromise = next.catch(() => undefined);
        return next;
    }

    private async saveInternal(saveMerged: boolean, saveEdits: boolean): Promise<void> {
        if (this.transactions == null) {
            return;
        }

        this.isSaving = true;
        this.lastSaveTime = Date.now();

        try {
            if (saveMerged) {
                this.transactionsStorage.save(
                    this.repo.latestMergedPath,
                    this.transactions,
                );
            }

            if (saveEdits) {
                const edits = this.transactions.getClonedEdits();
                this.editsStorage.save(this.repo.latestMergedEditsPath, edits);
            }
        } finally {
            this.lastSaveTime = Date.now();
            this.isSaving = false;
        }
    }

    /**
     * Deterministically rebuild the financial snapshot from all statements.
     *
     * A rebuild is assembled off to the side and becomes authoritative only
     * after every source file parses successfully. This avoids replacing a
     * good snapshot with a partial one. The saved edit aggregate (or embedded
     * edits from the previous snapshot) is replayed before an atomic save.
     */
    async rebuildFromStatements(): Promise<SnapshotBuildResult> {
        const previous = await this.getTransactions();
        const previousTransactionCount = previous.allTransactionCount;
        const txns = new Transactions('LatestMerged');
        const statementLocations = this.repo
            .getStatementLocations()
            .sort((left, right) =>
                left.portableAddress.localeCompare(right.portableAddress),
            );
        const importedFiles: string[] = [];
        const failedFiles: Array<{ path: string; error: string }> = [];

        for (const loc of statementLocations) {
            if (loc.importInfo == null) continue;
            const parseResult = this.loadStatementFile(loc);
            if (parseResult.error != null) {
                failedFiles.push({
                    path: loc.portableAddress,
                    error: parseResult.error,
                });
                continue;
            }

            if (parseResult.transactions == null) continue;

            txns.merge(parseResult.transactions, false);
            importedFiles.push(loc.portableAddress);
        }

        if (failedFiles.length > 0) {
            return {
                committed: false,
                previousTransactionCount,
                newTransactions: 0,
                totalTransactions: previousTransactionCount,
                importedFiles,
                failedFiles,
                appliedEdits: 0,
                migratedEditTargets: 0,
                unresolvedEditTargets: 0,
            };
        }

        txns.matchTransactions();
        const edits = this.repo.latestMergedEditsExists()
            ? this.editsStorage.load(this.repo.latestMergedEditsPath)
            : previous.getClonedEdits();
        const editMigration = migrateLegacyEditTargets(edits, previous, txns);
        txns.applyEdits(editMigration.edits, true);

        // Swap only after parse, merge, matching, and replay all succeed.
        this.transactions = txns;
        await this.save(true, true);
        const totalTransactions = txns.allTransactionCount;
        return {
            committed: true,
            previousTransactionCount,
            newTransactions: totalTransactions - previousTransactionCount,
            totalTransactions,
            importedFiles,
            failedFiles,
            appliedEdits: editMigration.edits.count,
            migratedEditTargets: editMigration.migratedTargetCount,
            unresolvedEditTargets: editMigration.unresolvedTargetCount,
        };
    }

    /** Backward-compatible name used by the older scan endpoint. */
    async scanAndImport(): Promise<SnapshotBuildResult> {
        return this.rebuildFromStatements();
    }

    /**
     * Stop the file watcher and clean up resources.
     */
    dispose(): void {
        if (this.debounceTimer != null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.watcher != null) {
            void this.watcher.close();
            this.watcher = null;
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Load transactions from disk (LatestMerged.json + edits).
     */
    private async loadFromDisk(): Promise<void> {
        if (this.repo.latestMergedExists()) {
            this.transactions = this.transactionsStorage.load(
                this.repo.latestMergedPath,
            );

            // A materialized snapshot already carries merged values and its
            // edit history. Overlay the separate aggregate only for an older
            // snapshot that did not embed edits.
            if (
                this.transactions.editsCount === 0
                && this.repo.latestMergedEditsExists()
            ) {
                const edits = this.editsStorage.load(
                    this.repo.latestMergedEditsPath,
                );
                this.transactions.applyEdits(edits, true);
            }
        } else {
            // No merged file yet -- start with empty collection
            this.transactions = new Transactions('LatestMerged');
        }
    }

    /**
     * Parse a single statement file into a Transactions collection.
     *
     * Returns an object with either `transactions` (on success) or `error`
     * (on parse failure). Callers use the error field to surface per-file
     * failures to the UI instead of dropping them silently.
     */
    private loadStatementFile(
        loc: FileLocation,
    ): { transactions: Transactions | null; error: string | null } {
        if (loc.accountConfig == null || loc.importInfo == null) {
            return { transactions: null, error: null };
        }

        try {
            const content = fs.readFileSync(loc.address, 'utf-8');
            const parser = getStatementParser(
                loc.accountConfig.accountInfo.instituteName,
                loc.accountConfig.accountInfo.type,
                content,
                loc.contentType,
            );

            const importedValuesList = parser.getTransactionImportedValues();
            const accountInfo: AccountInfo = loc.accountConfig.accountInfo;

            const txns = new Transactions(loc.portableAddress);
            for (const iv of importedValuesList) {
                const tx = Transaction.create(
                    loc.importInfo.id,
                    accountInfo.id,
                    accountInfo.requiresParent,
                    iv,
                );
                txns.addNew(tx, accountInfo, loc.importInfo, false);
            }
            return { transactions: txns, error: null };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Error parsing statement file ${loc.address}:`, err);
            return { transactions: null, error: message };
        }
    }

    /**
     * Start chokidar watcher on the Merged directory.
     * Debounces invalidation by 2 seconds and ignores self-triggered changes.
     */
    private startWatcher(): void {
        if (!fs.existsSync(this.config.mergedDir)) {
            return;
        }

        try {
            this.watcher = watch(this.config.mergedDir, {
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 1000,
                    pollInterval: 200,
                },
            });

            this.watcher.on('change', () => {
                this.onFileChange();
            });

            this.watcher.on('add', () => {
                this.onFileChange();
            });
        } catch (err) {
            console.error('Failed to start file watcher:', err);
        }
    }

    /**
     * Handle a file-change event from the watcher.
     * Ignores changes triggered by our own save operations.
     */
    private onFileChange(): void {
        // Ignore self-triggered changes
        if (this.isSaving) return;
        if (Date.now() - this.lastSaveTime < 5000) return;

        // Debounce -- invalidate after 2 seconds of quiet
        if (this.debounceTimer != null) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.invalidate();
            this.debounceTimer = null;
        }, 2000);
    }
}
