import { describe, expect, it } from 'vitest';
import { AccountType } from '@moneyinmotion/core';
import { decodeAccountConfig } from '../../src/storage/account-config-codec.js';

function validConfig() {
  return {
    accountInfo: {
      id: 'checking',
      instituteName: 'Example Bank',
      type: AccountType.BankChecking,
      requiresParent: false,
    },
    fileFilters: ['*.csv'],
    scanSubFolders: true,
  };
}

describe('decodeAccountConfig', () => {
  it('decodes a supported canonical config', () => {
    expect(decodeAccountConfig(validConfig())).toMatchObject(validConfig());
  });

  it('rejects string values instead of coercing them to booleans', () => {
    expect(() =>
      decodeAccountConfig({
        ...validConfig(),
        scanSubFolders: 'false',
      }),
    ).toThrow('scanSubFolders must be a boolean');

    expect(() =>
      decodeAccountConfig({
        ...validConfig(),
        accountInfo: {
          ...validConfig().accountInfo,
          requiresParent: 'false',
        },
      }),
    ).toThrow('requiresParent must be a boolean');
  });

  it('rejects account types the application cannot process', () => {
    expect(() =>
      decodeAccountConfig({
        ...validConfig(),
        accountInfo: { ...validConfig().accountInfo, type: 999 },
      }),
    ).toThrow('unsupported');
  });

  it('rejects order-history configurations the matcher cannot process', () => {
    expect(() =>
      decodeAccountConfig({
        ...validConfig(),
        accountInfo: {
          ...validConfig().accountInfo,
          type: AccountType.OrderHistory,
          requiresParent: true,
          interAccountNameTags: ['SHOP'],
        },
      }),
    ).toThrow(/Amazon and Etsy/);

    expect(() =>
      decodeAccountConfig({
        ...validConfig(),
        accountInfo: {
          ...validConfig().accountInfo,
          instituteName: 'Amazon',
          type: AccountType.OrderHistory,
          requiresParent: true,
          interAccountNameTags: [],
        },
      }),
    ).toThrow(/match tag/);
  });
});
