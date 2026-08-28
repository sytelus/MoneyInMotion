/**
 * Application settings page.
 *
 * Provides data-root, active username, and port configuration plus
 * an explicit maintenance rebuild action.
 *
 * @module
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Download, FolderOpen, Waypoints } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { getConfig, updateConfig } from '../api/client.js';
import { useRebuildSnapshot } from '../api/hooks.js';

function parsePortInput(portInput: string): number | null {
  if (!/^\d+$/.test(portInput.trim())) {
    return null;
  }

  const port = Number(portInput);
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
  const [dataRoot, setDataRoot] = useState('');
  const [originalDataRoot, setOriginalDataRoot] = useState('');
  const [activeDataRoot, setActiveDataRoot] = useState('');
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [activeUsername, setActiveUsername] = useState('');
  const [activeUserDataPath, setActiveUserDataPath] = useState('');
  const [portInput, setPortInput] = useState('3001');
  const [originalPortInput, setOriginalPortInput] = useState('3001');
  const [activePort, setActivePort] = useState(3001);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  /** Fields changed in the most recent successful save ('' when none). */
  const [savedDimensions, setSavedDimensions] = useState<string>('');
  const [configError, setConfigError] = useState<string | null>(null);

  const rebuildMutation = useRebuildSnapshot();

  const savedBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedBannerTimerRef.current) clearTimeout(savedBannerTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getConfig();
        if (!cancelled) {
          setDataRoot(config.dataRoot);
          setOriginalDataRoot(config.dataRoot);
          setActiveDataRoot(config.activeDataRoot);
          setUsername(config.username);
          setOriginalUsername(config.username);
          setActiveUsername(config.activeUsername);
          setActiveUserDataPath(config.activeUserDataPath);
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
  const hasRootChange = dataRoot !== originalDataRoot;
  const hasUsernameChange = username !== originalUsername;
  const hasPortChange = portInput !== originalPortInput;
  const hasChanges = hasRootChange || hasUsernameChange || hasPortChange;
  const pendingRestart =
    originalDataRoot !== activeDataRoot ||
    originalUsername !== activeUsername ||
    Number(originalPortInput) !== activePort;

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
    const payload: { dataRoot?: string; username?: string; port?: number } = {};
    if (hasRootChange) payload.dataRoot = dataRoot;
    if (hasUsernameChange) payload.username = username;
    if (hasPortChange) payload.port = nextPort;

    setIsSavingConfig(true);
    setConfigError(null);
    setSavedDimensions('');

    try {
      const result = await updateConfig(payload);
      const changed: string[] = [];
      if (hasRootChange) changed.push('data root');
      if (hasUsernameChange) changed.push('username');
      if (hasPortChange) changed.push('port');
      setOriginalDataRoot(result.dataRoot);
      setDataRoot(result.dataRoot);
      setActiveDataRoot(result.activeDataRoot);
      setOriginalUsername(result.username);
      setUsername(result.username);
      setActiveUsername(result.activeUsername);
      setActiveUserDataPath(result.activeUserDataPath);
      setOriginalPortInput(String(result.port));
      setPortInput(String(result.port));
      setActivePort(result.activePort);
      setSavedDimensions(changed.join(' and '));
      if (savedBannerTimerRef.current) clearTimeout(savedBannerTimerRef.current);
      savedBannerTimerRef.current = setTimeout(() => {
        setSavedDimensions('');
        savedBannerTimerRef.current = null;
      }, 4000);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRebuild = () => {
    rebuildMutation.mutate(undefined);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-4 h-14 px-4 border-b border-border">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)}>
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
              Configure the multi-user data root, active username, and server port.
            </p>
          </div>

          {isLoadingConfig ? (
            <div className="text-sm text-muted-foreground">Loading configuration...</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="settings-data-root" className="text-sm font-medium">
                  Data Root
                </label>
                <Input
                  id="settings-data-root"
                  value={dataRoot}
                  onChange={(e) => {
                    setDataRoot(e.target.value);
                    setSavedDimensions('');
                  }}
                  placeholder="/home/you/min_root"
                />
                <p className="text-xs text-muted-foreground">
                  This parent folder contains one subfolder per MoneyInMotion username.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="settings-username" className="text-sm font-medium">
                  Active Username
                </label>
                <Input
                  id="settings-username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setSavedDimensions('');
                  }}
                  placeholder="shitals"
                />
                <p className="text-xs text-muted-foreground">
                  This server instance reads and writes{' '}
                  <code>&lt;data-root&gt;/{username || '{username}'}</code>. Authentication and
                  per-request user switching are intentionally deferred.
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
                  Current port:{' '}
                  <code className="px-1 py-0.5 bg-muted rounded">{originalPortInput}</code>
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
                    The server is still using{' '}
                    <code className="px-1 py-0.5 bg-background rounded">{activeUserDataPath}</code>{' '}
                    (root <code>{activeDataRoot}</code>, user <code>{activeUsername}</code>) on port{' '}
                    <code className="px-1 py-0.5 bg-background rounded">{activePort}</code>. Restart
                    to pick up the saved values.
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
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Expected directory structure:
                  </p>
                  <pre className="text-xs text-muted-foreground font-mono leading-relaxed">
                    {`${originalDataRoot || '{dataRoot}'}/
└── ${originalUsername || '{username}'}/
    ├── Statements/          ← Configured account folders
    │   ├── my-checking/
    │   │   ├── AccountConfig.json
    │   │   └── *.csv
    │   └── my-credit-card/
    ├── staging/            ← Upload batches + manifests
    └── Merged/             ← Snapshot + edit rules`}
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
              Rebuild Snapshot
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Maintenance action: rebuild from every retained statement and replay saved edits.
              Folder uploads already do this automatically.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleRebuild}
              disabled={rebuildMutation.isPending}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-1.5" />
              {rebuildMutation.isPending ? 'Rebuilding...' : 'Rebuild from Statements'}
            </Button>

            {rebuildMutation.isSuccess && rebuildMutation.data && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm space-y-2 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">
                  {rebuildMutation.data.committed
                    ? 'Rebuild complete'
                    : 'Previous snapshot preserved'}
                </p>
                <p className="text-emerald-900/90 dark:text-emerald-200/90">
                  {rebuildMutation.data.committed
                    ? `${rebuildMutation.data.totalTransactions} transactions rebuilt across all accounts; ${rebuildMutation.data.appliedEdits} saved rules replayed.`
                    : 'One or more statements could not be parsed, so MoneyInMotion did not replace the last known-good snapshot.'}
                </p>
                {rebuildMutation.data.migratedEditTargets > 0 && (
                  <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80">
                    Migrated {rebuildMutation.data.migratedEditTargets} legacy exact-ID rule target
                    {rebuildMutation.data.migratedEditTargets === 1 ? '' : 's'} to stable rebuilt
                    transactions.
                  </p>
                )}
                {rebuildMutation.data.unresolvedEditTargets > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                    {rebuildMutation.data.unresolvedEditTargets} legacy exact-ID rule target
                    {rebuildMutation.data.unresolvedEditTargets === 1 ? '' : 's'} could not be
                    resolved uniquely. MiM retained them unchanged for review in Rules.
                  </div>
                )}
                {rebuildMutation.data.failedFiles?.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs space-y-1 dark:border-amber-900/40 dark:bg-amber-900/20">
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      {rebuildMutation.data.failedFiles.length} file
                      {rebuildMutation.data.failedFiles.length === 1 ? '' : 's'} could not be
                      parsed:
                    </p>
                    <ul className="space-y-0.5 text-amber-900/90 dark:text-amber-200/90">
                      {rebuildMutation.data.failedFiles.map((f) => (
                        <li key={f.path}>
                          <code>{f.path}</code> — {f.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {rebuildMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {rebuildMutation.error instanceof Error
                  ? rebuildMutation.error.message
                  : 'Import failed'}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

SettingsPage.displayName = 'SettingsPage';
