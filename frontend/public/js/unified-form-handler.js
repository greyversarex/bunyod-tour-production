/**
 * UNIFIED FORM HANDLER
 * Универсальная система обработки форм для админ-панели
 * Убирает дублирование кода между Tours, Hotels, Guides, Drivers и т.д.
 */

class UnifiedFormHandler {
  /**
   * @param {Object} config - Конфигурация обработчика
   * @param {string} config.entity - Название сущности ('tour', 'hotel', 'guide', 'driver')
   * @param {string} config.formId - ID формы
   * @param {string} config.idFieldId - ID поля с ID сущности
   * @param {string} config.apiEndpoint - API endpoint (например '/api/tours')
   * @param {boolean} config.useFormData - Использовать FormData (для файлов) или JSON
   * @param {Function} config.onSuccess - Callback при успехе
   * @param {Function} config.onError - Callback при ошибке
   * @param {Function} config.collectData - Функция сбора данных из формы
   * @param {Function} config.validateData - Функция валидации (опционально)
   */
  constructor(config) {
    this.config = config;
    this.formElement = document.getElementById(config.formId);
    
    if (!this.formElement) {
      console.error(`Form with id "${config.formId}" not found`);
    }
  }

  /**
   * Сохранение сущности (создание или редактирование)
   */
  async save() {
    try {
      // 1. Определяем режим (create или edit)
      const entityId = document.getElementById(this.config.idFieldId)?.value;
      const isEditing = entityId && entityId !== '';
      
      console.log(`💾 Saving ${this.config.entity}:`, isEditing ? `Editing ID ${entityId}` : 'Creating new');

      // 2. Собираем данные из формы
      const data = this.config.collectData ? 
        this.config.collectData(isEditing, entityId) : 
        this.collectFormData();

      // 3. Валидация (если задана)
      if (this.config.validateData) {
        const validation = this.config.validateData(data);
        if (!validation.valid) {
          alert(`Ошибка валидации: ${validation.message}`);
          return;
        }
      }

      // 4. Формируем запрос
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? 
        `${this.config.apiEndpoint}/${entityId}` : 
        this.config.apiEndpoint;

      // 5. Подготовка headers
      const headers = {};
      const token = localStorage.getItem('adminToken') || localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Для JSON устанавливаем Content-Type
      if (!this.config.useFormData) {
        headers['Content-Type'] = 'application/json';
      }

      // 6. Отправляем запрос
      console.log(`📤 Sending ${method} request to ${url}`);
      
      const response = await fetch(url, {
        method: method,
        headers: headers,
        body: this.config.useFormData ? data : JSON.stringify(data)
      });

      const result = await response.json();

      // 7. Обработка результата
      if (response.ok && result.success !== false) {
        console.log(`✅ ${this.config.entity} saved successfully:`, result);
        
        // Callback успеха
        if (this.config.onSuccess) {
          this.config.onSuccess(result, isEditing);
        } else {
          alert(`${this.config.entity} успешно сохранен!`);
        }
      } else {
        throw new Error(result.message || result.error || 'Ошибка сохранения');
      }

    } catch (error) {
      console.error(`❌ Error saving ${this.config.entity}:`, error);
      
      // Callback ошибки
      if (this.config.onError) {
        this.config.onError(error);
      } else {
        alert(`Ошибка: ${error.message}`);
      }
    }
  }

  /**
   * Базовый сбор данных из формы (если не задана кастомная функция)
   */
  collectFormData() {
    if (this.config.useFormData) {
      return new FormData(this.formElement);
    } else {
      // Собираем данные из всех input/select/textarea
      const formData = {};
      const inputs = this.formElement.querySelectorAll('input, select, textarea');
      
      inputs.forEach(input => {
        if (input.name) {
          formData[input.name] = input.value;
        }
      });
      
      return formData;
    }
  }

  /**
   * Загрузка данных сущности для редактирования
   */
  async load(entityId) {
    try {
      console.log(`📥 Loading ${this.config.entity} with ID ${entityId}`);

      const headers = {};
      const token = localStorage.getItem('adminToken') || localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${this.config.apiEndpoint}/${entityId}?includeRaw=true`,
        { headers }
      );

      const result = await response.json();

      if (response.ok && result.success !== false) {
        console.log(`✅ ${this.config.entity} loaded:`, result);
        return result.data;
      } else {
        throw new Error(result.message || result.error || 'Ошибка загрузки');
      }

    } catch (error) {
      console.error(`❌ Error loading ${this.config.entity}:`, error);
      alert(`Ошибка загрузки: ${error.message}`);
      return null;
    }
  }
}

/**
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 */

/**
 * Создание объекта многоязычного поля из значений инпутов
 * @param {string} enValue - Значение на английском
 * @param {string} ruValue - Значение на русском
 */
function createMultilingualField(enValue, ruValue) {
  return {
    en: enValue || '',
    ru: ruValue || ''
  };
}

/**
 * Заполнение многоязычных полей в форме
 * @param {string} fieldNamePrefix - Префикс имени поля (например 'tourTitle')
 * @param {Object|string} fieldValue - Значение поля (JSON объект или строка)
 */
function fillMultilingualField(fieldNamePrefix, fieldValue) {
  let parsed = fieldValue;
  
  // Парсим если это строка
  if (typeof fieldValue === 'string') {
    try {
      parsed = JSON.parse(fieldValue);
    } catch {
      parsed = { ru: fieldValue, en: '' };
    }
  }
  
  // Заполняем поля
  const enField = document.getElementById(`${fieldNamePrefix}EN`);
  const ruField = document.getElementById(`${fieldNamePrefix}RU`);
  
  if (enField) enField.value = parsed?.en || '';
  if (ruField) ruField.value = parsed?.ru || '';
}

/**
 * Валидация многоязычного поля
 * @param {Object} field - Многоязычное поле
 * @param {string} fieldName - Название поля для сообщения об ошибке
 */
function validateMultilingualField(field, fieldName) {
  if (!field || (!field.en && !field.ru)) {
    return {
      valid: false,
      message: `${fieldName} обязателен хотя бы на одном языке`
    };
  }
  return { valid: true };
}

/**
 * Получение токена авторизации
 */
function getAuthToken() {
  return localStorage.getItem('adminToken') || 
         localStorage.getItem('authToken') || 
         localStorage.getItem('guideToken') || 
         localStorage.getItem('driverToken');
}

/**
 * Получение заголовков с авторизацией
 */
function getAuthHeaders(includeContentType = true) {
  const headers = {};
  const token = getAuthToken();
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  
  return headers;
}

// Экспортируем в глобальную область (для использования в admin-dashboard.html)
window.UnifiedFormHandler = UnifiedFormHandler;
window.createMultilingualField = createMultilingualField;
window.fillMultilingualField = fillMultilingualField;
window.validateMultilingualField = validateMultilingualField;
window.getAuthToken = getAuthToken;
window.getAuthHeaders = getAuthHeaders;
