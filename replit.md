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
The backend utilizes **Express.js and TypeScript** with a **modular architecture** following an **MVC pattern**. It supports full CRUD operations, multilingual content (Russian, English), and robust JWT authentication for Admin, Tour Guide, and Driver roles. The backend correctly handles Prisma relations and ensures robust API endpoints with clean routing structure.

### Database
**PostgreSQL with Prisma ORM** is used for data management. The schema includes entities like **Tours**, **Categories**, **TourBlocks**, **TourCategoryAssignment**, **TourGuideProfile**, **DriverProfile**, **Countries**, **Cities**, and **CityCardPhoto**. The system features automatic database initialization, schema application, data seeding for reference data, and a smart category migration system for a standardized 15-category structure. Tours now support **multiple categories** through the TourCategoryAssignment junction table with primary category designation (first selected category is primary), while maintaining backward compatibility with single categoryId field. Multiple countries and cities are also fully supported through TourCountry and TourCity junction tables. Seeding is idempotent and safe to run multiple times, creating only reference data and never demo tours, test bookings, or fake users.

### Key Features
-   **Full CRUD Operations**: Implemented for all major entities.
-   **Multilingual Support**: JSON-based content for Russian and English, with dynamic content updates and a unified language system.
-   **Component-based Tour Pricing**: Dynamic pricing with inline editing and automatic category detection.
-   **Booking & Order System**: Seamless flow from draft bookings to payment-ready orders, including a 3-step localized booking process with unified state management and debounced price recalculations. All booking methods correctly handle various selection formats, retrieve stored selections, and preserve hotel/meal selections across step transitions without data loss. Implemented smart booking flow that skips hotel selection step when a tour has no attached hotels, redirecting directly to the tourist information step. Booking validation ensures all selected tourists are added before proceeding.
-   **Payment Integration**: Multiple gateway integrations with full webhook support (Payler, AlifPay, Stripe). Includes payment failure handling and retry logic.
-   **Management Systems**: Comprehensive systems for Tour Guides, Drivers, Countries, and Cities, including profiles, reviews, and vehicle management. Admin panel includes "Drivers", "Trips", and "Transfers" sections with CRUD functionality.
-   **Currency System**: Supports TJS, USD, EUR, RUB, CNY with real-time conversion and admin management. Admin can edit the base currency symbol.
-   **API Design**: RESTful endpoints with standardized responses and robust language parameter handling.
-   **Security Hardening**: Implemented rate limiting, XSS protection, and mandatory JWT_SECRET environment validation. Restricted `/uploads` access with granular middleware for specific file types.
-   **Tour Itinerary Enhancement**: Supports custom day titles in Russian and English with structured activities. Tour program display includes 2-line truncation for event descriptions with a "Подробнее/Show less" toggle and accordion behavior.
-   **Advanced Search Page System**: Rebuilt `tours-search.html` with dynamic filtering, component integration, and dual search capabilities for tours and hotels.
-   **Booking Page Enhancements**: Comprehensive localization, dynamic hotel data localization, accurate total price calculation including meal costs, and graceful error handling. Includes detailed price breakdown and correct accommodation logic. Implemented instant currency switching on booking pages without page refresh.
-   **Banner & City Images System**: Completely separated systems - banner slider management (`/api/slides`), city reference data (`/api/cities`), and city card images (`/api/city-card-photos`), ensuring clean architecture and independent management. Banner system supports multilingual content, image uploads, ordering, and activation toggles.
-   **Tour Share Functionality**: Implemented share button on tour pages with copy link to clipboard and native Web Share API options, using modern UI notifications.

### UI/UX
-   **Admin Dashboard**: Comprehensive management for all core entities, including enhanced booking table with guide assignment and tour status. Draft functionality operational for tours, hotels, and guides. Banner management allows adding/editing homepage hero slides.
-   **Responsive Design**: Mobile-first approach with comprehensive touch target optimization.
-   **Mobile Footer**: Optimized with collapsible accordion sections and always-visible social links.
-   **Enhanced Selectors**: Language and currency selectors feature modern glassmorphism design.
-   **Toggle Filter System**: Modern filter for tours by country, city, type, category, and tour blocks (renamed to "НАПРАВЛЕНИЯ").
-   **Category System**: 15 specific tourism categories and a frontend-aligned tour block system (7 blocks: Popular, Combined, + 5 Central Asian countries).
-   **Tour Block Filter**: Fully functional filter on search page that loads blocks from API and filters tours.
-   **Design**: Consistent color palette, Inter font family, unified component structures, gray button theme, and glassmorphism effects.
-   **Guide Dashboard Tour Program**: Redesigned itinerary display to match tour page format.
-   **UI Improvements**: Fixed pickup location icon, participant count display logic, tour page display (removed label prefix, renamed "Что включено/Что не включено", changed TJS currency symbol), and tour type translations. Booking page layout adjusted for better readability. Replaced standard browser alerts with centered modal notifications. **Compact Location Display**: Tour cards show only countries (no cities), all countries displayed without truncation. **Icon System**: Tour cards use SVG icons instead of emoji - geolocation pin for countries, single person icon for Персональный tour type, group icon for other types, and category-specific icons (city buildings, nature leaf/moon, cultural book, hiking marker, mountains, adventure lightning, food cart, car, calendar, plant sprout for agrotourism, etc.). **Multiple Categories Display**: When a tour has multiple categories, the card shows the primary category with ellipsis (...) that reveals all categories in a tooltip on hover. **Unified Tour Cards**: Tour card display is now identical between homepage (`home-page.js`) and search page (`search-page.js`), using the same SVG icon functions, multiple category support, and country-only location display.
-   **Price Calculator Components**: Complete 26-component system across 7 categories (Accommodation, Guides, Local_transport, Meals, Permits, Tour_transport, Transfer) with auto-seeding and bilingual names.
-   **Multiple Category Selection**: Admin panel supports selecting multiple categories for each tour, with automatic primary category designation and junction table management through TourCategoryAssignment.

### Production Deployment Infrastructure
-   **TypeScript Compilation Strategy**: Production uses pre-compiled JavaScript from `./dist/`, while development uses `ts-node`.
-   **Deployment System**: Automated via `./update.sh` script, uses PM2 for process management (2 instances, cluster mode), Nginx as a reverse proxy, and a `GET /healthz` endpoint for monitoring.
-   **Optional Startup Controls**: `NODE_ENV`, `RUN_MIGRATIONS_ON_BOOT`, `RUN_SEED_ON_BOOT`, `CORS_ORIGINS`.

## External Dependencies

### Core Framework Dependencies
-   **Express.js**: Web application framework.
-   **Prisma Client**: Database ORM.
-   **CORS**: Cross-origin resource sharing.
-   **Nodemailer**: Email sending.

### Payment Gateways
-   **AlifPay Legacy**: Fully configured with merchant credentials.
-   **Payler API**: StartSession/Pay flow with production credentials.
-   **Stripe API**: Payment Intents integration.

### Development Tools
-   **TypeScript**: Static type checking.

### Database
-   **PostgreSQL**: Relational database.