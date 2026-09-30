# Development

## Prerequisites and first build

Use Node.js 24 or newer, npm, and Git. `.nvmrc`, the package engine, CI, and the
VM deployment instructions intentionally agree on Node 24.
Backup/restore and their service tests use `python3` (3.9+), with no third-party
Python packages. Keep `scripts/backup-archive.py` in production checkouts: the
compiled server calls that standard-library ZIP helper directly.

```bash
nvm use                    # when nvm is installed
./install.sh --development # npm ci, type check, production build
./run.sh dev               # API on configured port, Vite site :5173
```

The `--development` option keeps compilers, tests, and hot-reload tools.
`./install.sh` without it prepares a production VM and prunes those packages.
People visiting a deployed website require only a supported browser.

Application configuration lives only in `~/.moneyinmotion/config.json` and is
editable from Settings. The app creates the file on first start. Use a separate
OS account or temporarily replace that file with an isolated configuration for
development; restore it before starting the production instance.

## Development and production modes

These are two execution modes of one application—not separate products or
separate financial models. Both use the same core domain package, Express API,
parsers, filesystem layout, snapshots, and edit rules. The distinction keeps
fast source-level tooling out of the smaller, safer runtime served to users.

| Concern                | Development (`./run.sh dev`)                     | Production (`./run.sh`, the default)                          |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Primary purpose        | Implement and debug changes                      | Serve browser users reliably                                  |
| Website server         | Vite on port 5173 with hot-module reload         | Express on the port in `config.json`, default 3001            |
| API server             | Express on configured port; Vite proxies `/api`  | Same Express process and origin as the website                |
| Code form              | TypeScript/TSX transformed on demand             | Precompiled server and optimized browser assets               |
| Build required first   | Core is built automatically when needed          | `run.sh` rebuilds stale output when build tools are installed |
| Browser caching/assets | Developer-oriented source maps and rapid refresh | Hashed, minified production assets                            |
| HTTP layout            | Vite proxy keeps browser requests same-origin    | Site and API are inherently same-origin                       |
| Unexpected API errors  | Detailed message returned for diagnosis          | Internal details hidden from the browser and retained in logs |
| Runtime dependencies   | Includes compilers, tests, and development tools | Can be pruned to production dependencies                      |

Because both modes can write real statement and edit files, developers should
use a dedicated test root instead of the production root. Set `dataRoot` and
`username` to isolated values in `~/.moneyinmotion/config.json`, restart, and
restore the production values before running the production instance again.

Production freshness is checked independently for core, server, and web. The
TypeScript build-info files mark completed compilations; a newly built website
cannot hide an older API build. Source directory timestamps also catch removals.
These are timestamp checks, not content attestations: run `./build.sh` after
restoring files with preserved timestamps. Missing outputs trigger a build (or
a hard error without build tools); stale outputs with pruned tools produce a
warning and start the existing build. `./install.sh` always installs build tools,
forces compilation, then prunes only in production mode—even if the invoking
environment already sets `NODE_ENV=production`.

## Workspace commands

Before development against valuable data, create a full archive in Settings.
See [Backup and restore](backup-and-restore.md); use synthetic data for write
tests rather than relying on a backup as permission to mutate live finances.

```bash
npm run typecheck          # TypeScript project references
npm run lint               # ESLint across application code and repository scripts
npm run format:check       # Prettier consistency without changing files
npm run format             # Format supported repository files in place
npm test                   # complete Vitest suite, once
npm run test:watch         # focused test development
npm run test:coverage      # V8 coverage output
npm run build              # core, server, then website
npm run smoke:production   # built production server, deep link, restart, data
npm run clean              # generated package build output only
```

Use `npm ci` for CI/deployments and `npm install` when intentionally updating
the lockfile. Commit `package-lock.json` with dependency changes. Dependabot is
configured for weekly npm and monthly GitHub Actions updates.

## Package boundaries

Put behavior in the narrowest stable layer:

- Domain invariants, corrected values, matching, and aggregation belong in
  `packages/core/src`.
- Parsing, disk access, upload lifecycle, configuration, and HTTP adapters
  belong in `packages/server/src`.
