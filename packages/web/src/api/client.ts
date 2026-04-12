/**
 * HTTP client for the MoneyInMotion REST API.
 *
 * All functions target the `/api` prefix which Vite proxies to the Express
 * server during development.
 *
 * @module
 */

import type { TransactionsData, TransactionEditData, AccountConfig } from '@moneyinmotion/core';

const BASE_URL = '/api';

export interface ApiConfig {
  port: number;
  dataPath: string;
  statementsDir: string;
  mergedDir: string;
}

export interface AccountStats {
  transactionCount: number;
  lastImportedAt: string | null;
}

export interface AccountSummary {
  config: AccountConfig;
  stats: AccountStats;
  hasStatementFiles: boolean;
}

export interface DeleteAccountResponse {
  deletedId: string;
  removedDirectory: boolean;
  keptStatementFiles: boolean;
}

/**
 * Thin wrapper around `fetch` that throws on non-OK responses and parses JSON.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API ${options?.method ?? 'GET'} ${path} failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch all transactions from the server.
 */
export async function fetchTransactions(): Promise<TransactionsData> {
  return request<TransactionsData>('/transactions');
}

/**
 * Apply one or more transaction edits.
 *
 * @param edits - The edits to apply.
 * @returns An object containing the count of affected transactions.
 */
export async function applyEdits(
  edits: TransactionEditData[],
): Promise<{ affectedTransactionsCount: number }> {
  return request<{ affectedTransactionsCount: number }>('/transaction-edits', {
    method: 'POST',
    body: JSON.stringify(edits),
  });
}

/**
 * Retrieve application configuration.
 */
export async function getConfig(): Promise<ApiConfig> {
  return request<ApiConfig>('/config');
}

/**
 * Update application configuration.
 *
 * @param config - The new config values to persist.
 */
export async function updateConfig(config: {
  dataPath: string;
  port: number;
}): Promise<ApiConfig> {
  return request<ApiConfig>('/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

/**
 * Retrieve all configured accounts.
 */
export async function getAccounts(): Promise<AccountSummary[]> {
  return request<AccountSummary[]>('/accounts');
}

/**
 * Create a new account configuration.
 *
 * @param config - The account configuration to create.
 */
export async function createAccount(config: AccountConfig): Promise<AccountSummary> {
  return request<AccountSummary>('/accounts', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/**
 * Update an existing account configuration.
 *
 * @param currentId - The existing account ID in the route.
 * @param config - The updated account configuration.
 */
export async function updateAccount(
  currentId: string,
  config: AccountConfig,
): Promise<AccountSummary> {
  return request<AccountSummary>(`/accounts/${encodeURIComponent(currentId)}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

/**
 * Remove an existing account configuration.
 *
 * Raw statement files are intentionally preserved server-side.
 */
export async function deleteAccount(
  accountId: string,
): Promise<DeleteAccountResponse> {
  return request<DeleteAccountResponse>(
    `/accounts/${encodeURIComponent(accountId)}`,
    {
      method: 'DELETE',
    },
  );
}

/**
 * Trigger a scan of statement files for new transactions.
 */
export async function scanStatements(): Promise<{
  newTransactions: number;
  totalTransactions: number;
  importedFiles: string[];
}> {
  return request<{ newTransactions: number; totalTransactions: number; importedFiles: string[] }>('/import/scan', {
    method: 'POST',
  });
}

/**
 * Persist data to disk.
 *
 * @param options - Which data sets to save.
 */
export async function saveData(options: {
  saveMerged: boolean;
  saveEdits: boolean;
}): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/import/save', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}
