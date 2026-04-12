# MoneyInMotion - Production Deployment

## Overview

MoneyInMotion can run directly with Node.js or inside Docker. In both cases,
the production deployment is a single Express process that serves both:

- The REST API under `/api/*`
- The built React application as static assets

## Environment Variables

The production server reads configuration in this priority order:

1. Environment variables
2. `~/.moneyinmotion/config.json`
3. Built-in defaults

Supported environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `MONEYAI_DATA_PATH` | Root data directory containing `Statements/` and `Merged/` | `~/.moneyinmotion/data` |
| `MONEYAI_PORT` | HTTP listen port | `3001` |
| `CORS_ALLOWED_ORIGINS` | Optional comma-separated origin allowlist in production | same-origin only |
| `NODE_ENV` | Set to `production` to serve built web assets | unset / development |

## Health Check

MoneyInMotion exposes a lightweight health endpoint:

```text
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "environment": "production",
  "timestamp": "2026-04-12T08:00:00.000Z",
  "uptimeSeconds": 123.456
}
```

This is suitable for container health checks and external monitoring.

## Running With Node.js

Build first:

```bash
./build.sh
```

Then run:

```bash
./run.sh prod
```

Manual alternative:

```bash
cd packages/server
NODE_ENV=production node dist/index.js
```

## Running With Docker

Build the image:

```bash
docker build -t moneyinmotion:latest .
```

Run it with a host directory mounted at `/data`:

```bash
docker run --rm \
  -p 3001:3001 \
  -e MONEYAI_PORT=3001 \
  -e MONEYAI_DATA_PATH=/data \
  -v /absolute/path/to/mim-data:/data \
  moneyinmotion:latest
```

Open:

```text
http://localhost:3001
```

## Recommended Data Volume Layout

Your mounted data directory should contain:

```text
data/
├── Statements/
└── Merged/
```

The server will create missing directories automatically.

## Reverse Proxy Notes

If you place MoneyInMotion behind a reverse proxy:

- Proxy both the SPA and `/api/*` through the same origin when possible.
- If you must serve the UI from a different origin, set
  `CORS_ALLOWED_ORIGINS`.
- Keep health checks pointed at `/api/health`.

## Operational Notes

- Changing `MONEYAI_DATA_PATH` or `MONEYAI_PORT` requires a process restart.
- Imported statements are never modified by the app.
- Persist the data directory on durable storage; the container filesystem
  itself should be treated as ephemeral.
