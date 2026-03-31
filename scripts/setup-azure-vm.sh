#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/cloud-price-watch"
APP_USER="azureuser"

sudo apt-get update
sudo apt-get install -y curl nginx ufw git

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo mkdir -p "${APP_ROOT}/current" "${APP_ROOT}/shared"
sudo chown -R "${APP_USER}:${APP_USER}" "${APP_ROOT}"

sudo cp deploy/systemd/cloud-price-watch.service /etc/systemd/system/cloud-price-watch.service
sudo cp deploy/nginx/cloud-price-watch.conf /etc/nginx/sites-available/cloud-price-watch.conf
sudo ln -sf /etc/nginx/sites-available/cloud-price-watch.conf /etc/nginx/sites-enabled/cloud-price-watch.conf
sudo rm -f /etc/nginx/sites-enabled/default

sudo systemctl daemon-reload
sudo systemctl enable cloud-price-watch
sudo nginx -t
sudo systemctl restart nginx

sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw --force enable

echo "Azure VM base setup complete."
echo "Next: clone or pull the project into ${APP_ROOT}/current and create ${APP_ROOT}/shared/.env"
