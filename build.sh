#!/usr/bin/env bash
# ============================================================================
# MoneyInMotion — Production build
#
# Usage:
#   ./build.sh        Build all packages for production
#   ./build.sh test   Build and run tests
# ============================================================================

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "$0")/scripts/lib.sh"

ensure_project_root
ensure_node_version
ensure_deps_installed
ensure_development_deps_installed

case "${1:-}" in
    ""|test) ;;
    *) fail "usage: ./build.sh [test]" ;;
esac

# Force a clean rebuild by clearing all incremental build state. Composite
# tsc won't re-emit when its buildinfo says everything is current, even if
# the dist/ directory is gone.
find packages -maxdepth 2 -name 'tsconfig.tsbuildinfo' -delete 2>/dev/null

info "Type-checking all packages..."
npm run typecheck --silent
ok "Type check passed."

info "Linting all packages..."
npm run lint --silent
ok "Lint passed."

info "Building core, API server, and website..."
npm run build --silent
ok "Production artifacts built."

echo ""

if [ "${1:-}" = "test" ]; then
    info "Running tests..."
    npm test --silent
    echo ""
fi

echo -e "${C_BOLD}============================================================${C_NC}"
echo -e "${C_BOLD}  Build complete!${C_NC}"
echo -e "${C_BOLD}============================================================${C_NC}"
echo ""
echo -e "  ${C_BOLD}Start in production mode:${C_NC}  ./run.sh prod"
echo -e "  ${C_BOLD}Start in development mode:${C_NC} ./run.sh"
echo ""
