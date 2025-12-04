# Bunyod-Tour - Туристическая платформа для Центральной Азии

## Overview

Bunyod-Tour is a comprehensive tour booking platform for Central Asia (Tajikistan, Uzbekistan, Kazakhstan, Turkmenistan, Kyrgyzstan). It facilitates booking tours, hotels, and guides with secure multi-payment, multilingual support (Russian/English), an administrative panel, a review system, and component-based pricing. The platform aims to be the leading, robust, and user-friendly solution for tourism in the region, serving both customers and service providers.

## User Preferences

-   **Язык общения**: Простой, повседневный русский язык
-   **Подход к разработке**: Улучшать существующие файлы, не создавать новые
-   **Структура frontend**: Админ панель должна идеально совпадать со структурой главной страницы
-   **Интеграция систем**: Упрощенные и унифицированные системы ценообразования с единым источником правды
-   **КРИТИЧЕСКОЕ ПРАВИЛО РАБОТЫ**:
    1.  Провести тщательное исследование всего связанного кода
    2.  Изучить структуру, зависимости и потенциальные последствия
    3.  Ничего не должно быть сломано или повреждено
    4.  Работа должна выполняться с максимальным профессионализмом и ответственностью
    5.  Качество - превыше всего

## Deployment Workflow

**Среда разработки:** Replit (development) → GitHub → Timeweb (production)

**Рабочий процесс:**
1. Разработка и улучшения выполняются на Replit
2. Код пушится в GitHub репозиторий
3. Продакшен сервер (Timeweb) обновляется через `git pull`

**Что переносится между средами:**
- ✅ Код (JavaScript, TypeScript, HTML, CSS, конфигурации)
- ✅ Prisma миграции (применяются на продакшене через update.sh)
- ❌ ENV переменные (настраиваются отдельно на каждом сервере)
- ❌ Данные базы данных (отдельная PostgreSQL БД на Timeweb)
- ❌ Загруженные файлы (хранятся локально на каждом сервере)

**Важно:** Изменения схемы БД (Prisma) переносятся через миграции, но сами данные (туры, бронирования, пользователи) остаются на соответствующих серверах.

## System Architecture

The Bunyod-Tour platform utilizes a modular MVC architecture with Express.js and TypeScript for the backend, and Vanilla JavaScript with Tailwind CSS for the frontend. PostgreSQL with Prisma ORM serves as the database.

**UI/UX Decisions:**
-   **Color Palette**: Strict gray (`#3E3E3E`, `#2F2F2F`), no blue or other colors.
-   **Font**: Inter.
-   **Effects**: Glassmorphism.
-   **Layout**: Unified, dynamically loaded header and footer across all pages.

**Technical Implementations:**
-   **Multilingualism**: Content stored in PostgreSQL JSONB (`{ru: "текст", en: "text"}`) with API `?lang=ru/en` parameter and frontend i18n.
-   **Currency System**: Supports TJS (base), USD, EUR, RUB, CNY with real-time conversion.
-   **Tour Structure**: 7 "iron-clad" tour blocks and 15 predefined tour categories.
-   **Booking Process**: A 3-step flow with real-time price calculation.
-   **Component-based Pricing**: Flexible system allowing tours to define prices based on components with profit margins.
-   **Admin Panel**: Comprehensive dashboard for managing all platform entities.
-   **Authentication**: JWT for administrators; separate dashboards for guides and drivers.
-   **Security**: Rate limiting, XSS protection, CORS, environment variable validation.
-   **File Upload System**: Persistent storage outside application directory, symlinked for access; restricted to image files only.
-   **Email Notification System**: Uses SendGrid API for transactional emails (Timeweb blocks SMTP ports):
    - **REQUIRED on Production**: Set `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` in .env
    - **Multilingual Support** (Dec 04, 2025): Email templates support Russian (ru) and English (en) based on customer's selected language; `Order.language` field stores customer preference; frontend passes `localStorage.getItem('selectedLanguage') || 'ru'` during order creation; `emailTranslations` object contains all translated strings; `getEmailTranslation(key, lang)` helper retrieves correct text
    - Booking confirmations to customers (language-aware)
    - Payment confirmations with PDF tickets (fallback: email without PDF if Puppeteer fails)
    - Admin notifications on new orders/payments (with order type: Tour/Guide Hire/Transfer/Custom Tour)
    - Guide welcome emails with login credentials (via guideController.createGuide)
    - Travel agent approval emails with login credentials (includes agentId, email, temporary password)
    - Tour completion notifications to admin
    - **Guide Hire Payment Emails**: Explicit fetch of guideHireRequest with guide details; fallback email template when guide data unavailable; GuideHireRequest.paymentStatus updated to 'paid' after successful payment
    - **Transfer Payment Emails**: Customer and admin notifications with pickup/dropoff locations, date, time, number of people; fallback template when transferRequest data unavailable
    - **Custom Tour Payment Emails**: Customer confirmation with selected countries, duration, components; admin notification with full order details (added Dec 01, 2025)
    - **Robust error handling**: Guards check customer existence before any property access; detailed logging in payment callbacks; optional chaining for all data field accesses to prevent TypeError; fallback templates for all order types
    - Updated: Dec 04, 2025
