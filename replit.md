# Bunyod-Tour - Туристическая платформа для Центральной Азии

## Overview

Bunyod-Tour is a comprehensive tour booking platform designed for Central Asia (Tajikistan, Uzbekistan, Kazakhstan, Turkmenistan, Kyrgyzstan). Its primary purpose is to simplify the booking of tours, hotels, and guides, offering secure multi-payment options, multilingual support (Russian/English), a robust administrative panel, a user review system, and flexible component-based pricing. The platform aims to become the leading, most reliable, and user-friendly solution for the region's tourism sector, benefiting both travelers and service providers.

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

## System Architecture

The Bunyod-Tour platform uses a modular MVC architecture. The backend is built with Express.js and TypeScript, while the frontend uses Vanilla JavaScript with Tailwind CSS. PostgreSQL, managed by Prisma ORM, serves as the database.

**UI/UX Decisions:**
-   **Color Palette**: Strict gray (`#3E3E3E`, `#2F2F2F`), avoiding blue or other colors.
-   **Font**: Inter.
-   **Effects**: Glassmorphism.
-   **Layout**: A unified, dynamically loaded header and footer across all pages.

**Technical Implementations:**
-   **Multilingualism**: Content is stored in PostgreSQL JSONB, with API language selection (`?lang=ru/en`) and frontend i18n.
-   **Currency System**: Supports TJS (base), USD, EUR, RUB, CNY with real-time conversion. Exchange rates are stored as "how much foreign currency per 1 TJS", and conversion uses multiplication (`convertedPrice = priceInTJS * rate.rate`). All relevant files use consistent fallback rates.
-   **Tour Structure**: Features 7 fixed tour blocks and 15 predefined tour categories.
-   **Booking Process**: A 3-step flow with real-time price calculation.
-   **Component-based Pricing**: Flexible system allowing tours to define prices based on components with profit margins.
-   **Admin Panel**: Comprehensive dashboard for managing all platform entities.
-   **Authentication**: JWT for administrators; separate dashboards for guides and drivers.
-   **Security**: Includes rate limiting, XSS protection, CORS, and environment variable validation.
-   **File Upload System**: Persistent storage outside the application directory, symlinked for access, restricted to image files.
-   **Email Notification System**: Utilizes SendGrid API for transactional emails, with multilingual support, branded templates (company logo), and robust error handling. This includes booking confirmations, payment confirmations, admin notifications, guide welcome emails, travel agent approvals, tour completion notifications, and specific emails for Guide Hire, Transfer, and Custom Tour payments.
-   **Vehicle Management System**: Public catalog with city filtering, glassmorphism cards, and multilingual support.
-   **Promotions/Discounts System**: Tour-level discounts with `isPromotion` and `discountPercent` fields, automatic price calculation, badge display, and dedicated "Aktsii" page.
-   **Order Details Modal Windows**: Type-specific modals in the admin panel for Guide Hire, Transfer, Custom Tour, and Regular Tour orders, displaying relevant details, client info, and payment info.
-   **Payler Integration Hardening**: Includes idempotency protection, IP security checks, retry logic for API calls, a `PaymentRefundLog` model for audit trails, and asynchronous email sending.
-   **Payment Validation Parity**: Unified validation for transfer payments across Payler and Alif, ensuring transfer request existence, price consistency, and valid status. Enhanced logging and order type detection for improved user feedback on BT-prefixed orders.

**System Design Choices:**
-   **Database Models**: Key entities include Tours, Hotels, Guides, Drivers, Bookings, Orders, ExchangeRates, B2B Travel Agents, Transfer Requests, and Guide Hire Requests.
-   **B2B Travel Agent Partnership System**: Public application, admin approval, agent personal cabinet with token verification and auto-logout, and full agent deletion functionality via atomic transactions.
-   **Transfer Payment Integration**: Extends booking architecture for approved transfer requests, reusing payment gateways; requires `estimatedPrice` for direct payment.
-   **Guide Hire Payment Integration**: Direct payment model for guide services with atomic transactions for date reservation, server-side pricing validation, `SELECT FOR UPDATE` locking for security, and options for guide deactivation or permanent deletion. Includes a "Hires" tab in the guide cabinet for viewing requests and an admin function to resend guide credentials.
-   **Custom Tour Direct Payment Integration**: Direct payment for custom tour orders using atomic Prisma transactions for order creation, server-side price validation, defensive JSON parsing, specific order number formatting, payment gateway revalidation, idempotent webhooks, and email confirmations.
-   **Backend Structure**: Organized into `config`, `controllers`, `routes`, `middleware`, `models`, `services`, `utils`, and `types`.
-   **Frontend Structure**: `public` directory for static assets, HTML templates, and modular JavaScript files.
-   **Deployment**: Automated `update.sh` script for database backup, `git pull`, `npm install`, Prisma migrations, seeding, and PM2 restart. Nginx is used for reverse proxy, SSL, security, and rate limiting.
-   **Monitoring**: Utilizes PM2 and Nginx logging, with a `/healthz` endpoint.
-   **Database Migration**: Manual SQL and Prisma migrations with idempotent seeding.

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