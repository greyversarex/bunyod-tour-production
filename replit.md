# Bunyod-Tour Backend API

## Overview
Bunyod-Tour is a comprehensive tourism booking platform for Central Asia. It offers tour, hotel, and guide booking, secure payments, and administrative management. The platform aims for a seamless user experience, efficient administration, multilingual content, and diverse payment methods, seeking to modernize regional tourism and capitalize on significant market potential. Key capabilities include a guide review system, interactive tour maps, and a flexible multi-tier deposit system.

## Recent Updates (November 2025)

**Guide Modal Unification (November 8, 2025)** - Объединены модальные окна создания и редактирования гида:
- **Проблема**: Дублирование кода - существовали раздельные функции `openGuideModal()` для создания и `editGuide()` для редактирования с полным набором вспомогательных функций с префиксом "Edit"
- **Решение**: Создана универсальная функция `openGuideModal(guideId = null)` по аналогии с `openTourModal()`, которая автоматически определяет режим работы (создание/редактирование) на основе наличия параметра `guideId`
- **Удалено**: 756 строк дублирующегося кода, включая `openEditGuideModal()`, `saveEditGuide()`, `loadEditGuideCountries()`, `loadEditGuideCitiesByCountry()`, и все вспомогательные функции с префиксом "Edit"
- **Добавлено**: 190 строк унифицированного кода
- **Чистая экономия**: 566 строк кода (74% сокращение дублирования)
- **Улучшения**:
  - Динамическое изменение заголовка модального окна: "Добавить гида" vs "Редактировать гида"
  - Динамическая кнопка отправки: "Опубликовать" vs "Сохранить изменения"
  - Функция `saveGuide()` автоматически выбирает метод HTTP: POST для создания, PUT для редактирования
  - Добавлен отсутствующий блок "💰 Ценообразование для найма" (pricePerDay, currency, isHireable) в режим редактирования
  - Кнопка редактирования в таблице админ-панели обновлена: теперь вызывает `openGuideModal(id)` вместо `editGuide(id)`
- **Результат**: ✅ Консистентный UX, единая точка правды, легче поддерживать и расширять функциональность
- **Тестирование**: ✅ Сервер стабильно работает, логи чистые, нет ошибок PostgreSQL или JavaScript

**PostgreSQL Connection Pool Optimization** - Исправлена критическая проблема с переполнением пула соединений:
- **Проблема**: В коде создавалось 12 отдельных экземпляров `PrismaClient()`, каждый открывал свой пул соединений
- **Ошибка**: "terminating connection due to administrator command" (код E57P01) при перезапуске workflow
- **Решение**: Все файлы переведены на использование единого синглтона из `src/config/database.ts`
- **Исправленные файлы**: 10 файлов (middleware, routes, controllers, utils)
- **Результат**: ✅ Стабильная работа без ошибок PostgreSQL, оптимальное использование ресурсов БД
- **Безопасность**: Изменения затрагивают только способ подключения, логика работы не изменена, безопасны для продакшена

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Improve existing files rather than creating new ones. User prefers enhancement of existing admin-dashboard.html over creation of separate admin panels.
Frontend structure alignment: Admin panel must perfectly match the frontend homepage structure with exact block names and tour organization as shown in provided screenshots.
System integration preference: User requires simplified and unified pricing systems with single source of truth. Eliminated complex manual categorization in favor of automatic detection.
Pricing logic: All tour types (including "Групповой общий") use the same per-person multiplication when priceType is "за человека".

CRITICAL WORK RULE: Before starting any task, conduct thorough research of all related code, structure, dependencies, and potential impacts. Nothing should be broken or damaged. Work must be performed with utmost professionalism and responsibility. Quality is paramount.

## System Architecture

### Backend
The backend utilizes **Express.js and TypeScript** with a **modular MVC architecture**. It supports full CRUD operations, multilingual content (Russian, English), and robust JWT authentication for Admin, Tour Guide, and Driver roles.

### Database
**PostgreSQL with Prisma ORM** manages data, including `Tours`, `Categories`, `TourBlocks`, `TourGuideProfile`, `Countries`, and `Cities`. The system features automatic database initialization, schema application, data seeding, and a smart category migration system for a standardized 15-category structure. Tours support multiple categories and multiple countries/cities.

