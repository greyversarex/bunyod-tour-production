#!/usr/bin/env bash
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

# ========================================
# ФАЗА 1: ОБНОВЛЕНИЕ КОДА (БЕЗ ОСТАНОВКИ PM2)
# ========================================

echo "📥 Git: жёсткое обновление от origin/main..."
git fetch origin --prune
git reset --hard origin/main
echo "✅ Код обновлён до последнего коммита"

echo "📦 Установка зависимостей..."
npm ci || npm install
echo "✅ Зависимости установлены"

echo "🔧 Prisma generate..."
npx prisma generate
echo "✅ Prisma Client сгенерирован"

# ========================================
# ФАЗА 2: РУЧНЫЕ МИГРАЦИИ (ЕСЛИ НУЖНЫ)
# ========================================

echo "🔍 Проверка ручных миграций..."

# Проверяем тип колонки slides.title
echo "📊 Проверяю тип колонки slides.title..."
TITLE_TYPE=$(sudo -u postgres psql -d "$DB_NAME" -t -c \
  "SELECT data_type FROM information_schema.columns 
   WHERE table_name='slides' AND column_name='title';" | xargs)

if [ "$TITLE_TYPE" != "jsonb" ]; then
  echo "⚙️  Колонка slides.title имеет тип: $TITLE_TYPE (нужен jsonb)"
  if [ -f "manual_migrations/001_slides_jsonb.sql" ]; then
    echo "🔧 Применяю ручную миграцию: 001_slides_jsonb.sql..."
    sudo -u postgres psql -d "$DB_NAME" -f "manual_migrations/001_slides_jsonb.sql"
    echo "✅ Ручная миграция применена успешно"
  else
    echo "⚠️  Файл manual_migrations/001_slides_jsonb.sql не найден, пропускаю"
  fi
else
  echo "✅ Колонка slides.title уже имеет тип jsonb, миграция не требуется"
fi

# ========================================
# ФАЗА 3: PRISMA МИГРАЦИИ
# ========================================

echo "🗄️  Применяю миграции базы данных..."
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "📋 Найдены Prisma миграции, применяю migrate deploy..."
  if ! npx prisma migrate deploy; then
    echo "⚠️  Prisma migrate deploy упал, пробую db push..."
    if ! npx prisma db push --accept-data-loss 2>&1; then
      echo "⚠️  Prisma db push тоже не прошёл, но продолжаем деплой"
      echo "💡 Схема БД может быть не полностью синхронизирована"
    fi
  fi
else
  echo "📋 Prisma миграций нет, применяю db push..."
  if ! npx prisma db push --accept-data-loss 2>&1; then
    echo "⚠️  Prisma db push failed, continuing without schema change"
    echo "💡 Схема БД может не совпадать с кодом, проверьте вручную"
  else
    echo "✅ Prisma db push выполнен успешно"
  fi
fi

echo "🌱 Сид (идемпотентный справочник)..."
npx prisma db seed || npm run seed || echo "⚠️  Сид пропущен (не критично)"

# ========================================
# ФАЗА 4: СБОРКА
# ========================================

echo "🏗️  Компиляция TypeScript для production..."
if ! npm run build; then
  echo "❌ ОШИБКА: TypeScript не собрался!"
  echo "🛑 Останавливаю деплой, чтобы не убить прод"
  echo "📋 Проверьте ошибки билда выше и исправьте код"
  exit 1
fi
echo "✅ TypeScript скомпилирован успешно"

# ========================================
# ФАЗА 5: ПЕРЕЗАПУСК PM2
# ========================================

echo "📁 Создаю директорию логов..."
mkdir -p logs

echo "🚀 Перезапуск приложения через PM2..."
pm2 startOrReload ecosystem.config.js --only bunyod-tour
pm2 save
echo "✅ PM2 перезапущен"

# ========================================
# ФАЗА 6: HEALTHCHECK
# ========================================

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
    echo "⚠️  Healthcheck не прошёл, проверяю логи:"
    pm2 logs "$APP_NAME" --lines 120 || true
    systemctl status nginx --no-pager -n 0 || true
    echo ""
    echo "⚠️  Деплой завершён, но приложение может не работать корректно"
    echo "📋 Проверьте логи выше для диагностики"
    exit 1
  fi
fi

echo ""
echo "🎉 Деплой завершён успешно!"
echo "✅ Приложение работает и отвечает на healthcheck"
