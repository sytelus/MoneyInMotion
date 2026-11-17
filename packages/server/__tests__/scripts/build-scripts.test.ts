/** Exercise the launcher's build decisions and the installer against synthetic files. */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain JavaScript module without type declarations.
import * as launcher from '../../../../scripts/run.mjs';

const { clearBuildInfo, planDependencies, planProductionBuild } = launcher as {
  clearBuildInfo: (root: string, names: string[]) => void;
  planDependencies: (root: string) => string;
  planProductionBuild: (root: string) => string;
};

const installer = fileURLToPath(new URL('../../../../install.sh', import.meta.url));
const old = new Date('2020-01-01T00:00:00Z');
const built = new Date('2020-01-02T00:00:00Z');
const changed = new Date('2020-01-03T00:00:00Z');
const webBuilt = new Date('2020-01-04T00:00:00Z');

describe('launcher and install scripts', () => {
  let root: string;
  function write(file: string, contents = '', executable = false) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, { mode: executable ? 0o755 : 0o644 });
  }
  function date(file: string, value: Date) {
    fs.utimesSync(path.join(root, file), value, value);
  }
  function toolsAvailable() {
    write('node_modules/typescript/package.json', '{}');
    write('node_modules/vite/package.json', '{}');
  }
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-build-scripts-'));
    write('package.json', '{"name":"moneyinmotion"}');
    for (const file of ['package-lock.json', 'tsconfig.json', 'tsconfig.base.json']) write(file);
    for (const name of ['core', 'server', 'web']) {
      for (const file of ['package.json', 'tsconfig.json', 'src/index.ts', 'dist/index.js']) {
        write(`packages/${name}/${file}`);
      }
    }
    write('packages/core/tsconfig.tsbuildinfo');
    for (const file of [
      'dist/index.html',
      'vite.config.ts',
      'index.html',
      'postcss.config.js',
      'tailwind.config.js',
    ]) {
      write(`packages/web/${file}`);
    }
    write('node_modules/.package-lock.json', '{}');
    write('bin/npm', '#!/bin/sh\nprintf "%s\\n" "$*" >> npm.calls\n', true);
    function age(directory: string) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) age(target);
        fs.utimesSync(target, old, old);
      }
    }
    age(root);
    date('node_modules/.package-lock.json', built);
    date('packages/core/tsconfig.tsbuildinfo', built);
    date('packages/server/dist/index.js', built);
    date('packages/web/dist/index.html', webBuilt);
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('starts a current production build even with pruned development tools', () => {
    expect(planProductionBuild(root)).toBe('current');
  });
  it.each(['core', 'server'])('a newer web build cannot hide stale %s source', (name) => {
    toolsAvailable();
    date(`packages/${name}/src/index.ts`, changed);
    expect(planProductionBuild(root)).toBe('rebuild');
  });
  it('detects a deleted source through its parent directory mtime', () => {
    toolsAvailable();
    fs.unlinkSync(path.join(root, 'packages/server/src/index.ts'));
    date('packages/server/src', changed);
    expect(planProductionBuild(root)).toBe('rebuild');
  });
  it('warns when source is stale and compilers have been pruned', () => {
    date('packages/server/src/index.ts', changed);
    expect(planProductionBuild(root)).toBe('warn-stale');
  });
  it('fails when runtime artifacts are missing and cannot be rebuilt', () => {
    fs.unlinkSync(path.join(root, 'packages/server/dist/index.js'));
    expect(planProductionBuild(root)).toBe('fail-missing');
  });
  it('builds missing runtime artifacts when compilers exist', () => {
    toolsAvailable();
    fs.unlinkSync(path.join(root, 'packages/server/dist/index.js'));
    expect(planProductionBuild(root)).toBe('build');
  });
  it('clears incremental tsc state so a rebuild re-emits', () => {
    clearBuildInfo(root, ['core']);
    expect(fs.existsSync(path.join(root, 'packages/core/tsconfig.tsbuildinfo'))).toBe(false);
  });
  it('installs dependencies when missing or when the lockfile changes', () => {
    expect(planDependencies(root)).toBe('current');
    date('package-lock.json', changed);
    expect(planDependencies(root)).toBe('reinstall');
    fs.rmSync(path.join(root, 'node_modules'), { recursive: true });
    expect(planDependencies(root)).toBe('install');
  });
  it('installs build dependencies even under NODE_ENV=production before pruning them', () => {
    execFileSync('bash', [installer], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`,
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
