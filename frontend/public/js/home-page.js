/**
 * HOME PAGE JAVASCRIPT MODULE
 * Модуль для главной страницы сайта Bunyod-Tour
 * Includes: filters, search, tours display, country/city management
 */

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ МНОГОЯЗЫЧНОСТИ ===

/**
 * Получает значение поля на текущем языке
 * @param {object} obj - Объект с данными
 * @param {string} field - Имя поля
 * @returns {string} Локализованное значение
 */
function getMultilingualValue(obj, field) {
    if (!obj) return '';
    
    const currentLang = getCurrentLanguage();
    const value = obj[field];
    
    if (typeof value === 'object' && value !== null) {
        return value[currentLang] || value.ru || value.en || '';
    }
    
    return value || '';
}

/**
 * Получает текущий язык
 * @returns {string} Код языка ('ru' | 'en')
 */
function getCurrentLanguage() {
    return window.currentLanguage || 
           localStorage.getItem('selectedLanguage') || 
           (navigator.language && navigator.language.startsWith('en') ? 'en' : 'ru') || 
           'ru';
}

// Функция для переключения деталей информационных блоков
function toggleDetails(detailsId, button) {
    const detailsElement = document.getElementById(detailsId);
    
    if (detailsElement.classList.contains('hidden')) {
        detailsElement.classList.remove('hidden');
    } else {
        detailsElement.classList.add('hidden');
    }
}

// Данные о городах по странам - загружаются динамически из API
let citiesByCountry = {};
let countriesData = [];
let citiesData = [];
let categoriesData = []; // 🏷️ ДОБАВЛЕНО: Хранение категорий из API

// 💱 СИСТЕМА ВАЛЮТ
let exchangeRates = {}; // Хранение курсов валют
let currentCurrency = 'TJS'; // Текущая валюта по умолчанию

// Загрузка стран и городов из API
async function loadCountriesAndCities() {
    try {
        // Загружаем страны
        const countriesResponse = await fetch('/api/countries');
        if (countriesResponse.ok) {
            const countriesResult = await countriesResponse.json();
            if (countriesResult.success) {
                countriesData = countriesResult.data;
            }
        }
        
        // Загружаем города
        const citiesResponse = await fetch('/api/cities');
        if (citiesResponse.ok) {
            const citiesResult = await citiesResponse.json();
            if (citiesResult.success) {
                citiesData = citiesResult.data;
                
                // Группируем города по странам
                citiesByCountry = {};
                countriesData.forEach(country => {
                    const countryName = getMultilingualValue(country, 'name');
                    const countryCities = citiesData.filter(city => 
                        city.countryId === country.id
                    ).map(city => getMultilingualValue(city, 'name'));
                    citiesByCountry[countryName] = countryCities;
                });
                
            }
        }
    } catch (error) {
        console.error('❌ Error loading countries and cities:', error);
        // Fallback к старым данным если API недоступен - используем bilingual structure
        const currentLang = getCurrentLanguage();
        const fallbackCountries = [
            { nameRu: 'Таджикистан', nameEn: 'Tajikistan', cities: [
                { nameRu: 'Душанбе', nameEn: 'Dushanbe' },
                { nameRu: 'Худжанд', nameEn: 'Khujand' },
                { nameRu: 'Хорог', nameEn: 'Khorog' }
            ]},
            { nameRu: 'Узбекистан', nameEn: 'Uzbekistan', cities: [
                { nameRu: 'Ташкент', nameEn: 'Tashkent' },
                { nameRu: 'Самарканд', nameEn: 'Samarkand' },
                { nameRu: 'Бухара', nameEn: 'Bukhara' }
            ]},
            { nameRu: 'Кыргызстан', nameEn: 'Kyrgyzstan', cities: [
                { nameRu: 'Бишкек', nameEn: 'Bishkek' }
            ]},
            { nameRu: 'Казахстан', nameEn: 'Kazakhstan', cities: [
                { nameRu: 'Астана', nameEn: 'Astana' },
                { nameRu: 'Алматы', nameEn: 'Almaty' }
            ]},
            { nameRu: 'Туркменистан', nameEn: 'Turkmenistan', cities: [
                { nameRu: 'Ашхабад', nameEn: 'Ashgabat' }
            ]}
        ];
        
        // Build citiesByCountry using current language
        citiesByCountry = {};
        fallbackCountries.forEach(country => {
            const countryName = currentLang === 'en' ? country.nameEn : country.nameRu;
            citiesByCountry[countryName] = country.cities.map(city => 
                currentLang === 'en' ? city.nameEn : city.nameRu
            );
        });
        
        // Build countriesData for compatibility
        countriesData = fallbackCountries.map(c => ({
            nameRu: c.nameRu,
            nameEn: c.nameEn,
            name: currentLang === 'en' ? c.nameEn : c.nameRu
        }));
    }
}

// 🏷️ ДОБАВЛЕНО: Загрузка категорий из API
async function loadCategories() {
    try {
        console.log('🏷️ Loading categories from API...');
        const response = await fetch('/api/categories');
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                categoriesData = result.data;
                console.log('🏷️ Categories loaded:', categoriesData.length);
                updateCategoryFilter();
            } else {
                console.error('❌ Failed to load categories:', result.error);
            }
        } else {
            console.error('❌ Categories API request failed:', response.status);
        }
    } catch (error) {
        console.error('❌ Error loading categories:', error);
    }
}

// 🏷️ ДОБАВЛЕНО: Маппинг переводов категорий (так как БД не поддерживает multilingual)
const categoryTranslations = {
    'Однодневные': { ru: 'Однодневные', en: 'Single Day' },
    'Многодневный': { ru: 'Многодневный', en: 'Multi-Day' },
    'Многодневные': { ru: 'Многодневные', en: 'Multi-Day' },
    'Экскурсии': { ru: 'Экскурсии', en: 'Excursions' },
    'Городские': { ru: 'Городские', en: 'City' },
    'Городские туры': { ru: 'Городские туры', en: 'City Tours' },
    'Природа/экологические': { ru: 'Природа/экологические', en: 'Nature/Eco' },
    'Природа, экологические туры': { ru: 'Природа, экологические туры', en: 'Nature, Eco Tours' },
    'Культурно познавательные': { ru: 'Культурно познавательные', en: 'Cultural' },
    'Культурно познавательные туры': { ru: 'Культурно познавательные туры', en: 'Cultural Tours' },
    'Исторические': { ru: 'Исторические', en: 'Historical' },
    'Исторические туры': { ru: 'Исторические туры', en: 'Historical Tours' },
    'Походы/треккинги': { ru: 'Походы/треккинги', en: 'Trekking/Hiking' },
    'Походы, трекинги': { ru: 'Походы, трекинги', en: 'Hiking, Trekking' },
    'Горные ландшафты': { ru: 'Горные ландшафты', en: 'Mountain Landscapes' },
    'Озерные ландшафты': { ru: 'Озерные ландшафты', en: 'Lake Landscapes' },
    'Приключенческие': { ru: 'Приключенческие', en: 'Adventure' },
    'Приключенческие туры': { ru: 'Приключенческие туры', en: 'Adventure Tours' },
    'Гастрономические': { ru: 'Гастрономические', en: 'Culinary' },
    'Гастрономические туры': { ru: 'Гастрономические туры', en: 'Culinary Tours' },
    'Авто/сафари/джип': { ru: 'Авто/сафари/джип', en: 'Auto/Safari/Jeep' },
    'Автотуры, сафари, джип-туры': { ru: 'Автотуры, сафари, джип-туры', en: 'Auto, Safari, Jeep Tours' },
    'Агротуризм': { ru: 'Агротуризм', en: 'Agro' },
    'Агротуры': { ru: 'Агротуры', en: 'Agro Tours' },
    'VIP': { ru: 'VIP', en: 'VIP' },
    'VIP туры': { ru: 'VIP туры', en: 'VIP Tours' }
};

// 🏷️ ДОБАВЛЕНО: Обновление фильтра категорий
function updateCategoryFilter() {
    const categorySelect = document.getElementById('categoryFilter');
    if (categorySelect) {
        // Получаем текущий язык
        const currentLang = getCurrentLanguage();
        
        // Создаем первую опцию с правильным переводом
        const firstOption = document.createElement('option');
        firstOption.value = '';
        firstOption.setAttribute('data-translate', 'filter.category');
        firstOption.textContent = currentLang === 'en' ? 'Category' : 'Категория';
        
        // Очищаем и добавляем первую опцию
        categorySelect.innerHTML = '';
        categorySelect.appendChild(firstOption);
        
        // Проверяем наличие категорий
        if (categoriesData && categoriesData.length > 0) {
            // Добавляем категории из API
            categoriesData.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id; // Используем ID категории как значение
                
                // Используем маппинг переводов
                let categoryName = category.name;
                if (categoryTranslations[category.name]) {
                    categoryName = categoryTranslations[category.name][currentLang] || category.name;
                }
                
                option.textContent = categoryName;
                categorySelect.appendChild(option);
            });
            
            console.log('🏷️ Category filter updated with', categoriesData.length, 'categories');
        } else {
            // Fallback: добавляем базовые категории если API не вернул данные
            console.log('⚠️ No categories from API, using fallback categories');
            const currentLang = getCurrentLanguage();
            const fallbackCategories = [
                { value: 'cultural', textRu: 'Культурные туры', textEn: 'Cultural Tours' },
                { value: 'adventure', textRu: 'Приключенческие туры', textEn: 'Adventure Tours' },
                { value: 'nature', textRu: 'Природные туры', textEn: 'Nature Tours' },
                { value: 'city', textRu: 'Городские туры', textEn: 'City Tours' },
                { value: 'mountain', textRu: 'Горные туры', textEn: 'Mountain Tours' }
            ];
            
            fallbackCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.value;
                option.textContent = currentLang === 'en' ? category.textEn : category.textRu;
                categorySelect.appendChild(option);
            });
        }
    }
}

// Данные отелей по странам
const hotelsByCountry = {
    'Таджикистан': [
        {group: 'Люкс сегмент', hotels: ['Serena Hotels', 'Crystal Hotels']},
        {group: 'Премиум сегмент', hotels: ['Hilton', 'Marriott', 'InterContinental', 'Hyatt']},
        {group: 'Средний сегмент', hotels: ['Holiday Inn', 'Radisson', 'Novotel']},
        {group: 'Местные и региональные', hotels: ['Golden Tulip', 'Maritim']}
    ],
    'Узбекистан': [
        {group: 'Люкс сегмент', hotels: ['Four Seasons', 'Ritz-Carlton', 'St. Regis']},
        {group: 'Премиум сегмент', hotels: ['Hilton', 'Marriott', 'Hyatt', 'InterContinental', 'Sheraton', 'Westin']},
        {group: 'Средний сегмент', hotels: ['Holiday Inn', 'Courtyard', 'Radisson', 'Novotel', 'Ibis']},
        {group: 'Местные и региональные', hotels: ['Serena Hotels', 'Golden Tulip', 'Barcelo']}
    ],
    'Казахстан': [
        {group: 'Люкс сегмент', hotels: ['Ritz-Carlton', 'St. Regis', 'Four Seasons']},
        {group: 'Премиум сегмент', hotels: ['Marriott', 'Hilton', 'InterContinental', 'Hyatt', 'Sheraton']},
        {group: 'Средний сегмент', hotels: ['Holiday Inn', 'Radisson', 'Courtyard', 'Hampton Inn']},
        {group: 'Бюджетный сегмент', hotels: ['Holiday Inn Express', 'Comfort Inn', 'Best Western']}
    ],
    'Кыргызстан': [
        {group: 'Премиум сегмент', hotels: ['Hyatt', 'Sheraton']},
        {group: 'Средний сегмент', hotels: ['Radisson', 'Novotel', 'Holiday Inn']},
        {group: 'Бюджетный сегмент', hotels: ['Best Western', 'Comfort Inn']},
        {group: 'Местные и региональные', hotels: ['Golden Tulip', 'Crystal Hotels']}
    ],
    'Туркменистан': [
        {group: 'Люкс сегмент', hotels: ['Aman']},
        {group: 'Премиум сегмент', hotels: ['Sheraton', 'Sofitel']},
        {group: 'Средний сегмент', hotels: ['Radisson', 'Holiday Inn']},
        {group: 'Местные и региональные', hotels: ['Golden Tulip', 'Maritim']}
    ]
};

// Функция для обновления фильтра стран
function populateCountryFilter() {
    const countrySelect = document.getElementById('countryFilter');
    if (!countrySelect) return;
    
    // Сохраняем текущий выбор
    const currentValue = countrySelect.value;
    
    // Очищаем и заполняем фильтр стран
    countrySelect.innerHTML = '';
    
    // Добавляем placeholder опцию через перевод
    const currentLang = getCurrentLanguage();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = getTranslation('filter.country') || (currentLang === 'en' ? 'Country' : 'Страна');
    countrySelect.appendChild(placeholder);
    
    // Добавляем страны из загруженных данных
    countriesData.forEach(country => {
        const option = document.createElement('option');
        const countryName = getMultilingualValue(country, 'name');
        option.value = countryName;
        option.textContent = countryName;
        countrySelect.appendChild(option);
    });
    
    // Восстанавливаем выбор, если возможно
    if (currentValue) {
        countrySelect.value = currentValue;
    }
}

// Функция для обновления списка городов
function updateCities() {
    const citySelect = document.getElementById('cityFilter');
    
    if (!citySelect) return;
    
    // Очищаем список городов
    citySelect.innerHTML = '';
    
    // Добавляем placeholder через перевод
    const currentLang = getCurrentLanguage();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = getTranslation('filter.city') || (currentLang === 'en' ? 'City' : 'Город');
    citySelect.appendChild(placeholder);
    
    // Показываем все города независимо от выбранной страны
    let allCities = [];
    
    if (citiesData && citiesData.length > 0) {
        // Используем данные из API
        allCities = citiesData.map(city => getMultilingualValue(city, 'name'));
    } else {
        // Fallback: собираем все города из citiesByCountry
        const citiesSet = new Set();
        Object.values(citiesByCountry).forEach(cities => {
            cities.forEach(city => citiesSet.add(city));
        });
        allCities = Array.from(citiesSet);
    }
    
    // Сортируем и добавляем города в select
    allCities.sort().forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });
}

// Функция для обновления списка отелей
function updateHotels() {
    // Функция больше не используется после удаления hotel фильтров
    return;
}

// Новая функция для обновления фильтров отелей на основе страны
function updateHotelFilters() {
    // Функция больше не используется после удаления hotel фильтров
    return;
}

