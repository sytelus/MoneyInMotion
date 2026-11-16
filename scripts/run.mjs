/**
 * Cross-platform launcher behind ./run.sh and run.bat.
 *
 *   node scripts/run.mjs          production website + API (default)
 *   node scripts/run.mjs dev      API and Vite website with hot reload
 *
 * It installs dependencies when they are missing or older than the lockfile,
 * rebuilds stale or missing output, then starts the server, which prints the
 * URL to open. Only Node built-ins are used so it still works after the
 * production installer prunes development packages.
 *
 * The plan* functions only inspect files, so tests can run them against a
 * synthetic tree; main() performs the installs, builds, and server start.
 */

import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

const shared = ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.base.json'];
const core = ['packages/core/src', 'packages/core/package.json', 'packages/core/tsconfig.json'];

/** Each package's completion marker and the inputs that make it stale. */
export const builds = {
  // Incremental (composite) tsc rewrites its buildinfo on every build.
  core: { marker: 'packages/core/tsconfig.tsbuildinfo', inputs: [...shared, ...core] },
  server: {
    // Plain (non-incremental) tsc rewrites every output, so index.js marks the build.
    marker: 'packages/server/dist/index.js',
    inputs: [
      ...shared,
      ...core,
      'packages/server/src',
      'packages/server/package.json',
      'packages/server/tsconfig.json',
    ],
  },
  web: {
    // Vite reads core source directly through an alias.
    marker: 'packages/web/dist/index.html',
    inputs: [
      ...shared,
      ...core,
      'packages/web/src',
      'packages/web/public',
      'packages/web/index.html',
      'packages/web/package.json',
      'packages/web/tsconfig.json',
      'packages/web/vite.config.ts',
      'packages/web/postcss.config.js',
      'packages/web/tailwind.config.js',
    ],
  },
};

function mtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
}

/** Newest modification time among files and folders (folders catch deletions). */
function newestInput(root, inputs) {
  let newest = 0;
  const visit = (target) => {
    let stats;
    try {
      stats = fs.statSync(target);
    } catch {
      return;
    }
    newest = Math.max(newest, stats.mtimeMs);
    if (stats.isDirectory()) {
      for (const name of fs.readdirSync(target)) visit(path.join(target, name));
    }
  };
  for (const input of inputs) visit(path.join(root, input));
  return newest;
}

export function isStale(root, name) {
  const built = mtime(path.join(root, builds[name].marker));
  return built == null || newestInput(root, builds[name].inputs) > built;
}

export function buildToolsInstalled(root) {
  return ['typescript', 'vite'].every((name) =>
    fs.existsSync(path.join(root, 'node_modules', name, 'package.json')),
  );
}

/** 'current' | 'install' (missing) | 'reinstall' (lockfile changed). */
export function planDependencies(root) {
  const installed = mtime(path.join(root, 'node_modules', '.package-lock.json'));
  if (installed == null) return 'install';
  const lock = mtime(path.join(root, 'package-lock.json'));
  return lock != null && lock > installed ? 'reinstall' : 'current';
}

/** 'current' | 'build' | 'rebuild' | 'warn-stale' | 'fail-missing'. */
export function planProductionBuild(root) {
  const missing = ['packages/core/dist/index.js', builds.server.marker, builds.web.marker].some(
    (file) => !fs.existsSync(path.join(root, file)),
  );
  if (!missing && !Object.keys(builds).some((name) => isStale(root, name))) return 'current';
  if (buildToolsInstalled(root)) return missing ? 'build' : 'rebuild';
  return missing ? 'fail-missing' : 'warn-stale';
}

/** Development mode only needs core compiled; Vite and tsx handle the rest. */
export function planCoreBuild(root) {
  return fs.existsSync(path.join(root, 'packages/core/dist/index.js')) && !isStale(root, 'core')
    ? 'current'
    : 'build';
}

/** Remove incremental metadata so tsc re-emits instead of trusting old output. */
export function clearBuildInfo(root, names) {
  for (const name of names) {
    fs.rmSync(path.join(root, 'packages', name, 'tsconfig.tsbuildinfo'), { force: true });
  }
}

// ---------------------------------------------------------------------------
// Side effects

const info = (message) => console.log(`[info]  ${message}`);
function fail(message) {
  console.error(`[error] ${message}`);
  process.exit(1);
}

/**
 * Windows can only start npm.cmd through a shell, and Node warns when an args
 * array is combined with a shell, so pass one command string there. Every
 * argument used in this file is a fixed constant, so nothing needs escaping.
 */
function npmCommand(args) {
  return isWindows ? [`npm ${args.join(' ')}`, [], { shell: true }] : ['npm', args, {}];
}

function npm(args) {
  const [command, argv, options] = npmCommand(args);
  const result = spawnSync(command, argv, { cwd: repositoryRoot, stdio: 'inherit', ...options });
  if (result.status !== 0) fail(`npm ${args.join(' ')} failed.`);
}

/** Start a long-running child, forward Ctrl+C/termination, and exit with it. */
function runForeground([command, args, options], env = {}) {
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    ...options,
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

function main(mode = 'prod') {
  if (!['prod', 'dev'].includes(mode)) fail('usage: run [prod|dev]');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 24) fail(`Node.js ${process.version} detected; Node.js 24 or newer is required.`);

  const dependencies = planDependencies(repositoryRoot);
  if (dependencies !== 'current') {
    info(
      dependencies === 'install'
        ? 'Installing dependencies (first run)...'
        : 'package-lock.json changed; reinstalling dependencies...',
    );
    npm(['ci', '--include=dev', '--no-audit', '--no-fund']);
  }

  if (mode === 'dev') {
    if (!buildToolsInstalled(repositoryRoot)) {
      fail('Development tools are not installed. Run ./install.sh --development.');
    }
    if (planCoreBuild(repositoryRoot) === 'build') {
      info('Building @moneyinmotion/core...');
      clearBuildInfo(repositoryRoot, ['core']);
      npm(['run', 'build:core', '--silent']);
    }
    info('Starting development mode. Open http://localhost:5173 once Vite is ready.');
    info('The website proxies /api to the port in ~/.moneyinmotion/config.json.');
    runForeground(npmCommand(['run', 'dev', '--silent']));
    return;
  }

  const build = planProductionBuild(repositoryRoot);
  if (build === 'fail-missing') {
    fail('The production build is missing and build tools are not installed. Run ./install.sh.');
  } else if (build === 'warn-stale') {
    console.warn('[warn]  Source is newer than the build, but build tools were pruned.');
    console.warn('[warn]  Run ./install.sh to rebuild; starting the existing build now.');
  } else if (build !== 'current') {
    info(build === 'build' ? 'Building the website and API...' : 'Source changed; rebuilding...');
    clearBuildInfo(repositoryRoot, Object.keys(builds));
    npm(['run', 'build', '--silent']);
  }
  info('Starting the production server; it prints the URL to open.');
  runForeground([process.execPath, [path.join(repositoryRoot, builds.server.marker)], {}], {
    NODE_ENV: 'production',
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]);
}
