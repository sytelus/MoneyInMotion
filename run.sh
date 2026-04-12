#!/usr/bin/env bash
# ============================================================================
# MoneyInMotion — Start the application
#
# Usage:
#   ./run.sh          Start in development mode (hot reload, port 5173)
#   ./run.sh prod     Start in production mode (requires ./build.sh first)
# ============================================================================

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "$0")/scripts/lib.sh"

ensure_project_root
ensure_deps_installed
ensure_core_built

MODE="${1:-dev}"

case "$MODE" in
    prod|production)
        if [ ! -d packages/web/dist ] || [ ! -d packages/server/dist ]; then
            fail "production build not found. Run ./build.sh first."
        fi

        info "Starting MoneyInMotion in production mode..."
        echo ""
        echo -e "  ${C_BOLD}Open in your browser:${C_NC}  ${C_GREEN}http://localhost:${MONEYAI_PORT:-3001}${C_NC}"
        echo ""
        echo -e "  Press ${C_BOLD}Ctrl+C${C_NC} to stop."
        echo ""

        cd packages/server
        NODE_ENV=production node dist/index.js
        ;;
    dev|development)
        info "Starting MoneyInMotion in development mode..."
        echo ""
        echo -e "  ${C_BOLD}Open in your browser:${C_NC}  ${C_GREEN}http://localhost:5173${C_NC}"
        echo -e "  ${C_BOLD}API server:${C_NC}            http://localhost:${MONEYAI_PORT:-3001}"
        echo -e "  ${C_BOLD}First time?${C_NC}            The app will guide you through setup."
        echo ""
        echo -e "  Press ${C_BOLD}Ctrl+C${C_NC} to stop."
        echo ""

        npm run dev
        ;;
    *)
        fail "unknown mode '$MODE'. Use 'dev' (default) or 'prod'."
        ;;
esac
