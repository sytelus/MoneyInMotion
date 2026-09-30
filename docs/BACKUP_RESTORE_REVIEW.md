# Backup and restore implementation review

## Brief and boundary

Date: 2026-09-30. Scope: the new Settings full-user backup and restore workflow.
The initial restricted run did not commit or push; its results and limits are
preserved below. The follow-up records acceptance after permissions were restored.
Neither run performed a financial schema migration, real-data backup, or real-data
restore.

Applicable principles: UX-01, UX-02, UX-08 through UX-14, UX-16, UX-18 through
UX-20. Feedback: F01, F03, F30, F36–F38, F40, F52–F55, and new F58 in the
[feedback register](UX_FEEDBACK_TRACEABILITY.md). The filename request was
interpreted as a `.zip` file in the server home, with the configured username as
the alias and a collision-resistant UTC datetime suffix.

All mutation tests use fresh OS temporary directories and synthetic data: a
generic account, one transaction, one saved category rule, nested statements,
binary staging content, a receipt, and an empty directory. An oversized-file
test uses a sparse file, not financial data. The live config and both the active
financial tree and read-only Dropbox reference remain untouched.

## Journey and implementation

| Task                      | Entry and outcome                                                                                    | Safety and evidence                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Create a recovery archive | Settings shows included state, server folder, filename pattern, result counts/path, and ZIP download | New immutable private ZIP; no rebuild; round-trip tests compare complete file bytes           |
| Select an archive         | Newest matching server filename by default, alternative saved ZIP or device file picker              | Loading/error/empty states differ; local file extension/size checks prevent invalid upload    |
| Review replacement        | Validated archive date, user, size/count, destination, saved port                                    | Private staged extraction; no active data writes; expiring token and exact destination check  |
| Confirm or cancel         | Type the active username; explicit replacement action; Cancel                                        | Cancellation deletes only staging; stale tokens/data revisions rejected                       |
| Inspect result            | Reload clears browser caches/selections; result identifies retained previous data                    | Server cache invalidated; archived snapshot loaded without import/rebuild                     |
| Recover from failure      | Old data/config retained; failed replacement rolls back; startup handles an interrupted swap         | Failure injection and interruption-phase tests; failed rollback blocks further data endpoints |

## Findings and refinements

### Replacement must preserve the saved state

P0 data safety, UX-11/UX-12, F58. Overlay extraction would retain later files;
automatic rebuilding could change results under newer code. Implemented whole
directory replacement with preserved previous directory/config, no rebuild, and
cache invalidation. Verified with exact tree/file comparison, timestamp checks,
saved rules, corrupted live snapshot recovery, and fresh-cache reload.

### Delayed requests must not write during maintenance

P0 data safety, UX-12/UX-16. Checking only when a request arrives misses a JSON or
multipart body that finishes later. Added a second gate after JSON decoding and
an import pre-write recheck; earlier cache mutations drain before maintenance.
Maintenance serialization and rejected concurrent Settings writes are tested.
There is still no multi-process or external-writer lock; those writers must stop.

### Backup creation and restore need distinct completion states

P1 clarity, UX-08/UX-13, F40/F58. Creating a server ZIP is not a browser download;
validating a candidate is not committing a restore. Implemented separate actions,
pending states, confirmation, cancellation, persisted session result after reload,
and explanatory errors. Settings disables save/rebuild during maintenance.
The initial run covered these distinctions with interaction tests; the follow-up
below adds fresh production-browser evidence.

### A multipart boundary exposed an upload limit error

P1 blocked task, UX-12/UX-19. The first in-process API test rejected a valid
single-file ZIP because the multipart parser counts the following boundary at
its part limit. The limit now allows that boundary while file/field limits still
enforce exactly one file and zero additional fields. The upload-to-restore
integration test passes.

### Recovery guidance must not silently rebuild

P1 misleading instructions, UX-11/UX-20, F52/F58. Deployment previously told users
to rebuild after offline restore. Updated it to inspect the saved state first;
rebuilding is explicitly separate. The [current guide](backup-and-restore.md)
is canonical for archive scope, recovery, limits, and operational prerequisites.

## Initial restricted verification

The isolated acceptance checks passed 730 tests across 63 files:
507 core/web tests and 223 server tests that do not require listening sockets.
This includes 37 new regressions (29 backup/service/API cases, seven Settings
interaction cases, and one private atomic-file permission case). TypeScript,
ESLint, repository formatting, Bash syntax, and the production build were also
checked. Seven pre-existing test files requiring sockets or restricted process
execution were excluded from this passing subset; it is not the full suite.

Implemented and covered by isolated tests:

- standard ZIP creation/reading, binary content, full data/config round trip,
  empty directories, file timestamps, archive collision avoidance;
- corrupt/truncated ZIPs, checksum/content changes, missing members, unsafe
  absolute/traversal paths, linked entries/live files, unsupported archive version,
  wrong destination, unreadable saved snapshots, and oversized files;
- confirmation, stale/expired/replayed preview tokens, cancellation, port restart
  indication, retained original files, failed swaps, interruption phases, blocked
  API state after failed rollback, and maintenance serialization;
- real Express middleware and handlers driven by in-memory Node HTTP streams,
  including download, multipart upload, origin rejection, and post-restore reads;
- Settings controls, default selection, result/download copy, local upload checks,
  validation errors, exact confirmation, cancellation, and reload intent.

