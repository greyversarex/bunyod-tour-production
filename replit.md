# Bunyod-Tour - Туристическая платформа для Центральной Азии

## 📋 Обзор проекта

Bunyod-Tour - это комплексная платформа бронирования туров для Центральной Азии (Таджикистан, Узбекистан, Казахстан, Туркменистан, Кыргызстан) с возможностями:
- Бронирования туров, отелей и гидов
- Безопасной оплаты через множественные платежные системы
- Двуязычной поддержки (Русский/Английский)
- Административной панели для управления контентом
- Системы отзывов для туров и гидов
- Компонентной системы ценообразования

## 🔑 Ключевые особенности

### Многоязычность
- **Поддерживаемые языки**: Русский (RU), Английский (EN)
- **Хранение**: PostgreSQL JSONB поля с структурой `{ru: "текст", en: "text"}`
- **API**: Параметр `?lang=ru/en` для получения локализованного контента
- **Frontend**: Автоматическое переключение языка через i18n систему

### Система валют
- **Валюты**: TJS (Сомони), USD, EUR, RUB, CNY
- **Конвертация**: Реальное время с курсами из БД
- **Отображение**: 
  - TJS: только символ "с." без названия валюты
  - Остальные: символ + код валюты

### Туристические блоки (7 ЖЕЛЕЗОБЕТОННЫХ БЛОКОВ)
1. Популярные туры (Popular Tours)
2. Комбинированные туры (Combined Tours)
3. Туры по Таджикистану (Tours in Tajikistan)
4. Туры по Узбекистану (Tours in Uzbekistan)
5. Туры по Казахстану (Tours in Kazakhstan)
6. Туры по Туркменистану (Tours in Turkmenistan)
7. Туры по Кыргызстану (Tours in Kyrgyzstan)

**ВАЖНО**: Эти 7 блоков неизменны! Они определены в `prisma/seed.ts` и не могут быть удалены или изменены.

### Категории туров (15 типов)
1. Однодневный (Day Tours)
2. Многодневный (Multi-day Tours)
3. Экскурсия (Excursions)
4. Городской (City Tours)
5. Природа/экологический (Nature/Ecological)
6. Культурно познавательный (Cultural & Educational)
7. Исторический (Historical)
8. Походы/треккинги (Hiking/Trekking)
9. Горные ландшафты (Mountain Landscapes)
10. Озерные ландшафты (Lake Landscapes)
11. Приключенческий (Adventure)
12. Гастрономический (Gastronomic)
13. Авто/сафари/джип (Auto/Safari/Jeep)
14. Агротуризм (Agrotourism)
15. VIP (VIP)

## 🗄️ Архитектура базы данных (PostgreSQL + Prisma)

### Основные модели

#### Tours (Туры)
```typescript
- id: Int (PK)
- title: Json {ru, en}
- description: Json {ru, en}
- shortDesc: Json {ru, en}
- duration: String (например, "5 дней")
- durationDays: Int
- durationType: String ("days" / "hours")
- price: String
- currency: String (default: "TJS")
- priceType: String ("per_person" / "per_group")
- originalPrice: String (для отображения скидки)
- categoryId: Int (FK -> Categories)
- countryId, cityId: Int (FK -> Countries, Cities)
- format: String ("individual" / "group_private" / "group_shared")
- tourType: String
- mainImage: String (URL главного изображения)
- images: String (JSON массив URL)
- services: String (JSON компонентов ценообразования)
- itinerary: String (программа тура)
- itineraryEn: String (English version)
- includes/excluded: String (что входит/не входит)
- pickupInfo, pickupInfoEn: String
- languages: String (языки гидов)
- difficulty: String
- maxPeople, minPeople: Int
- rating: Float
- reviewsCount: Int
- isFeatured, isDraft, isActive: Boolean
- profitMargin: Float (процент наценки)
- pricingData: String (калькуляция цены)
- assignedGuideId: Int (FK -> Guides)
- status: String ("pending", "active", "completed")
- uniqueCode: String (уникальный код тура)
```

**Связи:**
- `TourBlockAssignment` (Many-to-Many с TourBlocks)
- `TourCategoryAssignment` (Many-to-Many с Categories)
- `TourCountry`, `TourCity` (Many-to-Many с Countries, Cities)
- `TourHotel` (Many-to-Many с Hotels)
- `TourGuide` (Many-to-Many с Guides)
- `TourDriver` (Many-to-Many с Drivers)
- `TourMapPoints` (маркеры на карте)
- `TourPricingComponent` (компоненты ценообразования)

#### Hotels (Отели)
```typescript
- id: Int (PK)
- name: Json {ru, en}
- description: Json {ru, en}
- address: Json {ru, en}
- images: String (JSON массив)
- rating: Float (1-5)
- stars: Int (1-5)
- amenities: String (JSON удобств)
- brand: String
- category: HotelCategory enum
- countryId, cityId: Int (FK)
- pension: String ("none", "BB", "HB", "FB")
- roomTypes: String (JSON типов номеров)
- mealTypes: String (JSON типов питания)
- isActive, isDraft: Boolean
```

#### Guides (Гиды)
```typescript
- id: Int (PK)
- name: Json {ru, en}
- description: Json {ru, en}
- photo: String (публичное фото)
- avatar: String
- documents: String (приватные документы)
- languages: String (владение языками)
- contact: String (email/phone)
- experience: Int (годы опыта)
- rating: Float
- countryId, cityId: Int (FK)
- passportSeries: String
- registration, residenceAddress: String
- login, password: String (для личного кабинета)
- pricePerDay: Float
- currency: String
- availableDates: String
- isHireable, isActive: Boolean
```

**Связи:**
- `GuideReview` (отзывы о гидах)
- `GuideHireRequest` (заявки на найм)
- `TourGuide` (назначение на туры)

#### Drivers (Водители)
```typescript
- id: Int (PK)
- name, description: String
- photo, avatar, documents: String
- licenseNumber, licenseCategory: String
- vehicleTypes, vehicleInfo, vehicleBrand: String
- vehicleYear: Int
- vehiclePhotos: String (JSON)
- experience: Int
- contact, login, password: String
- languages, workingAreas: String
- countryId, cityId: Int (FK)
- pricePerDay, pricePerHour: Float
- currency: String
- isActive: Boolean
```

