#!/usr/bin/env bash
# =============================================================================
#  Mawthook — aaPanel VPS Setup Script
#
#  This script handles the APP-LEVEL setup only.
#  aaPanel manages: Node.js, MySQL, Nginx, SSL, Firewall, PM2.
#
#  BEFORE running this script, complete these steps in aaPanel:
#  ─────────────────────────────────────────────────────────────
#  [1] App Store → install "Node.js" (select v20 LTS)
#  [2] Database → MySQL → Add Database
#        Database name:  mawthook
#        Username:       mawthook
#        Password:       (save it — you'll enter it below)
#  [3] Website → Add Site → enter your domain (skip SSL for now)
#  [4] DNS: point your domain A record → server IP
#  ─────────────────────────────────────────────────────────────
#
#  AFTER this script finishes, complete these steps in aaPanel:
#  ─────────────────────────────────────────────────────────────
#  [A] Website → your site → Node.js
#        - Set "Run directory" to this folder
#        - Startup file:  node_modules/.bin/next
#        - Startup args:  start
#        - Port:          3000
#        - Click "Start"
#  [B] Website → your site → Reverse Proxy
#        - Target URL:  http://127.0.0.1:3000
#  [C] Website → your site → SSL → Free Certificate → Apply
#  ─────────────────────────────────────────────────────────────
#
#  Usage:
#    bash onboard.sh
# =============================================================================

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

ok()    { echo -e "  ${GREEN}✓${RESET}  $*"; }
info()  { echo -e "  ${CYAN}→${RESET}  $*"; }
warn()  { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
fail()  { echo -e "\n  ${RED}✗  $*${RESET}\n"; exit 1; }
hr()    { echo -e "${DIM}$(printf '─%.0s' {1..56})${RESET}"; }
step()  { echo -e "\n${BOLD}  [${1}]  ${2}${RESET}"; hr; }
box()   { echo -e "${BOLD}$*${RESET}"; }

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Prompt helpers ────────────────────────────────────────────────────────────
prompt()      { read -rp "      $1: " __v;                   echo "$__v"; }
prompt_def()  { read -rp "      $1 [${2}]: " __v;            echo "${__v:-$2}"; }
prompt_opt()  { read -rp "      $1 (optional, Enter to skip): " __v; echo "$__v"; }
prompt_pass() { read -rsp "      $1: " __v; echo;            echo "$__v"; }
gen_secret()  { openssl rand -hex 32; }
gen_pass()    { openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20; }

# ── Resolve Node.js installed by aaPanel (not always in system PATH) ──────────
resolve_node_path() {
  command -v node &>/dev/null && return 0   # already in PATH

  # aaPanel installs Node.js via its own nvm at /www/server/nvm
  local NVM_SH="/www/server/nvm/nvm.sh"
  if [[ -f "$NVM_SH" ]]; then
    export NVM_DIR="/www/server/nvm"
    # shellcheck disable=SC1090
    source "$NVM_SH" --no-use 2>/dev/null || true
    nvm use --lts 2>/dev/null || nvm use node 2>/dev/null || true
    command -v node &>/dev/null && return 0
  fi

  # Fallback: search common aaPanel Node.js binary locations
  local search_dirs=(
    /www/server/nvm/versions/node/v20*/bin
    /www/server/nvm/versions/node/v22*/bin
    /www/server/nvm/versions/node/v18*/bin
    /www/server/nodejs/v20*/bin
    /usr/local/bin
    /usr/bin
  )
  local p
  for p in "${search_dirs[@]}"; do
    # glob may not match — skip if no match
    [[ -x "${p}/node" ]] || continue
    export PATH="${p}:${PATH}"
    return 0
  done

  return 1   # not found
}

# ─────────────────────────────────────────────────────────────────────────────

banner() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}║         Mawthook — aaPanel Setup Script              ║${RESET}"
  echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  App directory: ${CYAN}${APP_DIR}${RESET}"
  echo ""
}

