#!/usr/bin/env bash
# Install a reproducible MoneyInMotion checkout.
#
# Usage:
#   ./install.sh                 Production VM install (default)
#   ./install.sh --development   Keep compilers and test tools for development
#
# Browser users install nothing.

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "$0")/scripts/lib.sh"

ensure_project_root
ensure_node_version

install_mode="${1:---production}"
case "$install_mode" in
    --production|--development) ;;
    *) fail "usage: ./install.sh [--production|--development]" ;;
esac

info "Installing the exact dependency graph from package-lock.json..."
npm ci --no-audit --no-fund
ok "Dependencies installed."

info "Type-checking the monorepo..."
npm run typecheck --silent
ok "Type check passed."

info "Building the production website and API..."
npm run build --silent
ok "Production build complete."

if [ "$install_mode" = "--production" ]; then
    info "Removing build and test dependencies from the VM runtime..."
    npm prune --omit=dev --no-audit --no-fund
    ok "Production dependencies ready."
fi

echo ""
echo -e "${C_BOLD}MoneyInMotion server installation is ready.${C_NC}"
echo ""
echo "  Production:  ./run.sh prod            (http://localhost:3001)"
if [ "$install_mode" = "--development" ]; then
    echo "  Development: ./run.sh                 (http://localhost:5173)"
    echo "  Tests:       npm test"
else
    echo "  Development: ./install.sh --development"
fi
echo "  Data root:   ~/min_root/<username>     (configurable in Settings)"
echo ""
echo "Remote browser users only need the production URL; no local software is required."
