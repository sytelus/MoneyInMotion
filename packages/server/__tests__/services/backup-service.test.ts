import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScopeType, TransactionEdits, createScopeFilter } from '@moneyinmotion/core';
import { buildConfig } from '../../src/config.js';
import { FileRepository } from '../../src/storage/file-repository.js';
import { TransactionEditsStorage } from '../../src/storage/transaction-edits-storage.js';
import { TransactionCache } from '../../src/cache/transaction-cache.js';
import { BackupService, recoverInterruptedRestore } from '../../src/services/backup-service.js';
import { DataMaintenance } from '../../src/services/data-maintenance.js';
import { createApp } from '../../src/app.js';
import { inProcessRequest } from '../helpers/in-process-http.js';

let temporary: string;
let home: string;
let configFile: string;
let config: ReturnType<typeof buildConfig>;
let cache: TransactionCache;
let service: BackupService;
let gate: DataMaintenance;

function put(relative: string, content: string | Buffer): string {
  const target = path.join(config.userDataPath, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}
function tree(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  function visit(relative: string) {
    const target = path.join(root, relative);
    if (fs.statSync(target).isDirectory()) {
      result[relative + '/'] = '';
      for (const name of fs.readdirSync(target).sort()) visit(path.join(relative, name));
    } else result[relative] = fs.readFileSync(target).toString('base64');
  }
  visit('');
  return result;
}
/** Repack with the standard ZIP library so corruptions have valid ZIP CRCs. */
async function alterZip(archive: string, code: string): Promise<void> {
  await promisify(execFile)('python3', [
    '-c',
    `import zipfile,json,sys\np=sys.argv[1]\nwith zipfile.ZipFile(p) as z: entries={i.filename:z.read(i) for i in z.infolist()}\n${code}\nwith zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as z:\n for n,b in entries.items(): z.writestr(n,b)`,
    archive,
  ]);
}

beforeEach(async () => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-backup-test-'));
  home = path.join(temporary, 'home');
  configFile = path.join(home, '.moneyinmotion', 'config.json');
  config = buildConfig(path.join(temporary, 'data'), 'test-user', 3001);
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(
    configFile,
    JSON.stringify(
      { dataRoot: config.dataRoot, username: config.username, port: config.port },
      null,
      2,
    ),
  );
  put(
    'Statements/Bank/AccountConfig.json',
    JSON.stringify({
      accountInfo: { id: 'bank', instituteName: 'Generic', type: 2, requiresParent: false },
      fileFilters: ['*.csv'],
      scanSubFolders: true,
    }),
  );
  put(
    'Statements/Bank/archive/statement.csv',
    'Date,Description,Amount\n01/01/2024,Purchase,-10\n',
  );
  put('staging/batch/manifest.json', '{"files":[]}');
  put('staging/batch/files/raw.bin', Buffer.from([0, 255, 17, 10]));
  fs.mkdirSync(path.join(config.userDataPath, 'empty'));
  fs.mkdirSync(config.mergedDir);
  const repo = new FileRepository(config.userDataPath);
  const rules = new TransactionEdits('test');
  rules.createEditCategory([createScopeFilter(ScopeType.All, [])], ['Original category']);
  new TransactionEditsStorage().save(repo.latestMergedEditsPath, rules);
  cache = new TransactionCache(repo);
  await cache.rebuildFromStatements();
  gate = new DataMaintenance();
  service = new BackupService(config, cache, gate, { homeDirectory: home, configFile });
});
afterEach(() => {
  service.cancel();
  vi.restoreAllMocks();
  fs.rmSync(temporary, { recursive: true, force: true });
});

