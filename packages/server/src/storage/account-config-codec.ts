/**
 * Reads and writes `AccountConfig.json`, which uses camelCase field names.
 *
 * @module
 */

import {
  isSupportedAccountType,
  validateAccountConfigSupport,
  type AccountConfig,
  type AccountInfo,
} from '@moneyinmotion/core';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, label: string): JsonObject {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

/** The C# app wrote PascalCase fields; say so instead of "id is missing". */
function rejectPascalCase(object: JsonObject, label: string): void {
  const key = Object.keys(object).find((name) => /^[A-Z]/.test(name));
  if (key) {
    throw new Error(
      `${label} field "${key}" must be camelCase ("${key[0]!.toLowerCase()}${key.slice(1)}").`,
    );
  }
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

/** Parse and validate AccountConfig JSON. */
export function decodeAccountConfig(value: unknown): AccountConfig {
  const root = asObject(value, 'AccountConfig');
  rejectPascalCase(root, 'AccountConfig');
  const info = asObject(root['accountInfo'], 'AccountConfig.accountInfo');
  rejectPascalCase(info, 'AccountConfig.accountInfo');
  const rawType = info['type'];

  if (typeof rawType !== 'number' || !Number.isInteger(rawType)) {
    throw new Error('AccountConfig.accountInfo.type must be an integer.');
  }
  if (!isSupportedAccountType(rawType)) {
    throw new Error(`AccountConfig.accountInfo.type is unsupported: ${rawType}.`);
  }

  const accountInfo: AccountInfo = {
    id: requiredString(info['id'], 'AccountConfig.accountInfo.id'),
    instituteName: requiredString(info['instituteName'], 'AccountConfig.accountInfo.instituteName'),
    title: optionalString(info['title']),
    type: rawType,
    requiresParent: optionalBoolean(
      info['requiresParent'],
      false,
      'AccountConfig.accountInfo.requiresParent',
    ),
    interAccountNameTags: stringArray(info['interAccountNameTags']),
  };
  const filters = stringArray(root['fileFilters'], ['*.csv']);

  const config: AccountConfig = {
    accountInfo,
    fileFilters: filters.length > 0 ? filters : ['*.csv'],
    scanSubFolders: optionalBoolean(root['scanSubFolders'], true, 'AccountConfig.scanSubFolders'),
  };
  const supportError = validateAccountConfigSupport(config);
  if (supportError) throw new Error(supportError);
  return config;
}

/** Serialize as written by the app. */
export function encodeAccountConfig(config: AccountConfig): string {
  return JSON.stringify(config, null, 2);
}
