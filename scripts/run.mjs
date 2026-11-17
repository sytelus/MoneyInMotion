/**
 * Cross-platform launcher behind ./run.sh and run.bat (see usage below).
 *
 * It installs dependencies when they are missing or older than the lockfile,
 * rebuilds stale or missing output, then starts the server, which prints the
 * URL to open. Only Node built-ins are used so it still works after the
 * VM installer (install.sh) prunes development packages.
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

/** Remove incremental metadata so tsc re-emits instead of trusting old output. */
export function clearBuildInfo(root, names) {
  for (const name of names) {
    fs.rmSync(path.join(root, 'packages', name, 'tsconfig.tsbuildinfo'), { force: true });
  }
}

// ---------------------------------------------------------------------------
// Side effects

const usage = `Usage: run.bat [prod|dev]   (./run.sh [prod|dev] on Linux and macOS)

  prod (default)  Install dependencies if needed, rebuild if the source changed,
                  then start the website and API. The server prints the URL.
  dev             API and Vite website with hot reload: http://localhost:5173

Settings come from ~/.moneyinmotion/config.json (created on first start).
Docs: README.md and docs/development.md.`;

const info = (message) => console.log(`[info]  ${message}`);
const warn = (message) => console.warn(`[warn]  ${message}`);
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
  if (result.error) fail(`Could not run npm (${result.error.message}). Is npm on PATH?`);
  if (result.status !== 0) fail(`npm ${args.join(' ')} failed; see the output above.`);
}

const installAll = () => npm(['ci', '--include=dev', '--no-audit', '--no-fund']);

/** Start a long-running child, forward Ctrl+C/termination, and exit with it. */
function runForeground([command, args, options], { env = {}, onFailure }) {
  let stopping = false;
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    ...options,
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      stopping = true;
      child.kill(signal);
    });
  }
  child.on('error', (error) => fail(`Could not start ${command}: ${error.message}`));
  child.on('exit', (code, signal) => {
    if (!stopping && code) console.error(`[error] ${onFailure} (exit code ${code}).`);
    process.exit(code ?? (signal ? 1 : 0));
  });
}

const startupHint = (ports) =>
  `Check the message above. Common causes: ${ports} is already in use, ` +
  'or ~/.moneyinmotion/config.json is invalid';

function main(mode = 'prod') {
  if (['help', '--help', '-h', '/?'].includes(mode)) {
    console.log(usage);
    return;
  }
  if (!['prod', 'dev'].includes(mode)) {
    console.error(`[error] Unknown mode "${mode}".\n\n${usage}`);
    process.exit(1);
  }
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 24) fail(`Node.js ${process.version} found; Node.js 24 or newer is required.`);

  const dependencies = planDependencies(repositoryRoot);
  if (dependencies !== 'current') {
    info(
      dependencies === 'install'
        ? 'Installing dependencies (first run)...'
        : 'package-lock.json changed; reinstalling dependencies...',
    );
    installAll();
  }

  if (mode === 'dev') {
    if (!buildToolsInstalled(repositoryRoot)) {
      info('Development tools were removed (npm prune); reinstalling them...');
      installAll();
    }
    info('Starting the API and Vite. Open http://localhost:5173 once Vite is ready.');
    info('Vite proxies /api to the port in ~/.moneyinmotion/config.json.');
    runForeground(npmCommand(['run', 'dev', '--silent']), {
      onFailure: `Development mode stopped. ${startupHint('port 5173 or the configured port')}`,
    });
    return;
  }

  let build = planProductionBuild(repositoryRoot);
  if (build === 'fail-missing') {
    info('The build is missing and build tools were removed (npm prune); reinstalling them...');
    installAll();
    build = 'build';
  }
  if (build === 'warn-stale') {
    // Only after ./install.sh pruned the tools on a VM: keep serving rather
    // than silently reinstalling compilers there.
    warn('Source is newer than the build, but build tools were removed by ./install.sh.');
    warn('Starting the existing build. Run ./install.sh again to rebuild.');
  } else if (build !== 'current') {
    info(build === 'build' ? 'Building the website and API...' : 'Source changed; rebuilding...');
    clearBuildInfo(repositoryRoot, Object.keys(builds));
    npm(['run', 'build', '--silent']);
  }
  info('Starting the production server; it prints the URL to open.');
  runForeground([process.execPath, [path.join(repositoryRoot, builds.server.marker)], {}], {
    env: { NODE_ENV: 'production' },
    onFailure: `The server stopped. ${startupHint('the configured port')}`,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]);
}
