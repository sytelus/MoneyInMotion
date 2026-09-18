/**
 * Accounts API routes.
 *
 * GET    /api/accounts      - scan top-level statement folders for AccountConfig.json
 * POST   /api/accounts      - create account folder + AccountConfig.json
 * PUT    /api/accounts/:id  - update an existing account config
 * DELETE /api/accounts/:id  - remove an account config without touching raw statements
 *
 * @module
 */

import { Router } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import {
  AccountType,
  isSupportedAccountType,
  validateAccountConfigSupport,
  type AccountConfig,
} from '@moneyinmotion/core';
import type { TransactionCache } from '../cache/transaction-cache.js';
import type { ServerConfig } from '../config.js';
import { encodeAccountConfig } from '../storage/account-config-codec.js';
import {
  ACCOUNT_CONFIG_FILE_NAME,
  accountDirectoryHasStatements,
  discoverAccountConfigs,
  findAccountById,
  type DiscoveredAccountConfig,
} from '../storage/account-config-repository.js';
import { writeTextFileAtomically } from '../storage/atomic-file.js';
import {
  accountIdentitiesByFolder,
  disconnectedAccountFolder,
  isSafeAccountFolder,
} from '../services/account-reconnection-service.js';

interface AccountStats {
  transactionCount: number;
  lastImportedAt: string | null;
}

interface AccountSummary {
  config: AccountConfig;
  stats: AccountStats;
  hasStatementFiles: boolean;
  /** Folder identity used by browser folder uploads. */
  relativeDirectory: string;
}

const accountInfoSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    instituteName: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).optional().nullable(),
    type: z.number().int().refine(isSupportedAccountType, 'Unsupported account type.'),
    requiresParent: z.boolean(),
    interAccountNameTags: z.array(z.string().max(200)).max(100).optional().nullable(),
  })
  .strict();

const accountConfigSchema = z
  .object({
    accountInfo: accountInfoSchema,
    fileFilters: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(200)
          .refine(
            (filter) =>
              !/[/\\]/.test(filter) &&
              (filter === '*' || /^\*\.[^*?]+$/.test(filter) || !/[*?]/.test(filter)),
            'File filters support only "*", "*.extension", or an exact filename.',
          ),
      )
      .max(100)
      .default(['*.csv']),
    scanSubFolders: z.boolean().default(true),
  })
  .strict();

