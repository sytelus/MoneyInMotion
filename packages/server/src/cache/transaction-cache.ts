/**
 * In-memory cache of the active transaction snapshot.
 *
 * The server is the only supported writer, so the cache changes only through
 * explicit edits and rebuilds. Administrators who change statement files on
 * disk can use the maintenance rebuild in Settings.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  Transactions,
  Transaction,
  TransactionEdits,
  migrateEditTargets,
  type TransactionEditData,
  type AccountInfo,
} from '@moneyinmotion/core';
import { FileRepository } from '../storage/file-repository.js';
import { InvalidAccountConfigError } from '../storage/account-config-repository.js';
import { TransactionsStorage } from '../storage/transactions-storage.js';
import { TransactionEditsStorage } from '../storage/transaction-edits-storage.js';
import { getStatementParser } from '../parsers/statement/index.js';
import { FileLocation } from '../storage/file-location.js';
import { writeTextFileAtomically } from '../storage/atomic-file.js';
import { StoredDataError } from '../storage/stored-data-error.js';
import {
  prepareRuleChanges,
  snapshotRevision,
  RuleConflictError,
  type RuleChange,
} from './rule-management.js';

export interface SnapshotBuildResult {
  /** True only when every statement parsed and the new snapshot was saved. */
  committed: boolean;
  previousTransactionCount: number;
  newTransactions: number;
  totalTransactions: number;
  importedFiles: string[];
  failedFiles: Array<{ path: string; error: string }>;
  appliedEdits: number;
  /** Exact-ID rule targets retargeted after their transaction ID changed. */
  migratedEditTargets: number;
  /** Missing/ambiguous exact-ID targets retained for manual investigation. */
  unresolvedEditTargets: number;
}

// ---------------------------------------------------------------------------
// TransactionCache
// ---------------------------------------------------------------------------

export class TransactionCache {
  private transactions: Transactions | null = null;
  /** Serializes edit and rebuild mutations to prevent lost updates. */
  private mutationPromise: Promise<void> = Promise.resolve();

  private readonly transactionsStorage = new TransactionsStorage();
  private readonly editsStorage = new TransactionEditsStorage();

  constructor(private readonly repo: FileRepository) {}

  /** Maintenance drains earlier edits/rebuilds before copying or replacing disk state. */
  async whenIdle(): Promise<void> {
    await this.mutationPromise;
  }

  /** Discard old references after a validated restore; never rebuild or rewrite restored bytes. */
  invalidate(): void {
    this.transactions = null;
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
   * Add new rules. Resubmitting a saved rule unchanged is a no-op; reusing its
   * ID with different content, or targeting a missing transaction, is a conflict.
   */
  async applyEdits(edits: TransactionEditData[]): Promise<{ affectedTransactionsCount: number }> {
    return this.enqueueMutation(async () => {
      const current = await this.getTransactions();
      const saved = current.getClonedEdits();
      const added = new Map<string, TransactionEditData>();
      for (const edit of edits) {
        const existing = added.get(edit.id) ?? saved.get(edit.id);
        if (existing == null) added.set(edit.id, edit);
        else if (!isDeepStrictEqual(existing, edit)) {
          throw new RuleConflictError(
            `Rule "${edit.id}" already exists with different content. Refresh and try again.`,
          );
        }
      }
      if (added.size === 0) return { affectedTransactionsCount: 0 };
      const changes = [...added.values()].map((next) => ({ previous: null, next }));
      const { candidate, result } = prepareRuleChanges(current, changes);
      await this.saveSnapshot(candidate);
      this.transactions = candidate;
      return { affectedTransactionsCount: result.affectedTransactionsCount };
    });
  }

  /** Preview and commit share the same validation and replay logic. */
  async manageRules(changes: RuleChange[], preview: boolean, expectedRevision?: string) {
    return this.enqueueMutation(async () => {
      const current = await this.getTransactions();
      const revision = snapshotRevision(current);
      if (expectedRevision && revision !== expectedRevision) {
        throw new RuleConflictError(
          'Transactions or rules changed after this preview. Cancel and preview again before saving.',
        );
      }
      const { candidate, result } = prepareRuleChanges(current, changes);
      if (!preview) {
        await this.saveSnapshot(candidate);
        this.transactions = candidate;
      }
      return { revision, ...result };
    });
  }

  /** Persist a candidate inside the mutation queue; never save a stale cache reference. */
  private async saveSnapshot(transactions: Transactions): Promise<void> {
    const targets = [this.repo.latestMergedPath, this.repo.latestMergedEditsPath];
    const previous = targets.map((file) =>
      fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null,
    );
    try {
      this.transactionsStorage.save(this.repo.latestMergedPath, transactions);
      this.editsStorage.save(this.repo.latestMergedEditsPath, transactions.getClonedEdits());
    } catch (error) {
      // Especially important for deleted rules: a failed second write must
      // not leave an old aggregate that resurrects them on the next restart.
      for (let index = 0; index < targets.length; index++) {
        const file = targets[index]!;
        const content = previous[index]!;
        if (content == null) {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        } else if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content)
          writeTextFileAtomically(file, content);
      }
      throw error;
    }
  }

