/**
 * Server configuration and username-scoped storage paths.
 *
 * MoneyInMotion deliberately keeps the physical storage contract small and
 * transparent. A running server instance serves exactly one configured
 * username directory beneath `dataRoot`.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeTextFileAtomically } from './storage/atomic-file.js';
import { hasParentSegment, isPortableName } from './storage/path-names.js';
import * as os from 'node:os';

export interface ServerConfig {
  /** Port to listen on. Default: 3001. */
  port: number;
  /** Parent folder containing one directory per MoneyInMotion user. */
  dataRoot: string;
  /** Username whose data is served by this process. */
  username: string;
  /** Derived absolute path `<dataRoot>/<username>`. */
  userDataPath: string;
  /** Derived statement account tree. */
  statementsDir: string;
  /** Derived generated snapshot/edit directory. */
  mergedDir: string;
  /** Derived upload staging directory. */
  stagingDir: string;
}

interface PersistedConfig {
  port?: number;
  dataRoot?: string;
  username?: string;
  /** Legacy single-user setting retained only for automatic migration. */
  dataPath?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.moneyinmotion');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_DATA_ROOT = path.join(os.homedir(), 'mim_root');
const DEFAULT_PORT = 3001;

/** Canonical path shared by Settings and full-data recovery. No environment override. */
export function getConfigFilePath(): string {
  return CONFIG_FILE;
}

/** Restrict usernames to a single safe path segment. */
export function isValidUsername(username: string): boolean {
  return (
    username !== '.' &&
    /^[a-zA-Z0-9._-]+$/.test(username) &&
    !username.includes('..') &&
    isPortableName(username)
  );
}

/**
 * Default username from the OS account. Windows names may contain spaces or
 * other characters a folder name must not, so replace them instead of
 * refusing to start on first run.
 */
export function defaultUsername(): string {
  const cleaned = os
    .userInfo()
    .username.replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/[._]+$/, '');
  return isValidUsername(cleaned) ? cleaned : 'user';
}

