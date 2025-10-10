# 🚀 ЧИСТОЕ РАЗВЕРТЫВАНИЕ BUNYOD-TOUR НА PRODUCTION

## 📋 ЧТО МЫ ДЕЛАЕМ:
1. Создаём новый GitHub репозиторий
2. Загружаем туда ВСЕ файлы проекта
3. Разворачиваем на чистом сервере TimeWeb

---

## ЧАСТЬ 1: ПОДГОТОВКА РЕПОЗИТОРИЯ (на Replit)

### Шаг 1: Создайте новый приватный репозиторий на GitHub

1. Откройте https://github.com/new
2. Название: `bunyod-tour-production` (или любое другое)
3. Выберите: **Private** (приватный)
4. НЕ добавляйте README, .gitignore или лицензию
5. Нажмите **Create repository**

GitHub покажет инструкции - **скопируйте URL репозитория**, например:
```
https://github.com/ваш-username/bunyod-tour-production.git
```

---

### Шаг 2: Загрузите весь проект в новый репозиторий

**Выполните ЭТИ КОМАНДЫ на Replit** (в Shell):

```bash
# 1. Создайте новый Git репозиторий
cd /home/runner/workspace
rm -rf .git  # Удалить старый git
git init

# 2. Настройте Git (замените на ваши данные)
git config user.name "Ваше Имя"
git config user.email "ваш-email@example.com"

# 3. Добавьте ВСЕ файлы
git add .

# 4. Создайте первый коммит
git commit -m "Initial production deployment"

# 5. Подключите новый репозиторий (ЗАМЕНИТЕ URL на ваш!)
git remote add origin https://github.com/ваш-username/bunyod-tour-production.git

# 6. Загрузите код на GitHub
git branch -M main
git push -u origin main
```

**Введите логин и пароль GitHub** (или используйте Personal Access Token)

---

### Шаг 3: Проверьте на GitHub

Откройте ваш репозиторий на GitHub и убедитесь, что там есть:
- ✅ Папка `frontend/` с HTML файлами
- ✅ Папка `src/` с TypeScript кодом
- ✅ Папка `prisma/` со схемой БД
- ✅ Файл `.env.example`
- ✅ Файл `ecosystem.config.js`
- ✅ Файл `package.json`
- ✅ Файл `index.js`

---

## ЧАСТЬ 2: ЧИСТОЕ РАЗВЕРТЫВАНИЕ НА СЕРВЕРЕ

### Шаг 1: Очистка сервера (на TimeWeb через SSH)

```bash
# Подключитесь к серверу
ssh root@147.45.213.8

# Остановите старые процессы
pm2 delete all
pm2 save

# Удалите старые файлы
cd /root
rm -rf bunyod-tour-prod bonyor-prod buno-prod

# Очистите базу данных
psql -d postgres -U postgres << EOF
DROP DATABASE IF EXISTS bunyod_tour;
CREATE DATABASE bunyod_tour;
ALTER DATABASE bunyod_tour OWNER TO bunyod_user;
\q
EOF
```

---

### Шаг 2: Клонирование нового репозитория

```bash
# Находимся в /root
cd /root

# Клонируйте НОВЫЙ репозиторий (ЗАМЕНИТЕ URL!)
git clone https://github.com/ваш-username/bunyod-tour-production.git bunyod-tour

# Перейдите в папку проекта
cd bunyod-tour
```

---

### Шаг 3: Установка зависимостей

```bash
# Установите npm пакеты
npm install

# Проверьте что Prisma сгенерирован
npx prisma generate
```

---

### Шаг 4: Создание .env файла

```bash
# Создайте .env из примера
cat > .env << 'EOF'
# ===========================================
# БАЗА ДАННЫХ
# ===========================================
DATABASE_URL="postgresql://bunyod_user:ЗАМЕНИТЕ_ПАРОЛЬ@localhost:5432/bunyod_tour"

# ===========================================
# БЕЗОПАСНОСТЬ
# ===========================================
JWT_SECRET="bunyod-tour-production-2025-tajikistan-secret-key"
NODE_ENV="production"

# ===========================================
# СЕРВЕР
# ===========================================
PORT=5000
PRODUCTION_DOMAIN="147.45.213.8"
ALLOWED_ORIGINS="http://147.45.213.8"

# ===========================================
# EMAIL (опционально)
# ===========================================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="Bunyod Tour <noreply@bunyod-tour.tj>"

# ===========================================
# ПЛАТЕЖИ (заполните позже)
# ===========================================
ALIF_MERCHANT_KEY=""
ALIF_MERCHANT_PASSWORD=""
PAYLER_MERCHANT_ID=""
PAYLER_SECRET_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# ===========================================
# НАСТРОЙКИ
# ===========================================
INIT_DATABASE=false
ENABLE_DYNAMIC_PRICING=true
LOG_LEVEL="info"
EOF

# Отредактируйте пароль БД
nano .env
```

**В nano:**
- Найдите `ЗАМЕНИТЕ_ПАРОЛЬ`
- Замените на реальный пароль PostgreSQL
- Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

---

### Шаг 5: Инициализация базы данных

```bash
# Применить схему
npx prisma db push

# Заполнить начальными данными
npm run db:seed
```

