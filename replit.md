# Bunyod-Tour Backend API

## Overview
Bunyod-Tour is a comprehensive tourism booking platform for Central Asia, offering tour, hotel, and guide booking, secure payments, and administrative management. The platform aims to provide a seamless user experience and efficient tools for administrators, supporting multilingual content and diverse payment methods. The project seeks to modernize and streamline regional tourism services, tapping into significant market potential.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Improve existing files rather than creating new ones. User prefers enhancement of existing admin-dashboard.html over creation of separate admin panels.
Frontend structure alignment: Admin panel must perfectly match the frontend homepage structure with exact block names and tour organization as shown in provided screenshots.
System integration preference: User requires simplified and unified pricing systems with single source of truth. Eliminated complex manual categorization in favor of automatic detection.

## System Architecture

### Backend
The backend utilizes **Express.js and TypeScript** with a **modular architecture** following an **MVC pattern**. It supports full CRUD operations, multilingual content (Russian, English), and robust JWT authentication for Admin, Tour Guide, and Driver roles.

### Database
**PostgreSQL with Prisma ORM** is used for data management. The schema includes entities like **Tours**, **Categories**, **TourBlocks**, **TourGuideProfile**, **DriverProfile**, **Countries**, and **Cities**. The system features automatic database initialization, schema application, data seeding, and a smart category migration system for a standardized 15-category structure. **Seed Script Critical Update (Oct 10, 2025)**: Fixed seed.ts to properly create ALL required data - admin user, 5 currencies, countries, cities, **15 tourism categories** (was only 4), and **6 tour blocks** (was missing completely). Seed is now idempotent and updates existing records on rerun. No demo tours created to prevent fake data in production.

### Key Features
-   **Full CRUD Operations**: Implemented for all major entities.
-   **Multilingual Support**: JSON-based content for Russian and English, with dynamic content updates and a unified language system.
-   **Component-based Tour Pricing**: Dynamic pricing with inline editing and automatic category detection.
-   **Booking & Order System**: Seamless flow from draft bookings to payment-ready orders, including a 3-step localized booking process with unified state management and debounced price recalculations to prevent rate limiting.
-   **Payment Integration**: Multiple gateway integrations with full webhook support. **Active gateways (Oct 9, 2025)**: Payler (Russia/CIS) and AlifPay (Tajikistan) with HMAC-SHA256 signature validation, automatic order status updates, and email confirmations. Stripe backend fully implemented with Payment Intents and webhooks. **Payment flow improvements (Oct 9, 2025)**: Created payment-fail.html for error handling; migrated completedOrder storage from localStorage to sessionStorage for session isolation; implemented retry logic with bookingId persistence for seamless recovery after failed payments; removed non-integrated payment methods (Binance, Корти Милли) from UI to show only functional options.
-   **Management Systems**: Comprehensive systems for Tour Guides, Drivers, Countries, and Cities, including profiles, reviews, and vehicle management.
-   **Admin Panel Modules**: Fully implemented "Drivers", "Trips", and "Transfers" sections with CRUD functionality.
-   **Currency System**: Supports TJS, USD, EUR, RUB, CNY with real-time conversion and admin management. **Currency Update Fix (Oct 10, 2025)**: Fixed admin panel currency save button - replaced undefined `showSuccessMessage()` with `showNotification()` to eliminate false error messages; unified all notification handlers across exchange rate CRUD operations (create, update, delete, calculate).
-   **API Design**: RESTful endpoints with standardized responses and robust language parameter handling.
-   **Security Hardening**: Implemented rate limiting, XSS protection, and mandatory JWT_SECRET environment validation.
-   **Tour Itinerary Enhancement**: Restructured tour program system to support custom day titles in Russian and English with object structure `{titleRu, titleEn, activities[]}`.
-   **Advanced Search Page System**: Rebuilt `tours-search.html` with dynamic filtering, component integration, and dual search capabilities for tours and hotels.
-   **Booking Page Enhancements**: Comprehensive localization for all elements, dynamic hotel data localization, color scheme adherence (gray #6B7280), accurate total price calculation including meal costs, and graceful handling of rate-limiting errors with a new notification system. Includes detailed price breakdown with accommodation deduction across all booking steps. **October 2025 fixes**: Eliminated premature accommodation deduction (now triggers only when rooms are selected), cleaned Tour Details display (removed duplication and "Rooms and Meals" section for clarity), added meal selection toggle functionality, unified all price displays to single sidebar element (#sidebar-total-amount), and ensured correct accommodation logic (base 800 TJS is for entire tour, not per-day). **Multilingual Hotel Data (Oct 9, 2025)**: Fixed room and meal type display bugs where names showed as "[object Object]" due to new bilingual structure {ru: '...', en: '...'}; updated admin-dashboard.html to save room/meal types with dual-language names; refactored booking-step1.html, booking-step2.html, and booking-step3.html to use getLocalizedName() for proper localization; eliminated JavaScript errors in price calculations (roomNameRaw.startsWith failures); ensured backward compatibility with legacy string-format data. **Booking Steps 2-3 Critical Fixes (Oct 9, 2025)**: Resolved redirect loop by migrating all booking steps from localStorage to sessionStorage via bookingStateManager for unified state management; fixed "[object Object]" display on step 2 sidebar using getLocalizedName() function; implemented conditional price multiplication (totals × tourists count) for non-group tours only (excludes "Групповой общий" type); established bookingStateManager as single source of truth with Object.assign in-place updates and persist() calls to maintain sessionStorage sync across all booking steps; eliminated dual-storage conflicts that prevented step 3 data access; step 3 now properly initializes bookingStateManager before accessing state.

### UI/UX
-   **Admin Dashboard**: Comprehensive management for all core entities, including enhanced booking table with guide assignment and tour status.
-   **Responsive Design**: Mobile-first approach.
-   **Toggle Filter System**: Modern filter for tours by country, city, type, and category.
-   **Category System**: 15 specific tourism categories and a frontend-aligned tour block system (6 blocks).
-   **Design**: Consistent color palette, Inter font family, unified component structures, and gray button theme.
-   **Guide Dashboard Tour Program**: Redesigned itinerary display to match tour page format with accordions for multi-day tours, time indicators, and numbered events.

## External Dependencies

### Core Framework Dependencies
-   **Express.js**: Web application framework.
-   **Prisma Client**: Database ORM.
-   **CORS**: Cross-origin resource sharing.
-   **Nodemailer**: Email sending.

### Payment Gateways
-   **AlifPay API v2**
-   **Stripe API**
-   **Payme API**
-   **Click API**
-   **PayPal API**

### Development Tools
-   **TypeScript**: Static type checking.

### Database
-   **PostgreSQL**: Relational database.