#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-food-tracker}"
BRANCH="${1:-main}"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "[deploy] app: $APP_NAME"
echo "[deploy] branch: $BRANCH"
echo "[deploy] cwd: $ROOT_DIR"

echo "[deploy] fetching updates"
git fetch origin

echo "[deploy] switching to branch $BRANCH"
git checkout "$BRANCH"

echo "[deploy] pulling latest code"
git pull --ff-only origin "$BRANCH"

echo "[deploy] installing dependencies"
npm ci

echo "[deploy] generating Prisma client"
npx prisma generate

echo "[deploy] applying migrations"
npx prisma migrate deploy

CA_CERT_PATH="$ROOT_DIR/cert/russiantrustedca.pem"
if [[ -f "$CA_CERT_PATH" ]]; then
  export NODE_EXTRA_CA_CERTS="$CA_CERT_PATH"
  echo "[deploy] NODE_EXTRA_CA_CERTS set to $CA_CERT_PATH"
else
  echo "[deploy] warning: CA cert not found at $CA_CERT_PATH; continuing without NODE_EXTRA_CA_CERTS"
fi

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "[deploy] restarting PM2 process $APP_NAME"
  pm2 restart "$APP_NAME" --update-env
else
  echo "[deploy] starting PM2 process $APP_NAME"
  pm2 start index.js --name "$APP_NAME" --time
fi

echo "[deploy] saving PM2 process list"
pm2 save

echo "[deploy] done"