#### Bookings (Бронирования) - 3-шаговый процесс
```typescript
- id: Int (PK)
- tourId, hotelId: Int (FK)
- tourists: String (JSON массив туристов)
- contactName, contactPhone, contactEmail: String
- tourDate: String
- numberOfTourists: Int
- numberOfNights: Int
- roomSelection: String (JSON выбранных номеров)
- mealSelection: String (JSON выбранного питания)
- cityNights: String (JSON ночей по городам)
- totalPrice: Float (итоговая цена)
- baseTotalPrice: Float (базовая цена без конвертации)
- currency, baseCurrency: String
- exchangeRate: Float
- specialRequests: String
- status: String ("draft", "pending", "confirmed")
- paymentStatus: String ("unpaid", "processing", "paid")
- createdAt, updatedAt: DateTime
```

#### Orders (Заказы)
```typescript
- id: Int (PK)
- orderNumber: String (unique, формат: ORD-YYYYMMDD-XXXX)
- customerId: Int (FK -> Customers)
- tourId, hotelId, guideId: Int (FK)
- tourDate: String
- tourists: String (JSON)
- wishes: String
- totalAmount: Float
- status: String ("pending", "confirmed", "cancelled")
- paymentStatus: String ("unpaid", "processing", "paid", "failed")
- paymentMethod: String ("stripe", "payler", "alif")
- paymentIntentId: String (ID транзакции от платежной системы)
- receiptData: String (данные чека)
- createdAt, updatedAt: DateTime
```

#### PriceCalculatorComponent (Компоненты ценообразования)
```typescript
- id: Int (PK)
- key: String (unique, например "accommodation_std")
- name: String (русское название)
- nameEn: String (English name)
- price: Float
- currency: String
- category: String ("accommodation", "guide", "meals", etc)
- isActive: Boolean
```

**Предопределенные компоненты** (инициализируются автоматически):
- Проживание: accommodation_std, accommodation_comfort, accommodation_vip
- Гиды: guide_daily, guide_vip
- Водители: driver_4wd, driver_car, driver_minibus
- Питание: meals_full_board, meals_half_board, meals_breakfast
- Билеты: entry_museum, entry_park, entry_monument
- Снаряжение: equipment_trekking, equipment_camping, equipment_climbing
- Страховка: insurance_basic, insurance_premium
- Трансфер: transfer_airport, transfer_hotel, transfer_station
- Транспорт: transport_tour_4wd, transport_tour_car, transport_tour_minibus

#### CustomTourOrders (Заказы на индивидуальные туры)
```typescript
- id: Int (PK)
- customerName, customerEmail, customerPhone: String
- selectedCountries: String (JSON массив ID стран)
- selectedCities: String (JSON массив {cityId, countryId, daysCount})
- totalDays: Int (автоматически рассчитывается)
- numberOfPeople: Int
- preferredDates: String
- specialRequests: String
- budget: String
- status: String ("pending", "processing", "confirmed", "cancelled")
- adminNotes: String
- createdAt, updatedAt: DateTime
```

#### Countries & Cities (Страны и города)
```typescript
Country:
- id: Int (PK)
- name, nameRu, nameEn: String
- code: String (unique, ISO код)
- isActive: Boolean

City:
- id: Int (PK)
- name, nameRu, nameEn: String
- countryId: Int (FK -> Countries)
- isActive: Boolean
- unique: [name, countryId]
```

**Предопределенные страны** (5):
1. Таджикистан (TJ)
2. Узбекистан (UZ)
3. Киргизстан (KG)
4. Казахстан (KZ)
5. Туркменистан (TM)

**Города** (12):
- Таджикистан: Душанбе, Худжанд, Хорог, Куляб
- Узбекистан: Ташкент, Самарканд, Бухара
- Киргизстан: Бишкек, Ош
- Казахстан: Алматы, Астана

#### Reviews (Отзывы на туры)
```typescript
- id: Int (PK)
- customerId: Int (FK -> Customers, optional)
- tourId: Int (FK -> Tours)
- reviewerName: String
- rating: Int (1-5)
- guideRating: Int (1-5, optional)
- text: String
- photos: String (JSON массив)
- isModerated, isApproved: Boolean
- createdAt, updatedAt: DateTime
```

#### GuideReviews (Отзывы на гидов)
```typescript
- id: Int (PK)
- guideId: Int (FK -> Guides)
- customerId: Int (FK -> Customers, optional)
- reviewerName: String
- rating: Int (1-5)
- text: String
- photos: String (JSON)
- isModerated, isApproved: Boolean
- createdAt, updatedAt: DateTime
```

#### Admins (Администраторы)
```typescript
- id: Int (PK)
- username: String (unique)
- email: String (unique)
- password: String (bcrypt hash)
- fullName: String
- role: String ("admin", "manager")
- isActive: Boolean
- createdAt, updatedAt: DateTime
```

**По умолчанию**: username: "admin", password из ENV (`ADMIN_DEFAULT_PASSWORD`)

#### ExchangeRates (Курсы валют)
```typescript
- id: Int (PK)
- currency: String (unique: "TJS", "USD", "EUR", "RUB", "CNY")
- rate: Float (курс к TJS)
- symbol: String (символ валюты)
- name: String (название)
- updatedAt: DateTime
```

**Базовые курсы**:
- TJS: 1.0 (базовая валюта)
- USD: 0.094
- EUR: 0.086
- RUB: 9.2
- CNY: 0.65

#### Slides (Слайды баннера)
```typescript
- id: Int (PK)
- title: Json {ru, en}
- description: Json {ru, en}
- image: String (URL)
- link: String (куда ведет слайд)
- buttonText: Json {ru, en}
- order: Int (порядок отображения)
- isActive: Boolean
- cityId: Int (FK, optional - для привязки к городу)
```

#### News (Новости)
```typescript
- id: Int (PK)
- title, content, excerpt: String
- image, images: String
- tags: String (JSON)
- isPublished, isFeatured: Boolean
- publishedAt: DateTime
- slug: String (unique)
- views: Int
- readTime: Int (минут)
```

