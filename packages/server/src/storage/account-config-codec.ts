/**
 * AccountConfig JSON compatibility boundary.
 *
 * Legacy DataContract JSON used lower camel case for AccountConfig fields but
 * PascalCase for AccountInfo fields. The web application writes one canonical
 * lower-camel shape while continuing to read both representations.
 *
 * @module
 */

import { AccountType, type AccountConfig, type AccountInfo } from '@moneyinmotion/core';

type JsonObject = Record<string, unknown>;

/** Account kinds implemented by the current parser and matching pipeline. */
export const SUPPORTED_ACCOUNT_TYPES: readonly AccountType[] = [
  AccountType.CreditCard,
  AccountType.BankChecking,
  AccountType.BankSavings,
  AccountType.OrderHistory,
  AccountType.EPayment,
];

export function isSupportedAccountType(value: number): value is AccountType {
  return SUPPORTED_ACCOUNT_TYPES.includes(value as AccountType);
}

function asObject(value: unknown, label: string): JsonObject {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

function pick(object: JsonObject, camel: string, pascal: string): unknown {
  return object[camel] ?? object[pascal];
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown, fallback: string[] = []): string[] {
  if (value == null) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('Expected an array of strings.');
  }
  return value.map((item) => (item as string).trim()).filter(Boolean);
}

function optionalBoolean(value: unknown, fallback: boolean, label: string): boolean {
  if (value == null) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

/** Parse canonical or original C# AccountConfig JSON. */
export function decodeAccountConfig(value: unknown): AccountConfig {
  const root = asObject(value, 'AccountConfig');
  const accountInfoRaw = pick(root, 'accountInfo', 'AccountInfo');
  const info = asObject(accountInfoRaw, 'AccountConfig.accountInfo');
  const rawType = pick(info, 'type', 'Type');

  if (typeof rawType !== 'number' || !Number.isInteger(rawType)) {
    throw new Error('AccountConfig.accountInfo.type must be an integer.');
  }
  if (!isSupportedAccountType(rawType)) {
    throw new Error(`AccountConfig.accountInfo.type is unsupported: ${rawType}.`);
  }

  const accountInfo: AccountInfo = {
    id: requiredString(pick(info, 'id', 'Id'), 'AccountConfig.accountInfo.id'),
    instituteName: requiredString(
      pick(info, 'instituteName', 'InstituteName'),
      'AccountConfig.accountInfo.instituteName',
    ),
    title: optionalString(pick(info, 'title', 'Title')),
    type: rawType,
    requiresParent: optionalBoolean(
      pick(info, 'requiresParent', 'RequiresParent'),
      false,
      'AccountConfig.accountInfo.requiresParent',
    ),
    interAccountNameTags: stringArray(pick(info, 'interAccountNameTags', 'InterAccountNameTags')),
  };
  const filters = stringArray(pick(root, 'fileFilters', 'FileFilters'), ['*.csv']);

  return {
    accountInfo,
    fileFilters: filters.length > 0 ? filters : ['*.csv'],
    scanSubFolders: optionalBoolean(
      pick(root, 'scanSubFolders', 'ScanSubFolders'),
      true,
      'AccountConfig.scanSubFolders',
    ),
  };
}

/** Serialize in the canonical web representation. */
export function encodeAccountConfig(config: AccountConfig): string {
  return JSON.stringify(config, null, 2);
}
