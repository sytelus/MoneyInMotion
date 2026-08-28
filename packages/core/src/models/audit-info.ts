/**
 * Audit metadata attached to every persisted domain object.
 *
 * Ported from the C# `AuditInfo` class. The JSON wire format uses ISO-8601
 * strings for dates and camelCase property names.
 *
 * @module
 */

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
 *   "createdBy": "alice",
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
 * Fallback identity used when no `createdBy` / `updatedBy` is supplied and
 * no caller has called {@link setDefaultAuditUser}.
 *
 * The core library is environment-agnostic (no `node:os`, no browser APIs)
 * so it ships with a single static fallback. Runtimes that know more about
 * the current user — for example the Node.js server — can register a better
 * default at startup via {@link setDefaultAuditUser}.
 */
export const FALLBACK_AUDIT_USER = 'moneyinmotion';

let currentDefaultUser: string = FALLBACK_AUDIT_USER;

/**
 * Register the default audit identity used by {@link createAuditInfo} and
 * {@link updateAuditInfo} when no explicit user is passed.
 *
 * Typically called once at application startup — for example the Node.js
 * server might call `setDefaultAuditUser(os.userInfo().username)` so all
 * audit records reflect the real OS user.
 */
export function setDefaultAuditUser(user: string): void {
  currentDefaultUser = user;
}

/** Read the currently registered default audit user. */
export function getDefaultAuditUser(): string {
  return currentDefaultUser;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Create a fresh {@link AuditInfo} stamped with the current UTC time.
 *
 * @param createdBy - Explicit identity to record. If omitted, uses the value
 *                    most recently passed to {@link setDefaultAuditUser},
 *                    or {@link FALLBACK_AUDIT_USER} if none.
 * @returns A new `AuditInfo` with no update information.
 */
export function createAuditInfo(createdBy?: string): AuditInfo {
  return {
    createDate: new Date().toISOString(),
    createdBy: createdBy ?? currentDefaultUser,
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
 * @param updatedBy - Explicit identity to record. If omitted, uses the value
 *                    most recently passed to {@link setDefaultAuditUser},
 *                    or {@link FALLBACK_AUDIT_USER} if none.
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
    updatedBy: updatedBy ?? currentDefaultUser,
  };
}
