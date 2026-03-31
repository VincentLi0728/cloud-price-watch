#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/deploy-azure-vm.sh user@vm-ip"
  exit 1
fi

TARGET="$1"
APP_ROOT="/opt/cloud-price-watch/current"
REMOTE_HEALTH_URL="${REMOTE_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-}"
TARGET_HOST="${TARGET##*@}"

rsync -av --delete \
  --exclude ".git" \
  --exclude ".env" \
  --exclude "node_modules" \
  ./ "${TARGET}:${APP_ROOT}"

ssh "${TARGET}" "
  sudo chown -R www-data:www-data ${APP_ROOT} &&
  sudo systemctl restart cloud-price-watch &&
  sleep 2 &&
  curl -fsS --max-time 10 ${REMOTE_HEALTH_URL} &&
  sudo systemctl status cloud-price-watch --no-pager
"

if [[ -n "${PUBLIC_HEALTH_URL}" ]]; then
  echo ""
  echo "Verifying public endpoint: ${PUBLIC_HEALTH_URL}"
  curl -fsS --max-time 15 "${PUBLIC_HEALTH_URL}"
elif [[ "${TARGET_HOST}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo ""
  echo "Verifying public endpoint: http://${TARGET_HOST}/api/health"
  curl -fsS --max-time 15 "http://${TARGET_HOST}/api/health"
else
  echo ""
  echo "Skipping public health check because TARGET does not expose an IPv4 host."
  echo "Set PUBLIC_HEALTH_URL to verify a custom domain or HTTPS endpoint."
fi
