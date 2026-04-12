# ============================================================================
# Shared helpers for MoneyInMotion scripts.
#
# This file is meant to be SOURCED (not executed) by ./run.sh and ./build.sh.
# It assumes the caller has already enabled `set -euo pipefail` and is being
# run from the project root.
#
# Usage:
#   source "$(dirname "$0")/scripts/lib.sh"
# ============================================================================

# -- Colour definitions (suppressed when stdout is not a terminal) -----------
if [ -t 1 ]; then
    C_RED='\033[0;31m'
    C_GREEN='\033[0;32m'
    C_YELLOW='\033[1;33m'
    C_BLUE='\033[0;34m'
    C_BOLD='\033[1m'
    C_NC='\033[0m'
else
    C_RED='' C_GREEN='' C_YELLOW='' C_BLUE='' C_BOLD='' C_NC=''
fi

# -- Log helpers -------------------------------------------------------------
info()  { echo -e "${C_BLUE}[info]${C_NC}  $*"; }
ok()    { echo -e "${C_GREEN}[ok]${C_NC}    $*"; }
warn()  { echo -e "${C_YELLOW}[warn]${C_NC}  $*"; }
fail()  { echo -e "${C_RED}[error]${C_NC} $*" >&2; exit 1; }

# -- Guard: must be run from the MoneyInMotion project root ------------------
ensure_project_root() {
    if [ ! -f package.json ] || ! grep -q '"moneyinmotion"' package.json 2>/dev/null; then
        fail "run this script from the MoneyInMotion project root."
    fi
}

# -- Guard: install npm dependencies if missing ------------------------------
ensure_deps_installed() {
    if [ ! -d node_modules ]; then
        info "Dependencies not installed. Running npm install..."
        npm install --no-audit --no-fund
        echo ""
    fi
}

# -- Build @moneyinmotion/core if its dist is missing or out of date ---------
#
# The server imports `@moneyinmotion/core` via Node's module resolver, which
# reads `packages/core/dist/index.js` from the package's `main` field. The
# web package uses a Vite alias to read source directly, but the server has
# no such workaround and fails to start if dist is missing.
#
# With `composite: true` on the core tsconfig, `tsc` is incremental and
# consults `tsconfig.tsbuildinfo` to decide what to emit. If dist is deleted
# but tsbuildinfo remains, tsc will think nothing changed and skip emit
# entirely. We clear tsbuildinfo whenever dist is missing to force a full
# rebuild.
ensure_core_built() {
    local core_index=packages/core/dist/index.js
    local core_buildinfo=packages/core/tsconfig.tsbuildinfo

    if [ -f "$core_index" ]; then
        # Dist exists — rebuild only if any source file is newer than it.
        if [ -z "$(find packages/core/src -name '*.ts' -newer "$core_index" 2>/dev/null | head -1)" ]; then
            return 0
        fi
    else
        # Dist missing — nuke any stale buildinfo so tsc emits from scratch.
        rm -f "$core_buildinfo"
    fi

    info "Building @moneyinmotion/core..."
    npm run build:core --silent
    ok "core built."
    echo ""
}
