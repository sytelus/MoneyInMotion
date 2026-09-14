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

# -- Guard: supported Node runtime -------------------------------------------
ensure_node_version() {
    command -v node >/dev/null 2>&1 || fail "Node.js 24+ is required."
    command -v npm >/dev/null 2>&1 || fail "npm is required."

    local node_version node_major
    node_version="$(node --version)"
    node_major="${node_version#v}"
    node_major="${node_major%%.*}"
    if [ "$node_major" -lt 24 ]; then
        fail "Node.js ${node_version} detected; Node.js 24+ is required."
    fi
}

# -- Guard: install npm dependencies if missing ------------------------------
ensure_deps_installed() {
    if [ ! -d node_modules ]; then
        info "Dependencies not installed. Running npm ci..."
        npm ci --no-audit --no-fund
        echo ""
    fi
}

# -- Guard: commands that compile/test need development dependencies ----------
ensure_development_deps_installed() {
    if [ ! -x node_modules/.bin/tsc ] || [ ! -x node_modules/.bin/vite ]; then
        fail "development dependencies are not installed. Run ./install.sh --development."
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

# -- Ensure the complete production build exists and reflects source inputs --
ensure_production_built() {
    local build_marker=packages/web/dist/index.html
    local artifacts_missing=false
    local build_stale=false

    if [ ! -f packages/core/dist/index.js ] \
        || [ ! -f packages/server/dist/index.js ] \
        || [ ! -f "$build_marker" ]; then
        artifacts_missing=true
    elif [ -n "$(find \
        package.json package-lock.json tsconfig.json \
        packages/core/package.json packages/core/tsconfig.json packages/core/src \
        packages/server/package.json packages/server/tsconfig.json packages/server/src \
        packages/web/package.json packages/web/tsconfig.json packages/web/vite.config.ts packages/web/src \
        -type f -newer "$build_marker" 2>/dev/null | head -1)" ]; then
        build_stale=true
    fi

    if [ "$artifacts_missing" = false ] && [ "$build_stale" = false ]; then
        return 0
    fi

    if [ -x node_modules/.bin/tsc ] && [ -x node_modules/.bin/vite ]; then
        if [ "$artifacts_missing" = true ]; then
            info "Production build is missing; building it now..."
        else
            info "Production source is newer than the build; rebuilding now..."
        fi
        ./build.sh
        return 0
    fi

    if [ "$artifacts_missing" = true ]; then
        fail "production build artifacts are missing and build tools are not installed. Run ./install.sh."
    fi

    warn "Production source is newer than the installed build, but build tools were pruned."
    warn "Run ./install.sh before relying on this instance; starting the existing build now."
}
