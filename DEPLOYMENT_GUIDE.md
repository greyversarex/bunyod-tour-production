# 🚀 Руководство по развертыванию Bunyod-Tour на внешнем сервере

## 📋 Содержание
1. [Обновление GitHub репозитория](#1-обновление-github-репозитория)
2. [Требования к серверу](#2-требования-к-серверу)
3. [Установка на сервер](#3-установка-на-сервер)
4. [Настройка окружения](#4-настройка-окружения)
5. [Запуск приложения](#5-запуск-приложения)
6. [Настройка Nginx](#6-настройка-nginx)
7. [Настройка PM2](#7-настройка-pm2)
8. [SSL сертификат](#8-ssl-сертификат)

---

## 1. Обновление GitHub репозитория

### Шаг 1.1: Коммит всех изменений
Выполните в Shell Replit:

```bash
# Удалить lock файл если есть
rm -f .git/index.lock

# Добавить все изменения
git add .

# Создать коммит
git commit -m "Production ready: 7 tour blocks, RU/EN only, all filters working"

# Отправить на GitHub
git push origin main
```

### Шаг 1.2: Проверка (опционально)
```bash
# Посмотреть последний коммит
git log --oneline -1

# Убедиться что всё запушено
git status
```

---

## 2. Требования к серверу

### Минимальные характеристики:
- **OS**: Ubuntu 20.04 LTS или выше
- **RAM**: 2GB минимум (рекомендуется 4GB)
- **CPU**: 2 ядра
- **Диск**: 20GB SSD
- **Порты**: 80 (HTTP), 443 (HTTPS), 5432 (PostgreSQL)

### Необходимое ПО:
- Node.js 18.x или 20.x
- PostgreSQL 14+
- Nginx
- PM2 (менеджер процессов)
- Git

---

## 3. Установка на сервер

### Шаг 3.1: Подключение к серверу
```bash
ssh root@ваш_IP_адрес
```

### Шаг 3.2: Установка Node.js 20.x
```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Проверка версий
node -v
npm -v
```

### Шаг 3.3: Установка PostgreSQL
```bash
# Установка PostgreSQL 14
apt install -y postgresql postgresql-contrib

# Запуск сервиса
systemctl start postgresql
systemctl enable postgresql

# Проверка статуса
systemctl status postgresql
```

### Шаг 3.4: Установка Nginx и PM2
```bash
# Установка Nginx
apt install -y nginx

# Установка PM2 глобально
npm install -g pm2

# Проверка
nginx -v
pm2 -v
```

### Шаг 3.5: Клонирование репозитория
```bash
# Создание директории для приложения
mkdir -p /var/www
cd /var/www

# Клонирование репозитория
git clone https://github.com/greyversarex/bunyod-tour-production.git bunyod-tour
cd bunyod-tour

# Установка зависимостей
npm install

# Установка Prisma CLI (если нужно)
npm install -g prisma
```

---

## 4. Настройка окружения

### Шаг 4.1: Создание PostgreSQL базы данных
```bash
# Войти в PostgreSQL
sudo -u postgres psql

# Выполнить в psql:
CREATE DATABASE bunyod_tour;
CREATE USER bunyod_admin WITH ENCRYPTED PASSWORD 'ваш_сложный_пароль';
GRANT ALL PRIVILEGES ON DATABASE bunyod_tour TO bunyod_admin;
\q
```

### Шаг 4.2: Настройка .env файла
```bash
# Создать .env файл
nano .env
```

Вставьте следующий контент (замените значения):

```env
# Database
DATABASE_URL="postgresql://bunyod_admin:ваш_пароль@localhost:5432/bunyod_tour?schema=public"

# JWT
JWT_SECRET="ваш_супер_секретный_ключ_минимум_32_символа"

# Server
NODE_ENV=production
PORT=5000

# Payment Gateways (опционально, добавьте если есть)
STRIPE_SECRET_KEY=sk_live_ваш_stripe_ключ
PAYLER_MERCHANT_KEY=ваш_payler_ключ
PAYLER_PASSWORD=ваш_payler_пароль
ALIF_MERCHANT_KEY=ваш_alif_ключ
ALIF_MERCHANT_PASSWORD=ваш_alif_пароль

# Email (опционально)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ваш_email@gmail.com
SMTP_PASSWORD=ваш_app_пароль
```

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

### Шаг 4.3: Применение схемы БД и seed
```bash
# Генерация Prisma клиента
npx prisma generate

# Применение схемы
npx prisma db push

# Запуск seed (создание начальных данных)
npx prisma db seed

# Проверка данных
npx prisma studio --browser none
# Откройте в браузере: http://ваш_IP:5555
```

---

## 5. Запуск приложения

### Шаг 5.1: Тестовый запуск
```bash
# Запустить сервер для проверки
NODE_ENV=production node index.js

# Проверить в браузере: http://ваш_IP:5000
# Нажмите Ctrl+C для остановки
```

### Шаг 5.2: Сборка TypeScript (если используется)
```bash
# Если есть TypeScript файлы
npm run build
```

---

## 6. Настройка Nginx

### Шаг 6.1: Создание конфигурации Nginx
```bash
nano /etc/nginx/sites-available/bunyod-tour
```

Вставьте конфигурацию:

```nginx
server {
    listen 80;
    server_name ваш_домен.com www.ваш_домен.com;

    # Логи
    access_log /var/log/nginx/bunyod-tour-access.log;
    error_log /var/log/nginx/bunyod-tour-error.log;

    # Прокси на Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Статические файлы (опционально, для оптимизации)
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf)$ {
        proxy_pass http://localhost:5000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Увеличение лимита для загрузки файлов
    client_max_body_size 50M;
}
```

### Шаг 6.2: Активация конфигурации
```bash
# Создать символическую ссылку
ln -s /etc/nginx/sites-available/bunyod-tour /etc/nginx/sites-enabled/

# Проверить конфигурацию
nginx -t

# Перезапустить Nginx
systemctl restart nginx
systemctl enable nginx
```

---

## 7. Настройка PM2

### Шаг 7.1: Создание PM2 конфигурации
```bash
nano ecosystem.config.js
```

Вставьте:

```javascript
module.exports = {
  apps: [{
    name: 'bunyod-tour',
    script: './index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M'
  }]
};
```

### Шаг 7.2: Запуск с PM2
```bash
# Создать папку для логов
mkdir -p logs

# Запуск приложения
pm2 start ecosystem.config.js

# Сохранить список процессов
pm2 save

# Автозапуск при перезагрузке
pm2 startup systemd
# Выполните команду, которую выдаст PM2

# Полезные команды PM2:
pm2 list              # Список процессов
pm2 logs              # Логи
pm2 monit             # Мониторинг
pm2 restart all       # Перезапуск
pm2 stop all          # Остановка
pm2 delete all        # Удаление
```

---

## 8. SSL сертификат (Let's Encrypt)

### Шаг 8.1: Установка Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### Шаг 8.2: Получение SSL сертификата
```bash
# Автоматическая настройка SSL
certbot --nginx -d ваш_домен.com -d www.ваш_домен.com

# Следуйте инструкциям на экране
# Выберите опцию 2 (перенаправление HTTP → HTTPS)
```

### Шаг 8.3: Автообновление сертификата
```bash
# Тест автообновления
certbot renew --dry-run

# Автообновление настроено автоматически через cron
```

---

## 9. Финальная проверка

### Шаг 9.1: Проверка сервисов
```bash
# PostgreSQL
systemctl status postgresql

# Nginx
systemctl status nginx

# PM2
pm2 status
```

### Шаг 9.2: Проверка сайта
Откройте в браузере:
- `http://ваш_домен.com` (должен перенаправить на HTTPS)
- `https://ваш_домен.com`

### Шаг 9.3: Проверка админ-панели
- `https://ваш_домен.com/admin-dashboard.html`

---

## 10. Обновление сайта в будущем

### Метод 1: Через Git (рекомендуется)
```bash
cd /var/www/bunyod-tour
git pull origin main
npm install                    # Обновление зависимостей
npx prisma generate           # Регенерация Prisma
npx prisma db push            # Применение изменений БД
pm2 restart all               # Перезапуск приложения
```

### Метод 2: Скрипт автообновления
Создайте файл `update.sh`:

```bash
#!/bin/bash
echo "🔄 Updating Bunyod-Tour..."
cd /var/www/bunyod-tour
git pull origin main
npm install
npx prisma generate
npx prisma db push
pm2 restart all
echo "✅ Update completed!"
```

Сделайте исполняемым:
```bash
chmod +x update.sh
./update.sh
```

---

## 11. Мониторинг и логи

### Логи Nginx:
```bash
tail -f /var/log/nginx/bunyod-tour-access.log
tail -f /var/log/nginx/bunyod-tour-error.log
```

### Логи PM2:
```bash
pm2 logs
pm2 logs bunyod-tour --lines 100
```

### Логи PostgreSQL:
```bash
tail -f /var/log/postgresql/postgresql-14-main.log
```

---

## 12. Резервное копирование

### Бэкап базы данных:
```bash
# Создать папку для бэкапов
mkdir -p /var/backups/bunyod-tour

# Ручной бэкап
pg_dump -U bunyod_admin bunyod_tour > /var/backups/bunyod-tour/backup_$(date +%Y%m%d_%H%M%S).sql

# Автоматический бэкап (добавить в crontab)
crontab -e
# Добавить строку (каждый день в 3:00 AM):
0 3 * * * pg_dump -U bunyod_admin bunyod_tour > /var/backups/bunyod-tour/backup_$(date +\%Y\%m\%d).sql
```

### Восстановление из бэкапа:
```bash
psql -U bunyod_admin bunyod_tour < /var/backups/bunyod-tour/backup_20251010.sql
```

---

## 📞 Поддержка

### Полезные команды диагностики:
```bash
# Проверка портов
netstat -tulpn | grep :5000
netstat -tulpn | grep :80

# Проверка процессов
ps aux | grep node

# Использование диска
df -h

# Использование памяти
free -m

# Системные логи
journalctl -xe
```

### Типичные проблемы:

**Проблема**: Сайт не открывается
- Проверьте: `pm2 status`, `systemctl status nginx`
- Логи: `pm2 logs`, `tail -f /var/log/nginx/error.log`

**Проблема**: База данных не подключается
- Проверьте: `systemctl status postgresql`
- Проверьте DATABASE_URL в .env
- Проверьте пароль БД

**Проблема**: 502 Bad Gateway
- PM2 не запущен: `pm2 restart all`
- Неправильный порт в Nginx

---

## ✅ Чек-лист финального запуска

- [ ] PostgreSQL установлен и запущен
- [ ] База данных создана
- [ ] Node.js 20.x установлен
- [ ] Репозиторий склонирован
- [ ] npm install выполнен
- [ ] .env файл настроен
- [ ] Prisma схема применена (db push)
- [ ] Seed данные загружены
- [ ] Nginx настроен и запущен
- [ ] PM2 настроен и запущен
- [ ] SSL сертификат установлен
- [ ] Сайт открывается по HTTPS
- [ ] Админ-панель работает
- [ ] Все платежные системы настроены (опционально)
- [ ] Email отправка работает (опционально)
- [ ] Бэкапы настроены

---

**🎉 Поздравляем! Ваш сайт Bunyod-Tour успешно развернут!**
