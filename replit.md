# Bunyod-Tour Backend API

## Overview
Bunyod-Tour is a comprehensive tourism booking platform for Central Asia, offering tour, hotel, and guide booking, secure payments, and administrative management. The platform aims to provide a seamless user experience and efficient tools for administrators, supporting multilingual content and diverse payment methods. The project seeks to modernize and streamline regional tourism services, tapping into significant market potential.

## Recent Changes (October 24, 2025)
-   **Search Page URL Initialization Fix**: Fixed search page not displaying tours when navigating from city cards with URL parameters (e.g., `?cityId=11`). Added `searchTours()` and `searchHotels()` calls after applying URL filters in initialization. Previously, filters were applied but search was not triggered, causing empty results despite correct filter state.
-   **Tour Blocks API Integration Fix**: Fixed tour blocks filtering on search page by adding `tourBlockAssignments` to `TourModel.search()` include statement in `src/models/index.ts`. Previously, API was not returning tour block assignment data, causing all tours to be filtered out when tour blocks filter was applied. Now API returns complete assignment records with `tourBlockId` field, enabling proper client-side filtering.
-   **Tour Blocks Filter Fix**: Fixed empty "НАПРАВЛЕНИЯ" (Directions) filter on search page by correcting title field parsing in `renderTourBlocksFilter()`. Function now properly extracts tour block names from `title.ru`/`title.en` JSON fields instead of non-existent `nameRu`/`nameEn` fields.
-   **City Card Photo System Fix**: Corrected all cityId mappings in `frontend/index.html` to match database IDs. Fixed Almaty photo display issue (was showing on wrong card due to ID mismatch).
-   **Search Page URL Filter Enhancement**: Fixed cityId URL parameter handling to apply filters to both top selector and sidebar checkboxes for proper city-based tour filtering.
-   **Tour Type Translation**: Added missing `tour_type.group_private` translation key to prevent display of raw enum values on booking pages.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Improve existing files rather than creating new ones. User prefers enhancement of existing admin-dashboard.html over creation of separate admin panels.
Frontend structure alignment: Admin panel must perfectly match the frontend homepage structure with exact block names and tour organization as shown in provided screenshots.
System integration preference: User requires simplified and unified pricing systems with single source of truth. Eliminated complex manual categorization in favor of automatic detection.
Pricing logic: All tour types (including "Групповой общий") use the same per-person multiplication when priceType is "за человека".

## System Architecture

### Backend
The backend utilizes **Express.js and TypeScript** with a **modular architecture** following an **MVC pattern**. It supports full CRUD operations, multilingual content (Russian, English), and robust JWT authentication for Admin, Tour Guide, and Driver roles.

### Database
**PostgreSQL with Prisma ORM** is used for data management. The schema includes entities like **Tours**, **Categories**, **TourBlocks**, **TourCategoryAssignment**, **TourGuideProfile**, **DriverProfile**, **Countries**, **Cities**, and **CityCardPhoto**. The system features automatic database initialization, schema application, data seeding for reference data, and a smart category migration system for a standardized 15-category structure. Tours now support **multiple categories** and **multiple countries/cities** through junction tables.

### Key Features
-   **Full CRUD Operations**: Implemented for all major entities with robust enum value normalization.
-   **Multilingual Support**: JSON-based content for Russian and English.
-   **Component-based Tour Pricing**: Dynamic pricing with inline editing, automatic category detection, and profit margin calculation. Profit margin percentage input is included in the admin panel, calculating `Components Sum` → `Profit Margin` → `Final Tour Price`.
-   **Booking & Order System**: Seamless flow from draft bookings to payment-ready orders, including a 3-step localized booking process with unified state management. Smart booking flow skips hotel selection if not applicable. Step 1 features a "Continue" button that appears only when rooms are selected, with green highlighting for selected room counters.
-   **Payment Integration**: Multiple gateway integrations with full webhook support.
-   **Management Systems**: Comprehensive systems for Tour Guides, Drivers, Countries, and Cities, including profiles, reviews, and vehicle management.
-   **Currency System**: Supports TJS, USD, EUR, RUB, CNY with real-time conversion and admin management.
-   **API Design**: RESTful endpoints with standardized responses and robust language parameter handling.
-   **Security Hardening**: Implemented rate limiting, XSS protection, and JWT_SECRET environment validation.
-   **Tour Itinerary Enhancement**: Supports custom day titles in Russian and English with structured activities and dynamic display.
-   **Advanced Search Page System**: Rebuilt `tours-search.html` with dynamic filtering by country, city, type, category, price range, and full translation support.
-   **Booking Page Enhancements**: Comprehensive localization, dynamic hotel data localization, accurate total price calculation including meal costs, and graceful error handling. Hotel room pricing is based on nights (days - 1). Multi-hotel selection is fully supported across all 3 booking steps - step 1 displays all selected hotels in sidebar with room counters, step 2 shows detailed hotel info and pricing breakdown for each hotel, step 3 (tour voucher) lists all hotels with selected rooms and amenities. The accommodation deduction logic correctly handles `tour.services` as both object and string formats.
-   **Banner & City Images System**: Separated systems for banner slider management, city reference data, and city card images.
-   **Tour Share Functionality**: Share button on tour pages with copy link and native Web Share API options.

### UI/UX
-   **Admin Dashboard**: Comprehensive management for all core entities, including booking table with guide assignment and tour status. Banner management is integrated. Smart hotel filtering in tour modal - displays only hotels from selected cities with automatic list updates when cities change. Tours table correctly displays duration type ("часов" or "дней") based on durationType field. Tour title and category extracted correctly from localized objects. Tour type normalization handles all case variants and synonyms.
-   **Responsive Design**: Mobile-first approach.
-   **Enhanced Selectors**: Language and currency selectors feature modern glassmorphism design.
-   **Toggle Filter System**: Modern filter for tours by country, city, type, category, and tour blocks (renamed to "НАПРАВЛЕНИЯ").
-   **Category System**: 15 specific tourism categories and 7 frontend-aligned tour blocks (Popular, Combined, + 5 Central Asian countries).
-   **Design**: Consistent color palette, Inter font family, unified component structures, gray button theme, and glassmorphism effects.
-   **UI Improvements**: Fixed pickup location icon, participant count display, tour page display adjustments, and booking page layout. Replaced standard alerts with modal notifications. Tour cards show compact country display, SVG icons, and primary category with a tooltip for multiple categories. Tour card display is unified across homepage and search page, including dynamic button text and correct priceType enum display.
-   **Price Calculator Components**: Complete 26-component system across 7 categories with auto-seeding and bilingual names.
-   **Multiple Category Selection**: Admin panel supports selecting multiple categories for each tour.

### Production Deployment Infrastructure
-   **TypeScript Compilation Strategy**: Production uses pre-compiled JavaScript from `./dist/`.
-   **Deployment System**: Automated via `./update.sh` script, uses PM2 for process management, Nginx as a reverse proxy, and a `GET /healthz` endpoint for monitoring.

## External Dependencies

### Core Framework Dependencies
-   **Express.js**: Web application framework.
-   **Prisma Client**: Database ORM.
-   **CORS**: Cross-origin resource sharing.
-   **Nodemailer**: Email sending.

### Payment Gateways
-   **AlifPay Legacy**: Fully configured.
-   **Payler API**: StartSession/Pay flow.
-   **Stripe API**: Payment Intents integration.

### Development Tools
-   **TypeScript**: Static type checking.

### Database
-   **PostgreSQL**: Relational database.