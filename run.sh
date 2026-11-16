#!/usr/bin/env bash
# MoneyInMotion: start the website and API on Linux or macOS.
#
#   ./run.sh        production server (default; installs and builds when needed)
#   ./run.sh dev    API and Vite website with hot reload
#
# All logic lives in scripts/run.mjs, shared with run.bat.

set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || {
    echo "[error] Node.js 24 or newer is required: https://nodejs.org/" >&2
    exit 1
}

exec node scripts/run.mjs "$@"
