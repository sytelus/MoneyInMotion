import React from 'react';
import { Link } from 'react-router-dom';
import type { StatementEntry } from '../../api/imports.js';
import { useStatementInventory } from '../../api/hooks.js';
import { countLabel } from '../../lib/utils.js';
import { buttonClassName } from '../ui/button.js';
import { Notice } from '../ui/notice.js';

const SHOWN = 10;

/**
 * Stored files that no rebuild reads and that may be renamed statements:
 * an unknown file type, and not another format of a file that is imported.
 */
export function UnrecognizedFilesNotice({
  entries,
  action,
}: {
  entries: readonly StatementEntry[];
  action?: React.ReactNode;
}) {
  const files = entries.filter((entry) => entry.status === 'unrecognized');
  if (!files.length) return null;
  return (
    <Notice
      tone="warning"
      title={`${countLabel(files.length, 'stored file')} ${files.length === 1 ? 'is' : 'are'} not imported`}
      actions={action}
    >
      <p>
        {files.length === 1 ? 'This file is' : 'These files are'} in your statement folders, but
        MoneyInMotion doesn’t recognize the file type, so rebuilds skip{' '}
        {files.length === 1 ? 'it' : 'them'}. Any transactions in{' '}
        {files.length === 1 ? 'it' : 'them'} are not in your history. To import one, rename it to
        the type its folder imports (if it’s in a layout MoneyInMotion reads) and rebuild.
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        {files.slice(0, SHOWN).map((file) => (
          <li key={file.path} className="break-all">
            {file.path}
          </li>
        ))}
      </ul>
      {files.length > SHOWN && <p className="mt-1">…and {files.length - SHOWN} more.</p>}
    </Notice>
  );
}

/** The same notice on the import tab, linking to the files in the Statement explorer. */
export function StoredFilesNotImported() {
  const inventory = useStatementInventory();
  if (!inventory.data) return null;
  return (
    <UnrecognizedFilesNotice
      entries={inventory.data.entries}
      action={
        <Link
          to="/imports?tab=files&fileStatus=unrecognized"
          className={buttonClassName({ variant: 'outline', size: 'sm' })}
        >
          Review in Statement explorer
        </Link>
      }
    />
  );
}