### Вспомогательные таблицы

#### TourBlockAssignment (Назначение туров в блоки)
```typescript
- tourId, tourBlockId: Int (Composite PK)
- isPrimary: Boolean (основной блок?)
- unique: [tourId, tourBlockId]
```

#### TourCategoryAssignment (Назначение категорий турам)
```typescript
- tourId, categoryId: Int (Composite PK)
- isPrimary: Boolean
- unique: [tourId, categoryId]
```

## 🔧 Backend архитектура (Express.js + TypeScript)

### Структура проекта
```
src/
├── config/          # Конфигурация
│   ├── database.ts      # Prisma client singleton
│   ├── email.ts         # Email настройки (Nodemailer)
│   └── validateEnv.ts   # Валидация ENV переменных
│
├── controllers/     # Бизнес-логика
│   ├── tourController.ts          # CRUD туров
│   ├── bookingController.ts       # Бронирования (3 шага)
│   ├── hotelController.ts         # CRUD отелей
│   ├── guideController.ts         # CRUD гидов
│   ├── driverController.ts        # CRUD водителей
│   ├── orderController.ts         # Заказы
│   ├── reviewController.ts        # Отзывы на туры
│   ├── guideReviewController.ts   # Отзывы на гидов
│   ├── adminController.ts         # Админ панель
│   ├── paylerController.ts        # Payler платежи
│   ├── alifController.ts          # AlifPay платежи
│   ├── priceCalculatorController.ts  # Компоненты цен
│   ├── customTourController.ts    # Индивидуальные туры
│   ├── tourBlockController.ts     # Туристические блоки
│   ├── slideController.ts         # Слайдер баннера
│   ├── newsController.ts          # Новости
│   ├── exchangeRateController.ts  # Курсы валют
│   └── ...
│
├── routes/          # API маршруты
│   ├── index.ts             # Главный роутер
│   ├── tourRoutes.ts
│   ├── bookingRoutes.ts
│   ├── hotelRoutes.ts
│   ├── guideRoutes.ts
│   ├── paymentRoutes.ts
│   └── ...
│
├── middleware/      # Middleware
│   ├── auth.ts              # JWT аутентификация
│   ├── rateLimiter.ts       # Rate limiting
│   ├── errorHandler.ts      # Обработка ошибок
│   ├── tourGuideAuth.ts     # Аутентификация гидов
│   └── driverAuth.ts        # Аутентификация водителей
│
├── models/          # Prisma модели (обертки)
│   └── index.ts             # Унифицированные модели
│
├── services/        # Сервисы
│   ├── emailService.ts           # Отправка email
│   ├── paymentService.ts         # Stripe интеграция
│   ├── objectStorage.ts          # Хранение файлов
│   └── translationService.ts     # Переводы
│
├── utils/           # Утилиты
│   ├── multilingual.ts           # Многоязычность
│   ├── initializeDatabase.ts     # Инициализация БД
│   └── seedCMSData.ts           # Seed данных
│
└── types/           # TypeScript типы
    ├── index.ts
    └── booking.ts
```

### Ключевые контроллеры

#### TourController
**Основные методы:**
- `getAllTours(req, res)` - Получить все туры с фильтрацией
  - Query params: `?lang=ru/en`, `?blockId=1`, `?limit=10`
  - Возвращает локализованные туры
  
- `getTourById(req, res)` - Получить тур по ID
  - Query params: `?lang=ru/en`, `?includeRaw=true`
  - includeRaw: для админки (возвращает JSON + локализацию)
  
- `createTour(req, res)` - Создать тур
  - Нормализация priceType и tourType
  - Парсинг JSON полей (title, description, services)
  - Создание связей с блоками, категориями, странами, городами
  
- `updateTour(req, res)` - Обновить тур
  - Умное обновление связей (добавление/удаление)
  
- `deleteTour(req, res)` - Удалить тур (soft delete)

**Компонентное ценообразование:**
```javascript
// services JSON структура
{
  "services": [
    {
      "key": "accommodation_std",
      "name": "Проживание, стандарт",
      "nameEn": "Accommodation, STD",
      "price": 150,
      "quantity": 3
    },
    {
      "key": "guide_daily",
      "name": "Гид, ежедневный",
      "nameEn": "Tour Guide, Daily",
      "price": 80,
      "quantity": 5
    }
  ]
}

// Цена тура = сумма всех (price * quantity) + profitMargin%
```

#### BookingController (3-шаговое бронирование)

**Шаг 1 - Start Booking**
```javascript
POST /api/booking/start
{
  "tourId": 1,
  "hotelId": 5,
  "tourDate": "2025-12-01",
  "numberOfTourists": 2,
  "roomSelection": {...},
  "mealSelection": {...}
}

// Создает draft booking
// Возвращает: bookingId, totalPrice
```

**Шаг 2 - Update Booking Details**
```javascript
PUT /api/booking/:id
{
  "contactName": "Иван Иванов",
  "contactPhone": "+992123456789",
  "contactEmail": "ivan@example.com",
  "tourists": [
    {"fullName": "Иван Иванов", "dateOfBirth": "1990-01-01"},
    {"fullName": "Мария Иванова", "dateOfBirth": "1992-05-15"}
  ],
  "specialRequests": "Вегетарианское меню"
}

// Обновляет booking
// Пересчитывает цену если изменились roomSelection/mealSelection
```

**Шаг 3 - Complete Booking**
```javascript
POST /api/booking/:id/complete
{
  "paymentMethod": "payler" // или "stripe", "alif"
}

// Подтверждает booking (status: "confirmed")
// Создает Order
// Отправляет email подтверждение
```

