# Глобальный рефакторинг админ-панели: Анализ и План

## Этап 1: Глубокий сравнительный анализ

### Обзор текущей архитектуры

Все три модуля (Tours, Hotels, Guides) реализованы в одном файле `frontend/admin-dashboard.html` (~15000 строк) с использованием Vanilla JavaScript без фреймворков. Каждый модуль имеет собственный подход к обработке данных, что создаёт дублирование кода и несогласованность.

---

## 1.1 Модуль Tours (Туры) - "Золотой стандарт"

### ✅ Сильные стороны

#### Структура функций
```javascript
// Основная функция сохранения (строки 5751-5921)
function saveTourForm() {
    // 1. Валидация обязательных полей
    // 2. Сбор данных из формы
    // 3. Формирование JSON для многоязычных полей
    // 4. Определение метода (POST/PUT)
    // 5. Отправка fetch запроса
    // 6. Обработка ответа
}
```

**Достоинства:**
- ✅ **Единая функция** для создания и редактирования (определяется по наличию tourId)
- ✅ **Чёткая валидация** обязательных полей перед отправкой
- ✅ **Консистентная структура данных** для отправки

#### Многоязычные поля
```javascript
// ПРАВИЛЬНО: JSON.stringify для title и description
const formData = {
    title: JSON.stringify({
        ru: titleRuValue,
        en: titleEnValue || titleRuValue
    }),
    description: JSON.stringify({
        ru: tourDescRuEl ? tourDescRuEl.value || '' : '',
        en: tourDescEnEl ? tourDescEnEl.value || '' : ''
    })
};
```

**Достоинства:**
- ✅ Правильное формирование JSON-объектов для RU/EN
- ✅ Fallback на русский язык если английский не указан
- ✅ Безопасная обработка отсутствующих элементов

#### Helper-функции
```javascript
// Универсальная функция для получения значений
function safeGetValue(elementId, defaultValue = '', parseType = null) {
    const element = document.getElementById(elementId);
    if (!element) return defaultValue;
    
    let value = element.type === 'checkbox' ? element.checked : element.value;
    
    if (parseType === 'int') return parseInt(value) || defaultValue;
    if (parseType === 'float') return parseFloat(value) || defaultValue;
    
    return value || defaultValue;
}

// Получение выбранных чекбоксов
function getSelectedCheckboxValues(prefix) {
    const checkboxes = document.querySelectorAll(`input[id^="${prefix}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.id.replace(prefix, ''));
}
```

**Достоинства:**
- ✅ Переиспользуемые функции
- ✅ Обработка разных типов данных (int, float, checkbox)
- ✅ Безопасные fallback значения

#### Множественный выбор стран и городов
```javascript
// Новая система: массивы ID
countriesIds: JSON.parse(safeGetValue('tourCountries', '[]')),
citiesIds: JSON.parse(safeGetValue('tourCities', '[]')),

// Legacy поддержка: первое значение из массива
countryId: tourCountryEl && tourCountryEl.value ? parseInt(tourCountryEl.value) : null,
cityId: tourCityEl && tourCityEl.value ? parseInt(tourCityEl.value) : null,
```

**Достоинства:**
- ✅ Поддержка множественного выбора
- ✅ Обратная совместимость с legacy системой
- ✅ Чистое хранение как массивы ID

#### Работа с чекбоксами (отели, гиды, услуги)
```javascript
// Сбор выбранных отелей
const selectedHotels = [];
document.querySelectorAll('input[name="selectedHotels"]:checked').forEach(checkbox => {
    selectedHotels.push(parseInt(checkbox.value));
});

// Сбор выбранных гидов
const selectedGuides = [];
document.querySelectorAll('input[name="selectedGuides"]:checked').forEach(checkbox => {
    selectedGuides.push(parseInt(checkbox.value));
});

// Сбор включенных услуг
const includedServices = [];
document.querySelectorAll('#includesOptions input[type="checkbox"]:checked').forEach(checkbox => {
    includedServices.push(checkbox.value);
});
```

**Достоинства:**
- ✅ Унифицированный подход к чекбоксам
- ✅ Чистые массивы для отправки на бэкенд
- ✅ Понятные имена переменных

#### Работа с изображениями
```javascript
// Использование глобального массива
images: JSON.stringify(window.tourGalleryImages || []),
```

**Достоинства:**
- ✅ Простое хранение в глобальной переменной
- ✅ Легко сериализуется в JSON
- ✅ Интеграция с ObjectUploader

### ⚠️ Недостатки модуля Tours

#### 1. Загрузка данных для редактирования
**Проблема:** Функция загрузки данных тура не найдена в отдельном виде, она встроена в `openTourModal(tourId)` (строка 5142), что усложняет её повторное использование.

#### 2. Сложная многодневная программа
```javascript
// Конвертация старой программы в новый формат
itinerary: JSON.stringify(convertDaysItineraryToArray()),
```

**Проблема:** Функция `convertDaysItineraryToArray()` добавляет дополнительный слой сложности. Нет единого стандарта хранения itinerary.

#### 3. Разбросанные глобальные переменные
```javascript
window.tourLanguages = window.tourLanguages || [];
window.tourItinerary = window.tourItinerary || [];
window.tourStartTimes = window.tourStartTimes || [];
window.tourGalleryImages = window.tourGalleryImages || [];
window.tourImageURLs = [];
```

**Проблема:** Множество глобальных переменных без централизованного управления состоянием.

---

## 1.2 Модуль Hotels (Отели)

### ✅ Сильные стороны

#### Загрузка данных для редактирования (строки 6612-6859)
```javascript
function loadHotelData(hotelId) {
    fetch(`${getApiUrl()}/hotels/${hotelId}?includeRaw=true`, {
        headers: getAuthHeaders()
    })
    .then(res => res.json())
    .then(data => {
        const hotel = data.data;
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильный парсинг JSON
        let name, description, amenities;
        try {
            name = typeof hotel.name === 'string' ? JSON.parse(hotel.name) : hotel.name || {};
        } catch (e) {
            name = hotel.name || {};
        }
        
        // Название отеля (русский и английский)
        document.getElementById('hotelNameRu').value = name.ru || '';
        document.getElementById('hotelNameEn').value = name.en || '';
        
        // ... аналогично для других полей
    });
}
```

**Достоинства:**
- ✅ **Отдельная функция** для загрузки данных (хорошо структурирована)
- ✅ **Безопасный парсинг JSON** с try-catch
- ✅ **Правильное заполнение** многоязычных полей (ru/en раздельно)
- ✅ **Обработка связанных данных**: каскадная загрузка городов после выбора страны

#### Каскадная загрузка стран и городов
```javascript
// После установки countryId, загружаем города для этой страны
if (hotel.countryId) {
    loadCitiesForCountry(hotel.countryId, 'hotelCity').then(() => {
        // После загрузки городов, устанавливаем cityId
        if (hotel.cityId && cityField) {
            cityField.value = hotel.cityId;
        }
    });
}
```

**Достоинства:**
- ✅ Правильная последовательность загрузки
- ✅ Использование промисов для синхронизации
- ✅ Установка значения только после загрузки данных

#### Обработка сложных структур данных (roomTypes, mealTypes)
```javascript
// Загрузка категорий номеров при редактировании
if (hotel.roomTypes) {
    const roomTypes = typeof hotel.roomTypes === 'string' ? JSON.parse(hotel.roomTypes) : hotel.roomTypes;
    
    // SGL - Одноместный
    if (roomTypes.SGL) {
        document.getElementById('roomSGL').checked = true;
        document.getElementById('priceSGL').disabled = false;
        document.getElementById('priceSGL').value = roomTypes.SGL.price || '';
    }
    
    // TWL, DBL - аналогично
}
```

**Достоинства:**
- ✅ Правильная обработка вложенных объектов
- ✅ Синхронизация чекбоксов и полей цен
- ✅ Управление disabled состоянием полей

#### Работа с изображениями
```javascript
// Восстановление изображений при редактировании
if (hotel.images) {
    const images = typeof hotel.images === 'string' ? JSON.parse(hotel.images) : hotel.images;
    if (Array.isArray(images) && images.length > 0) {
        window.hotelImageURLs = [...images]; // Восстанавливаем изображения
        document.getElementById('hotelImages').value = JSON.stringify(images);
        
        // Показываем загруженные изображения в интерфейсе
        updateHotelImagesList();
    }
}
```

**Достоинства:**
- ✅ Правильное восстановление массива изображений
- ✅ Обновление UI после загрузки
- ✅ Хранение в скрытом поле для отправки формы

### ❌ Критические недостатки модуля Hotels

#### 1. НЕТ отдельной функции saveHotel()
**Проблема:** Обработчик сохранения отеля встроен напрямую в submit формы (строка 7066):

```javascript
// Hotel form submit handler
document.getElementById('hotelForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Весь код сохранения здесь (100+ строк)
    // Build name object from bilingual fields (RU/EN)
    const name = {
        ru: safeGetValue('hotelNameRu', ''),
        en: safeGetValue('hotelNameEn', '')
    };
    
    // ... ещё 100 строк кода ...
    
    fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(hotelData)
    })
    .then(...)
    .catch(...);
});
```

**Последствия:**
- ❌ Невозможно переиспользовать логику сохранения
- ❌ Сложно тестировать
- ❌ Код трудно читать из-за вложенности
- ❌ Нарушает принцип единой ответственности

**Сравнение с Tours:**
```javascript
// Tours - ПРАВИЛЬНО: отдельная функция
function saveTourForm() { /* ... */ }

// Hotels - НЕПРАВИЛЬНО: inline submit handler
document.getElementById('hotelForm').addEventListener('submit', function(e) { /* ... */ });
```

#### 2. Сложная структура roomTypes и mealTypes
```javascript
// Обработка категорий номеров с ценами (строка 7111)
const roomTypes = {};

// SGL - Одноместный (безопасно)
if (safeGetValue('roomSGL', false, 'checkbox')) {
    const price = safeGetValue('priceSGL', '', 'float');
    if (price && !isNaN(price)) {
        roomTypes.SGL = {
            name: 'Одноместный',
            price: price
        };
    }
}

