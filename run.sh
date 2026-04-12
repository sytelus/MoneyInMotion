#!/usr/bin/env bash
# ============================================================================
# MoneyInMotion — Start the application
#
# Usage:
#   ./run.sh          Start in development mode (hot reload)
#   ./run.sh prod     Start in production mode (requires build first)
# ============================================================================

set -euo pipefail

# Colours
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    GREEN='' YELLOW='' BLUE='' BOLD='' NC=''
fi

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }

# Check we're in the right directory
if [ ! -f "package.json" ] || ! grep -q '"moneyinmotion"' package.json 2>/dev/null; then
    echo "Error: run this script from the MoneyInMotion project root." >&2
    exit 1
fi

# Check dependencies are installed
if [ ! -d "node_modules" ]; then
    warn "Dependencies not installed. Running install..."
    npm install --no-audit --no-fund
    echo ""
fi

MODE="${1:-dev}"

if [ "$MODE" = "prod" ] || [ "$MODE" = "production" ]; then
    # -- Production mode --
    if [ ! -d "packages/web/dist" ] || [ ! -d "packages/server/dist" ]; then
        warn "Production build not found. Run ./build.sh first."
        exit 1
    fi

    info "Starting MoneyInMotion in production mode..."
    echo ""
    echo -e "  ${BOLD}Open in your browser:${NC}  ${GREEN}http://localhost:${MONEYAI_PORT:-3001}${NC}"
    echo ""

    cd packages/server
    NODE_ENV=production node dist/index.js
else
    # -- Development mode --
    info "Starting MoneyInMotion in development mode..."
    echo ""
    echo -e "  ${BOLD}Open in your browser:${NC}  ${GREEN}http://localhost:5173${NC}"
    echo -e "  ${BOLD}API server:${NC}            http://localhost:${MONEYAI_PORT:-3001}"
    echo -e "  ${BOLD}First time?${NC}            The app will guide you through setup."
    echo ""
    echo -e "  Press ${BOLD}Ctrl+C${NC} to stop."
    echo ""

    npm run dev
fi
