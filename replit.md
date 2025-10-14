# Bunyod-Tour Backend API

## Overview
Bunyod-Tour is a comprehensive tourism booking platform for Central Asia, offering tour, hotel, and guide booking, secure payments, and administrative management. The platform aims to provide a seamless user experience and efficient tools for administrators, supporting multilingual content and diverse payment methods. The project seeks to modernize and streamline regional tourism services, tapping into significant market potential.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Improve existing files rather than creating new ones. User prefers enhancement of existing admin-dashboard.html over creation of separate admin panels.
Frontend structure alignment: Admin panel must perfectly match the frontend homepage structure with exact block names and tour organization as shown in provided screenshots.
System integration preference: User requires simplified and unified pricing systems with single source of truth. Eliminated complex manual categorization in favor of automatic detection.

## Recent Changes (October 2025)
- **Code Cleanup**: Removed 640+ unused files from attached_assets (screenshots, temporary HTML/PHP/text files), keeping only essential city-card-photos folder
- **Routing Optimization**: Fixed conflicting /admin routes - moved tour history endpoints to `/admin/history/*` with cleaner paths (e.g., `/admin/history/tours/active`, `/admin/history/guides`)
- **Admin Dashboard**: Removed non-functional Chart.js graphs, streamlined statistics to show only paid orders and hotel count
- **Console Logs**: Retained debug console.log statements per architectural review - useful for development troubleshooting

## System Architecture

### Backend
The backend utilizes **Express.js and TypeScript** with a **modular architecture** following an **MVC pattern**. It supports full CRUD operations, multilingual content (Russian, English), and robust JWT authentication for Admin, Tour Guide, and Driver roles. The backend correctly handles Prisma relations and ensures robust API endpoints with clean routing structure - admin routes properly separated (`/admin/*` for general admin, `/admin/history/*` for tour history).

### Database
**PostgreSQL with Prisma ORM** is used for data management. The schema includes entities like **Tours**, **Categories**, **TourBlocks**, **TourCategoryAssignment** (many-to-many junction table for tour categories), **TourGuideProfile**, **DriverProfile**, **Countries**, **Cities**, and **CityCardPhoto** (independent photo system for city cards). The system features automatic database initialization, schema application, data seeding for reference data (15 categories, 7 blocks, 5 currencies, 5 countries, 12 cities), and a smart category migration system for a standardized 15-category structure. Tours now support multiple categories through the TourCategoryAssignment junction table with primary category designation, while maintaining backward compatibility with the legacy single category field. Seeding is idempotent and safe to run multiple times, creating only reference data and never demo tours, test bookings, or fake users. Category names are consistent (singular in Russian, plural in English).

### Key Features
-   **Full CRUD Operations**: Implemented for all major entities.
-   **Multilingual Support**: JSON-based content for Russian and English, with dynamic content updates and a unified language system.
-   **Component-based Tour Pricing**: Dynamic pricing with inline editing and automatic category detection.
-   **Booking & Order System**: Seamless flow from draft bookings to payment-ready orders, including a 3-step localized booking process with unified state management and debounced price recalculations. **All booking methods** (`startBooking`, `calculatePrice`, `updateBookingDetails`) now correctly handle both simple `{ HB: 30 }` and full `{ HB: { selected: true, price: 30 } }` mealSelection/roomSelection formats, retrieve stored selections from database when not provided in request, and preserve hotel/meal selections across step transitions without data loss. This ensures consistent price calculations across all three booking steps, eliminating meal cost omissions.
-   **Payment Integration**: Multiple gateway integrations with full webhook support (Payler, AlifPay, Stripe). Includes payment failure handling and retry logic.
-   **Management Systems**: Comprehensive systems for Tour Guides, Drivers, Countries, and Cities, including profiles, reviews, and vehicle management.
-   **Admin Panel Modules**: Fully implemented "Drivers", "Trips", and "Transfers" sections with CRUD functionality.
-   **Currency System**: Supports TJS, USD, EUR, RUB, CNY with real-time conversion and admin management.
-   **API Design**: RESTful endpoints with standardized responses and robust language parameter handling.
-   **Security Hardening**: Implemented rate limiting, XSS protection, and mandatory JWT_SECRET environment validation. Restricted `/uploads` access with granular middleware: `/uploads/guides` and `/uploads/slides` allow only image files (.jpg, .jpeg, .png, .webp, .gif), blocking documents and other file types for security.
-   **Tour Itinerary Enhancement**: Supports custom day titles in Russian and English with structured activities.
-   **Advanced Search Page System**: Rebuilt `tours-search.html` with dynamic filtering, component integration, and dual search capabilities for tours and hotels.
-   **Booking Page Enhancements**: Comprehensive localization, dynamic hotel data localization, accurate total price calculation including meal costs, and graceful error handling. Includes detailed price breakdown and correct accommodation logic.
-   **Banner & City Images System**: Completely separated systems - banner slider management (`/api/slides` with full CRUD in admin panel), city reference data (`/api/cities`), and city card images (`/api/city-card-photos` with dedicated controller and multer upload), ensuring clean architecture and independent management. Banner system supports multilingual titles/descriptions/buttons, image uploads, ordering, and activation toggles. Secure static routes implemented for `/uploads/slides` (images only) with proper Express middleware restrictions.

