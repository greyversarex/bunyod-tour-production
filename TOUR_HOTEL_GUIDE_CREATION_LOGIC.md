# Полная Бизнес-Логика Создания Туров, Отелей и Гидов

## 📊 Общая Архитектура Проекта

### Технологический стек
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL (Neon)
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Архитектурный паттерн**: MVC с модульной структурой

---

## 🎯 БИЗНЕС-ЛОГИКА СОЗДАНИЯ ТУРОВ

### 1. База данных (Prisma Schema)

**Модель Tour** содержит:
- **Многоязычные поля** (JSON): `title`, `description`, `shortDesc`
- **Основные данные**: `duration`, `price`, `priceType`, `currency`
- **Связи**: 
  - `categoryId` → Category (обязательная)
  - `countryId/cityId` → Country/City (опциональные, для обратной совместимости)
  - Many-to-many: `tourCountries`, `tourCities`, `tourHotels`, `tourGuides`, `tourDrivers`
  - `tourBlockAssignments` → TourBlock (для группировки на главной)
- **Статусы**: `isActive`, `isDraft`, `isFeatured`
- **Компоненты ценообразования**: `pricingComponents` (JSON)

### 2. Backend - создание тура (POST /api/tours)

**Процесс:**

1. **Парсинг входных данных:**
```javascript
// Преобразование JSON строк в объекты
title = safeJsonParse(title)  // {ru: "...", en: "..."}
description = safeJsonParse(description)
```

2. **Условная валидация:**
```javascript
if (!isDraft) {
  // ✅ СТРОГАЯ: требуем RU + EN для title, description
  // Обязательны: categoryId, price, duration
} else {
  // 📝 МЯГКАЯ: только название на русском
}
```

3. **Создание записи в БД:**
```javascript
const tour = await TourModel.create({
  title, description,
  categoryId, countryId, cityId,
  countriesIds, citiesIds, // массивы для множественного выбора
  isDraft,
  // ... остальные поля
})
```

4. **Создание связей (many-to-many):**
- **Отели**: `tourHotels` через `hotelIds[]`
- **Гиды**: `tourGuides` через `guideIds[]`
- **Водители**: `tourDrivers` через `driverIds[]`
- **Блоки туров**: `tourBlockAssignments` через `tourBlockIds[]`
- **Страны**: `tourCountries` через `countriesIds[]`
- **Города**: `tourCities` через `citiesIds[]`

### 3. Frontend - форма создания тура

**Алгоритм `saveTourForm(isDraft)`:**

1. **Получение данных из формы:**
```javascript
// ID из скрытого поля
const tourId = document.getElementById('tour-id').value
const isEditing = tourId && tourId.trim() !== ''

// Основные поля
const titleRu = document.getElementById('tourTitleRu').value
const titleEn = document.getElementById('tourTitleEn').value
const categoryId = document.getElementById('tourCategory').value
```

2. **Фронтенд валидация (зеркало бэкенда):**
```javascript
if (!isDraft) {
  // Строгая валидация
  if (!titleRu || !titleEn) return alert('...')
  if (!categoryId || !price) return alert('...')
} else {
  // Мягкая: только titleRu
}
```

3. **Сборка сложных данных:**
```javascript
// Выбранные отели (чекбоксы)
const selectedHotels = []
document.querySelectorAll('input[name="selectedHotels"]:checked')
  .forEach(cb => selectedHotels.push(parseInt(cb.value)))

// Программа тура (многодневная)
itinerary: JSON.stringify(convertDaysItineraryToArray())

// Компоненты ценообразования
services: JSON.stringify(selectedTourComponents || [])

// Страны и города (множественный выбор)
countriesIds: JSON.parse(safeGetValue('tourCountries', '[]'))
citiesIds: JSON.parse(safeGetValue('tourCities', '[]'))
```

