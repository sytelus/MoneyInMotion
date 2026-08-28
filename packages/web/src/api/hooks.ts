/**
 * React Query hooks for the MoneyInMotion API.
 *
 * Each hook wraps one of the API client functions with either `useQuery`
 * (for reads) or `useMutation` (for writes), providing automatic caching,
 * refetching, and loading/error state management.
 *
 * @module
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTransactions,
  getAccounts,
  applyEdits,
  scanStatements,
  uploadStatementFolder,
} from './client.js';
import type { FolderUploadItem } from './client.js';
import type { TransactionEditData } from '@moneyinmotion/core';

/** Query key constants for cache management. */
export const queryKeys = {
  transactions: ['transactions'] as const,
  accounts: ['accounts'] as const,
} as const;

/**
 * Fetch all transactions. Automatically caches and re-fetches as needed.
 */
export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: fetchTransactions,
  });
}

/**
 * Fetch all configured accounts.
 */
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: getAccounts,
  });
}

/**
 * Mutation hook to apply transaction edits. Invalidates the transactions
 * cache on success so the UI refreshes automatically.
 */
export function useApplyEdits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (edits: TransactionEditData[]) => applyEdits(edits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
}

/**
 * Mutation hook to trigger a statement scan. Invalidates both transactions
 * and accounts caches on success.
 */
export function useScanStatements() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: scanStatements,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
  });
}

/**
 * Upload a browser-selected statement folder. The server performs staging,
 * content deduplication, rebuild, edit replay, and persistence as one flow.
 */
export function useUploadStatementFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: FolderUploadItem[]) => uploadStatementFolder(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
  });
}
