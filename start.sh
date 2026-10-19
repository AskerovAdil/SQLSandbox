#!/usr/bin/env bash
# Запуск SQL Sandbox на macOS/Linux: проверяет Node, при необходимости ставит зависимости и запускает dev-сервер.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[SQL Sandbox] Node.js не найден."
  echo "Установите Node.js LTS версии 22: https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" != "22" ]; then
  echo "[SQL Sandbox] Найдена Node.js major-версии $NODE_MAJOR, а нужна 22 LTS."
  echo "Установите Node.js 22 LTS: https://nodejs.org/"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[SQL Sandbox] Первый запуск: устанавливаю зависимости..."
  npm install
fi

echo "[SQL Sandbox] Запускаю приложение. Браузер откроется автоматически."
npm run dev -- --open
