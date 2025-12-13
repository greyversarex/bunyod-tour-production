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
-   **Currency System**: Supports TJS (base), USD, EUR, RUB, CNY with real-time conversion.
    - **UNIFIED FORMAT (Dec 06, 2025)**: Exchange rates stored as "how much TJS per 1 unit of foreign currency" (e.g., USD: 10.6 means 1 USD = 10.6 TJS)
    - **Conversion formula**: `convertedPrice = priceInTJS / rate.rate` (DIVISION)
    - **All files unified**: home-page.js, search-page.js, tour-template.html, booking-step1/2/3.html, hot-tours.js, exchangeRateController.ts
    - **API endpoint**: `/api/exchange-rates/map` returns rates in correct format
    - **Fallback rates**: All files use consistent fallback values (USD: 10.6, EUR: 11.6, RUB: 0.11, CNY: 1.5)
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
-   **Tour Map Improvements** (Dec 07, 2025): Reduced default zoom level for better overview, enabled mouse wheel scrolling for zoom control.
-   **Search Page Enhancements** (Dec 07, 2025): Added group size filter (min/max people), added autocomplete suggestions matching homepage functionality.
-   **Booking-Level Guide Assignment** (Dec 08, 2025): Migrated guide assignment from Tour (template) to Booking (instance) level to support multiple bookings of the same tour with different guides and dates.
    - **Booking model fields**: `assignedGuideId`, `guideAssignedAt`, `executionStatus` (pending/in_progress/completed)
    - **Admin endpoints**: `/api/admin/history/bookings/paid`, `/api/admin/history/bookings/assign-guide`, `/api/admin/history/bookings/:id/execution-status`
    - **Guide cabinet endpoints**: `/api/guide/bookings` (get assigned bookings), `/api/guide/bookings/status` (update execution status)
    - **Admin dashboard**: Dual-tab interface (Tours legacy / Bookings new) in Monitoring section
    - **Guide dashboard**: Displays assigned bookings with status controls, falls back to legacy tours if no bookings
    - **Email notifications**: Guide receives email when assigned to booking with tour details, date, tourist count
-   **Multi-Guide Booking Support** (Dec 11, 2025): Extended booking system to support multiple guides per booking
    - **BookingGuide junction table**: Many-to-many relationship between Booking and Guide
    - **BookingGuide fields**: `bookingId`, `guideId`, `role` (main/additional), `assignedAt`, `isActive`
    - **New admin endpoints**: `/api/admin/history/bookings/add-guide`, `/api/admin/history/bookings/remove-guide`, `/api/admin/history/bookings/:bookingId/guides`
    - **Backward compatibility**: `assignedGuideId` still maintained for primary guide (single guide mode still works)
    - **Admin dashboard UI**: Booking details modal shows all assigned guides with add/remove buttons
-   **Order-Booking Integration** (Dec 10, 2025): Linked Order and Booking tables for unified tour monitoring
    - **Booking.orderId**: Foreign key linking Booking to Order (one-to-one relationship)
    - **Auto-creation on payment**: Booking records are automatically created when Order is paid (Payler/Alif)
    - **Backfill script**: `scripts/backfillBookingsFromOrders.ts` migrates existing paid Orders to Bookings
    - **Monitoring displays**: Order number, customer info from Order.customer in monitoring table
    - **Run after deploy**: `npx ts-node scripts/backfillBookingsFromOrders.ts` to create Bookings for existing paid Orders
-   **Guide Review Collection** (Dec 11, 2025): Guides can request reviews from tourists after tour completion
    - **Guide cabinet button**: "Собрать отзывы" button appears for finished/completed tours
    - **API endpoint**: `POST /api/guide/tours/:id/collect-reviews` sends review request emails
    - **Auto-fetch tourists**: If no tourists specified, automatically fetches from booking.contactEmail and Order.customer
    - **SendGrid integration**: Uses branded email template with review link
-   **Review System Fixes** (Dec 12, 2025): Fixed tour page reviews and guide rating calculation
    - **Tour page reviews**: Fixed to use numeric `tourData.id` instead of URL slug for API calls
    - **Guide rating aggregation**: `getGuideReviewStats` now combines ratings from GuideReview AND Review.guideRating tables with weighted average
    - **Guide profile simplification**: Removed "Ratings" breakdown section, shows only star rating with count
    - **Tour rating stars removed**: Removed tour star rating display from tour page and leave-review form (per user request)
    - **Review visibility flow**: Admin approves → showOnHomepage=true for homepage; isModerated+isApproved for tour page display
-   **Tourist Email Required** (Dec 12, 2025): Made tourist email mandatory for review collection
    - **Booking step 2**: Email field now required for each tourist (marked with * and `required` attribute)
    - **Form validation**: Added email format validation (pattern check) before form submission
    - **Review emails**: All tourists with valid emails will receive review request emails after tour completion
-   **Booking Status Auto-Update** (Dec 12, 2025): Fixed paid orders not appearing in Tour Monitoring
    - **Root cause**: Payment callbacks (Payler/Alif) were not updating Booking.status to 'paid'
    - **Fix in callbacks**: Now directly finds existing Booking (by orderId or matching data) and sets status='paid'
    - **Backfill script**: `scripts/backfillBookingsFromOrders.ts` updated to fix existing data
    - **Auto-run**: Script now runs automatically in `update.sh` during deployment
    - **Monitoring works**: Paid bookings now appear in admin "Мониторинг туров" section for guide assignment
-   **PDF Ticket Email Fix** (Dec 13, 2025): Fixed tour payment confirmation emails not including PDF ticket
    - **Root cause**: Booking include didn't load tour relation, causing tourData to be null
    - **Fix**: Changed `booking: true` to `booking: { include: { tour: true, hotel: true } }` in Payler/Alif callbacks
    - **Fallback chain**: Now checks order.tour → order.booking.tour → explicit query (3 levels)
    - **Files updated**: paylerController.ts, alifController.ts
    - **Result**: Paid tour bookings now receive email with full PDF ticket attached

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