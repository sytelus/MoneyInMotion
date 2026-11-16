# Development

## Setup

You need Node.js 24 or newer, Git, and Python 3.9+ (backup/restore and its
tests). Then run:

```bat
run.bat dev
```

Use `./run.sh dev` on Linux or macOS. Either one installs dependencies, builds
core, and starts the API plus Vite.

Open `http://localhost:5173`. Vite proxies `/api` to the port in
`~/.moneyinmotion/config.json`. `run.bat` with no argument starts the
production build on that port instead.

The launcher logic lives in [`scripts/run.mjs`](../scripts/run.mjs) and uses
only Node built-ins. It installs dependencies when `node_modules` is missing
or older than `package-lock.json`. It rebuilds when an output is older than
its inputs, using these markers: `core/tsconfig.tsbuildinfo`,
`server/dist/index.js`, and `web/dist/index.html`. Folder timestamps catch
deleted files. These are timestamp checks, so after restoring files with old
timestamps, run `npm run build` yourself.

Both modes read and write the configured data root. To experiment
destructively, point `dataRoot` at a scratch folder or take a Settings backup
first.

## Commands

```bash
npm run typecheck          # tsc -b across the workspaces
npm run lint               # ESLint for packages and scripts
npm run format:check       # Prettier (npm run format to fix)
npm test                   # all Vitest projects
npm run test:coverage      # with V8 coverage
npm run build              # core, server, then website
npm run smoke:production   # built server against a throwaway root: health, deep links, restart
npm run verify:legacy -- <legacy-root>   # read-only C# parity report (see legacy-migration.md)
```

Before committing: typecheck, lint, format check, and tests. For server,
build, or script changes, also run the build and the smoke test. CI
(`.github/workflows/ci.yml`) runs the same checks on Ubuntu and Windows, plus
`npm audit` and the pruned Linux install.

## Where code belongs

- **`packages/core/src`**: domain invariants, corrected values, matching,
  aggregation. No Node, React, or filesystem.
- **`packages/server/src`**: parsers, disk access, upload lifecycle, config,
  and HTTP routes. Filesystem calls stay in repositories and services.
- **`packages/web/src`**: UI. Call the server through `api/client.ts` and
  read server state through query hooks. Pure calculations go in `lib/`
  (for example `financial-reports.ts`, `rule-effects.ts`,
  `transaction-navigation.ts`, `import-preflight.ts`) with their own tests,
  and components only render them.

## Conventions

- TypeScript strict mode. Validate everything that crosses HTTP or comes from
  disk at runtime (Zod); a type is not validation.
- Never modify imported statements. Use the shared atomic writer for JSON
  files. Resolve every derived path and confirm it stays under its root.
- Keep discovery and IDs deterministic: sort directory listings and never
  derive identity from iteration order.
- Write code that runs on Windows and Linux: use `path.join`, never assume
  `HOME`, and don't spawn `python3` or `npm` directly (see `findPythonCommand`
  and `scripts/run.mjs`).
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
- **Server:** every parser, CSV ambiguity, account discovery, legacy codecs,
  cache replay and save, all-or-nothing rebuilds, upload path safety, staging,
  dedupe, routes, config, backups, and the launcher's build decisions
  (`__tests__/scripts`).
- **Web:** API client, navigation state, pages and workflows, reports, and
  rule effects.

To add a regression for a real failure, reduce it to the smallest rows,
header, or config that still fail, strip personal data, check that the test
fails for the right reason, fix it in the responsible layer, and run the full
suite. Never commit real statements or snapshots. Tests use temporary
directories, and anything that starts the server must set both `HOME` and
`USERPROFILE` to a temporary home.

## Common changes

**Add a statement parser:** add it under
`packages/server/src/parsers/statement`, register it in the parser index, and
add a sanitized fixture covering headers, signs, dates, metadata, malformed
rows, and case variants. Then list it in
[data-and-imports.md](data-and-imports.md#supported-sources) and rebuild a
copy of real data to check it.

**Add an editable field:** see [edits-and-rules.md](edits-and-rules.md#adding-an-editable-field).

**Change the storage layout:** treat it as a migration. Update `ServerConfig`,
the repositories, Settings, backups, fixtures, and the legacy verifier. Never
silently move user files at startup.