function isValidAccountId(accountId: string): boolean {
  return (
    !!accountId &&
    accountId !== '.' &&
    !/[/\\]/.test(accountId) &&
    !accountId.includes('..') &&
    /^[a-zA-Z0-9._-]+$/.test(accountId)
  );
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringList(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function normalizeAccountConfig(accountConfig: AccountConfig): AccountConfig {
  const fileFilters = normalizeStringList(accountConfig.fileFilters);
  const interAccountNameTags = normalizeStringList(
    accountConfig.accountInfo.interAccountNameTags ?? null,
  );

  return {
    accountInfo: {
      ...accountConfig.accountInfo,
      id: accountConfig.accountInfo.id.trim(),
      instituteName: accountConfig.accountInfo.instituteName.trim(),
      title: normalizeOptionalString(accountConfig.accountInfo.title),
      requiresParent: accountConfig.accountInfo.type === AccountType.OrderHistory,
      interAccountNameTags: interAccountNameTags.length > 0 ? interAccountNameTags : null,
    },
    fileFilters: fileFilters.length > 0 ? fileFilters : ['*.csv'],
    scanSubFolders: accountConfig.scanSubFolders,
  };
}

/** Atomically replace an AccountConfig so readers never see partial JSON. */
function writeAccountConfig(configPath: string, config: AccountConfig): void {
  writeTextFileAtomically(configPath, encodeAccountConfig(config));
}

function buildEmptyStats(): AccountStats {
  return {
    transactionCount: 0,
    lastImportedAt: null,
  };
}

async function getAccountStats(cache: TransactionCache): Promise<Map<string, AccountStats>> {
  const statsByAccount = new Map<string, AccountStats>();
  const transactions = await cache.getTransactions();

  for (const transaction of transactions.allParentChildTransactions) {
    const existing = statsByAccount.get(transaction.accountId) ?? buildEmptyStats();
    const createDate = transaction.auditInfo.createDate ?? null;

    existing.transactionCount += 1;
    if (createDate && (!existing.lastImportedAt || createDate > existing.lastImportedAt)) {
      existing.lastImportedAt = createDate;
    }

    statsByAccount.set(transaction.accountId, existing);
  }

  return statsByAccount;
}

function buildAccountSummary(
  discoveredAccount: DiscoveredAccountConfig,
  statsByAccount: Map<string, AccountStats>,
): AccountSummary {
  return {
    config: discoveredAccount.config,
    stats: statsByAccount.get(discoveredAccount.config.accountInfo.id) ?? buildEmptyStats(),
    hasStatementFiles: accountDirectoryHasStatements(discoveredAccount.accountDir),
    relativeDirectory: discoveredAccount.relativeDirectory,
  };
}

export function createAccountsRouter(config: ServerConfig, cache: TransactionCache): Router {
  const router = Router();

  router.get('/disconnected', async (_req, res, next) => {
    try {
      const identities = accountIdentitiesByFolder(await cache.getTransactions());
      const folders = fs.existsSync(config.statementsDir)
        ? fs
            .readdirSync(config.statementsDir, { withFileTypes: true })
            .filter(
              (entry) =>
                entry.isDirectory() &&
                isSafeAccountFolder(entry.name) &&
                !fs.existsSync(
                  path.join(config.statementsDir, entry.name, ACCOUNT_CONFIG_FILE_NAME),
                ),
            )
            .map((entry) =>
              disconnectedAccountFolder(entry.name, identities.get(entry.name.toLowerCase())),
            )
            .sort((a, b) => a.relativeDirectory.localeCompare(b.relativeDirectory))
        : [];
      res.json(folders);
    } catch (err) {
      next(err);
    }
  });

  router.get('/', async (_req, res, next) => {
    try {
      const discoveredAccounts = discoverAccountConfigs(config.statementsDir);
      const statsByAccount = await getAccountStats(cache);
      const accounts = discoveredAccounts
        .map((account) => buildAccountSummary(account, statsByAccount))
        .sort((left, right) => {
          const leftKey =
            left.config.accountInfo.title?.toLowerCase() ??
            left.config.accountInfo.id.toLowerCase();
          const rightKey =
            right.config.accountInfo.title?.toLowerCase() ??
            right.config.accountInfo.id.toLowerCase();
          return leftKey.localeCompare(rightKey);
        });

      res.json(accounts);
    } catch (err) {
      next(err);
    }
  });

  router.post(['/', '/:id/reconnect'], async (req, res, next) => {
    try {
      const result = accountConfigSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: result.error.issues.map((i) => i.message).join('; '),
          status: 400,
        });
        return;
      }

      const accountConfig = normalizeAccountConfig(result.data as AccountConfig);
      const supportError = validateAccountConfigSupport(accountConfig);
      if (supportError) {
        res.status(400).json({ error: supportError, status: 400 });
        return;
      }

      // Validate account ID to prevent path traversal
      const accountId = accountConfig.accountInfo.id;
      if (!isValidAccountId(accountId)) {
        res.status(400).json({
          error:
            'Invalid account ID: must contain only alphanumeric characters, hyphens, underscores, and dots, and must not be "." or contain path separators or ".."',
          status: 400,
        });
        return;
      }

      const reconnectFolder = req.params.id;
      if (
        reconnectFolder != null &&
        (typeof reconnectFolder !== 'string' || !isSafeAccountFolder(reconnectFolder))
      ) {
        res.status(400).json({ error: 'Invalid folder name.', status: 400 });
        return;
      }
      // Read provenance before any synchronous existence checks/writes so an
      // asynchronous cache load cannot create an overwrite race between them.
      if (reconnectFolder != null) {
        const originalAccounts =
          accountIdentitiesByFolder(await cache.getTransactions()).get(
            reconnectFolder.toLowerCase(),
          ) ?? [];
        if (originalAccounts.length > 1) {
          res.status(409).json({
            error:
              'This folder has ambiguous historical account identities. Restore its original AccountConfig.json from a backup before rebuilding.',
            status: 409,
          });
          return;
        }
        const original = originalAccounts[0];
        if (original && original.id !== accountId) {
          res.status(409).json({
            error: `This folder belongs to historical account ID "${original.id}". Reconnect with that exact ID to preserve transactions and rule targets.`,
            status: 409,
          });
          return;
        }
      }
      const duplicateAccount = discoverAccountConfigs(config.statementsDir).find(
        (account) => account.config.accountInfo.id.toLowerCase() === accountId.toLowerCase(),
      );
      if (duplicateAccount) {
        res.status(409).json({
          error: `Account "${accountId}" already exists.`,
          status: 409,
        });
        return;
      }

      // Reconnecting is explicit: preserve raw files and only recreate the
      // missing configuration. A normal create never claims an existing folder.
      const accountDir = path.join(config.statementsDir, reconnectFolder ?? accountId);
      const configPath = path.join(accountDir, ACCOUNT_CONFIG_FILE_NAME);
      if (reconnectFolder != null) {
        if (
          !fs.existsSync(accountDir) ||
          !fs.lstatSync(accountDir).isDirectory() ||
          fs.existsSync(configPath)
        ) {
          res.status(409).json({
            error: 'Only an existing, unconfigured account folder can be reconnected.',
            status: 409,
          });
          return;
        }
      } else if (fs.existsSync(accountDir)) {
        res.status(409).json({
          error: `Folder "${accountId}" already exists. Use Reconnect folder to preserve and reconnect its statements.`,
          status: 409,
        });
        return;
      }
      if (reconnectFolder == null) fs.mkdirSync(accountDir, { recursive: true });

      try {
        writeAccountConfig(configPath, accountConfig);
      } catch (err) {
        // The directory was created by this request and no asynchronous work
        // can add user files before this synchronous write completes. Remove a
        // failed partial creation so a corrected retry is not blocked forever.
        if (reconnectFolder == null) fs.rmSync(accountDir, { recursive: true, force: true });
        throw err;
      }

      res.status(201).json({
        config: accountConfig,
        stats: buildEmptyStats(),
        hasStatementFiles: accountDirectoryHasStatements(accountDir),
        relativeDirectory: reconnectFolder ?? accountConfig.accountInfo.id,
      } satisfies AccountSummary);
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const currentId = req.params.id?.trim() ?? '';
      if (!isValidAccountId(currentId)) {
        res.status(400).json({
          error: 'Invalid account ID in request path.',
          status: 400,
        });
        return;
      }

      const result = accountConfigSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: result.error.issues.map((i) => i.message).join('; '),
          status: 400,
        });
        return;
      }

      const updatedConfig = normalizeAccountConfig(result.data as AccountConfig);
      const supportError = validateAccountConfigSupport(updatedConfig);
      if (supportError) {
        res.status(400).json({ error: supportError, status: 400 });
        return;
      }
      const nextId = updatedConfig.accountInfo.id;

      if (!isValidAccountId(nextId)) {
        res.status(400).json({
          error:
            'Invalid account ID: must contain only alphanumeric characters, hyphens, underscores, and dots, and must not contain path separators or ".."',
          status: 400,
        });
        return;
      }

      const discoveredAccounts = discoverAccountConfigs(config.statementsDir);
      const currentAccount = discoveredAccounts.find(
        (account) => account.config.accountInfo.id.toLowerCase() === currentId.toLowerCase(),
      );

      if (!currentAccount) {
        res.status(404).json({
          error: `Account "${currentId}" was not found.`,
          status: 404,
        });
        return;
      }

      const duplicateAccount = discoveredAccounts.find(
        (account) =>
          account.config.accountInfo.id.toLowerCase() === nextId.toLowerCase() &&
          account.accountDir !== currentAccount.accountDir,
      );
      if (duplicateAccount) {
        res.status(409).json({
          error: `Account "${nextId}" already exists.`,
          status: 409,
        });
        return;
      }

      const statsByAccount = await getAccountStats(cache);
      const currentStats =
        statsByAccount.get(currentAccount.config.accountInfo.id) ?? buildEmptyStats();
      const storedCurrentId = currentAccount.config.accountInfo.id;
      const accountIdChanged = storedCurrentId !== nextId;

      let accountDir = currentAccount.accountDir;
      let originalAccountDir: string | null = null;
      if (accountIdChanged) {
        if (currentStats.transactionCount > 0) {
          res.status(400).json({
            error:
              'Account ID cannot be changed after transactions have been imported for this account.',
            status: 400,
          });
          return;
        }

        if (accountDirectoryHasStatements(currentAccount.accountDir)) {
          res.status(400).json({
            error:
              'Account ID cannot be changed after statement files have been added to the account folder.',
            status: 400,
          });
          return;
        }

        const targetDir = path.join(path.dirname(currentAccount.accountDir), nextId);
        if (targetDir !== currentAccount.accountDir && fs.existsSync(targetDir)) {
          res.status(409).json({
            error: `Cannot rename account to "${nextId}" because that folder already exists.`,
            status: 409,
          });
          return;
        }

        fs.renameSync(currentAccount.accountDir, targetDir);
        originalAccountDir = currentAccount.accountDir;
        accountDir = targetDir;
      }

      const configPath = path.join(accountDir, ACCOUNT_CONFIG_FILE_NAME);
      try {
        writeAccountConfig(configPath, updatedConfig);
      } catch (writeError) {
        // A rename and config replacement form one logical update. Restore the
        // original folder if the atomic config write fails so its existing
        // AccountConfig still agrees with its directory identity.
        if (originalAccountDir != null) {
          try {
            fs.renameSync(accountDir, originalAccountDir);
          } catch (rollbackError) {
            throw new AggregateError(
              [writeError, rollbackError],
              'Account config write failed and the directory rename could not be rolled back.',
              { cause: rollbackError },
            );
          }
        }
        throw writeError;
      }

      res.json({
        config: updatedConfig,
        stats: accountIdChanged ? buildEmptyStats() : currentStats,
        hasStatementFiles: accountDirectoryHasStatements(accountDir),
        relativeDirectory: path
          .relative(config.statementsDir, accountDir)
          .split(path.sep)
          .join('/'),
      } satisfies AccountSummary);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', (req, res, next) => {
    try {
      const accountId = req.params.id?.trim() ?? '';
      if (!isValidAccountId(accountId)) {
        res.status(400).json({
          error: 'Invalid account ID in request path.',
          status: 400,
        });
        return;
      }

      const discoveredAccount = findAccountById(config.statementsDir, accountId);

      if (!discoveredAccount) {
        res.status(404).json({
          error: `Account "${accountId}" was not found.`,
          status: 404,
        });
        return;
      }

      fs.unlinkSync(discoveredAccount.configPath);

      let removedDirectory = false;
      if (fs.existsSync(discoveredAccount.accountDir)) {
        const remainingEntries = fs.readdirSync(discoveredAccount.accountDir);
        if (remainingEntries.length === 0) {
          fs.rmdirSync(discoveredAccount.accountDir);
          removedDirectory = true;
        }
      }

      res.json({
        deletedId: accountId,
        removedDirectory,
        keptStatementFiles: !removedDirectory,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
