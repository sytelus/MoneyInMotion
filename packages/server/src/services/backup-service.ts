/**
 * Whole-user backup and replacement restore. Archives are immutable, previews
 * are private staged copies, and the swap retains the previous tree. Nothing
 * in this service parses/rebuilds statements or changes financial schemas.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { buildConfig, getConfigFilePath, type ServerConfig } from '../config.js';
import { TransactionCache } from '../cache/transaction-cache.js';
import { FileRepository } from '../storage/file-repository.js';
import { discoverAccountConfigs } from '../storage/account-config-repository.js';
import { writeTextFileAtomically } from '../storage/atomic-file.js';
import { DataMaintenance } from './data-maintenance.js';

const runFile = promisify(execFile);
const archiveScript = fileURLToPath(
  new URL('../../../../scripts/backup-archive.py', import.meta.url),
);
export const MAX_BACKUP_BYTES = 2 * 1024 ** 3;
const PREVIEW_LIFETIME_MS = 15 * 60 * 1000;
const summarySchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  username: z.string(),
  dataRoot: z.string(),
  port: z.number().int().min(1).max(65535),
  fileCount: z.number().int().min(1),
  totalBytes: z.number().int().min(0),
});
export type BackupSummary = z.infer<typeof summarySchema>;
interface RestorePreview extends BackupSummary {
  token: string;
  expiresAt: string;
  destination: string;
  restartRequired: boolean;
}
interface PreparedRestore {
  workspace: string;
  preview: RestorePreview;
  revision: string;
}

function problem(message: string, status = 400): Error {
  return Object.assign(new Error(message), { status });
}

/** Reject symlink ancestors as well as a linked final component. */
export function assertRealPath(target: string): void {
  let current = path.resolve(target);
  for (;;) {
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink())
      throw problem('Backup and restore paths cannot contain symbolic links.');
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function archiveCommand(...args: string[]): Promise<BackupSummary> {
  try {
    const result = await runFile('python3', [archiveScript, ...args], {
      timeout: 10 * 60 * 1000,
      maxBuffer: 64 * 1024,
    });
    return summarySchema.parse(JSON.parse(result.stdout));
  } catch (error) {
    const failure = error as { code?: string; stderr?: string; killed?: boolean };
    if (failure.code === 'ENOENT') {
      throw problem(
        'Backup and restore require Python 3 on the server. Install python3 and try again.',
        409,
      );
    }
    if (failure.killed)
      throw problem('Archive processing exceeded 10 minutes. No restore was committed.', 409);
    throw problem(
      `Archive could not be processed. ${failure.stderr?.trim().slice(0, 500) || 'Check that it is a complete MoneyInMotion backup and that the server has free disk space.'}`,
    );
  }
}

const journalSchema = z.object({
  target: z.string(),
  workspace: z.string(),
  previousConfig: z.string(),
});

function journalFile(configFile: string): string {
  return path.join(path.dirname(configFile), 'restore-pending.json');
}

/**
 * Crash recovery runs BEFORE loadConfig creates directories or reads snapshots.
 * An on-disk intent marker means the replacement did not reach its commit point.
 * Leave both candidate trees in the private workspace for diagnosis/recovery.
 */
export function recoverInterruptedRestore(configFile = getConfigFilePath()): boolean {
  const marker = journalFile(configFile);
  if (!fs.existsSync(marker)) return false;
  assertRealPath(marker);
  const entry = journalSchema.parse(JSON.parse(fs.readFileSync(marker, 'utf8')));
  const before = JSON.parse(entry.previousConfig) as {
    dataRoot: string;
    username: string;
    port: number;
  };
  const expected = buildConfig(before.dataRoot, before.username, before.port);
  if (
    entry.target !== expected.userDataPath ||
    path.dirname(entry.workspace) !== expected.dataRoot ||
    !path.basename(entry.workspace).startsWith(`.mim-restore-${expected.username}-`)
  ) {
    throw new Error(
      'Invalid restore recovery marker. Stop and inspect restore-pending.json before starting.',
    );
  }
  assertRealPath(entry.workspace);
  const previous = path.join(entry.workspace, 'previous');
  if (fs.existsSync(previous)) {
    assertRealPath(previous);
    if (!fs.statSync(previous).isDirectory())
      throw new Error(
        'The restore recovery copy is not a directory. Preserve it and inspect the recovery marker.',
      );
    if (fs.existsSync(entry.target)) {
      assertRealPath(entry.target);
      fs.renameSync(entry.target, path.join(entry.workspace, `interrupted-${randomUUID()}`));
    }
    fs.renameSync(previous, entry.target);
  } else if (!fs.existsSync(entry.target)) {
    throw new Error(
      'Restore recovery cannot find the previous data. Preserve the recovery folder and inspect it before restarting.',
    );
  }
  writeTextFileAtomically(configFile, entry.previousConfig, 0o600);
  fs.unlinkSync(marker);
  return true;
}

/** Fingerprint detects another tab's edits between review and confirmation. */
function dataRevision(config: ServerConfig, configFile: string): string {
  const hash = createHash('sha256');
  let count = 0;
  function visit(file: string, depth: number): void {
    if (++count > 20000 || depth > 40)
      throw problem('Current data exceeds the supported restore inventory limits.');
    const stat = fs.lstatSync(file, { bigint: true });
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw problem('Current data contains a link or special file. Remove it before restoring.');
    }
    hash.update(`${file}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}:${stat.ino}\n`);
    if (stat.isDirectory())
      for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name), depth + 1);
  }
  visit(config.userDataPath, 0);
  hash.update(fs.readFileSync(configFile));
  return hash.digest('hex');
}

