/**
 * 🌐 УНИВЕРСАЛЬНАЯ СИСТЕМА МУЛЬТИЯЗЫЧНОСТИ
 * 
 * Обрабатывает JSON поля с переводами и возвращает контент на нужном языке
 * с fallback механизмом: EN отсутствует → показать RU
 */

export type SupportedLanguage = 'en' | 'ru';
export type MultilingualField = { en: string; ru: string } | string | null;

/**
 * Безопасный парсинг JSON строк с мультиязычным контентом
 */
export function safeJsonParse(jsonString: any, defaultValue: any = { ru: '', en: '' }): any {
  if (!jsonString) return defaultValue;
  if (typeof jsonString === 'object') return jsonString;
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    // Если это обычная строка, возвращаем её как есть, а не default value
    if (typeof jsonString === 'string') {
      return jsonString;
    }
    console.warn('JSON parsing error:', error);
    return defaultValue;
  }
}

/**
 * Извлекает текст на указанном языке с fallback на русский
 * 
 * @param field - Поле с переводами (JSON объект или строка)
 * @param language - Целевой язык ('en' | 'ru')
 * @returns Текст на нужном языке или fallback
 */
export function getLocalizedText(field: MultilingualField, language: SupportedLanguage = 'ru'): string {
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
 * Парсит мультиязычное поле и возвращает текст на нужном языке
 * 
 * @param jsonField - JSON строка или объект с переводами
 * @param language - Целевой язык
 * @returns Локализованный текст
 */
export function parseMultilingualField(jsonField: any, language: SupportedLanguage = 'ru'): string {
  const parsed = safeJsonParse(jsonField, { ru: '', en: '' });
  return getLocalizedText(parsed, language);
}

/**
 * Обрабатывает объект с мультиязычными полями
 * Возвращает все поля на нужном языке
 * 
 * @param obj - Объект для обработки
 * @param fieldsToTranslate - Массив полей для перевода
 * @param language - Целевой язык
 * @returns Объект с локализованными полями
 */
export function localizeObject(
  obj: any, 
  fieldsToTranslate: string[], 
  language: SupportedLanguage = 'ru'
): any {
  if (!obj) return obj;
  
  const localized = { ...obj };
  
  fieldsToTranslate.forEach(field => {
    if (obj[field]) {
      localized[field] = parseMultilingualField(obj[field], language);
    }
  });
  
  return localized;
}

/**
 * Обрабатывает массив объектов с мультиязычными полями
 * 
 * @param array - Массив объектов
 * @param fieldsToTranslate - Поля для перевода
 * @param language - Целевой язык
 * @returns Массив с локализованными объектами
 */
export function localizeArray(
  array: any[], 
  fieldsToTranslate: string[], 
  language: SupportedLanguage = 'ru'
): any[] {
  if (!Array.isArray(array)) return array;
  
  return array.map(item => localizeObject(item, fieldsToTranslate, language));
}

/**
 * Извлекает язык из query параметров запроса
 * 
 * @param req - Express Request объект
 * @returns Валидный язык с fallback на 'ru'
 */
export function getLanguageFromRequest(req: any): SupportedLanguage {
  const lang = req.query.lang as string;
  
  // Валидация языка
  if (lang === 'en' || lang === 'ru') {
    return lang;
  }
  
  // Fallback на русский
  return 'ru';
}

/**
 * Создает стандартный API ответ с поддержкой мультиязычности
 * 
 * @param data - Данные для ответа
 * @param fieldsToTranslate - Поля для локализации
 * @param language - Язык для локализации
 * @param message - Сообщение ответа
 * @returns Стандартизированный API ответ
 */
export function createLocalizedResponse(
  data: any,
  fieldsToTranslate: string[],
  language: SupportedLanguage = 'ru',
  message: string = 'Success'
) {
  let localizedData;
  
  if (Array.isArray(data)) {
    localizedData = localizeArray(data, fieldsToTranslate, language);
  } else if (data && typeof data === 'object') {
    localizedData = localizeObject(data, fieldsToTranslate, language);
  } else {
    localizedData = data;
  }
  
  return {
    success: true,
    data: localizedData,
    message,
    language // Указываем какой язык был использован
  };
}

/**
 * Denormalize enum values to localized labels
 */
function denormalizeTourType(value: string | null | undefined, language: SupportedLanguage = 'ru'): string {
  if (!value) return '';
  
  const ruMap: Record<string, string> = {
    'individual': 'Персональный',
    'group_private': 'Групповой персональный',
    'group_shared': 'Групповой общий',
    // Keep Russian values as-is (for legacy tours)
    'Персональный': 'Персональный',
    'Групповой персональный': 'Групповой персональный',
    'Групповой общий': 'Групповой общий'
  };
  
  const enMap: Record<string, string> = {
    'individual': 'Individual',
    'group_private': 'Private Group',
    'group_shared': 'Shared Group',
    'Персональный': 'Individual',
    'Групповой персональный': 'Private Group',
    'Групповой общий': 'Shared Group'
  };
  
  const map = language === 'en' ? enMap : ruMap;
  return map[value] || value;
}

function denormalizePriceType(value: string | null | undefined, language: SupportedLanguage = 'ru'): string {
  if (!value) return language === 'ru' ? 'за человека' : 'per person';
  
  const ruMap: Record<string, string> = {
    'per_person': 'за человека',
    'per_group': 'за группу',
    // Keep Russian values as-is (for legacy tours)
    'за человека': 'за человека',
    'за группу': 'за группу'
  };
  
  const enMap: Record<string, string> = {
    'per_person': 'per person',
    'per_group': 'per group',
    'за человека': 'per person',
    'за группу': 'per group'
  };
  
  const map = language === 'en' ? enMap : ruMap;
  return map[value] || value;
}

/**
 * Centralized tour mapper - eliminates direct tour.category references
 * Maps tour data with proper localization and safe category handling
 */
export function mapTour(tour: any, language: SupportedLanguage = 'ru', options: { includeRaw?: boolean; removeImages?: boolean } = {}) {
  const { includeRaw = false, removeImages = false } = options;
  
  try {
    // Process categories from many-to-many relation or fallback to single category
    let categories = [];
    if (tour.tourCategoryAssignments && tour.tourCategoryAssignments.length > 0) {
      categories = tour.tourCategoryAssignments.map((assignment: any) => ({
        id: assignment.category.id,
        name: parseMultilingualField(assignment.category.name, language),
        isPrimary: assignment.isPrimary
      }));
    } else if (tour.category) {
      // Fallback to single category for backward compatibility
      categories = [{
        id: tour.category.id,
        name: parseMultilingualField(tour.category.name, language),
        isPrimary: true
      }];
    }
    
    // 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Денормализация enum значений для отображения на фронтенде
    const localizedTourType = denormalizeTourType(tour.tourType || tour.format, language);
    const localizedPriceType = denormalizePriceType(tour.priceType, language);
    
    const mappedTour = {
      ...tour,
      title: parseMultilingualField(tour.title, language),
      description: parseMultilingualField(tour.description, language),
      shortDesc: tour.shortDesc ? parseMultilingualField(tour.shortDesc, language) : null,
      hasImages: !!(tour.mainImage || tour.images),
      // Primary category for backward compatibility
      category: categories.find((c: any) => c.isPrimary) || categories[0] || null,
      // All categories
      categories: categories,
      // Add country and city from relations
      country: tour.tourCountry ? parseMultilingualField(tour.tourCountry.name, language) : null,
      city: tour.tourCity ? parseMultilingualField(tour.tourCity.name, language) : null
    };
    
    // 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: ПЕРЕЗАПИСЫВАЕМ enum значения денормализованными
    // Важно делать это ПОСЛЕ spread оператора, чтобы точно перезаписать значения
    mappedTour.tourType = localizedTourType;
    mappedTour.format = localizedTourType; // Keep both for backward compatibility
    mappedTour.priceType = localizedPriceType;

    // Remove images for performance if requested
    if (removeImages) {
      delete mappedTour.mainImage;
      delete mappedTour.images;
    }

    // Add raw JSON for admin if requested
    if (includeRaw) {
      mappedTour._raw = {
        title: safeJsonParse(tour.title),
        description: safeJsonParse(tour.description),
        shortDesc: tour.shortDesc ? safeJsonParse(tour.shortDesc) : null
      };
    }

    return mappedTour;
  } catch (error) {
    console.error('Error mapping tour:', error, 'Tour ID:', tour.id);
    // Fallback with safe defaults
    return {
      ...tour,
      title: tour.title || '',
      description: tour.description || '',
      shortDesc: tour.shortDesc || null,
      hasImages: !!(tour.mainImage || tour.images),
      category: tour.category ? {
        id: tour.category.id,
        name: parseMultilingualField(tour.category.name, language)
      } : null,
      categories: []
    };
  }
}