**Логика ценообразования:**
```javascript
// Базовая цена тура
let totalPrice = tour.price;

// Если priceType = "per_person"
if (tour.priceType === "per_person") {
  totalPrice *= numberOfTourists;
}

// Замена проживания
if (hotelId) {
  // Вычитаем компонент проживания из тура
  const tourAccommodationPrice = extractAccommodationPrice(tour.services);
  totalPrice -= tourAccommodationPrice * numberOfTourists;
  
  // Добавляем выбранные номера отеля
  const nights = tour.durationDays - 1;
  for (const [roomType, room] of roomSelection) {
    totalPrice += room.price * room.quantity * nights;
  }
}

// Добавляем питание
if (mealSelection) {
  const nights = tour.durationDays - 1;
  for (const [mealType, meal] of mealSelection) {
    if (meal.selected) {
      totalPrice += meal.price * numberOfTourists * nights;
    }
  }
}

// Конвертация валюты
if (currency !== "TJS") {
  totalPrice = totalPrice * exchangeRate;
}
```

#### PaymentController (Платежные системы)

**Stripe Integration**
```javascript
POST /api/payments/stripe/create
{
  "orderNumber": "ORD-20251117-0001"
}

// Возвращает: clientSecret, paymentIntentId
// Frontend использует Stripe Elements для оплаты

Webhook: POST /api/payments/stripe/webhook
// Обрабатывает события от Stripe
// Обновляет статус заказа
```

**Payler Integration (Таджикистан)**
```javascript
POST /api/payments/payler/create
{
  "orderNumber": "ORD-20251117-0001"
}

// Создает session через StartSession API
// Возвращает: redirectUrl, sessionId
// Редирект на https://secure.payler.com/gapi/Pay/?session_id=XXX

Callback: POST /api/payments/payler/callback
// Обрабатывает callback от Payler
// Проверяет статус через GetStatus API
// Обновляет заказ
```

**AlifPay Integration (Таджикистан)**
```javascript
POST /api/payments/alif/create
{
  "orderNumber": "ORD-20251117-0001"
}

// Генерирует HMAC-SHA256 token
// Возвращает: formData для POST на https://web.alif.tj/

Callback: POST /api/payments/alif/callback
// Обрабатывает callback
// Валидирует HMAC подпись
// Обновляет заказ
```

### API Endpoints (полный список)

#### Tours
```
GET    /api/tours                    # Все туры
GET    /api/tours/:id                # Тур по ID
GET    /api/tours/:id/main-image     # Главное фото тура
POST   /api/tours                    # Создать тур (Admin)
PUT    /api/tours/:id                # Обновить тур (Admin)
DELETE /api/tours/:id                # Удалить тур (Admin)
```

#### Tour Blocks
```
GET    /api/tour-blocks              # Все блоки (7 блоков)
GET    /api/tour-blocks/:id          # Блок по ID
GET    /api/tour-blocks/:id/tours    # Туры в блоке
```

#### Categories
```
GET    /api/categories               # Все категории (15 типов)
GET    /api/categories/:id           # Категория по ID
```

#### Hotels
```
GET    /api/hotels                   # Все отели
GET    /api/hotels/:id               # Отель по ID
POST   /api/hotels                   # Создать отель (Admin)
PUT    /api/hotels/:id               # Обновить отель (Admin)
DELETE /api/hotels/:id               # Удалить отель (Admin)
```

#### Guides
```
GET    /api/guides                   # Все гиды
GET    /api/guides/:id               # Гид по ID
POST   /api/guides                   # Создать гида (Admin)
PUT    /api/guides/:id               # Обновить гида (Admin)
DELETE /api/guides/:id               # Удалить гида (Admin)
POST   /api/guide/login              # Логин гида
GET    /api/guide/profile            # Профиль гида (Auth)
```

#### Guide Reviews
```
GET    /api/guide-reviews            # Все отзывы гидов
GET    /api/guide-reviews/:id        # Отзыв по ID
POST   /api/guide-reviews            # Создать отзыв
PUT    /api/guide-reviews/:id        # Обновить отзыв (Admin)
DELETE /api/guide-reviews/:id        # Удалить отзыв (Admin)
```

#### Drivers
```
GET    /api/drivers                  # Все водители
GET    /api/drivers/:id              # Водитель по ID
POST   /api/drivers                  # Создать водителя (Admin)
PUT    /api/drivers/:id              # Обновить водителя (Admin)
DELETE /api/drivers/:id              # Удалить водителя (Admin)
POST   /api/drivers/login            # Логин водителя
```

#### Bookings (3-шаговое бронирование)
```
POST   /api/booking/start            # Шаг 1: Начать бронирование
PUT    /api/booking/:id              # Шаг 2: Обновить детали
POST   /api/booking/:id/complete     # Шаг 3: Завершить
POST   /api/booking/:id/calculate    # Пересчитать цену
GET    /api/booking/:id              # Получить бронирование
```

#### Orders
```
GET    /api/orders                   # Все заказы (Admin)
GET    /api/orders/:id               # Заказ по ID
POST   /api/orders                   # Создать заказ
PUT    /api/orders/:id               # Обновить заказ (Admin)
DELETE /api/orders/:id               # Удалить заказ (Admin)
```

#### Payments
```
# Stripe
POST   /api/payments/stripe/create         # Создать платеж
POST   /api/payments/stripe/webhook        # Webhook от Stripe

# Payler
POST   /api/payments/payler/create         # Создать платеж
POST   /api/payments/payler/callback       # Callback от Payler

# AlifPay
POST   /api/payments/alif/create           # Создать платеж
POST   /api/payments/alif/callback         # Callback от Alif
```

#### Price Calculator (Компоненты ценообразования)
```
GET    /api/price-calculator/components    # Все компоненты
POST   /api/price-calculator/initialize    # Инициализация компонентов
POST   /api/price-calculator/components    # Создать компонент (Admin)
PUT    /api/price-calculator/components/:id # Обновить компонент (Admin)
DELETE /api/price-calculator/components/:id # Удалить компонент (Admin)
```

#### Custom Tours
```
POST   /api/custom-tour-orders             # Создать заказ на индивидуальный тур
GET    /api/custom-tour-orders             # Все заказы (Admin)
GET    /api/custom-tour-orders/:id         # Заказ по ID
PUT    /api/custom-tour-orders/:id         # Обновить заказ (Admin)
DELETE /api/custom-tour-orders/:id         # Удалить заказ (Admin)
GET    /api/custom-tour/cities             # Города с днями для индивидуальных туров
```

