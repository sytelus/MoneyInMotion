/**
 * Application settings page.
 *
 * Provides data-path and port configuration plus import/save actions.
 *
 * @module
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FolderOpen,
  Save,
  Waypoints,
} from 'lucide-react';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { getConfig, updateConfig } from '../api/client.js';
import { useScanStatements, useSaveData } from '../api/hooks.js';

function parsePortInput(portInput: string): number | null {
  if (!/^\d+$/.test(portInput.trim())) {
    return null;
  }

  const port = Number.parseInt(portInput, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return port;
}

/**
 * Settings page with configuration and import controls.
 */
export const SettingsPage: React.FC = () => {
  const [dataPath, setDataPath] = useState('');
  const [originalPath, setOriginalPath] = useState('');
  const [portInput, setPortInput] = useState('3001');
  const [originalPortInput, setOriginalPortInput] = useState('3001');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const scanMutation = useScanStatements();
  const saveMutation = useSaveData();
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getConfig();
        if (!cancelled) {
          setDataPath(config.dataPath);
          setOriginalPath(config.dataPath);
          setPortInput(String(config.port));
          setOriginalPortInput(String(config.port));
          setIsLoadingConfig(false);
        }
      } catch (err) {
        if (!cancelled) {
          setConfigError(err instanceof Error ? err.message : 'Failed to load config');
          setIsLoadingConfig(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const parsedPort = parsePortInput(portInput);
  const hasChanges = dataPath !== originalPath || portInput !== originalPortInput;

  const handleSaveConfig = async () => {
    if (!hasChanges) {
      return;
    }

    const nextPort = parsePortInput(portInput);
    if (nextPort == null) {
      setConfigError('Port must be an integer between 1 and 65535.');
      return;
    }

    setIsSavingConfig(true);
    setConfigError(null);
    setConfigSaved(false);

    try {
      const result = await updateConfig({
        dataPath,
        port: nextPort,
      });
      setOriginalPath(result.dataPath);
      setDataPath(result.dataPath);
      setOriginalPortInput(String(result.port));
      setPortInput(String(result.port));
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSavingConfig(false);
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
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Application Configuration
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure where MoneyInMotion stores data and which port the server listens on.
            </p>
          </div>

          {isLoadingConfig ? (
            <div className="text-sm text-muted-foreground">Loading configuration...</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="settings-data-path" className="text-sm font-medium">
                  Data Directory
                </label>
                <Input
                  id="settings-data-path"
                  value={dataPath}
                  onChange={(e) => {
                    setDataPath(e.target.value);
                    setConfigSaved(false);
                  }}
                  placeholder="/path/to/data"
                />
                <p className="text-xs text-muted-foreground">
                  This folder should contain the <code>Statements/</code> and <code>Merged/</code> subfolders.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="settings-port" className="text-sm font-medium">
                  Server Port
                </label>
                <Input
                  id="settings-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={portInput}
                  onChange={(e) => {
                    setPortInput(e.target.value);
                    setConfigSaved(false);
                  }}
                  placeholder="3001"
                />
                <p className="text-xs text-muted-foreground">
                  Change this if another app is already using the default port.
                </p>
                {portInput.trim().length > 0 && parsedPort == null && (
                  <p className="text-xs text-destructive">
                    Port must be an integer between 1 and 65535.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleSaveConfig}
                  disabled={!hasChanges || isSavingConfig || parsedPort == null}
                  variant={hasChanges ? 'default' : 'outline'}
                >
                  {isSavingConfig ? 'Updating...' : 'Save Settings'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Current port: <code className="px-1 py-0.5 bg-muted rounded">{originalPortInput}</code>
                </p>
              </div>

              {configSaved && (
                <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm space-y-1">
                  <p className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
                    <Check className="h-4 w-4" />
                    Settings saved to the config file.
                  </p>
                  <p className="text-xs text-green-700/80 dark:text-green-400/80">
                    Restart the server to apply the new data directory or port.
                  </p>
                </div>
              )}

              {configError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {configError}
                </div>
              )}

              <div className="rounded-md bg-muted/50 p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Expected directory structure:</p>
                  <pre className="text-xs text-muted-foreground font-mono leading-relaxed">
{`${originalPath || '{dataPath}'}/
├── Statements/          ← Put account folders here
│   ├── my-checking/
│   │   └── *.csv
│   └── my-credit-card/
└── Merged/              ← Auto-generated`}
                  </pre>
                </div>

                <div className="border-t border-border/60 pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Waypoints className="h-3.5 w-3.5" />
                    Current server endpoint
                  </p>
                  <code className="text-xs px-1 py-0.5 bg-muted rounded">
                    http://localhost:{originalPortInput}
                  </code>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import Statements
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Scan all account folders for new statement files. Re-importing the same file is safe because duplicates are merged by content hash.
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
