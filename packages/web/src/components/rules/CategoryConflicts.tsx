import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { RuleChange } from '../../api/client.js';
import {
  merchantCategoryRule,
  type CategoryConflict,
  type RuleDiagnosis,
} from '../../lib/rule-diagnostics.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { countLabel } from '../../lib/utils.js';
import { Button } from '../ui/button.js';

const PAGE = 25;

/** Merchants whose records get different categories from different rules. */
export function CategoryConflicts({
  conflicts,
  diagnoses,
  onOpenRule,
  onChanges,
}: {
  conflicts: CategoryConflict[];
  diagnoses: Map<string, RuleDiagnosis>;
  onOpenRule: (id: string) => void;
  onChanges: (changes: RuleChange[]) => void;
}) {
  const [shown, setShown] = useState(PAGE);
  if (!conflicts.length) {
    return (
      <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
        No merchant gets different categories from different rules.
      </p>
    );
  }
  return (
    <section
      aria-label="Category conflicts"
      className="space-y-3 rounded-xl border border-border bg-background p-4"
    >
      <p className="max-w-4xl text-sm text-muted-foreground">
        Each merchant below gets different categories from different rules. That can be intended,
        for example groceries and gas from one store. <strong>Use for all</strong> adds one rule for
        the merchant at the end of the rule order, so it wins over the others, also for future
        imports. The older rules then show as <strong>Overridden</strong>, and you can delete them
        or keep them. Every change is previewed before it is saved.
      </p>
      <ul className="divide-y divide-border">
        {conflicts.slice(0, shown).map((conflict) => (
          <li key={conflict.key} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {conflict.label}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  {countLabel(conflict.records, 'categorized record')}
                </span>
              </p>
              <Link
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2"
                to={transactionsHref({ merchant: conflict.label, basis: 'records', view: 'list' })}
              >
                <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                View transactions
              </Link>
            </div>
            <table className="mt-2 w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>Category</th>
                  <th>Records</th>
                  <th>Set by rules</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {conflict.choices.map((choice) => (
                  <tr key={choice.label} className="align-top">
                    <td className="py-1 pr-3">{choice.label}</td>
                    <td className="w-24 py-1 pr-3 text-right tabular-nums text-muted-foreground">
                      {countLabel(choice.records, 'record')}
                    </td>
                    <td className="py-1 pr-3">
                      <span className="flex flex-wrap gap-1">
                        {choice.ruleIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="rounded bg-muted px-1.5 text-xs tabular-nums text-primary underline-offset-2 hover:underline"
                            aria-label={`Open rule ${diagnoses.get(id)?.order}`}
                            onClick={() => onOpenRule(id)}
                          >
                            #{diagnoses.get(id)?.order}
                          </button>
                        ))}
                      </span>
                    </td>
                    <td className="w-28 py-1 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Use ${choice.label} for all ${conflict.label} records`}
                        onClick={() => onChanges([merchantCategoryRule(conflict, choice.path)])}
                      >
                        Use for all
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
      {shown < conflicts.length && (
        <Button variant="outline" size="sm" onClick={() => setShown(shown + PAGE)}>
          Show more ({conflicts.length - shown} left)
        </Button>
      )}
    </section>
  );
}