4. **Формирование JSON для отправки:**
```javascript
const formData = {
  title: JSON.stringify({ ru: titleRu, en: titleEn }),
  description: JSON.stringify({ ru: descRu, en: descEn }),
  price, categoryId, durationDays,
  countryId: parseInt(tourCountryEl.value),  // одиночная страна
  cityId: parseInt(tourCityEl.value),        // одиночный город
  countriesIds,  // массив стран
  citiesIds,     // массив городов
  hotelIds: selectedHotels,
  guideIds: selectedGuides,
  tourBlockIds: selectedTourBlocks,
  isDraft  // 📝 ключевой флаг
}
```

5. **HTTP запрос:**
```javascript
const url = isEditing ? `/api/tours/${tourId}` : `/api/tours`
const method = isEditing ? 'PUT' : 'POST'

fetch(url, {
  method,
  headers: getAuthHeaders(),
  body: JSON.stringify(formData)
})
```

---

## 🏨 БИЗНЕС-ЛОГИКА СОЗДАНИЯ ОТЕЛЕЙ

### 1. Модель Hotel (Prisma)

- **Многоязычные поля**: `name`, `description`, `address` (JSON)
- **Характеристики**: `stars`, `brand`, `category` (enum: STANDARD/SEMI_LUX/LUX/DELUXE)
- **Ценообразование**:
  - `roomTypes` (JSON): `{SGL: {name, price}, TWL: {...}, DBL: {...}}`
  - `mealTypes` (JSON): `{RO: {...}, BB: {...}, HB: {...}, FB: {...}, AI: {...}}`
- **Удобства**: `amenities` (JSON массив)
- **Связи**: `countryId`, `cityId`, `tourHotels` (many-to-many с турами)
- **Статусы**: `isActive`, `isDraft`

### 2. Backend - создание отеля (POST /api/hotels)

**Ключевые моменты:**

1. **Парсинг многоязычных полей:**
```javascript
// Преобразование строк в JSON объекты
name = JSON.parse(name)  // {ru: "...", en: "..."}
req.body.name = name  // ✅ Записываем обратно!
```

2. **Условная валидация:**
```javascript
if (!isDraft) {
  // Строгая: name.ru + name.en обязательны
  // description: если одно заполнено, требуем оба языка
  // countryId, cityId - обязательны
} else {
  // Мягкая: только name на любом языке
}
```

3. **Создание через модель:**
```javascript
const hotel = await HotelModel.create(req.body)
```

### 3. Frontend - форма отеля

**Алгоритм `saveHotel(isDraft)`:**

1. **Сбор основных полей:**
```javascript
const nameRu = document.getElementById('hotelNameRu').value
const nameEn = document.getElementById('hotelNameEn').value
const countryId = document.getElementById('hotelCountry').value
const cityId = document.getElementById('hotelCity').value
```

2. **Обработка бренда (с кастомным вводом):**
```javascript
const brandSelect = document.getElementById('hotelBrand')
let brand = brandSelect.value === 'custom' 
  ? document.getElementById('hotelBrandCustom').value
  : brandSelect.value
```

3. **Сбор типов номеров с ценами:**
```javascript
const roomTypes = {}
['SGL', 'TWL', 'DBL'].forEach(type => {
  const checkbox = document.getElementById(`room${type}`)
  const priceField = document.getElementById(`price${type}`)
  if (checkbox.checked && priceField.value) {
    roomTypes[type] = {
      name: roomNames[type],
      price: parseFloat(priceField.value)
    }
  }
})
```

4. **Формирование данных:**
```javascript
const formData = {
  name: JSON.stringify({ ru: nameRu, en: nameEn }),
  description: JSON.stringify({ ru: descRu, en: descEn }),
  address,
  stars: parseInt(stars),
  brand,
  category,  // enum значение
  countryId: parseInt(countryId),
  cityId: parseInt(cityId),
  roomTypes: JSON.stringify(roomTypes),
  mealTypes: JSON.stringify(mealTypes),
  amenities: JSON.stringify(amenities),
  images: JSON.stringify(window.hotelImageURLs || []),
  isDraft
}
```

---

## 👨‍🏫 БИЗНЕС-ЛОГИКА СОЗДАНИЯ ГИДОВ

