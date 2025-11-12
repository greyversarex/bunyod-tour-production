#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/bunyod-tour"
BACKUP_DIR="/var/backups/bunyod-tour"
DB_NAME="bunyod_tour"
PM2_APP="bunyod-tour"

echo "🔄 Начинаю обновление $PM2_APP..."

cd "$APP_DIR"

# 0. Бэкап БД перед обновлением
echo "🧷 Бэкап БД перед обновлением..."
mkdir -p "$BACKUP_DIR"
sudo -u postgres pg_dump "$DB_NAME" > "$BACKUP_DIR/${DB_NAME}_$(date +%F_%H-%M-%S).dump"
echo "✅ Бэкап готов"

# 1. Стянуть свежий код БЕЗ конфликтов
echo "📥 Git fetch/reset..."
git fetch origin --prune
git reset --hard origin/main

# 2. Установить зависимости
echo "📦 npm ci..."
npm ci

# 3. Сгенерить Prisma client
echo "🔧 Prisma generate..."
npx prisma generate

# 4. Скомпилить TypeScript
echo "🏗️ Компиляция..."
npm run build

echo "📁 Создаю директорию логов (если нет)..."
mkdir -p logs

# !!! На этом этапе у нас уже собран новый код.
#    Если что-то сломается ДО этой точки — PM2 не трогали, сайт жив.
#    Всё что ниже — только если билд ок.

echo "🗄️ Применяю manual миграции..."

# Подготовительная миграция слайдов (добавляет en и нормализует JSON)
# || true потому что уже применена на production
sudo -u postgres psql -d "$DB_NAME" -f "$APP_DIR/manual_migrations/000_slides_prepare.sql" || true

# Основная миграция слайдов (меняет тип text -> jsonb)
# || true потому что уже применена на production
sudo -u postgres psql -d "$DB_NAME" -f "$APP_DIR/manual_migrations/001_slides_jsonb.sql" || true

# Миграция custom_tour_orders (TEXT -> JSONB) - КРИТИЧНА, должна пройти успешно!
echo "🔄 Применяю миграцию custom_tour_orders (TEXT -> JSONB)..."
if ! sudo -u postgres psql -d "$DB_NAME" -f "$APP_DIR/manual_migrations/002_custom_tour_orders_jsonb.sql"; then
  echo "❌ ОШИБКА: Миграция custom_tour_orders не применилась!"
  echo "❌ Прерываю deploy - schema не синхронизирована с БД"
  exit 1
fi
echo "✅ Миграция custom_tour_orders успешно применена"

# Prisma db push (синхронизация схемы, не должна падать всё)
npx prisma db push || true

echo "🚀 Перезапуск приложения через PM2..."
pm2 startOrReload ecosystem.config.js --only "$PM2_APP"
pm2 save

echo "🩺 Healthcheck..."
code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/healthz || true)
if [ "$code" = "200" ]; then
  echo "✅ Прод успешно обновлён и работает (healthz 200)"
else
  echo "⚠️ Обновление прошло, но healthz != 200 (был $code). Проверь логи: pm2 logs $PM2_APP --lines 100"
fi

echo "🎉 Готово."
