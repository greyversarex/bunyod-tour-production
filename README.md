# 🏔️ Bunyod-Tour - Tourism Platform for Central Asia

Comprehensive tourism booking platform for Central Asia (Tajikistan, Uzbekistan, Kazakhstan, Turkmenistan, Kyrgyzstan) with tour, hotel, and guide booking, secure payments, and bilingual content (Russian/English only).

## ✨ Features

### Core Functionality
- **Tour Management**: Full CRUD with component-based pricing and 15 specialized categories
- **7 Tour Blocks**: Popular Tours, Combined Tours, + 5 Central Asian countries (iron-concrete structure)
- **Hotel Booking**: Multi-step booking flow with room/meal selection
- **Guide & Driver Management**: Comprehensive profiles, reviews, and assignments
- **Multilingual Support**: Russian and English content (Tajik removed)
- **Currency System**: TJS, USD, EUR, RUB, CNY with real-time conversion
- **Advanced Search**: Dynamic filtering by blocks, categories, cities, countries

### Payment Integration
- **Stripe**: Full Payment Intents API with webhooks
- **Payler**: Russia/CIS market with HMAC-SHA256 validation
- **AlifPay**: Tajikistan market with secure webhooks

### Security & Performance
- Rate limiting (15 requests/15min for auth)
- XSS protection middleware
- JWT authentication with mandatory secret validation
- Component-based dynamic pricing
- Debounced price calculations to prevent rate limiting

## 🚀 Tech Stack

- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: Vanilla JS with i18n support
- **Process Manager**: PM2 for production
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (Certbot)

## 📁 Project Structure

```
├── frontend/               # Frontend files
│   ├── public/
│   │   ├── js/            # JavaScript modules
│   │   ├── css/           # Stylesheets
│   │   └── images/        # Static images
│   ├── *.html             # HTML pages
│   └── admin-*.html       # Admin panels
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Database seeding (7 blocks, 15 categories)
│   └── migrations/        # Migration history
├── src/
│   ├── controllers/       # Business logic
│   ├── routes/           # API routes
│   ├── middleware/       # Auth, rate limiting, error handling
│   ├── utils/            # Utilities, validators
│   └── types/            # TypeScript types
├── index.js              # Main server file
├── ecosystem.config.js   # PM2 configuration
├── update.sh             # Auto-update script for production
└── DEPLOYMENT_GUIDE.md   # Full deployment instructions
```

## 🔧 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
# Generate Prisma Client
npx prisma generate

# Apply schema
npx prisma db push

# Seed initial data (7 blocks, 15 categories, currencies)
npx prisma db seed
```

### 3. Configure Environment
Create `.env` file:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/bunyod_tour"
JWT_SECRET="your_secret_key_min_32_chars"
NODE_ENV=development
PORT=5000
```

### 4. Run Development Server
```bash
node index.js
```

Visit: `http://localhost:5000`

## 🌐 API Endpoints

### Tours
- `GET /api/tours` - Get all tours (with lang=ru/en)
- `GET /api/tours/:id` - Get single tour
- `POST /api/tours` - Create tour (Admin)
- `PUT /api/tours/:id` - Update tour (Admin)
- `DELETE /api/tours/:id` - Delete tour (Admin)

### Categories & Blocks
- `GET /api/categories` - Get 15 tourism categories
- `GET /api/tour-blocks` - Get 7 tour blocks
- `GET /api/tour-blocks/:id/tours` - Get tours by block

### Booking
- `POST /api/bookings` - Create booking
- `GET /api/orders/:id` - Get order details
- `POST /api/payments/stripe` - Stripe checkout
- `POST /api/payments/payler` - Payler payment
- `POST /api/webhooks/stripe` - Stripe webhook

### Admin
- `POST /api/auth/login` - Admin login
- `GET /api/guides` - Tour guides
- `GET /api/drivers` - Drivers

## 🚀 Production Deployment

### Quick Deploy to External Server

1. **Update GitHub** (in Replit Shell):
```bash
rm -f .git/index.lock
git add .
git commit -m "Production ready"
git push origin main
```

2. **Update Production Server**:
```bash
cd /var/www/bunyod-tour
./update.sh
```

See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for full instructions.

### Quick Deploy Instructions
See **[QUICK_DEPLOY_INSTRUCTIONS.md](QUICK_DEPLOY_INSTRUCTIONS.md)** for step-by-step guide.

## 📦 Database Schema

### Key Models
- **Tours**: Multilingual tours with component pricing
- **TourBlocks**: 7 iron-concrete blocks (Popular, Combined, + 5 countries)
- **Categories**: 15 specialized tourism categories (RU/EN only)
- **TourGuideProfile**: Guide profiles and reviews
- **DriverProfile**: Driver profiles and vehicles
- **Countries**: 5 Central Asian countries
- **Cities**: 12 cities across the region
- **ExchangeRates**: 5 currencies (TJS, USD, EUR, RUB, CNY)

### Tour Blocks (Iron-Concrete Structure)
1. Popular Tours (Популярные туры)
2. Combined Tours (Комбинированные туры)
3. Tajikistan Tours (Туры по Таджикистану)
4. Uzbekistan Tours (Туры по Узбекистану)
5. Kazakhstan Tours (Туры по Казахстану)
6. Turkmenistan Tours (Туры по Туркменистану)
7. Kyrgyzstan Tours (Туры по Кыргызстану)

### 15 Tourism Categories
One-day, Multi-day, Excursion, City, Nature/Eco, Cultural & Educational, Historical, Hiking/Trekking, Mountain Landscapes, Lake Landscapes, Adventure, Gastronomic, Car/Safari/Jeep, Agrotourism, VIP

## 🛡️ Security Features

- **Rate Limiting**: 15 attempts per 15 minutes for authentication
- **XSS Protection**: Sanitization middleware for all inputs
- **JWT Authentication**: Secure token-based auth with mandatory secret
- **HTTPS**: SSL/TLS encryption via Let's Encrypt
- **HMAC Validation**: Payment webhook signature verification

## 🔄 Recent Updates (Oct 10, 2025)

- ✅ Exactly 7 tour blocks enforced (removed 4 legacy blocks)
- ✅ Tajik language completely removed (RU/EN only)
- ✅ Tour block filter fully functional on search page
- ✅ Clickable breadcrumb navigation with filter presets
- ✅ Tour program display without fallback content
- ✅ TJS currency displays only "с." symbol
- ✅ Database clean: 15 categories, 7 blocks, no demo tours

## 📊 Monitoring & Logs

### PM2 Commands
```bash
pm2 status              # Process status
pm2 logs                # View logs
pm2 monit              # Real-time monitoring
pm2 restart all        # Restart application
```

### Nginx Logs
```bash
tail -f /var/log/nginx/bunyod-tour-access.log
tail -f /var/log/nginx/bunyod-tour-error.log
```

## 🔐 Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT (min 32 chars)

Optional:
- `STRIPE_SECRET_KEY` - Stripe API key
- `PAYLER_MERCHANT_KEY` - Payler merchant key
- `PAYLER_PASSWORD` - Payler password
- `ALIF_MERCHANT_KEY` - AlifPay merchant key
- `ALIF_MERCHANT_PASSWORD` - AlifPay password
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` - Email configuration

## 📝 License

Proprietary - © 2025 Bunyod-Tour

## 📞 Support

For deployment issues, see troubleshooting section in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

---

**🎉 Platform is production-ready and deployed!**