// Функция для переключения панели фильтров
function toggleFilterPanel() {
    const filterPanel = document.getElementById('filterPanel');
    if (filterPanel.classList.contains('hidden')) {
        filterPanel.classList.remove('hidden');
    } else {
        filterPanel.classList.add('hidden');
    }
}

// Переменные для автодополнения
let searchTimeout;
let currentSuggestions = [];

// Функция для обработки ввода в поисковую строку
function handleSearchInput(query) {
    clearTimeout(searchTimeout);
    
    if (query.length >= 2) {
        searchTimeout = setTimeout(() => {
            fetchSuggestions(query);
        }, 300); // Задержка 300мс для избежания лишних запросов
    } else {
        hideSuggestions();
    }
}

// Функция для получения подсказок
async function fetchSuggestions(query) {
    try {
        const response = await fetch(`${window.location.origin}/api/tours/suggestions?query=${encodeURIComponent(query)}`);
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            currentSuggestions = result.data;
            displaySuggestions(result.data);
        } else {
            // Показываем стандартные подсказки если API недоступен
            showDefaultSuggestions(query);
        }
    } catch (error) {
        // Показываем стандартные подсказки если API недоступен
        showDefaultSuggestions(query);
    }
}

// Функция для отображения подсказок
function displaySuggestions(suggestions) {
    const container = document.getElementById('searchSuggestions');
    
    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }
    
    // Безопасное создание DOM элементов (защита от XSS)
    container.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'suggestion-item';
        suggestionDiv.onclick = () => selectSuggestion(suggestion.text, suggestion.type, suggestion.id);
        
        const iconSvg = document.createElement('svg');
        iconSvg.className = 'suggestion-icon';
        iconSvg.setAttribute('fill', 'none');
        iconSvg.setAttribute('stroke', 'currentColor');
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.innerHTML = getSuggestionIcon(suggestion.type);
        
        const textSpan = document.createElement('span');
        textSpan.className = 'suggestion-text';
        textSpan.textContent = suggestion.text; // Безопасная вставка текста
        
        const typeSpan = document.createElement('span');
        typeSpan.className = 'suggestion-type';
        // Переводим тип в зависимости от языка
        const currentLang = localStorage.getItem('selectedLanguage') || 'ru';
        const typeTranslations = {
            'тур': { ru: 'тур', en: 'tour' },
            'tour': { ru: 'тур', en: 'tour' },
            'отель': { ru: 'отель', en: 'hotel' },
            'hotel': { ru: 'отель', en: 'hotel' },
            'страна': { ru: 'страна', en: 'country' },
            'country': { ru: 'страна', en: 'country' },
            'город': { ru: 'город', en: 'city' },
            'city': { ru: 'город', en: 'city' },
            'категория': { ru: 'категория', en: 'category' },
            'category': { ru: 'категория', en: 'category' },
            'тип тура': { ru: 'тип тура', en: 'tour type' },
            'tour type': { ru: 'тип тура', en: 'tour type' },
            'место': { ru: 'место', en: 'place' },
            'place': { ru: 'место', en: 'place' }
        };
        const typeNormalized = suggestion.type.toLowerCase();
        const translatedType = typeTranslations[typeNormalized] 
            ? typeTranslations[typeNormalized][currentLang] 
            : suggestion.type;
        typeSpan.textContent = translatedType; // Безопасная вставка текста
        
        suggestionDiv.appendChild(iconSvg);
        suggestionDiv.appendChild(textSpan);
        suggestionDiv.appendChild(typeSpan);
        
        container.appendChild(suggestionDiv);
    });
    
    container.classList.remove('hidden');
}

// Функция для получения иконки подсказки
function getSuggestionIcon(type) {
    const typeNormalized = type.toLowerCase();
    
    // Тур
    if (typeNormalized === 'тур' || typeNormalized === 'tour') {
        return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>';
    }
    
    // Отель
    if (typeNormalized === 'отель' || typeNormalized === 'hotel') {
        return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>';
    }
    
    // Страна
    if (typeNormalized === 'страна' || typeNormalized === 'country') {
        return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
    }
    
    // Город
    if (typeNormalized === 'город' || typeNormalized === 'city') {
        return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>';
    }
    
    // Категория
    if (typeNormalized === 'категория' || typeNormalized === 'category') {
        return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>';
    }
    
    // Тип тура
    if (typeNormalized === 'тип тура' || typeNormalized === 'tour type') {
        return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>';
    }
    
    // По умолчанию - иконка поиска
    return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>';
}

// Функция для отображения стандартных подсказок
function showDefaultSuggestions(query) {
    const currentLang = getCurrentLanguage();
    const defaultSuggestions = [
        { textRu: 'Памир', textEn: 'Pamir', typeRu: 'место', typeEn: 'place' },
        { textRu: 'Искандеркуль', textEn: 'Iskanderkul', typeRu: 'место', typeEn: 'place' },
        { textRu: 'Душанбе', textEn: 'Dushanbe', typeRu: 'место', typeEn: 'place' },
        { textRu: 'Горные туры', textEn: 'Mountain Tours', typeRu: 'категория', typeEn: 'category' },
        { textRu: 'Трекинг', textEn: 'Trekking', typeRu: 'категория', typeEn: 'category' },
        { textRu: 'Культурные туры', textEn: 'Cultural Tours', typeRu: 'категория', typeEn: 'category' }
    ].map(s => ({
        text: currentLang === 'en' ? s.textEn : s.textRu,
        type: currentLang === 'en' ? s.typeEn : s.typeRu
    })).filter(s => s.text.toLowerCase().includes(query.toLowerCase()));
    
    if (defaultSuggestions.length > 0) {
        displaySuggestions(defaultSuggestions);
    }
}

// Функция для выбора подсказки
function selectSuggestion(text, type, id) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = text;
    hideSuggestions();
    
    // Определяем тип результата и куда переходить
    const typeNormalized = type.toLowerCase();
    
    // Туры → страница тура
    if ((typeNormalized === 'тур' || typeNormalized === 'tour') && id) {
        window.location.href = `tour.html?id=${id}`;
        return;
    }
    
    // Отели → страница отеля
    if ((typeNormalized === 'отель' || typeNormalized === 'hotel') && id) {
        window.location.href = `hotel-template.html?id=${id}`;
        return;
    }
    
    // Страны → страница поиска с фильтром по стране
    if (typeNormalized === 'страна' || typeNormalized === 'country') {
        const params = new URLSearchParams();
        if (id) {
            params.append('countryId', id);
        } else {
            params.append('country', text);
        }
        window.location.href = `tours-search.html?${params.toString()}`;
        return;
    }
    
    // Города → страница поиска с фильтром по городу
    if (typeNormalized === 'город' || typeNormalized === 'city') {
        const params = new URLSearchParams();
        if (id) {
            params.append('cityId', id);
        } else {
            params.append('city', text);
        }
        window.location.href = `tours-search.html?${params.toString()}`;
        return;
    }
    
    // Категории → страница поиска с фильтром по категории
    if (typeNormalized === 'категория' || typeNormalized === 'category') {
        const params = new URLSearchParams();
        if (id) {
            params.append('categoryId', id);
        } else {
            params.append('category', text);
        }
        window.location.href = `tours-search.html?${params.toString()}`;
        return;
    }
    
    // Типы туров → страница поиска с фильтром по формату
    if (typeNormalized === 'тип тура' || typeNormalized === 'tour type') {
        const params = new URLSearchParams();
        // Преобразуем название в значение формата
        const formatMap = {
            'персональный': 'individual',
            'individual': 'individual',
            'групповой персональный': 'group_private',
            'private group': 'group_private',
            'групповой общий': 'group_shared',
            'shared group': 'group_shared'
        };
        const format = formatMap[text.toLowerCase()] || text;
        params.append('format', format);
        window.location.href = `tours-search.html?${params.toString()}`;
        return;
    }
    
    // По умолчанию → обычный поиск
    performSearch();
}

// Функция для показа подсказок
function showSuggestions() {
    const query = document.getElementById('searchInput').value.trim();
    if (query.length >= 2 && currentSuggestions.length > 0) {
        document.getElementById('searchSuggestions').classList.remove('hidden');
    }
}

// Функция для скрытия подсказок
function hideSuggestions() {
    setTimeout(() => {
        document.getElementById('searchSuggestions').classList.add('hidden');
    }, 150); // Небольшая задержка для клика по подсказке
}

// Функция для основного поиска
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput.value.trim();
    
    // Собираем параметры фильтров
    const filters = {
        query: searchQuery,
        country: document.getElementById('countryFilter')?.value || '',
        city: document.getElementById('cityFilter')?.value || '',
        format: document.getElementById('formatFilter')?.value || '',
        category: document.getElementById('categoryFilter')?.value || '',
        date: document.getElementById('dateFilter')?.value || ''
    };
    
    // Убираем пустые значения
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value) {
            queryParams.append(key, value);
        }
    });
    
    // Переходим на страницу расширенного поиска с параметрами
    window.location.href = `tours-search.html?${queryParams.toString()}`;
}

// Функция для поиска по тексту
async function searchToursByText(query) {
    try {
        const response = await fetch(`${window.location.origin}/api/tours/search?query=${encodeURIComponent(query)}`);
        const result = await response.json();
        
        if (result.success) {
            displaySearchResults(result.data);
        } else {
            console.error('Ошибка поиска:', result.error);
            // Показываем заглушку если API недоступен
            displayMockSearchResults(query);
        }
    } catch (error) {
        console.error('Ошибка загрузки туров:', error);
        // Показываем заглушку если API недоступен
        displayMockSearchResults(query);
    }
}

// Функция для поиска туров по фильтрам
async function searchTours() {
    try {
        const filters = {
            country: document.getElementById('countryFilter')?.value || '',
            city: document.getElementById('cityFilter')?.value || '',
            format: document.getElementById('formatFilter')?.value || '',
            category: document.getElementById('categoryFilter')?.value || '',
            date: document.getElementById('dateFilter')?.value || ''
        };

        console.log('🔍 Searching tours with filters:', filters);

        // Убираем пустые фильтры
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                queryParams.append(key, value);
            }
        });

        // Конвертируем страны и города в ID для API запроса - поддержка обоих языков
        if (filters.country) {
            const country = countriesData.find(c => 
                c.nameRu === filters.country || c.nameEn === filters.country || c.name === filters.country
            );
            if (country) {
                queryParams.set('countryId', country.id.toString());
                queryParams.delete('country');
            }
        }
        
        if (filters.city) {
            const city = citiesData.find(c => 
                c.nameRu === filters.city || c.nameEn === filters.city || c.name === filters.city
            );
            if (city) {
                queryParams.set('cityId', city.id.toString());
                queryParams.delete('city');
            }
        }

        // Вызываем API для поиска туров
        const apiUrl = `/api/tours?${queryParams.toString()}`;
        console.log('📡 API URL:', apiUrl);
        
        const response = await fetch(apiUrl);
        const result = await response.json();

        if (result.success) {
            displaySearchResults(result.data);
        } else {
            console.error('❌ Search error:', result.error);
            displayMockSearchResults('');
        }
    } catch (error) {
        console.error('❌ Error searching tours:', error);
        displayMockSearchResults('');
    }
}


// Функция для отображения демо результатов
function displayMockSearchResults(query) {
    const currentLang = getCurrentLanguage();
    const mockTours = [
        {
            title: { ru: 'Памирское шоссе', en: 'Pamir Highway' },
            description: { ru: 'Захватывающее путешествие по одной из самых высокогорных дорог мира', en: 'Breathtaking journey along one of the highest mountain roads in the world' },
            country: currentLang === 'en' ? 'Tajikistan' : 'Таджикистан',
            city: currentLang === 'en' ? 'Khorog' : 'Хорог',
            format: currentLang === 'en' ? 'Group' : 'Групповой',
            duration: currentLang === 'en' ? '7 days' : '7 дней',
            theme: currentLang === 'en' ? 'Mountain Landscapes' : 'Горные ландшафты',
            price: 299
        },
        {
            title: { ru: 'Озеро Искандеркуль', en: 'Lake Iskanderkul' },
            description: { ru: 'Живописное горное озеро в окружении заснеженных пиков', en: 'Picturesque mountain lake surrounded by snow-capped peaks' },
            country: currentLang === 'en' ? 'Tajikistan' : 'Таджикистан',
            city: currentLang === 'en' ? 'Panjakent' : 'Пенджикент',
            format: currentLang === 'en' ? 'Private' : 'Персональный',
            duration: currentLang === 'en' ? '2 days' : '2 дня',
            theme: currentLang === 'en' ? 'Lake Landscapes' : 'Озерные ландшафты',
            price: 149
        },
        {
            title: { ru: 'Древний Пенджикент', en: 'Ancient Panjakent' },
            description: { ru: 'Исследуйте руины древнего согдийского города', en: 'Explore the ruins of an ancient Sogdian city' },
            country: currentLang === 'en' ? 'Tajikistan' : 'Таджикистан',
            city: currentLang === 'en' ? 'Panjakent' : 'Пенджикент',
            format: currentLang === 'en' ? 'Group' : 'Групповой',
            duration: currentLang === 'en' ? '1 day' : '1 день',
            theme: currentLang === 'en' ? 'Historical Tours' : 'Исторические туры',
            price: 89
        }
    ];

    displaySearchResults(mockTours);
}

