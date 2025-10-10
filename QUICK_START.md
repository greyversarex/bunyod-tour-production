# ⚡ БЫСТРЫЙ СТАРТ - Развертывание Bunyod-Tour

## 📝 ШАГ 1: Создать репозиторий на GitHub

1. Откройте: https://github.com/new
2. Название: `bunyod-tour-production`
3. Выберите: **Private**
4. Нажмите: **Create repository**
5. **Скопируйте URL**, например: `https://github.com/username/bunyod-tour-production.git`

---

## 💻 ШАГ 2: Загрузить код (на Replit Shell)

```bash
cd /home/runner/workspace
rm -rf .git
git init
git config user.name "Your Name"
git config user.email "your@email.com"
git add .
git commit -m "Production deployment"
git remote add origin https://github.com/username/bunyod-tour-production.git
git branch -M main
git push -u origin main
```

*Введите логин/пароль GitHub*

---

## 🖥️ ШАГ 3: Очистить сервер (SSH на TimeWeb)

```bash
ssh root@147.45.213.8

pm2 delete all
pm2 save
cd /root
rm -rf bunyod-tour-prod bonyor-prod buno-prod

psql -d postgres -U postgres << EOF
DROP DATABASE IF EXISTS bunyod_tour;
CREATE DATABASE bunyod_tour;
ALTER DATABASE bunyod_tour OWNER TO bunyod_user;
\q
EOF
```

---

## 📦 ШАГ 4: Развернуть проект

```bash
cd /root
git clone https://github.com/username/bunyod-tour-production.git bunyod-tour
cd bunyod-tour
npm install
```

---

## ⚙️ ШАГ 5: Настроить .env

```bash
cat > .env << 'EOF'
DATABASE_URL="postgresql://bunyod_user:ВАШ_ПАРОЛЬ@localhost:5432/bunyod_tour"
JWT_SECRET="bunyod-tour-production-2025-tajikistan-secret"
NODE_ENV="production"
PORT=5000
PRODUCTION_DOMAIN="147.45.213.8"
ALLOWED_ORIGINS="http://147.45.213.8"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="Bunyod Tour <noreply@bunyod-tour.tj>"
INIT_DATABASE=false
ENABLE_DYNAMIC_PRICING=true
LOG_LEVEL="info"
EOF

nano .env  # Замените ВАШ_ПАРОЛЬ на реальный
```

---

## 🗄️ ШАГ 6: Инициализировать БД

```bash
npx prisma db push
npm run db:seed
```

**Результат:**
- ✅ Админ: `admin` / `admin12345`
- ✅ 5 валют
- ✅ 5 стран, 12 городов
- ✅ 15 категорий

---

## 🚀 ШАГ 7: Запустить PM2

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs bunyod-tour
pm2 save
pm2 startup  # Выполните команду, которую PM2 покажет
```

---

## 🌐 ШАГ 8: Настроить Nginx

```bash
sudo pacman -S nginx  # или: sudo apt install nginx -y

sudo nano /etc/nginx/nginx.conf
```

**Добавьте в `http { ... }`:**

```nginx
server {
    listen 80;
    server_name 147.45.213.8;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        alias /root/bunyod-tour/uploads;
        expires 30d;
    }
}
```

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## ✅ ШАГ 9: Проверка

### В терминале:
```bash
curl http://localhost:5000/api/health
```

### В браузере:
- **Главная:** http://147.45.213.8
- **Админка:** http://147.45.213.8/admin-dashboard.html
- **Логин:** `admin` / `admin12345`

---

## 🎉 ГОТОВО!

Ваш сайт работает на production! 

**Полная документация:** См. файл `CLEAN_DEPLOYMENT.md`
