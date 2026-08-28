# Production deployment

MoneyInMotion deploys as one Node.js service that serves both the compiled
website and `/api`. End users visit the resulting URL and install nothing.

## Why Docker is included

Docker is optional; MiM can run directly on Node.js as documented below. The
container exists to make a production release reproducible and portable: it
pins the Node and base-OS environment, builds the website in an isolated stage,
copies only runtime artifacts and production dependencies, runs as a non-root
user, declares a health check, and gives the data root an explicit persistent
volume boundary. The same image can therefore move between a workstation,
server, NAS, or container platform without asking each host to reproduce the
build toolchain manually.

Docker does not put anything on an end user's machine, and it does not provide
authentication, TLS termination, backups, or multi-replica locking. Those are
separate operational responsibilities. A direct Node deployment and a container
deployment execute the same compiled server and website; choose the mechanism
that fits the server environment.

## Security prerequisite

This revision has no login, session, or authorization layer. Anyone who can
reach the application can view and change the active user's financial data and
server configuration. Deploy only on a trusted private network or behind a
reverse proxy/access gateway that authenticates every route. Use TLS for remote
access. See [SECURITY.md](../SECURITY.md).

## Direct Node deployment

Install Node.js 24, use a non-root service account, and give that account
read/write permission only to the configured data root and its own
`~/.moneyinmotion` config directory.

```bash
git clone https://github.com/sytelus/MoneyInMotion.git
cd MoneyInMotion
./install.sh

export MIM_DATA_ROOT=/srv/moneyinmotion
export MIM_USERNAME=shitals
export MIM_PORT=3001
./run.sh prod
```

Run the final command under systemd, another process supervisor, or an
equivalent platform service. Termination signals are handled so the filesystem
watcher and HTTP listener close cleanly. Send traffic to the application only
after `GET /api/health` returns HTTP 200.

Environment configuration overrides values saved from Settings. If a setting
appears not to take effect after restart, inspect the service environment first.

## Container deployment

The multi-stage `Dockerfile` builds on Node 24, prunes development dependencies,
runs as the unprivileged `node` user, exposes port 3001, and includes a health
check. The image expects the data-root volume at `/data`.

```bash
MIM_USERNAME=shitals MIM_PORT=3001 docker compose up --build -d
```

The included Compose file uses a named volume. To use an existing server
directory, replace the volume entry with a bind mount and set appropriate
ownership, for example:

```yaml
services:
  moneyinmotion:
    volumes:
      - /srv/moneyinmotion:/data
```

Do not mount the legacy verification source into `/data`; the running service
is write-capable. Copy data into a dedicated MiM root or upload it through the
website.

## Reverse proxy

Terminate TLS and authentication at the proxy until native authentication is
implemented. Proxy the entire origin, including `/api` and static assets, to
the same MiM process. Preserve request bodies for multipart imports and allow a
body size larger than the desired upload (the application limit is 50 MiB per
file and 500 files). Increase upstream timeouts for synchronous full rebuilds.

Do not configure a CDN or shared cache for API responses containing financial
data. Add `Cache-Control` policies at the proxy conservatively, and avoid
logging request bodies, statement filenames, or edit payloads.

## Backup and recovery

Back up the complete active user directory while no import or edit is running.
At minimum protect:

- `Statements`: source of the generated history;
- `Merged/LatestMergedEdits.json`: corrections and reusable rules;
- `Merged`: current materialized view and timestamped backups; and
- `staging`: upload manifests and recovery copies, according to retention policy.

Also back up `~/.moneyinmotion/config.json` if Settings rather than environment
variables controls deployment. Encrypt backups because statements and edits
contain highly sensitive personal information.

To restore, stop MiM, restore into an explicit dedicated data root, validate
ownership and paths, start the service, inspect Accounts, then run **Rebuild
snapshot** in Settings. Keep the old root unchanged until counts and date ranges
have been checked.

## Upgrades

1. Back up user data and config.
2. Pull or deploy the desired revision.
3. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`, or build a
   fresh container image.
4. Restart the one writer instance.
5. Check `/api/health`, Accounts, latest month, and Rules.

Avoid rolling two MiM processes against the same filesystem volume. The current
save serialization is process-local and does not provide a distributed lock.

## Observability

`GET /api/health` is intentionally small and suitable for liveness checks.
Unexpected server errors and statement parse failures are logged server-side;
production clients receive a generic message for unhandled failures. The app
does not yet expose metrics, traces, a background-job queue, or structured audit
export. Those improvements are tracked in
[Suggested improvements](legacy_suggested_improvements.md).
