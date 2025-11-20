# Bunyod-Tour - Туристическая платформа для Центральной Азии

## Overview

Bunyod-Tour is a comprehensive tour booking platform designed for Central Asia (Tajikistan, Uzbekistan, Kazakhstan, Turkmenistan, Kyrgyzstan). Its primary purpose is to facilitate the booking of tours, hotels, and guides, offering secure multi-payment system integration, multilingual support (Russian/English), an administrative panel for content management, a review system for tours and guides, and a component-based pricing system. The platform aims to be the leading solution for tourism in the region, providing a robust and user-friendly experience for both customers and service providers.

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

The Bunyod-Tour platform is built with a modular MVC architecture using Express.js and TypeScript for the backend, and Vanilla JavaScript with Tailwind CSS for the frontend. PostgreSQL with Prisma ORM serves as the database.

**UI/UX Decisions:**
-   **Color Palette**: Strict gray (`#3E3E3E`, `#2F2F2F`). Blue colors and any colors outside the approved gray palette are strictly forbidden.
-   **Font**: Inter.
-   **Effects**: Glassmorphism.
-   **Layout**: A unified header and footer are dynamically loaded across all pages to ensure consistency and ease of updates.

**Technical Implementations:**
-   **Multilingualism**: Content is stored in PostgreSQL JSONB fields with a `{ru: "текст", en: "text"}` structure, with API support for `?lang=ru/en` parameter. Frontend handles automatic language switching via an i18n system.
-   **Currency System**: Supports TJS (base), USD, EUR, RUB, CNY with real-time conversion based on database-stored rates. TJS displays with "с.", others with symbol + code.
-   **Tour Structure**: Features 7 "iron-clad" tour blocks (Popular, Combined, Tajikistan, Uzbekistan, Kazakhstan, Turkmenistan, Kyrgyzstan Tours) and 15 predefined tour categories.
-   **Booking Process**: A 3-step booking flow (start, update details, complete) with real-time price calculation.
-   **Component-based Pricing**: A flexible system allowing tours to define prices based on predefined components (e.g., accommodation, guide, meals) with a profit margin.
-   **Admin Panel**: A comprehensive dashboard for managing all platform entities (tours, hotels, guides, bookings, orders, reviews, content, etc.).
-   **Authentication**: JWT for administrators and separate authentication for guides and drivers to access their personal dashboards.
-   **Security**: Implements rate limiting, XSS protection, CORS configuration, and robust environment variable validation.

**System Design Choices:**
-   **Database Models**: Key entities include Tours, Hotels, Guides, Drivers, Bookings, Orders, PriceCalculatorComponents, CustomTourOrders, Countries, Cities, Reviews, ExchangeRates, Slides, News, TravelAgentApplication, TravelAgent, and AgentTourBooking. Relationships are managed through Prisma.
-   **B2B Travel Agent Partnership System** (Nov 17-20, 2025):
    -   Public application form at `/travel-agent-apply.html` for partnership requests
    -   Partnership eligibility section showcasing 8 partner types (travel bloggers, local partners, hotels, students, etc.)
    -   Fixed header visibility issue: Updated container IDs from `header-placeholder/footer-placeholder` to `header-container/footer-container`
    -   Admin workflow: Review applications → Approve/Reject → Auto-generate credentials and send email
    -   Agent personal cabinet: JWT auth (`/api/travel-agents/auth/login`), password management, tour booking requests
    -   Document storage: `/var/bunyod-tour/uploads/documents` (production) with filename sanitization
    -   Three models: TravelAgentApplication (pending/approved/rejected), TravelAgent (active/suspended), AgentTourBooking (pending/confirmed/completed/cancelled)
    -   API routes: `/api/travel-agents/*` (public, agent, admin endpoints)
    -   Security: bcrypt passwords, mustChangePassword flag, separate JWT role for agents
    -   **Agent Bookings Fix** (Nov 20, 2025):
        -   Added `tourId` field to AgentTourBooking schema with Foreign Key relationship to Tour table
        -   Fixed getMyBookings API: Returns `bookings` array (not `data`) with transformed fields
        -   Guaranteed tour.title always returns `{ru: string, en: string|null}` object format
        -   Handles both JSON and plain-string tour names with proper fallback
        -   Test credentials: Email: `Faha.H@mail.ru`, Password: `Test123!`
-   **Backend Structure**: Organized into `config`, `controllers`, `routes`, `middleware`, `models`, `services`, `utils`, and `types` directories for clear separation of concerns.
-   **Frontend Structure**: `public` for static assets, HTML templates for various pages (home, search, tour details, booking steps, admin dashboard, etc.), and modular JavaScript files for specific functionalities and i18n.
-   **File Upload System**: 
    -   **CRITICAL FIX (Nov 17, 2025)**: Resolved catastrophic issue where `git reset --hard` in deployment was deleting all uploaded images
    -   Production storage: `/var/bunyod-tour/uploads` (persistent, outside APP_DIR)
    -   Application access: `/srv/bunyod-tour/uploads` → symlink to persistent storage
    -   Git tracking: `/uploads/` excluded from git via `.gitignore`, only `.gitkeep` files tracked for structure
    -   Update script: Automatically creates/repairs symlink on every deployment
    -   Security: Only image files (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`) served via dedicated routes: `/uploads/images`, `/uploads/guides`, `/uploads/slides`
-   **Deployment**: Automated deployment script (`update.sh`) with database backup, `git pull`, `npm install`, `prisma migrate deploy`, `npm run seed`, and PM2 restart. PM2 manages process clustering and logging. Nginx serves as a reverse proxy with SSL, security headers, and rate limiting.
-   **Monitoring**: PM2 and Nginx provide logging, and a `/healthz` endpoint is available for health checks.
-   **Database Migration**: Utilizes both manual SQL migrations for complex schema changes and Prisma migrations (`prisma migrate deploy`) for regular updates. Seeding is idempotent.

-   **Vehicle Management System** (Nov 17, 2025):
    -   Public catalog at `/vehicles-catalog.html` with light theme (white background, gray accents)
    -   Smart city filtering: Cities dynamically update based on selected country
    -   Filter capabilities: Type, capacity, country, city (removed search by brand/license plate)
    -   Glassmorphism cards on white background for modern, clean aesthetic
    -   Full multilingual support with RU/EN translations
    -   Integration with transfer page showing vehicle catalog information

## External Dependencies

-   **Database**: PostgreSQL
-   **ORM**: Prisma
-   **Payment Gateways**:
    -   Stripe (for international card payments)
    -   Payler (Tajikistan-specific)
    -   AlifPay (Tajikistan-specific)
-   **Email Service**: Nodemailer (SMTP based on configuration, e.g., Yandex)
-   **Runtime Environment**: Node.js
-   **Process Manager**: PM2
-   **Web Server/Reverse Proxy**: Nginx
-   **SSL Certificates**: Let's Encrypt (managed by Certbot)
-   **Frontend Libraries**:
    -   Tailwind CSS
    -   Flatpickr (for date selection)
    -   Google Maps API (for tour maps and hotel locations)