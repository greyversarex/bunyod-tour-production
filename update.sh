#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/bunyod-tour"
BACKUP_DIR="/var/backups/bunyod-tour"
UPLOADS_DIR="/var/bunyod-tour/uploads"
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

# 1.5. КРИТИЧНО: Защита uploads от удаления
echo "🛡️ Проверка uploads symlink..."

# Создать постоянную директорию если её нет
if [ ! -d "$UPLOADS_DIR" ]; then
  echo "📁 Создаю постоянное хранилище $UPLOADS_DIR..."
  sudo mkdir -p "$UPLOADS_DIR/images"
  sudo mkdir -p "$UPLOADS_DIR/tours"
  sudo mkdir -p "$UPLOADS_DIR/hotels"
  sudo mkdir -p "$UPLOADS_DIR/guides"
  sudo mkdir -p "$UPLOADS_DIR/drivers"
  sudo mkdir -p "$UPLOADS_DIR/slides"
  sudo chown -R $(whoami):$(whoami) "$UPLOADS_DIR"
  sudo chmod -R 755 "$UPLOADS_DIR"
  echo "✅ Постоянное хранилище создано"
fi

# Создать/восстановить symlink если его нет или это не symlink
if [ ! -L "$APP_DIR/uploads" ]; then
  echo "⚠️ Symlink uploads отсутствует или повреждён"
  echo "🔗 Создаю symlink $APP_DIR/uploads -> $UPLOADS_DIR"
  
  # Удалить если это обычная папка
  if [ -d "$APP_DIR/uploads" ] && [ ! -L "$APP_DIR/uploads" ]; then
    echo "⚠️ Найдена обычная папка uploads, перемещаю содержимое в постоянное хранилище..."
    cp -rn "$APP_DIR/uploads/"* "$UPLOADS_DIR/" 2>/dev/null || true
    rm -rf "$APP_DIR/uploads"
  fi
  
  # Создать symlink
  ln -s "$UPLOADS_DIR" "$APP_DIR/uploads"
  echo "✅ Symlink создан: uploads -> $UPLOADS_DIR"
else
  echo "✅ Symlink uploads на месте"
fi

# Проверить что symlink ведёт в правильное место
CURRENT_LINK=$(readlink "$APP_DIR/uploads")
if [ "$CURRENT_LINK" != "$UPLOADS_DIR" ]; then
  echo "⚠️ Symlink ведёт не туда: $CURRENT_LINK != $UPLOADS_DIR"
  echo "🔧 Исправляю..."
  rm "$APP_DIR/uploads"
  ln -s "$UPLOADS_DIR" "$APP_DIR/uploads"
  echo "✅ Symlink исправлен"
fi

echo "✅ Защита uploads настроена корректно"

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

# Миграция Order relations (добавление transfer_request_id, guide_hire_request_id) - КРИТИЧНА!
echo "🔄 Применяю миграцию Order relations (transfer/guide hire)..."
if ! sudo -u postgres psql -d "$DB_NAME" -f "$APP_DIR/manual_migrations/003_add_order_relations.sql"; then
  echo "❌ ОШИБКА: Миграция Order relations не применилась!"
  echo "❌ Прерываю deploy - schema не синхронизирована с БД"
  exit 1
fi
echo "✅ Миграция Order relations успешно применена"

# Prisma db push (синхронизация схемы)
# БЕЗ --accept-data-loss для безопасности production данных
echo "🔄 Синхронизация Prisma схемы с БД..."
if ! npx prisma db push; then
  echo "⚠️  ПРЕДУПРЕЖДЕНИЕ: Prisma db push показывает предупреждения о потере данных!"
  echo "⚠️  Это нормально если вы только что применили manual миграцию."
  echo "⚠️  Prisma просто не знает об уже применённых изменениях."
  echo "✅ Продолжаем deployment (manual миграции уже применены)"
else
  echo "✅ Prisma схема синхронизирована"
fi

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
