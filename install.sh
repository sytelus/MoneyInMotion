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
#   1. Checks that required tools (git, node, npm) are installed
#   2. Verifies Node.js version is 18+
#   3. Clones the repo (first install) or pulls latest changes (update)
#   4. Installs / updates npm dependencies
#   5. Prints instructions on how to start the application
# ============================================================================

set -euo pipefail

# -- Colours (suppressed when not a terminal) --------------------------------
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' BOLD='' NC=''
fi

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail()  { echo -e "${RED}[error]${NC} $*"; exit 1; }

# -- 1. Check required tools -------------------------------------------------
info "Checking required tools..."

command -v git >/dev/null 2>&1 || fail "git is not installed. Install it from https://git-scm.com/"
ok "git found: $(git --version | head -1)"

command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node.js 18+ from https://nodejs.org/"

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
    fail "Node.js $NODE_MAJOR detected but version 18+ is required. Upgrade from https://nodejs.org/"
fi
ok "Node.js found: $(node --version)"

command -v npm >/dev/null 2>&1 || fail "npm is not installed. It ships with Node.js — reinstall Node from https://nodejs.org/"
ok "npm found: $(npm --version)"

echo ""

# -- 2. Clone or update the repository ---------------------------------------
REPO_URL="https://github.com/sytelus/MoneyInMotion.git"
INSTALL_DIR="MoneyInMotion"

# Detect if we're already inside the repo
if [ -f "package.json" ] && grep -q '"moneyinmotion"' package.json 2>/dev/null; then
    PROJECT_DIR="$(pwd)"
    info "Already inside the MoneyInMotion project at ${PROJECT_DIR}"

    # Pull latest if this is a git repo
    if [ -d ".git" ]; then
        info "Pulling latest changes..."
        git pull --ff-only 2>/dev/null && ok "Updated to latest version." || warn "Could not auto-update (you may have local changes). Continuing with current version."
    fi
elif [ -d "$INSTALL_DIR" ]; then
    PROJECT_DIR="$(cd "$INSTALL_DIR" && pwd)"
    info "Found existing installation at ${PROJECT_DIR}"
    cd "$INSTALL_DIR"

    if [ -d ".git" ]; then
        info "Pulling latest changes..."
        git pull --ff-only 2>/dev/null && ok "Updated to latest version." || warn "Could not auto-update. Continuing with current version."
    fi
else
    info "Cloning MoneyInMotion..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    PROJECT_DIR="$(cd "$INSTALL_DIR" && pwd)"
    cd "$INSTALL_DIR"
    ok "Cloned to ${PROJECT_DIR}"
fi

echo ""

# -- 3. Install dependencies -------------------------------------------------
info "Installing dependencies (this may take a minute on first run)..."
npm install --no-audit --no-fund 2>&1 | tail -3
ok "All dependencies installed."

echo ""

# -- 4. Build @moneyinmotion/core ---------------------------------------------
# The server imports the core package at runtime via node's module resolution,
# which reads dist/index.js from the core package's `main` field. Building it
# here ensures that the server can start immediately after install, even
# before the user runs ./build.sh.
info "Building @moneyinmotion/core..."
npm run build:core --silent
ok "core built."

echo ""

# -- 5. Verify installation ---------------------------------------------------
info "Verifying installation..."

# Quick sanity check — can we import the core package?
node -e "
  try {
    require('typescript');
    process.stdout.write('TypeScript OK');
  } catch(e) {
    process.stdout.write('WARN: TypeScript not found');
  }
" 2>/dev/null && echo "" || echo ""

# Count packages
PACKAGE_COUNT=$(ls -d packages/*/ 2>/dev/null | wc -l | tr -d ' ')
ok "Found ${PACKAGE_COUNT} workspace packages (core, server, web)."

echo ""

# -- 5. Print usage instructions ----------------------------------------------
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  MoneyInMotion installed successfully!${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
echo -e "  ${BOLD}To start the application:${NC}"
echo ""
echo -e "    cd ${PROJECT_DIR}"
echo -e "    npm run dev"
echo ""
echo -e "  Then open ${BOLD}http://localhost:5173${NC} in your browser."
echo ""
echo -e "  ${BOLD}First time?${NC} The app will guide you through setup:"
echo -e "    1. Choose where to store your financial data"
echo -e "    2. Add your bank/credit card accounts"
echo -e "    3. Drop CSV statement files into the account folders"
echo -e "    4. Click Import — you're done!"
echo ""
echo -e "  ${BOLD}Updating later:${NC}"
echo -e "    cd ${PROJECT_DIR}"
echo -e "    ./install.sh"
echo ""
echo -e "  ${BOLD}Other commands:${NC}"
echo -e "    npm test          Run all tests"
echo -e "    npm run build     Production build"
echo ""
echo -e "  ${BOLD}Documentation:${NC}  docs/ folder or README.md"
echo -e "  ${BOLD}Issues:${NC}         https://github.com/sytelus/MoneyInMotion/issues"
echo ""