### 1. Модель Guide (Prisma)

- **Многоязычные поля**: `name`, `description` (JSON)
- **Документы и фото**: `avatar`, `documents` (JSON массив файлов)
- **Характеристики**: `languages`, `experience`, `rating`
- **Авторизация**: `login`, `password` (хешированный)
- **Персональные данные**: `passportSeries`, `registration`, `residenceAddress`
- **Ценообразование для найма**: `pricePerDay`, `currency`, `isHireable`, `availableDates`
- **Связи**: `countryId`, `cityId`, `tourGuides` (many-to-many с турами)

### 2. Backend - создание гида (POST /api/guide/create-with-auth)

**Особенности:**

1. **Парсинг многоязычных полей:**
```javascript
const parsedName = safeJsonParse(name)  // {ru: "...", en: "..."}
const parsedDescription = safeJsonParse(description)
```

2. **Хеширование пароля:**
```javascript
if (password) {
  const saltRounds = 10
  hashedPassword = await bcrypt.hash(password, saltRounds)
}
```

3. **Валидация уникального логина:**
```javascript
if (login) {
  const existing = await prisma.guide.findFirst({ where: { login } })
  if (existing) return error('Логин занят')
}
```

4. **Бизнес-логика найма:**
```javascript
// Если нет цены или цена <= 0, гид не доступен для найма
if (!pricePerDay || pricePerDay <= 0) {
  isHireable = false
}
```

5. **Безопасность при возврате:**
```javascript
// Никогда не возвращаем пароль!
const safeGuide = {
  ...guide,
  password: undefined,
  hasPassword: !!guide.password  // только флаг наличия
}
```

### 3. Frontend - форма гида

**Алгоритм `saveGuide()`:**

1. **Сбор многоязычных данных:**
```javascript
const fullNameRu = document.getElementById('guideFullNameRu').value
const fullNameEn = document.getElementById('guideFullNameEn').value
const fullName = JSON.stringify({ ru: fullNameRu, en: fullNameEn })

const commentsRu = document.getElementById('guideCommentsRu').value
const commentsEn = document.getElementById('guideCommentsEn').value
const comments = JSON.stringify({ ru: commentsRu, en: commentsEn })
```

2. **Использование FormData (для файлов):**
```javascript
const formData = new FormData()
formData.append('name', fullName)
formData.append('description', comments)
formData.append('languages', JSON.stringify(selectedGuideLanguages))

// Аватар
if (guideAvatarFile) {
  formData.append('avatar', guideAvatarFile)
}

// Документы (multiple files)
guideDocumentFiles.forEach(file => {
  formData.append('documents', file)
})
```

3. **Валидация:**
```javascript
// Только ФИО обязательно (хотя бы на одном языке)
if (!fullNameRu && !fullNameEn) {
  return alert('Заполните ФИО')
}
```

4. **Отправка с правильными заголовками:**
```javascript
const headers = getAuthHeaders()
delete headers['Content-Type']  // браузер сам установит для FormData

fetch(`${getApiUrl()}/guide/create-with-auth`, {
  method: 'POST',
  headers,
  body: formData
})
```

---

## 🔄 ОБЩИЕ ПАТТЕРНЫ И КЛЮЧЕВЫЕ КОНЦЕПЦИИ

### 1. Система черновиков (Draft System)

- **Флаг**: `isDraft: boolean` в Tour и Hotel
- **Логика**: 
  - `isDraft=true` → мягкая валидация, можно сохранить неполные данные
  - `isDraft=false` → строгая валидация, требуем все обязательные поля + оба языка
- **Публикация**: endpoint `POST /api/{tours|hotels}/:id/publish`

### 2. Многоязычность (i18n)

**Хранение:**
```javascript
// В БД как JSON
{
  "ru": "Текст на русском",
  "en": "Text in English"
}
```

