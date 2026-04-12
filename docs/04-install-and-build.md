# MoneyInMotion - Installation, Build Instructions, and Dependencies

## Prerequisites

### Required Software
- **Node.js 18+** (LTS recommended; tested with Node.js 18 and 20)
- **npm** (ships with Node.js)
- **Git** (for cloning the repository)

No Visual Studio, .NET, or other platform-specific tooling is required. The application runs on any OS that supports Node.js (Windows, macOS, Linux).

---

## Quick Install (Recommended)

The included `install.sh` script handles everything — checking dependencies, cloning or updating the repo, and installing packages:

```bash
git clone https://github.com/sytelus/MoneyInMotion.git
cd MoneyInMotion
./install.sh
```

The script:
1. Verifies git, Node.js 18+, and npm are installed
2. Pulls latest changes (if run again for updates)
3. Runs `npm install` for all workspace packages
4. Prints instructions on how to start the application

### Updating

Re-run the same script to pull the latest code and update dependencies:

```bash
cd MoneyInMotion
./install.sh
```

---

## Manual Install

If you prefer to run the steps manually:

```bash
git clone https://github.com/sytelus/MoneyInMotion.git
cd MoneyInMotion
npm install
```

This installs dependencies for `@moneyinmotion/core`, `@moneyinmotion/server`, and `@moneyinmotion/web` in one step, along with shared dev dependencies (TypeScript, ESLint, Prettier, Vitest, concurrently).

---

## Running the Application

MoneyInMotion can run in two modes: **development** and **production**. Both modes share the same data, features, and UX — the only differences are performance, startup, and whether source changes are picked up live.

### Dev Mode

```bash
./run.sh
```

Equivalent to:

```bash
npm run dev
```

This starts:
- **Vite dev server** on port 5173 (serves the React frontend with hot module replacement)
- **Express API server** on port 3001 (via `tsx watch`, auto-restarts on file changes)

Open `http://localhost:5173` in your browser. Vite proxies `/api/*` requests to port 3001.

You can also start the two processes individually:

```bash
npm run dev:server   # Only the API server
npm run dev:web      # Only the Vite dev server
```

**Use dev mode when:** actively modifying source code. You get live reload, source maps, and unminified code in DevTools.

### Production Mode

First, build:

```bash
./build.sh
```

Equivalent to:

```bash
npm run build
```

You can also build individual packages:

```bash
npm run build:core     # TypeScript compilation only
npm run build:server   # TypeScript compilation only
npm run build:web      # TypeScript check + Vite production build
```

Then run:

```bash
./run.sh prod
```

Equivalent to:

```bash
cd packages/server
NODE_ENV=production node dist/index.js
```

When `NODE_ENV=production`, the Express server also serves the built web assets from `packages/web/dist/` as static files, with SPA fallback routing. Open `http://localhost:3001` in your browser — the frontend and API live on the same port.

**Use production mode when:** deploying, benchmarking, or running for real everyday use. It starts faster, uses less memory, runs as a single process, and serves minified assets.

### Docker

The repository includes a production `Dockerfile`. Build and run it like this:

```bash
docker build -t moneyinmotion:latest .
docker run --rm -p 3001:3001 -v /absolute/path/to/data:/data moneyinmotion:latest
```

See [Production Deployment](08-production-deployment.md) for the full
container, environment-variable, and health-check guidance.

### Dev vs Production — What's Different?

| Aspect | Dev | Production |
|--------|-----|-----------|
| **Data** | Same | Same |
| **Features** | Same | Same |
| **UX / UI** | Same | Same |
| **Keyboard shortcuts** | Same | Same |
| **API behaviour** | Same | Same |
| **URL** | `http://localhost:5173` | `http://localhost:3001` |
| **Processes** | 2 (Vite + tsx) | 1 (node) |
| **TypeScript** | Compiled live | Pre-compiled |
| **Bundle** | Unminified | Minified + tree-shaken |
| **Hot reload** | Yes | No |
| **Startup** | Slower | Faster |
| **Memory footprint** | Higher | Lower |
| **Requires build?** | No | Yes (`./build.sh` first) |

**Important:** Both modes read and write the same `~/.moneyinmotion/config.json` and the same data directory. You can stop one mode and start the other; you will see the same transactions, edits, flags, notes, and categories. There is no feature flag or code path that behaves differently in the two modes — `NODE_ENV=production` only controls whether the Express server also serves the React build as static files.

**Recommendation for personal use:** use production mode. It's faster, uses less memory, has one URL to remember, and offers no feature downgrade.

---

## Testing

Run all tests across all packages:

```bash
npm test              # Single run
npm run test:watch    # Watch mode (re-runs on file changes)
npm run test:coverage # With coverage report
```

The test framework is Vitest. The web package uses `@testing-library/react` with `jsdom` for component testing. The server package uses `supertest` for API endpoint testing.

---

## Other Commands

| Command | Description |
|---------|-------------|
| `npm run lint` | Run ESLint across all packages |
| `npm run typecheck` | Run TypeScript compiler in check mode (no emit) |
| `npm run clean` | Remove all `dist/` and `node_modules/` directories |

---

## Configuration

### Data Directory

The server needs a data directory containing `Statements/` and `Merged/` subfolders. Configuration is resolved in this priority order:

1. **Environment variable**: `MONEYAI_DATA_PATH=/path/to/data`
2. **Config file**: `~/.moneyinmotion/config.json` (`{ "dataPath": "/path/to/data" }`)
3. **Default**: `~/.moneyinmotion/data`

### Server Port

The server port can be configured similarly:

