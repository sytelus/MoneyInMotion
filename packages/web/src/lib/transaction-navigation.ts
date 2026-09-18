/**
 * Shared, schema-free drill-down contract. URLs describe a view; they never
 * modify imported records. Source-record views include parents and children
 * and must not be totalled as financial activity.
 */
export interface TransactionScope {
  from?: string;
  to?: string;
  account?: string;
  category?: string;
  reason?: string;
  review?: string;
  search?: string;
  merchant?: string;
  min?: string;
  max?: string;
  source?: string;
  rule?: string;
  transaction?: string;
  ids?: string[];
  flow?: 'credits' | 'debits' | 'activity';
  view?: 'list' | 'summary';
  basis?: 'reporting' | 'records';
}

const textKeys = [
  'account',
  'category',
  'reason',
  'search',
  'merchant',
  'source',
  'rule',
  'transaction',
] as const;
const options = {
  review: ['flagged', 'unmatched', 'uncategorized', 'incomplete'],
  flow: ['credits', 'debits', 'activity'],
  view: ['list', 'summary'],
  basis: ['reporting', 'records'],
} as const;

export function transactionScopeParams(scope: TransactionScope): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(scope)) {
    if (key === 'ids') {
      for (const id of scope.ids ?? []) params.append('id', id);
    } else if (value) params.set(key, String(value));
  }
  return params;
}

export function transactionsHref(scope: TransactionScope = {}): string {
  const query = transactionScopeParams(scope).toString();
  return `/transactions${query ? `?${query}` : ''}`;
}

/** Ignore invalid external URL values instead of feeding them into controls. */
export function parseTransactionScope(search: string): TransactionScope {
  const params = new URLSearchParams(search);
  const result: Record<string, string | string[]> = {};
  for (const key of textKeys) {
    const value = params.get(key);
    if (value) result[key] = value;
  }
  for (const key of ['from', 'to']) {
    const value = params.get(key);
    if (
      value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value
    )
      result[key] = value;
  }
  for (const key of ['min', 'max']) {
    const value = params.get(key);
    if (value && Number.isFinite(Number(value))) result[key] = value;
  }
  for (const [key, allowed] of Object.entries(options)) {
    const value = params.get(key);
    if (value && (allowed as readonly string[]).includes(value)) result[key] = value;
  }
  const ids = [...new Set(params.getAll('id').filter(Boolean))];
  if (ids.length) result['ids'] = ids;
  return result as TransactionScope;
}
