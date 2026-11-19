import { describe, expect, it } from 'vitest';
import {
  AccountType,
  ScopeType,
  Transaction,
  TransactionReason,
  Transactions,
  createAuditInfo,
  createScopeFilter,
  editValue,
  type EditedValues,
  type ScopeFilter,
} from '@moneyinmotion/core';
import {
  diagnoseRules,
  merchantCategoryRule,
  moveToEnd,
  removeMissingReferences,
} from '../../src/lib/rule-diagnostics.js';

function fixture() {
  const collection = new Transactions('rules');
  let sequence = 0;
  function add(name: string, amount = -10) {
    const tx = Transaction.create('statement', 'card', false, {
      amount,
      transactionDate: `2024-03-${String(10 + sequence++).padStart(2, '0')}`,
      entityName: name.toUpperCase(),
      entityNameNormalized: name,
      transactionReason: TransactionReason.Purchase,
    });
    collection.addNew(
      tx,
      {
        id: 'card',
        instituteName: 'Generic',
        title: 'Card',
        type: AccountType.CreditCard,
        requiresParent: false,
      },
      { id: 'statement', portableAddress: 'card/march.csv', contentHash: 'path-id' },
      false,
    );
    return tx;
  }
  let ruleNumber = 0;
  function rule(scopeFilters: ScopeFilter[], values: EditedValues) {
    const id = `rule-${++ruleNumber}`;
    collection.apply({
      id,
      auditInfo: createAuditInfo('test'),
      scopeFilters,
      values,
      sourceId: 'test',
    });
    return id;
  }
  const merchant = (name: string) => [createScopeFilter(ScopeType.EntityNameNormalized, [name])];
  const exact = (...ids: string[]) => [createScopeFilter(ScopeType.TransactionId, ids)];
  const category = (...path: string[]) => ({ categoryPath: editValue(path) });
  return { collection, add, rule, merchant, exact, category };
}

describe('rule health', () => {
  it('finds rules with no matches, fully overridden rules, duplicates, and missing references', () => {
    const { collection, add, rule, merchant, exact, category } = fixture();
    const taco = add('Taco Time');
    add('Taco Time');
    const unmatched = rule(merchant('Nowhere'), category('Food'));
    const early = rule(merchant('Taco Time'), category('Food', 'Fast food'));
    const late = rule(merchant('Taco Time'), category('Food', 'Restaurants'));
    const copy = rule(merchant('Taco Time'), category('Food', 'Restaurants'));
    const partly = rule(exact(taco.id, 'gone-1', 'gone-2'), {
      ...category('Food', 'Fast food'),
      note: editValue('lunch'),
    });
    const health = diagnoseRules(collection);
    const of = (id: string) => health.rules.get(id)!;

    expect(of(unmatched)).toMatchObject({ matches: 0, issues: ['unmatched'] });
    expect(of(early)).toMatchObject({ order: 2, matches: 2, controls: 0, issues: ['overridden'] });
    expect(Object.fromEntries(of(early).overriddenBy)).toEqual({ [copy]: 1, [partly]: 1 });
    // The later copy wins on one record; the newest rule wins the category on the other.
    expect(of(copy)).toMatchObject({
      controls: 1,
      duplicateOf: late,
      issues: ['duplicate', 'conflict'],
    });
    expect(of(late).issues).toEqual(['overridden']);
    expect(of(partly)).toMatchObject({
      matches: 1,
      controls: 1,
      missingIds: ['gone-1', 'gone-2'],
    });
    expect(of(partly).issues).toEqual(['missing', 'conflict']);
    expect(health.counts).toMatchObject({
      missing: 1,
      unmatched: 1,
      overridden: 2,
      duplicate: 1,
      conflict: 1,
      healthy: 0,
    });
  });

  it('reports a merchant whose records get different categories, with the rules behind each', () => {
    const { collection, add, rule, merchant, exact, category } = fixture();
    const first = add('Fred Meyer');
    add('Fred Meyer');
    add('Fred Meyer');
    add('Safeway');
    const groceries = rule(merchant('Fred Meyer'), category('Groceries'));
    const gas = rule(exact(first.id), category('Auto', 'Gas'));
    rule(merchant('Safeway'), category('Groceries'));
    const { conflicts, rules } = diagnoseRules(collection);
    expect(conflicts).toEqual([
      {
        key: 'fred meyer',
        merchant: 'Fred Meyer',
        label: 'Fred Meyer',
        records: 3,
        choices: [
          { path: ['Groceries'], label: 'Groceries', records: 2, ruleIds: [groceries] },
          { path: ['Auto', 'Gas'], label: 'Auto / Gas', records: 1, ruleIds: [gas] },
        ],
      },
    ]);
    expect(rules.get(groceries)!.conflicts).toEqual(['fred meyer']);
    // The merchant rule is overridden on one record only, so it still controls the others.
    expect(rules.get(groceries)!.issues).toEqual(['conflict']);
    const fix = merchantCategoryRule(conflicts[0]!, ['Groceries']);
    expect(fix.previous).toBeNull();
    expect(fix.next!.scopeFilters[0]).toMatchObject({
      type: ScopeType.EntityNameNormalized,
      parameters: ['Fred Meyer'],
    });
    expect(fix.next!.values!.categoryPath!.value).toEqual(['Groceries']);
  });

  it('builds fixes as ordinary rule changes', () => {
    const { collection, add, rule, exact, category } = fixture();
    const kept = add('Bakery');
    const partial = rule(exact(kept.id, 'gone'), category('Food'));
    const empty = rule(exact('gone-a', 'gone-b'), category('Gifts'));
    const saved = new Map([...collection.getClonedEdits()].map((edit) => [edit.id, edit]));

    const trimmed = removeMissingReferences(saved.get(partial)!, ['gone']);
    expect(trimmed.previous!.id).toBe(partial);
    expect(trimmed.next!.id).toBe(partial);
    expect(trimmed.next!.scopeFilters[0]!.parameters).toEqual([kept.id]);
    expect(trimmed.next!.scopeFilters[0]!.contentHash).toBe(
      createScopeFilter(ScopeType.TransactionId, [kept.id]).contentHash,
    );
    expect(removeMissingReferences(saved.get(empty)!, ['gone-a', 'gone-b']).next).toBeNull();

    const [removed, appended] = moveToEnd(saved.get(partial)!);
    expect(removed).toEqual({ previous: saved.get(partial), next: null });
    expect(appended!.previous).toBeNull();
    expect(appended!.next!.id).not.toBe(partial);
    expect(appended!.next!.values).toEqual(saved.get(partial)!.values);
  });
});