// TWL - Двухместный (безопасно)
if (safeGetValue('roomTWL', false, 'checkbox')) {
    const price = safeGetValue('priceTWL', '', 'float');
    if (price && !isNaN(price)) {
        roomTypes.TWL = {
            name: 'Двухместный', 
            price: price
        };
    }
}

// DBL, затем mealTypes - аналогично (повторяющийся код)
```

**Проблемы:**
- ❌ Код дублируется для каждого типа номера (SGL, TWL, DBL)
- ❌ Ещё раз дублируется для типов питания (RO, BB, HB, FB, AI)
- ❌ Нет универсальной функции сбора checkbox-групп с ценами
- ❌ Нарушается DRY (Don't Repeat Yourself)

#### 3. Функция editHotel() слишком простая
```javascript
function editHotel(hotelId) {
    openHotelModal(hotelId);
}
```

**Проблема:** Не очищает предыдущее состояние перед загрузкой новых данных.

**Сравнение с Tours:**
```javascript
function editTour(id) {
    // Очищаем все чекбоксы перед загрузкой новых данных
    document.querySelectorAll('input[name="selectedHotels"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="selectedGuides"]').forEach(cb => cb.checked = false);
    openTourModal(id);
}
```

---

## 1.3 Модуль Guides (Гиды)

### ✅ Сильные стороны

#### Правильная работа с файлами (FormData)
```javascript
function saveGuide() {
    // Создаем FormData для отправки файлов и данных
    const formData = new FormData();
    formData.append('name', fullName);
    formData.append('description', comments);
    
    // Добавляем аватар, если выбран
    if (guideAvatarFile) {
        formData.append('avatar', guideAvatarFile);
    }
    
    // Добавляем документы, если выбраны
    guideDocumentFiles.forEach((file, index) => {
        formData.append('documents', file);
    });
    
    // Получаем заголовки без Content-Type (браузер установит правильный для FormData)
    const headers = getAuthHeaders();
    delete headers['Content-Type'];
    
    fetch(`${getApiUrl()}/guide/create-with-auth`, {
        method: 'POST',
        headers: headers,
        body: formData
    })
}
```

**Достоинства:**
- ✅ Правильное использование FormData для файлов
- ✅ Удаление Content-Type из заголовков (браузер сам установит с boundary)
- ✅ Обработка множественных файлов (документы)
- ✅ Переменные для хранения файлов (guideAvatarFile, guideDocumentFiles)

#### Работа с массивом языков
```javascript
// Глобальная переменная
let selectedGuideLanguages = []; 

// Добавление языка
function addLanguageToGuide() {
    const select = document.getElementById('guideAvailableLanguages');
    const language = select.value;
    if (language && !selectedGuideLanguages.includes(language)) {
        selectedGuideLanguages.push(language);
        updateSelectedGuideLanguagesDisplay();
    }
}

// Отправка
formData.append('languages', JSON.stringify(selectedGuideLanguages.length > 0 ? selectedGuideLanguages : ['Русский']));
```

**Достоинства:**
- ✅ Чистый массив языков
- ✅ Функции добавления/удаления
- ✅ Обновление UI через updateSelectedGuideLanguagesDisplay()

### ❌ Критические недостатки модуля Guides

#### 1. ДВЕ раздельные функции для создания и редактирования
```javascript
// Функция создания (строка 9484)
function saveGuide() {
    const fullNameRu = safeGetValue('guideFullNameRu', '').trim();
    const fullNameEn = safeGetValue('guideFullNameEn', '').trim();
    
    const fullName = JSON.stringify({
        ru: fullNameRu,
        en: fullNameEn
    });
    
    // ... отправка POST /api/guide/create-with-auth
}

// Функция редактирования (строка 9011)
async function saveEditGuide() {
    const name = document.getElementById('editGuideFullName').value.trim();
    
    // ❌ ПРОБЛЕМА: дублирование языков
    const nameJson = JSON.stringify({
        ru: name,
        en: name  // Пока используем одно значение для обоих языков
    });
    
    // ... отправка PUT /api/guide/profile/{guideId}
}
```

**Критические проблемы:**
- ❌ **Дублирование кода**: ~80% логики повторяется в обеих функциях
- ❌ **Разные endpoints**: create-with-auth vs guide/profile/{id}
- ❌ **Разные поля формы**: guideFullNameRu/En vs editGuideFullName
- ❌ **Потеря данных в редактировании**: английское имя = русскому (комментарий: "Пока используем одно значение")

**Сравнение с Tours:**
```javascript
// Tours - ПРАВИЛЬНО: одна функция для обоих случаев
function saveTourForm() {
    const tourId = document.getElementById('tour-id').value;
    const isEditing = tourId && tourId.trim() !== '';
    
    const url = isEditing ? `${getApiUrl()}/tours/${tourId}` : `${getApiUrl()}/tours`;
    const method = isEditing ? 'PUT' : 'POST';
    
    // Единая логика обработки данных
}
```

#### 2. Отсутствие раздельных полей RU/EN в форме редактирования
```javascript
// Форма создания - ПРАВИЛЬНО
<input type="text" id="guideFullNameRu" placeholder="Иванов Иван Иванович">
<input type="text" id="guideFullNameEn" placeholder="John Smith">

// Форма редактирования - НЕПРАВИЛЬНО
<input type="text" id="editGuideFullName">  // Только одно поле!
```

**Проблема:** При редактировании невозможно отдельно редактировать русское и английское имя.

#### 3. Несогласованные поля между создан и редактированием
```javascript
// Создание
const commentsRu = safeGetValue('guideCommentsRu', '').trim();
const commentsEn = safeGetValue('guideCommentsEn', '').trim();

