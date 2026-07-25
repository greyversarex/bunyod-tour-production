// === UTILITY FUNCTIONS FOR BUNYOD-TOUR ===
// Общие вспомогательные функции для всего сайта

/**
 * Безопасно конвертирует относительный путь к изображению в абсолютный URL
 * ВАЖНО: ВСЕГДА используйте эту функцию для изображений, чтобы избежать broken images
 * 
 * @param {string} relativePath - Путь к изображению (относительный, абсолютный или HTTP URL)
 * @returns {string} Абсолютный URL изображения или placeholder при ошибке
 * 
 * @example
 * // ✅ ПРАВИЛЬНО:
 * <img src="${getAbsoluteImageUrl(tour.mainImage)}" />
 * 
 * // ❌ НЕПРАВИЛЬНО:
 * <img src="${tour.mainImage}" />  // Может быть null или относительный путь
 * 
 * @example
 * getAbsoluteImageUrl('/uploads/images/photo.jpg') 
 * // => 'https://example.com/uploads/images/photo.jpg'
 * 
 * getAbsoluteImageUrl('uploads/images/photo.jpg')
 * // => 'https://example.com/uploads/images/photo.jpg'
 * 
 * getAbsoluteImageUrl('https://example.com/photo.jpg')
 * // => 'https://example.com/photo.jpg'
 * 
 * getAbsoluteImageUrl(null)
 * // => 'https://via.placeholder.com/400x300/e0e0e0/666666?text=No+Image'
 */
function getAbsoluteImageUrl(relativePath) {
  // Placeholder изображение для случаев, когда путь отсутствует
  const placeholder = 'https://via.placeholder.com/400x300/e0e0e0/666666?text=No+Image';
  
  // Проверка на пустое значение или неправильный тип
  if (!relativePath || typeof relativePath !== 'string') {
    console.warn('⚠️ getAbsoluteImageUrl: Invalid path provided:', relativePath);
    return placeholder;
  }
  
  // Убираем пробелы по краям
  relativePath = relativePath.trim();
  
  // Если пустая строка после trim
  if (!relativePath) {
    return placeholder;
  }
  
  // Если это уже абсолютный URL (начинается с http:// или https://)
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  
  // Если путь начинается с /, создаем URL от корня сайта
  if (relativePath.startsWith('/')) {
    try {
      return new URL(relativePath, window.location.origin).href;
    } catch (error) {
      console.error('❌ Error creating absolute URL:', error, 'Path:', relativePath);
      return placeholder;
    }
  }
  
  // Если путь без слеша в начале (например "uploads/images/photo.jpg")
  // Добавляем слеш и создаем URL
  try {
    return new URL('/' + relativePath, window.location.origin).href;
  } catch (error) {
    console.error('❌ Error creating absolute URL:', error, 'Path:', relativePath);
    return placeholder;
  }
}

/**
 * Безопасно получает первое изображение из массива или возвращает placeholder
 * 
 * @param {Array|string} images - Массив URL изображений или одиночный URL
 * @returns {string} Абсолютный URL первого изображения
 * 
 * @example
 * getFirstImage(['/uploads/img1.jpg', '/uploads/img2.jpg'])
 * // => 'https://example.com/uploads/img1.jpg'
 * 
 * getFirstImage('/uploads/img1.jpg')
 * // => 'https://example.com/uploads/img1.jpg'
 * 
 * getFirstImage([])
 * // => placeholder URL
 */
function getFirstImage(images) {
  // Если это строка, обрабатываем как одно изображение
  if (typeof images === 'string') {
    return getAbsoluteImageUrl(images);
  }
  
  // Если это массив, берем первый элемент
  if (Array.isArray(images) && images.length > 0) {
    return getAbsoluteImageUrl(images[0]);
  }
  
  // Иначе возвращаем placeholder
  return getAbsoluteImageUrl(null);
}

/**
 * Конвертирует массив относительных путей в массив абсолютных URL
 * 
 * @param {Array} images - Массив путей к изображениям
 * @returns {Array} Массив абсолютных URL
 * 
 * @example
 * normalizeImageArray(['/uploads/img1.jpg', 'uploads/img2.jpg'])
 * // => ['https://example.com/uploads/img1.jpg', 'https://example.com/uploads/img2.jpg']
 */
function normalizeImageArray(images) {
  if (!Array.isArray(images)) {
    console.warn('⚠️ normalizeImageArray: Expected array, got:', typeof images);
    return [];
  }
  
  return images
    .filter(img => img && typeof img === 'string') // Отфильтровываем невалидные значения
    .map(img => getAbsoluteImageUrl(img));
}

// Экспортируем функции в глобальную область видимости
window.getAbsoluteImageUrl = getAbsoluteImageUrl;
window.getFirstImage = getFirstImage;
window.normalizeImageArray = normalizeImageArray;

console.log('✅ Utils.js loaded: Image utility functions available');
