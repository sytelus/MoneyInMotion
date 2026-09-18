/** Read existing upload manifests without rewriting or inventing historical outcomes. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import type { ServerConfig } from '../config.js';

const fileSchema = z.object({
  relativePath: z.string().max(4096),
  accountId: z.string().max(200).nullable(),
  status: z.enum(['promoted', 'duplicate', 'rejected']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  destinationPath: z.string().max(4096).nullable(),
  duplicateOf: z.string().max(4096).nullable(),
  message: z.string().max(10000),
  sizeBytes: z.number().int().nonnegative(),
});
const manifestSchema = z.object({
  batchId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  stagedAt: z.string().datetime(),
  sourceFileCount: z.number().int().nonnegative(),
  files: z.array(fileSchema).max(200),
});

export interface ImportHistoryQuery {
  page: number;
  pageSize: number;
  search: string;
  status: 'all' | 'promoted' | 'duplicate' | 'rejected';
}

/**
 * Manifests record receipt and promotion, not the following rebuild. Returning
 * only their actual evidence prevents a historic upload becoming a fabricated
 * "successful import". Invalid manifests are counted explicitly, never hidden.
 * Symlinked directories/files are not followed, and reads are size bounded.
 */
export function readImportHistory(config: ServerConfig, query: ImportHistoryQuery) {
  const batches: Array<z.infer<typeof manifestSchema>> = [];
  let unreadableCount = 0;
  if (fs.existsSync(config.stagingDir)) {
    for (const entry of fs.readdirSync(config.stagingDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-zA-Z0-9_-]{1,100}$/.test(entry.name)) continue;
      const manifestPath = path.join(config.stagingDir, entry.name, 'manifest.json');
      try {
        const stat = fs.lstatSync(manifestPath);
        if (!stat.isFile() || stat.size > 2 * 1024 * 1024) {
          unreadableCount += 1;
          continue;
        }
        const parsed = manifestSchema.safeParse(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
        if (
          !parsed.success ||
          parsed.data.batchId !== entry.name ||
          parsed.data.sourceFileCount !== parsed.data.files.length
        ) {
          unreadableCount += 1;
          continue;
        }
        batches.push(parsed.data);
      } catch {
        unreadableCount += 1;
      }
    }
  }
  const searchWords = query.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = batches
    .filter((batch) => {
      if (query.status !== 'all' && !batch.files.some((file) => file.status === query.status))
        return false;
      const text = [
        batch.batchId,
        batch.stagedAt,
        ...batch.files.flatMap((file) => [file.relativePath, file.accountId ?? '', file.message]),
      ]
        .join(' ')
        .toLowerCase();
      return searchWords.every((word) => text.includes(word));
    })
    .sort((a, b) => b.stagedAt.localeCompare(a.stagedAt) || b.batchId.localeCompare(a.batchId));
  const page = Math.min(query.page, Math.max(0, Math.ceil(filtered.length / query.pageSize) - 1));
  return {
    entries: filtered.slice(page * query.pageSize, (page + 1) * query.pageSize),
    total: filtered.length,
    totalRecorded: batches.length,
    unreadableCount,
    page,
    pageSize: query.pageSize,
  };
}
