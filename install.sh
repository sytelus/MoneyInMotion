#!/usr/bin/env bash
# ============================================================================
# MoneyInMotion — Install / Update Script
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/sytelus/MoneyInMotion/master/install.sh | bash
#   # or, from a cloned repo:
#   ./install.sh
#
# What this script does:
#   1. Verifies git, Node.js 18+, and npm are installed
#   2. Clones the repo (first install) or pulls latest (update)
#   3. Installs / updates npm dependencies
#   4. Builds @moneyinmotion/core so the app is runnable immediately
#   5. Prints instructions for starting the application
#
# This script is self-contained and does NOT source scripts/lib.sh because it
# may run before the repo is cloned (`curl | bash` case).
# ============================================================================

set -euo pipefail

# -- Colours (suppressed when stdout is not a terminal) ----------------------
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

info()  { echo -e "${C_BLUE}[info]${C_NC}  $*"; }
ok()    { echo -e "${C_GREEN}[ok]${C_NC}    $*"; }
warn()  { echo -e "${C_YELLOW}[warn]${C_NC}  $*"; }
fail()  { echo -e "${C_RED}[error]${C_NC} $*" >&2; exit 1; }

# -- 1. Check required tools -------------------------------------------------
info "Checking required tools..."

command -v git  >/dev/null 2>&1 || fail "git is not installed. Get it from https://git-scm.com/"
command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Get Node.js 18+ from https://nodejs.org/"
command -v npm  >/dev/null 2>&1 || fail "npm is not installed. Reinstall Node from https://nodejs.org/"

NODE_VERSION="$(node --version)"    # e.g. "v20.11.0"
NODE_MAJOR="${NODE_VERSION#v}"      # strip leading "v" -> "20.11.0"
NODE_MAJOR="${NODE_MAJOR%%.*}"      # take everything before first "." -> "20"
if [ "$NODE_MAJOR" -lt 18 ]; then
    fail "Node.js $NODE_VERSION detected but version 18+ is required. Upgrade from https://nodejs.org/"
fi

ok "git $(git --version | awk '{print $3}'), Node.js $NODE_VERSION, npm $(npm --version)"
echo ""

# -- 2. Clone or update the repository ---------------------------------------
REPO_URL="https://github.com/sytelus/MoneyInMotion.git"
INSTALL_DIR="MoneyInMotion"

if [ -f package.json ] && grep -q '"moneyinmotion"' package.json 2>/dev/null; then
    # Already inside the repo
    PROJECT_DIR="$(pwd)"
    info "Already inside the MoneyInMotion project at ${PROJECT_DIR}"
elif [ -d "$INSTALL_DIR" ]; then
    PROJECT_DIR="$(cd "$INSTALL_DIR" && pwd)"
    info "Found existing installation at ${PROJECT_DIR}"
    cd "$INSTALL_DIR"
else
    info "Cloning MoneyInMotion..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    PROJECT_DIR="$(cd "$INSTALL_DIR" && pwd)"
    cd "$INSTALL_DIR"
    ok "Cloned to ${PROJECT_DIR}"
fi

if [ -d .git ]; then
    info "Pulling latest changes..."
    if git pull --ff-only 2>/dev/null; then
        ok "Up to date with origin/master."
    else
        warn "Could not fast-forward (you may have local changes). Continuing with current version."
    fi
fi

echo ""

# -- 3. Install dependencies -------------------------------------------------
info "Installing npm dependencies..."
npm install --no-audit --no-fund
ok "Dependencies installed."
echo ""

# -- 4. Build @moneyinmotion/core --------------------------------------------
# The server imports core via Node's module resolver, which reads dist/ from
# the package's `main` field. Building here ensures the app is runnable
# immediately after install. We clear any stale buildinfo first so composite
# tsc doesn't skip emit.
info "Building @moneyinmotion/core..."
rm -f packages/core/tsconfig.tsbuildinfo
npm run build:core --silent
ok "core built."
echo ""

# -- 5. Print usage instructions ---------------------------------------------
echo -e "${C_BOLD}============================================================${C_NC}"
echo -e "${C_BOLD}  MoneyInMotion installed successfully!${C_NC}"
echo -e "${C_BOLD}============================================================${C_NC}"
echo ""
echo -e "  ${C_BOLD}To start the application:${C_NC}"
echo ""
echo -e "    cd ${PROJECT_DIR}"
echo -e "    ./run.sh              ${C_BLUE}# dev mode — open http://localhost:5173${C_NC}"
echo ""
echo -e "  ${C_BOLD}Or for a leaner production run:${C_NC}"
echo ""
echo -e "    ./build.sh"
echo -e "    ./run.sh prod         ${C_BLUE}# prod mode — open http://localhost:3001${C_NC}"
echo ""
echo -e "  ${C_BOLD}First time?${C_NC} The in-app Getting Started guide walks you through setup:"
echo -e "    1. Choose where to store your financial data"
echo -e "    2. Add your bank/credit card accounts"
echo -e "    3. Drop CSV statement files into the account folders"
echo -e "    4. Click Import — you're done!"
echo ""
echo -e "  ${C_BOLD}Updating later:${C_NC}  ./install.sh"
echo -e "  ${C_BOLD}Run tests:${C_NC}       npm test"
echo -e "  ${C_BOLD}Documentation:${C_NC}   docs/ folder or README.md"
echo -e "  ${C_BOLD}Issues:${C_NC}          https://github.com/sytelus/MoneyInMotion/issues"
echo ""
