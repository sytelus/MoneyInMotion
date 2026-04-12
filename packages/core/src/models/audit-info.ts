/**
 * Audit metadata attached to every persisted domain object.
 *
 * Ported from the C# `AuditInfo` class. The JSON wire format uses ISO-8601
 * strings for dates and camelCase property names.
 *
 * @module
 */

import { userInfo } from 'node:os';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Immutable audit trail attached to transactions, edits, and other entities.
 *
 * Matches the JSON shape produced by the legacy C# serializer:
 * ```json
 * {
 *   "createDate": "2024-01-15T08:30:00.000Z",
 *   "createdBy": "DOMAIN\\user",
 *   "updateDate": null,
 *   "updatedBy": null
 * }
 * ```
 */
export interface AuditInfo {
  /** ISO-8601 timestamp of creation (always present). */
  readonly createDate: string;
  /** Identity of the creator (always present). */
  readonly createdBy: string;
  /** ISO-8601 timestamp of the last update, or `null` / `undefined` if never updated. */
  readonly updateDate?: string | null;
  /** Identity of the last updater, or `null` / `undefined` if never updated. */
  readonly updatedBy?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the current OS username, falling back to `'moneyinmotion'` when
 * the OS user info is not available (e.g. in containerised CI environments).
 */
function getDefaultUser(): string {
  try {
    return userInfo().username;
  } catch {
    return 'moneyinmotion';
  }
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Create a fresh {@link AuditInfo} stamped with the current UTC time.
 *
 * @param createdBy - The identity to record. Defaults to the current OS user.
 * @returns A new `AuditInfo` with no update information.
 */
export function createAuditInfo(createdBy?: string): AuditInfo {
  return {
    createDate: new Date().toISOString(),
    createdBy: createdBy ?? getDefaultUser(),
    updateDate: null,
    updatedBy: null,
  };
}

/**
 * Derive an updated {@link AuditInfo} from an existing one.
 *
 * The original `createDate` and `createdBy` are preserved; `updateDate` is
 * set to the current UTC time and `updatedBy` is set to the supplied (or
 * default) identity.
 *
 * @param existing  - The audit info to update.
 * @param updatedBy - The identity to record. Defaults to the current OS user.
 * @returns A new `AuditInfo` object (the original is not mutated).
 */
export function updateAuditInfo(
  existing: AuditInfo,
  updatedBy?: string,
): AuditInfo {
  return {
    createDate: existing.createDate,
    createdBy: existing.createdBy,
    updateDate: new Date().toISOString(),
    updatedBy: updatedBy ?? getDefaultUser(),
  };
}
