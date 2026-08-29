import { describe, expect, it } from 'vitest';
import {
  AccountType,
  isSupportedAccountType,
  validateAccountConfigSupport,
  type AccountConfig,
} from '../../src/index.js';

function orderConfig(instituteName: string, tags: string[] = ['ORDER']): AccountConfig {
  return {
    accountInfo: {
      id: 'orders',
      instituteName,
      title: 'Orders',
      type: AccountType.OrderHistory,
      requiresParent: true,
      interAccountNameTags: tags,
    },
    fileFilters: ['*.csv'],
    scanSubFolders: true,
  };
}

describe('account configuration support', () => {
  it('recognizes exactly the account types implemented by the import pipeline', () => {
    expect(isSupportedAccountType(AccountType.BankChecking)).toBe(true);
    expect(isSupportedAccountType(AccountType.OrderHistory)).toBe(true);
    expect(isSupportedAccountType(999)).toBe(false);
  });

  it.each(['Amazon', ' amazon ', 'Etsy'])('accepts supported %s order history', (institution) => {
    expect(validateAccountConfigSupport(orderConfig(institution))).toBeNull();
  });

  it('rejects an order-history institution without an implemented parser', () => {
    expect(validateAccountConfigSupport(orderConfig('Generic'))).toContain('Amazon and Etsy');
  });

  it('requires a parent-charge match tag for order history', () => {
    expect(validateAccountConfigSupport(orderConfig('Amazon', ['  ']))).toContain('match tag');
  });
});
