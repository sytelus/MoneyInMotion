/** Exercise real Bash helpers against synthetic files; never install or build here. */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const library = fileURLToPath(new URL('../../../../scripts/lib.sh', import.meta.url));
const installer = fileURLToPath(new URL('../../../../install.sh', import.meta.url));
const old = new Date('2020-01-01T00:00:00Z');
const built = new Date('2020-01-02T00:00:00Z');
const changed = new Date('2020-01-03T00:00:00Z');
const webBuilt = new Date('2020-01-04T00:00:00Z');

describe('build and install scripts', () => {
  let root: string;
  function write(file: string, contents = '', executable = false) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, { mode: executable ? 0o755 : 0o644 });
  }
  function date(file: string, value: Date) {
    fs.utimesSync(path.join(root, file), value, value);
  }
  function run(command: string): string {
    return execFileSync(
      'bash',
      ['-c', `set -euo pipefail; source "$1"; ${command}`, 'test', library],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PATH: `${root}/bin:${process.env.PATH}` },
      },
    );
  }
  function toolsAvailable() {
    write('node_modules/.bin/tsc', '#!/bin/sh\nexit 0\n', true);
    write('node_modules/.bin/vite', '#!/bin/sh\nexit 0\n', true);
  }
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-build-scripts-'));
    write('package.json', '{"name":"moneyinmotion"}');
    for (const file of ['package-lock.json', 'tsconfig.json', 'tsconfig.base.json']) write(file);
    for (const name of ['core', 'server', 'web']) {
      for (const file of [
        'package.json',
        'tsconfig.json',
        'src/index.ts',
        'tsconfig.tsbuildinfo',
        'dist/index.js',
      ]) {
        write(`packages/${name}/${file}`);
      }
    }
    for (const file of [
      'dist/index.html',
      'vite.config.ts',
      'index.html',
      'postcss.config.js',
      'tailwind.config.js',
    ]) {
      write(`packages/web/${file}`);
    }
    write('build.sh', '#!/bin/sh\nprintf built > build.called\n', true);
    write('bin/npm', '#!/bin/sh\nprintf "%s\\n" "$*" >> npm.calls\n', true);
    function age(directory: string) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) age(target);
        fs.utimesSync(target, old, old);
      }
    }
    age(root);
    date('packages/core/tsconfig.tsbuildinfo', built);
    date('packages/server/tsconfig.tsbuildinfo', built);
    date('packages/web/dist/index.html', webBuilt);
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('allows a current production build with pruned development tools', () => {
    expect(run('ensure_production_built')).toBe('');
    expect(fs.existsSync(path.join(root, 'build.called'))).toBe(false);
  });
  it.each(['core', 'server'])('a newer web build cannot hide stale %s source', (name) => {
    toolsAvailable();
    date(`packages/${name}/src/index.ts`, changed);
    expect(run('ensure_production_built')).toContain('rebuilding now');
    expect(fs.existsSync(path.join(root, 'build.called'))).toBe(true);
  });
  it('detects a deleted source through its parent directory mtime', () => {
    toolsAvailable();
    fs.unlinkSync(path.join(root, 'packages/server/src/index.ts'));
    date('packages/server/src', changed);
    run('ensure_production_built');
    expect(fs.existsSync(path.join(root, 'build.called'))).toBe(true);
  });
  it('warns when source is stale and compilers have been pruned', () => {
    date('packages/server/src/index.ts', changed);
    expect(run('ensure_production_built')).toContain('Run ./install.sh');
  });
  it('fails when runtime artifacts are missing and cannot be rebuilt', () => {
    fs.unlinkSync(path.join(root, 'packages/server/dist/index.js'));
    expect(() => run('ensure_production_built')).toThrow(/build artifacts are missing/);
  });
  it('rebuilds missing runtime artifacts when compilers exist', () => {
    toolsAvailable();
    fs.unlinkSync(path.join(root, 'packages/server/dist/index.js'));
    expect(run('ensure_production_built')).toContain('build is missing');
    expect(fs.existsSync(path.join(root, 'build.called'))).toBe(true);
  });
  it('does not rebuild core just because incremental tsc left its index unchanged', () => {
    date('packages/core/src/index.ts', new Date('2020-01-01T12:00:00Z'));
    expect(run('ensure_core_built')).toBe('');
    expect(fs.existsSync(path.join(root, 'npm.calls'))).toBe(false);
  });
  it('clears incremental state when rebuilding a missing core output', () => {
    fs.unlinkSync(path.join(root, 'packages/core/dist/index.js'));
    run('ensure_core_built');
    expect(fs.existsSync(path.join(root, 'packages/core/tsconfig.tsbuildinfo'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'npm.calls'), 'utf8')).toContain('build:core');
  });
  it('installs build dependencies even under NODE_ENV=production before pruning them', () => {
    execFileSync('bash', [installer], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PATH: `${root}/bin:${process.env.PATH}`,
      },
    });
    expect(fs.readFileSync(path.join(root, 'npm.calls'), 'utf8').trim().split('\n')).toEqual([
      'ci --include=dev --no-audit --no-fund',
      'run typecheck --silent -- --force',
      'run build --silent',
      'prune --omit=dev --no-audit --no-fund',
    ]);
  });
});
