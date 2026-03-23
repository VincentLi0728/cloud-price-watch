#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/deploy-azure-vm.sh user@vm-ip"
  exit 1
fi

TARGET="$1"
APP_ROOT="/opt/cloud-price-watch/current"

rsync -av --delete \
  --exclude ".git" \
  --exclude ".env" \
  ./ "${TARGET}:${APP_ROOT}"

ssh "${TARGET}" "sudo chown -R www-data:www-data ${APP_ROOT} && sudo systemctl restart cloud-price-watch && sudo systemctl status cloud-price-watch --no-pager"
