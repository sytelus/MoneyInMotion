#!/usr/bin/env bash
# ============================================================================
# MoneyInMotion — Production build
#
# Usage:
#   ./build.sh        Build all packages for production
#   ./build.sh test   Build and run tests
# ============================================================================

set -euo pipefail

# Colours
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' BLUE='' BOLD='' NC=''
fi

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
fail()  { echo -e "${RED}[error]${NC} $*"; exit 1; }

# Check we're in the right directory
if [ ! -f "package.json" ] || ! grep -q '"moneyinmotion"' package.json 2>/dev/null; then
    echo "Error: run this script from the MoneyInMotion project root." >&2
    exit 1
fi

# Check dependencies
if [ ! -d "node_modules" ]; then
    info "Dependencies not installed. Running install..."
    npm install --no-audit --no-fund
    echo ""
fi

# -- Build --
info "Building @moneyinmotion/core..."
npm run build:core 2>&1 | tail -1
ok "core built."

info "Building @moneyinmotion/server..."
npm run build:server 2>&1 | tail -1
ok "server built."

info "Building @moneyinmotion/web..."
npm run build:web 2>&1 | tail -3
ok "web built."

echo ""

# -- Optional: run tests --
if [ "${1:-}" = "test" ]; then
    info "Running tests..."
    npm test 2>&1 | tail -5
    echo ""
fi

# -- Summary --
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  Build complete!${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
echo -e "  ${BOLD}To start in production mode:${NC}"
echo ""
echo -e "    ./run.sh prod"
echo ""
echo -e "  ${BOLD}To start in development mode:${NC}"
echo ""
echo -e "    ./run.sh"
echo ""
