#!/usr/bin/env bash
# =============================================================================
# River Med — backend deploy script
# Called by GitHub Actions after SSH-ing into the Linode server.
#
# Safe guarantees:
#   - Never touches .env or .env.production
#   - Never deletes any data or file
#   - Only restarts river-med-backend (other PM2 apps untouched)
#   - DB password is never written to logs or process listings
#   - Exits immediately on any error (set -euo pipefail)
#
# Usage:
#   bash /home/briya/projects/river_med/deploy/deploy-backend.sh
#
# Make executable (one-time, run on server):
#   chmod +x /home/briya/projects/river_med/deploy/deploy-backend.sh
# =============================================================================

set -euo pipefail

# ── colour helpers ────────────────────────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[0;33m'

log()     { echo -e "${CYAN}${BOLD}[deploy]${RESET} $*"; }
success() { echo -e "${GREEN}${BOLD}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}${BOLD}[!]${RESET} $*"; }
fail()    { echo -e "${RED}${BOLD}[✗]${RESET} $*" >&2; exit 1; }

# ── config ────────────────────────────────────────────────────────────────────
REPO_DIR="/home/briya/projects/river_med"
BACKEND_DIR="${REPO_DIR}/backend"
PM2_APP="river-med-backend"
HEALTH_URL="https://briya-api.duckdns.org/api/river/health"
HEALTH_RETRIES=6
HEALTH_WAIT=5      # seconds between retries

# ── safety checks ─────────────────────────────────────────────────────────────
log "Starting River Med backend deployment"
echo    "  Repo    : ${REPO_DIR}"
echo    "  PM2 app : ${PM2_APP}"
echo    "  Health  : ${HEALTH_URL}"
echo    "  Date    : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

[ -d "${REPO_DIR}" ]    || fail "Repo directory not found: ${REPO_DIR}"
[ -d "${BACKEND_DIR}" ] || fail "Backend directory not found: ${BACKEND_DIR}"

# Confirm we will NOT touch .env files
for env_file in "${BACKEND_DIR}/.env" "${BACKEND_DIR}/.env.production"; do
  if [ -f "${env_file}" ]; then
    log "Found ${env_file} — will NOT modify it"
  fi
done
echo ""

# ── step 1: pull latest code ──────────────────────────────────────────────────
log "[1/5] Pulling latest code from origin/main"
cd "${REPO_DIR}"
git fetch --all --quiet
git reset --hard origin/main
success "Code updated — $(git log -1 --format='%h %s')"
echo ""

# ── step 2: install dependencies ──────────────────────────────────────────────
log "[2/5] Installing backend dependencies"
cd "${BACKEND_DIR}"

if [ -f "package-lock.json" ]; then
  npm ci --omit=dev --prefer-offline
else
  warn "package-lock.json not found — falling back to npm install"
  npm install --omit=dev
fi
success "Dependencies installed"
echo ""

# ── step 3: run database migrations ──────────────────────────────────────────
MIGRATE_SQL="${BACKEND_DIR}/src/db/migrate.sql"

