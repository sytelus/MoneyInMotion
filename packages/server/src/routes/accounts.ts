/**
 * Accounts API routes.
 *
 * GET    /api/accounts      - scan statementsDir for AccountConfig.json files
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
import type { AccountConfig } from '@moneyinmotion/core';
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

const accountInfoSchema = z.object({
  id: z.string().trim().min(1),
  instituteName: z.string().trim().min(1),
  title: z.string().optional().nullable(),
  type: z.number(),
  requiresParent: z.boolean(),
  interAccountNameTags: z.array(z.string()).optional().nullable(),
});

const accountConfigSchema = z.object({
  accountInfo: accountInfoSchema,
  fileFilters: z.array(z.string()).default(['*.csv']),
  scanSubFolders: z.boolean().default(true),
});

function isValidAccountId(accountId: string): boolean {
  return (
    !!accountId &&
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
      interAccountNameTags: interAccountNameTags.length > 0 ? interAccountNameTags : null,
    },
    fileFilters: fileFilters.length > 0 ? fileFilters : ['*.csv'],
    scanSubFolders: accountConfig.scanSubFolders,
  };
}

/** Atomically replace an AccountConfig so readers never see partial JSON. */
function writeAccountConfig(configPath: string, config: AccountConfig): void {
  const tmpPath = `${configPath}.tmp`;
  fs.writeFileSync(tmpPath, encodeAccountConfig(config), 'utf-8');
  fs.renameSync(tmpPath, configPath);
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

  router.post('/', (req, res) => {
    const result = accountConfigSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: result.error.issues.map((i) => i.message).join('; '),
        status: 400,
      });
      return;
    }

    const accountConfig = normalizeAccountConfig(result.data as AccountConfig);

    // Validate account ID to prevent path traversal
    const accountId = accountConfig.accountInfo.id;
    if (!isValidAccountId(accountId)) {
      res.status(400).json({
        error:
          'Invalid account ID: must contain only alphanumeric characters, hyphens, underscores, and dots, and must not contain path separators or ".."',
        status: 400,
      });
      return;
    }

    // Create account folder named by account id
    const accountDir = path.join(config.statementsDir, accountConfig.accountInfo.id);
    if (fs.existsSync(accountDir)) {
      res.status(409).json({
        error: `Account "${accountId}" already exists.`,
        status: 409,
      });
      return;
    }
    fs.mkdirSync(accountDir, { recursive: true });

    // Write AccountConfig.json
    const configPath = path.join(accountDir, ACCOUNT_CONFIG_FILE_NAME);
    writeAccountConfig(configPath, accountConfig);

    res.status(201).json({
      config: accountConfig,
      stats: buildEmptyStats(),
      hasStatementFiles: false,
      relativeDirectory: accountConfig.accountInfo.id,
    } satisfies AccountSummary);
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
        (account) => account.config.accountInfo.id === currentId,
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
          account.config.accountInfo.id === nextId && account.config.accountInfo.id !== currentId,
      );
      if (duplicateAccount) {
        res.status(409).json({
          error: `Account "${nextId}" already exists.`,
          status: 409,
        });
        return;
      }

      const statsByAccount = await getAccountStats(cache);
      const currentStats = statsByAccount.get(currentId) ?? buildEmptyStats();

      let accountDir = currentAccount.accountDir;
      if (currentId !== nextId) {
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
        accountDir = targetDir;
      }

      const configPath = path.join(accountDir, ACCOUNT_CONFIG_FILE_NAME);
      writeAccountConfig(configPath, updatedConfig);

      res.json({
        config: updatedConfig,
        stats: currentId === nextId ? currentStats : buildEmptyStats(),
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
