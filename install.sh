#!/usr/bin/env bash
# Production install for the optional Linux VM (docs/deployment.md).
#
#   cd /opt/moneyinmotion && ./install.sh
#
# Installs the exact dependency graph, type-checks, builds, then prunes
# development packages. On your own computer use run.bat or ./run.sh instead;
# they install and rebuild as needed and keep the development tools.

set -euo pipefail

info() { echo "[info]  $*"; }
fail() {
    echo "[error] $*" >&2
    exit 1
}

# Run from the checkout so a stray invocation can't install somewhere else.
if [ ! -f package.json ] || ! grep -q '"moneyinmotion"' package.json; then
    fail "run ./install.sh from the MoneyInMotion folder."
fi
command -v node >/dev/null 2>&1 || fail "Node.js 24 or newer is required: https://nodejs.org/"
command -v npm >/dev/null 2>&1 || fail "npm is required (it ships with Node.js)."
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 24 ] || fail "Node.js $(node --version) found; Node.js 24 or newer is required."
command -v python3 >/dev/null 2>&1 ||
    echo "[warn]  Python 3.9+ is needed for Settings backup and restore."

info "Installing dependencies from package-lock.json..."
# Build tools are needed even when the service environment sets
# NODE_ENV=production; they are pruned only after the build succeeds.
npm ci --include=dev --no-audit --no-fund

info "Type-checking..."
# --force re-emits everything, in case an interrupted cleanup removed dist but
# left TypeScript's incremental metadata behind.
npm run typecheck --silent -- --force

info "Building the website and API..."
npm run build --silent

info "Removing development packages..."
npm prune --omit=dev --no-audit --no-fund

echo ""
echo "MoneyInMotion is installed. Start it with systemd (docs/deployment.md)"
echo "or in the foreground with ./run.sh, which prints the URL to open."
