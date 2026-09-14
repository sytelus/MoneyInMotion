/**
 * Read-only discovery helpers for the account configuration tree.
 *
 * Keeping discovery here ensures the account API, folder-upload workflow, and
 * statement scanner agree about account directory identity.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AccountConfig } from '@moneyinmotion/core';
import { decodeAccountConfig } from './account-config-codec.js';

export const ACCOUNT_CONFIG_FILE_NAME = 'AccountConfig.json';

/** A top-level AccountConfig cannot be trusted or safely ignored. */
export class InvalidAccountConfigError extends Error {
  readonly status = 422;

  constructor(
    readonly portablePath: string,
    message: string,
    cause?: unknown,
  ) {
    super(`Invalid account config "${portablePath}": ${message}`, { cause });
    this.name = 'InvalidAccountConfigError';
  }
}

export interface DiscoveredAccountConfig {
  config: AccountConfig;
  configPath: string;
  accountDir: string;
  /** POSIX-style path relative to the Statements directory. */
  relativeDirectory: string;
}

/** Discover only `Statements/<account>/AccountConfig.json`. */
export function discoverAccountConfigs(statementsDir: string): DiscoveredAccountConfig[] {
  if (!fs.existsSync(statementsDir)) return [];
  const results: DiscoveredAccountConfig[] = [];
  const entries = fs
    .readdirSync(statementsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const accountDir = path.join(statementsDir, entry.name);
    const configPath = path.join(accountDir, ACCOUNT_CONFIG_FILE_NAME);
    if (!fs.existsSync(configPath)) continue;

    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as unknown;
      results.push({
        config: decodeAccountConfig(raw),
        configPath,
        accountDir,
        relativeDirectory: entry.name,
      });
    } catch (err) {
      const portableConfigPath = path.relative(statementsDir, configPath).split(path.sep).join('/');
      const message = (err instanceof Error ? err.message : String(err))
        .split(configPath)
        .join(portableConfigPath);
      throw new InvalidAccountConfigError(portableConfigPath, message, err);
    }
  }
  return results;
}

export function findAccountById(
  statementsDir: string,
  accountId: string,
): DiscoveredAccountConfig | null {
  return (
    discoverAccountConfigs(statementsDir).find(
      (account) => account.config.accountInfo.id.toLowerCase() === accountId.toLowerCase(),
    ) ?? null
  );
}

/** Match the intentionally small glob subset supported by AccountConfig. */
export function matchesFileFilters(fileName: string, fileFilters: readonly string[]): boolean {
  const normalizedFileName = fileName.toLowerCase();
  return fileFilters.some((filter) => {
    const normalizedFilter = filter.trim().toLowerCase();
    if (!normalizedFilter) return false;
    if (normalizedFilter === '*') return true;
    if (normalizedFilter.startsWith('*.')) {
      return normalizedFileName.endsWith(normalizedFilter.slice(1));
    }
    return normalizedFileName === normalizedFilter;
  });
}

/** Return true when an account folder contains input beyond its root config file. */
export function accountDirectoryHasStatements(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) return false;
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ACCOUNT_CONFIG_FILE_NAME) continue;
      if (entry.isFile()) return true;
      if (entry.isDirectory()) stack.push(path.join(current, entry.name));
    }
  }
  return false;
}
