# Bunyod-Tour Backend API

## Overview
Bunyod-Tour is a comprehensive tourism booking platform for Central Asia, offering tour, hotel, and guide booking, secure payments, and administrative management. The platform aims to provide a seamless user experience and efficient tools for administrators, supporting multilingual content and diverse payment methods. The project seeks to modernize and streamline regional tourism services, tapping into significant market potential.

## Recent Changes
### October 28, 2025 - Payment Gateway Fixes & Admin Panel Data Display
- **AlifPay Callback Fixed**: Added support for 'ok' status in Alif webhook handler - successful payments now correctly save to database
- **Payler Transaction ID**: Enhanced Payler callback to save transaction_id/session_id for admin panel display
- **Admin Panel Data Loading Fixed**: Corrected JSON.parse() issue in frontend - admin panel now properly displays orders from database
- **Safe Data Handling**: Implemented smart detection for tourists field (handles both array and string formats)
- **Complete Payment Flow**: Both Alif and Payler payments now:
  - Save order data with payment status
  - Store transaction IDs
  - Display in admin panel Bookings section
  - Send email confirmations to customers
  - Notify administrators

### October 28, 2025 - Email Notification System & Admin Panel Payment Info
- **SMTP Email System Configured**: Integrated Yandex SMTP (smtp.yandex.ru:465) with credentials from legacy website (ramaz.nur@yandex.ru)
- **Payment Confirmation Emails**: Automated email notifications sent after successful payments via Payler/Alif webhooks
- **Email Template Enhanced**: Professional voucher-style tickets with complete tour details (itinerary, hotel, guide, company contacts)
- **Admin Panel Payment Tracking**: Added payment information display in orders table:
  - Payment method column with color-coded badges (Payler 🧡, Alif 💚, Stripe 💜, PayMe 💙, Click 🩵)
  - Payment status column (paid, unpaid, pending, refunded, failed)
  - Transaction ID visible in order details modal
- **Webhook Handlers Updated**: Both Payler and Alif callbacks now load complete order data (customer, tour, hotel, guide) for email generation
- **Environment Variables**: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL configured in .env

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Improve existing files rather than creating new ones. User prefers enhancement of existing admin-dashboard.html over creation of separate admin panels.
Frontend structure alignment: Admin panel must perfectly match the frontend homepage structure with exact block names and tour organization as shown in provided screenshots.
System integration preference: User requires simplified and unified pricing systems with single source of truth. Eliminated complex manual categorization in favor of automatic detection.
Pricing logic: All tour types (including "Групповой общий") use the same per-person multiplication when priceType is "за человека".

**CRITICAL WORK RULE**: Before starting any task, conduct thorough research of all related code, structure, dependencies, and potential impacts. Nothing should be broken or damaged. Work must be performed with utmost professionalism and responsibility. Quality is paramount.

## System Architecture

### Backend
The backend utilizes **Express.js and TypeScript** with a **modular architecture** following an **MVC pattern**. It supports full CRUD operations, multilingual content (Russian, English), and robust JWT authentication for Admin, Tour Guide, and Driver roles.

### Database
**PostgreSQL with Prisma ORM** is used for data management. The schema includes entities like **Tours**, **Categories**, **TourBlocks**, **TourCategoryAssignment**, **TourGuideProfile**, **DriverProfile**, **Countries**, **Cities**, and **CityCardPhoto**. The system features automatic database initialization, schema application, data seeding for reference data, and a smart category migration system for a standardized 15-category structure. Tours now support **multiple categories** and **multiple countries/cities** through junction tables.

### Key Features
-   **Full CRUD Operations**: Implemented for all major entities.
-   **Multilingual Support**: JSON-based content for Russian and English.
-   **Component-based Tour Pricing**: Dynamic pricing with inline editing, automatic category detection, and profit margin calculation.
-   **Booking & Order System**: Seamless flow from draft bookings to payment-ready orders, including a 3-step localized booking process with unified state management. Smart booking flow skips hotel selection if not applicable. Multi-hotel selection is fully supported across all 3 booking steps.
-   **Payment Integration**: Multiple gateway integrations with full webhook support.
-   **Management Systems**: Comprehensive systems for Tour Guides, Drivers, Countries, and Cities.
-   **Currency System**: Supports TJS, USD, EUR, RUB, CNY with real-time conversion and admin management.
-   **API Design**: RESTful endpoints with standardized responses and robust language parameter handling.
-   **Security Hardening**: Implemented rate limiting, XSS protection, and JWT_SECRET environment validation.
-   **Tour Itinerary Enhancement**: Supports custom day titles in Russian and English with structured activities.
-   **Advanced Search Page System**: Rebuilt `tours-search.html` with dynamic filtering by country, city, type, category, price range, and full translation support.
-   **Booking Page Enhancements**: Comprehensive localization, dynamic hotel data localization, accurate total price calculation, and graceful error handling. Hotel room pricing is based on nights (days - 1).
-   **Banner & City Images System**: Separated systems for banner slider management, city reference data, and city card images. Multilingual banner slider support.
-   **Tour Share Functionality**: Share button on tour pages with copy link and native Web Share API options.
-   **Homepage Filtering**: Enhanced city filtering to display all cities independently of country selection, and seamless integration of homepage filters to the search page. Removed non-functional elements from search page.
-   **Smart Autocomplete Search**: Real-time search suggestions across 6 entity types (tours, hotels, countries, cities, categories, tour types) with multilingual support (Russian/English). Features intelligent navigation routing - direct links for specific entities (tours/hotels) and filtered search page for categories/locations. Supports proper Cyrillic URL encoding with 300ms debounce for optimal performance.

