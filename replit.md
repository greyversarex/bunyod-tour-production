# Bunyod-Tour Backend API

## Overview
Bunyod-Tour is a comprehensive tourism booking platform for Central Asia, offering tour, hotel, and guide booking, secure payments, and administrative management. The platform aims for a seamless user experience, efficient administration, multilingual content, and diverse payment methods. Key capabilities include a guide review system, interactive tour maps, a flexible multi-tier deposit system, and a system for custom tour orders. The project seeks to modernize regional tourism and capitalize on significant market potential.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Improve existing files rather than creating new ones. User prefers enhancement of existing admin-dashboard.html over creation of separate admin panels.
Frontend structure alignment: Admin panel must perfectly match the frontend homepage structure with exact block names and tour organization as shown in provided screenshots.
System integration preference: User requires simplified and unified pricing systems with single source of truth. Eliminated complex manual categorization in favor of automatic detection.
Pricing logic: All tour types (including "Групповой общий") use the same per-person multiplication when priceType is "за человека".

CRITICAL WORK RULE: Before starting any task, conduct thorough research of all related code, structure, dependencies, and potential impacts. Nothing should be broken or damaged. Work must be performed with utmost professionalism and responsibility. Quality is paramount.

## System Architecture

### UI/UX Decisions
The platform uses a consistent design with a strict gray color palette, Inter font family, and unified component structures, incorporating glassmorphism effects. All buttons use `#3E3E3E` and hover states use `#2F2F2F`. Blue colors and any colors outside the approved gray palette are forbidden. The admin panel structure is designed to perfectly match the frontend homepage. Language and currency selectors feature a glassmorphism design. Tour cards are compact with SVG icons and primary category tooltips. Booking Step 1 Hotel Card has a vertical layout with an image slider and Google Maps integration.

### Technical Implementations
The backend uses Express.js with TypeScript and a modular MVC architecture, supporting full CRUD operations and multilingual content. PostgreSQL with Prisma ORM is used for data management. Key features include component-based tour pricing with automatic category detection and profit margin calculation, a 3-step localized booking process with unified state management and multi-hotel selection, and per-city room capacity validation for multi-city tours. It includes comprehensive management systems for Tour Guides, Drivers, Countries, and Cities. A flexible currency system supports TJS, USD, EUR, RUB, CNY with real-time conversion. The API is RESTful with standardized responses and language parameter handling. Security is hardened with rate limiting and XSS protection.

Specific features include enhanced tour itineraries with custom day titles, an advanced search page with dynamic filtering, and booking page enhancements for localization and accurate total price calculation. There are separate systems for banner slider management, city reference data, and city card images. A smart autocomplete search provides real-time suggestions across multiple entity types. An email notification system sends automated voucher-style tickets. A full guide review system is implemented. Custom Tour Orders allow users to create personalized tour requests.

### System Design Choices
The architecture emphasizes production safety with a robust deployment process using `./update.sh` script, PM2, and Nginx. Database migrations are handled by a two-tier system: manual SQL migrations for complex schema changes (with idempotency and fail-fast mechanisms) and Prisma `db push` for routine synchronization. Multilingual data uses PostgreSQL JSONB fields with `{ru: "text", en: "text"}` structure. Rate limiters are configured for Nginx compatibility, and a single PrismaClient singleton instance prevents connection pool overflow. The system uses a specific 15-category structure for tours, with 7 frontend-aligned tour blocks, and supports multiple categories, countries, and cities per tour. Tour itinerary supports custom day titles and structured activities. Hotel room pricing is based on nights (days - 1).

## External Dependencies

### Core Framework Dependencies
-   **Express.js**: Web application framework.
-   **Prisma Client**: Database ORM.
-   **CORS**: Cross-origin resource sharing.
-   **Nodemailer**: Email sending (configured with Yandex SMTP).

### Payment Gateways
-   **AlifPay**: Fully configured with merchant credentials, HMAC-SHA256 signature validation, and webhook support.
-   **Payler**: Full integration with comprehensive API support for Tajikistan market, including `StartSession`, `GetStatus`, `Callback/Webhook Handler`, and `Refund` APIs.

### Development Tools
-   **TypeScript**: Static type checking.
-   **Flatpickr**: Calendar widget for date filtering.

### Database
-   **PostgreSQL**: Relational database.