// Редактирование
const description = document.getElementById('editGuideComments').value.trim();
```

**Проблема:** Разные ID элементов для одних и тех же данных.

#### 4. Загрузка данных через openEditGuideModal()
```javascript
async function editGuide(id) {
    const response = await fetch(`${getApiUrl()}/guides/${id}?includeRaw=true`, {
        headers: getAuthHeaders()
    });
    const data = await response.json();
    const guide = data.data;
    
    // Открываем модальное окно редактирования
    openEditGuideModal(guide);
}
```

**Проблема:** Функция `openEditGuideModal(guide)` (строка 8618) создаёт огромное модальное окно через innerHTML, что усложняет код и делает его трудным для поддержки.

---

## 1.4 Сравнительная таблица: Tours vs Hotels vs Guides

| Критерий | Tours ✅ | Hotels ⚠️ | Guides ❌ |
|----------|---------|-----------|----------|
| **Единая функция save** | ✅ saveTourForm() | ❌ Inline submit | ❌ Две функции |
| **Отдельная функция load** | ⚠️ Встроена в openTourModal | ✅ loadHotelData() | ⚠️ Встроена в openEditGuideModal |
| **Многоязычные поля** | ✅ JSON.stringify({ru, en}) | ✅ JSON.stringify({ru, en}) | ⚠️ В редактировании ru=en |
| **Валидация** | ✅ Подробная | ✅ Подробная | ✅ Минимальная |
| **Helper функции** | ✅ safeGetValue, getSelectedCheckboxValues | ✅ Использует те же | ✅ Использует те же |
| **Работа с чекбоксами** | ✅ Унифицированная | ⚠️ Сложная (roomTypes) | ✅ Простая (языки) |
| **Работа с файлами** | ⬜ N/A | ⬜ N/A | ✅ FormData |
| **Страны/города** | ✅ Multiple select | ✅ Single select | ✅ Single select |
| **Изображения** | ✅ window.tourImageURLs | ✅ window.hotelImageURLs | ✅ FormData (avatar) |
| **Код повторно используется** | ⚠️ 60% | ❌ 30% | ❌ 40% |

### Оценка повторного использования кода:
- **Tours**: 60% - средний уровень, есть helper функции
- **Hotels**: 30% - низкий уровень, много дублирования для roomTypes/mealTypes
- **Guides**: 40% - низкий уровень, две раздельные функции создания/редактирования

---

## 1.5 Общие проблемы всех трёх модулей

### 1. Отсутствие централизованного управления состоянием
```javascript
// Разбросанные глобальные переменные
window.tourLanguages = [];
window.tourImageURLs = [];
window.hotelImageURLs = [];
let selectedGuideLanguages = [];
let guideAvatarFile = null;
```

**Проблема:** Нет единого места для хранения состояния модуля.

### 2. Дублирование кода для работы с API
```javascript
// Повторяется в каждой функции
fetch(`${getApiUrl()}/tours/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(formData)
})
.then(res => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
})
.then(data => {
    if (data.success) {
        alert('Успешно');
        // Закрыть модал
        // Обновить список
    }
})
.catch(err => {
    console.error('Error:', err);
    alert('Ошибка');
});
```

**Проблема:** Одинаковая структура fetch запросов повторяется 30+ раз в коде.

### 3. Разные подходы к каскадной загрузке городов
```javascript
// Tours
loadCountriesForTourForm()

// Hotels
loadCitiesForCountry(countryId, 'hotelCity')

// Guides
loadGuideCitiesByCountry()
loadEditGuideCitiesByCountry()
```

**Проблема:** Четыре разные функции для одной и той же задачи.

### 4. Отсутствие единого стандарта для чекбокс-групп
```javascript
// Tours - простые массивы
const selectedHotels = [];
document.querySelectorAll('input[name="selectedHotels"]:checked').forEach(checkbox => {
    selectedHotels.push(parseInt(checkbox.value));
});

// Hotels - сложные объекты с ценами
const roomTypes = {};
if (safeGetValue('roomSGL', false, 'checkbox')) {
    roomTypes.SGL = {
        name: 'Одноместный',
        price: safeGetValue('priceSGL', '', 'float')
    };
}
```

**Проблема:** Разные структуры данных для похожих задач.

### 5. Несогласованные названия функций
```javascript
// Закрытие модальных окон
closeTourModal()
closeHotelModal()
closeGuideModal()
closeEditGuideModal()

// Загрузка списков
loadTours()
loadHotels()
loadGuides()
```

**Хорошо:** Консистентные названия (хотя бы это!)

---

## Этап 2: Проектирование Единого Стандарта

### Философия Единого Стандарта

**Цель:** Создать набор универсальных, переиспользуемых функций, которые работают с любым типом сущностей (Tours, Hotels, Guides), устраняя дублирование кода и создавая консистентный API.

**Принципы:**
1. **Конфигурируемость** - функции принимают конфиг объекты
2. **Переиспользуемость** - один код для всех модулей
3. **Расширяемость** - легко добавить новые модули
4. **Безопасность** - валидация и обработка ошибок
5. **Читаемость** - понятные имена и структура

---

## 2.1 Архитектура helper-функций

### Структура файла `frontend/public/js/admin-helpers.js`

```javascript
// ==============================================
// ADMIN HELPERS - Единый стандарт обработки данных
// ==============================================

// ==================== СЕКЦИЯ 1: API UTILITIES ====================

// ==================== СЕКЦИЯ 2: FORM DATA COLLECTION ====================

// ==================== СЕКЦИЯ 3: FORM DATA LOADING ====================

// ==================== СЕКЦИЯ 4: VALIDATION ====================

// ==================== СЕКЦИЯ 5: UI UTILITIES ====================

// ==================== СЕКЦИЯ 6: LOCATION (Countries/Cities) ====================

// ==================== СЕКЦИЯ 7: SPECIALIZED HELPERS ====================
```

---

## 2.2 Детальное описание функций

### СЕКЦИЯ 1: API UTILITIES

#### 1.1 `apiRequest(config)`

**Назначение:** Универсальная функция для всех API запросов с единообразной обработкой ошибок.

**Сигнатура:**
```javascript
/**
 * Универсальный API запрос
 * @param {Object} config - Конфигурация запроса
 * @param {string} config.url - URL endpoint (относительный или абсолютный)
 * @param {string} [config.method='GET'] - HTTP метод
 * @param {Object|FormData} [config.body] - Тело запроса
 * @param {boolean} [config.isFormData=false] - Использовать ли FormData
 * @param {boolean} [config.includeAuth=true] - Добавлять ли Authorization header
 * @param {Function} [config.onSuccess] - Callback при успехе
 * @param {Function} [config.onError] - Callback при ошибке
 * @returns {Promise<Object>} - Response data
 */
async function apiRequest(config) {
    const {
        url,
        method = 'GET',
        body = null,
        isFormData = false,
        includeAuth = true,
        onSuccess = null,
        onError = null
    } = config;
    
    try {
        const fullUrl = url.startsWith('http') ? url : `${getApiUrl()}${url}`;
        
        // Подготовка заголовков
        const headers = includeAuth ? getAuthHeaders() : {};
        
        // Для FormData удаляем Content-Type (браузер установит сам)
        if (isFormData && headers['Content-Type']) {
            delete headers['Content-Type'];
        }
        
        // Подготовка тела запроса
        let requestBody = body;
        if (body && !isFormData) {
            requestBody = JSON.stringify(body);
        }
        
        // Выполнение запроса
        const response = await fetch(fullUrl, {
            method,
            headers,
            ...(body && { body: requestBody })
        });
        
        // Обработка ответа
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Проверка success флага
        if (data.success === false) {
            throw new Error(data.message || 'Operation failed');
        }
        
        // Callback успеха
        if (onSuccess) {
            onSuccess(data);
        }
        
        return data;
        
    } catch (error) {
        console.error('API Request Error:', error);
        
        // Callback ошибки
        if (onError) {
            onError(error);
        } else {
            // Дефолтная обработка ошибки
            alert(`Ошибка: ${error.message}`);
        }
        
        throw error;
    }
}
```

**Использование:**
```javascript
// GET запрос
const tours = await apiRequest({
    url: '/tours',
    onSuccess: (data) => console.log('Tours loaded:', data.data)
});

// POST запрос с JSON
await apiRequest({
    url: '/tours',
    method: 'POST',
    body: { title: JSON.stringify({ru: "Тур", en: "Tour"}) },
    onSuccess: () => alert('Тур создан!')
});

// POST с FormData (файлы)
const formData = new FormData();
formData.append('avatar', fileInput.files[0]);
await apiRequest({
    url: '/guide/create-with-auth',
    method: 'POST',
    body: formData,
    isFormData: true
});
```

---

### СЕКЦИЯ 2: FORM DATA COLLECTION

#### 2.1 `collectFormData(config)`

**Назначение:** Универсальный сбор данных из формы на основе конфигурации.

**Сигнатура:**
```javascript
/**
 * Сбор данных из формы
 * @param {Object} config - Конфигурация полей
 * @param {Object} config.fields - Описание полей для сбора
 * @param {string} [config.entityId] - ID сущности (для редактирования)
 * @param {boolean} [config.useFormData=false] - Использовать FormData вместо Object
 * @returns {Object|FormData} - Собранные данные
 */
function collectFormData(config) {
    const {
        fields,
        entityId = null,
        useFormData = false
    } = config;
    
    const data = useFormData ? new FormData() : {};
    const isEditing = entityId && entityId.trim() !== '';
    
    // Проход по всем полям из конфигурации
    for (const [key, fieldConfig] of Object.entries(fields)) {
        const {
            type,        // 'text', 'multilingual', 'checkbox', 'checkboxGroup', 'number', 'file', 'array'
            elementId,   // ID элемента или массив ID для multilingual
            required = false,
            defaultValue = null,
            transform = null  // Функция преобразования значения
        } = fieldConfig;
        
        let value = null;
        
        switch (type) {
            case 'text':
            case 'number':
                value = safeGetValue(elementId, defaultValue, type === 'number' ? 'float' : null);
                break;
                
            case 'multilingual':
                // Ожидаем массив: ['titleRu', 'titleEn']
                const [ruId, enId] = elementId;
                const ruValue = safeGetValue(ruId, '');
                const enValue = safeGetValue(enId, ruValue); // fallback на RU
                
                value = JSON.stringify({
                    ru: ruValue,
                    en: enValue
                });
                break;
                
            case 'checkbox':
                value = safeGetValue(elementId, false, 'checkbox');
                break;
                
            case 'checkboxGroup':
                // Сбор выбранных значений из группы чекбоксов
                const checkboxes = document.querySelectorAll(`input[name="${elementId}"]:checked`);
                const selected = Array.from(checkboxes).map(cb => parseInt(cb.value) || cb.value);
                value = JSON.stringify(selected);
                break;
                
            case 'checkboxGroupWithPrices':
                // Специальный тип для roomTypes/mealTypes
                value = collectCheckboxGroupWithPrices(elementId);
                break;
                
            case 'array':
                // Сбор массива из глобальной переменной
                value = JSON.stringify(window[elementId] || []);
                break;
                
            case 'file':
                // Файлы добавляются только в FormData
                if (useFormData && window[elementId]) {
                    if (Array.isArray(window[elementId])) {
                        window[elementId].forEach(file => data.append(key, file));
                    } else {
                        data.append(key, window[elementId]);
                    }
                    continue; // Пропускаем обычное добавление
                }
                break;
        }
        
        // Валидация обязательных полей
        if (required && !value) {
            throw new Error(`Field "${key}" is required`);
        }
        
        // Применяем функцию трансформации если есть
        if (transform && value !== null) {
            value = transform(value);
        }
        
        // Добавляем в data
        if (useFormData) {
            data.append(key, value);
        } else {
            data[key] = value;
        }
    }
    
    return data;
}
```

**Конфигурация для Tours:**
```javascript
const tourFieldsConfig = {
    title: {
        type: 'multilingual',
        elementId: ['tourTitleRu', 'tourTitleEn'],
        required: true
    },
    description: {
        type: 'multilingual',
        elementId: ['tourDescRu', 'tourDescEn'],
        required: true
    },
    price: {
        type: 'number',
        elementId: 'tourPrice',
        required: true
    },
    durationDays: {
        type: 'number',
        elementId: 'tourDurationDays',
        required: true
    },
    categoryId: {
        type: 'number',
        elementId: 'tourCategory',
        required: true
    },
    hotelIds: {
        type: 'checkboxGroup',
        elementId: 'selectedHotels'
    },
    guideIds: {
        type: 'checkboxGroup',
        elementId: 'selectedGuides'
    },
    images: {
        type: 'array',
        elementId: 'tourImageURLs'
    },
    languages: {
        type: 'array',
        elementId: 'tourLanguages'
    }
};

// Использование
try {
    const tourData = collectFormData({
        fields: tourFieldsConfig,
        entityId: document.getElementById('tour-id').value
    });
    
    console.log('Collected tour data:', tourData);
} catch (error) {
    alert(`Ошибка валидации: ${error.message}`);
}
```

**Конфигурация для Hotels:**
```javascript
const hotelFieldsConfig = {
    name: {
        type: 'multilingual',
        elementId: ['hotelNameRu', 'hotelNameEn'],
        required: true
    },
    description: {
        type: 'multilingual',
        elementId: ['hotelDescRu', 'hotelDescEn'],
        required: true
    },
    stars: {
        type: 'number',
        elementId: 'hotelStars',
        required: true
    },
    countryId: {
        type: 'number',
        elementId: 'hotelCountry',
        required: true
    },
    cityId: {
        type: 'number',
        elementId: 'hotelCity',
        required: true
    },
    roomTypes: {
        type: 'checkboxGroupWithPrices',
        elementId: {
            prefix: 'room',
            types: ['SGL', 'TWL', 'DBL']
        }
    },
    mealTypes: {
        type: 'checkboxGroupWithPrices',
        elementId: {
            prefix: 'meal',
            types: ['RO', 'BB', 'HB', 'FB', 'AI']
        }
    },
    amenities: {
        type: 'checkboxGroup',
        elementId: 'hotelAmenities'
    },
    images: {
        type: 'array',
        elementId: 'hotelImageURLs'
    }
};
```

**Конфигурация для Guides:**
```javascript
const guideFieldsConfig = {
    name: {
        type: 'multilingual',
        elementId: ['guideFullNameRu', 'guideFullNameEn'],
        required: true
    },
    description: {
        type: 'multilingual',
        elementId: ['guideCommentsRu', 'guideCommentsEn']
    },
    email: {
        type: 'text',
        elementId: 'guideEmail',
        required: true
    },
    phone: {
        type: 'text',
        elementId: 'guidePhone'
    },
    experience: {
        type: 'number',
        elementId: 'guideExperience',
        defaultValue: 0
    },
    countryId: {
        type: 'number',
        elementId: 'guideCountry',
        required: true
    },
    cityId: {
        type: 'number',
        elementId: 'guideCity',
        required: true
    },
    languages: {
        type: 'array',
        elementId: 'selectedGuideLanguages'
    },
    avatar: {
        type: 'file',
        elementId: 'guideAvatarFile'
    },
    documents: {
        type: 'file',
        elementId: 'guideDocumentFiles'
    }
};
```

#### 2.2 `collectCheckboxGroupWithPrices(config)`

**Назначение:** Специализированная функция для сбора чекбоксов с ценами (для roomTypes/mealTypes).

**Сигнатура:**
```javascript
/**
 * Сбор чекбоксов с ценами (roomTypes/mealTypes)
 * @param {Object} config - Конфигурация группы
 * @param {string} config.prefix - Префикс ID ('room', 'meal')
 * @param {Array<string>} config.types - Типы для проверки (['SGL', 'TWL', 'DBL'])
 * @returns {string} - JSON строка с объектом типов и цен
 */
function collectCheckboxGroupWithPrices(config) {
    const { prefix, types } = config;
    const result = {};
    
    types.forEach(type => {
        const checkboxId = `${prefix}${type}`;
        const priceId = `price${type}`;
        
        if (safeGetValue(checkboxId, false, 'checkbox')) {
            const price = safeGetValue(priceId, 0, 'float');
            
            if (price && !isNaN(price)) {
                result[type] = {
                    name: getTypeName(prefix, type), // Helper для получения названия
                    price: price
                };
            }
        }
    });
    
    return JSON.stringify(result);
}

/**
 * Helper для получения названий типов
 */
function getTypeName(prefix, type) {
    const names = {
        room: {
            SGL: 'Одноместный',
            TWL: 'Двухместный',
            DBL: 'Двухспальный'
        },
        meal: {
            RO: 'Без питания',
            BB: 'Завтрак',
            HB: 'Полупансион',
            FB: 'Полный пансион',
            AI: 'Всё включено'
        }
    };
    
    return names[prefix]?.[type] || type;
}
```

**Использование:**
```javascript
// Для Hotels
const roomTypes = collectCheckboxGroupWithPrices({
    prefix: 'room',
    types: ['SGL', 'TWL', 'DBL']
});

const mealTypes = collectCheckboxGroupWithPrices({
    prefix: 'meal',
    types: ['RO', 'BB', 'HB', 'FB', 'AI']
});
```

---

### СЕКЦИЯ 3: FORM DATA LOADING

#### 3.1 `loadEntityData(config)`

**Назначение:** Универсальная загрузка данных сущности и заполнение формы.

**Сигнатура:**
```javascript
/**
 * Загрузка данных сущности для редактирования
 * @param {Object} config - Конфигурация загрузки
 * @param {string} config.entityType - Тип сущности ('tours', 'hotels', 'guides')
 * @param {number} config.entityId - ID сущности
 * @param {Object} config.fields - Конфигурация полей (та же что в collectFormData)
 * @param {Function} [config.onLoaded] - Callback после загрузки
 * @param {Function} [config.beforeFill] - Callback перед заполнением формы
 * @returns {Promise<Object>} - Загруженные данные
 */
async function loadEntityData(config) {
    const {
        entityType,
        entityId,
        fields,
        onLoaded = null,
        beforeFill = null
    } = config;
    
    try {
        // Загрузка данных
        const response = await apiRequest({
            url: `/${entityType}/${entityId}?includeRaw=true`
        });
        
        const entity = response.data;
        
        // Callback перед заполнением
        if (beforeFill) {
            beforeFill(entity);
        }
        
        // Заполнение формы
        for (const [key, fieldConfig] of Object.entries(fields)) {
            const value = entity[key];
            if (value === null || value === undefined) continue;
            
            fillFormField(fieldConfig, value);
        }
        
        // Callback после загрузки
        if (onLoaded) {
            onLoaded(entity);
        }
        
        return entity;
        
    } catch (error) {
        console.error('Error loading entity:', error);
        throw error;
    }
}

/**
 * Helper для заполнения одного поля формы
 */
function fillFormField(fieldConfig, value) {
    const { type, elementId } = fieldConfig;
    
    switch (type) {
        case 'text':
        case 'number':
            const element = document.getElementById(elementId);
            if (element) {
                element.value = value || '';
            }
            break;
            
        case 'multilingual':
            // Парсим JSON и заполняем оба поля
            let parsed = value;
            if (typeof value === 'string') {
                try {
                    parsed = JSON.parse(value);
                } catch (e) {
                    parsed = { ru: value, en: value };
                }
            }
            
            const [ruId, enId] = elementId;
            const ruEl = document.getElementById(ruId);
            const enEl = document.getElementById(enId);
            
            if (ruEl) ruEl.value = parsed.ru || '';
            if (enEl) enEl.value = parsed.en || '';
            break;
            
        case 'checkbox':
            const checkbox = document.getElementById(elementId);
            if (checkbox) {
                checkbox.checked = !!value;
            }
            break;
            
        case 'checkboxGroup':
            // Парсим массив и отмечаем соответствующие чекбоксы
            let selected = value;
            if (typeof value === 'string') {
                try {
                    selected = JSON.parse(value);
                } catch (e) {
                    selected = [];
                }
            }
            
            if (Array.isArray(selected)) {
                document.querySelectorAll(`input[name="${elementId}"]`).forEach(cb => {
                    cb.checked = selected.includes(parseInt(cb.value) || cb.value);
                });
            }
            break;
            
        case 'checkboxGroupWithPrices':
            fillCheckboxGroupWithPrices(elementId, value);
            break;
            
        case 'array':
            // Сохраняем массив в глобальную переменную
            let arr = value;
            if (typeof value === 'string') {
                try {
                    arr = JSON.parse(value);
                } catch (e) {
                    arr = [];
                }
            }
            window[elementId] = arr;
            
            // Вызываем функцию обновления UI если есть
            const updateFunc = `update${capitalizeFirst(elementId)}`;
            if (typeof window[updateFunc] === 'function') {
                window[updateFunc]();
            }
            break;
    }
}

/**
 * Заполнение чекбоксов с ценами (roomTypes/mealTypes)
 */
function fillCheckboxGroupWithPrices(config, value) {
    const { prefix, types } = config;
    
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch (e) {
            parsed = {};
        }
    }
    
    types.forEach(type => {
        const checkboxId = `${prefix}${type}`;
        const priceId = `price${type}`;
        
        const checkbox = document.getElementById(checkboxId);
        const priceInput = document.getElementById(priceId);
        
        if (parsed[type]) {
            if (checkbox) {
                checkbox.checked = true;
            }
            if (priceInput) {
                priceInput.disabled = false;
                priceInput.value = parsed[type].price || '';
            }
        } else {
            if (checkbox) {
                checkbox.checked = false;
            }
            if (priceInput) {
                priceInput.disabled = true;
                priceInput.value = '';
            }
        }
    });
}

/**
 * Helper для capitalize
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
```

**Использование для Tours:**
```javascript
// В функции editTour(id)
await loadEntityData({
    entityType: 'tours',
    entityId: id,
    fields: tourFieldsConfig,
    beforeFill: (tour) => {
        // Очистка чекбоксов перед загрузкой
        document.querySelectorAll('input[name="selectedHotels"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('input[name="selectedGuides"]').forEach(cb => cb.checked = false);
    },
    onLoaded: (tour) => {
        console.log('Tour loaded:', tour);
        // Установить ID тура в скрытое поле
        document.getElementById('tour-id').value = tour.id;
    }
});
```

**Использование для Hotels:**
```javascript
// В функции editHotel(id)
await loadEntityData({
    entityType: 'hotels',
    entityId: id,
    fields: hotelFieldsConfig,
    onLoaded: (hotel) => {
        // Загрузка городов для выбранной страны
        if (hotel.countryId) {
            setupCountryCityDropdowns({
                countryFieldId: 'hotelCountry',
                cityFieldId: 'hotelCity',
                selectedCountryId: hotel.countryId,
                selectedCityId: hotel.cityId
            });
        }
    }
});
```

**Использование для Guides:**
```javascript
// В функции editGuide(id)
await loadEntityData({
    entityType: 'guides',
    entityId: id,
    fields: guideFieldsConfig,
    onLoaded: (guide) => {
        // Загрузка городов
        if (guide.countryId) {
            setupCountryCityDropdowns({
                countryFieldId: 'editGuideCountry',
                cityFieldId: 'editGuideCity',
                selectedCountryId: guide.countryId,
                selectedCityId: guide.cityId
            });
        }
    }
});
```

---

### СЕКЦИЯ 4: VALIDATION

#### 4.1 `validateFormData(config)`

**Назначение:** Валидация собранных данных перед отправкой.

**Сигнатура:**
```javascript
/**
 * Валидация данных формы
 * @param {Object} config - Конфигурация валидации
 * @param {Object} config.data - Данные для валидации
 * @param {Object} config.rules - Правила валидации
 * @returns {Object} - { isValid: boolean, errors: Array<string> }
 */
function validateFormData(config) {
    const { data, rules } = config;
    const errors = [];
    
    for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        
        // Required check
        if (rule.required && !value) {
            errors.push(`${rule.label || field} является обязательным полем`);
            continue;
        }
        
        // Min/Max для чисел
        if (rule.min !== undefined && parseFloat(value) < rule.min) {
            errors.push(`${rule.label || field} должно быть не меньше ${rule.min}`);
        }
        
        if (rule.max !== undefined && parseFloat(value) > rule.max) {
            errors.push(`${rule.label || field} должно быть не больше ${rule.max}`);
        }
        
        // Email validation
        if (rule.email && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                errors.push(`${rule.label || field} должен быть корректным email`);
            }
        }
        
        // Custom validator
        if (rule.validator && typeof rule.validator === 'function') {
            const customError = rule.validator(value, data);
            if (customError) {
                errors.push(customError);
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}
```

**Примеры правил валидации:**
```javascript
const tourValidationRules = {
    price: {
        required: true,
        label: 'Цена тура',
        min: 0,
        validator: (value) => {
            if (isNaN(value)) return 'Цена должна быть числом';
            return null;
        }
    },
    durationDays: {
        required: true,
        label: 'Длительность тура',
        min: 1,
        max: 365
    }
};

const hotelValidationRules = {
    stars: {
        required: true,
        label: 'Звёзды отеля',
        min: 1,
        max: 5
    }
};

const guideValidationRules = {
    email: {
        required: true,
        label: 'Email гида',
        email: true
    },
    experience: {
        label: 'Опыт работы',
        min: 0,
        max: 50
    }
};
```

---

### СЕКЦИЯ 5: UI UTILITIES

#### 5.1 `initEntityForm(config)`

**Назначение:** Главная функция инициализации формы (связывает submit, загрузку, сохранение).

**Сигнатура:**
```javascript
/**
 * Инициализация формы сущности
 * @param {Object} config - Конфигурация формы
 * @param {string} config.formId - ID формы
 * @param {string} config.entityType - Тип сущности
 * @param {string} config.entityIdFieldId - ID скрытого поля с ID сущности
 * @param {Object} config.fields - Конфигурация полей
 * @param {Object} [config.validationRules] - Правила валидации
 * @param {Function} [config.onBeforeSave] - Callback перед сохранением
 * @param {Function} [config.onAfterSave] - Callback после сохранения
 * @param {boolean} [config.useFormData=false] - Использовать FormData
 */
function initEntityForm(config) {
    const {
        formId,
        entityType,
        entityIdFieldId,
        fields,
        validationRules = {},
        onBeforeSave = null,
        onAfterSave = null,
        useFormData = false
    } = config;
    
    const form = document.getElementById(formId);
    if (!form) {
        console.error(`Form "${formId}" not found`);
        return;
    }
    
    // Обработчик submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            // Определяем режим (создание/редактирование)
            const entityIdField = document.getElementById(entityIdFieldId);
            const entityId = entityIdField ? entityIdField.value : null;
            const isEditing = entityId && entityId.trim() !== '';
            
            // Сбор данных
            const data = collectFormData({
                fields,
                entityId,
                useFormData
            });
            
            // Валидация (если не FormData)
            if (!useFormData && Object.keys(validationRules).length > 0) {
                const validation = validateFormData({
                    data,
                    rules: validationRules
                });
                
                if (!validation.isValid) {
                    alert('Ошибки валидации:\n' + validation.errors.join('\n'));
                    return;
                }
            }
            
            // Callback перед сохранением
            if (onBeforeSave) {
                const shouldContinue = onBeforeSave(data, isEditing);
                if (shouldContinue === false) return;
            }
            
            // Отправка данных
            const url = isEditing 
                ? `/${entityType}/${entityId}` 
                : `/${entityType}`;
            const method = isEditing ? 'PUT' : 'POST';
            
            await apiRequest({
                url,
                method,
                body: data,
                isFormData: useFormData,
                onSuccess: (response) => {
                    const action = isEditing ? 'обновлена' : 'создана';
                    alert(`Сущность успешно ${action}!`);
                    
                    // Callback после сохранения
                    if (onAfterSave) {
                        onAfterSave(response, isEditing);
                    }
                }
            });
            
        } catch (error) {
            console.error('Form submission error:', error);
        }
    });
}
```

**Использование для Tours:**
```javascript
// В DOMContentLoaded или при загрузке модуля
initEntityForm({
    formId: 'tourForm',
    entityType: 'tours',
    entityIdFieldId: 'tour-id',
    fields: tourFieldsConfig,
    validationRules: tourValidationRules,
    onAfterSave: (response, isEditing) => {
        closeTourModal();
        loadTours(); // Обновляем список
    }
});
```

**Использование для Hotels:**
```javascript
initEntityForm({
    formId: 'hotelForm',
    entityType: 'hotels',
    entityIdFieldId: 'hotel-id',
    fields: hotelFieldsConfig,
    validationRules: hotelValidationRules,
    onAfterSave: () => {
        closeHotelModal();
        loadHotels();
    }
});
```

**Использование для Guides:**
```javascript
initEntityForm({
    formId: 'guideForm',
    entityType: 'guide/create-with-auth', // Специальный endpoint
    entityIdFieldId: 'guide-id',
    fields: guideFieldsConfig,
    validationRules: guideValidationRules,
    useFormData: true, // Для файлов
    onAfterSave: () => {
        closeGuideModal();
        loadGuides();
    }
});
```

#### 5.2 `handleCheckboxGroup(config)`

**Назначение:** Универсальная обработка группы чекбоксов (добавление, удаление, отображение).

**Сигнатура:**
```javascript
/**
 * Управление группой чекбоксов
 * @param {Object} config - Конфигурация группы
 * @param {string} config.containerElement - ID контейнера для отображения
 * @param {string} config.selectElement - ID select элемента для добавления
 * @param {string} config.variableName - Имя глобальной переменной для хранения
 * @param {Function} [config.onAdd] - Callback при добавлении
 * @param {Function} [config.onRemove] - Callback при удалении
 */
function handleCheckboxGroup(config) {
    const {
        containerElement,
        selectElement,
        variableName,
        onAdd = null,
        onRemove = null
    } = config;
    
    // Инициализация глобальной переменной
    if (!window[variableName]) {
        window[variableName] = [];
    }
    
    // Функция добавления элемента
    const addItem = () => {
        const select = document.getElementById(selectElement);
        const value = select.value;
        const text = select.options[select.selectedIndex].text;
        
        if (!value) return;
        
        if (!window[variableName].includes(value)) {
            window[variableName].push(value);
            
            if (onAdd) {
                onAdd(value, text);
            }
            
            updateDisplay();
        }
        
        select.value = '';
    };
    
    // Функция удаления элемента
    const removeItem = (value) => {
        const index = window[variableName].indexOf(value);
        if (index > -1) {
            window[variableName].splice(index, 1);
            
            if (onRemove) {
                onRemove(value);
            }
            
            updateDisplay();
        }
    };
    
    // Функция обновления отображения
    const updateDisplay = () => {
        const container = document.getElementById(containerElement);
        if (!container) return;
        
        if (window[variableName].length === 0) {
            container.innerHTML = '<small class="text-gray-500">Ничего не выбрано</small>';
            return;
        }
        
        container.innerHTML = window[variableName].map(item => `
            <div class="flex items-center justify-between bg-gray-50 p-2 rounded">
                <span>${item}</span>
                <button type="button" onclick="window.removeFrom${capitalizeFirst(variableName)}('${item}')" 
                        class="text-red-500 hover:text-red-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    };
    
    // Создаём глобальные функции для доступа из HTML
    window[`addTo${capitalizeFirst(variableName)}`] = addItem;
    window[`removeFrom${capitalizeFirst(variableName)}`] = removeItem;
    window[`update${capitalizeFirst(variableName)}Display`] = updateDisplay;
    
    // Начальное отображение
    updateDisplay();
    
    return {
        addItem,
        removeItem,
        updateDisplay
    };
}
```

**Использование для языков тура:**
```javascript
handleCheckboxGroup({
    containerElement: 'selectedLanguages',
    selectElement: 'availableLanguages',
    variableName: 'tourLanguages'
});

