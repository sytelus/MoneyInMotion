/**
 * Application settings page.
 *
 * Provides data path configuration and an import trigger button.
 * Replaces the Phase 6 placeholder.
 *
 * @module
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Download, Check, AlertCircle, Save } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { getConfig, updateConfig } from '../api/client.js';
import { useScanStatements, useSaveData } from '../api/hooks.js';

/**
 * Settings page with data path configuration and statement import controls.
 */
export const SettingsPage: React.FC = () => {
  const [dataPath, setDataPath] = useState('');
  const [originalPath, setOriginalPath] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingPath, setIsSavingPath] = useState(false);
  const [pathSaved, setPathSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const scanMutation = useScanStatements();
  const saveMutation = useSaveData();
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load current config on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getConfig();
        if (!cancelled) {
          setDataPath(config.dataPath);
          setOriginalPath(config.dataPath);
          setIsLoadingConfig(false);
        }
      } catch (err) {
        if (!cancelled) {
          setConfigError(err instanceof Error ? err.message : 'Failed to load config');
          setIsLoadingConfig(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasPathChanged = dataPath !== originalPath;

  const handleUpdatePath = async () => {
    if (!hasPathChanged) return;
    setIsSavingPath(true);
    setConfigError(null);
    setPathSaved(false);

    try {
      const result = await updateConfig(dataPath);
      setOriginalPath(result.dataPath);
      setDataPath(result.dataPath);
      setPathSaved(true);
      setTimeout(() => setPathSaved(false), 3000);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to update path');
    } finally {
      setIsSavingPath(false);
    }
  };

  const handleScan = () => {
    scanMutation.mutate(undefined);
  };

  const handleSave = () => {
    setSaveSuccess(false);
    saveMutation.mutate(
      { saveMerged: true, saveEdits: true },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-4 h-14 px-4 border-b border-border">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="font-bold text-lg">Settings</h1>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-8">
        {/* Data Path Section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Data Directory
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              This is where MoneyInMotion stores all your data. The folder should contain
              a &lsquo;Statements&rsquo; subfolder with your account directories.
            </p>
          </div>

          {isLoadingConfig ? (
            <div className="text-sm text-muted-foreground">Loading configuration...</div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={dataPath}
                  onChange={(e) => {
                    setDataPath(e.target.value);
                    setPathSaved(false);
                  }}
                  placeholder="/path/to/data"
                  className="flex-1"
                />
                <Button
                  onClick={handleUpdatePath}
                  disabled={!hasPathChanged || isSavingPath}
                  variant={hasPathChanged ? 'default' : 'outline'}
                >
                  {isSavingPath ? 'Updating...' : 'Update'}
                </Button>
              </div>

              {pathSaved && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  Path updated successfully
                </div>
              )}

              {configError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {configError}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Current path: <code className="px-1 py-0.5 bg-muted rounded">{originalPath}</code>
              </p>

              {/* Directory structure illustration */}
              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Expected directory structure:</p>
                <pre className="text-xs text-muted-foreground font-mono leading-relaxed">
{`${originalPath || '{dataPath}'}/
├── Statements/          ← Put account folders here
│   ├── my-checking/     ← Example account folder
│   │   └── *.csv        ← Statement files
│   └── my-credit-card/
└── Merged/              ← Auto-generated`}
                </pre>
              </div>
            </div>
          )}
        </section>

        {/* Import Section */}
        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import Statements
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Scan all account folders for new statement files. New transactions are
              automatically deduplicated — re-importing the same file is safe.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleScan}
              disabled={scanMutation.isPending}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-1.5" />
              {scanMutation.isPending ? 'Scanning...' : 'Scan & Import Statements'}
            </Button>

            {scanMutation.isSuccess && scanMutation.data && (
              <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-sm space-y-2">
                <p className="font-medium text-green-800 dark:text-green-200">
                  Import complete
                </p>
                <p className="text-green-700 dark:text-green-300">
                  Imported {scanMutation.data.newTransactions} new transaction(s) out of{' '}
                  {scanMutation.data.totalTransactions} total.
                </p>
                <p className="text-green-700 dark:text-green-300">
                  Total: {scanMutation.data.totalTransactions} transactions across all accounts.
                </p>
              </div>
            )}

            {scanMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {scanMutation.error instanceof Error
                  ? scanMutation.error.message
                  : 'Import failed'}
              </div>
            )}
          </div>
        </section>

        {/* Save Section */}
        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Save className="h-5 w-5" />
              Save Data
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Save imported data to disk so it persists between sessions.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {saveMutation.isPending ? 'Saving...' : 'Save to Disk'}
              </Button>
              {saveSuccess && (
                <span className="text-sm text-green-600 flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  Saved successfully!
                </span>
              )}
            </div>

            {saveMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {saveMutation.error instanceof Error
                  ? saveMutation.error.message
                  : 'Save failed'}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

SettingsPage.displayName = 'SettingsPage';