**Результат:**
- ✅ Админ: `admin` / `admin12345`
- ✅ 5 валют (TJS, USD, EUR, RUB, CNY)
- ✅ 5 стран + 12 городов  
- ✅ 15 категорий туров

---

### Шаг 6: Запуск через PM2

```bash
# Запустить
pm2 start ecosystem.config.js

# Проверить
pm2 status
pm2 logs bunyod-tour --lines 50

# Сохранить для автозапуска
pm2 save
pm2 startup
# Выполните команду, которую PM2 покажет
```

---

### Шаг 7: Настройка Nginx (для доступа без порта)

#### 7.1 Установка Nginx (если нет)

```bash
# Для Arch Linux
sudo pacman -S nginx

# Для Ubuntu/Debian
# sudo apt install nginx -y
```

#### 7.2 Настройка виртуального хоста

```bash
# Создайте конфигурацию
sudo nano /etc/nginx/nginx.conf
```

**Добавьте внутри блока `http { ... }`:**

```nginx
server {
    listen 80;
    server_name 147.45.213.8;

    # Логи
    access_log /var/log/nginx/bunyod-tour-access.log;
    error_log /var/log/nginx/bunyod-tour-error.log;

    # Прокси на Node.js приложение
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Статические файлы (загруженные изображения)
    location /uploads {
        alias /root/bunyod-tour/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Сохраните:** `Ctrl+O`, `Enter`, `Ctrl+X`

#### 7.3 Запуск Nginx

```bash
# Проверить конфигурацию
sudo nginx -t

# Запустить Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Проверить статус
sudo systemctl status nginx
```

---

## ✅ ПРОВЕРКА РАБОТОСПОСОБНОСТИ

### 1. Проверка API

```bash
curl http://localhost:5000/api/health
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "message": "Tajik Trails API is running",
  "environment": "production",
  "version": "2.0.0"
}
```

### 2. Проверка валют

```bash
curl http://localhost:5000/api/exchange-rates | jq
```

Должны вернуться 5 валют.

### 3. Проверка в браузере

Откройте браузер:
- **Главная страница:** `http://147.45.213.8`
- **Админ-панель:** `http://147.45.213.8/admin-dashboard.html`
- **Логин:** `admin` / `admin12345`

---

## 🔧 ПОЛЕЗНЫЕ КОМАНДЫ

### PM2
```bash
pm2 status                    # Статус процессов
pm2 logs bunyod-tour         # Логи приложения
pm2 restart bunyod-tour      # Перезапуск
pm2 stop bunyod-tour         # Остановка
pm2 monit                    # Мониторинг ресурсов
```

### Nginx
```bash
sudo nginx -t                # Проверка конфигурации
sudo systemctl reload nginx  # Перезагрузка конфига
sudo systemctl restart nginx # Перезапуск Nginx
sudo tail -f /var/log/nginx/bunyod-tour-access.log  # Логи доступа
sudo tail -f /var/log/nginx/bunyod-tour-error.log   # Логи ошибок
```

### База данных
```bash
psql -d bunyod_tour -U bunyod_user  # Подключение к БД
npx prisma studio                    # GUI для БД (на localhost:5555)
```

---

## ❌ УСТРАНЕНИЕ ПРОБЛЕМ

### Проблема: "Cannot connect to database"
```bash
# Проверьте PostgreSQL
sudo systemctl status postgresql
sudo systemctl start postgresql

# Проверьте DATABASE_URL в .env
cat .env | grep DATABASE_URL
```

### Проблема: "Port 5000 already in use"
```bash
# Найдите процесс
sudo lsof -i :5000

# Остановите через PM2
pm2 stop bunyod-tour
pm2 delete bunyod-tour

# Перезапустите
pm2 start ecosystem.config.js
```

### Проблема: Nginx не работает
```bash
# Проверьте синтаксис
sudo nginx -t

# Проверьте логи
sudo tail -50 /var/log/nginx/error.log

# Перезапустите
sudo systemctl restart nginx
```

### Проблема: "Route not found" для статических файлов
```bash
# Проверьте что файлы существуют
ls -la /root/bunyod-tour/frontend/

# Проверьте PM2 логи
pm2 logs bunyod-tour

# Перезапустите
pm2 restart bunyod-tour
```

---

## 🎉 ГОТОВО!

Теперь ваш сайт Bunyod Tour работает на production сервере!

**Следующие шаги:**
1. ✅ Войдите в админку и создайте туры
2. ✅ Настройте платежные системы (AlifPay, Payler, Stripe)
3. ✅ Настройте SMTP для отправки email
4. ✅ Подключите домен (когда будет готов)
5. ✅ Настройте SSL сертификат (Let's Encrypt)

---

## 📞 ПОДДЕРЖКА

Если возникнут проблемы:
1. Проверьте PM2 логи: `pm2 logs bunyod-tour`
2. Проверьте Nginx логи: `sudo tail -50 /var/log/nginx/bunyod-tour-error.log`
3. Проверьте статус БД: `sudo systemctl status postgresql`
4. Проверьте .env файл: `cat /root/bunyod-tour/.env`

**Удачи! 🚀**