export class BackupService {
  private prepared: PreparedRestore | undefined;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  readonly homeDirectory: string;
  readonly configFile: string;

  constructor(
    private readonly config: ServerConfig,
    private readonly cache: TransactionCache,
    readonly maintenance: DataMaintenance,
    options: { homeDirectory?: string; configFile?: string } = {},
  ) {
    this.homeDirectory = options.homeDirectory ?? os.homedir();
    this.configFile = options.configFile ?? getConfigFilePath();
  }

  private requirePaths(): void {
    assertRealPath(this.homeDirectory);
    assertRealPath(this.config.userDataPath);
    assertRealPath(this.configFile);
    if (
      this.homeDirectory === this.config.userDataPath ||
      this.homeDirectory.startsWith(this.config.userDataPath + path.sep) ||
      this.configFile.startsWith(this.config.userDataPath + path.sep)
    ) {
      throw problem(
        'Backups and the application config must be outside the active data folder. Choose a dedicated data root in Settings first.',
        409,
      );
    }
    if (fs.existsSync(journalFile(this.configFile))) {
      throw problem(
        'An interrupted restore needs recovery. Restart the server before continuing.',
        409,
      );
    }
  }

  private readSavedConfig(): ServerConfig {
    const raw = JSON.parse(fs.readFileSync(this.configFile, 'utf8')) as Record<string, unknown>;
    const parsed = z
      .object({ dataRoot: z.string(), username: z.string(), port: z.number() })
      .parse(raw);
    return buildConfig(parsed.dataRoot, parsed.username, parsed.port);
  }

  private backupPath(name: string): string {
    if (
      path.basename(name) !== name ||
      !name.startsWith(`${this.config.username}_mim_backup_`) ||
      !name.endsWith('.zip')
    ) {
      throw problem('Choose a backup from the list or browse for a MoneyInMotion ZIP.');
    }
    const file = path.join(this.homeDirectory, name);
    assertRealPath(file);
    if (!fs.statSync(file).isFile()) throw problem('The selected backup is not a regular file.');
    return file;
  }