- Interaction and presentation belong in `packages/web/src`; call the server
  through `api/client.ts` and expose server state through query hooks.

Do not import server modules into core or web, or React modules into core. Avoid
filesystem calls outside repositories and services. Prefer explicit data
interfaces at API and persistence boundaries.

## Coding standards

- UX-affecting work follows the [UX design guide](UX_DESIGN_GUIDE.md). Its
  [feedback register](UX_FEEDBACK_TRACEABILITY.md) supplies concrete project
  examples; the [review template](UX_REVIEW_TEMPLATE.md) captures new evidence.
- TypeScript strict mode is the baseline. Model absence explicitly instead of
  hiding it with broad casts or non-null assertions.
- Validate untrusted HTTP and file-boundary values. A TypeScript type is not
  runtime validation.
- Normalize paths once and prove that resolved destinations remain under their
  configured root before writing.
- Make persistence replacement atomic and never overwrite imported source
  statements.
- Keep processing deterministic: sort filesystem discovery and avoid identities
  derived from iteration order.
- Comment why a domain or safety decision exists. Avoid comments that merely
  repeat a clear line of code.
- Use accessible labels, keyboard behavior, focus indicators, and responsive
  states for every UI addition. Do not communicate status using color alone.
  Use the shared `Notice`/`Badge` semantic foreground, background, and border
  pairs for status colors; do not place pale text on an unpaired light surface.
  The app currently implements a complete light palette (`color-scheme: light`,
  Tailwind `darkMode: 'class'`), not an OS-driven partial dark theme. A future
  dark theme must define all surfaces and be reviewed as a complete palette.
  Review screenshots at wide, narrow, and mobile widths, including an OS dark
  preference. Use progressive disclosure for infrequent detail, compact tables
  for large catalogs, and direct action labels such as “View transactions”.
  Routine consequences belong in action labels/help (for example “Save and
  rebuild”); reserve warnings for actual risk and actionable problems.
- Add focused regression fixtures before changing format-specific parsing.

Formatting follows `.editorconfig` and `.prettierrc`. Run the same verification
commands as CI before opening a pull request.

### UX review workflow

Record applicable UX/F IDs and the user journey before implementation. Check
existing-data entry, normal operation, cancellation, partial failure, recovery,
representative scale, and narrow/wide layouts—not just the screen in the bug
report. Verify facts against the API/data/configuration as well as the pixels.
Use fresh screenshots for current visual claims and isolated data for writes.

Keep principles in the design guide, current behavior in the topic guide, and
dated evidence in the review record. Update the feedback register when a new
critique exposes a missing acceptance check. Documentation-only synthesis needs
format/link checks, not fabricated browser results or a new application test
baseline. Persistence proposals remain separately reviewed.

## Common change paths

### Add a statement parser

1. Add a parser under `packages/server/src/parsers/statement`.
2. Register selection in the parser index/factory.
3. Add a minimal sanitized fixture and cover headers, signs, dates, metadata,
   malformed rows, and case variants.
4. Document the institution and format in `data-and-imports.md`.
5. Rebuild a representative isolated data copy.

### Add an editable field

Follow the full checklist in [Transaction edits and rules](transaction-edits.md).
The core effective value, rule replay, server Zod schema, UI, and legacy codec
must evolve together.

### Change the storage layout

Treat this as a migration. Update `ServerConfig`, repositories, the Settings
contract, systemd/config-file examples, backup instructions, fixtures, and the
read-only legacy verifier. Support existing config/data or provide a separately
tested migration tool; never silently move user files at startup.

## Test data safety

Tests create isolated temporary directories and clean them after use. The
legacy verifier copies only required source inputs into an OS temporary
directory. Never point a write-capable repository, formatter, cleanup script,
or test output at `/mnt/d/Dropbox/MoneyAI/`; that source is verification-only.

## Repository hygiene

The C# solution, checked-in package binaries, local web host, and other legacy
runtime files were removed from the current tree after the TypeScript behavior
was established. Git history is the archive. Do not reintroduce generated
`dist`, `coverage`, `.tsbuildinfo`, `node_modules`, private finance data, or a
local `mim_root` into commits.
