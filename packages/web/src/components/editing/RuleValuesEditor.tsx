import React from 'react';
import {
  editValue,
  voidedEditValue,
  transactionReasonTitleLookup,
  type EditedValues,
} from '@moneyinmotion/core';
import { ruleFields } from '../../lib/rules.js';
import { Select } from '../ui/select.js';
import { Input } from '../ui/input.js';
import { HelpHint } from '../ui/help-hint.js';

export function RuleValuesEditor({
  values,
  onChange,
  bulk = false,
}: {
  values: EditedValues;
  onChange: (values: EditedValues) => void;
  bulk?: boolean;
}) {
  const update = (key: keyof EditedValues, value: EditedValues[keyof EditedValues]) =>
    onChange({ ...values, [key]: value });
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 font-semibold">Changes to make</legend>
      {ruleFields.map(({ key, label }) => {
        const field = values[key];
        const mode = field == null ? 'keep' : field.isVoided ? 'reset' : 'set';
        return (
          <div key={key} className="space-y-1 rounded-md border border-border p-3">
            <div className="flex items-center gap-1">
              <label htmlFor={`rule-mode-${key}`} className="text-sm font-medium">
                {label}
              </label>
              {key === 'isFlagged' && (
                <HelpHint title="Mark for review">
                  Adds a personal reminder flag to matching transactions so you can find them using
                  the “Marked for review” filter. It does not change amounts, categories, or whether
                  a transaction is included in totals.
                </HelpHint>
              )}
            </div>
            <Select
              id={`rule-mode-${key}`}
              value={mode}
              onChange={(e) =>
                update(
                  key,
                  e.target.value === 'keep'
                    ? null
                    : e.target.value === 'reset'
                      ? voidedEditValue()
                      : editValue(
                          key === 'isFlagged'
                            ? true
                            : key === 'amount' || key === 'transactionReason'
                              ? 0
                              : key === 'categoryPath'
                                ? ['']
                                : '',
                        ),
                )
              }
              options={[
                {
                  value: 'keep',
                  label: bulk ? 'Keep each rule’s current setting' : 'Do not change this field',
                },
                { value: 'set', label: 'Set a value' },
                { value: 'reset', label: 'Restore imported value' },
              ]}
            />
            {mode === 'set' &&
              (key === 'isFlagged' ? (
                <Select
                  aria-label={`${label} value`}
                  value={String(field!.value)}
                  options={[
                    { value: 'true', label: 'Yes — mark for review' },
                    { value: 'false', label: 'No — clear review mark' },
                  ]}
                  onChange={(e) => update(key, editValue(e.target.value === 'true'))}
                />
              ) : key === 'transactionReason' ? (
                <Select
                  aria-label={`${label} value`}
                  value={String(field!.value)}
                  options={Object.entries(transactionReasonTitleLookup).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  onChange={(e) => update(key, editValue(Number(e.target.value)))}
                />
              ) : (
                <Input
                  aria-label={`${label} value`}
                  type={key === 'amount' ? 'number' : key === 'transactionDate' ? 'date' : 'text'}
                  step={key === 'amount' ? '0.01' : undefined}
                  value={
                    key === 'categoryPath'
                      ? (field!.value as string[]).join(' / ')
                      : key === 'transactionDate'
                        ? String(field!.value).slice(0, 10)
                        : String(field!.value)
                  }
                  placeholder={key === 'categoryPath' ? 'Shopping / Home' : undefined}
                  onChange={(e) =>
                    update(
                      key,
                      editValue(
                        key === 'amount'
                          ? e.target.value === ''
                            ? NaN
                            : Number(e.target.value)
                          : key === 'categoryPath'
                            ? e.target.value.split('/').map((s) => s.trim())
                            : key === 'transactionDate' && e.target.value
                              ? `${e.target.value}T00:00:00.000Z`
                              : e.target.value,
                      ),
                    )
                  }
                />
              ))}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        “Restore imported value” clears the field’s overrides, including those from earlier rules.
        Deleting a rule is different: it lets earlier rules take effect again.
      </p>
    </fieldset>
  );
}