  /** Run one state-changing operation at a time, and keep the queue usable. */
  private async enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutationPromise.then(operation);
    this.mutationPromise = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
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
    return this.enqueueMutation(() => this.rebuildFromStatementsInternal());
  }

  private async rebuildFromStatementsInternal(): Promise<SnapshotBuildResult> {
    const previous = await this.getTransactions();
    const previousTransactionCount = previous.allTransactionCount;
    const notCommitted = (
      importedFiles: string[],
      failedFiles: SnapshotBuildResult['failedFiles'],
    ): SnapshotBuildResult => ({
      committed: false,
      previousTransactionCount,
      newTransactions: 0,
      totalTransactions: previousTransactionCount,
      importedFiles,
      failedFiles,
      appliedEdits: 0,
      migratedEditTargets: 0,
      unresolvedEditTargets: 0,
    });

    let statementLocations: FileLocation[];
    try {
      statementLocations = this.repo
        .getStatementLocations()
        .sort((left, right) => left.portableAddress.localeCompare(right.portableAddress));
    } catch (err) {
      const failedPath = err instanceof InvalidAccountConfigError ? err.portablePath : 'Statements';
      return notCommitted([], [{ path: failedPath, error: errorMessage(err) }]);
    }

    // Parse every file even after a failure, so one rebuild names them all.
    const txns = new Transactions('LatestMerged');
    const importedFiles: string[] = [];
    const failedFiles: SnapshotBuildResult['failedFiles'] = [];
    for (const loc of statementLocations) {
      try {
        txns.merge(this.loadStatementFile(loc), false);
        importedFiles.push(loc.portableAddress);
      } catch (err) {
        const error = errorMessage(err).split(loc.address).join(loc.portableAddress);
        console.error(`Error parsing statement "${loc.portableAddress}": ${error}`);
        failedFiles.push({ path: loc.portableAddress, error });
      }
    }
    if (failedFiles.length > 0) return notCommitted(importedFiles, failedFiles);

    txns.matchTransactions();
    const edits = previous.getClonedEdits();
    edits.merge(this.loadAdditionalEdits(edits));
    const editMigration = migrateEditTargets(edits, previous, txns);
    txns.applyEdits(editMigration.edits, true);

    // Persist the candidate before swapping it into live memory. A disk error
    // therefore leaves callers on the last known-good in-memory snapshot.
    await this.saveSnapshot(txns);
    this.transactions = txns;
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

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Load transactions from disk (LatestMerged.json + edits).
   */
  private async loadFromDisk(): Promise<void> {
    const candidate = this.repo.latestMergedExists()
      ? this.transactionsStorage.load(this.repo.latestMergedPath)
      : new Transactions('LatestMerged');

    // Rules are durable data in their own right, even before a snapshot exists.
    // Validate the separate aggregate on every load, and apply only new rules:
    // replaying embedded rules against already-corrected values changes scopes.
    candidate.applyEdits(this.loadAdditionalEdits(candidate.getClonedEdits()), true);
    // Publish only after all disk inputs validate, so a failed read cannot leave
    // a partially loaded cache that appears successful on the next request.
    this.transactions = candidate;
  }

  /** Parse one statement file into its own collection; throws on any problem. */
  private loadStatementFile(loc: FileLocation): Transactions {
    const { accountConfig, importInfo, contentType } = loc;
    if (accountConfig == null || importInfo == null) {
      throw new Error('Statement location is missing its account or import metadata.');
    }
    if (contentType == null) {
      throw new Error(
        `File extension "${path.extname(loc.address)}" is not supported. Export the statement as CSV, JSON or IIF.`,
      );
    }
    const accountInfo: AccountInfo = accountConfig.accountInfo;
    const parser = getStatementParser(
      accountInfo.instituteName,
      accountInfo.type,
      fs.readFileSync(loc.address, 'utf-8'),
      contentType,
    );
    const txns = new Transactions(loc.portableAddress);
    for (const importedValues of parser.getTransactionImportedValues()) {
      const tx = Transaction.create(
        importInfo.id,
        accountInfo.id,
        accountInfo.requiresParent,
        importedValues,
      );
      // Identical rows inside one statement are separate real purchases (two
      // $2.16 bus fares on one day), so keep them all. Duplicates are only
      // removed later, when overlapping files are merged (as the C# app did).
      txns.addNew(tx, accountInfo, importInfo, true);
    }
    return txns;
  }

  /** Merge histories by rule identity, independent of JSON object key order. */
  private loadAdditionalEdits(embedded: TransactionEdits): TransactionEdits {
    const missing = new TransactionEdits('saved-rules');
    if (!this.repo.latestMergedEditsExists()) return missing;
    const saved = this.editsStorage.load(this.repo.latestMergedEditsPath);
    for (const edit of saved) {
      const existing = embedded.get(edit.id);
      if (existing == null) missing.add(edit);
      else if (!isDeepStrictEqual(existing, edit)) {
        throw new StoredDataError(
          `Conflicting saved rule "${edit.id}" in snapshot and rules file.`,
        );
      }
    }
    return missing;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
