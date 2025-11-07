# Bunyod-Tour Backend API

## Overview
Bunyod-Tour is a comprehensive tourism booking platform for Central Asia, offering tour, hotel, and guide booking, secure payments, and administrative management. The platform aims to provide a seamless user experience and efficient tools for administrators, supporting multilingual content and diverse payment methods. The project seeks to modernize and streamline regional tourism services, tapping into significant market potential.

## Recent Updates (November 2025)
**Guide Review Collection & Admin Notifications** - Реализована полная система сбора отзывов о гидах и уведомлений для админа:
- **Кнопка "Отзыв гида"**: В кабинете гида добавлена отдельная кнопка для сбора отзывов о работе гида
- **API Endpoint**: POST /api/guide/collect-guide-reviews для email рассылки с приглашением оставить отзыв о гиде
- **Email Template**: Красивый email шаблон с градиентной кнопкой и персонализацией (имя гида)
- **Умная загрузка данных**: Модальное окно получает данные тура через API, работает независимо от открытия деталей
- **Email уведомления админу**: Автоматическая отправка email при старте тура (🚀) и завершении тура (✅) с полной информацией
- **UI раздел "События"**: Новая вкладка в админке с историей стартов и завершений туров, фильтрацией и детальной информацией
- **Интеграция с существующей системой**: Использует существующий guide-review-form.html для приема отзывов

**Guide Profile Localization Fixes** - Исправлена локализация на странице профиля гида и в админке:
- **Отображение страны и города**: Используются nameRu/nameEn поля вместо legacy multilingual JSON для корректного отображения
- **Языки гида**: Добавлен словарь переводов (Французский↔French, Немецкий↔German) для поддержки билингвальности
- **Оптимизация переключения языка**: Убран повторный API запрос при переключении языка - используются кешированные данные
- **Admin Modal Fix**: Исправлен парсинг description для корректного заполнения RU и EN textarea полей
- **Routing**: Добавлен явный роут для /guide-profile.html в index.js для правильного обслуживания страницы

## Recent Updates (November 2025)
**Interactive Tour Map with Leaflet.js** - Добавлена интерактивная карта тура с визуализацией маршрута:
- **Опциональные координаты**: В админке добавлены поля широты и долготы для каждой активности (необязательные)
- **Условная видимость**: Вкладка "Карта Тура" показывается только если хотя бы одна активность имеет координаты
- **Leaflet + OpenStreetMap**: Бесплатная карта без API ключей с полным функционалом
- **Кастомные маркеры**: Нумерованные маркеры (1, 2, 3...) для каждой точки активности
- **Polylines**: Синие линии соединяющие точки маршрута по порядку
- **Селектор дней**: Переключение между днями тура для отображения разных маршрутов
- **Multilingual support**: Полная поддержка русского и английского языков
- **Popup информация**: Клик на маркер показывает название активности и время

**Flexible Multi-Tier Deposit System** - Реализована полная система гибкой оплаты с адаптацией под тип тура:
- **Групповой общий (group_shared)**: 2 опции - Депозит 10% или Полная оплата 100%
- **Персональный и Групповой персональный (personal/group_personal)**: 3 опции - Депозит 10%, Депозит 30%, или Полная оплата 100%
- **Backend логика**: Корректный расчет 10% и 30% для депозитных платежей с округлением, сохранение `paymentOption` (deposit, deposit_30, full) в базу данных
- **Условная видимость**: Опции показываются только для туров забронированных за 30+ дней, опция 30% скрывается для групповых общих туров
- **Билет с расчетами**: Динамическое отображение суммы к оплате (10%, 30%, или 100%) и остатка с бейджами выбранной опции
- **Уведомление о наличных**: При выборе депозита (10% или 30%) появляется информационное окно о том, что остаток оплачивается наличными в первый день тура
- **Fixed Header**: Хедер всегда остается видимым при скроллинге страницы (position: fixed с автоматическим spacer)
- **Интеграция с платежными системами**: Payler и AlifPay получают корректную сумму (10%, 30%, или 100% в зависимости от выбора)
- **Переводы**: Полная поддержка русского и английского языков для всех опций

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
-   **Component-based Tour Pricing**: Dynamic pricing with inline editing, automatic category detection, and profit margin calculation. Supports hour-based durations with localization.
-   **Booking & Order System**: Seamless flow from draft bookings to payment-ready orders, including a 3-step localized booking process with unified state management. Smart booking flow skips hotel selection if not applicable. Multi-hotel selection is fully supported across all 3 booking steps.
-   **Payment Integration**: Multiple gateway integrations with full webhook support and automatic order confirmation.
-   **Management Systems**: Comprehensive systems for Tour Guides, Drivers, Countries, and Cities.
-   **Currency System**: Supports TJS, USD, EUR, RUB, CNY with real-time conversion and admin management. Dashboard revenue displays in base currency (TJS) with automatic conversion.
-   **API Design**: RESTful endpoints with standardized responses and robust language parameter handling.
-   **Security Hardening**: Implemented rate limiting, XSS protection, and JWT_SECRET environment validation.
-   **Tour Itinerary Enhancement**: Supports custom day titles in Russian and English with structured activities.
-   **Advanced Search Page System**: Rebuilt `tours-search.html` with dynamic filtering by country, city, type, category, price range, and full translation support.
-   **Booking Page Enhancements**: Comprehensive localization, dynamic hotel data localization, accurate total price calculation, and graceful error handling. Hotel room pricing is based on nights (days - 1).
-   **Banner & City Images System**: Separated systems for banner slider management, city reference data, and city card images. Multilingual banner slider support.
-   **Tour Share Functionality**: Share button on tour pages with copy link and native Web Share API options.
-   **Homepage Filtering**: Enhanced city filtering to display all cities independently of country selection, and seamless integration of homepage filters to the search page.
-   **Smart Autocomplete Search**: Real-time search suggestions across 6 entity types (tours, hotels, countries, cities, categories, tour types) with multilingual support (Russian/English). Features intelligent navigation routing and proper Cyrillic URL encoding with 300ms debounce.
-   **Email Notification System**: Automated email notifications (voucher-style tickets) after successful payments via Yandex SMTP.