**Парсинг и отправка:**
```javascript
// Frontend → Backend: JSON.stringify()
title: JSON.stringify({ ru: valueRu, en: valueEn })

// Backend: safeJsonParse() или JSON.parse()
const title = safeJsonParse(req.body.title)

// Backend → Frontend: с флагом includeRaw
if (includeRaw) {
  // Для админки: raw JSON + локализованные поля
  _raw: { title: {...} },
  _localized: { title: "..." }
} else {
  // Для публики: только локализованный текст
  title: "Локализованное название"
}
```

### 3. Связи Many-to-Many

**Паттерн через промежуточные таблицы:**
```javascript
// Tour ↔ Hotel
await prisma.tourHotel.createMany({
  data: hotelIds.map(hotelId => ({
    tourId: tour.id,
    hotelId,
    isDefault: false
  }))
})

// Tour ↔ Guide, Tour ↔ Driver - аналогично

// Tour ↔ Country (множественный выбор)
await prisma.tourCountry.createMany({
  data: countriesIds.map((countryId, index) => ({
    tourId: tour.id,
    countryId,
    isPrimary: index === 0  // первая - основная
  }))
})

// Tour ↔ City (множественный выбор)
await prisma.tourCity.createMany({
  data: citiesIds.map((cityId, index) => ({
    tourId: tour.id,
    cityId,
    isPrimary: index === 0
  }))
})
```

### 4. Система загрузки файлов

**Туры/Отели**: загрузка через Object Storage (Uppy)
```javascript
// Сохранение URL в window
window.tourImageURLs = [...URLs]
// Отправка как JSON массив
images: JSON.stringify(window.tourImageURLs)
```

**Гиды**: загрузка через FormData
```javascript
formData.append('avatar', avatarFile)
formData.append('documents', documentFile)
```

### 5. Условная валидация (Conditional Validation)

**Frontend (пример для туров):**
```javascript
if (!isDraft) {
  // Строгая валидация
  if (!titleRu || !titleEn) return alert('...')
  if (!categoryId) return alert('...')
} else {
  // Мягкая валидация
  if (!titleRu) return alert('Минимум название на RU')
}
```

**Backend (зеркальная логика):**
```javascript
if (!isDraft) {
  if (!title.ru || !title.en) throw Error('...')
  if (!categoryId) throw Error('...')
} else {
  console.log('Draft mode - skipping strict validation')
}
```

---

## 📈 FLOW ДИАГРАММА: Создание тура

```
1. Админ → Открывает модалку (openTourModal)
   ↓
2. Заполняет форму (многоязычные поля, категория, цена и т.д.)
   ↓
3. Выбирает отели, гидов, блоки туров (чекбоксы)
   ↓
4. Выбирает страны и города (мультиселект)
   ↓
5. Выбирает действие:
   - "Сохранить как черновик" → saveTourAsDraft() → isDraft=true
   - "Опубликовать" → saveTourForm() → isDraft=false
   ↓
6. Frontend валидация (условная)
   ↓
7. Формирование JSON объекта с данными
   - countriesIds: массив ID выбранных стран
   - citiesIds: массив ID выбранных городов
   - countryId: ID основной страны (для совместимости)
   - cityId: ID основного города (для совместимости)
   ↓
8. HTTP запрос POST/PUT /api/tours (с isDraft флагом)
   ↓
9. Backend:
   a) Парсинг JSON строк → объекты
   b) Условная валидация (строгая/мягкая)
   c) Создание записи Tour
   d) Создание связей many-to-many:
      - tourHotels (отели)
      - tourGuides (гиды)
      - tourDrivers (водители)
      - tourBlockAssignments (блоки туров)
      - tourCountries (страны) ← через countriesIds
      - tourCities (города) ← через citiesIds
   e) Возврат успеха
   ↓
10. Frontend: закрытие модалки + обновление списка туров
```

---

## 🔑 КЛЮЧЕВЫЕ ФАЙЛЫ

### Backend
- `prisma/schema.prisma` - схема базы данных
- `src/controllers/tourController.ts` - логика создания/обновления туров
- `src/controllers/hotelController.ts` - логика создания/обновления отелей
- `src/controllers/guideController.ts` - логика создания/обновления гидов
- `src/models/index.ts` - модели данных (TourModel, HotelModel и т.д.)
- `src/utils/multilingual.ts` - утилиты для работы с многоязычностью

