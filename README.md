# MoneyInMotion

**Personal Finance with Smarts** -- A local-first personal finance application that aggregates transactions from multiple banks, credit cards, and online services into a unified view with intelligent categorization, matching, and analysis.

---

## Why MoneyInMotion?

- **Your data stays yours** -- All data stored locally as JSON files, no cloud dependency
- **Multi-source aggregation** -- Import from banks, credit cards, PayPal, Amazon, Etsy, and more
- **Intelligent matching** -- Automatically links Amazon order items to credit card charges, detects inter-account transfers
- **Non-destructive editing** -- Original data is never modified; all changes stored as revertible edit rules you can inspect from the Rules page
- **Rule-based categorization** -- Categorize one transaction and automatically apply to all similar ones
- **Full audit trail** -- Every change is tracked with who, what, and when
- **Cross-platform** -- Runs on Windows, macOS, and Linux via Node.js

---

## Quick Start

### One-line install

```bash
git clone https://github.com/sytelus/MoneyInMotion.git && cd MoneyInMotion && ./install.sh
```

Or step by step:

```bash
git clone https://github.com/sytelus/MoneyInMotion.git
cd MoneyInMotion
./install.sh        # checks dependencies, installs packages, prints instructions
```

### Start the application

```bash
./run.sh            # dev mode -- http://localhost:5173
```

Or, for a faster, leaner production-mode run:

```bash
./build.sh          # compile and bundle
./run.sh prod       # prod mode -- http://localhost:3001
```

