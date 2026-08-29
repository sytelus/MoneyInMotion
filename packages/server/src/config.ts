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
const DEFAULT_DATA_ROOT = path.join(os.homedir(), 'min_root');
const DEFAULT_PORT = 3001;

/** Restrict usernames to a single safe path segment. */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(username) && !username.includes('..');
}

function ensureDirExists(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/** Build all derived paths from the two configurable storage coordinates. */
export function buildConfig(dataRoot: string, username: string, port: number): ServerConfig {
  if (!path.isAbsolute(dataRoot)) {
    throw new Error(`MoneyInMotion data root must be absolute: "${dataRoot}"`);
  }
  if (!isValidUsername(username)) {
    throw new Error(
      'MoneyInMotion username may contain only letters, numbers, dots, hyphens, and underscores.',
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MoneyInMotion port must be an integer between 1 and 65535.');
  }

  const normalizedDataRoot = path.normalize(dataRoot);
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

/** Parse an environment or persisted port without accepting partial numbers. */
export function parseConfiguredPort(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : null;
}

function loadPersistedConfig(): PersistedConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as unknown;
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
    const backupPath = `${CONFIG_FILE}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(CONFIG_FILE, backupPath);
      console.error(
        `MoneyInMotion config is malformed (${err instanceof Error ? err.message : String(err)}). ` +
          `Moved it to backup "${path.basename(backupPath)}" and falling back to defaults.`,
      );
    } catch {
      console.error(
        `MoneyInMotion config is malformed and could not be backed up; ` +
          'falling back to defaults for this session.',
      );
    }
    return {};
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
 * Load configuration with priority: environment, config file, defaults.
 *
 * Environment variables:
 * - `MIM_DATA_ROOT` (preferred) or `MONEYAI_DATA_ROOT`
 * - `MIM_USERNAME` (preferred) or `MONEYAI_USERNAME`
 * - `MIM_PORT` (preferred) or `MONEYAI_PORT`
 */
export function loadConfig(options: { ensureDirectories?: boolean } = {}): ServerConfig {
  const fileConfig = loadPersistedConfig();
  const migrated = migrateLegacyDataPath(fileConfig);

  const dataRoot =
    process.env['MIM_DATA_ROOT'] ??
    process.env['MONEYAI_DATA_ROOT'] ??
    fileConfig.dataRoot ??
    migrated.dataRoot ??
    DEFAULT_DATA_ROOT;
  const username =
    process.env['MIM_USERNAME'] ??
    process.env['MONEYAI_USERNAME'] ??
    fileConfig.username ??
    migrated.username ??
    os.userInfo().username;
  const environmentPort = process.env['MIM_PORT'] ?? process.env['MONEYAI_PORT'];
  const port =
    environmentPort == null
      ? (parseConfiguredPort(fileConfig.port) ?? DEFAULT_PORT)
      : parseConfiguredPort(environmentPort);
  if (port == null) {
    throw new Error('MIM_PORT must be an integer between 1 and 65535.');
  }

  const config = buildConfig(dataRoot, username, port);

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
): void {
  ensureDirExists(CONFIG_DIR);
  const existing = loadPersistedConfig();
  const migrated = migrateLegacyDataPath(existing);
  const persisted: PersistedConfig = {
    port: partial.port ?? existing.port ?? DEFAULT_PORT,
    dataRoot: partial.dataRoot ?? existing.dataRoot ?? migrated.dataRoot ?? DEFAULT_DATA_ROOT,
    username: partial.username ?? existing.username ?? migrated.username ?? os.userInfo().username,
  };

  // Validate before replacing a known-good file.
  buildConfig(persisted.dataRoot!, persisted.username!, persisted.port!);

  writeTextFileAtomically(CONFIG_FILE, JSON.stringify(persisted, null, 2));
}
