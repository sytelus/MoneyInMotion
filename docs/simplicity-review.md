# Architecture and infrastructure simplicity review

This review applies the current product constraint: one user, one inexpensive
VM, one Node.js process, and filesystem persistence. The goal is not the fewest
possible lines; it is the fewest concepts and dependencies that safely deliver
today's behavior.

## Resulting production shape

```text
one browser
    ↓
one Express process serving the compiled React site and /api
    ↓
one <data-root>/<username> filesystem tree
```

There is no Docker image, database, ORM, cache server, queue, worker, scheduler,
object store, CORS service, filesystem watcher, or dependency-injection
container. systemd starts and restarts the process on a Linux VM.

The verified production installer builds from the lockfile and then prunes the
toolchain and browser build dependencies. In the review environment this reduced
`node_modules` from about 286 MiB during development to 13 MiB at runtime. The
largest compiled browser JavaScript chunk is about 82 KiB compressed;
management screens are separate on-demand route chunks. These figures are
measurements, not hard resource guarantees.

## Removed complexity

| Removed                                                     | Why it was unnecessary now                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dockerfile, Compose, and Docker ignore rules                | Direct Node/systemd deployment is simpler for the target VM and is the only supported production path.                          |
| Chokidar filesystem watcher                                 | The one server process is the supported writer; Settings already provides an explicit rebuild after administrator file changes. |
| CORS package and middleware                                 | Development uses Vite's same-origin proxy and production serves the site and API from one Express origin.                       |
| TanStack Table                                              | It was used only to generate five fixed column headers; static semantic markup is clearer.                                      |
| Radix Accordion                                             | Native `<details>`/`<summary>` provides the year disclosure behavior.                                                           |
| Unused Radix Select, Popover, and Tooltip packages          | No application code imported them.                                                                                              |
| Class Variance Authority                                    | Two components had small fixed style maps that are easier to read directly.                                                     |
| Hand-maintained Vite vendor chunk rules                     | Native route-level imports let Vite split screens automatically without a fragile vendor map.                                   |
| Per-package Vitest configs and test scripts                 | The repository has one authoritative root test command and configuration.                                                       |
| Legacy `scanAndImport` alias and `/import/scan` terminology | The operation is a complete snapshot rebuild; one name is easier to understand.                                                 |
| Config getter callbacks                                     | Runtime configuration is immutable until restart and can be passed directly.                                                    |
| Duplicate/unused UI state and aggregator bookkeeping        | Unused context wrappers, store fields, visibility state, counters, and recursive collectors had no production consumers.        |
| Frontend libraries in the VM runtime                        | Vite has already compiled them into static assets, so the production installer now prunes them.                                 |

The upload and JSON limits were also reduced to fit a small VM: 2 MiB for API
JSON, 100 MiB of received files per folder request (with an earlier declared-
length rejection when available), at most 200 files, and 20 MiB per file.
Larger histories can be uploaded in batches.

## Boundaries retained deliberately

The three npm workspaces remain because they correspond to real compile/runtime
boundaries rather than hypothetical extension points:

- `core` is shared financial behavior and legacy-compatible serialization;
- `server` can use Node filesystem/HTTP APIs and owns all data writes; and
- `web` runs in a remote browser and cannot access server files.

They build into one deployable website and are not microservices.

The remaining direct libraries each perform a current job that would be harder
or less safe to reimplement locally:

- React and React Router render six primary browser destinations plus recovery
  and compatibility redirects;
- TanStack Query coordinates server reads and mutation refreshes;
- Zustand holds shared period, selection, and expansion state;
- Radix Dialog and Dropdown Menu provide accessible focus/menu behavior;
- Tailwind, Lucide, `clsx`, and `tailwind-merge` support the existing responsive
  visual system;
- Express serves the API and compiled site;
- Zod validates untrusted JSON;
- Multer parses directory uploads;
- Papa Parse handles statement CSV edge cases;
- Helmet applies browser security headers; and
- `ts-md5` preserves legacy IDs in both Node and browser builds.

Replacing these with bespoke code would move complexity into the repository
without reducing the concepts maintainers need to understand.

## Rule for future changes

Prefer a plain function, native browser/server capability, or existing module
before adding a dependency. Add infrastructure only when a measured current
requirement cannot be met by one process and the filesystem model. Record the
trigger, operational cost, failure modes, and removal plan in the same change.
