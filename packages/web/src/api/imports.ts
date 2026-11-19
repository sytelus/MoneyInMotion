/** Read-only import evidence and explicit reconnection of preserved account folders. */
import type { AccountConfig, AccountInfo } from '@moneyinmotion/core';
import { ApiError, type AccountSummary, type StagedFileResult } from './client.js';

export interface UploadBatch {
  batchId: string;
  stagedAt: string;
  sourceFileCount: number;
  files: StagedFileResult[];
}
export interface UploadHistory {
  entries: UploadBatch[];
  total: number;
  totalRecorded: number;
  unreadableCount: number;
  page: number;
  pageSize: number;
}
export interface UploadHistoryFilters {
  page: number;
  search: string;
  status: 'all' | 'promoted' | 'duplicate' | 'rejected';
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(
      response.status,
      body.error ?? `The server could not finish this request (${response.status}).`,
      url,
    );
  }
  return response.json() as Promise<T>;
}

/** Kept under this name for the import screens; the same error as every API call. */
export { ApiError as ImportApiError };

export function getUploadHistory(filters: UploadHistoryFilters): Promise<UploadHistory> {
  return request(
    `/api/import/history?${new URLSearchParams({ ...filters, page: String(filters.page) })}`,
  );
}

export interface DisconnectedAccountFolder {
  relativeDirectory: string;
  originalAccount: AccountInfo | null;
  identityStatus: 'known' | 'unknown' | 'ambiguous';
}

export function getDisconnectedFolders(): Promise<DisconnectedAccountFolder[]> {
  return request('/api/accounts/disconnected');
}

export interface StatementEntry {
  path: string;
  name: string;
  kind: 'folder' | 'file' | 'symlink';
  accountId: string | null;
  status:
    | 'eligible'
    | 'ignored'
    | 'unsupported'
    | 'unrecognized'
    | 'unconfigured'
    | 'configuration'
    | 'symlink'
    | 'unreadable';
  reason: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
  fileCount: number;
  eligibleCount: number;
}
export interface StatementInventory {
  entries: StatementEntry[];
  truncated: boolean;
  unreadableFolders: number;
}
/** Current on-disk inventory, including files absent from the transaction snapshot. */
export function getStatementInventory(): Promise<StatementInventory> {
  return request('/api/import/files');
}

export function reconnectAccount(folder: string, config: AccountConfig): Promise<AccountSummary> {
  return request(`/api/accounts/${encodeURIComponent(folder)}/reconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
