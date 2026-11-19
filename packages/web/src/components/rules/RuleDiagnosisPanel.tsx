import React from 'react';
import type { TransactionEditData } from '@moneyinmotion/core';
import type { RuleChange } from '../../api/client.js';
import {
  issueText,
  moveToEnd,
  removeMissingReferences,
  type RuleDiagnosis,
} from '../../lib/rule-diagnostics.js';
import { countLabel } from '../../lib/utils.js';
import { Button } from '../ui/button.js';

/** Why a rule does (or doesn't) change anything, with fixes that go through preview. */
export function RuleDiagnosisPanel({
  rule,
  diagnosis,
  diagnoses,
  totalRules,
  onOpenRule,
  onChanges,
  onShowConflicts,
}: {
  rule: TransactionEditData;
  diagnosis: RuleDiagnosis;
  diagnoses: Map<string, RuleDiagnosis>;
  totalRules: number;
  onOpenRule: (id: string) => void;
  onChanges: (changes: RuleChange[]) => void;
  onShowConflicts: () => void;
}) {
  const ruleLinks = (counts: Map<string, number>) =>
    [...counts]
      .sort(([a], [b]) => (diagnoses.get(a)?.order ?? 0) - (diagnoses.get(b)?.order ?? 0))
      .map(([id, records], index) => (
        <React.Fragment key={id}>
          {index > 0 && ', '}
          <button
            type="button"
            className="font-medium text-primary underline underline-offset-2"
            onClick={() => onOpenRule(id)}
          >
            rule #{diagnoses.get(id)?.order}
          </button>{' '}
          on {countLabel(records, 'record')}
        </React.Fragment>
      ));
  const remove = () => onChanges([{ previous: rule, next: null }]);
  const canMove = !diagnosis.missingIds.length && diagnosis.order < totalRules;
  return (
    <section
      aria-label="Diagnosis"
      className="space-y-2 rounded-lg border border-border p-3 text-sm"
    >
      <p>
        Runs <strong>#{diagnosis.order}</strong> of {totalRules}. It matches{' '}
        {countLabel(diagnosis.matches, 'record')} and sets the winning value on{' '}
        {countLabel(diagnosis.controls, 'record')}.
      </p>
      {diagnosis.overriddenBy.size > 0 && (
        <p className="text-muted-foreground">
          Later rules replace its values: {ruleLinks(diagnosis.overriddenBy)}.
        </p>
      )}
      {diagnosis.overrides.size > 0 && (
        <p className="text-muted-foreground">
          It replaces values from earlier rules: {ruleLinks(diagnosis.overrides)}.
        </p>
      )}
      {diagnosis.issues.map((issue) => (
        <div
          key={issue}
          className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950"
        >
          <p>
            <strong>{issueText[issue].label}.</strong> {issueText[issue].help}
            {issue === 'missing' &&
              ` ${countLabel(diagnosis.missingIds.length, 'reference')} can't be found, and the rule saved no description of them, so MiM can't tell which records they were.`}
            {issue === 'duplicate' && diagnosis.duplicateOf && (
              <>
                {' '}
                Same as{' '}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => onOpenRule(diagnosis.duplicateOf!)}
                >
                  rule #{diagnoses.get(diagnosis.duplicateOf)?.order}
                </button>
                .
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {issue === 'missing' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onChanges([removeMissingReferences(rule, diagnosis.missingIds)])}
              >
                Remove unavailable references
              </Button>
            )}
            {issue === 'conflict' && (
              <Button size="sm" variant="outline" onClick={onShowConflicts}>
                Show the conflicting categories
              </Button>
            )}
            {(issue === 'unmatched' || issue === 'overridden' || issue === 'duplicate') && (
              <Button size="sm" variant="outline" onClick={remove}>
                {issue === 'duplicate' ? 'Delete this copy' : 'Delete rule'}
              </Button>
            )}
          </div>
        </div>
      ))}
      {diagnosis.overriddenBy.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canMove}
            title={
              diagnosis.missingIds.length
                ? 'Remove its unavailable references first.'
                : 'Moves this rule to the end of the rule order, so its values win.'
            }
            onClick={() => onChanges(moveToEnd(rule))}
          >
            Make this rule win
          </Button>
          <span className="text-xs text-muted-foreground">
            Runs it last; it gets a new rule ID. The preview shows every value that changes.
          </span>
        </div>
      )}
      {!diagnosis.issues.length && !diagnosis.overriddenBy.size && (
        <p className="text-emerald-800">No issues found.</p>
      )}
    </section>
  );
}
