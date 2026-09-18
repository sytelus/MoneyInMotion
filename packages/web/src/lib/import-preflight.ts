/** Local-only folder checks. Never send bytes before spelling and size checks pass. */
import type { AccountSummary, FolderUploadItem } from '../api/client.js';

export interface FolderPreflight {
  selectedFolders: string[];
  unmatchedPaths: string[];
  eligible: FolderUploadItem[];
  skipped: Array<{ path: string; reason: string }>;
  errors: string[];
  totalBytes: number;
}

/** Mirrors the server's deliberately small, case-insensitive filename filter. */
function matchesFilter(name: string, filters: string[]) {
  return filters.some((filter) => {
    const value = filter.trim().toLowerCase();
    return (
      value === '*' ||
      (value.startsWith('*.')
        ? name.toLowerCase().endsWith(value.slice(1))
        : name.toLowerCase() === value)
    );
  });
}

export function preflightFolder(
  items: FolderUploadItem[],
  accounts: AccountSummary[],
): FolderPreflight {
  const paths = items.map((item) => item.relativePath.replaceAll('\\', '/'));
  const splitPaths = paths.map((item) => item.split('/'));
  const first = splitPaths[0]?.[0];
  const firstIsAccount = accounts.some(
    (account) => account.relativeDirectory.toLowerCase() === first?.toLowerCase(),
  );
  const stripRoot =
    first != null &&
    !firstIsAccount &&
    splitPaths.every((parts) => parts[0]?.toLowerCase() === first.toLowerCase());
  const accountPaths = stripRoot ? splitPaths.map((parts) => parts.slice(1).join('/')) : paths;
  const selectedFolders = new Set<string>();
  const result: FolderPreflight = {
    selectedFolders: [],
    unmatchedPaths: [],
    eligible: [],
    skipped: [],
    errors: [],
    totalBytes: 0,
  };
  for (const [index, relativePath] of accountPaths.entries()) {
    const item = items[index]!;
    const account = accounts.find((candidate) =>
      relativePath.toLowerCase().startsWith(`${candidate.relativeDirectory.toLowerCase()}/`),
    );
    if (!account) {
      result.unmatchedPaths.push(relativePath);
      continue;
    }
    selectedFolders.add(account.relativeDirectory);
    const name = relativePath.split('/').at(-1) ?? '';
    const nested = relativePath.split('/').length > 2;
    const reason =
      name.toLowerCase() === 'accountconfig.json'
        ? 'Account configuration is managed in Accounts, not imported.'
        : !account.config.scanSubFolders && nested
          ? 'Subfolder scanning is disabled for this account.'
          : !matchesFilter(name, account.config.fileFilters)
            ? `Does not match this account’s file filters (${account.config.fileFilters.join(', ')}).`
            : null;
    if (reason) {
      result.skipped.push({ path: relativePath, reason });
      continue;
    }
    result.eligible.push(item);
    result.totalBytes += item.file.size;
    if (item.file.size > 20 * 1024 * 1024)
      result.errors.push(`${relativePath} exceeds the 20 MiB per-file limit.`);
  }
  if (result.eligible.length > 200)
    result.errors.push('An upload supports up to 200 statement files. Choose a smaller folder.');
  // Leave room for multipart boundaries and the path manifest inside 100 MiB.
  const estimatedRequestBytes =
    result.totalBytes +
    new TextEncoder().encode(JSON.stringify(result.eligible.map((item) => item.relativePath)))
      .byteLength +
    result.eligible.length * 1024;
  if (estimatedRequestBytes > 100 * 1024 * 1024)
    result.errors.push(
      'This selection approaches or exceeds the 100 MiB request limit. Split it into smaller folders.',
    );
  if (items.length > 0 && result.eligible.length === 0 && result.unmatchedPaths.length === 0)
    result.errors.push(
      'No statement files match the account settings. Check file filters or enable subfolder scanning in Accounts.',
    );
  result.selectedFolders = [...selectedFolders].sort();
  result.unmatchedPaths = [...new Set(result.unmatchedPaths)].sort();
  return result;
}