# =============================================================================
# STEP 1 — Check prerequisites aaPanel should have installed
# =============================================================================
check_prereqs() {
  step 1 "Checking prerequisites"

  # Node.js — try aaPanel's nvm path before giving up
  resolve_node_path
  if ! command -v node &>/dev/null; then
    fail "Node.js not found.\n     In aaPanel → App Store → search 'Node.js' → install v20 LTS.\n     Then re-run this script."
  fi
  NODE_VER=$(node --version)
  NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
  if [[ $NODE_MAJOR -lt 18 ]]; then
    fail "Node.js ${NODE_VER} is too old (need v18+).\n     In aaPanel → App Store → Node.js → switch to v20 LTS."
  fi
  ok "Node.js ${NODE_VER}"

  # npm
  if ! command -v npm &>/dev/null; then
    fail "npm not found. It should ship with Node.js. Re-install Node.js via aaPanel."
  fi
  ok "npm $(npm --version)"

  # mysql client (for connection test)
  if command -v mysql &>/dev/null; then
    ok "mysql client available"
  else
    warn "mysql CLI not in PATH — will skip connection test (not critical)"
  fi

  # openssl (for key generation)
  if ! command -v openssl &>/dev/null; then
    fail "openssl not found. Install it: apt install openssl"
  fi
  ok "openssl $(openssl version | awk '{print $2}')"

  ok "All prerequisites met"
}