#### Countries & Cities
```
GET    /api/countries                      # Все страны
GET    /api/countries/:id                  # Страна по ID
POST   /api/countries                      # Создать страну (Admin)

GET    /api/cities                         # Все города
GET    /api/cities/:id                     # Город по ID
POST   /api/cities                         # Создать город (Admin)

GET    /api/city-card-photos               # Фото карточек городов
POST   /api/city-card-photos               # Добавить фото (Admin)
```

#### Reviews
```
GET    /api/reviews                        # Все отзывы
GET    /api/reviews/:id                    # Отзыв по ID
POST   /api/reviews                        # Создать отзыв
PUT    /api/reviews/:id                    # Обновить отзыв (Admin)
DELETE /api/reviews/:id                    # Удалить отзыв (Admin)
```

#### Exchange Rates
```
GET    /api/exchange-rates                 # Все курсы валют
PUT    /api/exchange-rates/:currency       # Обновить курс (Admin)
```

#### News
```
GET    /api/news                           # Все новости
GET    /api/news/:id                       # Новость по ID
POST   /api/news                           # Создать новость (Admin)
PUT    /api/news/:id                       # Обновить новость (Admin)
DELETE /api/news/:id                       # Удалить новость (Admin)
```

#### Slides (Баннер)
```
GET    /api/slides                         # Все слайды
GET    /api/slides/:id                     # Слайд по ID
POST   /api/slides                         # Создать слайд (Admin)
PUT    /api/slides/:id                     # Обновить слайд (Admin)
DELETE /api/slides/:id                     # Удалить слайд (Admin)
```

#### Admin
```
POST   /api/admin/login                    # Логин админа
GET    /api/admin/dashboard                # Дашборд статистика (Auth)
```

#### System
```
GET    /healthz                            # Health check
GET    /api/health                         # API health check
```

## 🎨 Frontend архитектура (Vanilla JS + Tailwind CSS)

### Структура Frontend
```
frontend/
├── public/                  # Статические ресурсы
│   ├── css/
│   │   └── layout.css           # Общие стили
│   ├── js/
│   │   ├── i18n.js              # Система интернационализации
│   │   ├── multilingual-utils.js # Многоязычные утилиты
│   │   ├── layout-loader.js      # Загрузка header/footer
│   │   ├── utils.js              # Утилиты
│   │   ├── home-page.js          # Логика главной страницы
│   │   ├── search-page.js        # Логика поиска туров
│   │   ├── booking-state.js      # Состояние бронирования
│   │   ├── admin-helpers.js      # Помощники для админки
│   │   ├── unified-form-handler.js # Унифицированные формы
│   │   ├── dropdown-helpers.js   # Dropdown утилиты
│   │   ├── custom-tour-cities.js # Города для индивидуальных туров
│   │   └── security-utils.js     # XSS защита
│   ├── images/              # Изображения
│   └── ...
│
├── _header.html             # Шаблон шапки (inject)
├── _footer.html             # Шаблон футера (inject)
│
├── index.html               # Главная страница
├── tours-search.html        # Поиск туров
├── tour-template.html       # Страница тура
│
├── booking-step1.html       # Бронирование: Шаг 1 (Выбор даты и отеля)
├── booking-step2.html       # Бронирование: Шаг 2 (Детали туристов)
├── booking-step3.html       # Бронирование: Шаг 3 (Оплата)
│
├── hotels-catalog.html      # Каталог отелей
├── hotel-template.html      # Страница отеля
│
├── tour-guides.html         # Каталог гидов
├── guide-profile.html       # Профиль гида
├── guide-review-form.html   # Форма отзыва о гиде
│
├── custom-tour-order.html   # Заказ индивидуального тура
│
├── news.html                # Список новостей
├── news-detail.html         # Детали новости
│
├── admin-dashboard.html     # Админ панель (17000+ строк)
├── guide-login.html         # Логин для гидов
├── driver-login.html        # Логин для водителей
├── guide/dashboard.html     # Личный кабинет гида
├── driver-dashboard.html    # Личный кабинет водителя
│
├── payment-success.html     # Успешная оплата
├── payment-fail.html        # Неудачная оплата
│
├── about-us.html            # О нас
├── visa-support.html        # Визовая поддержка
└── transfer.html            # Трансфер
```

### Ключевые страницы

#### index.html (Главная страница)
**Функционал:**
- Hero баннер с слайдером (из БД через `/api/slides`)
- Фильтры поиска туров (блок, категория, страна, город, даты)
- 7 блоков туров с каруселями
- Карточки городов с фото
- Карта в футере

**JavaScript:**
```javascript
// Загрузка слайдов
const slides = await fetch('/api/slides?lang=ru');

// Загрузка туров по блокам
for (const block of tourBlocks) {
  const tours = await fetch(`/api/tour-blocks/${block.id}/tours?lang=ru`);
  renderTourCarousel(block, tours);
}

// Фильтр поиска
const filters = {
  blockId: selectedBlock,
  categoryId: selectedCategory,
  countryId: selectedCountry,
  cityId: selectedCity,
  startDate: selectedDate
};
window.location.href = `/tours-search.html?${new URLSearchParams(filters)}`;
```

#### tours-search.html (Поиск туров)
**Функционал:**
- Динамические фильтры (блоки, категории, страны, города)
- Сортировка (цена, рейтинг, длительность)
- Пагинация
- Карточки туров с кнопками "Детали" и "Забронировать"

**API вызовы:**
```javascript
// Загрузка туров с фильтрами
const params = new URLSearchParams({
  lang: currentLang,
  blockId: filters.blockId,
  categoryId: filters.categoryId,
  // ... другие фильтры
});

const tours = await fetch(`/api/tours?${params}`);
```

#### tour-template.html (Страница тура)
**Функционал:**
- Галерея фото
- Описание тура (локализованное)
- Программа тура (itinerary)
- Что включено/не включено
- Карта с маркерами (TourMapPoints)
- Отзывы
- Кнопка "Забронировать"