// В HTML:
// <button onclick="window.addToTourLanguages()">Добавить язык</button>
```

---

### СЕКЦИЯ 6: LOCATION (Countries/Cities)

#### 6.1 `setupCountryCityDropdowns(config)`

**Назначение:** Настройка каскадных выпадающих списков стран и городов.

**Сигнатура:**
```javascript
/**
 * Настройка каскадных dropdown'ов для стран и городов
 * @param {Object} config - Конфигурация
 * @param {string} config.countryFieldId - ID поля страны
 * @param {string} config.cityFieldId - ID поля города
 * @param {number} [config.selectedCountryId] - Предустановленная страна (для редактирования)
 * @param {number} [config.selectedCityId] - Предустановленный город (для редактирования)
 * @param {Function} [config.onCountryChange] - Callback при смене страны
 * @param {Function} [config.onCityChange] - Callback при смене города
 * @returns {Promise<void>}
 */
async function setupCountryCityDropdowns(config) {
    const {
        countryFieldId,
        cityFieldId,
        selectedCountryId = null,
        selectedCityId = null,
        onCountryChange = null,
        onCityChange = null
    } = config;
    
    const countryField = document.getElementById(countryFieldId);
    const cityField = document.getElementById(cityFieldId);
    
    if (!countryField || !cityField) {
        console.error('Country or city field not found');
        return;
    }
    
    try {
        // Загрузка стран
        const countriesData = await apiRequest({
            url: '/countries'
        });
        
        const countries = countriesData.data || [];
        
        // Заполняем select стран
        countryField.innerHTML = '<option value="">Выберите страну</option>' +
            countries.map(country => {
                const countryName = parseMultilingualField(country.name, 'ru');
                return `<option value="${country.id}">${countryName}</option>`;
            }).join('');
        
        // Функция загрузки городов
        const loadCities = async (countryId) => {
            if (!countryId) {
                cityField.innerHTML = '<option value="">Сначала выберите страну</option>';
                cityField.disabled = true;
                return;
            }
            
            const citiesData = await apiRequest({
                url: `/cities?countryId=${countryId}`
            });
            
            const cities = citiesData.data || [];
            
            cityField.innerHTML = '<option value="">Выберите город</option>' +
                cities.map(city => {
                    const cityName = city.nameRu || city.name;
                    return `<option value="${city.id}">${cityName}</option>`;
                }).join('');
            
            cityField.disabled = false;
            
            // Устанавливаем выбранный город если есть
            if (selectedCityId) {
                cityField.value = selectedCityId;
            }
        };
        
        // Обработчик изменения страны
        countryField.addEventListener('change', async (e) => {
            const countryId = e.target.value;
            await loadCities(countryId);
            
            if (onCountryChange) {
                onCountryChange(countryId);
            }
        });
        
        // Обработчик изменения города
        if (onCityChange) {
            cityField.addEventListener('change', (e) => {
                onCityChange(e.target.value);
            });
        }
        
        // Установка начальных значений
        if (selectedCountryId) {
            countryField.value = selectedCountryId;
            await loadCities(selectedCountryId);
        }
        
    } catch (error) {
        console.error('Error setting up country/city dropdowns:', error);
    }
}