That session could not bind listening sockets (`listen EPERM`). Existing socket-based
route tests therefore failed at their transport setup, not at an application
assertion. They were not removed or rewritten to conceal that restriction.
The new in-process HTTP helper supplements—not replaces—TCP/proxy/browser tests.
The complete suite was not claimed to pass in that restricted environment.

No fresh local Chromium screenshots or live production interaction were captured
in the initial run.
Wide/narrow layout, rendered contrast, keyboard focus restoration, assistive
technology, large-archive timing, proxy limits/timeouts, actual process-kill and
power-loss behavior remain **unverified**. Service tests simulate interruption
phases and failed renames; that is not evidence of filesystem durability across
power loss. This is implemented and functionally tested, with production-browser
acceptance still outstanding.

Reproducible focused checks:

```bash
npm test -- --project server packages/server/__tests__/services/backup-service.test.ts
npm test -- --project web packages/web/__tests__/components/BackupRestore.test.tsx
npm run typecheck
npm run lint
npm run format:check
npm run build
```

Run the normal full suite and `npm run smoke:production` in an environment that
permits local sockets. Before relying on recovery for live data, perform a
production-browser drill against a throwaway root: create data/rules, back up,
make a later change, preview/cancel once, then restore and inspect the saved state
and retained previous tree. Exercise an uploaded ZIP and a corrupt archive too.

## Learning and handoff

UX-11 now explicitly distinguishes full recovery from report exports and requires
the round trip to preserve saved state without silently rebuilding. F58 records
this request without duplicating the canonical schema proposal register.

Python 3.9+ is a new backup/restore prerequisite, documented in setup/deployment;
its standard library avoids adding an unreviewed ZIP dependency or custom ZIP
parser. ZIPs are not encrypted or automatically expired. Same-location restore,
resource bounds, private recovery directories, and lack of off-machine copies
are explicit, not hidden behind a generic “backup succeeded” claim.

Next acceptance priorities after the follow-up below are proxy/large-archive
testing and an encrypted off-machine recovery drill. Historical verification
dates/results remain intact in the broader testing docs.

## Follow-up after permissions were restored

On 2026-09-30, the full suite passed **813 tests across 70 files**, with no excluded
files. This includes two additional cancellation-focus regressions, bringing the
backup/restore addition to 39 cases beyond the 774-test historical baseline.
TypeScript, ESLint, repository formatting, Bash syntax, the optimized production
build, and the real HTTP production/restart smoke test also passed.

The dependency audit found three vulnerable packages. Compatible lockfile updates
raised `brace-expansion` to 5.0.12, `multer` to 2.4.0, and `undici` to 8.11.2,
removing six unused transitive dependencies. No major-version or manifest-range
changes were needed. The full tests were rerun after these updates; the audit
reported zero vulnerabilities.

The read-only legacy comparison also passed against a temporary copy, with all
431 rules replayed, the same 125 resolved / 37 already-unresolved exact targets,
and zero transaction-count or effective-amount change across persistence. Its
previously documented legacy graph differences were unchanged.

### Local Chromium recovery drill

The compiled production app served a real loopback HTTP listener, with its config,
home directory, and data explicitly isolated in an OS temporary workspace. The
fixture contained one account, one statement transaction, one saved category rule,
binary staging data, a receipt, and an empty directory. No live financial data or
canonical user configuration was changed. The normal production entry point and
restart were checked separately by the production smoke test.

Verified through the actual Settings controls:

- Create a full backup and download the ZIP; active files remain unchanged.
- Introduce later files and a corrupt snapshot in the disposable tree, preview
  the backup, then cancel without changing those files.
- Upload the downloaded ZIP through the browser file picker and inspect the
  preview. Incorrect confirmation leaves replacement disabled.
- Confirm with the exact username, replace the data, and observe the full page
  reload and restored-state receipt.
- Compare the complete restored tree and config byte-for-byte, compare the
  transaction/rule API with its saved state, and verify that the retained previous
  tree contains the later work and corrupted snapshot.
- Upload a corrupt ZIP; observe a visible validation error and no active-data change.

Fresh screenshots were inspected at 1440 × 1000 and 390 × 844. The tested Settings,
preview, result, and error states had no document-level horizontal overflow. Six
synthetic screenshots and the disposable check script remain local under
`/tmp/mim-recovery-browser-hUfniY/`, outside Git; temporary evidence may expire.
There were no uncaught browser page errors.

### Cancellation focus correction

UX-07, UX-09, UX-11; F54/F58. The browser drill exposed lost keyboard focus when
canceling the asynchronous preview. Its opener was disabled during validation,
so the shared dialog could capture the document body rather than the opener.
The dialog now accepts an explicit return-focus reference, used by Review restore;
existing synchronous callers retain their current behavior. Two new tests first
failed for this defect and then passed. Chromium also confirmed that both Cancel
and Escape return focus to Review restore without changing data.

### Remaining verification limits

This closes the initial live-HTTP and production-browser blockers for the tested
recovery journey. It does not establish complete accessibility or large-data
performance: assistive technology, all keyboard sequences, other browser engines,
physical touch devices, zoom, fresh numerical contrast measurement, large-archive
timing, proxy limits, real process-kill recovery, and power-loss behavior remain
unverified. Service failure-injection tests are not a power-loss durability claim.
