# ============================================================================
# Shared helpers for MoneyInMotion scripts.
#
# This file is meant to be SOURCED (not executed) by ./install.sh and ./build.sh.
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
        npm ci --include=dev --no-audit --no-fund
        echo ""
    fi
}

# -- Guard: commands that compile/test need development dependencies ----------
ensure_development_deps_installed() {
    if [ ! -x node_modules/.bin/tsc ] || [ ! -x node_modules/.bin/vite ]; then
        fail "development dependencies are not installed. Run ./install.sh --development."
    fi
}