/**
 * Helper для парсинга многоязычных полей
 */
function parseMultilingualField(field, lang = 'ru') {
    if (!field) return '';
    
    if (typeof field === 'string') {
        try {
            const parsed = JSON.parse(field);
            return parsed[lang] || parsed.ru || parsed.en || '';
        } catch (e) {
            return field;
        }
    }
    
    if (typeof field === 'object') {
        return field[lang] || field.ru || field.en || '';
    }
    
    return '';
}
```

**Использование:**
```javascript
// Для Tours (при создании)
setupCountryCityDropdowns({
    countryFieldId: 'tourCountry',
    cityFieldId: 'tourCity'
});

// Для Hotels (при редактировании)
setupCountryCityDropdowns({
    countryFieldId: 'hotelCountry',
    cityFieldId: 'hotelCity',
    selectedCountryId: hotel.countryId,
    selectedCityId: hotel.cityId
});

// Для Guides (с callback)
setupCountryCityDropdowns({
    countryFieldId: 'guideCountry',
    cityFieldId: 'guideCity',
    onCityChange: (cityId) => {
        console.log('City changed to:', cityId);
    }
});
```

---

### СЕКЦИЯ 7: SPECIALIZED HELPERS

#### 7.1 `createMultilingualObject(config)`

**Назначение:** Создание многоязычного JSON объекта из полей формы.

**Сигнатура:**
```javascript
/**
 * Создание многоязычного объекта
 * @param {Object} config - Конфигурация
 * @param {string} config.ruFieldId - ID русского поля
 * @param {string} config.enFieldId - ID английского поля
 * @param {boolean} [config.stringify=true] - Возвращать JSON строку или объект
 * @param {boolean} [config.fallbackToRu=true] - Использовать RU значение если EN пустое
 * @returns {string|Object} - JSON строка или объект
 */
