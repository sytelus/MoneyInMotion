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

if ! command -v python3 >/dev/null 2>&1; then
    warn "Python 3.9+ is needed for Settings backup/restore. Install python3 before using those controls."
fi

install_mode="${1:---production}"
case "$install_mode" in
    --production|--development) ;;
    *) fail "usage: ./install.sh [--production|--development]" ;;
esac

info "Installing the exact dependency graph from package-lock.json..."
# Build tools are required even when the service environment sets NODE_ENV to
# production. Prune them only after compilation has succeeded.
npm ci --include=dev --no-audit --no-fund
ok "Dependencies installed."

info "Type-checking the monorepo..."
# Force emission as well as checking: an interrupted cleanup may have removed
# dist while leaving TypeScript's incremental metadata behind.
npm run typecheck --silent -- --force
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
echo "  Production:  ./run.sh                 (URL and configured port print at startup)"
if [ "$install_mode" = "--development" ]; then
    echo "  Development: ./run.sh dev             (http://localhost:5173)"
    echo "  Tests:       npm test"
else
    echo "  Development: ./install.sh --development"
fi
echo "  Config:      ~/.moneyinmotion/config.json"
echo "  Data root:   ~/mim_root/<username>     (configurable in Settings)"
echo ""
echo "Remote browser users only need the production URL; no local software is required."
