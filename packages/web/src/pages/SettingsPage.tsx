/**
 * Application settings page.
 *
 * Provides data-path and port configuration plus import/save actions.
 *
 * @module
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [dataPath, setDataPath] = useState('');
  const [originalPath, setOriginalPath] = useState('');
  const [activeDataPath, setActiveDataPath] = useState('');
  const [portInput, setPortInput] = useState('3001');
  const [originalPortInput, setOriginalPortInput] = useState('3001');
  const [activePort, setActivePort] = useState(3001);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  /** Fields changed in the most recent successful save ('' when none). */
  const [savedDimensions, setSavedDimensions] = useState<string>('');
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
          setActiveDataPath(config.activeDataPath);
          setPortInput(String(config.port));
          setOriginalPortInput(String(config.port));
          setActivePort(config.activePort);
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
  const hasPathChange = dataPath !== originalPath;
  const hasPortChange = portInput !== originalPortInput;
  const hasChanges = hasPathChange || hasPortChange;
  const pendingRestart =
    originalPath !== activeDataPath || Number(originalPortInput) !== activePort;

  const handleSaveConfig = async () => {
    if (!hasChanges) {
      return;
    }

    const nextPort = parsePortInput(portInput);
    if (nextPort == null) {
      setConfigError('Port must be an integer between 1 and 65535.');
      return;
    }

    // Only include fields that actually changed. Sending unchanged values
    // confused the UI into reporting "port or data directory changed" even
    // when just the path was edited.
    const payload: { dataPath?: string; port?: number } = {};
    if (hasPathChange) payload.dataPath = dataPath;
    if (hasPortChange) payload.port = nextPort;

    setIsSavingConfig(true);
    setConfigError(null);
    setSavedDimensions('');

    try {
      const result = await updateConfig(payload);
      const changed: string[] = [];
      if (hasPathChange) changed.push('data directory');
      if (hasPortChange) changed.push('port');
      setOriginalPath(result.dataPath);
      setDataPath(result.dataPath);
      setActiveDataPath(result.activeDataPath);
      setOriginalPortInput(String(result.port));
      setPortInput(String(result.port));
      setActivePort(result.activePort);
      setSavedDimensions(changed.join(' and '));
      setTimeout(() => setSavedDimensions(''), 4000);
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
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
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
                    setSavedDimensions('');
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
                    setSavedDimensions('');
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

              {savedDimensions && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm space-y-1 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                  <p className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-200">
                    <Check className="h-4 w-4" />
                    Saved {savedDimensions} to the config file.
                  </p>
                  <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80">
                    Restart the server for the new {savedDimensions} to take effect.
                  </p>
                </div>
              )}

              {pendingRestart && !savedDimensions && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-900/20">
                  <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4" />
                    Saved settings differ from the running server.
                  </p>
                  <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                    The server is still using data path{' '}
                    <code className="px-1 py-0.5 bg-background rounded">{activeDataPath}</code>{' '}
                    on port{' '}
                    <code className="px-1 py-0.5 bg-background rounded">{activePort}</code>.
                    Restart to pick up the saved values.
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
                    Currently running on
                  </p>
                  <code className="text-xs px-1 py-0.5 bg-muted rounded">
                    http://localhost:{activePort}
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
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm space-y-2 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">
                  Import complete
                </p>
                <p className="text-emerald-900/90 dark:text-emerald-200/90">
                  {scanMutation.data.newTransactions} new transaction
                  {scanMutation.data.newTransactions === 1 ? '' : 's'} imported
                  {' — '}
                  {scanMutation.data.totalTransactions} total across all accounts.
                </p>
                {scanMutation.data.failedFiles?.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs space-y-1 dark:border-amber-900/40 dark:bg-amber-900/20">
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      {scanMutation.data.failedFiles.length} file
                      {scanMutation.data.failedFiles.length === 1 ? '' : 's'} could not be parsed:
                    </p>
                    <ul className="space-y-0.5 text-amber-900/90 dark:text-amber-200/90">
                      {scanMutation.data.failedFiles.map((f) => (
                        <li key={f.path}>
                          <code>{f.path}</code> — {f.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-200">
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
