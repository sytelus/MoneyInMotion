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
export async function getConfig(): Promise<{ dataPath: string }> {
  return request<{ dataPath: string }>('/config');
}

/**
 * Update the data-path configuration.
 *
 * @param dataPath - The new path to the data directory.
 */
export async function updateConfig(dataPath: string): Promise<{ dataPath: string }> {
  return request<{ dataPath: string }>('/config', {
    method: 'PUT',
    body: JSON.stringify({ dataPath }),
  });
}

/**
 * Retrieve all configured accounts.
 */
export async function getAccounts(): Promise<AccountConfig[]> {
  return request<AccountConfig[]>('/accounts');
}

/**
 * Create a new account configuration.
 *
 * @param config - The account configuration to create.
 */
export async function createAccount(config: AccountConfig): Promise<AccountConfig> {
  return request<AccountConfig>('/accounts', {
    method: 'POST',
    body: JSON.stringify(config),
  });
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
