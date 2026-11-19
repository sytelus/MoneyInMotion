import React from 'react';
import { CheckCircle2, CircleSlash, Copy, Layers, Link2Off, Shuffle } from 'lucide-react';
import { issueText, type RuleHealth, type RuleIssue } from '../../lib/rule-diagnostics.js';

const CARDS: Array<{ key: RuleIssue | 'healthy'; Icon: typeof Layers; unit: string }> = [
  { key: 'unmatched', Icon: CircleSlash, unit: 'rules' },
  { key: 'overridden', Icon: Layers, unit: 'rules' },
  { key: 'duplicate', Icon: Copy, unit: 'rules' },
  { key: 'missing', Icon: Link2Off, unit: 'rules' },
  { key: 'conflict', Icon: Shuffle, unit: 'merchants' },
  { key: 'healthy', Icon: CheckCircle2, unit: 'rules' },
];

/** One button per kind of issue; choosing one filters the studio to it. */
export function RuleHealthPanel({
  health,
  active,
  onSelect,
}: {
  health: RuleHealth;
  active: string;
  onSelect: (status: string) => void;
}) {
  return (
    <section aria-label="Rule health" className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {CARDS.map(({ key, Icon, unit }) => {
        const count = health.counts[key];
        const pressed = active === key;
        const label = key === 'healthy' ? 'Working as expected' : issueText[key].label;
        const help =
          key === 'healthy'
            ? 'Matches records and controls at least one value, with no issues.'
            : issueText[key].help;
        const tone =
          key === 'healthy'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : count
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-border bg-background text-muted-foreground';
        return (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            title={help}
            onClick={() => onSelect(pressed ? 'all' : key)}
            className={`rounded-xl border p-3 text-left transition-shadow hover:shadow-md ${tone} ${pressed ? 'ring-2 ring-primary' : ''}`}
          >
            <span className="flex items-center justify-between gap-2 text-xs font-semibold">
              {label}
              <Icon aria-hidden className="h-4 w-4 shrink-0" />
            </span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums text-slate-900">
              {count.toLocaleString()}
            </span>
            <span className="block text-xs">{count === 1 ? unit.slice(0, -1) : unit}</span>
          </button>
        );
      })}
    </section>
  );
}