  list() {
    const prefix = `${this.config.username}_mim_backup_`;
    const backups = fs
      .readdirSync(this.homeDirectory, { withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.zip'),
      )
      .map((entry) => {
        const stat = fs.statSync(path.join(this.homeDirectory, entry.name));
        return { name: entry.name, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
    return {
      directory: this.homeDirectory,
      username: this.config.username,
      destination: this.config.userDataPath,
      defaultName: `${prefix}<datetime>.zip`,
      backups,
      maxArchiveBytes: MAX_BACKUP_BYTES,
    };
  }

  downloadPath(name: string): string {
    return this.backupPath(name);
  }

  async create() {
    return this.maintenance.run(async () => {
      await this.cache.whenIdle();
      this.requirePaths();
      const saved = this.readSavedConfig();
      if (saved.userDataPath !== this.config.userDataPath || saved.port !== this.config.port) {
        throw problem(
          'Saved settings differ from the running server. Restart before creating a backup.',
          409,
        );
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = `${this.config.username}_mim_backup_${stamp}_${randomUUID().slice(0, 8)}.zip`;
      const finalPath = path.join(this.homeDirectory, name);
      const temporary = finalPath + '.partial';
      try {
        const summary = await archiveCommand(
          'create',
          this.config.userDataPath,
          this.configFile,
          temporary,
        );
        // Hard-link publication is exclusive; it cannot replace an existing archive.
        fs.linkSync(temporary, finalPath);
        return { ...summary, name, path: finalPath, sizeBytes: fs.statSync(finalPath).size };
      } finally {
        fs.rmSync(temporary, { force: true });
      }
    });
  }

  /** Delete only the private workspace allocated by this service, never user data. */
  cancel(token?: string): void {
    if (token && this.prepared?.preview.token !== token) return;
    const prepared = this.prepared;
    this.prepared = undefined;
    clearTimeout(this.expiryTimer);
    if (prepared) fs.rmSync(prepared.workspace, { recursive: true, force: true });
  }

  async preview(source: { name: string } | { uploadPath: string }): Promise<RestorePreview> {
    return this.maintenance.run(async () => {
      await this.cache.whenIdle();
      this.requirePaths();
      // Restoring config is safe only when it points at the directory being replaced.
      const saved = this.readSavedConfig();
      if (saved.userDataPath !== this.config.userDataPath)
        throw problem('Restart to activate saved data settings before restoring.', 409);
      this.cancel();
      const workspace = fs.mkdtempSync(
        path.join(this.config.dataRoot, `.mim-restore-${this.config.username}-`),
      );
      fs.chmodSync(workspace, 0o700);
      const incoming = path.join(workspace, 'incoming');
      fs.mkdirSync(incoming, { mode: 0o700 });
      try {
        const archivePath = 'name' in source ? this.backupPath(source.name) : source.uploadPath;
        const summary = await archiveCommand('extract', archivePath, incoming);
        const rawConfig = JSON.parse(
          fs.readFileSync(path.join(incoming, 'config.json'), 'utf8'),
        ) as Record<string, unknown>;
        const restored = buildConfig(summary.dataRoot, summary.username, summary.port);
        if (
          rawConfig.dataRoot !== summary.dataRoot ||
          rawConfig.username !== summary.username ||
          rawConfig.port !== summary.port ||
          restored.userDataPath !== this.config.userDataPath
        ) {
          throw problem(
            'This backup belongs to a different user or data location. Select that original data root and username in Settings and restart before restoring.',
          );
        }
        const stagedData = path.join(incoming, 'data');
        try {
          discoverAccountConfigs(path.join(stagedData, 'Statements'));
          await new TransactionCache(new FileRepository(stagedData)).getTransactions();
        } catch {
          throw problem(
            'The ZIP is intact, but its saved account settings, transactions, or rules cannot be read by this app version. No data was replaced. Use a compatible version or choose another backup.',
          );
        }
        const preview: RestorePreview = {
          ...summary,
          token: randomUUID(),
          expiresAt: new Date(Date.now() + PREVIEW_LIFETIME_MS).toISOString(),
          destination: this.config.userDataPath,
          restartRequired: summary.port !== this.config.port,
        };
        this.prepared = {
          workspace,
          preview,
          revision: dataRevision(this.config, this.configFile),
        };
        this.expiryTimer = setTimeout(() => {
          try {
            this.cancel(preview.token);
          } catch {
            console.warn(
              'An expired restore preview could not be removed. Inspect private restore workspaces before cleanup.',
            );
          }
        }, PREVIEW_LIFETIME_MS);
        this.expiryTimer.unref();
        return preview;
      } catch (error) {
        fs.rmSync(workspace, { recursive: true, force: true });
        throw error;
      }
    });
  }

  async restore(token: string, confirmUsername: string) {
    return this.maintenance.run(async () => {
      await this.cache.whenIdle();
      this.requirePaths();
      const prepared = this.prepared;
      if (
        !prepared ||
        token !== prepared.preview.token ||
        Date.parse(prepared.preview.expiresAt) < Date.now()
      ) {
        throw problem('The restore preview expired or was replaced. Review the backup again.', 409);
      }
      if (confirmUsername !== this.config.username)
        throw problem('Type the active username exactly to confirm replacement.');
      if (prepared.revision !== dataRevision(this.config, this.configFile)) {
        throw problem(
          'Data or settings changed after this preview. Review the backup again before restoring.',
          409,
        );
      }
      const { workspace, preview } = prepared;
      clearTimeout(this.expiryTimer);
      this.prepared = undefined; // Never let expiry/cancel remove a recovery tree.
      const configBefore = fs.readFileSync(this.configFile, 'utf8');
      fs.writeFileSync(path.join(workspace, 'config-before.json'), configBefore, { mode: 0o600 });
      const marker = journalFile(this.configFile);
      writeTextFileAtomically(
        marker,
        JSON.stringify({
          target: this.config.userDataPath,
          workspace,
          previousConfig: configBefore,
        }),
        0o600,
      );
      try {
        fs.renameSync(this.config.userDataPath, path.join(workspace, 'previous'));
        fs.renameSync(path.join(workspace, 'incoming', 'data'), this.config.userDataPath);
        writeTextFileAtomically(
          this.configFile,
          fs.readFileSync(path.join(workspace, 'incoming', 'config.json'), 'utf8'),
          0o600,
        );
        this.cache.invalidate();
        fs.unlinkSync(marker); // Commit point: restart recovery is no longer needed.
      } catch (error) {
        try {
          recoverInterruptedRestore(this.configFile);
          this.cache.invalidate();
        } catch (recoveryError) {
          this.maintenance.requireRecovery();
          throw Object.assign(
            problem(
              'Restore and rollback failed. Preserve the recovery folder named in ~/.moneyinmotion/restore-pending.json and restart to retry recovery.',
              409,
            ),
            { cause: recoveryError },
          );
        }
        throw error;
      }
      return { ...preview, recoveryDirectory: workspace, restored: true as const };
    });
  }
}