function createMultilingualObject(config) {
    const {
        ruFieldId,
        enFieldId,
        stringify = true,
        fallbackToRu = true
    } = config;
    
    const ruValue = safeGetValue(ruFieldId, '');
    const enValue = safeGetValue(enFieldId, fallbackToRu ? ruValue : '');
    
    const obj = {
        ru: ruValue,
        en: enValue
    };
    
    return stringify ? JSON.stringify(obj) : obj;
}
```

**Использование:**
```javascript
// Для title тура
const title = createMultilingualObject({
    ruFieldId: 'tourTitleRu',
    enFieldId: 'tourTitleEn'
});

// Для description отеля
const description = createMultilingualObject({
    ruFieldId: 'hotelDescRu',
    enFieldId: 'hotelDescEn'
});

// Получить объект (не строку)
const nameObj = createMultilingualObject({
    ruFieldId: 'guideFullNameRu',
    enFieldId: 'guideFullNameEn',
    stringify: false
});
```

#### 7.2 `clearFormFields(formId)`

**Назначение:** Очистка всех полей формы и связанных глобальных переменных.

**Сигнатура:**
```javascript
/**
 * Очистка формы
 * @param {string} formId - ID формы
 * @param {Array<string>} [globalVariables=[]] - Массив имён глобальных переменных для очистки
 */
function clearFormFields(formId, globalVariables = []) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    // Сброс формы
    form.reset();
    
    // Очистка всех чекбоксов
    form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Очистка глобальных переменных
    globalVariables.forEach(varName => {
        if (Array.isArray(window[varName])) {
            window[varName] = [];
        } else if (typeof window[varName] === 'object') {
            window[varName] = {};
        } else {
            window[varName] = null;
        }
    });
}
```

**Использование:**
```javascript
// Очистка формы тура
clearFormFields('tourForm', [
    'tourImageURLs',
    'tourLanguages',
    'tourItinerary',
    'tourStartTimes'
]);

// Очистка формы отеля
clearFormFields('hotelForm', [
    'hotelImageURLs'
]);

// Очистка формы гида
clearFormFields('guideForm', [
    'selectedGuideLanguages',
    'guideAvatarFile',
    'guideDocumentFiles'
]);
```

---

## 2.3 Итоговая структура admin-helpers.js

```javascript
// ==============================================
// ADMIN HELPERS - Единый стандарт обработки данных
// Version: 1.0
// ==============================================

// ==================== СЕКЦИЯ 1: API UTILITIES ====================
async function apiRequest(config) { /* ... */ }

// ==================== СЕКЦИЯ 2: FORM DATA COLLECTION ====================
function collectFormData(config) { /* ... */ }
function collectCheckboxGroupWithPrices(config) { /* ... */ }
function getTypeName(prefix, type) { /* ... */ }

// ==================== СЕКЦИЯ 3: FORM DATA LOADING ====================
async function loadEntityData(config) { /* ... */ }
function fillFormField(fieldConfig, value) { /* ... */ }
function fillCheckboxGroupWithPrices(config, value) { /* ... */ }
function capitalizeFirst(str) { /* ... */ }

// ==================== СЕКЦИЯ 4: VALIDATION ====================
function validateFormData(config) { /* ... */ }

// ==================== СЕКЦИЯ 5: UI UTILITIES ====================
function initEntityForm(config) { /* ... */ }
function handleCheckboxGroup(config) { /* ... */ }

// ==================== СЕКЦИЯ 6: LOCATION (Countries/Cities) ====================
async function setupCountryCityDropdowns(config) { /* ... */ }
function parseMultilingualField(field, lang = 'ru') { /* ... */ }

// ==================== СЕКЦИЯ 7: SPECIALIZED HELPERS ====================
function createMultilingualObject(config) { /* ... */ }
function clearFormFields(formId, globalVariables = []) { /* ... */ }

// ==============================================
// EXPORT (если используется как модуль)
// ==============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        apiRequest,
        collectFormData,
        loadEntityData,
        validateFormData,
        initEntityForm,
        handleCheckboxGroup,
        setupCountryCityDropdowns,
        createMultilingualObject,
        clearFormFields
    };
}
```

---

## Этап 3: Пошаговый план рефакторинга

### Общая стратегия

Рефакторинг будет проводиться **итеративно** по модулям в следующем порядке:
1. **Hotels** (средняя сложность, хорошая точка старта)
2. **Guides** (высокая сложность из-за файлов и двух функций)
3. **Tours** (улучшение уже хорошего кода)

После каждого модуля проводится **тестирование** перед переходом к следующему.

---

### Фаза 0: Подготовка (1-2 часа)

#### Шаг 0.1: Создание файла admin-helpers.js
- Создать `frontend/public/js/admin-helpers.js`
- Реализовать все функции из Этапа 2
- Добавить JSDoc комментарии для каждой функции

#### Шаг 0.2: Подключение в admin-dashboard.html
```html
<!-- В секции <head>, после i18n.js и utils.js -->
<script src="/public/js/admin-helpers.js"></script>
```

#### Шаг 0.3: Создание конфигурационных объектов
Создать секцию в начале `<script>` блока admin-dashboard.html:

```javascript
// ==============================================
// CONFIGURATIONS FOR ADMIN HELPERS
// ==============================================

// Tours configuration
const tourFieldsConfig = { /* ... */ };
const tourValidationRules = { /* ... */ };

// Hotels configuration
const hotelFieldsConfig = { /* ... */ };
const hotelValidationRules = { /* ... */ };

// Guides configuration
const guideFieldsConfig = { /* ... */ };
const guideValidationRules = { /* ... */ };
```

#### Шаг 0.4: Создание резервной копии
```bash
cp frontend/admin-dashboard.html frontend/admin-dashboard.html.backup
```

---

### Фаза 1: Рефакторинг модуля Hotels (3-4 часа)

#### Шаг 1.1: Рефакторинг функции сохранения отеля

**Текущий код (строки 7066+):**
```javascript
document.getElementById('hotelForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // 100+ строк встроенного кода
    const name = { /* ... */ };
    const description = { /* ... */ };
    // ...
    
    fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(hotelData)
    })
    .then(...)
    .catch(...);
});
```

**Новый код:**
```javascript
// Инициализация формы отеля с использованием helper
initEntityForm({
    formId: 'hotelForm',
    entityType: 'hotels',
    entityIdFieldId: 'hotel-id',
    fields: hotelFieldsConfig,
    validationRules: hotelValidationRules,
    onBeforeSave: (data, isEditing) => {
        console.log('Saving hotel:', data);
        // Дополнительная логика перед сохранением если нужна
        return true; // Continue
    },
    onAfterSave: (response, isEditing) => {
        const action = isEditing ? 'обновлён' : 'создан';
        alert(`Отель успешно ${action}!`);
        closeHotelModal();
        loadHotels();
    }
});
```

**Результат:**
- ❌ Удалено: ~100 строк встроенного кода
- ✅ Добавлено: 15 строк конфигурации
- ✅ Выигрыш: -85 строк кода

#### Шаг 1.2: Рефакторинг функции загрузки данных отеля

**Текущий код (строки 6612-6859):**
```javascript
function loadHotelData(hotelId) {
    fetch(`${getApiUrl()}/hotels/${hotelId}?includeRaw=true`, {
        headers: getAuthHeaders()
    })
    .then(res => res.json())
    .then(data => {
        const hotel = data.data;
        
        // 200+ строк обработки каждого поля
        let name = typeof hotel.name === 'string' ? JSON.parse(hotel.name) : hotel.name;
        document.getElementById('hotelNameRu').value = name.ru || '';
        // ... повторяется для каждого поля ...
    })
    .catch(err => {
        console.error('Error loading hotel data:', err);
    });
}
```

**Новый код:**
```javascript
async function loadHotelData(hotelId) {
    try {
        await loadEntityData({
            entityType: 'hotels',
            entityId: hotelId,
            fields: hotelFieldsConfig,
            beforeFill: (hotel) => {
                // Очистка старых данных
                clearFormFields('hotelForm', ['hotelImageURLs']);
            },
            onLoaded: (hotel) => {
                // Установить ID отеля
                document.getElementById('hotel-id').value = hotel.id;
                
                // Загрузка городов для выбранной страны
                if (hotel.countryId) {
                    setupCountryCityDropdowns({
                        countryFieldId: 'hotelCountry',
                        cityFieldId: 'hotelCity',
                        selectedCountryId: hotel.countryId,
                        selectedCityId: hotel.cityId
                    });
                }
            }
        });
    } catch (error) {
        alert('Ошибка загрузки данных отеля');
    }
}
```

**Результат:**
- ❌ Удалено: ~200 строк обработки полей
- ✅ Добавлено: 25 строк конфигурации
- ✅ Выигрыш: -175 строк кода

#### Шаг 1.3: Упрощение обработки roomTypes и mealTypes

**Текущий код:**
```javascript
// Дублируется 3 раза для roomTypes (SGL, TWL, DBL)
if (safeGetValue('roomSGL', false, 'checkbox')) {
    const price = safeGetValue('priceSGL', '', 'float');
    if (price && !isNaN(price)) {
        roomTypes.SGL = {
            name: 'Одноместный',
            price: price
        };
    }
}
// ... + ещё TWL, DBL

