/**
 * Top navigation bar with app title, action buttons, and navigation links.
 *
 * @module
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Download,
  HelpCircle,
  History,
  Save,
  Settings,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { useScanStatements, useSaveData } from '../../api/hooks.js';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';

const FLASH_MESSAGE_DURATION_MS = 3000;

/**
 * Top bar component with the application title, Import/Save action buttons,
 * and navigation links to Accounts, Rules, and Settings pages.
 */
export const Header: React.FC = () => {
  const scanMutation = useScanStatements();
  const saveMutation = useSaveData();
  const [helpOpen, setHelpOpen] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (importTimerRef.current) clearTimeout(importTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleImport = () => {
    scanMutation.mutate(undefined, {
      onSuccess: (data) => {
        const failedCount = data.failedFiles?.length ?? 0;
        const base = `Imported ${data.newTransactions} transactions`;
        setImportSuccess(
          failedCount > 0
            ? `${base} (${failedCount} file${failedCount === 1 ? '' : 's'} failed)`
            : base,
        );
        if (importTimerRef.current) clearTimeout(importTimerRef.current);
        importTimerRef.current = setTimeout(() => {
          setImportSuccess(null);
          importTimerRef.current = null;
        }, FLASH_MESSAGE_DURATION_MS);
      },
    });
  };

  const handleSave = () => {
    saveMutation.mutate({ saveMerged: true, saveEdits: true }, {
      onSuccess: () => {
        setSaveSuccess('Saved!');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          setSaveSuccess(null);
          saveTimerRef.current = null;
        }, FLASH_MESSAGE_DURATION_MS);
      },
    });
  };

  const handleShowHelp = useCallback(() => {
    setHelpOpen(true);
  }, []);

  useKeyboardShortcuts({
    onShowHelp: handleShowHelp,
  });

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-background shrink-0">
      {/* Left: App title */}
      <Link to="/" className="flex items-center gap-2 font-bold text-lg text-foreground hover:opacity-80 transition-opacity">
        MoneyInMotion
      </Link>

      {/* Right: Actions and navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleImport}
          disabled={scanMutation.isPending}
        >
          <Download className="h-4 w-4 mr-1.5" />
          {scanMutation.isPending ? 'Scanning...' : 'Import'}
        </Button>
        {scanMutation.isError && (
          <span className="text-destructive text-sm">Import failed</span>
        )}
        {importSuccess && (
          <span className="text-green-600 text-sm">{importSuccess}</span>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          <Save className="h-4 w-4 mr-1.5" />
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        {saveMutation.isError && (
          <span className="text-destructive text-sm">Save failed</span>
        )}
        {saveSuccess && (
          <span className="text-green-600 text-sm">{saveSuccess}</span>
        )}

        <Link to="/accounts">
          <Button variant="ghost" size="sm">
            <CreditCard className="h-4 w-4 mr-1.5" />
            Accounts
          </Button>
        </Link>

        <Link to="/rules">
          <Button variant="ghost" size="sm">
            <History className="h-4 w-4 mr-1.5" />
            Rules
          </Button>
        </Link>

        <Link to="/settings">
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4 mr-1.5" />
            Settings
          </Button>
        </Link>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleShowHelp}
          title="Keyboard shortcuts (?)"
          aria-label="Show keyboard shortcuts"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>

      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
};

Header.displayName = 'Header';
