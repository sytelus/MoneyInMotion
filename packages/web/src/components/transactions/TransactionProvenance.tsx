import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, GitBranch, History, ShieldCheck } from 'lucide-react';
import type { Transaction, Transactions } from '@moneyinmotion/core';
import { transactionProvenance, provenanceTimestamp } from '../../lib/transaction-provenance.js';
import { fieldNames, transactionRuleEffects } from '../../lib/rule-effects.js';
import { ruleChangesLabel, scopeLabel } from '../../lib/rules.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { formatDate } from '../../lib/utils.js';
import { HelpHint } from '../ui/help-hint.js';
import { Badge } from '../ui/badge.js';

/** Source evidence and the current correction chain; never invents historical import events. */
export function TransactionProvenance({
  transaction,
  transactions,
}: {
  transaction: Transaction;
  transactions: Transactions;
}) {
  const provenance = transactionProvenance(transaction, transactions);
  const effects = transactionRuleEffects(transaction, [...transactions.getClonedEdits()]);
  const incompleteHistory = effects.some((effect) => !effect.rule);
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <section
        aria-label="Statement source"
        className="rounded-lg border border-border bg-muted/30 p-3 text-xs"
      >
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4 text-primary" />
          Statement source
        </h3>
        <p className="break-words font-medium">{provenance.source.portableAddress}</p>
        <p className="mt-1 text-muted-foreground">
          {provenance.source.format?.toUpperCase() || 'Format not recorded'}
          {provenance.sourceRow != null ? ` · Source row ${provenance.sourceRow}` : ''}
        </p>
        <Link
          className="mt-2 inline-block font-medium text-primary underline underline-offset-2"
          to={transactionsHref({ source: transaction.importId, basis: 'records', view: 'list' })}
        >
          Explore this statement’s records
        </Link>
        {provenance.postedDate && (
          <p className="mt-2">Posted by institution: {formatDate(provenance.postedDate)}</p>
        )}
        {provenance.institutionReference && (
          <p className="mt-1 break-all">Institution reference: {provenance.institutionReference}</p>
        )}
      </section>

      <section aria-label="Corrections and rules" className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Corrections &amp; rules</h3>
          <HelpHint title="Current correction chain">
            <p>
              The newest applicable rule wins for each field. Restoring an imported value also
              overrides earlier corrections. A rule may control one field while another field is
              overridden.
            </p>
            <p>
              This is the currently saved rule chain, not a complete history of past rule versions
              or deleted rules. Record counts can include source and item records that are not
              summed together in reports.
            </p>
          </HelpHint>
        </div>
        {incompleteHistory && (
          <p className="rounded-md bg-amber-50 p-2 text-amber-900">
            Some recorded rules are unavailable. The latest known writers below may not explain
            every current value.
          </p>
        )}
        {effects.length === 0 ? (
          <p className="text-muted-foreground">
            No saved rules are recorded on this transaction. Original statement values are in use
            unless the snapshot contains an unrecorded correction.
          </p>
        ) : (
          <ol className="space-y-2">
            {effects.map((effect) => (
              <li key={effect.id} className="rounded-md border border-border p-3">
                {!effect.rule ? (
                  <p className="break-all text-amber-800">Unavailable rule · {effect.id}</p>
                ) : (
                  <>
                    <Link
                      className="font-medium text-primary underline underline-offset-2"
                      to={`/rules?rule=${encodeURIComponent(effect.id)}`}
                    >
                      Rule {effect.order}: {ruleChangesLabel(effect.rule.values)}
                    </Link>
                    <p className="mt-1 break-words text-muted-foreground">
                      {effect.rule.scopeFilters.map(scopeLabel).join(' AND ')}
                    </p>
                    {effect.effective.length > 0 && (
                      <p className="mt-2 text-emerald-800">
                        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                        {incompleteHistory ? 'Latest known writer' : 'Controls'}:{' '}
                        {fieldNames(effect.effective)}
                      </p>
                    )}
                    {effect.overridden.length > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        Overridden by later rules: {fieldNames(effect.overridden)}
                      </p>
                    )}
                    <p className="mt-2 text-muted-foreground">
                      Rule created {provenanceTimestamp(effect.rule.auditInfo.createDate)}
                    </p>
                    {effect.rule.auditInfo.updateDate && (
                      <p className="mt-1 text-muted-foreground">
                        Last edited {provenanceTimestamp(effect.rule.auditInfo.updateDate)}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className="border-t border-border pt-3 text-xs">
        <summary className="cursor-pointer font-medium">
          <History className="mr-1 inline h-4 w-4" />
          Processing metadata &amp; time limitations
        </summary>
        <div className="mt-3 space-y-3">
          <Badge variant="secondary">First import time: not recorded reliably</Badge>
          <dl className="space-y-2 break-words">
            <dt className="font-medium">File creation time</dt>
            <dd>{provenanceTimestamp(provenance.source.createDate)}</dd>
            <dt className="font-medium">File modification time</dt>
            <dd>{provenanceTimestamp(provenance.source.updateDate)}</dd>
            <dt className="font-medium">Record created / rebuilt</dt>
            <dd>
              {provenanceTimestamp(provenance.recordCreatedAt)} · {provenance.recordCreatedBy}
            </dd>
            <dt className="font-medium">Latest record update / replay</dt>
            <dd>
              {provenanceTimestamp(provenance.recordUpdatedAt)}
              {provenance.recordUpdatedBy ? ` · ${provenance.recordUpdatedBy}` : ''}
            </dd>
          </dl>
          <p className="rounded-md bg-muted p-3 text-muted-foreground">
            File times come from the filesystem and can change when files are copied. Record
            timestamps can change during rebuild or rule replay. Neither proves when a statement was
            first imported. Producer names identify software or recorded metadata, not a verified
            person.
          </p>
        </div>
      </details>
    </div>
  );
}
