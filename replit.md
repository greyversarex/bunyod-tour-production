# Bunyod-Tour - Туристическая платформа для Центральной Азии

## Overview

Bunyod-Tour is a comprehensive tour booking platform for Central Asia (Tajikistan, Uzbekistan, Kazakhstan, Turkmenistan, Kyrgyzstan). It simplifies tour, hotel, and guide bookings, offering secure multi-payment options, multilingual support (Russian/English), a robust administrative panel, user reviews, and flexible component-based pricing. The platform aims to be the region's leading, most reliable, and user-friendly solution for tourism, benefiting both travelers and service providers.

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

Bunyod-Tour uses a modular MVC architecture with an Express.js and TypeScript backend, and a Vanilla JavaScript with Tailwind CSS frontend. PostgreSQL, managed by Prisma ORM, is the database.

**UI/UX Decisions:**
-   **Color Palette**: Strict gray (`#3E3E3E`, `#2F2F2F`), avoiding blue.
-   **Font**: Inter.
-   **Effects**: Glassmorphism.
-   **Layout**: Unified, dynamically loaded header and footer across all pages.

**Technical Implementations:**
-   **Multilingualism**: Content in PostgreSQL JSONB, API language selection, frontend i18n.
-   **Currency System**: Supports TJS (base), USD, EUR, RUB, CNY with real-time conversion. Exchange rates are stored as "how much TJS per 1 unit of foreign currency" (e.g., 1 USD = 10.6 TJS).
-   **Tour Structure**: 7 fixed tour blocks and 15 predefined tour categories.
-   **Booking Process**: A 3-step flow with real-time price calculation.
-   **Component-based Pricing**: Flexible system for tour pricing with profit margins.
-   **Admin Panel**: Comprehensive dashboard for managing all platform entities.
-   **Authentication**: JWT for administrators; separate dashboards for guides and drivers.
-   **Security**: Rate limiting, XSS protection, CORS, environment variable validation.
-   **File Upload System**: Persistent storage outside application directory, symlinked, restricted to image files.
-   **Email Notification System**: SendGrid API for multilingual transactional emails with branded templates.
-   **Vehicle Management System**: Public catalog with city filtering, glassmorphism cards, and multilingual support.
-   **Promotions/Discounts System**: Tour-level discounts with automatic price calculation and dedicated display.
-   **Order Details Modal Windows**: Type-specific modals in admin panel for various order types.
-   **Payment Integration Hardening**: Idempotency, IP security, retry logic, refund logging, asynchronous email sending, and unified validation for transfer payments.
-   **Tour Map Improvements**: Reduced default zoom, mouse wheel zoom control.
-   **Search Page Enhancements**: Group size filter, autocomplete suggestions.
-   **Booking-Level Guide Assignment**: Guide assignment migrated from Tour to Booking level, supporting multiple bookings of the same tour with different guides and dates.
-   **Multi-Guide Booking Support**: Supports multiple guides per booking via a junction table (`BookingGuide`).
-   **Order-Booking Integration**: Linked Order and Booking tables (one-to-one) for unified tour monitoring; Booking records auto-created on payment.
-   **Guide Review Collection**: Guides can request reviews from tourists via email after tour completion.
-   **Review System**: Fixed tour page reviews, enhanced guide rating calculation, and refined review visibility flow.
-   **Tourist Email Required**: Email field made mandatory for each tourist during booking.
-   **Booking Status Auto-Update**: Payment callbacks correctly update `Booking.status` to 'paid'.
-   **PDF Ticket Email Fix**: Tour payment confirmation emails now include PDF tickets.
-   **Guide Review Link Fix**: Review collection emails now auto-select the guide in the review form.

**System Design Choices:**
-   **Database Models**: Key entities include Tours, Hotels, Guides, Drivers, Bookings, Orders, ExchangeRates, B2B Travel Agents, Transfer Requests, and Guide Hire Requests.
-   **B2B Travel Agent Partnership System**: Public application, admin approval, agent personal cabinet, and full agent deletion.
-   **Payment Integrations**: Extended booking architecture for Transfer, Guide Hire, and Custom Tour direct payments, utilizing atomic transactions, server-side price validation, and secure locking mechanisms.
-   **Backend Structure**: Organized into `config`, `controllers`, `routes`, `middleware`, `models`, `services`, `utils`, and `types`.
-   **Frontend Structure**: `public` directory for static assets, HTML templates, and modular JavaScript files.
-   **Deployment**: Automated `update.sh` script for database backup, `git pull`, `npm install`, Prisma migrations, seeding, and PM2 restart. Nginx for reverse proxy, SSL, security, and rate limiting.
-   **Monitoring**: PM2 and Nginx logging, with a `/healthz` endpoint.
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