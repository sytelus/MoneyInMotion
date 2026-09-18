import React from 'react';
import { Link } from 'react-router-dom';
import { HelpHint } from '../ui/help-hint.js';

export function MissingRuleTargets({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-1 text-sm">
      <p>
        {count} saved transaction reference{count === 1 ? ' is' : 's are'} unavailable. The rules
        are preserved.{' '}
        <Link to="/rules" className="underline underline-offset-2">
          Review rules needing attention
        </Link>
        .
      </p>
      <HelpHint title="Unavailable transaction references">
        <p>
          A saved rule points to a transaction that is not in the current history, so that part of
          the rule cannot apply. It does not mean a dollar amount is missing.
        </p>
        <p>
          Check that all retained statements are included. Then use Rules → Needs attention to edit
          the target or delete an obsolete rule. The app will not guess a replacement.
        </p>
      </HelpHint>
    </div>
  );
}
