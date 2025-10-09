// ==============================================
// ADMIN HELPERS - Единый стандарт обработки данных
// Version: 1.0.0
// Last Updated: 2025-10-02
// ==============================================

// ==================== СЕКЦИЯ 1: API UTILITIES ====================

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

// ==================== СЕКЦИЯ 2: FORM DATA COLLECTION ====================

/**
 * Безопасное получение значения из элемента формы
 * @param {string} elementId - ID элемента
 * @param {*} defaultValue - Значение по умолчанию
 * @param {string|null} type - Тип значения ('checkbox', 'float', 'int', null)
 * @returns {*} - Значение элемента или defaultValue
 */
function safeGetValue(elementId, defaultValue = null, type = null) {
    const element = document.getElementById(elementId);
    if (!element) {
        return defaultValue;
    }

    switch (type) {
        case 'checkbox':
            return element.checked;
        case 'float': {
            const raw = (element.value ?? '').trim().replace(',', '.');
            if (raw === '') {
                return defaultValue ?? null;
            }
            const num = parseFloat(raw);
            return Number.isFinite(num) ? num : (defaultValue ?? null);
        }
        case 'int': {
            const raw = (element.value ?? '').trim();
            if (raw === '') {
                return defaultValue ?? null;
            }
            const num = parseInt(raw, 10);
            return Number.isFinite(num) ? num : (defaultValue ?? null);
        }
        default: {
            const value = (element.value ?? '').trim();
            return value !== '' ? value : defaultValue;
        }
    }
}

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
            type,
            elementId,
            required = false,
            defaultValue = null,
            transform = null
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
                const enValue = safeGetValue(enId, ruValue);
                
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
                    continue;
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
                    name: getTypeName(prefix, type),
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

// ==================== СЕКЦИЯ 3: FORM DATA LOADING ====================

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

// ==================== СЕКЦИЯ 4: VALIDATION ====================

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

// ==================== СЕКЦИЯ 5: UI UTILITIES ====================

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

// ==================== СЕКЦИЯ 6: LOCATION (Countries/Cities) ====================

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

// ==================== СЕКЦИЯ 7: SPECIALIZED HELPERS ====================

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