### Frontend
- `frontend/admin-dashboard.html` - единая админ-панель (монолитный файл)
  - Функции создания туров: `saveTourForm()`, `openTourModal()`, `editTour()`
  - Функции создания отелей: `saveHotel()`, `openHotelModal()`, `editHotel()`
  - Функции создания гидов: `saveGuide()`, `openGuideModal()`, `editGuide()`
- `frontend/public/js/admin-helpers.js` - вспомогательные функции для админки
- `frontend/public/js/multilingual-utils.js` - утилиты многоязычности на фронте
- `frontend/public/js/i18n.js` - система переводов интерфейса

---

## 🎨 UI/UX ОСОБЕННОСТИ

### Форма создания тура

**Основные секции:**
1. **Основная информация** - название (RU/EN), описание (RU/EN), категория
2. **Ценообразование** - цена, тип цены (за человека/за группу), валюта
3. **География** - множественный выбор стран и городов
4. **Характеристики** - длительность, сложность, мин/макс людей
5. **Программа тура** - многодневная программа с активностями
6. **Связанные сущности** - отели, гиды, водители (чекбоксы)
7. **Группировка** - блоки туров для главной страницы
8. **Медиа** - главное изображение, галерея изображений
9. **Дополнительно** - услуги включены/исключены, языки, время начала

### Форма создания отеля

**Основные секции:**
1. **Основная информация** - название (RU/EN), описание (RU/EN), адрес
2. **Характеристики** - звёзды, бренд, категория
3. **Местоположение** - страна, город
4. **Типы номеров** - SGL/TWL/DBL с ценами (чекбоксы + input)
5. **Типы питания** - RO/BB/HB/FB/AI с ценами (чекбоксы + input)
6. **Удобства** - WiFi, бассейн, парковка и т.д. (чекбоксы)
7. **Изображения** - галерея фотографий отеля

### Форма создания гида

**Основные секции:**
1. **Персональная информация** - ФИО (RU/EN), фото/аватар
2. **Документы** - паспорт, регистрация, адрес проживания, файлы документов
3. **Профессиональные данные** - опыт, языки, комментарии (RU/EN)
4. **Авторизация** - логин, пароль (для личного кабинета)
5. **Местоположение** - страна, город работы
6. **Ценообразование** - цена за день, валюта, доступность для найма
7. **График работы** - доступные даты (для системы найма)

---

## 🔒 БЕЗОПАСНОСТЬ

### Пароли
- Хеширование через `bcrypt` с `saltRounds = 10`
- Никогда не возвращаются в API ответах
- Только флаг `hasPassword: boolean` для UI

### Валидация данных
- Двойная валидация: Frontend + Backend
- Условная валидация для черновиков
- Парсинг и нормализация JSON полей

### XSS защита
- Использование `security-utils.js` для санитизации
- Безопасный вывод через `escapeHtml()` и `safeSetText()`

### Авторизация
- JWT токены для аутентификации
- Проверка через `getAuthHeaders()`
- Разделение прав: Admin, Guide, Driver

---

## 📝 ПРИМЕЧАНИЯ

1. **Обратная совместимость**: Поля `country` (String) и `city` (String) сохранены для старых данных, но новые записи используют `countryId/cityId` и many-to-many связи.

2. **Система черновиков**: Позволяет сохранять неполные данные для последующего редактирования, что критично для сложных форм.

3. **Множественный выбор**: Страны и города могут быть выбраны множественно через `tourCountries` и `tourCities`, но один из них помечается как `isPrimary` для обратной совместимости.

4. **Компоненты ценообразования**: Туры поддерживают модульную систему ценообразования через `pricingComponents`, что позволяет динамически добавлять опции с ценами.

5. **Загрузка файлов**: Разные подходы - Object Storage (Uppy) для туров/отелей, FormData для гидов (с документами).