**Загрузка данных:**
```javascript
const tourId = new URLSearchParams(window.location.search).get('id');
const tour = await fetch(`/api/tours/${tourId}?lang=ru&includeRaw=false`);

// Отображение на карте
if (tour.tourMapPoints && tour.tourMapPoints.length > 0) {
  initMap(tour.tourMapPoints);
}
```

#### booking-step1.html (Бронирование: Шаг 1)
**Функционал:**
- Выбор даты тура (Flatpickr календарь)
- Количество туристов
- Выбор отеля (опционально)
  - Карусель фото отеля
  - Выбор типа номера и количества
  - Выбор питания (BB, HB, FB)
  - Встроенная Google Maps карта
- Расчет итоговой цены в реальном времени
- Кнопка "Продолжить" → booking-step2.html

**Состояние бронирования:**
```javascript
// Сохраняется в localStorage через booking-state.js
const bookingState = {
  tourId: 1,
  hotelId: 5,
  tourDate: "2025-12-01",
  numberOfTourists: 2,
  roomSelection: {
    "standard": { quantity: 1, price: 150 },
    "deluxe": { quantity: 0, price: 250 }
  },
  mealSelection: {
    "HB": { selected: true, price: 30 }
  },
  totalPrice: 1234.56
};

// API вызов
const response = await fetch('/api/booking/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(bookingState)
});

const { bookingId, totalPrice } = await response.json();
// Сохранить bookingId в localStorage
```

#### booking-step2.html (Бронирование: Шаг 2)
**Функционал:**
- Форма контактных данных (имя, телефон, email)
- Динамические поля для всех туристов
  - ФИО
  - Дата рождения
- Особые пожелания (textarea)
- Кнопка "Продолжить" → booking-step3.html

**API вызов:**
```javascript
const bookingId = localStorage.getItem('bookingId');

await fetch(`/api/booking/${bookingId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contactName,
    contactPhone,
    contactEmail,
    tourists: [
      { fullName: "Иван Иванов", dateOfBirth: "1990-01-01" },
      { fullName: "Мария Иванова", dateOfBirth: "1992-05-15" }
    ],
    specialRequests
  })
});
```

#### booking-step3.html (Бронирование: Шаг 3)
**Функционал:**
- Итоговая цена
- Выбор способа оплаты:
  - Stripe (карты международные)
  - Payler (Таджикистан)
  - AlifPay (Таджикистан)
- Кнопка "Оплатить"
- Редирект на платежную систему

**Платеж Payler:**
```javascript
const response = await fetch('/api/payments/payler/create', {
  method: 'POST',
  body: JSON.stringify({ orderNumber })
});

const { redirectUrl } = await response.json();
window.location.href = redirectUrl; // https://secure.payler.com/gapi/Pay/?session_id=XXX
```

**Платеж AlifPay:**
```javascript
const response = await fetch('/api/payments/alif/create', {
  method: 'POST',
  body: JSON.stringify({ orderNumber })
});

const { formData, action, method } = await response.json();

// Создать форму и submit
const form = document.createElement('form');
form.method = method; // POST
form.action = action; // https://web.alif.tj/
for (const [key, value] of Object.entries(formData)) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = key;
  input.value = value;
  form.appendChild(input);
}
document.body.appendChild(form);
form.submit();
```

#### admin-dashboard.html (Админ панель)
**Огромный файл (17000+ строк)** с полным управлением:

**Разделы:**
1. **Дашборд** - Статистика (туры, бронирования, заказы)
2. **Туры** - CRUD туров
   - Создание/редактирование с многоязычностью
   - Назначение блоков (Multi-select)
   - Назначение категорий (Multi-select)
   - Назначение стран и городов (с ночами)
   - Загрузка фото
   - Компонентное ценообразование
   - Маркеры на карте
3. **Отели** - CRUD отелей
4. **Гиды** - CRUD гидов
5. **Водители** - CRUD водителей
6. **Заказы** - Управление заказами
7. **Бронирования** - Управление бронированиями
8. **Отзывы** - Модерация отзывов
9. **Категории** - Управление категориями
10. **Блоки туров** - Просмотр (НЕ редактирование - они железобетонные)
11. **Страны и города** - CRUD
12. **Новости** - CRUD новостей
13. **Слайдер** - CRUD слайдов баннера
14. **Курсы валют** - Обновление курсов
15. **Компоненты цен** - CRUD компонентов ценообразования
16. **Индивидуальные туры** - Управление заявками
17. **Фото городов** - Управление фото карточек городов

**JavaScript архитектура:**
```javascript
// Модульная структура
const TourManager = {
  async loadTours() { /* ... */ },
  async createTour(data) { /* ... */ },
  async updateTour(id, data) { /* ... */ },
  async deleteTour(id) { /* ... */ }
};

// Использует:
// - admin-helpers.js (общие функции)
// - unified-form-handler.js (унифицированные формы)
// - dropdown-helpers.js (выпадающие списки)
// - security-utils.js (XSS защита)
```

### Система интернационализации (i18n)

**Файлы:**
- `public/js/i18n.js` - Основная система
- `public/js/multilingual-utils.js` - Утилиты

**Принцип работы:**
```html
<!-- HTML -->
<h1 data-translate="hero.title">Добро пожаловать</h1>
<button data-translate="buttons.book">Забронировать</button>
```

```javascript
// i18n.js
const translations = {
  ru: {
    "hero.title": "Добро пожаловать в Центральную Азию",
    "buttons.book": "Забронировать"
  },
  en: {
    "hero.title": "Welcome to Central Asia",
    "buttons.book": "Book Now"
  }
};

// Автоматическая замена при смене языка
function updatePageLanguage(lang) {
  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    el.textContent = translations[lang][key];
  });
}

// MutationObserver для динамического контента
const observer = new MutationObserver(() => {
  // Переводит новые элементы автоматически
});
```

**Сохранение языка:**
```javascript
// localStorage
localStorage.setItem('language', 'en');

