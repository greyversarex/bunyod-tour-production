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
-   **Email Notification System**: Uses Nodemailer for transactional emails (booking confirmations, payment confirmations with PDF tickets, admin notifications, cancellations).
-   **Vehicle Management System**: Public catalog with city filtering, glassmorphism cards, and multilingual support.

**System Design Choices:**
-   **Database Models**: Key entities include Tours, Hotels, Guides, Drivers, Bookings, Orders, ExchangeRates, and dedicated models for B2B Travel Agents, Transfer Requests, and Guide Hire Requests.
-   **B2B Travel Agent Partnership System**: Public application form, admin approval workflow, agent personal cabinet for booking requests, secure document storage, and dedicated API routes.
-   **Transfer Payment Integration**: Extends existing booking architecture to allow payment for approved/confirmed transfer requests with assigned drivers; reuses payment gateways.
-   **Guide Hire Payment Integration**: Direct payment model for guide services; tourist pays immediately without admin approval. Features atomic transactions for date reservation, server-side pricing validation, and robust security against double-booking and tampering using `SELECT FOR UPDATE` row-level locking.
-   **Backend Structure**: Organized into `config`, `controllers`, `routes`, `middleware`, `models`, `services`, `utils`, and `types`.
-   **Frontend Structure**: `public` for static assets, HTML templates, and modular JavaScript files.
-   **Deployment**: Automated `update.sh` script for database backup, `git pull`, `npm install`, Prisma migrations, seeding, and PM2 restart. Nginx for reverse proxy, SSL, security, and rate limiting.
-   **Monitoring**: PM2 and Nginx logging, `/healthz` endpoint.
-   **Database Migration**: Manual SQL and Prisma migrations; idempotent seeding.

## External Dependencies

-   **Database**: PostgreSQL
-   **ORM**: Prisma
-   **Payment Gateways**: Stripe, Payler, AlifPay
-   **Email Service**: Nodemailer
-   **Runtime Environment**: Node.js
-   **Process Manager**: PM2
-   **Web Server/Reverse Proxy**: Nginx
-   **SSL Certificates**: Let's Encrypt
-   **Frontend Libraries**: Tailwind CSS, Flatpickr, Google Maps API