// Функция для отображения результатов поиска
function displaySearchResults(tours) {
    const searchResults = document.getElementById('searchResults');
    const toursGrid = document.getElementById('toursGrid');
    
    if (!tours || tours.length === 0) {
        toursGrid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <h3 class="text-xl text-gray-600">Туры не найдены</h3>
                <p class="text-gray-500 mt-2">Попробуйте изменить критерии поиска</p>
            </div>
        `;
    } else {
        toursGrid.innerHTML = tours.map(tour => createTourCard(tour)).join('');
        
        // ⭐ Загружаем рейтинги туров после отображения карточек
        setTimeout(() => loadTourRatings(), 200);
    }
    
    // Показываем блок результатов и скрываем популярные туры
    searchResults.classList.remove('hidden');
    document.querySelector('section.bg-gray-50').style.display = 'none';
}

// Нормализует тип тура в стандартный enum формат для переводов
// ВАЖНО: API денормализует enum значения, поэтому нужно различать:
// - "Персональный" (без "Групповой") = individual
// - "Групповой персональный" = group_private
function normalizeTourType(tourType) {
    if (!tourType) return 'group_general';
    
    const type = tourType.toLowerCase().trim();
    
    // СНАЧАЛА проверяем точные соответствия (денормализованные значения от API)
    if (type === 'персональный' || type === 'individual') {
        return 'individual';
    }
    
    if (type === 'групповой персональный' || type === 'private group' || type === 'group_private') {
        return 'group_private';
    }
    
    if (type === 'групповой общий' || type === 'shared group' || type === 'group_general' || type === 'group_shared') {
        return 'group_general';
    }
    
    // Затем проверяем частичные совпадения (для вариантов из базы)
    if (type.includes('групповой') && (type.includes('персональн') || type.includes('приватн') || type.includes('private'))) {
        return 'group_private';
    }
    
    if (type.includes('групповой') && (type.includes('общий') || type.includes('shared'))) {
        return 'group_general';
    }
    
    if (type.includes('индивидуальн')) {
        return 'individual';
    }
    
    // Default: групповой общий
    return 'group_general';
}

// Обновляет текст макс. туристов при смене языка
function updateMaxPeopleText(language) {
    const maxPeopleElements = document.querySelectorAll('[data-max-people]');
    maxPeopleElements.forEach(element => {
        const maxPeople = element.getAttribute('data-max-people');
        if (maxPeople) {
            element.textContent = language === 'en' ? `(up to ${maxPeople} people)` : `(до ${maxPeople} чел.)`;
        }
    });
    console.log(`✅ Обновлено ${maxPeopleElements.length} элементов макс. туристов на язык: ${language}`);
}

// Функция для создания карточки тура
function createTourCard(tour) {
    const currentLang = getCurrentLanguage();
    
    // Форматируем локацию с поддержкой multilingual
    let locationText = '';
    if (tour.country && tour.city) {
        // Если country и city - объекты с nameRu/nameEn
        if (typeof tour.country === 'object' && typeof tour.city === 'object') {
            locationText = formatLocation(tour.country, tour.city, currentLang);
        } 
        // Если это строки
        else if (typeof tour.country === 'string' && typeof tour.city === 'string') {
            locationText = `${tour.country} • ${tour.city}`;
        }
    } else if (tour.city) {
        locationText = typeof tour.city === 'object' ? getEntityName(tour.city, currentLang) : tour.city;
    } else if (tour.country) {
        locationText = typeof tour.country === 'object' ? getEntityName(tour.country, currentLang) : tour.country;
    }
    
    // Нормализуем тип тура
    const rawTourType = tour.format || tour.tourType || 'group_general';
    const normalizedTourType = normalizeTourType(rawTourType);
    
    // Получаем ключ перевода для типа тура
    const tourTypeKey = `tour_type.${normalizedTourType}`;
    
    // Получаем название категории
    let categoryText = '';
    if (tour.category && tour.category.name) {
        categoryText = getCategoryNameByLanguage(tour.category.name, currentLang);
    }
    
    return `
        <div class="bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col">
            <div class="h-64 bg-gray-200 flex items-center justify-center">
                <span class="text-white text-lg font-semibold">${typeof tour.country === 'object' ? getEntityName(tour.country, currentLang) : (tour.country || '')}</span>
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-xl font-bold text-gray-900" data-tour-title data-title-ru="${escapeDataAttribute(getTitleByLanguageRaw(tour.title, 'ru'))}" data-title-en="${escapeDataAttribute(getTitleByLanguageRaw(tour.title, 'en'))}">${getTitleByLanguage(tour.title, window.i18n ? window.i18n.currentLanguage() : 'ru')}</h3>
                    <div class="flex flex-col gap-1">
                        <!-- Тип тура (format/tourType) с макс. количеством туристов -->
                        <div class="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            <span data-translate="${tourTypeKey}">${getTranslation(tourTypeKey)}</span>${normalizedTourType !== 'individual' && tour.maxPeople ? `<span class="text-gray-600 ml-1" data-max-people="${tour.maxPeople}">(${currentLang === 'en' ? `up to ${tour.maxPeople} people` : `до ${tour.maxPeople} чел.`})</span>` : ''}
                        </div>
                        <!-- Категория тура с длительностью -->
                        ${tour.category ? `
                        <div class="flex items-center px-2 py-1 rounded-full text-xs font-medium" style="background-color: #3E3E3E; color: white;">
                            <span data-tour-category data-cat-ru="${escapeDataAttribute(getCategoryNameByLanguageRaw(tour.category.name, 'ru'))}" data-cat-en="${escapeDataAttribute(getCategoryNameByLanguageRaw(tour.category.name, 'en'))}">${categoryText}${(tour.duration || tour.durationDays) ? `, ${formatDuration(tour, currentLang)}` : ''}</span>
                        </div>` : ''}
                    </div>
                </div>
                <p class="text-gray-600 mb-4 flex-grow" data-tour-description data-desc-ru="${escapeDataAttribute(getDescriptionByLanguageRaw(tour.description, 'ru'))}" data-desc-en="${escapeDataAttribute(getDescriptionByLanguageRaw(tour.description, 'en'))}">
                    ${getDescriptionByLanguage(tour.description, window.i18n ? window.i18n.currentLanguage() : 'ru')}
                </p>
                <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
                    <span data-translate="tour-location">📍 ${locationText}</span>
                    <span>⏱️ ${tour.duration}</span>
                    <span class="tour-rating-placeholder" data-tour-id="${tour.id}">
                        <span class="rating-stars text-yellow-500">☆☆☆☆☆</span> <span class="rating-value">--</span>
                    </span>
                </div>
                <div class="flex justify-between items-center mt-auto">
                    <span class="text-2xl font-bold tour-price" data-original-price="${tour.price}" style="color: black;">${formatPrice(tour.price, currentCurrency)}</span>
                    <button class="text-white px-4 py-2 rounded-md hover:opacity-90 transition-colors" style="background-color: #3E3E3E;" data-translate="btn.book">
                        ${getTranslation('btn.book')}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Функция для сброса поиска (убрана кнопка сброса из интерфейса)
function clearSearch() {
    document.getElementById('searchResults').classList.add('hidden');
    document.querySelector('section.bg-gray-50').style.display = 'block';
    
    // Сброс поискового запроса
    document.getElementById('searchInput').value = '';
    
    // Сброс всех фильтров
    const countryFilter = document.getElementById('countryFilter');
    const cityFilter = document.getElementById('cityFilter');
    const formatFilter = document.getElementById('formatFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const hotelFilter = document.getElementById('hotelFilter');
    const dateFilter = document.getElementById('dateFilter');
    
    if (countryFilter) countryFilter.value = '';
    if (cityFilter) cityFilter.value = '';
    if (formatFilter) formatFilter.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (hotelFilter) hotelFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    
    // Скрыть панель фильтров
    document.getElementById('filterPanel').classList.add('hidden');
    
    // Обновляем список городов и отелей
    updateCities();
    updateHotels();
}

// Функция для фильтрации по стране из карточек
function filterByCountry(country) {
    const themeFilter = document.getElementById('themeFilter');
    const countryFilter = document.getElementById('countryFilter');
    
    // Устанавливаем фильтр страны
    if (country === 'комбинированный') {
        // Для комбинированного тура ищем туры с несколькими странами или специальной тематикой
        if (themeFilter) themeFilter.value = 'Комбинированный тур по Центральной Азии';
        if (countryFilter) countryFilter.value = '';
    } else {
        if (countryFilter) countryFilter.value = country;
        if (themeFilter) themeFilter.value = '';
    }
    
    // Обновляем города и отели для выбранной страны
    updateCities();
    updateHotels();
    updateHotelFilters();
    
    // Выполняем поиск
    searchTours();
    
    // Прокручиваем к результатам
    setTimeout(() => {
        const searchResults = document.getElementById('searchResults');
        if (searchResults && !searchResults.classList.contains('hidden')) {
            searchResults.scrollIntoView({ behavior: 'smooth' });
        }
    }, 500);
}

// 💱 ФУНКЦИИ ВАЛЮТНОЙ СИСТЕМЫ

// Загрузка курсов валют из API
async function loadExchangeRates() {
    try {
        console.log('💱 Loading exchange rates...');
        const response = await fetch('/api/exchange-rates/map');
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                exchangeRates = result.data;
                window.exchangeRates = exchangeRates; // Экспорт для глобального использования
                console.log('💱 Exchange rates loaded:', exchangeRates);
                
                // Восстанавливаем сохраненную валюту
                const savedCurrency = localStorage.getItem('selectedCurrency') || 'TJS';
                if (exchangeRates[savedCurrency]) {
                    currentCurrency = savedCurrency;
                    // Guard: проверяем что функция существует перед вызовом
                    if (typeof updateCurrencySelector === 'function') {
                        updateCurrencySelector(savedCurrency);
                    }
                    // Применяем сохраненную валюту к ценам на странице
                    if (typeof window.updateCurrency === 'function') {
                        window.updateCurrency(savedCurrency);
                    }
                }
            } else {
                console.error('❌ Failed to load exchange rates:', result.message);
            }
        } else {
            console.error('❌ Exchange rates API request failed:', response.status);
        }
    } catch (error) {
        console.error('❌ Error loading exchange rates:', error);
        // Fallback курсы валют (формат: сколько TJS за 1 единицу валюты)
        exchangeRates = {
            'TJS': { rate: 1, symbol: 'TJS', name: 'Сомони' },
            'USD': { rate: 10.6, symbol: '$', name: 'Доллар США' },
            'EUR': { rate: 11.6, symbol: '€', name: 'Евро' },
            'RUB': { rate: 0.11, symbol: '₽', name: 'Российский рубль' },
            'CNY': { rate: 1.5, symbol: '¥', name: 'Китайский юань' }
        };
        window.exchangeRates = exchangeRates; // Экспорт fallback курсов
    }
}

// Форматирование цены с учетом валюты
function formatPrice(priceInTJS, currency) {
    if (!priceInTJS || !exchangeRates[currency]) {
        const fallbackSymbol = (exchangeRates && exchangeRates['TJS']) ? exchangeRates['TJS'].symbol : 'TJS';
        return `${Math.round(priceInTJS || 0)} ${fallbackSymbol}`;
    }
    
    const rate = exchangeRates[currency];
    
    if (currency === 'TJS') {
        return `${Math.round(priceInTJS)} ${rate.symbol}`;
    }
    
    // Конвертируем из TJS в выбранную валюту и округляем до целого числа
    // Формула: priceInTJS / rate.rate (где rate = сколько TJS за 1 единицу валюты)
    // Например: 100 TJS / 10.6 = 9.43 USD
    const convertedPrice = Math.round(priceInTJS / rate.rate);
    return `${convertedPrice} ${rate.symbol}`;
}

// Экспорт для глобального использования
window.formatPrice = formatPrice;

// Функция для обновления валюты (вызывается из layout-loader.js)
window.updateCurrency = function(currency) {
    console.log('💱 Updating currency to:', currency);
    
    // Если exchangeRates ещё не загружены, сохраняем валюту и выходим
    if (!exchangeRates || !exchangeRates[currency]) {
        currentCurrency = currency;
        localStorage.setItem('selectedCurrency', currency);
        console.log('💱 Currency saved, exchange rates will be applied when loaded');
        return;
    }
    
    currentCurrency = currency;
    localStorage.setItem('selectedCurrency', currency);
    
    const currentLang = getCurrentLanguage();
    const pricePrefix = currentLang === 'en' ? 'from' : 'от';
    
    // Обновляем все цены на странице (включая префикс "от"/"from")
    document.querySelectorAll('.tour-price').forEach(priceElement => {
        const originalPrice = priceElement.dataset.originalPrice;
        if (originalPrice) {
            // Просто заменяем весь HTML с правильным префиксом и ценой
            priceElement.innerHTML = `<span data-translate="price.from_prefix">${pricePrefix}</span> ${formatPrice(parseFloat(originalPrice), currency)}`;
        }
    });
    
    // Обновляем зачёркнутые цены (originalPrice) с префиксом
    document.querySelectorAll('.price-display').forEach(priceElement => {
        const originalPrice = priceElement.dataset.originalPrice;
        if (originalPrice) {
            // Просто заменяем весь HTML с правильным префиксом и ценой
            priceElement.innerHTML = `<span data-translate="price.from_prefix">${pricePrefix}</span> ${formatPrice(parseFloat(originalPrice), currency)}`;
        }
    });
    
    console.log('✅ Currency updated successfully');
};

// Обновление селектора валюты в интерфейсе
function updateCurrencySelector(currency) {
    const selectedCurrency = document.querySelector('.selected-currency');
    if (selectedCurrency && exchangeRates[currency]) {
        selectedCurrency.textContent = currency;
    }
    
    // Обновляем активный элемент в dropdown
    document.querySelectorAll('#currencyDropdown .lang-option').forEach(option => {
        option.classList.remove('active');
    });
    const activeOption = document.querySelector(`[data-currency="${currency}"]`);
    if (activeOption) {
        activeOption.classList.add('active');
    }
}

// Загрузка всех туров при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Страница загружена с тёмно-серым фильтром');
    
    // 💱 Инициализация валютной системы
    loadExchangeRates();
    
    // Инициализация Flatpickr календаря с локализацией
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter && typeof flatpickr !== 'undefined') {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Инициализация flatpickr
        const fp = flatpickr(dateFilter, {
            dateFormat: "d.m.Y",
            minDate: tomorrow,
            locale: getCurrentLanguage() === 'ru' ? flatpickr.l10ns.ru : flatpickr.l10ns.default,
            allowInput: false,
            disableMobile: true // Отключаем мобильный нативный календарь
        });
        
        // Сохраняем инстанс для обновления локали
        window.datePickerInstance = fp;
        
        console.log('📅 Flatpickr calendar initialized with locale:', getCurrentLanguage());
    }


    
    // Карта туров с их именами и ключами
    const tourMap = {
        'Полный день: Памирское шоссе, горы и озёра': 'pamir_highway',
        'Треккинг к озёрам семи цветов': 'pamir_highway',
        'Культурный тур по столице Таджикистана': 'pamir_highway',
        'Приключение в Бадахшане и горячие источники': 'pamir_highway',
        'Древний Самарканд и мавзолей Гур-Эмир': 'samarkand',
        'Священная Бухара: мечети и медресе': 'samarkand',
        'Хива: музей под открытым небом': 'samarkand',
        'Ташкент: современность и традиции': 'samarkand',
        'Иссык-Куль и ущелье Джеты-Огуз': 'issyk_kul',
        'Столица Киргизстана и Ала-Арча': 'issyk_kul',
        'Высокогорные пастбища и юрты': 'issyk_kul',
        'Озеро Сон-Куль и кочевые традиции': 'issyk_kul',
        'Врата ада: газовый кратер Дарваза': 'darvaza',
        'Мраморная столица пустыни Каракумы': 'darvaza',
        'Древний Мерв и археологические памятники': 'darvaza',
        'Конные прогулки по пустыне': 'darvaza'
    };

    // Находим все карточки туров
    const tourCards = document.querySelectorAll('.group.cursor-pointer');
    
    tourCards.forEach(card => {
        const titleElement = card.querySelector('h3');
        const button = card.querySelector('button[style*="background-color: #3E3E3E"]');
        
        if (titleElement && button) {
            const tourTitle = titleElement.textContent.trim();
            const tourKey = tourMap[tourTitle] || 'pamir_highway';
            
            // Добавляем клик на кнопку "Бронировать"
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                window.open(`tour-template.html?tour=${tourKey}`, '_blank');
            });
            
            // Добавляем клик на всю карточку
            card.addEventListener('click', function() {
                window.open(`tour-template.html?tour=${tourKey}`, '_blank');
            });
        }
    });
    
    // Закрытие выпадающего списка при клике вне его
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('langDropdown');
        const button = document.querySelector('.lang-selector-btn');
        if (!button.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.remove('show');
            document.querySelector('.dropdown-arrow').classList.remove('open');
        }
    });
});