// Cookie
document.cookie = `language=en; path=/`;
```

### Загрузка Layout (Header/Footer)

**layout-loader.js:**
```javascript
async function loadLayout() {
  // Загрузить _header.html
  const headerHTML = await fetch('/_header.html').then(r => r.text());
  document.getElementById('header-placeholder').innerHTML = headerHTML;
  
  // Загрузить _footer.html
  const footerHTML = await fetch('/_footer.html').then(r => r.text());
  document.getElementById('footer-placeholder').innerHTML = footerHTML;
  
  // Применить переводы
  updatePageLanguage(currentLang);
}

document.addEventListener('DOMContentLoaded', loadLayout);
```

**Преимущества:**
- Единый header/footer для всех страниц
- Легкое обновление (изменение в одном файле)
- Нет дублирования кода

## 🔐 Безопасность

### Аутентификация и авторизация

#### JWT для админов
```javascript
// Логин
POST /api/admin/login
{
  "username": "admin",
  "password": "admin123"
}

// Ответ
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}

// Использование токена
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Middleware:**
```typescript
// src/middleware/auth.ts
export const authenticateAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

#### Отдельная аутентификация для гидов
```javascript
POST /api/guide/login
{
  "login": "guide@example.com",
  "password": "password123"
}

// Личный кабинет гида (защищено)
GET /api/guide/profile
Authorization: Bearer <guide_token>
```

#### Отдельная аутентификация для водителей
```javascript
POST /api/drivers/login
{
  "login": "driver@example.com",
  "password": "password123"
}
```

### Rate Limiting

**Конфигурация:**
```typescript
// src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// Для аутентификации
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 15, // 15 попыток
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Trust proxy для Nginx
  trustProxy: true
});

// Для API
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 100, // 100 запросов
  trustProxy: true
});
```

**Применение:**
```typescript
// routes/adminRoutes.ts
router.post('/login', authLimiter, adminController.login);

// index.ts
app.use('/api', apiLimiter);
```

### XSS Protection

**Frontend:**
```javascript
// public/js/security-utils.js
function sanitizeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Использование
const userInput = req.body.comment;
const safe = sanitizeHTML(userInput);
```

**Backend:**
```typescript
// Prisma автоматически экранирует SQL инъекции
// Дополнительная валидация в контроллерах

// tourController.ts
if (title && typeof title !== 'string') {
  return res.status(400).json({ error: 'Invalid title format' });
}
```

### CORS Configuration

```javascript
// index.js
const corsOrigins = process.env.CORS_ORIGINS || '';
const allowlist = corsOrigins.split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Разрешить без origin (same-origin, curl)
    if (!origin) return callback(null, true);
    
    // Development mode
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Wildcard
    if (corsOrigins === '*' || allowlist.includes('*')) {
      return callback(null, true);
    }
    
    // Whitelist
    if (allowlist.length === 0 || allowlist.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));
```

### Environment Variables Validation

**Обязательная валидация при старте:**
```typescript
// src/config/validateEnv.ts
export function validateEnvironment() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    throw new Error(`Missing: ${missing.join(', ')}`);
  }
  
  // Проверка JWT_SECRET длины (минимум 32 символа)
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  
  // Проверка дефолтных значений
  const defaults = ['default-secret-key', 'fallback_secret_key'];
  if (defaults.includes(process.env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must not use default value');
  }
  
  console.log('✅ Environment validation passed');
}

// index.js
validateEnvironment(); // Вызывается ПЕРЕД запуском сервера
```

## 🚀 Деплой и Production

### Окружение

**Переменные (.env):**
```bash
# === ОБЯЗАТЕЛЬНЫЕ ===
DATABASE_URL="postgresql://user:password@host:5432/db?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-min-32-chars"
ADMIN_DEFAULT_USER=admin
ADMIN_DEFAULT_PASSWORD=***strong-password***

# === Управление стартовыми процессами ===
RUN_MIGRATIONS_ON_BOOT=false  # Для production: false
RUN_SEED_ON_BOOT=false         # Для production: false

# === CORS ===
CORS_ORIGINS=https://bunyodtour.tj,https://www.bunyodtour.tj

# === Платежные системы (опционально) ===
STRIPE_SECRET_KEY=sk_live_xxx
PAYLER_KEY=merchant_key
ALIF_MERCHANT_KEY=xxx
ALIF_MERCHANT_PASSWORD=xxx

# === Email (опционально) ===
SMTP_HOST=smtp.yandex.ru
SMTP_USER=noreply@bunyodtour.tj
SMTP_PASS=password

# === Окружение ===
NODE_ENV=production
PORT=5000
BASE_URL=https://api.bunyodtour.tj
FRONTEND_URL=https://bunyodtour.tj
```

### Update Script (./update.sh)

**Автоматический деплой:**
```bash
#!/bin/bash
# Автоматическое обновление production сервера

# 1. Создать бэкап БД
pg_dump -U bunyod_user bunyod_tour > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Pull последний код
git pull origin main

# 3. Установить зависимости
npm install

# 4. Применить миграции
npx prisma migrate deploy

# 5. Запустить seed (идемпотентно)
npm run seed

# 6. Перезапустить PM2
pm2 restart bunyod-tour

# 7. Health check
sleep 5
curl http://localhost:5000/healthz

echo "✅ Update completed!"
```

### PM2 Configuration

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'bunyod-tour',
    script: 'index.js',
    instances: 2,  // Кластер (2 процесса)
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**Команды:**
```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs bunyod-tour
pm2 restart bunyod-tour
pm2 stop bunyod-tour
pm2 delete bunyod-tour
```

### Nginx Reverse Proxy

**Конфигурация:**
```nginx
# /etc/nginx/sites-available/bunyodtour.tj

server {
    listen 80;
    server_name bunyodtour.tj www.bunyodtour.tj;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bunyodtour.tj www.bunyodtour.tj;
    
    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/bunyodtour.tj/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bunyodtour.tj/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://localhost:5000;
        # ... (те же proxy headers)
    }
    
    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### База данных Migration Strategy

**Двухуровневая система:**

1. **Manual Migrations** (для сложных изменений схемы):
```bash
# Создание ручной миграции
cd manual_migrations
cp template.sql 001_add_custom_tour_cities.sql

# Редактировать SQL
nano 001_add_custom_tour_cities.sql

# Применить
psql -U bunyod_user -d bunyod_tour -f 001_add_custom_tour_cities.sql
```