// Дублируется 5 раз для mealTypes (RO, BB, HB, FB, AI)
if (safeGetValue('mealRO', false, 'checkbox')) {
    const price = safeGetValue('priceMealRO', '', 'float');
    // ...
}
// ... + ещё BB, HB, FB, AI
```

**Новый код (уже встроен в collectFormData):**
```javascript
// В hotelFieldsConfig просто указываем конфигурацию
roomTypes: {
    type: 'checkboxGroupWithPrices',
    elementId: {
        prefix: 'room',
        types: ['SGL', 'TWL', 'DBL']
    }
},
mealTypes: {
    type: 'checkboxGroupWithPrices',
    elementId: {
        prefix: 'meal',
        types: ['RO', 'BB', 'HB', 'FB', 'AI']
    }
}

// Вся логика сбора и загрузки в helpers!
```

**Результат:**
- ❌ Удалено: ~80 строк дублированного кода
- ✅ Добавлено: 14 строк конфигурации
- ✅ Выигрыш: -66 строк кода

#### Шаг 1.4: Улучшение функции editHotel

**Текущий код:**
```javascript
function editHotel(hotelId) {
    openHotelModal(hotelId);
}
```

**Новый код:**
```javascript
function editHotel(hotelId) {
    // Очистка предыдущих данных
    clearFormFields('hotelForm', ['hotelImageURLs']);
    
    // Открытие модального окна
    openHotelModal(hotelId);
}
```

#### Шаг 1.5: Тестирование модуля Hotels

**Тест-кейсы:**
1. ✅ Создание нового отеля
2. ✅ Редактирование существующего отеля
3. ✅ Загрузка roomTypes и mealTypes при редактировании
4. ✅ Каскадная загрузка стран и городов
5. ✅ Валидация обязательных полей
6. ✅ Загрузка и отображение изображений

**Итого по модулю Hotels:**
- ❌ Удалено: ~380 строк старого кода
- ✅ Добавлено: ~60 строк нового кода
- ✅ **Чистый выигрыш: -320 строк (-84%)**

---

### Фаза 2: Рефакторинг модуля Guides (4-5 часов)

#### Шаг 2.1: Объединение saveGuide() и saveEditGuide()

**Текущий код:**
- `saveGuide()` (строки 9484-9609) - создание
- `saveEditGuide()` (строки 9011-9130) - редактирование
- Две разные функции, ~80% дублирования кода

**Новый код:**
```javascript
// Единая инициализация формы создания
initEntityForm({
    formId: 'guideForm',
    entityType: 'guide/create-with-auth',
    entityIdFieldId: 'guide-id',
    fields: guideFieldsConfig,
    validationRules: guideValidationRules,
    useFormData: true, // Для файлов!
    onAfterSave: () => {
        closeGuideModal();
        loadGuides();
    }
});

// Единая инициализация формы редактирования
initEntityForm({
    formId: 'editGuideForm',
    entityType: 'guide/profile', // Другой endpoint
    entityIdFieldId: 'editGuideId',
    fields: guideEditFieldsConfig, // Отдельная конфигурация для editGuide
    validationRules: guideValidationRules,
    useFormData: true,
    onAfterSave: () => {
        closeEditGuideModal();
        loadGuides();
    }
});
```

**Проблема:** Для Guides нужен специальный подход из-за разных endpoints:
- Создание: `POST /api/guide/create-with-auth`
- Редактирование: `PUT /api/guide/profile/{id}`

**Решение:** Расширить `apiRequest` для поддержки кастомных endpoints:

```javascript
// В guideFieldsConfig добавляем:
const guideFieldsConfig = {
    // ... поля ...
    _meta: {
        createEndpoint: '/guide/create-with-auth',
        updateEndpoint: '/guide/profile'
    }
};

// В initEntityForm поддержать _meta.createEndpoint и _meta.updateEndpoint
```

#### Шаг 2.2: Унификация полей формы создания и редактирования

**Проблема:** Разные ID полей:
- Создание: `guideFullNameRu`, `guideFullNameEn`
- Редактирование: `editGuideFullName` (только одно поле!)

**Решение 1 (Рекомендуемый):** Изменить HTML формы редактирования, добавив раздельные поля RU/EN:

```html
<!-- Было -->
<input type="text" id="editGuideFullName">

<!-- Стало -->
<input type="text" id="editGuideFullNameRu" placeholder="Иванов Иван Иванович">
<input type="text" id="editGuideFullNameEn" placeholder="Ivan Ivanov">
```

**Решение 2 (Временное):** Создать отдельную конфигурацию `guideEditFieldsConfig`:

```javascript
const guideEditFieldsConfig = {
    name: {
        type: 'multilingual',
        elementId: ['editGuideFullNameRu', 'editGuideFullNameEn'], // Новые поля
        required: true
    },
    // ... остальные поля с editGuide префиксом
};
```

#### Шаг 2.3: Рефакторинг функции editGuide

**Текущий код (строки 9611-9632):**
```javascript
async function editGuide(id) {
    const response = await fetch(`${getApiUrl()}/guides/${id}?includeRaw=true`, {
        headers: getAuthHeaders()
    });
    const data = await response.json();
    const guide = data.data;
    
    // Открываем модальное окно редактирования
    openEditGuideModal(guide);
}
```

**Новый код:**
```javascript
async function editGuide(id) {
    try {
        // Очистка формы
        clearFormFields('editGuideForm', [
            'selectedGuideLanguages',
            'editGuideAvatarFile',
            'editGuideDocumentFiles'
        ]);
        
        // Открываем модальное окно (пустое)
        openEditGuideModal();
        
        // Загружаем данные гида
        await loadEntityData({
            entityType: 'guides',
            entityId: id,
            fields: guideEditFieldsConfig,
            onLoaded: (guide) => {
                // Установить ID
                document.getElementById('editGuideId').value = guide.id;
                
                // Загрузка городов
                if (guide.countryId) {
                    setupCountryCityDropdowns({
                        countryFieldId: 'editGuideCountry',
                        cityFieldId: 'editGuideCity',
                        selectedCountryId: guide.countryId,
                        selectedCityId: guide.cityId
                    });
                }
                
                // Загрузка файлов (аватар, документы) - специальная обработка
                if (guide.avatar) {
                    displayExistingAvatar(guide.avatar);
                }
                if (guide.documents) {
                    displayExistingDocuments(guide.documents);
                }
            }
        });
    } catch (error) {
        alert('Ошибка загрузки данных гида');
    }
}

// Helper функции для отображения существующих файлов
function displayExistingAvatar(avatarUrl) {
    const preview = document.getElementById('editGuideAvatarPreview');
    if (preview) {
        preview.style.display = 'block';
        preview.querySelector('img').src = getAbsoluteImageUrl(avatarUrl);
    }
}

