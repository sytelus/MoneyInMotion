#!/usr/bin/env bash
# ============================================================================
# MoneyInMotion — Run Script
#
# Usage:
#   ./run.sh         Start the production server (default; builds if needed)
#   ./run.sh dev     Start development mode (Vite + API server)
# ============================================================================

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "$0")/scripts/lib.sh"

ensure_project_root
ensure_node_version
ensure_deps_installed

MODE="${1:-prod}"

case "$MODE" in
    dev)
        ensure_development_deps_installed
        ensure_core_built

        info "Starting development mode..."
        echo -e "  ${C_BOLD}Open this URL in your browser:${C_NC}  http://localhost:5173"
        echo -e "  ${C_NC}(API server runs on :3001 and is called via the web UI — don't open it directly)"
        echo ""

        exec npm run dev --silent
        ;;

    prod)
        ensure_production_built

        export NODE_ENV=production

        info "Starting production server..."
        echo -e "  ${C_BOLD}Open the URL printed by the server (configured in ~/.moneyinmotion/config.json).${C_NC}"
        echo ""

        exec node packages/server/dist/index.js
        ;;

    *)
        fail "usage: ./run.sh [prod|dev]"
        ;;
esac