describe('whole-user backup and restore', () => {
  it('round-trips all bytes, empty folders, timestamps, rules, configuration, and cache without rebuilding', async () => {
    const timestamp = new Date('2008-01-02T03:04:05.000Z');
    const statement = path.join(config.statementsDir, 'Bank/archive/statement.csv');
    fs.utimesSync(statement, timestamp, timestamp);
    const original = tree(config.userDataPath);
    const configBefore = fs.readFileSync(configFile, 'utf8');
    const beforeCache = await cache.getTransactions();
    const backup = await service.create();
    expect(backup.name).toMatch(/^test-user_mim_backup_.*\.zip$/);
    expect(backup.fileCount).toBeGreaterThan(5);
    expect(fs.statSync(backup.path).mode & 0o777).toBe(0o600);
    expect(tree(config.userDataPath)).toEqual(original);
    await promisify(execFile)('python3', ['-m', 'zipfile', '-t', backup.path]);
    put('Statements/Bank/new.csv', 'later data');
    put('Merged/LatestMerged.json', '{corrupt');
    fs.writeFileSync(configFile, configBefore.replace('3001', '4010'));
    const changed = tree(config.userDataPath);
    const preview = await service.preview({ name: backup.name });
    expect(tree(config.userDataPath)).toEqual(changed);
    const result = await service.restore(preview.token, config.username);
    expect(tree(config.userDataPath)).toEqual(original);
    expect(fs.readFileSync(configFile, 'utf8')).toBe(configBefore);
    expect(fs.statSync(statement).mtime.toISOString()).toBe(timestamp.toISOString());
    expect(tree(path.join(result.recoveryDirectory, 'previous'))).toEqual(changed);
    expect(
      fs.readFileSync(path.join(result.recoveryDirectory, 'config-before.json'), 'utf8'),
    ).toContain('4010');
    const afterCache = await cache.getTransactions();
    expect(afterCache).not.toBe(beforeCache);
    expect(afterCache.serialize()).toEqual(beforeCache.serialize());
    expect(
      (
        await new TransactionCache(new FileRepository(config.userDataPath)).getTransactions()
      ).serialize(),
    ).toEqual(beforeCache.serialize());
    expect(fs.existsSync(path.join(path.dirname(configFile), 'restore-pending.json'))).toBe(false);
  });

  it('cancel never changes active files and discards only the staged preview', async () => {
    const original = tree(config.userDataPath);
    const backup = await service.create();
    const preview = await service.preview({ name: backup.name });
    service.cancel(preview.token);
    expect(tree(config.userDataPath)).toEqual(original);
    expect(fs.readdirSync(config.dataRoot)).toEqual([config.username]);
    await expect(service.restore(preview.token, config.username)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('rejects stale confirmation after another tab edits data or settings', async () => {
    const backup = await service.create();
    const preview = await service.preview({ name: backup.name });
    put('new-file', 'new work');
    await expect(service.restore(preview.token, config.username)).rejects.toThrow(
      'changed after this preview',
    );
    expect(fs.readFileSync(path.join(config.userDataPath, 'new-file'), 'utf8')).toBe('new work');
  });

  it('requires the exact username and refuses replayed restore tokens', async () => {
    const backup = await service.create();
    const preview = await service.preview({ name: backup.name });
    await expect(service.restore(preview.token, 'wrong')).rejects.toThrow('exactly');
    await service.restore(preview.token, config.username);
    await expect(service.restore(preview.token, config.username)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('rejects a truncated ZIP without touching active data', async () => {
    const original = tree(config.userDataPath);
    const backup = await service.create();
    fs.truncateSync(backup.path, 15);
    await expect(service.preview({ name: backup.name })).rejects.toThrow(
      'Archive could not be processed',
    );
    expect(tree(config.userDataPath)).toEqual(original);
  });

  it.each([
    ['changed contents', "entries['data/staging/batch/files/raw.bin']=b'wrong'"],
    ['traversal', "entries['../outside.txt']=b'bad'"],
    ['absolute path', "entries['/outside.txt']=b'bad'"],
    [
      'unsupported version',
      "m=json.loads(entries['manifest.json']);m['version']=99;entries['manifest.json']=json.dumps(m)",
    ],
    ['missing file', "del entries['data/staging/batch/files/raw.bin']"],
  ])('rejects %s in an otherwise valid ZIP', async (_label, change) => {
    const original = tree(config.userDataPath);
    const backup = await service.create();
    await alterZip(backup.path, change);
    await expect(service.preview({ name: backup.name })).rejects.toThrow();
    expect(tree(config.userDataPath)).toEqual(original);
    expect(fs.readdirSync(config.dataRoot)).toEqual([config.username]);
  });

  it('rejects an archive whose manifest points to a different data location', async () => {
    const backup = await service.create();
    await alterZip(
      backup.path,
      "m=json.loads(entries['manifest.json']);m['dataRoot']='/different';entries['manifest.json']=json.dumps(m)",
    );
    await expect(service.preview({ name: backup.name })).rejects.toThrow(
      'different user or data location',
    );
  });

  it('rejects links in the live tree and linked backup files', async () => {
    const backup = await service.create();
    fs.symlinkSync(configFile, path.join(config.userDataPath, 'linked'));
    await expect(service.create()).rejects.toThrow('Symbolic links');
    fs.unlinkSync(path.join(config.userDataPath, 'linked'));
    const name = 'test-user_mim_backup_link.zip';
    fs.symlinkSync(backup.path, path.join(home, name));
    expect(service.list().backups.some((item) => item.name === name)).toBe(false);
    await expect(service.preview({ name })).rejects.toThrow('symbolic links');
  });

  it('does not overwrite archives when two backups are requested close together', async () => {
    const first = await service.create();
    const second = await service.create();
    expect(first.path).not.toBe(second.path);
    expect(service.list().backups).toHaveLength(2);
    expect(fs.readdirSync(home).some((name) => name.endsWith('.partial'))).toBe(false);
  });

  it('blocks backup when saved settings differ from the active server', async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ dataRoot: config.dataRoot, username: config.username, port: 5001 }),
    );
    await expect(service.create()).rejects.toThrow('Restart before creating');
  });

  it('rejects oversize files before reading them and removes an incomplete archive', async () => {
    const huge = put('oversize.bin', '');
    fs.truncateSync(huge, 512 * 1024 ** 2 + 1);
    await expect(service.create()).rejects.toThrow('512 MiB');
    expect(service.list().backups).toHaveLength(0);
    expect(fs.readdirSync(home).some((name) => name.endsWith('.partial'))).toBe(false);
  });

  it('checks the ZIP file type bits and rejects a symbolic-link member', async () => {
    const backup = await service.create();
    await promisify(execFile)('python3', [
      '-c',
      `import zipfile,sys,stat\np=sys.argv[1]\nwith zipfile.ZipFile(p) as z: entries=[(i,z.read(i)) for i in z.infolist()]\nwith zipfile.ZipFile(p,'w') as z:\n for i,b in entries:\n  if i.filename=='data/staging/batch/files/raw.bin': i.create_system=3;i.external_attr=(stat.S_IFLNK|0o777)<<16\n  z.writestr(i,b)`,
      backup.path,
    ]);
    await expect(service.preview({ name: backup.name })).rejects.toThrow('Links and special files');
  });

  it('rejects unreadable saved financial data before replacing the active tree', async () => {
    put('Merged/LatestMerged.json', '{invalid');
    const backup = await service.create();
    await expect(service.preview({ name: backup.name })).rejects.toThrow(
      'cannot be read by this app version',
    );
    expect(fs.readFileSync(path.join(config.mergedDir, 'LatestMerged.json'), 'utf8')).toBe(
      '{invalid',
    );
  });

  it('makes a restored port change explicit without changing the data location', async () => {
    const backup = await service.create();
    const active = buildConfig(config.dataRoot, config.username, 4001);
    fs.writeFileSync(
      configFile,
      JSON.stringify({ dataRoot: active.dataRoot, username: active.username, port: active.port }),
    );
    const other = new BackupService(active, cache, gate, { homeDirectory: home, configFile });
    const preview = await other.preview({ name: backup.name });
    expect(preview.restartRequired).toBe(true);
    const result = await other.restore(preview.token, config.username);
    expect(result.restartRequired).toBe(true);
    expect(JSON.parse(fs.readFileSync(configFile, 'utf8')).port).toBe(3001);
  });

  it('rejects an expired preview even if its cleanup timer has not fired', async () => {
    const backup = await service.create();
    const preview = await service.preview({ name: backup.name });
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(preview.expiresAt) + 1);
    await expect(service.restore(preview.token, config.username)).rejects.toThrow('expired');
  });

  it('rolls back a failed directory replacement and keeps the cache correct', async () => {
    const backup = await service.create();
    put('later.txt', 'preserve me');
    const before = tree(config.userDataPath);
    const preview = await service.preview({ name: backup.name });
    // A real missing staged directory exercises rollback after the first rename.
    const workspace = fs
      .readdirSync(config.dataRoot)
      .find((name) => name.startsWith('.mim-restore-'))!;
    fs.renameSync(
      path.join(config.dataRoot, workspace, 'incoming/data'),
      path.join(config.dataRoot, workspace, 'missing-data'),
    );
    await expect(service.restore(preview.token, config.username)).rejects.toThrow();
    expect(tree(config.userDataPath)).toEqual(before);
    expect((await cache.getTransactions()).allTransactionCount).toBe(1);
  });

  it.each([0, 1, 2, 3])('recovers interruption at replacement phase %i before startup', (phase) => {
    const before = tree(config.userDataPath);
    const workspace = fs.mkdtempSync(path.join(config.dataRoot, '.mim-restore-test-user-'));
    const previousConfig = fs.readFileSync(configFile, 'utf8');
    fs.writeFileSync(
      path.join(path.dirname(configFile), 'restore-pending.json'),
      JSON.stringify({ target: config.userDataPath, workspace, previousConfig }),
    );
    if (phase >= 1) fs.renameSync(config.userDataPath, path.join(workspace, 'previous'));
    if (phase >= 2) put('candidate.txt', 'new tree');
    if (phase >= 3) fs.writeFileSync(configFile, previousConfig.replace('3001', '4001'));
    expect(recoverInterruptedRestore(configFile)).toBe(true);
    expect(tree(config.userDataPath)).toEqual(before);
    expect(fs.readFileSync(configFile, 'utf8')).toBe(previousConfig);
    expect(recoverInterruptedRestore(configFile)).toBe(false);
  });

  it('keeps data endpoints blocked if rollback cannot trust the recovery copy', async () => {
    const backup = await service.create();
    const preview = await service.preview({ name: backup.name });
    const workspace = fs
      .readdirSync(config.dataRoot)
      .find((name) => name.startsWith('.mim-restore-'))!;
    fs.writeFileSync(path.join(config.dataRoot, workspace, 'previous'), 'not a directory');
    const original = tree(config.userDataPath);
    await expect(service.restore(preview.token, config.username)).rejects.toThrow(
      'rollback failed',
    );
    expect(tree(config.userDataPath)).toEqual(original);
    expect(() => gate.assertAvailable()).toThrow('recovery is required');
  });

  it('rejects overlapping maintenance and releases the gate after failure', async () => {
    let finish!: () => void;
    const pending = gate.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await expect(service.create()).rejects.toMatchObject({ status: 423 });
    finish();
    await pending;
    const invalid = path.join(home, 'test-user_mim_backup_bad.zip');
    fs.writeFileSync(invalid, 'bad zip');
    await expect(service.preview({ name: path.basename(invalid) })).rejects.toThrow();
    expect(() => gate.assertAvailable()).not.toThrow();
  });
});

describe('in-process backup HTTP boundary', () => {
  it('creates, lists, downloads, previews an uploaded ZIP, and restores through the API', async () => {
    const app = createApp(config, { homeDirectory: home, configFile });
    const made = await inProcessRequest(app, 'POST', '/api/backups', { body: {} });
    expect(made.status).toBe(201);
    const listed = await inProcessRequest(app, 'GET', '/api/backups');
    expect(listed.body.backups).toHaveLength(1);
    const download = await inProcessRequest(app, 'GET', `/api/backups/download/${made.body.name}`);
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment');
    const upload = Buffer.concat([
      Buffer.from(
        '--test-boundary\r\nContent-Disposition: form-data; name="archive"; filename="backup.zip"\r\nContent-Type: application/zip\r\n\r\n',
      ),
      fs.readFileSync(String(made.body.path)),
      Buffer.from('\r\n--test-boundary--\r\n'),
    ]);
    const preview = await inProcessRequest(app, 'POST', '/api/backups/preview-upload', {
      body: upload,
      headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' },
    });
    expect(preview.status).toBe(200);
    const restored = await inProcessRequest(app, 'POST', '/api/backups/restore', {
      body: { token: preview.body.token, confirmUsername: config.username },
    });
    expect(restored.status).toBe(200);
    expect(restored.body.restored).toBe(true);
    expect((await inProcessRequest(app, 'GET', '/api/transactions')).status).toBe(200);
  });

  it('rejects invalid JSON requests and foreign-origin restores without mutation', async () => {
    const app = createApp(config, { homeDirectory: home, configFile });
    expect(
      (await inProcessRequest(app, 'POST', '/api/backups/restore', { body: { token: 'bad' } }))
        .status,
    ).toBe(400);
    expect(
      (
        await inProcessRequest(app, 'POST', '/api/backups', {
          headers: { origin: 'https://other.example' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await inProcessRequest(app, 'POST', '/api/backups/preview', {
          body: { name: '../../secret.zip' },
        })
      ).status,
    ).toBe(400);
    expect(service.list().backups).toHaveLength(0);
  });

  it('blocks concurrent configuration writes while maintenance is held', async () => {
    const backup = await service.create();
    let started!: () => void;
    let release!: () => void;
    const acquired = new Promise<void>((resolve) => {
      started = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(BackupService.prototype, 'create').mockImplementation(function (this: BackupService) {
      return this.maintenance.run(async () => {
        started();
        await held;
        return backup;
      });
    });
    const app = createApp(config, { homeDirectory: home, configFile });
    const creation = inProcessRequest(app, 'POST', '/api/backups', { body: {} });
    await acquired;
    const write = await inProcessRequest(app, 'PUT', '/api/config', { body: { port: 4999 } });
    expect(write.status).toBe(423);
    expect(JSON.parse(fs.readFileSync(configFile, 'utf8')).port).toBe(3001);
    release();
    expect((await creation).status).toBe(201);
  });
});