// ✨ Функции слайдшоу изображений для карточек туров
const tourSlideshows = new Map(); // Хранит интервалы для каждого тура

function startImageSlideshow(tourId) {
    // Проверяем есть ли изображения для слайдшоу
    const images = document.querySelectorAll(`img[data-tour-id="${tourId}"]`);
    console.log(`🎬 Starting slideshow for tour ${tourId}: found ${images.length} images`);
    
    if (images.length <= 1) {
        return; // Если одно изображение или меньше - не запускаем слайдшоу
    }
    
    let currentIndex = 0;
    
    // Запускаем слайдшоу с интервалом 1.5 секунды
    const interval = setInterval(() => {
        // Скрываем текущее изображение
        images[currentIndex].style.opacity = '0';
        
        // Обновляем индикатор
        const currentDot = document.querySelector(`div[data-tour-id="${tourId}"][data-slide-index="${currentIndex}"]`);
        if (currentDot) {
            currentDot.style.opacity = '0.5';
        }
        
        // Переходим к следующему изображению
        currentIndex = (currentIndex + 1) % images.length;
        
        // Показываем следующее изображение
        images[currentIndex].style.opacity = '1';
        
        // Обновляем индикатор
        const nextDot = document.querySelector(`div[data-tour-id="${tourId}"][data-slide-index="${currentIndex}"]`);
        if (nextDot) {
            nextDot.style.opacity = '1';
        }
    }, 1500); // Меняем изображение каждые 1.5 секунды
    
    // Сохраняем интервал для остановки при убирании курсора
    tourSlideshows.set(tourId, { interval, currentIndex });
}

function stopImageSlideshow(tourId) {
    console.log(`🛑 Stopping slideshow for tour ${tourId}`);
    const slideshow = tourSlideshows.get(tourId);
    if (slideshow) {
        clearInterval(slideshow.interval);
        tourSlideshows.delete(tourId);
        
        // Возвращаем к первому изображению
        const images = document.querySelectorAll(`img[data-tour-id="${tourId}"]`);
        const dots = document.querySelectorAll(`div[data-tour-id="${tourId}"]`);
        
        images.forEach((img, index) => {
            img.style.opacity = index === 0 ? '1' : '0';
        });
        
        dots.forEach((dot, index) => {
            dot.style.opacity = index === 0 ? '1' : '0.5';
        });
    }
}

// === СИСТЕМА ПЕРЕКЛЮЧЕНИЯ ЯЗЫКОВ ===
// 
// 🌐 currentLanguage теперь управляется центральной системой i18n.js

// Функции для языкового селектора
function toggleLanguageDropdown() {
    if (window.i18n) {
        window.i18n.toggleLanguageDropdown();
    }
}

// 🌐 ИСПОЛЬЗУЕМ ЦЕНТРАЛЬНУЮ ФУНКЦИЮ ИЗ i18n.js + ДОБАВЛЯЕМ ДИНАМИЧЕСКИЙ КОНТЕНТ
function switchSiteLanguage(lang) {
    if (window.i18n) {
        window.i18n.switchSiteLanguage(lang);
        // 🔄 ОБЯЗАТЕЛЬНО ПЕРЕВОДИМ ДИНАМИЧЕСКИЙ КОНТЕНТ
        translateDynamicContent(lang);
    } else {
        console.error('❌ i18n.js не найден!');
    }
}

// 🌐 ИСПОЛЬЗУЕМ ЦЕНТРАЛЬНУЮ ФУНКЦИЮ updateLanguageSelector ИЗ i18n.js
function updateLanguageSelector(lang) {
    if (window.i18n) {
        window.i18n.updateLanguageSelector(lang);
    }
}

// 🌐 НЕ НУЖНА - ИСПОЛЬЗУЕТСЯ АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ ИЗ i18n.js

// === ЧАСТЬ 2: СЛОВАРЬ ПЕРЕВОДОВ СТАТИЧЕСКОГО ИНТЕРФЕЙСА ===

const translations = {
    // Главное меню
    'nav.home': { ru: 'Главная', en: 'Home' },
    'nav.tours': { ru: 'Туры', en: 'Tours' },
    'nav.hotels': { ru: 'Отели', en: 'Hotels' },
    'nav.visa_support': { ru: 'Визовая поддержка', en: 'Visa Support' },
    'nav.tour_agents': { ru: 'Турагентам', en: 'For Tour Agents' },
    'nav.about': { ru: 'О нас', en: 'About Us' },
    'nav.reviews': { ru: 'Отзывы', en: 'Reviews' },
    'nav.blog': { ru: 'Блог', en: 'Blog' },
    'nav.contacts': { ru: 'Контакты', en: 'Contacts' },
    
    // Кнопки и действия
    'btn.book_now': { ru: 'Забронировать', en: 'Book Now' },
    'btn.more_details': { ru: 'Подробнее', en: 'More Details' },
    'btn.view_all': { ru: 'Смотреть все', en: 'View All' },
    'btn.send': { ru: 'Отправить', en: 'Send' },
    'btn.search': { ru: 'Поиск', en: 'Search' },
    'btn.filter': { ru: 'Фильтр', en: 'Filter' },
    'btn.contact_us': { ru: 'Связаться с нами', en: 'Contact Us' },
    
    // Заголовки и подзаголовки
    'title.popular_tours': { ru: 'Популярные туры', en: 'Popular Tours' },
    'title.recommended_tours': { ru: 'Комбинированные туры по Центральной Азии', en: 'Combined Tours in Central Asia' },
    'title.tajikistan_tours': { ru: 'Туры по Таджикистану', en: 'Tajikistan Tours' },
    'title.uzbekistan_tours': { ru: 'Туры по Узбекистану', en: 'Uzbekistan Tours' },
    'title.kyrgyzstan_tours': { ru: 'Туры по Киргизстану', en: 'Kyrgyzstan Tours' },
    'title.turkmenistan_tours': { ru: 'Туры по Туркменистану', en: 'Turkmenistan Tours' },
    'title.tours_by_cities': { ru: 'Туры по городам', en: 'Tours by Cities' },
    'title.find_perfect_tour': { ru: 'Найдите идеальный тур', en: 'Find the Perfect Tour' },
    'title.free_cancellation': { ru: 'Бесплатная отмена', en: 'Free Cancellation' },
    'title.book_now_pay_later': { ru: 'Бронируй сейчас - плати потом', en: 'Book Now - Pay Later' },
    'title.hot_tours': { ru: 'Горящие туры', en: 'Hot Tours' },
    'title.promotions': { ru: 'Акции', en: 'Promotions' },
    'title.search_results': { ru: 'Результаты поиска', en: 'Search Results' },
    'title.our_services': { ru: 'Наши услуги', en: 'Our Services' },
    'title.why_choose_us': { ru: 'Почему выбирают нас', en: 'Why Choose Us' },
    
    // Ценовые обозначения
    'price.from': { ru: 'Цена от:', en: 'Price from:' },
    'price.per_person': { ru: 'за человека', en: 'per person' },
    'price.per_group': { ru: 'за группу', en: 'per group' },
    'price.days': { ru: 'дней', en: 'days' },
    'price.day': { ru: 'день', en: 'day' },
    
    // Формы и поля
    'form.name': { ru: 'Имя', en: 'Name' },
    'form.email': { ru: 'Email', en: 'Email' },
    'form.phone': { ru: 'Телефон', en: 'Phone' },
    'form.message': { ru: 'Сообщение', en: 'Message' },
    'form.check_in': { ru: 'Заезд', en: 'Check-in' },
    'form.check_out': { ru: 'Выезд', en: 'Check-out' },
    'form.guests': { ru: 'Гостей', en: 'Guests' },
    'form.select_country': { ru: 'Выберите страну', en: 'Select Country' },
    'form.select_city': { ru: 'Выберите город', en: 'Select City' },
    'form.select_type': { ru: 'Выберите тип', en: 'Select Type' },
    
    // Услуги
    'service.tours': { ru: 'Туры и экскурсии', en: 'Tours & Excursions' },
    'service.transfer': { ru: 'Трансфер', en: 'Transfer Service' },
    'service.guide': { ru: 'Гид-сопровождение', en: 'Guide Service' },
    'service.agency': { ru: 'Турагентство', en: 'Travel Agency' },
    
    // Подвал сайта
    'footer.contact_info': { ru: 'Контактная информация', en: 'Contact Information' },
    'footer.quick_links': { ru: 'Быстрые ссылки', en: 'Quick Links' },
    'footer.social_media': { ru: 'Социальные сети', en: 'Social Media' },
    'footer.copyright': { ru: '© 2024 Bunyod-Tour. Все права защищены.', en: '© 2024 Bunyod-Tour. All rights reserved.' },
    
    // Фильтры
    'filter.country': { ru: 'Страна', en: 'Country' },
    'filter.city': { ru: 'Город', en: 'City' },
    'filter.tour_type': { ru: 'Тип тура', en: 'Tour Type' },
    'filter.category': { ru: 'Категория', en: 'Category' },
    'filter.date': { ru: 'Дата', en: 'Date' },
    
    // Общие элементы
    'common.loading': { ru: 'Загрузка...', en: 'Loading...' },
    'common.no_results': { ru: 'Результаты не найдены', en: 'No results found' },
    'common.error': { ru: 'Произошла ошибка', en: 'An error occurred' },
    'common.success': { ru: 'Успешно!', en: 'Success!' },
    'common.show_all_tours': { ru: 'Показать все туры', en: 'Show All Tours' },
    'common.clear_search': { ru: 'Очистить поиск', en: 'Clear Search' },
    
    // Placeholders для форм и поиска
    'placeholder.search_tours': { ru: 'Поиск туров...', en: 'Search tours...' },
    'placeholder.select_date': { ru: 'Выберите дату', en: 'Select date' },
    'placeholder.enter_name': { ru: 'Введите ваше имя', en: 'Enter your name' },
    'placeholder.enter_email': { ru: 'Введите email', en: 'Enter email' },
    'placeholder.enter_phone': { ru: 'Введите телефон', en: 'Enter phone' },
    'placeholder.enter_message': { ru: 'Введите сообщение', en: 'Enter message' },
    
    // Title атрибуты (всплывающие подсказки)
    'title.language_switcher': { ru: 'Переключить язык', en: 'Switch language' },
    'title.currency_switcher': { ru: 'Переключить валюту', en: 'Switch currency' },
    'title.search_button': { ru: 'Начать поиск', en: 'Start search' },
    'title.filter_button': { ru: 'Применить фильтры', en: 'Apply filters' },
    'title.book_tour': { ru: 'Забронировать тур', en: 'Book tour' },
    'title.view_details': { ru: 'Посмотреть детали', en: 'View details' }
};

// Функция получения перевода
function getTranslation(key, lang = currentLanguage) {
    if (translations[key] && translations[key][lang]) {
        return translations[key][lang];
    }
    // Возвращаем русский как fallback
    if (translations[key] && translations[key]['ru']) {
        return translations[key]['ru'];
    }
    // Если перевода вообще нет, возвращаем ключ
    return key;
}

// === 🚀 УСИЛЕННАЯ ФУНКЦИЯ ПЕРЕВОДА СТАТИЧЕСКОГО ИНТЕРФЕЙСА ===

function translateStaticInterface(lang) {
    
    let translatedCount = 0;
    
    // 📝 ПЕРЕВОДИМ ОСНОВНОЙ ТЕКСТ (data-translate)
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            // Безопасное обновление текста
            if (element.children.length === 0) {
                element.textContent = translation;
            } else {
                updateTextNodes(element, translation);
            }
            translatedCount++;
        } else {
            console.warn(`⚠️ Перевод не найден для ключа: ${key}`);
        }
    });
    
    // 🔤 ПЕРЕВОДИМ PLACEHOLDERS (data-translate-placeholder)
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.getAttribute('data-translate-placeholder');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            element.placeholder = translation;
            translatedCount++;
        } else {
            console.warn(`⚠️ Placeholder перевод не найден для ключа: ${key}`);
        }
    });
    
    // 🖼️ ПЕРЕВОДИМ ALT АТРИБУТЫ (data-translate-alt)
    document.querySelectorAll('[data-translate-alt]').forEach(element => {
        const key = element.getAttribute('data-translate-alt');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            element.alt = translation;
            translatedCount++;
        }
    });
    
    // 💡 ПЕРЕВОДИМ TITLE АТРИБУТЫ (data-translate-title)
    document.querySelectorAll('[data-translate-title]').forEach(element => {
        const key = element.getAttribute('data-translate-title');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            element.title = translation;
            translatedCount++;
        }
    });
    
    // 📊 ПЕРЕВОДИМ VALUE АТРИБУТЫ (data-translate-value)
    document.querySelectorAll('[data-translate-value]').forEach(element => {
        const key = element.getAttribute('data-translate-value');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            element.value = translation;
            translatedCount++;
        }
    });
    
}

// Вспомогательная функция для обновления текстовых узлов
function updateTextNodes(element, newText) {
    for (let node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = newText;
            return; // Обновляем только первый найденный текстовый узел
        }
    }
    // Если текстовых узлов не найдено, создаем новый
    if (element.children.length === 0) {
        element.textContent = newText;
    }
}

// === ЧАСТЬ 3: ПЕРЕВОД ДИНАМИЧЕСКОГО КОНТЕНТА ИЗ JSON ПОЛЕЙ ===