### UI/UX
-   **Admin Dashboard**: Comprehensive management for all core entities, including enhanced booking table with guide assignment and tour status. Draft functionality fully operational for tours, hotels, and guides with proper `isDraft/isActive` handling. Banner management (Слайдер) allows adding/editing homepage hero slides with multilingual content and image uploads.
-   **Responsive Design**: Mobile-first approach with comprehensive touch target optimization (44x44px minimum for all interactive elements).
-   **Mobile Footer**: Optimized with collapsible accordion sections (Company, Contacts), always-visible social links with proper touch targets, and desktop-only map display.
-   **Enhanced Selectors**: Language and currency selectors feature modern glassmorphism design with gradient backgrounds, backdrop-filter blur effects, smooth shadows, and hover transitions for premium UX.
-   **Toggle Filter System**: Modern filter for tours by country, city, type, category, and tour blocks (renamed to "НАПРАВЛЕНИЯ").
-   **Category System**: 15 specific tourism categories and a frontend-aligned tour block system (7 blocks: Popular, Combined, + 5 Central Asian countries).
-   **Tour Block Filter**: Fully functional filter on search page that loads blocks from API, renders checkboxes, and filters tours by their block assignments.
-   **Design**: Consistent color palette, Inter font family, unified component structures, gray button theme, and glassmorphism effects for modern visual appeal.
-   **Guide Dashboard Tour Program**: Redesigned itinerary display to match tour page format.

### Production Deployment Infrastructure
-   **TypeScript Compilation Strategy**: Production uses pre-compiled JavaScript from `./dist/` (requires `npm run build`), while development uses `ts-node`.
-   **Deployment System**: Automated via `./update.sh` script, uses PM2 for process management (2 instances, cluster mode), Nginx as a reverse proxy, and a `GET /healthz` endpoint for monitoring.
-   **Optional Startup Controls**: `NODE_ENV`, `RUN_MIGRATIONS_ON_BOOT`, `RUN_SEED_ON_BOOT`, `CORS_ORIGINS`.

## External Dependencies

### Core Framework Dependencies
-   **Express.js**: Web application framework.
-   **Prisma Client**: Database ORM.
-   **CORS**: Cross-origin resource sharing.
-   **Nodemailer**: Email sending.

### Payment Gateways
-   **AlifPay Legacy** (POST form to https://web.alif.tj/) - Fully configured with merchant credentials from original PHP site. Uses HMAC-SHA256 token generation matching legacy implementation.
-   **Payler API** - StartSession/Pay flow with production credentials (key: 1a92a7df-45d3-4fe7-8149-2fd0c7e8d366). Uses secure.payler.com endpoints.
-   **Stripe API** - Payment Intents integration (requires STRIPE_SECRET_KEY configuration)

### Development Tools
-   **TypeScript**: Static type checking.

### Database
-   **PostgreSQL**: Relational database.