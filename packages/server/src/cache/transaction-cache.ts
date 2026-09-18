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
import { isDeepStrictEqual } from 'node:util';
import {
  Transactions,
  Transaction,
  TransactionEdits,
  migrateLegacyEditTargets,
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
  /**
   * Serializes concurrent `save()` calls so that two overlapping writes
   * cannot interleave and corrupt the merged JSON.
   */
  private savePromise: Promise<void> = Promise.resolve();
  /** Serializes edit and rebuild mutations to prevent lost updates. */
  private mutationPromise: Promise<void> = Promise.resolve();

  private readonly transactionsStorage = new TransactionsStorage();
  private readonly editsStorage = new TransactionEditsStorage();

  constructor(private readonly repo: FileRepository) {}

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
   * Apply an array of edits to the cached transactions.
   *
   * @returns The number of transactions affected.
   */
  async applyEdits(edits: TransactionEditData[]): Promise<{ affectedTransactionsCount: number }> {
    return this.enqueueMutation(async () => {
      const current = await this.getTransactions();
      const preflight = Transactions.fromData(structuredClone(current.serialize()));
      const batch = new TransactionEdits('web-api');
      for (const edit of edits) batch.add(edit);

      // Keep the old API's strict target validation, but use the same imported
      // baseline and precedence as rule management and statement rebuilds.
      preflight.applyEdits(batch, false);
      const previousEdits = current.getClonedEdits();
      const changes = [...batch]
        .filter((edit) => !previousEdits.get(edit.id))
        .map((next) => ({ previous: null, next }));
      if (!changes.length) return { affectedTransactionsCount: 0 };
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
      if (expectedRevision && snapshotRevision(current) !== expectedRevision) {
        throw new RuleConflictError(
          'Transactions or rules changed after this preview. Cancel and preview again before saving.',
        );
      }
      const { candidate, result } = prepareRuleChanges(current, changes);
      if (!preview) {
        await this.saveSnapshot(candidate);
        this.transactions = candidate;
      }
      return result;
    });
  }

  /**
   * Persist the current cached transactions to disk.
   *
   * Concurrent calls are serialized via {@link savePromise} so that two
   * simultaneous save requests (for example an edit auto-save arriving
   * while an automatic rebuild is committing) cannot interleave and corrupt
   * the JSON files.
   *
   */
  async save(): Promise<void> {
    if (this.transactions == null) return;
    return this.saveSnapshot(this.transactions);
  }

  /** Queue a two-file snapshot write for a specific immutable candidate. */
  private async saveSnapshot(transactions: Transactions): Promise<void> {
    const next = this.savePromise.then(() => {
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
    });
    // Swallow errors on the chained promise so that one failed save
    // does not permanently block every subsequent save; the original
    // caller still sees the rejection via `next`.
    this.savePromise = next.catch(() => undefined);
    return next;
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
    const txns = new Transactions('LatestMerged');
    let statementLocations;
    try {
      statementLocations = this.repo
        .getStatementLocations()
        .sort((left, right) => left.portableAddress.localeCompare(right.portableAddress));
    } catch (err) {
      return {
        committed: false,
        previousTransactionCount,
        newTransactions: 0,
        totalTransactions: previousTransactionCount,
        importedFiles: [],
        failedFiles: [
          {
            path: err instanceof InvalidAccountConfigError ? err.portablePath : 'Statements',
            error: err instanceof Error ? err.message : String(err),
          },
        ],
        appliedEdits: 0,
        migratedEditTargets: 0,
        unresolvedEditTargets: 0,
      };
    }
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
    const edits = previous.getClonedEdits();
    edits.merge(this.loadAdditionalEdits(edits));
    const editMigration = migrateLegacyEditTargets(edits, previous, txns);
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

  /**
   * Parse a single statement file into a Transactions collection.
   *
   * Returns an object with either `transactions` (on success) or `error`
   * (on parse failure). Callers use the error field to surface per-file
   * failures to the UI instead of dropping them silently.
   */
  private loadStatementFile(loc: FileLocation): {
    transactions: Transactions | null;
    error: string | null;
  } {
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
      const rawMessage = err instanceof Error ? err.message : String(err);
      const message = rawMessage.split(loc.address).join(loc.portableAddress);
      console.error(`Error parsing statement "${loc.portableAddress}": ${message}`);
      return { transactions: null, error: message };
    }
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
        throw new Error(`Conflicting saved rule "${edit.id}" in snapshot and rules file.`);
      }
    }
    return missing;
  }
}