### Key Features
-   **Full CRUD Operations**: Implemented for all major entities.
-   **Multilingual Support**: JSON-based content for Russian and English.
-   **Component-based Tour Pricing**: Dynamic pricing with inline editing, automatic category detection, and profit margin calculation, supporting hour-based durations.
-   **Booking & Order System**: Seamless flow from draft bookings to payment-ready orders, including a 3-step localized booking process with unified state management and multi-hotel selection.
-   **Payment Integration**: Multiple gateway integrations with webhook support and automatic order confirmation.
-   **Management Systems**: Comprehensive systems for Tour Guides, Drivers, Countries, and Cities.
-   **Currency System**: Supports TJS, USD, EUR, RUB, CNY with real-time conversion and admin management.
-   **API Design**: RESTful endpoints with standardized responses and language parameter handling.
-   **Security Hardening**: Rate limiting, XSS protection, and JWT_SECRET environment validation.
-   **Tour Itinerary Enhancement**: Supports custom day titles and structured activities.
-   **Advanced Search Page System**: Dynamic filtering by country, city, type, category, price range, and full translation support.
-   **Booking Page Enhancements**: Localization, dynamic hotel data, accurate total price calculation, and error handling. Hotel room pricing is based on nights (days - 1).
-   **Banner & City Images System**: Separated systems for banner slider management, city reference data, and city card images with multilingual support.
-   **Tour Share Functionality**: Share button with copy link and native Web Share API options.
-   **Homepage Filtering**: Enhanced city filtering and seamless integration of homepage filters to the search page.
-   **Smart Autocomplete Search**: Real-time search suggestions across 6 entity types (tours, hotels, countries, cities, categories, tour types) with multilingual support and intelligent navigation routing.
-   **Email Notification System**: Automated email notifications (voucher-style tickets) after successful payments.
-   **Guide Review System**: Full system for collecting guide reviews via email invitations and admin notifications, with a dedicated "Отзыв гида" button in the guide's panel.
-   **Interactive Tour Map**: Integration of Leaflet.js and OpenStreetMap for visualizing tour routes with numbered markers, polylines, and day selectors, supporting multilingual popups.
-   **Flexible Multi-Tier Deposit System**: Adaptable payment options (10%, 30% deposit, or 100% full payment) based on tour type and booking window, with dynamic display of amounts and cash payment notifications.

### UI/UX
-   **Admin Dashboard**: Comprehensive management for core entities, including booking table with guide assignment and tour status. Features smart hotel filtering, correct currency symbols, and enhanced payment status badges.
-   **Responsive Design**: Mobile-first approach.
-   **Enhanced Selectors**: Language and currency selectors with glassmorphism design.
-   **Toggle Filter System**: Modern filter for tours by country, city, type, category, and "НАПРАВЛЕНИЯ".
-   **Category System**: 15 specific tourism categories and 7 frontend-aligned tour blocks.
-   **Design**: Consistent color palette, Inter font family, unified component structures, gray button theme, and glassmorphism effects.
-   **UI Improvements**: Fixed pickup location icon, participant count display, tour page adjustments, booking page layout, modal notifications, compact tour card display with SVG icons and primary category tooltips. Booking Step 1 Hotel Card Redesign with vertical layout, image slider, and Google Maps integration.
-   **Price Calculator Components**: 21-component system across 7 categories with auto-seeding and bilingual names.
-   **Multiple Category Selection**: Admin panel supports selecting multiple categories for each tour.

### Production Deployment Infrastructure
-   **TypeScript Compilation Strategy**: Production uses pre-compiled JavaScript from `./dist/`.
-   **Deployment System**: Automated via `./update.sh` script, uses PM2 for process management, Nginx as a reverse proxy, and a `GET /healthz` endpoint for monitoring.
-   **Migration Strategy**: Two-tier system for database changes: Manual migrations for complex schema changes and standard Prisma migrations for routine updates.
-   **Multilingual Data Architecture**: Uses PostgreSQL JSONB fields with `{ru: "text", en: "text"}` structure for all multilingual content.
-   **Rate Limiting Security**: All rate limiters configured with `validate: {trustProxy: false}` for Nginx compatibility.

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