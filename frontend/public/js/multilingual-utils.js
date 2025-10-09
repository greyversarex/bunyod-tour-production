/**
 * 🌐 УНИВЕРСАЛЬНЫЕ УТИЛИТЫ МНОГОЯЗЫЧНОСТИ ДЛЯ ФРОНТЕНДА
 * Обеспечивает корректное переключение языков для всех типов контента
 */

// === ОСНОВНЫЕ ФУНКЦИИ ОБРАБОТКИ МНОГОЯЗЫЧНОГО КОНТЕНТА ===

/**
 * Безопасно парсит JSON строку с многоязычным контентом
 * @param {any} jsonString - JSON строка или объект
 * @param {object} defaultValue - Значение по умолчанию
 * @returns {object|string} Распарсенный объект или строка
 */
function safeJsonParse(jsonString, defaultValue = { ru: '', en: '' }) {
  if (!jsonString) return defaultValue;
  if (typeof jsonString === 'object') return jsonString;
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    // Если это обычная строка, возвращаем её как есть
    if (typeof jsonString === 'string') {
      return jsonString;
    }
    console.warn('JSON parsing error:', error);
    return defaultValue;
  }
}

/**
 * Извлекает текст на указанном языке с fallback
 * @param {object|string} field - Поле с переводами или строка
 * @param {string} language - Целевой язык ('en' | 'ru')
 * @returns {string} Текст на нужном языке
 */
function getLocalizedText(field, language = 'ru') {
  if (!field) return '';
  
  // Если это строка - возвращаем как есть
  if (typeof field === 'string') {
    return field;
  }
  
  // Если это объект с переводами
  if (typeof field === 'object' && field !== null) {
    // Пытаемся получить на нужном языке
    const text = field[language];
    if (text && text.trim()) {
      return text;
    }
    
    // Fallback: если EN пустой или отсутствует, возвращаем RU
    if (language === 'en' && field.ru && field.ru.trim()) {
      return field.ru;
    }
    
    // Fallback: если RU пустой или отсутствует, возвращаем EN
    if (language === 'ru' && field.en && field.en.trim()) {
      return field.en;
    }
    
    // Последний fallback: возвращаем любое непустое значение
    return field.ru || field.en || '';
  }
  
  return '';
}

/**
 * Парсит многоязычное поле и возвращает текст на нужном языке
 * @param {any} jsonField - JSON поле с переводами
 * @param {string} language - Целевой язык
 * @returns {string} Локализованный текст
 */
function parseMultilingualField(jsonField, language = 'ru') {
  const parsed = safeJsonParse(jsonField, { ru: '', en: '' });
  return getLocalizedText(parsed, language);
}

// === ФУНКЦИИ ДЛЯ РАБОТЫ С DOM ЭЛЕМЕНТАМИ ===

/**
 * Обновляет элемент с многоязычным контентом
 * @param {HTMLElement} element - DOM элемент
 * @param {any} content - Многоязычный контент (JSON или объект)
 * @param {string} language - Целевой язык
 * @param {string} property - Свойство для обновления ('textContent', 'innerHTML', 'title', etc.)
 */
function updateMultilingualElement(element, content, language, property = 'textContent') {
  if (!element || !content) return;
  
  const localizedText = parseMultilingualField(content, language);
  
  if (property === 'textContent') {
    element.textContent = localizedText;
  } else if (property === 'innerHTML') {
    element.innerHTML = localizedText;
  } else if (property === 'title') {
    element.title = localizedText;
  } else if (property === 'placeholder') {
    element.placeholder = localizedText;
  } else {
    element.setAttribute(property, localizedText);
  }
}

/**
 * Обновляет элементы с data-атрибутами для многоязычного контента
 * @param {string} language - Целевой язык
 */
function updateDataAttributeElements(language) {
  // Обновляем элементы с data-multilingual-text
  document.querySelectorAll('[data-multilingual-text]').forEach(element => {
    const content = element.dataset.multilingualText;
    updateMultilingualElement(element, content, language, 'textContent');
  });
  
  // Обновляем элементы с data-multilingual-html  
  document.querySelectorAll('[data-multilingual-html]').forEach(element => {
    const content = element.dataset.multilingualHtml;
    updateMultilingualElement(element, content, language, 'innerHTML');
  });
  
  // Обновляем элементы с data-multilingual-title
  document.querySelectorAll('[data-multilingual-title]').forEach(element => {
    const content = element.dataset.multilingualTitle;
    updateMultilingualElement(element, content, language, 'title');
  });
  
  // Обновляем элементы с data-multilingual-placeholder
  document.querySelectorAll('[data-multilingual-placeholder]').forEach(element => {
    const content = element.dataset.multilingualPlaceholder;
    updateMultilingualElement(element, content, language, 'placeholder');
  });
}

