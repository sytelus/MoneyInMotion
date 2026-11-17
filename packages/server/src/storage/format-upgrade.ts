/**
 * One-time upgrade of data written by the legacy C# app to the native format.
 *
 * Runs at server start before anything else reads the data folder:
 *
 * - `Statements/<account>/AccountConfig.json` with PascalCase account fields
 *   is rewritten in the canonical camelCase shape.
 * - Rule scope hashes stored in the C# base64 encoding are recomputed as hex,
 *   in `LatestMergedEdits.json` (the previous file is kept as a timestamped
 *   copy) and in the snapshot's embedded copy of the rules.
 *
 * Nothing else changes, and files already in the native format are not
 * touched, so running it again does nothing. The next release removes the
 * legacy readers and this module.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  TransactionEdits,
  createScopeFilter,
  type ScopeFilter,
  type TransactionEditData,
} from '@moneyinmotion/core';
import { decodeAccountConfig, encodeAccountConfig } from './account-config-codec.js';
import { ACCOUNT_CONFIG_FILE_NAME } from './account-config-repository.js';
import { writeTextFileAtomically } from './atomic-file.js';
import { TransactionEditsStorage } from './transaction-edits-storage.js';

const HEX_MD5 = /^[0-9a-f]{32}$/;

export interface FormatUpgradeResult {
  /** Account folders whose config was rewritten. */
  accountConfigs: string[];
  /** Scope hashes recomputed in LatestMergedEdits.json. */
  editHashes: number;
  /** Scope hashes recomputed in the snapshot's embedded rules. */
  snapshotHashes: number;
}

function hasPascalCaseKey(value: unknown): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).some((key) => /^[A-Z]/.test(key))
  );
}

function upgradeAccountConfigs(statementsDir: string): string[] {
  if (!fs.existsSync(statementsDir)) return [];
  const upgraded: string[] = [];
  for (const entry of fs.readdirSync(statementsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const configPath = path.join(statementsDir, entry.name, ACCOUNT_CONFIG_FILE_NAME);
    const stat = fs.lstatSync(configPath, { throwIfNoEntry: false });
    if (!stat?.isFile()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      continue; // Account discovery reports unreadable configs.
    }
    const root = raw as Record<string, unknown> | null;
    if (!hasPascalCaseKey(root) && !hasPascalCaseKey(root?.['accountInfo'])) continue;
    let config;
    try {
      config = decodeAccountConfig(raw);
    } catch {
      continue; // Leave invalid configs for account discovery to report.
    }
    writeTextFileAtomically(configPath, `${encodeAccountConfig(config)}\n`);
    upgraded.push(entry.name);
  }
  return upgraded;
}

/** Return the filters with every non-hex hash recomputed, and how many changed. */
function upgradeScopeFilters(filters: readonly ScopeFilter[]): {
  filters: ScopeFilter[];
  changed: number;
} {
  let changed = 0;
  const result = filters.map((filter) => {
    if (HEX_MD5.test(filter.contentHash)) return filter;
    changed += 1;
    return createScopeFilter(
      filter.type,
      [...filter.parameters],
      filter.referenceParameters == null ? null : [...filter.referenceParameters],
    );
  });
  return { filters: result, changed };
}

function upgradeEditsFile(editsPath: string): number {
  if (!fs.existsSync(editsPath)) return 0;
  const storage = new TransactionEditsStorage();
  const edits = storage.load(editsPath);
  const upgraded = new TransactionEdits(edits.sourceId);
  let changed = 0;
  for (const edit of edits) {
    const result = upgradeScopeFilters(edit.scopeFilters);
    changed += result.changed;
    upgraded.add({ ...edit, scopeFilters: result.filters });
  }
  // save() keeps the previous file as LatestMergedEdits.<timestamp>.json.
  if (changed > 0) storage.save(editsPath, upgraded);
  return changed;
}

function upgradeSnapshotFile(snapshotPath: string): number {
  if (!fs.existsSync(snapshotPath)) return 0;
  const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8')) as Record<string, unknown>;
  const container = data['edits'];
  const list: unknown = Array.isArray(container)
    ? container
    : container != null && typeof container === 'object'
      ? (container as Record<string, unknown>)['edits']
      : null;
  if (!Array.isArray(list)) return 0;
  let changed = 0;
  for (const edit of list as TransactionEditData[]) {
    if (!Array.isArray(edit?.scopeFilters)) continue;
    const result = upgradeScopeFilters(edit.scopeFilters);
    if (result.changed === 0) continue;
    changed += result.changed;
    (edit as unknown as { scopeFilters: ScopeFilter[] }).scopeFilters = result.filters;
  }
  if (changed > 0) writeTextFileAtomically(snapshotPath, JSON.stringify(data, null, 2));
  return changed;
}

/** Upgrade `<userDataPath>` in place; returns what changed. */
export function upgradeStoredFormats(userDataPath: string): FormatUpgradeResult {
  const mergedDir = path.join(userDataPath, 'Merged');
  return {
    accountConfigs: upgradeAccountConfigs(path.join(userDataPath, 'Statements')),
    editHashes: upgradeEditsFile(path.join(mergedDir, 'LatestMergedEdits.json')),
    snapshotHashes: upgradeSnapshotFile(path.join(mergedDir, 'LatestMerged.json')),
  };
}