function ensureDirExists(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/** Build all derived paths from the two configurable storage coordinates. */
export function buildConfig(dataRoot: string, username: string, port: number): ServerConfig {
  if (!path.isAbsolute(dataRoot)) {
    throw new Error(`MoneyInMotion data root must be absolute: "${dataRoot}"`);
  }
  // Windows accepts both separators, so check both on every platform.
  if (hasParentSegment(dataRoot)) {
    throw new Error('MoneyInMotion data root must not contain ".." path segments.');
  }
  if (!isValidUsername(username)) {
    throw new Error(
      'MoneyInMotion username may contain only letters, numbers, dots, hyphens, and underscores, and must not be ".".',
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MoneyInMotion port must be an integer between 1 and 65535.');
  }

  // Drop a trailing separator ("E:\data\") so derived paths compare cleanly.
  const normalized = path.normalize(dataRoot);
  const normalizedDataRoot =
    normalized.length > path.parse(normalized).root.length
      ? normalized.replace(/[\\/]+$/, '')
      : normalized;
  const userDataPath = path.join(normalizedDataRoot, username);
  return {
    port,
    dataRoot: normalizedDataRoot,
    username,
    userDataPath,
    statementsDir: path.join(userDataPath, 'Statements'),
    mergedDir: path.join(userDataPath, 'Merged'),
    stagingDir: path.join(userDataPath, 'staging'),
  };
}

/** Parse a persisted or submitted port without accepting partial numbers. */
export function parseConfiguredPort(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : null;
}

function loadPersistedConfig(configFile = CONFIG_FILE): PersistedConfig {
  if (!fs.existsSync(configFile)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as unknown;
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('the root value must be a JSON object');
    }

    const raw = parsed as Record<string, unknown>;
    const config: PersistedConfig = {};
    if (raw.port != null) {
      const port = parseConfiguredPort(raw.port);
      if (port == null) throw new Error('port must be an integer from 1 to 65535');
      config.port = port;
    }
    for (const key of ['dataRoot', 'username', 'dataPath'] as const) {
      const value = raw[key];
      if (value == null) continue;
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${key} must be a non-empty string`);
      }
      config[key] = value;
    }
    return config;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    // A hand-typed Windows path such as "E:\data" is the most common mistake:
    // JSON treats a single backslash as an escape character.
    const windowsPathHint =
      err instanceof SyntaxError && /escape/i.test(reason)
        ? ' Write Windows paths with forward slashes ("E:/data/mim_root") or doubled backslashes ("E:\\\\data\\\\mim_root").'
        : '';
    // Fail closed instead of silently serving the default data directory.
    // Selecting a different financial history is more dangerous than refusing
    // to start, and preserving the original file lets the user repair it.
    throw new Error(
      `MoneyInMotion config "${configFile}" is invalid: ${reason}.${windowsPathHint} ` +
        'Fix the file or move it aside to recreate safe defaults.',
      { cause: err },
    );
  }
}

/**
 * Translate the old per-user `dataPath` into the new root + username pair.
 * This lets existing deployments keep working without nesting another user
 * directory underneath their former data folder.
 */
function migrateLegacyDataPath(fileConfig: PersistedConfig): {
  dataRoot?: string;
  username?: string;
} {
  if (fileConfig.dataRoot || !fileConfig.dataPath) {
    return {};
  }

  const normalized = path.normalize(fileConfig.dataPath);
  return {
    dataRoot: path.dirname(normalized),
    username: path.basename(normalized),
  };
}

/**
 * Load the single canonical configuration file, creating it with safe defaults
 * on first start. A legacy `dataPath` inside that file is migrated once to the
 * current root + username shape; process environment variables are deliberately
 * ignored so Settings and the file can never disagree about the source of truth.
 */
export function loadConfig(
  options: { ensureDirectories?: boolean; configFile?: string } = {},
): ServerConfig {
  const configFile = options.configFile ?? CONFIG_FILE;
  const fileConfig = loadPersistedConfig(configFile);
  const migrated = migrateLegacyDataPath(fileConfig);

  const dataRoot = fileConfig.dataRoot ?? migrated.dataRoot ?? DEFAULT_DATA_ROOT;
  const username = fileConfig.username ?? migrated.username ?? defaultUsername();
  const port = parseConfiguredPort(fileConfig.port) ?? DEFAULT_PORT;

  const config = buildConfig(dataRoot, username, port);

  // Materialize defaults and complete one-time legacy migration so every
  // subsequent read has exactly one explicit, human-editable source.
  if (
    !fs.existsSync(configFile) ||
    fileConfig.dataRoot !== config.dataRoot ||
    fileConfig.username !== config.username ||
    fileConfig.port !== config.port ||
    fileConfig.dataPath != null
  ) {
    ensureDirExists(path.dirname(configFile));
    writeTextFileAtomically(
      configFile,
      JSON.stringify(
        { dataRoot: config.dataRoot, username: config.username, port: config.port },
        null,
        2,
      ),
    );
  }

  if (options.ensureDirectories !== false) {
    // Startup creates the complete storage skeleton. Read-only config API
    // requests opt out so viewing a saved path cannot mutate that path.
    ensureDirExists(config.dataRoot);
    ensureDirExists(config.userDataPath);
    ensureDirExists(config.statementsDir);
    ensureDirExists(config.mergedDir);
    ensureDirExists(config.stagingDir);
  }

  return config;
}

/** Persist only configurable fields; derived paths are recalculated at load. */
export function saveConfig(
  partial: Partial<Pick<ServerConfig, 'dataRoot' | 'username' | 'port'>>,
  configFile = CONFIG_FILE,
): void {
  ensureDirExists(path.dirname(configFile));
  const existing = loadPersistedConfig(configFile);
  const migrated = migrateLegacyDataPath(existing);
  const persisted: PersistedConfig = {
    port: partial.port ?? existing.port ?? DEFAULT_PORT,
    dataRoot: partial.dataRoot ?? existing.dataRoot ?? migrated.dataRoot ?? DEFAULT_DATA_ROOT,
    username: partial.username ?? existing.username ?? migrated.username ?? defaultUsername(),
  };

  // Validate before replacing a known-good file.
  buildConfig(persisted.dataRoot!, persisted.username!, persisted.port!);

  writeTextFileAtomically(configFile, JSON.stringify(persisted, null, 2));
}