function translateDynamicContent(lang) {
    console.log(`🔄 Переключение динамического контента на: ${lang}`);
    
    // Используем новые утилиты для многоязычности
    if (typeof window.translateAllDynamicContent === 'function') {
        window.translateAllDynamicContent(lang);
    } else {
        // Fallback для старой системы
        console.warn('Утилиты многоязычности не найдены, используем fallback');
        
        let updatedCount = 0;
        
        // Обновляем заголовки туров
        const tourTitles = document.querySelectorAll('[data-tour-title]');
        tourTitles.forEach(element => {
            const titleData = element.dataset.tourTitle;
            if (titleData && typeof safeJsonParse === 'function' && typeof getLocalizedText === 'function') {
                const parsed = safeJsonParse(titleData);
                const fallback = lang === 'en' ? 'Title not specified' : 'Название не указано';
                const text = getLocalizedText(parsed, lang) || fallback;
                element.textContent = text;
                updatedCount++;
            }
        });
        
        // Обновляем названия категорий
        const categoryNames = document.querySelectorAll('[data-category-name]');
        categoryNames.forEach(element => {
            const categoryData = element.dataset.categoryName;
            if (categoryData && typeof safeJsonParse === 'function' && typeof getLocalizedText === 'function') {
                const parsed = safeJsonParse(categoryData);
                const fallback = lang === 'en' ? 'Category' : 'Категория';
                const text = getLocalizedText(parsed, lang) || fallback;
                element.textContent = text;
                updatedCount++;
            }
        });
        
        // Обновляем tour types
        const tourTypes = document.querySelectorAll('.tour-type-text');
        tourTypes.forEach(element => {
            const tourType = element.dataset.tourType;
            if (tourType) {
                const translationKey = 'tour_type.' + tourType.toLowerCase().replace(/\s/g, '_');
                const translated = getTranslation(translationKey);
                if (translated) {
                    element.textContent = translated;
                    updatedCount++;
                }
            }
        });
        
        // Обновляем длительность туров (вместе с категорией)
        const tourDurations = document.querySelectorAll('.tour-duration');
        console.log(`🔍 translateAllDynamicContent: найдено ${tourDurations.length} элементов .tour-duration`);
        tourDurations.forEach((element, index) => {
            const duration = element.dataset.tourDuration;
            const durationDays = element.dataset.tourDurationDays;
            const durationType = element.dataset.tourDurationType;
            const categoryData = element.dataset.categoryName;
            
            console.log(`🔍 Element ${index}: duration="${duration}", durationDays="${durationDays}", durationType="${durationType}"`);
            console.log(`🔍 Element ${index}: categoryData="${categoryData}"`);
            
            if (categoryData) {
                const parsed = safeJsonParse(categoryData);
                const categoryText = getLocalizedText(parsed, lang) || (lang === 'en' ? 'Category' : 'Категория');
                console.log(`🔍 Element ${index}: categoryText="${categoryText}"`);
                
                if (duration || durationDays) {
                    const tourData = {
                        duration: duration,
                        durationDays: durationDays ? parseInt(durationDays) : null,
                        durationType: durationType || null
                    };
                    console.log(`🔍 Element ${index}: tourData=`, tourData);
                    const formatted = formatDuration(tourData, lang);
                    console.log(`🔍 Element ${index}: formatted="${formatted}"`);
                    const finalText = `${categoryText}, ${formatted}`;
                    console.log(`🔍 Element ${index}: SETTING textContent="${finalText}"`);
                    element.textContent = finalText;
                } else {
                    console.log(`🔍 Element ${index}: NO DURATION, только категория`);
                    element.textContent = categoryText;
                }
                updatedCount++;
            }
        });
        
        // Обновляем заголовки блоков туров
        const blockTitles = document.querySelectorAll('[data-tour-block-title]');
        blockTitles.forEach(element => {
            const titleData = element.dataset.tourBlockTitle;
            if (titleData && typeof safeJsonParse === 'function' && typeof getLocalizedText === 'function') {
                const parsed = safeJsonParse(titleData);
                const fallback = lang === 'en' ? 'Tour Block' : 'Блок туров';
                const text = getLocalizedText(parsed, lang) || fallback;
                element.textContent = text;
                updatedCount++;
            }
        });
        
        console.log(`✅ Обновлено ${updatedCount} элементов (fallback mode)`);
    }
}

// 🎯 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОЛУЧЕНИЯ КОНТЕНТА ПО ЯЗЫКУ

function getTitleByLanguage(titleObject, lang) {
    const fallback = lang === 'en' ? 'Title not specified' : 'Название не указано';
    // Используем стандартизованный подход с safeJsonParse → getLocalizedText
    if (typeof safeJsonParse === 'function' && typeof getLocalizedText === 'function') {
        const parsed = safeJsonParse(titleObject);
        return getLocalizedText(parsed, lang) || fallback;
    }
    // Fallback для обратной совместимости
    try {
        const title = typeof titleObject === 'string' ? JSON.parse(titleObject) : titleObject;
        return title[lang] || title.ru || title.en || fallback;
    } catch (e) {
        return titleObject || fallback;
    }
}

function getDescriptionByLanguage(descriptionObject, lang) {
    const fallback = lang === 'en' ? 'Description not specified' : 'Описание не указано';
    // Используем стандартизованный подход с safeJsonParse → getLocalizedText
    if (typeof safeJsonParse === 'function' && typeof getLocalizedText === 'function') {
        const parsed = safeJsonParse(descriptionObject);
        return getLocalizedText(parsed, lang) || fallback;
    }
    // Fallback для обратной совместимости
    try {
        const description = typeof descriptionObject === 'string' ? JSON.parse(descriptionObject) : descriptionObject;
        return description[lang] || description.ru || description.en || fallback;
    } catch (e) {
        return descriptionObject || fallback;
    }
}

function getCategoryNameByLanguage(categoryObject, lang) {
    const fallback = lang === 'en' ? 'Category' : 'Категория';
    // Используем стандартизованный подход с safeJsonParse → getLocalizedText
    if (typeof safeJsonParse === 'function' && typeof getLocalizedText === 'function') {
        const parsed = safeJsonParse(categoryObject);
        return getLocalizedText(parsed, lang) || fallback;
    }
    // Fallback для обратной совместимости
    try {
        const category = typeof categoryObject === 'string' ? JSON.parse(categoryObject) : categoryObject;
        return category[lang] || category.ru || category.en || fallback;
    } catch (e) {
        return categoryObject || fallback;
    }
}

