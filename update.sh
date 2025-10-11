#!/bin/bash
set -euo pipefail

# Динамическое определение директории скрипта
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

APP_NAME="bunyod-tour"
DB_NAME="bunyod_tour"
BACKUP_DIR="/var/backups/bunyod-tour"

HC_NODE="http://127.0.0.1:5000/healthz"
HC_NGINX="http://127.0.0.1/healthz"

wait_for_200 () {
  local url="$1"
  local timeout="${2:-120}"
  local i=0 code=000
  echo "🩺 Жду 200 от $url (timeout ${timeout}s)..."
  while [ $i -lt $timeout ]; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)
    if [ "$code" = "200" ]; then
      echo "✅ $url -> 200"
      return 0
    fi
    sleep 1; i=$((i+1))
  done
  echo "❌ Не дождались 200 от $url (последний код: $code)"
  return 1
}

echo "🔄 Начинаю обновление ${APP_NAME}..."

echo "🧷 Бэкап БД перед обновлением..."
mkdir -p "$BACKUP_DIR"
ts=$(date +%F_%H-%M-%S)
sudo -u postgres pg_dump -Fc -d "$DB_NAME" > "$BACKUP_DIR/${DB_NAME}_${ts}.dump"
echo "✅ Бэкап: $BACKUP_DIR/${DB_NAME}_${ts}.dump"

echo "⏸️  Останавливаю приложение..."
pm2 stop "$APP_NAME" || true

echo "📥 Git pull..."
git pull --ff-only origin main

echo "📦 Зависимости..."
npm ci || npm install

echo "🔧 Prisma generate..."
npx prisma generate

echo "🗄️  Применяю миграции (deploy)..."
npx prisma migrate deploy

echo "🌱 Сид (идемпотентный справочник)..."
npx prisma db seed || npm run seed

echo "🚀 Перезапуск приложения..."
pm2 restart "$APP_NAME"
pm2 save

echo "🔎 Проверяю порт 5000..."
for i in {1..60}; do
  if ss -lntp 2>/dev/null | grep -q ':5000\b'; then
    echo "✅ Порт 5000 слушается."
    break
  fi
  sleep 1
done

echo "🩺 Healthcheck..."
if ! wait_for_200 "$HC_NODE" 120; then
  echo "ℹ️  Пробую через Nginx..."
  if ! wait_for_200 "$HC_NGINX" 120; then
    echo "🔎 Логи для диагностики:"
    pm2 logs "$APP_NAME" --lines 120 || true
    systemctl status nginx --no-pager -n 0 || true
    exit 1
  fi
fi

echo "🎉 Готово."