### UI/UX
-   **Admin Dashboard**: Comprehensive management for all core entities, including booking table with guide assignment and tour status. Smart hotel filtering in tour modal with city-based grouping.
-   **Responsive Design**: Mobile-first approach.
-   **Enhanced Selectors**: Language and currency selectors feature modern glassmorphism design.
-   **Toggle Filter System**: Modern filter for tours by country, city, type, category, and tour blocks (renamed to "НАПРАВЛЕНИЯ").
-   **Category System**: 15 specific tourism categories and 7 frontend-aligned tour blocks.
-   **Design**: Consistent color palette, Inter font family, unified component structures, gray button theme, and glassmorphism effects.
-   **UI Improvements**: Fixed pickup location icon, participant count display, tour page display adjustments, and booking page layout. Replaced standard alerts with modal notifications. Tour cards show compact country display, SVG icons, and primary category with a tooltip for multiple categories. Tour card display is unified across homepage and search page. Booking Step 1 Hotel Card Redesign with vertical layout, image slider, and Google Maps integration.
-   **Price Calculator Components**: Complete 26-component system across 7 categories with auto-seeding and bilingual names.
-   **Multiple Category Selection**: Admin panel supports selecting multiple categories for each tour.

### Production Deployment Infrastructure
-   **TypeScript Compilation Strategy**: Production uses pre-compiled JavaScript from `./dist/`.
-   **Deployment System**: Automated via `./update.sh` script, uses PM2 for process management, Nginx as a reverse proxy, and a `GET /healthz` endpoint for monitoring.
-   **Migration Strategy**: Two-tier system for database changes:
    -   **Manual Migrations**: Stored in `manual_migrations/` directory for complex schema changes (e.g., TEXT to JSONB conversions). Automatically executed by `update.sh` before Prisma migrations.
    -   **Prisma Migrations**: Standard migrations via `prisma migrate deploy` for routine schema updates.
-   **Multilingual Data Architecture**: Uses PostgreSQL JSONB fields with `{ru: "text", en: "text"}` structure for all multilingual content (slides, tour data, etc.). Controllers guarantee both language keys exist to prevent API errors.
-   **Rate Limiting Security**: All rate limiters configured with `validate: {trustProxy: false}` to work properly behind Nginx reverse proxy in production.

## External Dependencies

### Core Framework Dependencies
-   **Express.js**: Web application framework.
-   **Prisma Client**: Database ORM.
-   **CORS**: Cross-origin resource sharing.
-   **Nodemailer**: Email sending.

### Payment Gateways
-   **AlifPay**: Fully configured with merchant credentials (Key: 152065). Uses HMAC-SHA256 signature validation.
-   **Payler**: Full integration with comprehensive API support for Tajikistan market. Features:
    -   **StartSession API**: Creates payment sessions with email support, return URLs (success/decline), and TJS currency (amounts in dиrams - minimum units).
    -   **GetStatus API**: Retrieves current payment status. Statuses: `Charged` (success), `Refunded` (returned), `Authorized` (blocked), `Rejected` (failed).
    -   **Callback/Webhook Handler**: Processes POST callbacks from Payler (IP: 178.20.235.180). Callback sends only `order_id`, status is retrieved via GetStatus API. Returns HTTP 200 to confirm receipt.
    -   **Refund API**: Supports full and partial refunds for `Charged` payments. Requires `PAYLER_PASSWORD` for authentication.
    -   **Environment Variables**: Requires `PAYLER_KEY` (merchant identifier) and `PAYLER_PASSWORD` (for operations like refunds).
    -   **API Endpoints**:
        -   `POST /api/payments/payler/create` - Create payment session
        -   `POST /api/payments/payler/callback` - Handle Payler webhooks
        -   `POST /api/payments/payler/refund` - Process refunds

### Development Tools
-   **TypeScript**: Static type checking.
-   **Flatpickr**: Calendar widget for date filtering.

### Database
-   **PostgreSQL**: Relational database.