### UI/UX
-   **Admin Dashboard**: Comprehensive management for all core entities, including booking table with guide assignment and tour status. Smart hotel filtering in tour modal with city-based grouping. Displays correct currency symbols and enhanced payment status badges.
-   **Responsive Design**: Mobile-first approach.
-   **Enhanced Selectors**: Language and currency selectors feature modern glassmorphism design.
-   **Toggle Filter System**: Modern filter for tours by country, city, type, category, and tour blocks (renamed to "НАПРАВЛЕНИЯ").
-   **Category System**: 15 specific tourism categories and 7 frontend-aligned tour blocks.
-   **Design**: Consistent color palette, Inter font family, unified component structures, gray button theme, and glassmorphism effects.
-   **UI Improvements**: Fixed pickup location icon, participant count display, tour page display adjustments, and booking page layout. Replaced standard alerts with modal notifications. Tour cards show compact country display, SVG icons, and primary category with a tooltip for multiple categories. Tour card display is unified across homepage and search page. Booking Step 1 Hotel Card Redesign with vertical layout, image slider, and Google Maps integration.
-   **Price Calculator Components**: 21-component system across 7 categories with auto-seeding and bilingual names.
-   **Multiple Category Selection**: Admin panel supports selecting multiple categories for each tour.

### Production Deployment Infrastructure
-   **TypeScript Compilation Strategy**: Production uses pre-compiled JavaScript from `./dist/`.
-   **Deployment System**: Automated via `./update.sh` script, uses PM2 for process management, Nginx as a reverse proxy, and a `GET /healthz` endpoint for monitoring.
-   **Migration Strategy**: Two-tier system for database changes: Manual migrations for complex schema changes and standard Prisma migrations for routine updates.
-   **Multilingual Data Architecture**: Uses PostgreSQL JSONB fields with `{ru: "text", en: "text"}` structure for all multilingual content.
-   **Rate Limiting Security**: All rate limiters configured with `validate: {trustProxy: false}` to work properly behind Nginx reverse proxy.

## External Dependencies

### Core Framework Dependencies
-   **Express.js**: Web application framework.
-   **Prisma Client**: Database ORM.
-   **CORS**: Cross-origin resource sharing.
-   **Nodemailer**: Email sending (configured with Yandex SMTP).

### Payment Gateways
-   **AlifPay**: Fully configured with merchant credentials (Key: 152065), HMAC-SHA256 signature validation, and webhook support for 'ok' status.
-   **Payler**: Full integration with comprehensive API support for Tajikistan market. Features:
    -   **StartSession API**: Creates payment sessions.
    -   **GetStatus API**: Retrieves current payment status.
    -   **Callback/Webhook Handler**: Processes POST callbacks from Payler.
    -   **Refund API**: Supports full and partial refunds.
    -   **API Endpoints**: `/api/payments/payler/create`, `/api/payments/payler/callback`, `/api/payments/payler/refund`.

### Development Tools
-   **TypeScript**: Static type checking.
-   **Flatpickr**: Calendar widget for date filtering.

### Database
-   **PostgreSQL**: Relational database.