**Структура миграции:**
```sql
-- 001_add_custom_tour_cities.sql
-- Description: Add custom tour cities management
-- Date: 2025-11-15
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

-- Check if table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE tablename = 'custom_tour_cities'
  ) THEN
    CREATE TABLE custom_tour_cities (
      id SERIAL PRIMARY KEY,
      country_id INTEGER NOT NULL REFERENCES countries(id),
      city_id INTEGER NOT NULL REFERENCES cities(id),
      days_count INTEGER NOT NULL CHECK (days_count > 0),
      UNIQUE(country_id, city_id)
    );
    
    RAISE NOTICE 'Table custom_tour_cities created';
  ELSE
    RAISE NOTICE 'Table custom_tour_cities already exists, skipping';
  END IF;
END
$$;

COMMIT;
```

2. **Prisma Migrations** (для обычных изменений):
```bash
# Development
npx prisma db push

# Production
npx prisma migrate deploy
```

### Database Seeding

**Идемпотентный seed:**
```bash
npm run seed  # Можно запускать много раз без дубликатов
```

**Что создает:**
- ✅ 7 Tour Blocks (железобетонные)
- ✅ 15 Categories
- ✅ 5 Countries
- ✅ 12 Cities
- ✅ 5 Exchange Rates
- ✅ Default Admin user
- ❌ НЕТ демо-туров
- ❌ НЕТ тестовых данных

## 📊 Мониторинг и логи

### Логирование

**PM2 Logs:**
```bash
pm2 logs bunyod-tour          # Все логи
pm2 logs bunyod-tour --err     # Только ошибки
pm2 logs bunyod-tour --out     # Только output
pm2 flush bunyod-tour          # Очистить логи
```

**Nginx Logs:**
```bash
tail -f /var/log/nginx/bunyod-tour-access.log
tail -f /var/log/nginx/bunyod-tour-error.log
```

**Application Logs:**
```javascript
// Структурированное логирование
console.log('🚀 Server started on port', PORT);
console.log('✅ Database connected');
console.error('❌ Error:', error.message);
console.warn('⚠️ Warning:', message);
```

### Health Checks

**Endpoint:**
```javascript
GET /healthz

Response:
{
  "ok": true,
  "uptime": 12345.67  // секунды
}
```

**Используется:**
- update.sh (проверка после деплоя)
- Мониторинг системы
- Load balancer health checks

## 📚 Дополнительная документация

### Файлы с детальной документацией:
- `README.md` - Общее описание проекта
- `DEPLOYMENT_GUIDE.md` - Полное руководство по деплою
- `QUICK_DEPLOY_INSTRUCTIONS.md` - Быстрый деплой
- `PAYMENT_SYSTEMS_ANALYSIS_REPORT.md` - Анализ платежных систем
- `PAYLER_INTEGRATION_REQUEST.md` - Интеграция Payler

### Prisma документация:
```bash
# Открыть Prisma Studio (GUI для БД)
npx prisma studio

# Генерация Prisma Client
npx prisma generate

# Форматирование schema
npx prisma format
```

## 🎯 Пользовательские предпочтения

### Стиль работы
- **Язык общения**: Простой, повседневный русский язык
- **Подход к разработке**: Улучшать существующие файлы, не создавать новые
- **Структура frontend**: Админ панель должна идеально совпадать со структурой главной страницы
- **Интеграция систем**: Упрощенные и унифицированные системы ценообразования с единым источником правды

### КРИТИЧЕСКОЕ ПРАВИЛО РАБОТЫ
Перед началом любой задачи:
1. Провести тщательное исследование всего связанного кода
2. Изучить структуру, зависимости и потенциальные последствия
3. Ничего не должно быть сломано или повреждено
4. Работа должна выполняться с максимальным профессионализмом и ответственностью
5. Качество - превыше всего

### Дизайн решения

#### UI/UX
- **Цветовая палитра**: Строгая серая (#3E3E3E, #2F2F2F)
- **Шрифт**: Inter
- **Эффекты**: Glassmorphism
- **Запрещено**: Синие цвета и любые цвета вне утвержденной серой палитры

#### Технические детали
- **Backend**: Модульная MVC архитектура с TypeScript
- **БД**: PostgreSQL + Prisma ORM
- **Многоязычность**: JSONB поля `{ru: "текст", en: "text"}`
- **Безопасность**: Rate limiting, XSS protection, JWT auth
- **Валюты**: TJS, USD, EUR, RUB, CNY с реальным конвертированием

## 🔄 История обновлений (Recent Updates)

### Ноябрь 2025
- ✅ Внедрена 3-шаговая система бронирования
- ✅ Добавлена система компонентного ценообразования
- ✅ Реализована интеграция Payler и AlifPay
- ✅ Система отзывов для гидов
- ✅ Личные кабинеты для гидов и водителей
- ✅ Система индивидуальных туров с автоматическим расчетом дней
- ✅ Фото карточек городов
- ✅ Маркеры на картах туров

### Октябрь 2025
- ✅ Железобетонные 7 туристических блоков
- ✅ Полностью удален таджикский язык (только RU/EN)
- ✅ Функциональные фильтры по блокам на странице поиска
- ✅ Отображение программы тура без fallback контента
- ✅ TJS валюта отображается только с символом "с."
- ✅ База данных очищена: 15 категорий, 7 блоков, нет демо-туров

## 📞 Техническая поддержка

**При проблемах с деплоем:**
1. Проверить логи: `pm2 logs bunyod-tour`
2. Проверить БД: `psql -U bunyod_user -d bunyod_tour`
3. Проверить Nginx: `sudo nginx -t`
4. Проверить SSL: `sudo certbot certificates`

**Health check:**
```bash
curl http://localhost:5000/healthz
```

**Восстановление из бэкапа:**
```bash
psql -U bunyod_user -d bunyod_tour < backup_YYYYMMDD_HHMMSS.sql
```

---

**🎉 Платформа готова к production и успешно развернута!**

*Последнее обновление документации: 17 ноября 2025*