function displayExistingDocuments(documentsJson) {
    try {
        const docs = typeof documentsJson === 'string' ? JSON.parse(documentsJson) : documentsJson;
        if (Array.isArray(docs)) {
            const container = document.getElementById('editGuideDocumentsPreview');
            container.innerHTML = docs.map(doc => `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span class="text-sm">${doc.name}</span>
                    <button type="button" onclick="deleteGuideDocument(${guideId}, '${doc.path}')" 
                            class="text-red-500 hover:text-red-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error('Error displaying documents:', e);
    }
}
```

#### Шаг 2.4: Упрощение обработки языков

**Текущий код:**
```javascript
// Глобальная переменная
let selectedGuideLanguages = [];

function addLanguageToGuide() {
    const select = document.getElementById('guideAvailableLanguages');
    const language = select.value;
    if (language && !selectedGuideLanguages.includes(language)) {
        selectedGuideLanguages.push(language);
        updateSelectedGuideLanguagesDisplay();
    }
}

function removeLanguageFromGuide(language) {
    selectedGuideLanguages = selectedGuideLanguages.filter(lang => lang !== language);
    updateSelectedGuideLanguagesDisplay();
}

function updateSelectedGuideLanguagesDisplay() {
    // ... 20 строк кода
}
```

**Новый код:**
```javascript
// Используем handleCheckboxGroup helper
handleCheckboxGroup({
    containerElement: 'selectedGuideLanguages',
    selectElement: 'guideAvailableLanguages',
    variableName: 'selectedGuideLanguages'
});

// Всё! Функции addLanguageToGuide, removeLanguageFromGuide, updateSelectedGuideLanguagesDisplay 
// теперь созданы автоматически и доступны как:
// window.addToSelectedGuideLanguages()
// window.removeFromSelectedGuideLanguages(value)
// window.updateSelectedGuideLanguagesDisplay()
```

#### Шаг 2.5: Тестирование модуля Guides

**Тест-кейсы:**
1. ✅ Создание нового гида с файлами (аватар + документы)
2. ✅ Редактирование существующего гида
3. ✅ Сохранение раздельных RU/EN полей при редактировании
4. ✅ Загрузка и отображение существующих файлов
5. ✅ Удаление документов гида
6. ✅ Каскадная загрузка стран и городов
7. ✅ Работа с массивом языков

**Итого по модулю Guides:**
- ❌ Удалено: ~400 строк старого кода (две функции объединены)
- ✅ Добавлено: ~80 строк нового кода
- ✅ **Чистый выигрыш: -320 строк (-80%)**

---

### Фаза 3: Улучшение модуля Tours (2-3 часа)

#### Шаг 3.1: Рефакторинг saveTourForm()

**Текущий код (строки 5751-5921):**
- Функция уже хорошо структурирована
- Но всё равно ~170 строк встроенной логики

**Новый код:**
```javascript
// Инициализация формы тура
initEntityForm({
    formId: 'tourForm',
    entityType: 'tours',
    entityIdFieldId: 'tour-id',
    fields: tourFieldsConfig,
    validationRules: tourValidationRules,
    onBeforeSave: (data, isEditing) => {
        // Специальная обработка для многодневной программы
        data.itinerary = JSON.stringify(convertDaysItineraryToArray());
        return true;
    },
    onAfterSave: (response, isEditing) => {
        const message = isEditing ? '✅ Тур успешно обновлён!' : '✅ Тур успешно создан!';
        alert(message);
        closeTourModal();
        loadTours();
    }
});
```

**Результат:**
- ❌ Удалено: ~150 строк кода
- ✅ Добавлено: 20 строк конфигурации
- ✅ Выигрыш: -130 строк

#### Шаг 3.2: Извлечение функции загрузки данных тура

**Текущая проблема:** Логика загрузки данных тура встроена в `openTourModal(tourId)` (строка 5142).

**Новый подход:**
```javascript
// Создаём отдельную функцию
async function loadTourData(tourId) {
    try {
        await loadEntityData({
            entityType: 'tours',
            entityId: tourId,
            fields: tourFieldsConfig,
            beforeFill: (tour) => {
                // Очистка чекбоксов
                document.querySelectorAll('input[name="selectedHotels"]').forEach(cb => cb.checked = false);
                document.querySelectorAll('input[name="selectedGuides"]').forEach(cb => cb.checked = false);
            },
            onLoaded: (tour) => {
                // Установить ID
                document.getElementById('tour-id').value = tour.id;
                
                // Специальная обработка многодневной программы
                if (tour.itinerary) {
                    initializeDayProgram(tour.itinerary);
                }
                
                // Загрузка стран/городов
                if (tour.countriesIds && tour.countriesIds.length > 0) {
                    // Multiple select setup
                    setupMultipleCountryCitySelects(tour.countriesIds, tour.citiesIds);
                }
            }
        });
    } catch (error) {
        alert('Ошибка загрузки данных тура');
    }
}

// Обновляем openTourModal
function openTourModal(tourId = null) {
    // Показываем модальное окно
    document.getElementById('tourModal').classList.add('active');
    
    // Если редактирование - загружаем данные
    if (tourId) {
        loadTourData(tourId);
    } else {
        // Инициализация для создания нового тура
        clearFormFields('tourForm', [
            'tourImageURLs',
            'tourLanguages',
            'tourItinerary',
            'tourStartTimes'
        ]);
    }
}
```

#### Шаг 3.3: Упрощение работы с языками тура

**Текущий код:**
```javascript
function addLanguageToTour() {
    const select = document.getElementById('availableLanguages');
    const language = select.value;
    if (language) {
        if (!Array.isArray(window.tourLanguages)) {
            window.tourLanguages = [];
        }
        if (!window.tourLanguages.includes(language)) {
            window.tourLanguages.push(language);
            updateSelectedLanguages();
        }
        select.value = '';
    }
}

function removeLanguage(index) {
    window.tourLanguages.splice(index, 1);
    updateSelectedLanguages();
}

function updateSelectedLanguages() {
    // ... 15 строк кода
}
```

**Новый код:**
```javascript
// Используем handleCheckboxGroup helper
handleCheckboxGroup({
    containerElement: 'selectedLanguages',
    selectElement: 'availableLanguages',
    variableName: 'tourLanguages'
});

// Теперь функции доступны автоматически:
// window.addToTourLanguages()
// window.removeFromTourLanguages(value)
// window.updateTourLanguagesDisplay()
```

#### Шаг 3.4: Тестирование модуля Tours

**Тест-кейсы:**
1. ✅ Создание нового тура
2. ✅ Редактирование существующего тура
3. ✅ Множественный выбор стран и городов
4. ✅ Выбор отелей и гидов (чекбоксы)
5. ✅ Работа с многодневной программой (itinerary)
6. ✅ Загрузка и отображение изображений
7. ✅ Валидация всех обязательных полей

**Итого по модулю Tours:**
- ❌ Удалено: ~200 строк старого кода
- ✅ Добавлено: ~50 строк нового кода
- ✅ **Чистый выигрыш: -150 строк (-75%)**

---

### Фаза 4: Финальная оптимизация и тестирование (2-3 часа)

#### Шаг 4.1: Унификация каскадных dropdown'ов стран/городов

**Текущее состояние:** 4 разные функции для одного и того же:
- `loadCountriesForTourForm()`
- `loadCitiesForCountry(countryId, cityFieldId)`
- `loadGuideCitiesByCountry()`
- `loadEditGuideCitiesByCountry()`

**Новое состояние:** Все используют `setupCountryCityDropdowns()` из admin-helpers.js

**Удаляем старые функции:**
```javascript
// ❌ УДАЛИТЬ
function loadCountriesForTourForm() { /* ... */ }
function loadCitiesForCountry(countryId, cityFieldId) { /* ... */ }
function loadGuideCitiesByCountry() { /* ... */ }
function loadEditGuideCitiesByCountry() { /* ... */ }

// ✅ ЗАМЕНИТЬ на вызовы setupCountryCityDropdowns()
```

#### Шаг 4.2: Централизация обработки ошибок API

**Текущее состояние:** В каждой функции свой catch блок:
```javascript
.catch(err => {
    console.error('Error:', err);
    alert('Ошибка');
});
```

**Новое состояние:** Все через `apiRequest()` с единообразной обработкой ошибок.

#### Шаг 4.3: Удаление дублирующихся helper функций

**Найти и удалить:**
- Дублирующиеся `safeGetValue()` (оставить одну глобальную)
- Дублирующиеся `getApiUrl()`
- Дублирующиеся `getAuthHeaders()`

#### Шаг 4.4: Комплексное интеграционное тестирование

**Тестовый сценарий 1: Полный цикл тура**
1. Создать новый тур через форму
2. Отредактировать тур
3. Добавить отели и гидов
4. Удалить тур

**Тестовый сценарий 2: Полный цикл отеля**
1. Создать новый отель с roomTypes и mealTypes
2. Отредактировать отель
3. Загрузить изображения
4. Удалить отель

**Тестовый сценарий 3: Полный цикл гида**
1. Создать нового гида с файлами (аватар, документы)
2. Отредактировать гида
3. Изменить раздельно RU и EN поля
4. Удалить документ гида
5. Удалить гида

**Тестовый сценарий 4: Каскадные dropdown'ы**
1. Выбрать страну в туре → проверить загрузку городов
2. Выбрать страну в отеле → проверить загрузку городов
3. Выбрать страну в гиде → проверить загрузку городов

#### Шаг 4.5: Оптимизация производительности

**Проверить:**
- Нет ли утечек памяти (глобальные переменные очищаются)
- Нет ли лишних API запросов (кэширование стран/городов)
- Все ли изображения загружаются корректно

#### Шаг 4.6: Документация и комментарии

**Добавить комментарии:**
```javascript
// ==============================================
// MODULE: TOURS
// Использует admin-helpers.js для обработки данных
// ==============================================

// Конфигурация полей тура
const tourFieldsConfig = { /* ... */ };

// Инициализация формы тура
initEntityForm({ /* ... */ });

// ==============================================
```

---

### Итоговые метрики рефакторинга

| Модуль | Строк ДО | Строк ПОСЛЕ | Удалено | Выигрыш |
|--------|----------|-------------|---------|---------|
| **Hotels** | ~500 | ~180 | -320 | -64% |
| **Guides** | ~600 | ~280 | -320 | -53% |
| **Tours** | ~400 | ~250 | -150 | -38% |
| **admin-helpers.js** | 0 | +400 | +400 | (новый файл) |
| **ИТОГО** | ~1500 | ~1110 | **-390** | **-26%** |

**Дополнительные выгоды (качественные):**
- ✅ Единообразная обработка данных
- ✅ Переиспользуемые функции
- ✅ Легче добавлять новые модули
- ✅ Проще тестировать
- ✅ Меньше дублирования кода
- ✅ Консистентная валидация
- ✅ Единообразная обработка ошибок

---

### Дополнительные рекомендации

#### 1. Постепенная миграция
Не обязательно рефакторить все сразу. Можно внедрять новые функции постепенно:
- Начать с `apiRequest()` - использовать во всех новых запросах
- Затем внедрить `setupCountryCityDropdowns()` - заменить все каскадные dropdown'ы
- Потом `collectFormData()` и `loadEntityData()`
- В конце `initEntityForm()` - полная интеграция

#### 2. Сохранение обратной совместимости
На переходный период можно оставить старые функции с пометкой `@deprecated`:
```javascript
/**
 * @deprecated Use loadEntityData() from admin-helpers.js instead
 */
function loadHotelData(hotelId) {
    console.warn('loadHotelData is deprecated, use loadEntityData');
    // Старая реализация...
}
```

#### 3. Unit-тестирование helper функций
Создать `frontend/public/js/admin-helpers.test.js`:
```javascript
// Тесты для admin-helpers.js
describe('collectFormData', () => {
    it('should collect multilingual fields correctly', () => {
        // ...
    });
    
    it('should collect checkbox groups correctly', () => {
        // ...
    });
});
```

#### 4. Версионирование
Добавить версию в admin-helpers.js для отслеживания изменений:
```javascript
// ==============================================
// ADMIN HELPERS
// Version: 1.0.0
// Last Updated: 2025-10-02
// ==============================================
```

---

## Заключение

Предложенный план рефакторинга обеспечивает:

1. **Единый стандарт обработки данных** через `admin-helpers.js`
2. **Сокращение кода на ~390 строк** (26% от исходного объёма модулей)
3. **Устранение дублирования** между модулями Tours, Hotels, Guides
4. **Переиспользуемые функции** для будущих модулей
5. **Консистентность** в обработке API, валидации, работе с формами
6. **Лёгкость тестирования** благодаря модульной структуре
7. **Упрощённую поддержку** - изменения в одном месте влияют на все модули

**Рекомендуемая последовательность внедрения:**
1. Фаза 0 (подготовка) - обязательно
2. Фаза 1 (Hotels) - средняя сложность, хороший старт
3. Фаза 2 (Guides) - высокая сложность
4. Фаза 3 (Tours) - улучшение уже хорошего кода
5. Фаза 4 (финализация) - обязательно для production

**Ожидаемое время выполнения:** 12-17 часов чистой работы.

Успешного рефакторинга! 🚀
