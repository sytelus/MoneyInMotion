/** Read-only import evidence and explicit reconnection of preserved account folders. */
import type { AccountConfig, AccountInfo } from '@moneyinmotion/core';
import type { AccountSummary, StagedFileResult } from './client.js';

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
    throw new ImportApiError(response.status, body.error ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

/** Preserves HTTP status for useful recovery guidance without exposing raw API copy. */
export class ImportApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ImportApiError';
  }
}

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

export function reconnectAccount(folder: string, config: AccountConfig): Promise<AccountSummary> {
  return request(`/api/accounts/${encodeURIComponent(folder)}/reconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