function selectLanguageNew(lang, flagClass, flagEmoji, name) {
    
    // ПРИНУДИТЕЛЬНАЯ КАРТА ЭМОДЗИ (на случай если параметр испорчен)
    const emojiMap = {
        'ru': '🇷🇺', 'flag-ru': '🇷🇺',
        'en': '🇺🇸', 'flag-us': '🇺🇸', 'us': '🇺🇸',
        'fa': '🇮🇷', 'flag-ir': '🇮🇷', 'ir': '🇮🇷',
        'de': '🇩🇪', 'flag-de': '🇩🇪',
        'zh': '🇨🇳', 'flag-cn': '🇨🇳', 'cn': '🇨🇳'
    };
    
    // ГАРАНТИРОВАННЫЙ эмодзи (приоритет: карта по lang -> карта по flagClass -> flagEmoji -> fallback)
    const correctEmoji = emojiMap[lang] || emojiMap[flagClass] || flagEmoji || '🌐';
    
    // Обновляем кнопку селектора - только название языка (флаги в выпадающем меню)
    const selectedLang = document.querySelector('.selected-lang');
    if (selectedLang) {
        selectedLang.textContent = name;
    }
    
    // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Принудительно исправляем ВСЕ флаги в выпадающем меню
    document.querySelectorAll('#langDropdown .flag').forEach(flag => {
        for (const [key, emoji] of Object.entries(emojiMap)) {
            if (flag.classList.contains(key) || flag.classList.contains(`flag-${key.replace('flag-', '')}`)) {
                if (flag.textContent !== emoji) {
                    flag.textContent = emoji;
                    flag.innerHTML = emoji;
                }
                break;
            }
        }
    });
    
    // Убираем активный класс со всех опций
    document.querySelectorAll('#langDropdown .lang-option').forEach(opt => opt.classList.remove('active'));
    
    // Добавляем активный класс к выбранной опции (с проверкой существования)
    const selectedOption = document.querySelector(`[data-lang="${lang}"]`);
    if (selectedOption) {
        selectedOption.classList.add('active');
    }
    
    // Закрываем выпадающий список (с проверкой существования)
    const dropdown = document.getElementById('langDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    
    // Вызываем функцию переключения языка
    if (typeof switchSiteLanguage === 'function') {
        switchSiteLanguage(lang);
    }
    
}

// Старая функция для обратной совместимости
function selectLanguage(lang, flagClass, name) {
    const flagEmojis = {
        'flag-ru': '🇷🇺',
        'flag-us': '🇺🇸', 
        'flag-tj': '🇹🇯',
        'flag-ir': '🇮🇷',
        'flag-de': '🇩🇪',
        'flag-cn': '🇨🇳'
    };
    selectLanguageNew(lang, flagClass, flagEmojis[flagClass] || '🏳️', name);
}


// Отель availability checker
function checkHotelAvailability() {
    const modal = document.getElementById('hotelAvailabilityModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeHotelModal() {
    const modal = document.getElementById('hotelAvailabilityModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function performHotelSearch() {
    const checkIn = document.getElementById('checkInDate').value;
    const checkOut = document.getElementById('checkOutDate').value;
    const guests = document.getElementById('guestCount').value;
    
    if (!checkIn || !checkOut) {
        alert('Пожалуйста, выберите даты заезда и выезда');
        return;
    }
    
    // Симуляция поиска отелей
    alert(`Поиск отелей:\nЗаезд: ${checkIn}\nВыезд: ${checkOut}\nГостей: ${guests}\n\nФункция будет доступна в ближайшее время.`);
}

// ✅ АРХИТЕКТУРНАЯ ЧИСТОТА: Карта инициализируется footer'ом, не home-page.js!

// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// Tour loading functions
async function loadTourBlocks() {
    try {
        const response = await fetch(`${API_BASE_URL}/tour-blocks`);
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            // Сортируем блоки по sortOrder для правильного порядка отображения
            const sortedBlocks = result.data.sort((a, b) => a.sortOrder - b.sortOrder);
            
            for (const block of sortedBlocks) {
                await loadToursForBlock(block);
            }
            
            // ⭐ Загружаем рейтинги туров после отображения карточек
            setTimeout(() => loadTourRatings(), 200);
        } else {
            // Fallback: показываем сообщение когда нет tour blocks
            console.log('⚠️ No tour blocks found, showing fallback message');
            showEmptyTourBlocksMessage();
        }
    } catch (error) {
        console.error('Error loading tour blocks:', error);
        // Показываем fallback сообщение при ошибке
        showEmptyTourBlocksMessage();
    }
}

// 🚨 ДОБАВЛЕНО: Показ сообщения когда нет tour blocks
function showEmptyTourBlocksMessage() {
    const tourBlocksContainer = document.getElementById('tour-blocks-container');
    if (tourBlocksContainer) {
        tourBlocksContainer.innerHTML = `
            <div class="max-w-4xl mx-auto px-6 py-16 text-center">
                <div class="bg-gray-50 rounded-lg p-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        🏗️ Настраиваем туры для вас
                    </h2>
                    <p class="text-gray-600 mb-6">
                        Мы работаем над добавлением лучших туров по Центральной Азии. 
                        Скоро здесь появятся невероятные путешествия!
                    </p>
                    <p class="text-sm text-gray-500">
                        Администратор может добавить туры через админ-панель.
                    </p>
                </div>
            </div>
        `;
    }
}

async function loadToursForBlock(block) {
    try {
        const response = await fetch(`${API_BASE_URL}/tour-blocks/${block.id}/tours`);
        const result = await response.json();
        
        console.log(`Loading tours for block ${block.id}:`, result);
        
        if (result.success && result.data.length > 0) {
            renderTourBlock(block, result.data);
        } else {
            console.log(`No tours found for block ${block.id}`);
        }
    } catch (error) {
        console.error(`Error loading tours for block ${block.id}:`, error);
    }
}

function renderTourBlock(block, tours) {
    // Получаем текущий язык
    const currentLang = getCurrentLanguage();
    
    // Безопасная обработка названия блока с поддержкой многоязычности
    let blockTitleData, blockTitleText;
    try {
        if (typeof block.title === 'string') {
            blockTitleData = JSON.parse(block.title);
        } else {
            blockTitleData = block.title || {};
        }
        blockTitleText = getLocalizedText(blockTitleData, currentLang) || 'Блок туров';
    } catch (e) {
        // Маппинг slug → translation key для tour blocks
        const slugToKey = {
            'popular-tours': 'title.popular_tours',
            'recommended-central-asia': 'title.recommended_tours',
            'tajikistan-tours': 'title.tajikistan_tours',
            'uzbekistan-tours': 'title.uzbekistan_tours',
            'kyrgyzstan-tours': 'title.kyrgyzstan_tours',
            'exclusive-tours': 'title.exclusive_tours'
        };
        
        const translationKey = slugToKey[block.slug];
        if (translationKey && typeof getTranslation === 'function') {
            blockTitleText = getTranslation(translationKey);
            blockTitleData = { ru: block.title, en: getTranslation(translationKey, 'en') };
        } else {
            blockTitleData = { ru: block.title || 'Блок туров', en: 'Tour Block' };
            blockTitleText = block.title || 'Блок туров';
        }
    }
    
    const blockId = `tour-block-${block.id}`;
    const carouselId = `carousel-${block.id}`;
    
    // Найдем контейнер для динамических блоков туров
    const tourBlocksContainer = document.getElementById('tour-blocks-container');
    
    if (!tourBlocksContainer) {
        console.error('Tour blocks container not found');
        return;
    }
    
    // Найдем существующую секцию или создадим новую
    let existingSection = document.getElementById(blockId);
    
    if (!existingSection) {
        // Создаем новую секцию в контейнере
        existingSection = document.createElement('section');
        existingSection.id = blockId;
        existingSection.className = 'py-16 bg-white';
        
        // Добавляем блоки в порядке поступления (уже отсортированы в loadTourBlocks)
        // Просто добавляем в конец контейнера
        
        // Добавляем блок в конец (блоки уже приходят в правильном порядке)
        tourBlocksContainer.appendChild(existingSection);
    }
    
    if (existingSection) {
        // Создаем data-атрибут для перевода заголовка
        const blockTitleJson = JSON.stringify(blockTitleData).replace(/"/g, '&quot;');
        
        existingSection.innerHTML = `
            <div class="max-w-7xl mx-auto px-6">
                <h2 class="text-3xl font-bold text-center mb-12 text-gray-900" data-tour-block-title="${blockTitleJson}">
                    ${blockTitleText}
                </h2>
                
                <div class="tour-block-container">
                    <button class="carousel-button prev" onclick="scrollCarousel('${carouselId}', -1)" id="prev-${carouselId}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                        </svg>
                    </button>
                    
                    <div class="tour-carousel" id="${carouselId}" onscroll="updateCarouselButtons('${carouselId}')">
                        ${tours.map(tour => renderTourCard(tour, block.id)).join('')}
                    </div>
                    
                    <button class="carousel-button next" onclick="scrollCarousel('${carouselId}', 1)" id="next-${carouselId}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        // Initialize carousel buttons state  
        setTimeout(() => {
            updateCarouselButtons(carouselId);
            toggleCarouselButtons(carouselId, tours.length);
        }, 100);
        
        // 🌐 Переводим все динамические элементы после рендера туров
        if (typeof translateAllDynamicContent === 'function') {
            const currentLang = getCurrentLanguage();
            translateAllDynamicContent(currentLang);
            console.log(`🌐 Переведены элементы блока ${block.id} на язык: ${currentLang}`);
        }
        
        // 💱 Применяем сохранённую валюту к новым карточкам туров
        const savedCurrency = localStorage.getItem('selectedCurrency') || currentCurrency || 'TJS';
        if (savedCurrency && exchangeRates && exchangeRates[savedCurrency]) {
            // Применяем валюту только к карточкам этого блока
            const blockElement = document.getElementById(`tour-block-${block.id}`);
            if (blockElement) {
                const currentLang = getCurrentLanguage();
                const pricePrefix = currentLang === 'en' ? 'from' : 'от';
                
                blockElement.querySelectorAll('.tour-price').forEach(priceElement => {
                    const originalPrice = priceElement.dataset.originalPrice;
                    if (originalPrice) {
                        // Просто заменяем весь HTML с правильным префиксом и ценой
                        priceElement.innerHTML = `<span data-translate="price.from_prefix">${pricePrefix}</span> ${formatPrice(parseFloat(originalPrice), savedCurrency)}`;
                    }
                });
                
                // Применяем к зачёркнутым ценам
                blockElement.querySelectorAll('.price-display').forEach(priceElement => {
                    const originalPrice = priceElement.dataset.originalPrice;
                    if (originalPrice) {
                        // Просто заменяем весь HTML с правильным префиксом и ценой
                        priceElement.innerHTML = `<span data-translate="price.from_prefix">${pricePrefix}</span> ${formatPrice(parseFloat(originalPrice), savedCurrency)}`;
                    }
                });
            }
            console.log(`💱 Применена валюта ${savedCurrency} к блоку ${block.id}`);
        }
    }
}

// Функция для получения отображаемого местоположения (только страны)
function getDisplayLocation(tour) {
    const currentLang = getCurrentLanguage();
    const langField = currentLang === 'en' ? 'nameEn' : 'nameRu';
    
    let countries = [];
    
    // Получаем страны из tourCountries
    if (tour.tourCountries && tour.tourCountries.length > 0) {
        countries = tour.tourCountries.map(tc => tc.country?.[langField] || tc.country?.nameRu || tc.country?.name || '').filter(Boolean);
    } else if (tour.country) {
        const countryName = typeof tour.country === 'object' ? (tour.country[langField] || tour.country.nameRu || tour.country.name) : tour.country;
        if (countryName) countries = [countryName];
    }
    
    // Показываем все страны без ограничения
    if (countries.length > 0) {
        return countries.join(', ');
    }
    
    return currentLang === 'en' ? 'Location not specified' : 'Местоположение не указано';
}

// Функция для получения иконки типа тура
function getTourTypeIcon(tourType) {
    const type = (tourType || '').toLowerCase();
    
    // Персональный - один человечек
    if (type.includes('персональн') || type.includes('personal')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
        </svg>`;
    }
    
    // Групповой - несколько человечков
    return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
    </svg>`;
}

// Функция для получения иконки категории
function getCategoryIcon(categoryName) {
    const name = (categoryName || '').toLowerCase();
    
    // Городской
    if (name.includes('городск') || name.includes('city') || name.includes('urban')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clip-rule="evenodd"/>
        </svg>`;
    }
    
    // Природа/экологический
    if (name.includes('природ') || name.includes('эколог') || name.includes('nature') || name.includes('eco')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.5 2a3.5 3.5 0 101.665 6.58L8.585 10l-1.42 1.42a3.5 3.5 0 101.414 1.414l8.128-8.127a1 1 0 00-1.414-1.414L7.165 11.42A3.5 3.5 0 105.5 2z" clip-rule="evenodd"/>
        </svg>`;
    }
    
    // Культурно познавательный, Исторический
    if (name.includes('культур') || name.includes('историч') || name.includes('cultural') || name.includes('historical')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
        </svg>`;
    }
    
    // Походы/треккинги
    if (name.includes('поход') || name.includes('треккинг') || name.includes('hiking') || name.includes('trekking')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
        </svg>`;
    }
    
    // Горные/Озерные ландшафты
    if (name.includes('горн') || name.includes('озер') || name.includes('mountain') || name.includes('lake')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.606 12.97a.75.75 0 01-.134 1.051 2.494 2.494 0 00-.93 2.437 2.494 2.494 0 002.437-.93.75.75 0 111.186.918 3.995 3.995 0 01-4.482 1.332.75.75 0 01-.461-.461 3.994 3.994 0 011.332-4.482.75.75 0 011.052.134z" clip-rule="evenodd"/>
            <path fill-rule="evenodd" d="M5.752 12A13.07 13.07 0 008 14.248v4.002c0 .414.336.75.75.75a5 5 0 004.797-6.414 12.984 12.984 0 005.45-10.848.75.75 0 00-.735-.735 12.984 12.984 0 00-10.849 5.45A5 5 0 001 11.25c.001.414.337.75.751.75h4.002zM13 9a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
        </svg>`;
    }
    
    // Приключенческий
    if (name.includes('приключ') || name.includes('adventure')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>
        </svg>`;
    }
    
    // Гастрономический
    if (name.includes('гастроном') || name.includes('food') || name.includes('gastro')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
        </svg>`;
    }
    
    // Авто/сафари/джип
    if (name.includes('авто') || name.includes('сафари') || name.includes('джип') || name.includes('safari') || name.includes('jeep')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-2h3v2a1 1 0 001 1h.05a2.5 2.5 0 014.9 0H17a1 1 0 001-1V5a1 1 0 00-1-1H3zM15 7h2v2h-2V7zM5 7h2v2H5V7z"/>
        </svg>`;
    }
    
    // Агротуризм - растение/росток
    if (name.includes('агро') || name.includes('agro') || name.includes('farm')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M19 11a7.5 7.5 0 01-7.5 7.5c-1.04 0-2.026-.209-2.926-.584A8.972 8.972 0 0110 18c0-4.97-4.03-9-9-9A8.973 8.973 0 011.584 6.926 7.496 7.496 0 019.5 3.5 7.5 7.5 0 0119 11z"/>
        </svg>`;
    }
    
    // Экскурсия
    if (name.includes('экскурс') || name.includes('excursion') || name.includes('tour')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
        </svg>`;
    }
    
    // Однодневный/Многодневный - календарь
    if (name.includes('дневн') || name.includes('day')) {
        return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
        </svg>`;
    }
    
    // По умолчанию - тег
    return `<svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
    </svg>`;
}

// Функция для локализации длительности тура
function formatDuration(tour, lang) {
    // Проверяем durationType - если это "hours", форматируем как часы
    if (tour.durationType === 'hours' && tour.duration) {
        const durationValue = typeof tour.duration === 'string' ? tour.duration.trim() : String(tour.duration);
        const match = durationValue.match(/(\d+)/);
        if (match) {
            const hours = parseInt(match[1]);
            const result = lang === 'en'
                ? (hours === 1 ? `${hours} hour` : `${hours} hours`)
                : (hours % 10 === 1 && hours % 100 !== 11) ? `${hours} час`
                : (hours % 10 >= 2 && hours % 10 <= 4 && (hours % 100 < 10 || hours % 100 >= 20)) ? `${hours} часа`
                : `${hours} часов`;
            return result;
        }
    }
    
    // Если есть durationDays, используем его
    if (tour.durationDays && typeof tour.durationDays === 'number') {
        const days = tour.durationDays;
        const result = lang === 'en' 
            ? (days === 1 ? `${days} day` : `${days} days`)
            : (days % 10 === 1 && days % 100 !== 11) ? `${days} день`
            : (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) ? `${days} дня`
            : `${days} дней`;
        return result;
    }
    
    // Если duration - это строка, проверяем её содержимое
    if (tour.duration) {
        const durationStr = String(tour.duration).trim().toLowerCase();
        
        // Проверка: это часы? (ищем 'час', 'hour' или строку заканчивающуюся на 'h')
        const hasHourKeyword = durationStr.includes('час') || durationStr.includes('hour');
        const endsWithH = /\d+\s*h$/i.test(durationStr); // Ловит "4h", "4 h", "4H", "24h" и т.д.
        
        if (hasHourKeyword || endsWithH) {
            // Извлекаем число
            const match = durationStr.match(/(\d+)/);
            if (match) {
                const hours = parseInt(match[1]);
                const result = lang === 'en'
                    ? (hours === 1 ? `${hours} hour` : `${hours} hours`)
                    : (hours % 10 === 1 && hours % 100 !== 11) ? `${hours} час`
                    : (hours % 10 >= 2 && hours % 10 <= 4 && (hours % 100 < 10 || hours % 100 >= 20)) ? `${hours} часа`
                    : `${hours} часов`;
                return result;
            }
            // Если не удалось извлечь число, вернуть как есть
            return tour.duration;
        }
        
        // Проверка: это просто число без единиц измерения (считаем днями)
        if (/^\d+$/.test(durationStr)) {
            const num = parseInt(durationStr);
            const result = lang === 'en'
                ? (num === 1 ? `${num} day` : `${num} days`)
                : (num % 10 === 1 && num % 100 !== 11) ? `${num} день`
                : (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20)) ? `${num} дня`
                : `${num} дней`;
            return result;
        }
        
        // Если уже есть единицы измерения или неизвестный формат, возвращаем как есть
        return tour.duration;
    }
    
    return '';
}

// Экспортируем formatDuration глобально для использования в multilingual-utils.js
window.formatDuration = formatDuration;

function renderTourCard(tour, blockId = null) {
    // Получаем текущий язык
    const currentLang = getCurrentLanguage();
    
    // Парсим JSON поля для корректного отображения и сохраняем в data-атрибутах
    const titleFallback = currentLang === 'en' ? 'Title not specified' : 'Название не указано';
    const descFallback = currentLang === 'en' ? 'Description not specified' : 'Описание не указано';
    const categoryFallback = currentLang === 'en' ? 'Category' : 'Категория';
    
    let titleData, titleText;
    try {
        titleData = typeof tour.title === 'string' ? JSON.parse(tour.title) : tour.title;
        titleText = getLocalizedText(titleData, currentLang) || titleFallback;
    } catch (e) {
        titleData = { ru: tour.title || titleFallback, en: tour.title || titleFallback };
        titleText = tour.title || titleFallback;
    }
    
    let descriptionData, descriptionText;
    try {
        descriptionData = typeof tour.description === 'string' ? JSON.parse(tour.description) : tour.description;
        descriptionText = getLocalizedText(descriptionData, currentLang) || descFallback;
    } catch (e) {
        descriptionData = { ru: tour.description || descFallback, en: tour.description || descFallback };
        descriptionText = tour.description || descFallback;
    }
    
    // Обрабатываем категории (поддержка множественных категорий)
    let categoryData, categoryText, allCategories = [];
    
    // Проверяем множественные категории через tourCategoryAssignments
    if (tour.tourCategoryAssignments && tour.tourCategoryAssignments.length > 0) {
        // Собираем все категории
        allCategories = tour.tourCategoryAssignments.map(tca => {
            const cat = tca.category;
            let catName;
            try {
                const nameData = typeof cat.name === 'string' ? JSON.parse(cat.name) : cat.name;
                catName = getLocalizedText(nameData, currentLang) || categoryFallback;
            } catch (e) {
                catName = cat.name || categoryFallback;
            }
            return catName;
        });
        
        // Для отображения берем первую категорию
        categoryText = allCategories[0];
        categoryData = { ru: categoryText, en: categoryText };
    } else if (tour.category && tour.category.name) {
        // Fallback на старую одиночную категорию
        try {
            categoryData = typeof tour.category.name === 'string' ? JSON.parse(tour.category.name) : tour.category.name;
            categoryText = getLocalizedText(categoryData, currentLang) || categoryFallback;
        } catch (e) {
            categoryData = { ru: tour.category.name || categoryFallback, en: tour.category.name || categoryFallback };
            categoryText = tour.category.name || categoryFallback;
        }
        allCategories = [categoryText];
    } else {
        categoryData = { ru: categoryFallback, en: categoryFallback };
        categoryText = categoryFallback;
        allCategories = [categoryText];
    }
    
    const shortDesc = tour.shortDesc || null;
    
    // Генерируем массив изображений для слайдшоу из реальных данных тура
    const tourImages = [];
    
    // Парсим строку с изображениями из базы данных
    if (tour.images) {
        try {
            const imageArray = typeof tour.images === 'string' ? JSON.parse(tour.images) : tour.images;
            if (Array.isArray(imageArray) && imageArray.length > 0) {
                tourImages.push(...imageArray);
            }
        } catch (e) {
            console.warn('Failed to parse tour images:', e);
        }
    }
    
    // Если нет изображений, используем placeholder
    if (tourImages.length === 0) {
        tourImages.push('/placeholder-tour.jpg'); // Placeholder если нет изображений
    }
    
    // 🔧 ИСПРАВЛЕНИЕ: Создаем уникальные ID для каждого экземпляра карточки
    const uniqueCardId = blockId ? `${tour.id}-block-${blockId}` : `${tour.id}`;
    
    // 🔥 Скидка из нового поля discountPercent
    const discountPercent = tour.discountPercent || 0;
    const isPromotion = tour.isPromotion || false;
    
    return `
        <div class="tour-card group cursor-pointer bg-white rounded-lg shadow-md hover:shadow-lg transition-all flex flex-col h-full"
             onclick="window.location.href='tour-template.html?tour=${tour.id || 1}'"
             onmouseenter="startImageSlideshow('${uniqueCardId}')"
             onmouseleave="stopImageSlideshow('${uniqueCardId}')"
             data-tour-id="${tour.id}"
             data-unique-card-id="${uniqueCardId}">
            <div class="relative overflow-hidden rounded-t-lg">
                ${isPromotion && discountPercent > 0 ? `
                <div class="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10 shadow-md">
                    -${Math.round(discountPercent)}%
                </div>
                ` : ''}
                <div class="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center" id="tour-image-container-${uniqueCardId}">
                    ${tourImages.length > 0 ? 
                        tourImages.map((imgSrc, index) => `
                            <img src="${imgSrc}" 
                                 alt="${titleText}" 
                                 class="tour-slide-image w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${index === 0 ? 'opacity-100' : 'opacity-0'}" 
                                 data-slide-index="${index}"
                                 data-tour-id="${uniqueCardId}"
                                 onerror="this.style.display='none';">
                        `).join('') :
                        `<div class="text-center p-4">
                            <svg class="w-12 h-12 mx-auto text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 616 0z"/>
                            </svg>
                            <div class="text-sm font-medium text-blue-600" data-tour-title="${JSON.stringify(titleData).replace(/"/g, '&quot;')}">${titleText}</div>
                        </div>`
                    }
                </div>
                ${tourImages.length > 1 ? `
                <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                    ${tourImages.map((_, index) => `
                        <div class="w-2 h-2 rounded-full bg-white opacity-50 tour-slide-dot" 
                             data-tour-id="${uniqueCardId}" 
                             data-slide-index="${index}"
                             ${index === 0 ? 'style="opacity: 1;"' : ''}></div>
                    `).join('')}
                </div>` : ''}
            </div>
            <div class="p-4 flex flex-col flex-grow">
                <!-- Мета-блок: локация, тип, категория - фиксированная высота -->
                <div class="h-16 mb-2">
                    <!-- Локация -->
                    <div class="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <svg class="inline w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                        </svg>
                        <span class="truncate">${getDisplayLocation(tour)}</span>
                    </div>
                    <!-- Тип тура -->
                    <div class="text-xs text-blue-600 mb-1 flex items-center gap-1">
                        ${getTourTypeIcon(tour.format || tour.tourType)}
                        <span class="font-medium tour-type-text" data-tour-type="${tour.format || tour.tourType || 'Групповой'}" data-translate="tour_type.${(tour.format || tour.tourType || 'Групповой').toLowerCase().replace(/\s+/g, '_')}">${(() => {
                            const tourType = tour.format || tour.tourType || 'Групповой';
                            const normalizedType = tourType.toLowerCase().replace(/\s+/g, '_');
                            const translationKey = 'tour_type.' + normalizedType;
                            const translated = getTranslation(translationKey);
                            return translated !== translationKey ? translated : tourType;
                        })()}</span>${(() => {
                            const tourType = (tour.format || tour.tourType || '').toLowerCase();
                            const isIndividual = tourType.includes('персональный') && !tourType.includes('групповой');
                            return !isIndividual && tour.maxPeople ? ` <span class="text-gray-600" data-max-people="${tour.maxPeople}">(${currentLang === 'en' ? `up to ${tour.maxPeople} people` : `до ${tour.maxPeople} чел.`})</span>` : '';
                        })()}
                    </div>
                    <!-- Категория тура и длительность -->
                    <div class="text-xs flex items-center gap-1" style="color: #3E3E3E;">
                        ${getCategoryIcon(categoryText)}
                        <span class="font-medium tour-duration truncate" data-category-name="${JSON.stringify(categoryData).replace(/"/g, '&quot;')}" data-tour-duration="${tour.duration || ''}" data-tour-duration-days="${tour.durationDays || ''}" data-tour-duration-type="${tour.durationType || ''}">${(() => {
                            let result = categoryText;
                            const hasDuration = tour.duration || tour.durationDays;
                            
                            if (hasDuration) {
                                const formatted = formatDuration(tour, currentLang);
                                result = categoryText + ', ' + formatted;
                            }
                            
                            return result;
                        })()}</span>
                        ${allCategories.length > 1 ? `
                        <span class="relative group cursor-help ml-0.5 flex-shrink-0">
                            <span class="text-gray-600 font-semibold hover:text-gray-800 transition-colors">...</span>
                            <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10 shadow-lg">
                                ${allCategories.map((cat, idx) => `<div class="py-0.5">${idx + 1}. ${cat}</div>`).join('')}
                                <div class="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                            </div>
                        </span>
                        ` : ''}
                    </div>
                </div>
                <!-- Заголовок - фиксированная высота 2 строки -->
                <h3 class="text-sm sm:text-base font-semibold text-gray-900 mb-2 group-hover:text-blue-600 leading-snug line-clamp-2 min-h-[2.75rem]" data-tour-title="${JSON.stringify(titleData).replace(/"/g, '&quot;')}">
                    ${titleText}
                </h3>
                <!-- Описание - минимальная высота 2 строки -->
                <p class="text-xs text-gray-600 mb-2 line-clamp-2 leading-relaxed min-h-[2.5rem]" data-tour-description="${JSON.stringify(descriptionData).replace(/"/g, '&quot;')}">${descriptionText}</p>
                <!-- Рейтинг тура -->
                <div class="text-xs text-gray-500 mb-2 tour-rating-placeholder" data-tour-id="${tour.id}">
                    <span class="rating-stars text-yellow-500">☆☆☆☆☆</span> <span class="rating-value">--</span>
                </div>
                <!-- Цена и кнопка -->
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between mt-auto gap-2 sm:gap-3">
                    <div class="flex-1 flex flex-col justify-center">
                        ${(() => {
                            // 🔥 Если есть скидка, вычисляем и показываем оригинальную цену
                            if (isPromotion && discountPercent > 0) {
                                const numericPrice = parseFloat(tour.price) || 0;
                                if (numericPrice > 0) {
                                    const originalPrice = numericPrice / (1 - discountPercent / 100);
                                    return `<div class="text-xs line-through text-gray-400 mb-0.5 price-display" data-original-price="${Math.round(originalPrice)}"><span data-translate="price.from_prefix">${currentLang === 'en' ? 'from' : 'от'}</span> ${formatPrice(Math.round(originalPrice), 'TJS')}</div>`;
                                }
                            } else if (tour.originalPrice) {
                                return `<div class="text-xs line-through text-gray-400 mb-0.5 price-display" data-original-price="${tour.originalPrice}"><span data-translate="price.from_prefix">${currentLang === 'en' ? 'from' : 'от'}</span> ${formatPrice(tour.originalPrice, 'TJS')}</div>`;
                            }
                            return '';
                        })()}
                        <div class="text-base font-bold ${isPromotion && discountPercent > 0 ? 'text-red-600' : 'text-gray-900'} tour-price price-display leading-tight" data-original-price="${tour.price}">
                            <span data-translate="price.from_prefix">${currentLang === 'en' ? 'from' : 'от'}</span> ${formatPrice(tour.price, 'TJS')}
                        </div>
                        <div class="converted-price text-xs text-gray-600 mt-0.5" style="display: none;"></div>
                        <div class="text-xs text-gray-500 mt-0.5">${(() => {
                            const priceType = tour.priceType || '';
                            // Обработка enum значений
                            if (priceType === 'per_person' || priceType === 'за человека') {
                                return currentLang === 'en' ? 'per person' : 'за человека';
                            } else if (priceType === 'per_group' || priceType === 'за группу') {
                                return currentLang === 'en' ? 'per group' : 'за группу';
                            }
                            // Fallback на дефолтное значение
                            return priceType || (currentLang === 'en' ? 'per person' : 'за человека');
                        })()}</div>
                    </div>
                    <button class="hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap w-full sm:w-auto sm:flex-shrink-0 sm:self-center" 
                            style="background-color: #6B7280;"
                            onclick="event.stopPropagation(); window.location.href='tour-template.html?tour=${tour.id}'"
                            data-translate="btn.book">
                        ${currentLang === 'en' ? 'Book' : 'Бронировать'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Carousel Navigation Functions
function scrollCarousel(carouselId, direction) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    const cardWidth = 280 + 24; // card width + gap
    const scrollAmount = cardWidth * 3; // scroll 3 cards at a time
    
    carousel.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
}

function toggleCarouselButtons(carouselId, totalTours) {
    const prevBtn = document.getElementById(`prev-${carouselId}`);
    const nextBtn = document.getElementById(`next-${carouselId}`);
    
    if (!prevBtn || !nextBtn) return;
    
    // Show buttons only if there are more than 4 tours
    const showButtons = totalTours > 4;
    prevBtn.style.display = showButtons ? 'flex' : 'none';
    nextBtn.style.display = showButtons ? 'flex' : 'none';
}

function updateCarouselButtons(carouselId) {
    const carousel = document.getElementById(carouselId);
    const prevBtn = document.getElementById(`prev-${carouselId}`);
    const nextBtn = document.getElementById(`next-${carouselId}`);
    
    if (!carousel || !prevBtn || !nextBtn) return;
    
    const scrollLeft = carousel.scrollLeft;
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    
    // Update previous button
    if (scrollLeft <= 10) {
        prevBtn.disabled = true;
        prevBtn.style.opacity = '0.5';
    } else {
        prevBtn.disabled = false;
        prevBtn.style.opacity = '1';
    }
    
    // Update next button
    if (scrollLeft >= maxScroll - 10) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
    } else {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
    }
}

// Hero Slider Functions
let currentSlideIndex = 0;
let slides = [];
let slideInterval;

async function loadSlides() {
    try {
        const url = `${window.location.origin}/api/slides`;
        console.log('🎬 Loading slides from:', url);
        
        const response = await fetch(url);
        console.log('📡 Slides response status:', response.status);
        
        const data = await response.json();
        console.log('📊 Slides data:', data);
        
        if (data.success && data.data && data.data.length > 0) {
            slides = data.data;
            console.log('✅ Loaded', slides.length, 'slides');
            renderSlides();
            initializeSlider();
        } else {
            console.log('⚠️ No slides found, showing default content');
            showDefaultSlide();
        }
    } catch (error) {
        console.error('❌ Error loading slides:', error);
        showDefaultSlide();
    }
}

function showDefaultSlide() {
    const container = document.getElementById('slidesContainer');
    if (!container) return;
    
    const currentLang = getCurrentLanguage();
    const title = currentLang === 'en' ? 'Welcome to Central Asia' : 'Добро пожаловать в Центральную Азию';
    const description = currentLang === 'en' 
        ? 'Discover amazing landscapes and rich culture of the region' 
        : 'Откройте для себя удивительные пейзажи и богатую культуру региона';
    
    container.innerHTML = `
        <div class="hero-slide active" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div class="gradient-overlay absolute inset-0"></div>
            <div class="relative z-10 text-center max-w-4xl mx-auto px-6 flex items-center justify-center h-full">
                <div>
                    <h1 class="text-6xl font-bold mb-6 text-white">${title}</h1>
                    <p class="text-xl mb-8 max-w-2xl mx-auto text-white">${description}</p>
                    <a href="/tours" class="inline-block bg-white text-gray-800 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                        ${currentLang === 'en' ? 'Explore Tours' : 'Посмотреть туры'}
                    </a>
                </div>
            </div>
        </div>
    `;
}

function renderSlides() {
    const container = document.getElementById('slidesContainer');
    const navigation = document.getElementById('sliderNavigation');
    
    if (!container || !navigation) {
        console.warn('⚠️ Slider elements not found:', { container: !!container, navigation: !!navigation });
        return;
    }

    // Очищаем контейнер (удаляем плейсхолдер)
    container.innerHTML = '';
    
    // Получаем текущий язык из localStorage
    const currentLang = getCurrentLanguage();
    
    // Создаем слайды
    const slidesHTML = slides.map((slide, index) => {
        // Данные уже десериализованы из API, не нужен JSON.parse
        const title = slide.title || {};
        const description = slide.description || {};
        const buttonText = slide.buttonText || null;
        const imageUrl = slide.image ? getAbsoluteImageUrl(slide.image) : '';
        
        // Используем текущий язык, fallback на другой язык или дефолтный текст
        const titleText = title[currentLang] || title.ru || title.en || (currentLang === 'en' ? 'Discover Tajikistan' : 'Откройте красоту Таджикистана');
        const descText = description[currentLang] || description.ru || description.en || (currentLang === 'en' ? 'Explore the stunning Pamir Mountains, ancient Silk Road cities and rich culture of this amazing country' : 'Исследуйте захватывающие горы Памира, древние города Шёлкового пути и богатую культуру этой удивительной страны');
        const btnText = buttonText ? (buttonText[currentLang] || buttonText.ru || buttonText.en || (currentLang === 'en' ? 'Learn more' : 'Узнать больше')) : null;
        
        return `
            <div class="hero-slide ${index === 0 ? 'active' : ''}" data-slide="${index}"
                 style="background-image: url('${imageUrl}'); ${!imageUrl ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);' : ''}">
                <div class="gradient-overlay absolute inset-0"></div>
                <div class="relative z-10 text-center max-w-4xl mx-auto px-6 flex items-center justify-center h-full">
                    <div>
                        <h1 class="text-6xl font-bold mb-6 text-white">
                            ${titleText}
                        </h1>
                        <p class="text-xl mb-8 max-w-2xl mx-auto text-white">
                            ${descText}
                        </p>
                        ${slide.link && btnText ? `
                            <a href="${slide.link}" class="inline-block bg-white text-gray-800 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                                ${btnText}
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Вставляем слайды
    container.innerHTML = slidesHTML;

    // Создаем точки навигации
    navigation.innerHTML = slides.map((_, index) => 
        `<div class="slider-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide(${index})"></div>`
    ).join('');

    // Показываем кнопки навигации если больше одного слайда
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    if (slides.length > 1) {
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'block';
    }
}

function initializeSlider() {
    if (slides.length <= 1) return;

    // Автопрокрутка слайдов
    slideInterval = setInterval(() => {
        nextSlide();
    }, 5000);

    // Обработчики кнопок
    document.getElementById('prevSlide').onclick = prevSlide;
    document.getElementById('nextSlide').onclick = nextSlide;
}

function goToSlide(index) {
    if (index === currentSlideIndex) return;

    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.slider-dot');

    // Скрываем текущий слайд
    slides[currentSlideIndex].classList.remove('active');
    dots[currentSlideIndex].classList.remove('active');

    // Показываем новый слайд
    currentSlideIndex = index;
    slides[currentSlideIndex].classList.add('active');
    dots[currentSlideIndex].classList.add('active');

    // Перезапускаем автопрокрутку
    clearInterval(slideInterval);
    if (slides.length > 1) {
        slideInterval = setInterval(() => {
            nextSlide();
        }, 5000);
    }
}

function nextSlide() {
    const nextIndex = (currentSlideIndex + 1) % slides.length;
    goToSlide(nextIndex);
}

function prevSlide() {
    const prevIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
    goToSlide(prevIndex);
}

// ⭐ Загрузка рейтингов туров для карточек
async function loadTourRatings() {
    const placeholders = document.querySelectorAll('.tour-rating-placeholder');
    if (placeholders.length === 0) return;
    
    console.log(`⭐ Loading ratings for ${placeholders.length} tour cards...`);
    
    // Собираем уникальные tourId
    const tourIds = new Set();
    placeholders.forEach(el => {
        const tourId = el.dataset.tourId;
        if (tourId) tourIds.add(tourId);
    });
    
    // Загружаем рейтинги для каждого тура
    for (const tourId of tourIds) {
        try {
            const response = await fetch(`/api/reviews/tours/${tourId}/stats`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const { averageRating, totalReviews } = result.data;
                
                // Обновляем все плейсхолдеры с этим tourId
                document.querySelectorAll(`.tour-rating-placeholder[data-tour-id="${tourId}"]`).forEach(el => {
                    const ratingValue = el.querySelector('.rating-value');
                    const starsContainer = el.querySelector('.rating-stars');
                    if (ratingValue) {
                        if (totalReviews > 0) {
                            ratingValue.textContent = `${averageRating.toFixed(1)} (${totalReviews})`;
                            // Update stars display - round to nearest whole number
                            if (starsContainer) {
                                const roundedRating = Math.round(averageRating);
                                starsContainer.innerHTML = '★'.repeat(roundedRating) + '☆'.repeat(5 - roundedRating);
                            }
                        } else {
                            ratingValue.textContent = '--';
                        }
                    }
                });
            }
        } catch (error) {
            console.error(`Failed to load rating for tour ${tourId}:`, error);
        }
    }
    
    console.log('⭐ Tour ratings loaded');
}

// Экспортируем функцию
window.loadTourRatings = loadTourRatings;

// Загружаем туры и слайды при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing...');
    
    // 🌐 ИНИЦИАЛИЗИРУЕМ ЯЗЫКОВУЮ СИСТЕМУ (ЦЕНТРАЛЬНАЯ i18n.js)
    if (window.i18n) {
        window.i18n.initializeLanguage();
        // 🔄 ПОСЛЕ ЗАГРУЗКИ ТУРОВ ПРИМЕНЯЕМ ДИНАМИЧЕСКИЕ ПЕРЕВОДЫ
        setTimeout(() => {
            const currentLang = window.i18n.currentLanguage();
            translateDynamicContent(currentLang);
            console.log(`🔄 Динамический контент инициализирован для языка: ${currentLang}`);
        }, 100); // Небольшая задержка для загрузки туров
    } else {
        console.warn('⚠️ i18n.js не загружен, используем fallback инициализацию');
    }
    
    // Сначала загружаем страны и города для фильтров
    await loadCountriesAndCities();
    populateCountryFilter(); // Заполняем фильтр стран
    updateCities(); // Заполняем фильтр городов
    
    // 🏷️ ДОБАВЛЕНО: Загружаем категории для фильтра
    await loadCategories();
    
    // 💱 Обновляем цены на статичных карточках туров после загрузки данных
    setTimeout(() => {
        updateStaticTourPrices();
    }, 1000); // Даем время на загрузку курсов валют
    
    loadTourBlocks();
    loadSlides();
    // initializeCurrency(); // УДАЛЕНО - используется новая система валют
    
    // КРИТИЧНО: Принудительно восстанавливаем эмодзи флаги
    forceEmojiFlags();
    
    // Инициализируем все обработчики событий
    initializeEventHandlers();
    
    // Повторно восстанавливаем флаги через небольшую задержку (на случай если CSS загружается позже)
    setTimeout(forceEmojiFlags, 1000);
    setTimeout(forceEmojiFlags, 3000);
    
    // 🌐 СЛУШАЕМ СОБЫТИЯ ПЕРЕКЛЮЧЕНИЯ ЯЗЫКА
    document.addEventListener('languageChanged', async function(event) {
        console.log(`🔄 Главная страница: язык изменен на ${event.detail.language}`);
        translateDynamicContent(event.detail.language);
        
        // Обновляем текст макс. туристов
        updateMaxPeopleText(event.detail.language);
        
        // Обновляем фильтры (страны, города, категории) без полной перезагрузки данных
        await loadCountriesAndCities(); // Обновляем кеш стран/городов
        populateCountryFilter(); // Обновляем DOM фильтра стран
        updateCities(); // Обновляем DOM фильтра городов
        await loadCategories(); // Обновляем фильтр категорий
        
        // ❌ УДАЛЕНО: loadTourBlocks() - карточки туров переводятся через translateDynamicContent()
        // ❌ УДАЛЕНО: loadSlides() - слайды переводятся через translateDynamicContent()
        
        // Обновляем локаль календаря
        if (window.datePickerInstance && typeof flatpickr !== 'undefined') {
            const newLocale = event.detail.language === 'ru' ? flatpickr.l10ns.ru : flatpickr.l10ns.default;
            window.datePickerInstance.set('locale', newLocale);
            console.log('📅 Calendar locale updated to:', event.detail.language);
        }
        
        // Восстанавливаем флаги после обновления
        forceEmojiFlags();
    });
});

function formatImageUrl(imageUrl) {
    if (!imageUrl) return '';
    
    if (imageUrl.startsWith('/objects/')) {
        // Object storage path - construct full URL
        return `${window.location.origin}${imageUrl}`;
    } else if (imageUrl.startsWith('http')) {
        // Full URL - use as is
        return imageUrl;
    } else {
        // Relative path - make it absolute
        return `${window.location.origin}/${imageUrl}`;
    }
}


// 💱 Обновление цен на статичных карточках туров
function updateStaticTourPrices() {
    console.log('💱 Updating static tour card prices...');
    
    // Находим все элементы с ценами на статичных карточках туров
    const staticPriceElements = document.querySelectorAll('.text-2xl.font-bold');
    
    staticPriceElements.forEach(priceElement => {
        const priceText = priceElement.textContent;
        
        // Извлекаем числовую цену из текста (поддерживаем различные форматы)
        const priceMatch = priceText.match(/(\d+)/);
        if (priceMatch) {
            const originalPrice = parseInt(priceMatch[1]);
            
            // Добавляем атрибуты для обновления валюты
            priceElement.classList.add('tour-price');
            priceElement.dataset.originalPrice = originalPrice.toString();
            
            // Форматируем цену с текущей валютой
            priceElement.textContent = `от ${formatPrice(originalPrice, currentCurrency)}`;
            
            console.log(`💱 Updated price: ${originalPrice} TJS → ${formatPrice(originalPrice, currentCurrency)}`);
        }
    });
}

// Функции переключения валют
function toggleCurrencyDropdown() {
    const dropdown = document.getElementById('currencyDropdown');
    dropdown.classList.toggle('show');
    
    // Закрываем языковой dropdown если открыт
    const langDropdown = document.getElementById('langDropdown');
    if (langDropdown.classList.contains('show')) {
        langDropdown.classList.remove('show');
    }
}

function selectCurrency(currency, symbol) {
    // Используем новую валютную систему
    if (window.updateCurrency) {
        window.updateCurrency(currency);
    }
    
    // Скрываем dropdown
    document.getElementById('currencyDropdown').classList.remove('show');
}

// 💱 СТАРЫЕ ДУБЛИРОВАННЫЕ ФУНКЦИИ ВАЛЮТНОЙ СИСТЕМЫ УДАЛЕНЫ

// JavaScript BACKUP: Принудительное восстановление эмодзи флагов
function forceEmojiFlags() {
    const flagMappings = {
        'flag-ru': '🇷🇺',
        'flag-us': '🇺🇸', 
        'flag-tj': '🇹🇯',
        'flag-ir': '🇮🇷',
        'flag-de': '🇩🇪',
        'flag-cn': '🇨🇳'
    };
    
    // Восстанавливаем эмодзи в ВСЕХ флагах
    document.querySelectorAll('.flag, .selected-flag').forEach(flag => {
        for (const [className, emoji] of Object.entries(flagMappings)) {
            if (flag.classList.contains(className)) {
                // Принудительно заменяем содержимое на эмодзи
                flag.textContent = emoji;
                flag.innerHTML = emoji;
                break;
            }
        }
    });
}

// 💱 СТАРАЯ ФУНКЦИЯ initializeCurrency УДАЛЕНА - ИСПОЛЬЗУЕТСЯ НОВАЯ СИСТЕМА


// Закрытие dropdown при клике вне их
document.addEventListener('click', function(event) {
    const langDropdown = document.getElementById('languageDropdown');
    const currencyDropdown = document.getElementById('currencyDropdown');
    
    // Закрываем языковой dropdown
    if (langDropdown && !event.target.closest('.language-dropdown')) {
        langDropdown.classList.remove('show');
    }
    
    // Закрываем валютный dropdown
    if (currencyDropdown && !event.target.closest('.language-dropdown')) {
        currencyDropdown.classList.remove('show');
    }
});

// Функция инициализации всех обработчиков событий
function initializeEventHandlers() {
    console.log('Initializing event handlers...');
    
    // Обработчики для валютного селектора  
    const currencyButton = document.querySelector('button[onclick="toggleCurrencyDropdown()"]');
    if (currencyButton) {
        // Убираем onclick атрибут и добавляем event listener
        currencyButton.removeAttribute('onclick');
        currencyButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Currency button clicked');
            toggleCurrencyDropdown();
        });
        console.log('Currency button handler added');
    }
    
    // Обработчики для опций валют
    document.querySelectorAll('#currencyDropdown .lang-option').forEach(option => {
        option.removeAttribute('onclick');
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const currency = this.getAttribute('data-currency');
            console.log('Currency selected:', currency);
            selectCurrency(currency, currency);
        });
    });
    
    // Обработчики для языкового селектора
    const langButton = document.querySelector('button[onclick="toggleLanguageDropdown()"]');
    if (langButton) {
        langButton.removeAttribute('onclick');
        langButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Language button clicked');
            toggleLanguageDropdown();
        });
    }
    
    // Обработчики для опций языков
    document.querySelectorAll('#langDropdown .lang-option, #mobileLangDropdown .lang-option').forEach(option => {
        option.removeAttribute('onclick');
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const lang = this.getAttribute('data-lang');
            console.log('Language selected:', lang);
            updatePageLanguage(lang);
        });
    });
    
    // Поиск туров
    const searchButton = document.querySelector('button[onclick="searchTours()"]');
    if (searchButton) {
        searchButton.removeAttribute('onclick');
        searchButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Search button clicked');
            searchTours();
        });
    }
    
    // Кнопка "Больше с Bunyod-Tour"
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('CTA button clicked');
            // Прокрутка к турам
            document.querySelector('#main-content')?.scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    console.log('All event handlers initialized');
}

// Загрузка фото городов из ОТДЕЛЬНОГО API city-card-photos
async function loadCityPhotosFromSlides() {
    try {
        const response = await fetch('/api/city-card-photos');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                const photos = result.data;
                console.log('🖼️ Загружены фото городов:', photos);
                
                // Применяем фото к карточкам городов
                photos.forEach(photo => {
                    if (photo.imageUrl && photo.cityId) {
                        // Находим ВСЕ карточки городов (с onclick содержащим cityId)
                        const cityCards = document.querySelectorAll('[onclick*="cityId="]');
                        console.log(`🔍 Найдено ${cityCards.length} карточек городов на странице`);
                        
                        cityCards.forEach(card => {
                            const onclick = card.getAttribute('onclick');
                            if (onclick && onclick.includes(`cityId=${photo.cityId}`)) {
                                // Устанавливаем фото на РОДИТЕЛЬСКИЙ div (карточку)
                                card.style.backgroundImage = `url(${photo.imageUrl})`;
                                card.style.backgroundSize = 'cover';
                                card.style.backgroundPosition = 'center';
                                
                                // Скрываем серый фоновый div (теперь фото на карточке будет видно)
                                const bgDiv = card.querySelector('.bg-gray-200');
                                if (bgDiv) {
                                    bgDiv.style.display = 'none';
                                }
                                
                                console.log(`✅ Фото установлено для города ID ${photo.cityId} (${photo.city?.nameRu || ''}): ${photo.imageUrl}`);
                            }
                        });
                    }
                });
                
                console.log('✅ City photos loaded from city-card-photos API:', photos.length);
            }
        }
    } catch (error) {
        console.error('❌ Error loading city photos:', error);
    }
}

// Вызываем загрузку фото городов при загрузке страницы
document.addEventListener('DOMContentLoaded', loadCityPhotosFromSlides);

// ==================== REVIEWS SECTION ====================

/**
 * Загружает отзывы для отображения на главной странице
 */
async function loadHomepageReviews() {
    try {
        const lang = getCurrentLanguage();
        const response = await fetch(`/api/reviews/homepage?lang=${lang}`);
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            displayReviews(data.data);
            document.getElementById('reviewsSection').style.display = 'block';
            document.getElementById('noReviews').style.display = 'none';
        } else {
            document.getElementById('reviewsSection').style.display = 'none';
            document.getElementById('noReviews').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading homepage reviews:', error);
        document.getElementById('reviewsSection').style.display = 'none';
    }
}

/**
 * Отображает отзывы в сетке
 * @param {Array} reviews - Массив отзывов
 */
function displayReviews(reviews) {
    const grid = document.getElementById('reviewsGrid');
    const currentLang = getCurrentLanguage();
    const locale = currentLang === 'en' ? 'en-US' : 'ru-RU';
    
    grid.innerHTML = reviews.map(review => {
        const tourTitle = review.tour?.title || '';
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const date = new Date(review.createdAt).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        return `
            <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300" 
                 style="backdrop-filter: blur(10px); background: rgba(255, 255, 255, 0.95);">
                <div class="flex items-start mb-4">
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-900 mb-1">${review.reviewerName || 'Аноним'}</h4>
                        <p class="text-sm text-gray-600">${tourTitle}</p>
                    </div>
                    <div class="text-yellow-500 text-lg">${stars}</div>
                </div>
                
                ${review.text ? `<p class="text-gray-700 mb-4 line-clamp-4">${review.text}</p>` : ''}
                
                ${review.photos && review.photos.length > 0 ? `
                    <div class="flex gap-2 mb-4 overflow-x-auto">
                        ${review.photos.slice(0, 3).map(photo => `
                            <img src="${photo}" alt="Фото отзыва" 
                                 class="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                 onclick="window.open('${photo}', '_blank')">
                        `).join('')}
                        ${review.photos.length > 3 ? `<span class="text-sm text-gray-500 self-center">+${review.photos.length - 3}</span>` : ''}
                    </div>
                ` : ''}
                
                <p class="text-xs text-gray-500">${date}</p>
            </div>
        `;
    }).join('');
}

// Загружаем отзывы при загрузке страницы
document.addEventListener('DOMContentLoaded', loadHomepageReviews);