1. **Environment variable**: `MONEYAI_PORT=3001`
2. **Config file**: `~/.moneyinmotion/config.json` (`{ "port": 3001 }`)
3. **Default**: `3001`

### Config File Location

The config file is stored at `~/.moneyinmotion/config.json`. The server creates this directory if it does not exist. The config file can also be updated via the Settings page in the web UI or the `PUT /api/config` endpoint.

### Health Endpoint

For production monitoring and orchestration, the server exposes:

```text
GET /api/health
```

This returns a small JSON payload containing status, environment, timestamp,
and uptime.

---

## Data Setup

### Configuring the Data Directory

Create the following directory structure in your chosen data directory:

```
YourDataFolder/
+-- Statements/
+-- Merged/
```

The server creates these directories automatically if they do not exist.

### Adding Your First Account

1. Create a subfolder under `Statements/` (e.g., `Statements/chase-checking/`)
2. Create an `AccountConfig.json` file in that folder (see [How It Works](03-how-it-works.md#1-account-configuration))
3. Upload statement files from the Accounts page, or drop them into the folder manually
4. In the web UI, click the **Import** button to scan and import new statements

---

## Dependencies

### Root (Dev Dependencies)

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.7.3 | TypeScript compiler |
| eslint | ^9.17.0 | Linting |
| @eslint/js | ^9.39.4 | ESLint flat-config base rules |
| @typescript-eslint/eslint-plugin | ^8.19.1 | TypeScript ESLint rules |
| @typescript-eslint/parser | ^8.19.1 | TypeScript ESLint parser |
| eslint-plugin-react-hooks | ^7.0.1 | React Hooks lint rules |
| globals | ^17.5.0 | Shared Node/browser global definitions for ESLint |
| prettier | ^3.4.2 | Code formatting |
| vitest | ^3.0.4 | Test framework |
| concurrently | ^9.1.2 | Run server and web dev servers simultaneously |

### @moneyinmotion/core

| Package | Version | Purpose |
|---------|---------|---------|
| ts-md5 | ^1.3.1 | MD5 hashing for content deduplication |

### @moneyinmotion/server

| Package | Version | Purpose |
|---------|---------|---------|
| @moneyinmotion/core | workspace | Shared domain models |
| express | ^5.0.1 | HTTP server framework |
| cors | ^2.8.5 | Cross-origin request handling |
| papaparse | ^5.5.2 | CSV parsing |
| chokidar | ^4.0.3 | File system watching |
| zod | ^3.24.1 | Request body validation |

Dev dependencies:

| Package | Version | Purpose |
|---------|---------|---------|
| tsx | ^4.19.2 | TypeScript execution for development (watch mode) |
| supertest | ^7.0.0 | HTTP endpoint testing |
| @types/express | ^5.0.0 | TypeScript type definitions |
| @types/cors | ^2.8.17 | TypeScript type definitions |
| @types/papaparse | ^5.3.15 | TypeScript type definitions |

### @moneyinmotion/web

| Package | Version | Purpose |
|---------|---------|---------|
| @moneyinmotion/core | workspace | Shared domain models |
| react | ^19.0.0 | UI framework |
| react-dom | ^19.0.0 | React DOM renderer |
| react-router-dom | ^7.1.1 | Client-side routing |
| @tanstack/react-query | ^5.62.16 | Server state management (fetch, cache, sync) |
| @tanstack/react-table | ^8.20.6 | Headless table utilities |
| zustand | ^5.0.3 | Client state management |
| class-variance-authority | ^0.7.1 | Component variant styling |
| clsx | ^2.1.1 | Conditional CSS class composition |
| tailwind-merge | ^2.6.0 | Tailwind class deduplication |
| lucide-react | ^0.469.0 | Icon library |
| @radix-ui/react-dialog | ^1.1.4 | Accessible dialog/modal primitive |
| @radix-ui/react-dropdown-menu | ^2.1.4 | Accessible dropdown menu primitive |
| @radix-ui/react-select | ^2.1.4 | Accessible select primitive |
| @radix-ui/react-accordion | ^1.2.2 | Accessible accordion primitive |
| @radix-ui/react-popover | ^1.1.4 | Accessible popover primitive |
| @radix-ui/react-tooltip | ^1.1.6 | Accessible tooltip primitive |

Dev dependencies:

| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^6.0.7 | Build tool and dev server |
| @vitejs/plugin-react | ^4.3.4 | React support for Vite |
| tailwindcss | ^3.4.17 | Utility-first CSS framework |
| postcss | ^8.4.49 | CSS processing |
| autoprefixer | ^10.4.20 | CSS vendor prefixing |
| @testing-library/react | ^16.2.0 | React component testing utilities |
| @testing-library/jest-dom | ^6.6.3 | DOM assertion matchers |
| jsdom | ^25.0.0 | Browser environment for testing |

### TypeScript Configuration

The project uses a shared `tsconfig.base.json` at the root with these key settings:
- **Target**: ES2022
- **Module**: NodeNext
- **Strict mode**: Enabled
- **Verbatim module syntax**: Enabled (explicit `import type` required)
- **Declaration maps and source maps**: Enabled for debugging

The root `tsconfig.json` uses project references (`tsc -b`) to build all three
packages in dependency order. The core package has `composite: true` set so
that downstream packages (server, web) can resolve its declaration files from
`packages/core/dist/`.

**Note on incremental builds.** Because `composite: true` makes `tsc`
incremental and cache its decisions in `tsconfig.tsbuildinfo`, manually
deleting `packages/core/dist/` can leave `tsc` thinking the output is still
current. The `./run.sh`, `./build.sh`, and `./install.sh` scripts all handle
this correctly by clearing the stale buildinfo when dist is missing.