# =============================================================================
# STEP 2 — Collect configuration
# =============================================================================
collect_config() {
  step 2 "Configuration"
  echo -e "  ${DIM}Enter your settings. Press Enter to accept [defaults].${RESET}\n"

  echo -e "  ${BOLD}── Domain & App ─────────────────────────────────────${RESET}"
  DOMAIN=$(prompt_def "Domain (e.g. webhook.yourdomain.com)" "localhost")

  if [[ "$DOMAIN" == "localhost" || "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    APP_URL="http://${DOMAIN}:3000"
  else
    APP_URL="https://${DOMAIN}"
  fi
  echo -e "      → App URL will be: ${CYAN}${APP_URL}${RESET}"
  echo ""

  echo -e "  ${BOLD}── MySQL (from aaPanel → Database) ──────────────────${RESET}"
  echo -e "  ${DIM}  Use the DB name / user / password you set in aaPanel.${RESET}"
  DB_HOST=$(prompt_def "MySQL host"      "127.0.0.1")
  DB_PORT=$(prompt_def "MySQL port"      "3306")
  DB_NAME=$(prompt_def "Database name"   "mawthook")
  DB_USER=$(prompt_def "Database user"   "mawthook")
  DB_PASS=$(prompt_pass "Database password")
  [[ -z "$DB_PASS" ]] && fail "Database password cannot be empty."
  echo ""

  echo -e "  ${BOLD}── Admin Account ────────────────────────────────────${RESET}"
  ADMIN_EMAIL=$(prompt_def "Admin email"    "admin@mawthook.com")
  ADMIN_PASS=$(prompt_pass  "Admin password")
  if [[ -z "$ADMIN_PASS" ]]; then
    ADMIN_PASS=$(gen_pass)
    warn "No password entered — auto-generated: ${BOLD}${ADMIN_PASS}${RESET}"
    warn "Save this now — it won't be shown again!"
  fi
  echo ""

  echo -e "  ${BOLD}── Chatwoot (optional — Enter to skip) ──────────────${RESET}"
  CW_BASE=$(prompt_opt    "Chatwoot Base URL")
  CW_TOKEN=$(prompt_opt   "Chatwoot API Token")
  CW_ACCOUNT=$(prompt_opt "Chatwoot Account ID")
  CW_SECRET=$(gen_secret | head -c 32)
  echo ""
}

# =============================================================================
# STEP 3 — Test MySQL connection
# =============================================================================
test_mysql() {
  step 3 "Testing MySQL connection"

  if ! command -v mysql &>/dev/null; then
    warn "mysql CLI not available — skipping connection test."
    warn "If the migration step fails, check your DB credentials."
    return
  fi

  if mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASS}" \
       -e "USE \`${DB_NAME}\`;" &>/dev/null 2>&1; then
    ok "Connected to MySQL — database '${DB_NAME}' accessible"
  else
    echo ""
    warn "Could not connect to MySQL with these credentials."
    warn "Check in aaPanel → Database that:"
    warn "  • Database '${DB_NAME}' exists"
    warn "  • User '${DB_USER}' has full access to '${DB_NAME}'"
    warn "  • Password is correct"
    echo ""
    read -rp "      Continue anyway? [y/N]: " CONT
    [[ "${CONT,,}" == "y" ]] || exit 1
  fi
}

# =============================================================================
# STEP 4 — Write .env
# =============================================================================
write_env() {
  step 4 "Writing .env"

  ENCRYPTION_KEY=$(gen_secret)
  JWT_SECRET=$(gen_secret)

  cat > "${APP_DIR}/.env" <<EOF
# Generated by onboard.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── Database ──────────────────────────────────────────────
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# ── Security (AES-256-GCM + JWT) ──────────────────────────
ENCRYPTION_KEY="${ENCRYPTION_KEY}"
JWT_SECRET="${JWT_SECRET}"

# ── App ───────────────────────────────────────────────────
APP_URL="${APP_URL}"

# ── Chatwoot (optional) ───────────────────────────────────
CHATWOOT_WEBHOOK_SECRET="${CW_SECRET}"
CHATWOOT_BASE_URL="${CW_BASE}"
CHATWOOT_API_TOKEN="${CW_TOKEN}"
CHATWOOT_ACCOUNT_ID="${CW_ACCOUNT}"
EOF

  chmod 600 "${APP_DIR}/.env"
  ok ".env written  (chmod 600 — readable by owner only)"
  ok "ENCRYPTION_KEY auto-generated (32 bytes)"
  ok "JWT_SECRET     auto-generated (32 bytes)"
}

# =============================================================================
# STEP 5 — npm install
# =============================================================================
install_deps() {
  step 5 "Installing Node.js dependencies"
  cd "${APP_DIR}"

  # Must use plain `npm install` (not --omit=dev) so prisma CLI
  # in devDependencies is available for generate + migrate steps.
  npm install
  ok "Dependencies installed"
}

# =============================================================================
# STEP 6 — Prisma: generate + migrate
# =============================================================================
run_prisma() {
  step 6 "Database setup (Prisma)"

  cd "${APP_DIR}"
  info "Generating Prisma client..."
  npx prisma generate
  ok "Prisma client generated"

  info "Running migrations..."
  npx prisma migrate deploy
  ok "Migrations applied — all tables created"
}

# =============================================================================
# STEP 7 — Seed admin user
# =============================================================================
seed_admin() {
  step 7 "Creating admin user"
  cd "${APP_DIR}"
  ADMIN_EMAIL="${ADMIN_EMAIL}" ADMIN_PASSWORD="${ADMIN_PASS}" node prisma/seed.mjs
  ok "Admin user ready: ${ADMIN_EMAIL}"
}

# =============================================================================
# STEP 8 — Build Next.js
# =============================================================================
build_app() {
  step 8 "Building Next.js app  (this may take 1-2 minutes)"
  cd "${APP_DIR}"
  npm run build
  ok "Build complete (.next/)"
}

# =============================================================================
# STEP 9 — Save credentials summary to file
# =============================================================================
save_summary() {
  SUMMARY_FILE="${APP_DIR}/SETUP_SUMMARY.txt"
  cat > "$SUMMARY_FILE" <<EOF
Mawthook Setup Summary — $(date -u +"%Y-%m-%d %H:%M UTC")
══════════════════════════════════════════════════════

APP
  URL:            ${APP_URL}
  Dashboard:      ${APP_URL}/dashboard
  Admin email:    ${ADMIN_EMAIL}
  Admin password: ${ADMIN_PASS}

DATABASE
  Host:     ${DB_HOST}:${DB_PORT}
  Database: ${DB_NAME}
  User:     ${DB_USER}
  Password: ${DB_PASS}

KEYS (also in .env)
  ENCRYPTION_KEY: ${ENCRYPTION_KEY}
  JWT_SECRET:     ${JWT_SECRET}

NEXT STEPS IN AAPANEL (see below)
EOF
  chmod 600 "$SUMMARY_FILE"
  ok "Credentials saved to SETUP_SUMMARY.txt  (chmod 600)"
}

# =============================================================================
# STEP 10 — aaPanel next-steps guide
# =============================================================================
print_aapanel_steps() {
  echo ""
  echo -e "${BOLD}$(printf '═%.0s' {1..56})${RESET}"
  echo -e "${BOLD}  App is built. Now finish setup in aaPanel UI:${RESET}"
  echo -e "${BOLD}$(printf '═%.0s' {1..56})${RESET}"
  echo ""

  echo -e "${BOLD}  ┌─ A  Node.js Project ────────────────────────────┐${RESET}"
  echo -e "  │  Website → ${CYAN}${DOMAIN}${RESET} → Node.js             │"
  echo -e "  │                                                 │"
  echo -e "  │  Run directory:  ${CYAN}${APP_DIR}${RESET}"
  echo -e "  │  Startup file:   ${CYAN}node_modules/.bin/next${RESET}     │"
  echo -e "  │  Startup args:   ${CYAN}start${RESET}                      │"
  echo -e "  │  Port:           ${CYAN}3000${RESET}                        │"
  echo -e "  │                                                 │"
  echo -e "  │  → Click  [ Start ]                            │"
  echo -e "  └─────────────────────────────────────────────────┘"
  echo ""

  echo -e "${BOLD}  ┌─ B  Reverse Proxy ─────────────────────────────┐${RESET}"
  echo -e "  │  Website → ${CYAN}${DOMAIN}${RESET} → Reverse Proxy       │"
  echo -e "  │                                                 │"
  echo -e "  │  Proxy name:   mawthook                         │"
  echo -e "  │  Target URL:   ${CYAN}http://127.0.0.1:3000${RESET}        │"
  echo -e "  │                                                 │"
  echo -e "  │  → Click  [ Add ]                              │"
  echo -e "  └─────────────────────────────────────────────────┘"
  echo ""

  echo -e "${BOLD}  ┌─ C  SSL Certificate ───────────────────────────┐${RESET}"
  echo -e "  │  Website → ${CYAN}${DOMAIN}${RESET} → SSL              │"
  echo -e "  │  Let's Encrypt tab → Apply                       │"
  echo -e "  │                                                 │"
  echo -e "  │  ${DIM}(Requires domain DNS to point to this server)${RESET}  │"
  echo -e "  └─────────────────────────────────────────────────┘"
  echo ""

  echo -e "${BOLD}  ┌─ D  Firewall (Security menu) ──────────────────┐${RESET}"
  echo -e "  │  Ensure these ports are open:                   │"
  echo -e "  │    ${CYAN}22${RESET}   SSH                                  │"
  echo -e "  │    ${CYAN}80${RESET}   HTTP                                 │"
  echo -e "  │    ${CYAN}443${RESET}  HTTPS                                │"
  echo -e "  │    ${CYAN}888${RESET}  aaPanel (or your aaPanel port)       │"
  echo -e "  │  Do NOT expose port 3000 publicly.              │"
  echo -e "  └─────────────────────────────────────────────────┘"
  echo ""

  echo -e "${BOLD}  ┌─ Useful PM2 commands ───────────────────────────┐${RESET}"
  echo -e "  │  pm2 list               — all processes          │"
  echo -e "  │  pm2 logs mawthook      — tail app logs          │"
  echo -e "  │  pm2 restart mawthook   — restart after changes  │"
  echo -e "  └─────────────────────────────────────────────────┘"
  echo ""

  echo -e "  ${BOLD}Dashboard:${RESET}  ${CYAN}${APP_URL}/dashboard${RESET}"
  echo -e "  ${BOLD}Login:${RESET}      ${ADMIN_EMAIL}"
  echo ""
  echo -e "  ${YELLOW}⚠  Change the admin password after first login!${RESET}"
  echo -e "  ${YELLOW}⚠  Keep .env and SETUP_SUMMARY.txt private.${RESET}"
  echo ""
}

# =============================================================================
# Main
# =============================================================================
main() {
  banner
  check_prereqs
  collect_config
  test_mysql
  write_env
  install_deps
  run_prisma
  seed_admin
  build_app
  save_summary
  print_aapanel_steps
}

main