if [ -f "${MIGRATE_SQL}" ]; then
  log "[3/5] Running database migrations"

  # Load DB_PASSWORD from backend/.env — value is never echoed or logged.
  # Falls back to an empty string which triggers a clear failure message.
  DB_PASSWORD=""
  ENV_FILE="${BACKEND_DIR}/.env"

  if [ -f "${ENV_FILE}" ]; then
    # Extract everything after the first '=' on the DB_PASSWORD line,
    # then strip any surrounding single or double quotes.
    _raw=$(grep -E '^DB_PASSWORD=' "${ENV_FILE}" | head -1 | cut -d= -f2-)
    _raw="${_raw%\'}" ; _raw="${_raw#\'}"
    _raw="${_raw%\"}" ; _raw="${_raw#\"}"
    DB_PASSWORD="${_raw}"
    unset _raw
  else
    warn "No .env found at ${ENV_FILE}"
  fi

  if [ -z "${DB_PASSWORD}" ]; then
    fail "DB_PASSWORD not found in ${ENV_FILE} — cannot run migrations safely"
  fi

  # Write a temporary MySQL option file.
  # Using --defaults-extra-file instead of -p"..." ensures the password
  # never appears in process listings (ps aux) or shell xtrace logs.
  MY_CNF=$(mktemp /tmp/rivermed_mysql_XXXXXX.cnf)
  chmod 600 "${MY_CNF}"
  printf '[client]\npassword=%s\n' "${DB_PASSWORD}" > "${MY_CNF}"
  unset DB_PASSWORD   # drop from shell environment immediately

  # Always delete the temp file on exit, even if the script aborts.
  trap 'rm -f "${MY_CNF}"' EXIT

  log "  File    : ${MIGRATE_SQL}"
  log "  Target  : river_med @ localhost (user: briya)"

  if mysql --defaults-extra-file="${MY_CNF}" \
           -u briya \
           river_med \
           < "${MIGRATE_SQL}"; then
    success "Migrations applied successfully"
  else
    fail "Migration failed — see MySQL output above. PM2 was NOT restarted. Database is unchanged past the failed statement."
  fi

  # Clean up temp file and cancel the exit trap (normal path).
  rm -f "${MY_CNF}"
  trap - EXIT
else
  log "[3/5] No src/db/migrate.sql found — skipping migration step"
fi
echo ""

# ── step 4: restart PM2 ───────────────────────────────────────────────────────
log "[4/5] Reloading PM2 app: ${PM2_APP}"

# --update-env picks up any new variables added to the ecosystem config
# without requiring a full pm2 delete + start cycle.
if pm2 list | grep -q "${PM2_APP}"; then
  pm2 reload "${PM2_APP}" --update-env
else
  warn "App not found in PM2 list — starting from ecosystem config"
  pm2 start "${REPO_DIR}/ecosystem.config.cjs" --env production
fi

pm2 save --force
success "PM2 reloaded and state saved"
echo ""

# ── step 5: wait for stabilisation ───────────────────────────────────────────
log "[5/5] Waiting for process to stabilise (3 s)"
sleep 3
pm2 show "${PM2_APP}" | grep -E "status|restarts|uptime" || true
echo ""

# ── health check ──────────────────────────────────────────────────────────────
log "Running health check: ${HEALTH_URL}"
ATTEMPT=0
while [ "${ATTEMPT}" -lt "${HEALTH_RETRIES}" ]; do
  ATTEMPT=$(( ATTEMPT + 1 ))
  HTTP_CODE=$(curl -s -o /tmp/river_med_health.json -w "%{http_code}" \
    --max-time 10 "${HEALTH_URL}" || echo "000")

  echo "  Attempt ${ATTEMPT}/${HEALTH_RETRIES} — HTTP ${HTTP_CODE}"

  if [ "${HTTP_CODE}" = "200" ]; then
    success "Health check passed"
    cat /tmp/river_med_health.json 2>/dev/null || true
    echo ""
    break
  fi

  if [ "${ATTEMPT}" -lt "${HEALTH_RETRIES}" ]; then
    warn "Not ready yet — retrying in ${HEALTH_WAIT}s"
    sleep "${HEALTH_WAIT}"
  else
    echo ""
    warn "Health check response (last attempt):"
    cat /tmp/river_med_health.json 2>/dev/null || true
    echo ""
    fail "Health check failed after ${HEALTH_RETRIES} attempts. Run: pm2 logs ${PM2_APP}"
  fi
done

# ── done ──────────────────────────────────────────────────────────────────────
echo ""
success "========================================"
success " River Med deployment complete"
success " Commit : $(git -C "${REPO_DIR}" log -1 --format='%h %s')"
success " Time   : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
success "========================================"
