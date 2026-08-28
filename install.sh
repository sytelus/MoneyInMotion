#!/usr/bin/env bash
# Install a reproducible MoneyInMotion server checkout.
# Run this after cloning the repository; browser users install nothing.

set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "$0")/scripts/lib.sh"

ensure_project_root
ensure_node_version

info "Installing the exact dependency graph from package-lock.json..."
npm ci --no-audit --no-fund
ok "Dependencies installed."

info "Type-checking the monorepo..."
npm run typecheck --silent
ok "Type check passed."

info "Building the production website and API..."
npm run build --silent
ok "Production build complete."

echo ""
echo -e "${C_BOLD}MoneyInMotion server installation is ready.${C_NC}"
echo ""
echo "  Development: ./run.sh                 (http://localhost:5173)"
echo "  Production:  ./run.sh prod            (http://localhost:3001)"
echo "  Tests:       npm test"
echo "  Data root:   ~/min_root/<username>     (configurable in Settings)"
echo ""
echo "Remote browser users only need the production URL; no local software is required."
