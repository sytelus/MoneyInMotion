/**
 * Server configuration loaded from environment variables or config file.
 *
 * Stores config in ~/.moneyinmotion/config.json and creates directories
 * if they don't exist.
 *
 * @module
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServerConfig {
    /** Port to listen on. Default: 3001 */
    port: number;
    /** Root data path for MoneyInMotion data. */
    dataPath: string;
    /** Directory containing per-account statement folders. */
    statementsDir: string;
    /** Directory containing merged transaction files. */
    mergedDir: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIG_DIR = path.join(os.homedir(), '.moneyinmotion');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_DATA_PATH = path.join(os.homedir(), '.moneyinmotion', 'data');
const DEFAULT_PORT = 3001;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDirExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function buildConfig(dataPath: string, port: number): ServerConfig {
    return {
        port,
        dataPath,
        statementsDir: path.join(dataPath, 'Statements'),
        mergedDir: path.join(dataPath, 'Merged'),
    };
}

function parseConfiguredPort(value: unknown): number | null {
    const parsed =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number.parseInt(value, 10)
              : Number.NaN;

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        return null;
    }

    return parsed;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load server configuration from environment variables, config file,
 * or defaults.
 *
 * Priority: env vars > config file > defaults.
 */
export function loadConfig(): ServerConfig {
    let fileConfig: Partial<ServerConfig> = {};

    // Try loading from config file. If the file is malformed, warn loudly
    // and rename it aside so the user notices (silently falling back to
    // defaults has bitten users who thought their saved path was in use).
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
            fileConfig = JSON.parse(raw) as Partial<ServerConfig>;
        } catch (err) {
            const backupPath = `${CONFIG_FILE}.corrupt-${Date.now()}`;
            try {
                fs.renameSync(CONFIG_FILE, backupPath);
                console.error(
                    `Config file at ${CONFIG_FILE} is malformed (${err instanceof Error ? err.message : String(err)}). ` +
                        `Moved it to ${backupPath} and falling back to defaults.`,
                );
            } catch {
                console.error(
                    `Config file at ${CONFIG_FILE} is malformed (${err instanceof Error ? err.message : String(err)}). ` +
                        `Could not rename it — falling back to defaults for this session.`,
                );
            }
        }
    }

    const dataPath = process.env['MONEYAI_DATA_PATH']
        ?? fileConfig.dataPath
        ?? DEFAULT_DATA_PATH;

    const port =
        parseConfiguredPort(process.env['MONEYAI_PORT'])
        ?? parseConfiguredPort(fileConfig.port)
        ?? DEFAULT_PORT;

    const config = buildConfig(dataPath, port);

    // Ensure directories exist
    ensureDirExists(config.dataPath);
    ensureDirExists(config.statementsDir);
    ensureDirExists(config.mergedDir);

    return config;
}

/**
 * Save (merge) partial configuration to the config file.
 *
 * Updates the dataPath-derived fields (statementsDir, mergedDir) when
 * dataPath is changed.
 */
export function saveConfig(partial: Partial<ServerConfig>): void {
    ensureDirExists(CONFIG_DIR);

    let existing: Partial<ServerConfig> = {};
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
            existing = JSON.parse(raw) as Partial<ServerConfig>;
        } catch (err) {
            // If the existing file can't be parsed, rename it aside before
            // overwriting so we never clobber whatever was there silently.
            const backupPath = `${CONFIG_FILE}.corrupt-${Date.now()}`;
            try {
                fs.renameSync(CONFIG_FILE, backupPath);
                console.warn(
                    `Config file at ${CONFIG_FILE} was malformed (${err instanceof Error ? err.message : String(err)}); ` +
                        `backed up to ${backupPath} before rewriting.`,
                );
            } catch {
                console.warn(
                    `Config file at ${CONFIG_FILE} was malformed and could not be backed up; ` +
                        `rewriting with the new values.`,
                );
            }
        }
    }

    const merged = { ...existing, ...partial };

    // If dataPath was changed, update derived dirs
    if (partial.dataPath) {
        merged.statementsDir = path.join(partial.dataPath, 'Statements');
        merged.mergedDir = path.join(partial.dataPath, 'Merged');
    }

    // Atomic write: temp file + rename so a crash mid-write can't leave
    // a truncated config.json that would later be renamed to .corrupt-*.
    const tmpPath = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8');
    fs.renameSync(tmpPath, CONFIG_FILE);
}
