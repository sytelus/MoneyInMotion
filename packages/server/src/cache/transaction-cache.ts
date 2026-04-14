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
    type TransactionEditData,
    type AccountInfo,
} from '@moneyinmotion/core';
import type { ServerConfig } from '../config.js';
import { FileRepository } from '../storage/file-repository.js';
import { TransactionsStorage } from '../storage/transactions-storage.js';
import { TransactionEditsStorage } from '../storage/transaction-edits-storage.js';
import { getStatementParser } from '../parsers/statement/index.js';
import { FileLocation } from '../storage/file-location.js';

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
     * simultaneous save requests (e.g. an auto-save from applyEdits and a
     * user-triggered save) cannot interleave and corrupt the JSON files.
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
     * Scan the Statements directory for new statement files, parse them,
     * and merge into the current transactions.
     *
     * Mirrors C# AppState.MergeNewStatements. Parse errors on individual
     * files do not abort the scan; they are collected and returned in
     * `failedFiles` so the UI can surface them instead of silently
     * dropping data.
     *
     * @returns Statistics about the import.
     */
    async scanAndImport(): Promise<{
        newTransactions: number;
        totalTransactions: number;
        importedFiles: string[];
        failedFiles: Array<{ path: string; error: string }>;
    }> {
        const txns = await this.getTransactions();
        const statementLocations = this.repo.getStatementLocations();
        const importedFiles: string[] = [];
        const failedFiles: Array<{ path: string; error: string }> = [];
        let isAnyMerged = false;

        const oldCount = txns.allTransactionCount;

        for (const loc of statementLocations) {
            if (loc.importInfo == null) continue;

            // Skip already-imported files
            if (txns.hasImportInfo(loc.importInfo.id)) {
                continue;
            }

            // Parse statement file into a Transactions object
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
            isAnyMerged = true;
            importedFiles.push(loc.portableAddress);
        }

        if (isAnyMerged) {
            txns.matchTransactions();
        }

        // Apply saved edits if they exist
        if (isAnyMerged && this.repo.latestMergedEditsExists()) {
            const edits = this.editsStorage.load(this.repo.latestMergedEditsPath);
            txns.applyEdits(edits, true);
        }

        const totalTransactions = txns.allTransactionCount;

        return {
            newTransactions: totalTransactions - oldCount,
            totalTransactions,
            importedFiles,
            failedFiles,
        };
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

            // Apply saved edits if they exist
            if (this.repo.latestMergedEditsExists()) {
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