Both modes share the exact same data, features, and UX — see [Install and Build](docs/04-install-and-build.md#dev-vs-production--whats-different) for the full comparison. For personal use, production mode is recommended.

Open the URL shown in the terminal. The **Getting Started** guide walks you through setup — no need to read docs first.
You can now upload statement files directly from the **Accounts** page instead
of manually copying them into the data directory.

### Updating

```bash
cd MoneyInMotion
./install.sh        # pulls latest changes and updates dependencies
```

---

## Features

| Feature | Description |
|---------|-------------|
| Multi-source import | CSV (banks, Amex, Barclaycard, PayPal), JSON (Etsy), IIF (QuickBooks) with auto-column detection |
| Content deduplication | MD5-based content hashing prevents duplicate imports from overlapping sources |
| Parent-child matching | Links Amazon/Etsy order line items to corresponding credit card charges |
| Inter-account transfers | Matches debits and credits across accounts by amount and date proximity |
| Entity normalization | Cleans up messy bank entity names for consistent grouping |
| Scope-based edits | Apply categorization, notes, and flags to all matching transactions at once |
| Rules history and revert | Review persisted edit rules, inspect current matches, and append safe voiding edits without deleting history |
| Web-based statement upload | Save raw statement exports into the correct account folder from the Accounts page |
| Hierarchical grouping | Income / Expenses / Transfers with entity and category sub-groups |
| Monthly navigation | Browse transactions by year and month |
| Immutable originals | Source files are never altered; all changes stored as separate edit rules |
| File-based storage | JSON files on local filesystem, no database required |

---

## Architecture

MoneyInMotion is an npm workspaces monorepo with three packages:

```
@moneyinmotion/core       Shared domain models, matching, aggregation (pure TypeScript)
         ^
         |
@moneyinmotion/server     Express API, statement parsers, file storage, caching
         ^
         |
@moneyinmotion/web        React SPA with Tailwind CSS, Zustand, React Query
```

**Design principles:**
- Original source files are never altered
- All changes stored as separate, revertible edit rules
- Full audit trail on every modification
- Data can be reconstructed from source files + edits at any time

---

## Supported Import Sources

| Source | Format | Special Features |
|--------|--------|---------|
| Generic Banks | CSV | Auto-column detection |
| American Express | CSV | Phone/category extraction |
| Barclaycard | CSV | Banner line handling |
| PayPal | CSV/IIF | Timezone-aware, activity filtering |
| Amazon Orders | CSV | Order-to-charge matching |
| Etsy Orders | JSON | Receipt reconciliation |
| QuickBooks | IIF | Standard interchange format |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Up / Down Arrow | Navigate transaction rows |
| Left / Right Arrow | Collapse / Expand groups |
| Alt + Right Arrow | Expand all nested levels |
| Alt + T | Edit category |
| Alt + N | Edit note |
| Alt + E | Fix transaction attributes |
| Alt + F | Toggle flag |
| Alt + Shift + F | Remove flag |
| Escape | Close dialog |
| ? | Show keyboard shortcuts help |

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.7 |
| Runtime | Node.js | 18+ |
| API Server | Express | 5.0 |
| Validation | Zod | 3.24 |
| CSV Parsing | papaparse | 5.5 |
| File Watching | chokidar | 4.0 |
| Hashing | ts-md5 | 1.3 |
| Frontend | React | 19.0 |
| Routing | React Router | 7.1 |
| Server State | React Query (TanStack) | 5.62 |
| Client State | Zustand | 5.0 |
| UI Components | Radix UI | 1.x / 2.x |
| Icons | Lucide React | 0.469 |
| Styling | Tailwind CSS | 3.4 |
| Build Tool | Vite | 6.0 |
| Test Framework | Vitest | 3.0 |
| Linting | ESLint | 9.17 |
| Formatting | Prettier | 3.4 |

---

## Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- Git

### Commands

| Command | Description |
|---------|-------------|
| `./install.sh` | Install or update dependencies (checks tools, pulls latest) |
| `./run.sh` | Start in dev mode (hot reload, port 5173) |
| `./run.sh prod` | Start in production mode (port 3001, requires `./build.sh` first) |
| `./build.sh` | Production build of all packages |
| `./build.sh test` | Build and run tests |
| `npm install` | Install all dependencies (manual alternative to `./install.sh`) |
| `npm run dev` | Start server + web dev servers concurrently |
| `npm run dev:server` | Start only the API server (port 3001) |
| `npm run dev:web` | Start only the Vite dev server (port 5173) |
| `npm run build` | Production build (core -> server -> web) |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint all packages |
| `npm run typecheck` | Type-check all packages |
| `npm run clean` | Remove all build artifacts and node_modules |

### Configuration

The server reads configuration in this priority: environment variables > config file > defaults.

| Setting | Env Variable | Config File Key | Default |
|---------|-------------|-----------------|---------|
| Data path | `MONEYAI_DATA_PATH` | `dataPath` | `~/.moneyinmotion/data` |
| Port | `MONEYAI_PORT` | `port` | `3001` |

Config file location: `~/.moneyinmotion/config.json`

### Production

```bash
./build.sh
./run.sh prod
```

The Express server serves the built React app as static files in production
mode. If you prefer to start the server manually, see
[Production Deployment](docs/08-production-deployment.md).

For containerized deployment, see
[Production Deployment](docs/08-production-deployment.md). The repo now
includes a production `Dockerfile` and a health endpoint at `GET /api/health`.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Purpose and Goals](docs/01-purpose-and-goals.md) | Project motivation, goals, and feature overview |
| [Architecture](docs/02-architecture.md) | Monorepo structure, layer diagram, API endpoints, data flow |
| [How It Works](docs/03-how-it-works.md) | Detailed walkthrough of import, matching, editing, and display |
| [Install and Build](docs/04-install-and-build.md) | Prerequisites, build steps, and full dependency listing |
| [User Guide](docs/05-user-guide.md) | End-user guide for the web interface |
| [TODO Items](docs/06-todo.md) | Prioritized list of bugs, features, and technical debt |
| [Business Rules](docs/07-rules.md) | Comprehensive catalog of all business rules in the system |
| [Production Deployment](docs/08-production-deployment.md) | Docker, environment variables, health checks, and deployment notes |

---

## Author

Shital Shah ([@sytelus](https://github.com/sytelus))
