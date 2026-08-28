import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createAuditInfo,
  updateAuditInfo,
  setDefaultAuditUser,
  getDefaultAuditUser,
  FALLBACK_AUDIT_USER,
} from '../../src/models/audit-info.js';

describe('AuditInfo', () => {
  // The default audit user is module-level state shared across all tests
  // in this run. Reset it before and after every test so that:
  //   (1) tests in this file are mutually isolated, and
  //   (2) we don't leak state into other test files (transaction.test.ts
  //       etc.) that call createAuditInfo() and might assert on createdBy
  //       in the future.
  beforeEach(() => setDefaultAuditUser(FALLBACK_AUDIT_USER));
  afterEach(() => setDefaultAuditUser(FALLBACK_AUDIT_USER));

  describe('createAuditInfo', () => {
    it('stamps an ISO-8601 createDate and uses the fallback user when nothing is configured', () => {
      const before = Date.now();
      const audit = createAuditInfo();
      const after = Date.now();

      const created = new Date(audit.createDate).getTime();
      expect(created).toBeGreaterThanOrEqual(before);
      expect(created).toBeLessThanOrEqual(after);
      expect(audit.createdBy).toBe(FALLBACK_AUDIT_USER);
      expect(audit.updateDate).toBeNull();
      expect(audit.updatedBy).toBeNull();
    });

    it('prefers an explicit createdBy argument over the configured default', () => {
      setDefaultAuditUser('alice');
      const audit = createAuditInfo('bob');
      expect(audit.createdBy).toBe('bob');
    });

    it('uses the most recently configured default when createdBy is omitted', () => {
      setDefaultAuditUser('alice');
      const audit = createAuditInfo();
      expect(audit.createdBy).toBe('alice');
    });
  });

  describe('updateAuditInfo', () => {
    it('preserves createDate and createdBy from the existing record', () => {
      const original = createAuditInfo('alice');
      const updated = updateAuditInfo(original, 'bob');

      expect(updated.createDate).toBe(original.createDate);
      expect(updated.createdBy).toBe(original.createdBy);
      expect(updated.updatedBy).toBe('bob');
      expect(updated.updateDate).not.toBeNull();
    });

    it('falls back to the configured default when updatedBy is omitted', () => {
      const original = createAuditInfo('alice');
      setDefaultAuditUser('system');
      const updated = updateAuditInfo(original);
      expect(updated.updatedBy).toBe('system');
    });

    it('does not mutate the original record', () => {
      const original = createAuditInfo('alice');
      const snapshot = { ...original };
      updateAuditInfo(original, 'bob');
      expect(original).toEqual(snapshot);
    });
  });

  describe('setDefaultAuditUser / getDefaultAuditUser', () => {
    it('round-trips the registered default', () => {
      setDefaultAuditUser('charlie');
      expect(getDefaultAuditUser()).toBe('charlie');
    });

    it('defaults to FALLBACK_AUDIT_USER when reset', () => {
      setDefaultAuditUser(FALLBACK_AUDIT_USER);
      expect(getDefaultAuditUser()).toBe('moneyinmotion');
    });
  });
});
