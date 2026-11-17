# Development

## Setup

You need Node.js 24 or newer, Git, and Python 3.9+ (backup/restore and its
tests). Then run:

```bat
run.bat dev
```

Use `./run.sh dev` on Linux or macOS. It installs dependencies if needed and
starts the API (`tsx watch`) plus Vite. Open `http://localhost:5173`. Vite
proxies `/api` to the port in `~/.moneyinmotion/config.json`. Both reload on
save, including edits to `packages/core`: Vite reads core source through an
alias, and the API through the `source` export condition in
`packages/core/package.json`.

`run.bat` with no argument (or `prod`) starts the production build on the
configured port instead, and `run.bat --help` lists the modes.

Both modes read and write the configured data root. To experiment
destructively, point `dataRoot` at a scratch folder or take a Settings backup
first. For a throwaway setup, set `HOME` and `USERPROFILE` to a temporary
folder before starting; the server then creates a fresh config there.

### What the launcher does

`run.bat` and `run.sh` only check that Node is on `PATH`; the logic is in
[`scripts/run.mjs`](../scripts/run.mjs), which uses only Node built-ins:

- Runs `npm ci` when `node_modules` is missing or older than
  `package-lock.json` (for example after a `git pull`).
- Production mode rebuilds when any output is older than its inputs. The
  markers are `core/tsconfig.tsbuildinfo`, `server/dist/index.js`, and
  `web/dist/index.html`; folder timestamps catch deleted files. These are
  timestamp checks, so after restoring files with old timestamps, run
  `npm run clean` and start again.
- If the development packages were pruned (only `install.sh` does that), it
  reinstalls them when a build is missing or dev mode needs them. A stale
  build with pruned tools only gets a warning, so a VM keeps serving.
- When the server exits with an error, it names the usual causes: the
  configured port is in use, or the config file is invalid.

## Commands

```bash
npm run typecheck          # tsc -b: packages and e2e
npm run lint               # ESLint: packages, scripts, e2e
npm run format:check       # Prettier (npm run format to fix)
npm test                   # all Vitest projects (core, server, web)
npm run test:coverage      # with V8 coverage
npm run build              # core, server, then website
npm run clean              # remove build output (dist, tsbuildinfo)
npm run smoke:production   # built server on a throwaway root: health, URL, deep links, restart
npx playwright test        # browser journey against the existing build
npm run test:e2e           # build, then the same journey
```

Run one Vitest project or file with `npx vitest run --project server` or
`npx vitest run packages/web/__tests__/lib/rules.test.ts`. VS Code launch
configurations debug the API server and the core tests.

**Before committing:** typecheck, lint, format check, and tests. For server,
build, or script changes, also run the build, the smoke test, and Playwright.
CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs the same
checks on Ubuntu and Windows, plus `npm audit`, the launcher's `--help`, and
the pruned Linux install from `install.sh`.

## Conventions

The [code map](architecture.md#code-map) shows where each kind of code lives.

- Core stays pure: no Node, React, or filesystem. Filesystem calls on the
  server stay in `storage/` and `services/`. Web components only render; pure
  calculations go in `web/src/lib` with their own tests, and server calls go
  through `api/client.ts` and the query hooks.
- TypeScript strict mode. Validate everything that crosses HTTP or comes from
  disk at runtime (Zod); a type is not validation.
- Never modify imported statements. Use the shared atomic writer for JSON
  files. Resolve every derived path and confirm it stays under its root.
- Keep discovery and IDs deterministic: sort directory listings and never
  derive identity from iteration order.
- Write code that runs on Windows and Linux: use `path.join`, never assume
  `HOME`, and don't spawn `python3` or `npm` directly (see `findPythonCommand`
  and `scripts/run.mjs`). Prefer Node scripts over shell scripts.
- Comment _why_ a domain or safety decision exists, not what a line does.
- UI: follow [UX guidelines](ux-guidelines.md). Use accessible labels,
  keyboard paths, and visible focus, and never signal status by color alone.
  Status colors come from the shared `Notice` and `Badge` tokens. The app has
  one complete light theme.
- Dependencies: prefer a plain function or a platform API over a new package.
  Use `npm ci` normally and `npm install` only to change the lockfile, and
  commit `package-lock.json` with it.

## Tests

- **Core:** serialization, effective values, edit merge and restore, matching,
  normalization, aggregation.
- **Server:** every parser, CSV ambiguity, account discovery, storage codecs,
  cache replay and save, all-or-nothing rebuilds, upload path safety, staging,
  dedupe, routes, config, backups, and the launcher and installer
  (`__tests__/scripts`).
- **Web:** API client, navigation state, pages and workflows, reports, and
  rule effects.
- **End to end (`e2e/`, Playwright):** one serial journey against the built
  server in a fresh temporary home and data root. It creates accounts, uploads
  `e2e/fixtures/statements`, checks the Overview figures, saves an income
  decision and reloads, and creates a backup. Run
  `npx playwright install chromium` once per machine. Add a step only when a
  workflow spans pages or depends on the real server; everything else belongs
  in Vitest.

To add a regression for a real failure, reduce it to the smallest rows,
header, or config that still fail, strip personal data, check that the test
fails for the right reason, fix it in the responsible layer, and run the full
suite. Never commit real statements or snapshots. Tests use temporary
directories, and anything that starts the server must set both `HOME` and
`USERPROFILE` to a temporary home.

## Common changes

**Add a statement parser or institution:** if the generic CSV parser can't
read the export, add a parser under `packages/server/src/parsers/statement`
that extends `StatementParserBase`, and choose it in `getStatementParser()`
(`parsers/statement/index.ts`) by normalized institution name and account
type. Add a test under `packages/server/__tests__/parsers` with a sanitized
fixture covering headers, signs, dates, metadata, malformed rows, and case
variants. List it in
[data-and-imports.md](data-and-imports.md#supported-sources), then rebuild a
copy of real data to check it.

**Add an editable field:** extend `EditedValues` in
`core/src/models/transaction-edit.ts` and the effective value in
`transaction.ts`, the Zod schema in `server/src/validation`, and the editor in
`web/src/components/editing/RuleValuesEditor.tsx` with `web/src/lib/rules.ts`.
See [edits-and-rules.md](edits-and-rules.md#adding-an-editable-field) for what
to test.

**Add to the Overview or a report:** put the calculation in
`web/src/lib/financial-reports.ts` (or `cash-flow.ts` for income and spending
classification) with tests, render it from a component in
`web/src/components/reports`, and compose it in `pages/ReportsPage.tsx`. See
[financial-reports.md](financial-reports.md#module-boundaries).

**Add an API endpoint:** add it to the router in `server/src/routes`
(mounted in `app.ts`), validate input with Zod, add the call to
`web/src/api/client.ts` and a hook in `api/hooks.ts`, and document it in
[api.md](api.md).

**Add a page:** create it in `web/src/pages`, add a lazy route in `App.tsx`
and a link in `components/layout/Header.tsx`, and add its deep link to
`scripts/smoke-production.mjs`.

**Change the storage layout:** treat it as a migration. Update `ServerConfig`,
the repositories, Settings, backups, and fixtures. Never silently move user
files at startup.
