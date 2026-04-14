#!/usr/bin/env bash
# ============================================================================
# MoneyInMotion — Run Script
#
# Usage:
#   ./run.sh         Start development mode (Vite + API server)
#   ./run.sh prod    Start the production server (requires ./build.sh first)
# ============================================================================

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "$0")/scripts/lib.sh"

ensure_project_root
ensure_deps_installed

MODE="${1:-dev}"

case "$MODE" in
    dev)
        ensure_core_built

        info "Starting development mode..."
        echo -e "  ${C_BOLD}Open this URL in your browser:${C_NC}  http://localhost:5173"
        echo -e "  ${C_NC}(API server runs on :3001 and is called via the web UI — don't open it directly)"
        echo ""

        exec npm run dev --silent
        ;;

    prod)
        if [ ! -f packages/core/dist/index.js ] \
            || [ ! -f packages/server/dist/index.js ] \
            || [ ! -f packages/web/dist/index.html ]; then
            fail "production build artifacts are missing. Run ./build.sh first."
        fi

        export NODE_ENV=production

        info "Starting production server..."
        echo -e "  ${C_BOLD}Open this URL in your browser:${C_NC}  http://localhost:${MONEYAI_PORT:-3001}"
        echo ""

        exec npm run start -w packages/server --silent
        ;;

    *)
        fail "usage: ./run.sh [prod]"
        ;;
esac