-   **Vehicle Management System**: Public catalog with city filtering, glassmorphism cards, and multilingual support.
-   **Promotions/Discounts System**: Tour-level discounts via `isPromotion` (Boolean) and `discountPercent` (Float) fields. Admin toggle in tour modal, automatic price calculation (originalPrice = price / (1 - discount/100)), badge display (-X%) on tour cards, crossed-out original price with red sale price. Aktsii page filters by `isPromotion = true`. Updated: Nov 25, 2025.
-   **Order Details Modal Windows**: Type-specific modals for each order type in admin panel:
    - **Guide Hire**: Guide card with photo, name, country/city, languages, phone/email; booked dates array; days count; price per day; total price; customer comments
    - **Transfer**: Route visualization (pickup → dropoff); date/time; passengers count; vehicle type; assigned driver with photo, phone, vehicle info; total price; special requests
    - **Custom Tour**: Start date; duration; selected countries list; tourists count; components with prices; total price; special requests; tourists list
    - **Regular Tour**: Tour name; date; tourists count; hotel; guide; total price; tourists list; **"Что включено" section** - displays tour.includes with smart parsing (JSON array, plain string, multilingual objects)
    - All modals include client info block and payment info block. Updated: Dec 04, 2025.
-   **Email Branding** (Dec 04, 2025): All email templates now include company logo in header (https://bunyodtour.tj/Logo-Ru_1754635713718.png); circular 60-70px styling; onerror fallback hides logo if loading fails.

**System Design Choices:**
-   **Database Models**: Key entities include Tours, Hotels, Guides, Drivers, Bookings, Orders, ExchangeRates, and dedicated models for B2B Travel Agents, Transfer Requests, and Guide Hire Requests.
-   **B2B Travel Agent Partnership System**: Public application form, admin approval workflow, agent personal cabinet for booking requests, secure document storage, and dedicated API routes. **Token verification on dashboard load** - validates token via API before showing content, auto-logout on 401/403 errors. **Full agent deletion** - removes agent account, all bookings, and partnership application via atomic transaction. Updated: Dec 03, 2025.
-   **Transfer Payment Integration**: Extends existing booking architecture to allow payment for approved/confirmed transfer requests with assigned drivers; reuses payment gateways. **REQUIRED**: `estimatedPrice` must be provided when creating transfer request for direct payment flow. Updated: Nov 24, 2025.
-   **Guide Hire Payment Integration**: Direct payment model for guide services; tourist pays immediately without admin approval. Features atomic transactions for date reservation, server-side pricing validation, and robust security against double-booking and tampering using `SELECT FOR UPDATE` row-level locking. **Full guide deletion** - removes guide, hire requests, reviews, and tour links via atomic transaction; option to deactivate (close cabinet access) or permanently delete. Updated: Dec 03, 2025.
-   **Guide Cabinet Hires Tab** (Dec 04, 2025): Authenticated guides can view their hire requests via `/api/guide-hire/my-hires` endpoint; tab-based interface with lazy loading; status filtering (all/pending/approved/completed); cards display customer info, dates, pricing, payment status; counter badge shows totalAll for all hires.
-   **Guide Credentials Resend** (Dec 04, 2025): Admin can resend login/password to guide via email from guide card in admin panel; generates cryptographically secure password using crypto.randomBytes (12 chars, ~71 bits entropy); updates password in DB and sends branded email with credentials; envelope button in guide card actions.
-   **Custom Tour Direct Payment Integration**: Direct payment model for custom tour orders; tourists create orders and pay immediately without admin approval. Features atomic prisma.$transaction for Order + CustomTourOrder creation (iron-clad consistency), server-side component price validation, defensive JSON parsing in webhook, orderNumber format `CT-{timestamp}-{customerId}`, payment gateway revalidation, idempotent webhook using updateMany, tourist email confirmations after payment, and admin email notifications. Updated: Nov 23, 2025.
-   **Payler Integration Hardening** (Dec 04, 2025):
    - **Idempotency Protection**: Callback handler checks if order already in final state (paid/refunded/failed) before processing; skips duplicates with `idempotent: true` response; correctly allows transitions like `processing→paid` and `partially_refunded→refunded`
    - **IP Security**: Production blocks non-Payler IPs (403 Forbidden); development logs warnings only; allowed IPs: 178.20.235.180 + localhost
    - **Retry Logic**: GetStatus API calls wrapped in `withRetry()` - 3 attempts with 500ms exponential backoff for temporary failures
    - **Refund Audit Trail**: New `PaymentRefundLog` model tracks all refund attempts (amount, reason, processedBy, status, paylerTransactionId); prevents over-refunding by aggregating only successful logs; supports partial refunds with `partially_refunded` status
    - **Async Email Sending**: `sendEmailAsync()` helper wraps email calls in `setImmediate()` to prevent blocking main flow
-   **Backend Structure**: Organized into `config`, `controllers`, `routes`, `middleware`, `models`, `services`, `utils`, and `types`.
-   **Frontend Structure**: `public` for static assets, HTML templates, and modular JavaScript files.
-   **Deployment**: Automated `update.sh` script for database backup, `git pull`, `npm install`, Prisma migrations, seeding, and PM2 restart. Nginx for reverse proxy, SSL, security, and rate limiting.
-   **Monitoring**: PM2 and Nginx logging, `/healthz` endpoint.
-   **Database Migration**: Manual SQL and Prisma migrations; idempotent seeding.

## External Dependencies

-   **Database**: PostgreSQL
-   **ORM**: Prisma
-   **Payment Gateways**: Stripe, Payler, AlifPay
-   **Email Service**: SendGrid API (@sendgrid/mail)
-   **Runtime Environment**: Node.js
-   **Process Manager**: PM2
-   **Web Server/Reverse Proxy**: Nginx
-   **SSL Certificates**: Let's Encrypt
-   **Frontend Libraries**: Tailwind CSS, Flatpickr, Google Maps API