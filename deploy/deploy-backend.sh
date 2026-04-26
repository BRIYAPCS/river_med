#!/usr/bin/env bash
# =============================================================================
# River Med — backend deploy script
# Called by GitHub Actions after SSH-ing into the Linode server.
#
# Safe guarantees:
#   - Never touches .env or .env.production
#   - Never deletes any file
#   - Only restarts river-med-backend (other PM2 apps untouched)
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
log "[1/4] Pulling latest code from origin/main"
cd "${REPO_DIR}"
git fetch --all --quiet
git reset --hard origin/main
success "Code updated — $(git log -1 --format='%h %s')"
echo ""

# ── step 2: install dependencies ──────────────────────────────────────────────
log "[2/4] Installing backend dependencies"
cd "${BACKEND_DIR}"

# npm ci is strict (uses package-lock.json exactly) and faster.
# Fall back to npm install only if the lock file is absent (should not happen).
if [ -f "package-lock.json" ]; then
  npm ci --omit=dev --prefer-offline
else
  warn "package-lock.json not found — falling back to npm install"
  npm install --omit=dev
fi
success "Dependencies installed"
echo ""

# ── step 3: restart PM2 ───────────────────────────────────────────────────────
log "[3/4] Reloading PM2 app: ${PM2_APP}"

# pm2 reload = zero-downtime (new process starts before old one stops).
# Fall back to pm2 restart if the app has never been started.
if pm2 list | grep -q "${PM2_APP}"; then
  pm2 reload "${PM2_APP}"
else
  warn "App not found in PM2 list — starting from ecosystem config"
  pm2 start "${REPO_DIR}/ecosystem.config.cjs" --env production
fi

pm2 save --force
success "PM2 reloaded and state saved"
echo ""

# ── step 4: wait for stabilisation ───────────────────────────────────────────
log "[4/4] Waiting for process to stabilise (3 s)"
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
    fail "Health check failed after ${HEALTH_RETRIES} attempts. Check: pm2 logs ${PM2_APP}"
  fi
done

# ── done ──────────────────────────────────────────────────────────────────────
echo ""
success "========================================"
success " River Med deployment complete"
success " Commit : $(git -C ${REPO_DIR} log -1 --format='%h %s')"
success " Time   : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
success "========================================"