// === СПЕЦИАЛИЗИРОВАННЫЕ ФУНКЦИИ ДЛЯ ТУРОВ, ОТЕЛЕЙ, ГИДОВ ===

/**
 * Обновляет заголовки туров
 * @param {string} language - Целевой язык
 */
function updateTourTitles(language) {
  document.querySelectorAll('[data-tour-title]').forEach(element => {
    const titleData = element.dataset.tourTitle;
    updateMultilingualElement(element, titleData, language, 'textContent');
  });
}

/**
 * Обновляет описания туров
 * @param {string} language - Целевой язык
 */
function updateTourDescriptions(language) {
  document.querySelectorAll('[data-tour-description]').forEach(element => {
    const descData = element.dataset.tourDescription;
    updateMultilingualElement(element, descData, language, 'textContent');
  });
}

/**
 * Обновляет названия категорий
 * @param {string} language - Целевой язык
 */
function updateCategoryNames(language) {
  document.querySelectorAll('[data-category-name]').forEach(element => {
    const categoryData = element.dataset.categoryName;
    updateMultilingualElement(element, categoryData, language, 'textContent');
  });
}

/**
 * Обновляет названия и описания отелей
 * @param {string} language - Целевой язык
 */
function updateHotelContent(language) {
  // Названия отелей
  document.querySelectorAll('[data-hotel-name]').forEach(element => {
    const nameData = element.dataset.hotelName;
    updateMultilingualElement(element, nameData, language, 'textContent');
  });
  
  // Описания отелей
  document.querySelectorAll('[data-hotel-description]').forEach(element => {
    const descData = element.dataset.hotelDescription;
    updateMultilingualElement(element, descData, language, 'textContent');
  });
  
  // Адреса отелей
  document.querySelectorAll('[data-hotel-address]').forEach(element => {
    const addressData = element.dataset.hotelAddress;
    updateMultilingualElement(element, addressData, language, 'textContent');
  });
}

/**
 * Обновляет информацию о гидах
 * @param {string} language - Целевой язык
 */
function updateGuideContent(language) {
  // Имена гидов
  document.querySelectorAll('[data-guide-name]').forEach(element => {
    const nameData = element.dataset.guideName;
    updateMultilingualElement(element, nameData, language, 'textContent');
  });
  
  // Описания гидов
  document.querySelectorAll('[data-guide-description]').forEach(element => {
    const descData = element.dataset.guideDescription;
    updateMultilingualElement(element, descData, language, 'textContent');
  });
  
  // Специализации гидов
  document.querySelectorAll('[data-guide-specialization]').forEach(element => {
    const specData = element.dataset.guideSpecialization;
    updateMultilingualElement(element, specData, language, 'textContent');
  });
}

/**
 * Обновляет названия стран и городов
 * @param {string} language - Целевой язык
 */
function updateLocationNames(language) {
  // Страны
  document.querySelectorAll('[data-country-name]').forEach(element => {
    const countryData = element.dataset.countryName;
    updateMultilingualElement(element, countryData, language, 'textContent');
  });
  
  // Города
  document.querySelectorAll('[data-city-name]').forEach(element => {
    const cityData = element.dataset.cityName;
    updateMultilingualElement(element, cityData, language, 'textContent');
  });
}

/**
 * Обновляет заголовки блоков туров
 * @param {string} language - Целевой язык
 */
function updateTourBlockTitles(language) {
  document.querySelectorAll('[data-tour-block-title]').forEach(element => {
    const titleData = element.dataset.tourBlockTitle;
    updateMultilingualElement(element, titleData, language, 'textContent');
  });
}

// === ГЛАВНАЯ ФУНКЦИЯ ПЕРЕВОДА ВСЕГО ДИНАМИЧЕСКОГО КОНТЕНТА ===

/**
 * Переводит весь динамический контент на указанный язык
 * @param {string} language - Целевой язык ('en' | 'ru')
 */
