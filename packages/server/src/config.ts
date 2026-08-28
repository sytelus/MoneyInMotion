/**
 * Server configuration and username-scoped storage paths.
 *
 * MoneyInMotion deliberately keeps the physical storage contract small and
 * transparent. `dataRoot` can contain multiple username directories, while a
 * running server instance operates on one configured username. Authentication
 * and per-request user switching can be added later without changing the
 * on-disk layout.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
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
export function buildConfig(
    dataRoot: string,
    username: string,
    port: number,
): ServerConfig {
    if (!path.isAbsolute(dataRoot)) {
        throw new Error(`MoneyInMotion data root must be absolute: "${dataRoot}"`);
    }
    if (!isValidUsername(username)) {
        throw new Error(
            'MoneyInMotion username may contain only letters, numbers, dots, hyphens, and underscores.',
        );
    }

    const userDataPath = path.join(dataRoot, username);
    return {
        port,
        dataRoot: path.normalize(dataRoot),
        username,
        userDataPath,
        statementsDir: path.join(userDataPath, 'Statements'),
        mergedDir: path.join(userDataPath, 'Merged'),
        stagingDir: path.join(userDataPath, 'staging'),
    };
}

function parseConfiguredPort(value: unknown): number | null {
    const parsed =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number.parseInt(value, 10)
              : Number.NaN;

    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535
        ? parsed
        : null;
}

function loadPersistedConfig(): PersistedConfig {
    if (!fs.existsSync(CONFIG_FILE)) {
        return {};
    }

    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as PersistedConfig;
    } catch (err) {
        const backupPath = `${CONFIG_FILE}.corrupt-${Date.now()}`;
        try {
            fs.renameSync(CONFIG_FILE, backupPath);
            console.error(
                `Config file at ${CONFIG_FILE} is malformed (${err instanceof Error ? err.message : String(err)}). `
                + `Moved it to ${backupPath} and falling back to defaults.`,
            );
        } catch {
            console.error(
                `Config file at ${CONFIG_FILE} is malformed and could not be backed up; `
                + 'falling back to defaults for this session.',
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
function migrateLegacyDataPath(
    fileConfig: PersistedConfig,
): { dataRoot?: string; username?: string } {
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
export function loadConfig(): ServerConfig {
    const fileConfig = loadPersistedConfig();
    const migrated = migrateLegacyDataPath(fileConfig);

    const dataRoot =
        process.env['MIM_DATA_ROOT']
        ?? process.env['MONEYAI_DATA_ROOT']
        ?? fileConfig.dataRoot
        ?? migrated.dataRoot
        ?? DEFAULT_DATA_ROOT;
    const username =
        process.env['MIM_USERNAME']
        ?? process.env['MONEYAI_USERNAME']
        ?? fileConfig.username
        ?? migrated.username
        ?? os.userInfo().username;
    const port =
        parseConfiguredPort(process.env['MIM_PORT'])
        ?? parseConfiguredPort(process.env['MONEYAI_PORT'])
        ?? parseConfiguredPort(fileConfig.port)
        ?? DEFAULT_PORT;

    const config = buildConfig(dataRoot, username, port);

    // Startup is the one place where creating the complete storage skeleton
    // is desirable; all later services can rely on these directories.
    ensureDirExists(config.dataRoot);
    ensureDirExists(config.userDataPath);
    ensureDirExists(config.statementsDir);
    ensureDirExists(config.mergedDir);
    ensureDirExists(config.stagingDir);

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
        dataRoot:
            partial.dataRoot
            ?? existing.dataRoot
            ?? migrated.dataRoot
            ?? DEFAULT_DATA_ROOT,
        username:
            partial.username
            ?? existing.username
            ?? migrated.username
            ?? os.userInfo().username,
    };

    // Validate before replacing a known-good file.
    buildConfig(persisted.dataRoot!, persisted.username!, persisted.port!);

    const tmpPath = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(persisted, null, 2), 'utf-8');
    fs.renameSync(tmpPath, CONFIG_FILE);
}
