/**
 * Top navigation bar with app title, action buttons, and navigation links.
 *
 * @module
 */

import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Download, Save, Settings, CreditCard, HelpCircle } from 'lucide-react';
import { Button } from '../ui/button.js';
import { useScanStatements, useSaveData } from '../../api/hooks.js';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';

/**
 * Top bar component with the application title, Import/Save action buttons,
 * and navigation links to Accounts and Settings pages.
 */
export const Header: React.FC = () => {
  const scanMutation = useScanStatements();
  const saveMutation = useSaveData();
  const [helpOpen, setHelpOpen] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const handleImport = () => {
    scanMutation.mutate(undefined, {
      onSuccess: (data) => {
        setImportSuccess(`Imported ${data.newTransactions} transactions`);
        setTimeout(() => setImportSuccess(null), 3000);
      },
    });
  };

  const handleSave = () => {
    saveMutation.mutate({ saveMerged: true, saveEdits: true }, {
      onSuccess: () => {
        setSaveSuccess('Saved!');
        setTimeout(() => setSaveSuccess(null), 3000);
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
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>

      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
};

Header.displayName = 'Header';