function translateAllDynamicContent(language) {
  console.log(`🔄 Переключение всего динамического контента на: ${language}`);
  
  let updatedCount = 0;
  
  // Обновляем все типы контента
  updateDataAttributeElements(language);
  updatedCount += document.querySelectorAll('[data-multilingual-text], [data-multilingual-html], [data-multilingual-title], [data-multilingual-placeholder]').length;
  
  updateTourTitles(language);
  updatedCount += document.querySelectorAll('[data-tour-title]').length;
  
  updateTourDescriptions(language);
  updatedCount += document.querySelectorAll('[data-tour-description]').length;
  
  updateCategoryNames(language);
  updatedCount += document.querySelectorAll('[data-category-name]').length;
  
  updateHotelContent(language);
  updatedCount += document.querySelectorAll('[data-hotel-name], [data-hotel-description], [data-hotel-address]').length;
  
  updateGuideContent(language);
  updatedCount += document.querySelectorAll('[data-guide-name], [data-guide-description], [data-guide-specialization]').length;
  
  updateLocationNames(language);
  updatedCount += document.querySelectorAll('[data-country-name], [data-city-name]').length;
  
  updateTourBlockTitles(language);
  updatedCount += document.querySelectorAll('[data-tour-block-title]').length;
  
  console.log(`✅ Обновлено ${updatedCount} элементов динамического контента`);
  
  // Уведомляем другие скрипты о смене языка
  const event = new CustomEvent('dynamicContentTranslated', {
    detail: { language, updatedCount }
  });
  document.dispatchEvent(event);
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

/**
 * Создает data-атрибуты для многоязычного элемента
 * @param {any} content - Многоязычный контент
 * @param {string} type - Тип атрибута ('text', 'html', 'title', 'placeholder')
 * @returns {string} Строка с data-атрибутом
 */
function createMultilingualDataAttribute(content, type = 'text') {
  if (!content) return '';
  
  const jsonString = typeof content === 'object' ? JSON.stringify(content) : content;
  const escapedContent = jsonString.replace(/"/g, '&quot;');
  
  return `data-multilingual-${type}="${escapedContent}"`;
}

/**
 * Получает текущий язык интерфейса
 * @returns {string} Код языка ('en' | 'ru')
 */
function getCurrentLanguage() {
  // Приоритет: window.currentLanguage > localStorage > navigator > default 'ru'
  return window.currentLanguage || 
         localStorage.getItem('selectedLanguage') || 
         (navigator.language.startsWith('en') ? 'en' : 'ru') || 
         'ru';
}

/**
 * DEPRECATED: Используйте window.updatePageLanguage() вместо этого
 * Переключает язык и обновляет весь контент
 * @param {string} language - Новый язык
 */
function switchToLanguage(language) {
  console.warn('⚠️ switchToLanguage() устарела - используйте window.updatePageLanguage()');
  
  // === ПРИОРИТЕТ 4: ДЕЛЕГАЦИЯ К ЕДИНОЙ ТОЧКЕ ВХОДА ===
  // Вся логика переключения языка теперь в i18n.js > updatePageLanguage()
  if (typeof window.updatePageLanguage === 'function') {
    window.updatePageLanguage(language);
  } else {
    console.error('❌ window.updatePageLanguage не найдена! Проверьте загрузку i18n.js');
  }
}

// === ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СОВМЕСТИМОСТИ ===

/**
 * Получает заголовок на указанном языке
 * @param {any} titleObject - Объект или JSON строка с заголовком
 * @param {string} lang - Код языка
 * @returns {string} Заголовок на нужном языке
 */
function getTitleByLanguage(titleObject, lang) {
    return parseMultilingualField(titleObject, lang) || 'Название не указано';
}

/**
 * Получает описание на указанном языке
 * @param {any} descriptionObject - Объект или JSON строка с описанием
 * @param {string} lang - Код языка
 * @returns {string} Описание на нужном языке
 */
function getDescriptionByLanguage(descriptionObject, lang) {
    return parseMultilingualField(descriptionObject, lang) || 'Описание не указано';
}

/**
 * Получает название категории на указанном языке
 * @param {any} categoryObject - Объект или JSON строка с названием категории
 * @param {string} lang - Код языка
 * @returns {string} Название категории на нужном языке
 */
function getCategoryNameByLanguage(categoryObject, lang) {
    return parseMultilingualField(categoryObject, lang) || 'Категория';
}

// === ХЕЛПЕРЫ ДЛЯ РАБОТЫ С nameRu/nameEn ПОЛЯМИ (СТРАНЫ, ГОРОДА) ===

/**
 * Извлекает локализованное значение из объекта с полями nameRu/nameEn
 * @param {object} entity - Объект с полями nameRu и nameEn
 * @param {string} fieldBaseName - Базовое имя поля (например, 'name')
 * @param {string} lang - Код языка ('ru' | 'en')
 * @returns {string} Локализованное значение
 */
function formatMultilingualField(entity, fieldBaseName = 'name', lang = 'ru') {
    if (!entity) return '';
    
    // Формируем имена полей: name → nameRu, nameEn
    const ruField = fieldBaseName + 'Ru';
    const enField = fieldBaseName + 'En';
    
    // Определяем приоритет в зависимости от языка
    if (lang === 'en') {
        return entity[enField] || entity[ruField] || '';
    } else {
        return entity[ruField] || entity[enField] || '';
    }
}

/**
 * Форматирует локацию (страна • город) на нужном языке
 * @param {object} country - Объект страны с полями nameRu, nameEn
 * @param {object} city - Объект города с полями nameRu, nameEn
 * @param {string} lang - Код языка ('ru' | 'en')
 * @param {string} separator - Разделитель (по умолчанию ' • ')
 * @returns {string} Форматированная локация
 */
function formatLocation(country, city, lang = 'ru', separator = ' • ') {
    const countryName = formatMultilingualField(country, 'name', lang);
    const cityName = formatMultilingualField(city, 'name', lang);
    
    if (countryName && cityName) {
        return `${countryName}${separator}${cityName}`;
    } else if (countryName) {
        return countryName;
    } else if (cityName) {
        return cityName;
    }
    
    return '';
}

/**
 * Извлекает локализованное имя из объекта (совместимость с разными форматами)
 * Поддерживает как JSON {ru, en}, так и nameRu/nameEn поля
 * @param {any} entity - Объект или строка с именем
 * @param {string} lang - Код языка
 * @returns {string} Локализованное имя
 */
function getEntityName(entity, lang = 'ru') {
    if (!entity) return '';
    
    // Если это строка, возвращаем как есть
    if (typeof entity === 'string') return entity;
    
    // Проверяем формат JSON {ru, en}
    if (entity.ru || entity.en) {
        return getLocalizedText(entity, lang);
    }
    
    // Проверяем формат nameRu/nameEn
    if (entity.nameRu || entity.nameEn) {
        return formatMultilingualField(entity, 'name', lang);
    }
    
    // Проверяем вложенное поле name
    if (entity.name) {
        // Если name - это JSON объект
        const parsed = safeJsonParse(entity.name);
        return getLocalizedText(parsed, lang);
    }
    
    return '';
}

// === ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ===

// Основные функции
window.safeJsonParse = safeJsonParse;
window.getLocalizedText = getLocalizedText;
window.parseMultilingualField = parseMultilingualField;

// Функции обновления DOM
window.updateMultilingualElement = updateMultilingualElement;
window.translateAllDynamicContent = translateAllDynamicContent;

// Специализированные функции
window.updateTourTitles = updateTourTitles;
window.updateTourDescriptions = updateTourDescriptions;
window.updateCategoryNames = updateCategoryNames;
window.updateHotelContent = updateHotelContent;
window.updateGuideContent = updateGuideContent;
window.updateLocationNames = updateLocationNames;

// Вспомогательные функции
window.createMultilingualDataAttribute = createMultilingualDataAttribute;
window.getCurrentLanguage = getCurrentLanguage;
window.switchToLanguage = switchToLanguage;

// Функции совместимости
window.getTitleByLanguage = getTitleByLanguage;
window.getDescriptionByLanguage = getDescriptionByLanguage;
window.getCategoryNameByLanguage = getCategoryNameByLanguage;

// Хелперы для nameRu/nameEn полей
window.formatMultilingualField = formatMultilingualField;
window.formatLocation = formatLocation;
window.getEntityName = getEntityName;

// Создаем объект с утилитами для удобного доступа
window.MultilingualUtils = {
  safeJsonParse,
  getLocalizedText,
  parseMultilingualField,
  updateMultilingualElement,
  translateAllDynamicContent,
  updateTourTitles,
  updateTourDescriptions,
  updateCategoryNames,
  updateHotelContent,
  updateGuideContent,
  updateLocationNames,
  createMultilingualDataAttribute,
  getCurrentLanguage,
  switchToLanguage,
  getTitleByLanguage,
  getDescriptionByLanguage,
  getCategoryNameByLanguage,
  formatMultilingualField,
  formatLocation,
  getEntityName
};

console.log('🌐 Система многоязычных утилит загружена успешно');