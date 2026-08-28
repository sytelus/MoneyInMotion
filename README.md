# MoneyInMotion

MoneyInMotion (MiM) is a self-hosted personal-finance website. It imports
statement exports from banks, cards, PayPal, Amazon, Etsy, and QuickBooks,
reconciles related transactions, and presents one editable financial history.
The person using MiM needs only a browser: source files, snapshots, rules, and
all processing live on the web server.

The current release intentionally serves one configured user at a time. The
username folder is part of the existing data layout, not a multi-tenant service.
Do not expose an unprotected instance to the public Internet; see
[Security](SECURITY.md).

## What the website does

- Manages the accounts represented by folders beneath
  `<data-root>/<username>/Statements` and their `AccountConfig.json` files.
- Accepts a browser-selected directory containing one subfolder per account.
- Stages every upload, identifies identical content with SHA-256, promotes only
  new statements, and records every decision in a batch manifest.
- Automatically rebuilds the financial snapshot after an upload. A parse error
  preserves the last known-good snapshot and reports the affected file.
- Reconciles order-history items and card charges, recognizes inter-account
  transfers, normalizes merchant names, and builds monthly summaries.
- Corrects amount, date, reason, merchant/payee, category, note, and flag fields.
  A correction can target selected transactions or become a reusable rule.
- Preserves imported values. User intent is stored separately in
  `LatestMergedEdits.json`, with an audit record and reversible rule history.

## Quick start

Server prerequisites are Git and Node.js 24 or newer. Browser users install
nothing.

```bash
git clone https://github.com/sytelus/MoneyInMotion.git
cd MoneyInMotion
./install.sh
./run.sh prod
```

Open `http://localhost:3001`, or the HTTPS URL of the reverse proxy in front of
the server. The default storage location is:

```text
~/min_root/<operating-system-username>/
```

Change the root or active username in Settings, or set `MIM_DATA_ROOT` and
`MIM_USERNAME` before starting the server. Configuration changes made in the
website take effect after a restart.

For development with API and UI hot reload:

```bash
./install.sh --development
./run.sh
# website: http://localhost:5173
# API:     http://localhost:3001
```

## Statement import workflow

1. Open Accounts and create or review an account. The displayed account folder
   is the name MiM expects in an uploaded directory.
2. Select a local directory containing one subfolder per configured account.
   Browsers send file bytes and relative paths; they never disclose or grant
   the server access to an arbitrary local path.
3. Review the detected files, then choose **Upload & build snapshot**.
4. MiM stores an immutable staging copy, rejects configuration files and
   unsupported paths, skips statement content already present for the account,
   and promotes new files to `Statements`.
5. The server rebuilds from every accepted statement and replays saved edits.
   The new snapshot is committed only if every statement parses successfully.

See [Data and imports](docs/data-and-imports.md) for the precise storage and
deduplication contract.

## Repository layout

```text
packages/core/    Framework-independent TypeScript domain model, matching,
                  aggregation, rules, and legacy-compatible serialization
packages/server/  Express API, parsers, filesystem repositories, staging,
                  snapshot lifecycle, and production static-file hosting
packages/web/     React single-page website and accessible component UI
scripts/          Build helpers and read-only legacy verification
deploy/           One small systemd service definition for a Linux VM
docs/             Architecture, operations, user behavior, and migration notes
```

This is an npm-workspaces monorepo. The production server serves the compiled
React application and `/api` from one origin.

## Technology

- TypeScript 5 across all packages
- React 19, React Router 7, TanStack Query, Zustand, Radix UI, Lucide,
  and Tailwind CSS for the browser application
- Express 5, Zod 4, Multer, Papa Parse, and Helmet for the server
- Vite 8 for the web build and Vitest 4 with Testing Library for tests
- Node.js 24 as the supported server and CI runtime

## Commands

| Command                                          | Purpose                                                         |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `./install.sh`                                   | Build a VM release and prune development-only packages          |
| `./install.sh --development`                     | Install the compiler, test, lint, and hot-reload toolchain      |
| `./run.sh`                                       | Development API and website with hot reload                     |
| `./build.sh`                                     | Type check, lint, and build every package                       |
| `./build.sh test`                                | Build, then run the full test suite                             |
| `./run.sh prod`                                  | Serve the built website and API on `MIM_PORT`                   |
| `npm test`                                       | Run all unit, integration, route, storage, parser, and UI tests |
| `npm run test:coverage`                          | Run tests and generate a coverage report                        |
| `npm run verify:legacy -- /absolute/legacy/root` | Read-only compatibility report using an isolated temporary copy |
| `npm run clean`                                  | Remove generated build, coverage, and dependency artifacts      |

## Configuration

Environment variables override `~/.moneyinmotion/config.json`, which overrides
defaults.

| Setting             | Preferred environment variable | Default      |
| ------------------- | ------------------------------ | ------------ |
| Data-root directory | `MIM_DATA_ROOT`                | `~/min_root` |
| Active username     | `MIM_USERNAME`                 | OS username  |
| HTTP port           | `MIM_PORT`                     | `3001`       |

The older `MONEYAI_*` variable names and single-user `dataPath` config are read
for migration compatibility. New deployments should use the `MIM_*` names.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/architecture.md)
- [Architecture and infrastructure simplicity review](docs/simplicity-review.md)
- [Data and imports](docs/data-and-imports.md)
- [Transaction edits and rules](docs/transaction-edits.md)
- [Development](docs/development.md)
- [Testing and legacy verification](docs/testing-and-verification.md)
- [Production deployment](docs/deployment.md)
- [HTTP API](docs/api.md)
- [Legacy divergences](docs/legacy_divergence.md)
- [Current migration limitations](docs/legacy_limitations.md)
- [Suggested improvements](docs/legacy_suggested_improvements.md)
- [Prioritized TODO backlog](todo.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
