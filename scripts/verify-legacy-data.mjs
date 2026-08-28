#!/usr/bin/env node

/**
 * Read-only compatibility check against a legacy MoneyAI data directory.
 *
 * The source tree is never modified. Statements and saved edits are copied to
 * an isolated temporary MoneyInMotion user directory, rebuilt there, and the
 * resulting metrics are compared with the legacy LatestMerged snapshot.
 *
 * Usage:
 *   npm run build
 *   node scripts/verify-legacy-data.mjs /mnt/d/Dropbox/MoneyAI
 *
 * Add `--keep-temp` to retain the isolated copy for manual investigation.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileRepository } from '../packages/server/dist/storage/file-repository.js';
import { TransactionsStorage } from '../packages/server/dist/storage/transactions-storage.js';
import { TransactionEditsStorage } from '../packages/server/dist/storage/transaction-edits-storage.js';
import { TransactionCache } from '../packages/server/dist/cache/transaction-cache.js';

const args = process.argv.slice(2);
const keepTemp = args.includes('--keep-temp');
const positional = args.filter((arg) => !arg.startsWith('--'));
const legacyRoot = path.resolve(positional[0] ?? '');

if (!positional[0]) {
    console.error('Usage: node scripts/verify-legacy-data.mjs <legacy-root> [--keep-temp]');
    process.exit(2);
}

const sourceStatements = path.join(legacyRoot, 'Statements');
const sourceMerged = path.join(legacyRoot, 'Merged');
const sourceSnapshot = path.join(sourceMerged, 'LatestMerged.json');
const sourceEdits = path.join(sourceMerged, 'LatestMergedEdits.json');

for (const requiredPath of [sourceStatements, sourceSnapshot, sourceEdits]) {
    if (!fs.existsSync(requiredPath)) {
        console.error(`Required legacy input does not exist: ${requiredPath}`);
        process.exit(2);
    }
}

function summarize(transactions) {
    const all = [...transactions.allParentChildTransactions];
    const topLevel = [...transactions.topLevelTransactions];
    const accountBreakdown = {};
    const topLevelAccountBreakdown = {};
    const accountAmountBreakdown = {};
    const topLevelAccountAmountBreakdown = {};
    for (const transaction of all) {
        accountBreakdown[transaction.accountId] =
            (accountBreakdown[transaction.accountId] ?? 0) + 1;
        accountAmountBreakdown[transaction.accountId] =
            (accountAmountBreakdown[transaction.accountId] ?? 0)
            + transaction.correctedAmount;
    }
    for (const transaction of topLevel) {
        topLevelAccountBreakdown[transaction.accountId] =
            (topLevelAccountBreakdown[transaction.accountId] ?? 0) + 1;
        topLevelAccountAmountBreakdown[transaction.accountId] =
            (topLevelAccountAmountBreakdown[transaction.accountId] ?? 0)
            + transaction.correctedAmount;
    }
    const dates = all
        .map((transaction) => transaction.correctedTransactionDate)
        .filter(Boolean)
        .sort();
    const amountTotal = all.reduce(
        (sum, transaction) => sum + transaction.correctedAmount,
        0,
    );
    const topLevelAmountTotal = topLevel.reduce(
        (sum, transaction) => sum + transaction.correctedAmount,
        0,
    );

    return {
        topLevelTransactions: transactions.topLevelTransactionCount,
        allTransactions: transactions.allTransactionCount,
        accounts: new Set(all.map((transaction) => transaction.accountId)).size,
        accountBreakdown: Object.fromEntries(
            Object.entries(accountBreakdown).sort(([left], [right]) =>
                left.localeCompare(right),
            ),
        ),
        topLevelAccountBreakdown: Object.fromEntries(
            Object.entries(topLevelAccountBreakdown).sort(([left], [right]) =>
                left.localeCompare(right),
            ),
        ),
        accountAmountBreakdown: Object.fromEntries(
            Object.entries(accountAmountBreakdown)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([accountId, amount]) => [
                    accountId,
                    Math.round(amount * 100) / 100,
                ]),
        ),
        topLevelAccountAmountBreakdown: Object.fromEntries(
            Object.entries(topLevelAccountAmountBreakdown)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([accountId, amount]) => [
                    accountId,
                    Math.round(amount * 100) / 100,
                ]),
        ),
        embeddedEdits: transactions.editsCount,
        firstTransactionDate: dates[0] ?? null,
        lastTransactionDate: dates.at(-1) ?? null,
        allTransactionAmountTotal: Math.round(amountTotal * 100) / 100,
        topLevelAmountTotal: Math.round(topLevelAmountTotal * 100) / 100,
    };
}

function summarizeExactIdTargets(edits, transactions) {
    let total = 0;
    let resolved = 0;
    for (const edit of edits) {
        for (const scopeFilter of edit.scopeFilters) {
            if (scopeFilter.type !== 2) continue;
            for (const targetId of scopeFilter.parameters) {
                total += 1;
                if (transactions.getTransaction(targetId) != null) {
                    resolved += 1;
                }
            }
        }
    }
    return {
        total,
        resolved,
        unresolved: total - resolved,
    };
}

const verificationRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'moneyinmotion-legacy-verification-'),
);
const userDataPath = path.join(verificationRoot, 'shitals');
const statementsDir = path.join(userDataPath, 'Statements');
const mergedDir = path.join(userDataPath, 'Merged');
const stagingDir = path.join(userDataPath, 'staging');
let cache;

try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.mkdirSync(statementsDir, { recursive: true });
    fs.mkdirSync(mergedDir, { recursive: true });
    fs.mkdirSync(stagingDir, { recursive: true });
    // Include the last materialized snapshot so the production upgrade path
    // can safely retarget legacy exact-ID edit scopes whose parser-generated
    // IDs changed. The candidate rebuild still uses only copied statements.
    fs.copyFileSync(sourceSnapshot, path.join(mergedDir, 'LatestMerged.json'));
    fs.copyFileSync(sourceEdits, path.join(mergedDir, 'LatestMergedEdits.json'));

    const legacySnapshot = new TransactionsStorage().load(sourceSnapshot);
    const legacyEdits = new TransactionEditsStorage().load(sourceEdits);

    // Rebuild the same source generation as the saved snapshot. The supplied
    // Statements tree contains later exports (through 2016), while the legacy
    // snapshot ends in 2015. Import metadata stores only a basename, so pair
    // each basename with the account observed on its legacy transactions.
    const accountByImportId = new Map();
    for (const transaction of legacySnapshot.allParentChildTransactions) {
        accountByImportId.set(transaction.importId, transaction.accountId);
    }
    const wantedSources = new Set(
        Object.values(legacySnapshot.serialize().importInfos)
            .map((info) => {
                const accountId = accountByImportId.get(info.id);
                return accountId == null
                    ? null
                    : `${accountId}|${path.basename(info.portableAddress).toLowerCase()}`;
            })
            .filter(Boolean),
    );
    const sourceRepository = new FileRepository(legacyRoot);
    const selectedLocations = sourceRepository
        .getStatementLocations()
        .filter((location) => wantedSources.has(
            `${location.accountConfig.accountInfo.id}|${path.basename(location.portableAddress).toLowerCase()}`,
        ));

    // Copy all account configs so account discovery remains representative,
    // then copy only the exact statement generation represented above.
    const copyAccountConfigs = (sourceDir) => {
        for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
            const sourcePath = path.join(sourceDir, entry.name);
            if (entry.isDirectory()) {
                copyAccountConfigs(sourcePath);
            } else if (entry.name === 'AccountConfig.json') {
                const destination = path.join(
                    statementsDir,
                    path.relative(sourceStatements, sourcePath),
                );
                fs.mkdirSync(path.dirname(destination), { recursive: true });
                fs.copyFileSync(sourcePath, destination);
            }
        }
    };
    copyAccountConfigs(sourceStatements);
    for (const location of selectedLocations) {
        const destination = path.join(
            statementsDir,
            path.relative(sourceStatements, location.address),
        );
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(location.address, destination);
    }
    const legacy = {
        ...summarize(legacySnapshot),
        separateEdits: legacyEdits.count,
        exactIdEditTargets: summarizeExactIdTargets(
            legacyEdits,
            legacySnapshot,
        ),
    };

    const config = {
        port: 3001,
        dataRoot: verificationRoot,
        username: 'shitals',
        userDataPath,
        statementsDir,
        mergedDir,
        stagingDir,
    };
    cache = new TransactionCache(config, new FileRepository(userDataPath));
    const rebuild = await cache.rebuildFromStatements();
    const rebuiltSnapshot = await cache.getTransactions();
    const inMemoryRebuilt = summarize(rebuiltSnapshot);
    // A graph can look correct in memory while a stale copied child object is
    // written beneath its parent. Reload the committed artifact so parity is
    // always based on what a restarted production server would actually see.
    const persistedSnapshot = new TransactionsStorage().load(
        path.join(mergedDir, 'LatestMerged.json'),
    );
    const persistedRebuilt = summarize(persistedSnapshot);
    const persistedEdits = new TransactionEditsStorage().load(
        path.join(mergedDir, 'LatestMergedEdits.json'),
    );
    const rebuilt = persistedRebuilt;

    const report = {
        source: legacyRoot,
        sourceWasReadOnly: true,
        temporaryUserDataPath: userDataPath,
        legacy,
        equivalentSourceSelection: {
            legacyStatementSources: wantedSources.size,
            matchedStatementFiles: selectedLocations.length,
            unmatchedLegacySources: wantedSources.size - selectedLocations.length,
        },
        rebuild: {
            ...rebuild,
            importedFileCount: rebuild.importedFiles.length,
            importedFiles: undefined,
        },
        rebuilt,
        rebuiltExactIdEditTargets: summarizeExactIdTargets(
            persistedEdits,
            persistedSnapshot,
        ),
        persistenceRoundTrip: {
            topLevelTransactionCountDelta:
                persistedRebuilt.topLevelTransactions
                - inMemoryRebuilt.topLevelTransactions,
            allTransactionCountDelta:
                persistedRebuilt.allTransactions
                - inMemoryRebuilt.allTransactions,
            effectiveAmountTotalDelta: Math.round(
                (persistedRebuilt.allTransactionAmountTotal
                    - inMemoryRebuilt.allTransactionAmountTotal) * 100,
            ) / 100,
        },
        parity: {
            allTransactionCountDelta:
                rebuilt.allTransactions - legacy.allTransactions,
            topLevelTransactionCountDelta:
                rebuilt.topLevelTransactions - legacy.topLevelTransactions,
            effectiveAmountTotalDelta: Math.round(
                (rebuilt.allTransactionAmountTotal
                    - legacy.allTransactionAmountTotal) * 100,
            ) / 100,
            topLevelAmountTotalDelta: Math.round(
                (rebuilt.topLevelAmountTotal - legacy.topLevelAmountTotal) * 100,
            ) / 100,
            editCountDelta: rebuilt.embeddedEdits - legacy.separateEdits,
        },
    };

    console.log(JSON.stringify(report, null, 2));
    if (
        !rebuild.committed
        || rebuild.failedFiles.length > 0
        || report.persistenceRoundTrip.topLevelTransactionCountDelta !== 0
        || report.persistenceRoundTrip.allTransactionCountDelta !== 0
        || report.persistenceRoundTrip.effectiveAmountTotalDelta !== 0
    ) {
        process.exitCode = 1;
    }
} finally {
    cache?.dispose();
    if (keepTemp) {
        console.error(`Kept temporary verification data at ${userDataPath}`);
    } else {
        fs.rmSync(verificationRoot, { recursive: true, force: true });
    }
}
