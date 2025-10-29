// ============================================
// SEARCH PAGE - DYNAMIC FILTERS & MULTILINGUAL
// ============================================

console.log('✅ Search page script loaded');

// ============= GLOBAL STATE =============
const state = {
    allTours: [],
    allHotels: [],
    filteredResults: [],
    currentTab: 'tours',
    currentLang: 'ru', // Будет обновлено при инициализации из localStorage
    
    // Dynamic filter data
    tourBlocks: [],
    categories: [],
    countries: [],
    cities: [],
    tourTypes: new Set(),
    languages: new Set(),
    hotelStars: new Set(),
    amenities: new Set(),
    
    // Filter state
    filters: {
        query: '',
        country: '',
        city: '',
        date: '', // Дата тура в формате DD.MM.YYYY
        countries: [],
        cities: [],
        categories: [],
        tourBlocks: [],
        tourTypes: [],
        priceMin: 0,
        priceMax: 100000,
        languages: [],
        stars: [],
        amenities: []
    },
    
    // Accordion state
    openFilters: new Set(['categories', 'price'])  // Open by default
};

// ============= PRICE FORMATTING =============
function formatPrice(priceInTJS, currency = 'TJS') {
    const exchangeRates = window.exchangeRates || {
        'TJS': { rate: 1, symbol: 'TJS', name: 'Сомони' },
        'USD': { rate: 0.094, symbol: '$', name: 'Доллар США' },
        'EUR': { rate: 0.086, symbol: '€', name: 'Евро' },
        'RUB': { rate: 9.2, symbol: '₽', name: 'Российский рубль' },
        'CNY': { rate: 0.65, symbol: '¥', name: 'Китайский юань' }
    };
    
    if (!priceInTJS || !exchangeRates[currency]) {
        console.warn('❌ Currency not found:', currency);
        const fallbackSymbol = (exchangeRates && exchangeRates['TJS']) ? exchangeRates['TJS'].symbol : 'TJS';
        return `${Math.round(priceInTJS || 0)} ${fallbackSymbol}`;
    }
    
    const rate = exchangeRates[currency];
    
    if (currency === 'TJS') {
        // Для TJS показываем ТОЛЬКО символ, без текста валюты
        return `${Math.round(priceInTJS)} ${rate.symbol}`;
    }
    
    // ИСПРАВЛЕНО: Умножаем вместо деления! 1 TJS = 0.086 EUR, значит 100 TJS = 100 * 0.086 = 8.6 EUR
    const convertedPrice = Math.round(priceInTJS * rate.rate);
    return `${convertedPrice} ${rate.symbol}`;
}

// ============= DATA LOADING =============
async function loadAllData() {
    console.log('🔍 Initializing search page...');
    
    const lang = state.currentLang;
    
    try {
        // Load all data in parallel
        const [toursRes, hotelsRes, blocksRes, categoriesRes, countriesRes, citiesRes] = await Promise.all([
            fetch(`/api/tours/search?lang=${lang}`),
            fetch(`/api/hotels?lang=${lang}`),
            fetch(`/api/tour-blocks?lang=${lang}`),
            fetch(`/api/categories?type=tour&lang=${lang}`),
            fetch(`/api/countries`),
            fetch(`/api/cities`)
        ]);
        
        const [toursData, hotelsData, blocksData, categoriesData, countriesData, citiesData] = await Promise.all([
            toursRes.json(),
            hotelsRes.json(),
            blocksRes.json(),
            categoriesRes.json(),
            countriesRes.json(),
            citiesRes.json()
        ]);
        
        if (toursData.success) {
            state.allTours = toursData.data;
            console.log(`✅ Loaded ${state.allTours.length} tours`);
            extractTourFilterData();
        }
        
        if (hotelsData.success) {
            state.allHotels = hotelsData.data;
            console.log(`✅ Loaded ${state.allHotels.length} hotels`);
            extractHotelFilterData();
        }
        
        if (blocksData.success) {
            state.tourBlocks = blocksData.data;
            console.log(`✅ Loaded ${state.tourBlocks.length} tour blocks`);
        }
        
        if (categoriesData.success) {
            state.categories = categoriesData.data;
            console.log(`✅ Loaded ${state.categories.length} categories`);
        }
        
        if (countriesData.success) {
            state.countries = countriesData.data;
            console.log(`✅ Loaded ${state.countries.length} countries`);
        }
        
        if (citiesData.success) {
            state.cities = citiesData.data;
            console.log(`✅ Loaded ${state.cities.length} cities`);
        }
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
    }
}

// Extract unique filter values from tours
function extractTourFilterData() {
    state.tourTypes.clear();
    state.languages.clear();
    
    state.allTours.forEach(tour => {
        // Extract tour types (from tourType or format field)
        const tourType = tour.tourType || tour.format;
        if (tourType) {
            state.tourTypes.add(tourType);
        }
        
        // Extract languages
        if (tour.languages) {
            try {
                const langs = typeof tour.languages === 'string' ? JSON.parse(tour.languages) : tour.languages;
                if (Array.isArray(langs)) {
                    langs.forEach(lang => state.languages.add(lang));
                }
            } catch (e) {}
        }
    });
    
    console.log('📊 Extracted filter data:', {
        tourTypes: Array.from(state.tourTypes),
        languages: Array.from(state.languages)
    });
}

// Extract unique filter values from hotels
function extractHotelFilterData() {
    state.hotelStars.clear();
    state.amenities.clear();
    
    state.allHotels.forEach(hotel => {
        // Extract stars
        if (hotel.stars) {
            state.hotelStars.add(hotel.stars);
        }
        
        // Extract amenities
        if (hotel.amenities) {
            try {
                const amens = typeof hotel.amenities === 'string' ? JSON.parse(hotel.amenities) : hotel.amenities;
                if (Array.isArray(amens)) {
                    amens.forEach(amen => state.amenities.add(amen));
                }
            } catch (e) {}
        }
    });
    
    console.log('📊 Extracted hotel filter data:', {
        stars: Array.from(state.hotelStars).sort(),
        amenities: Array.from(state.amenities)
    });
}

// ============= FILTER RENDERING =============
function renderFilters() {
    renderCountriesFilter();
    renderCitiesFilter();
    renderCategoryFilters();
    renderTourBlocksFilter();
    renderCountryFilter();
    renderCityFilter();
    
    if (state.currentTab === 'tours') {
        renderTourFilters();
    } else {
        renderHotelFilters();
    }
}

function renderCountriesFilter() {
    const container = document.getElementById('countries-checkboxes');
    if (!container) return;
    
    const currentLang = state.currentLang;
    
    container.innerHTML = state.countries.map(country => {
        const countryName = currentLang === 'ru' ? country.nameRu : country.nameEn;
        const isChecked = state.filters.countries?.includes(country.id) || false;
        
        return `
            <label class="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
                <input type="checkbox" 
                       value="${country.id}" 
                       data-country-id="${country.id}"
                       ${isChecked ? 'checked' : ''}
                       onchange="handleCountryFilterChange(this)"
                       class="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500">
                <span>${escapeHtml(countryName)}</span>
            </label>
        `;
    }).join('');
    
    console.log('🌍 Countries filter updated with', state.countries.length, 'countries');
}

function renderCitiesFilter() {
    const container = document.getElementById('cities-checkboxes');
    if (!container) return;
    
    const currentLang = state.currentLang;
    
    // Filter cities by selected countries (if any)
    const citiesToShow = state.filters.countries?.length > 0
        ? state.cities.filter(city => state.filters.countries.includes(city.countryId))
        : state.cities;
    
    if (citiesToShow.length === 0) {
        const emptyText = currentLang === 'en' ? 'Select a country first' : 'Сначала выберите страну';
        container.innerHTML = `<div class="text-sm text-gray-500 py-2">${emptyText}</div>`;
        return;
    }
    
    container.innerHTML = citiesToShow.map(city => {
        const cityName = currentLang === 'ru' ? city.nameRu : city.nameEn;
        const isChecked = state.filters.cities?.includes(city.id) || false;
        
        return `
            <label class="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
                <input type="checkbox" 
                       value="${city.id}" 
                       data-city-id="${city.id}"
                       ${isChecked ? 'checked' : ''}
                       onchange="handleCityFilterChange(this)"
                       class="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500">
                <span>${escapeHtml(cityName)}</span>
            </label>
        `;
    }).join('');
    
    console.log('🏙️ Cities filter updated with', citiesToShow.length, 'cities');
}

function renderCategoryFilters() {
    const container = document.getElementById('category-checkboxes');
    if (!container) return;
    
    container.innerHTML = state.categories.map(cat => `
        <label class="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
            <input type="checkbox" 
                   value="${cat.id}" 
                   ${state.filters.categories.includes(cat.id) ? 'checked' : ''}
                   onchange="handleCategoryChange(this)"
                   class="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500">
            <span data-category-label data-cat-id="${cat.id}" data-cat-name="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</span>
        </label>
    `).join('');
    
    console.log('🏷️ Category filter updated with', state.categories.length, 'categories');
}

function renderTourBlocksFilter() {
    const container = document.getElementById('tourblocks-checkboxes');
    if (!container) return;
    
    const currentLang = state.currentLang;
    
    container.innerHTML = state.tourBlocks.map(block => {
        // Parse title field (can be JSON string or object)
        let blockName = '';
        if (block.title) {
            if (typeof block.title === 'string') {
                try {
                    const titleObj = JSON.parse(block.title);
                    blockName = currentLang === 'en' ? titleObj.en : titleObj.ru;
                } catch (e) {
                    blockName = block.title;
                }
            } else if (typeof block.title === 'object') {
                blockName = currentLang === 'en' ? block.title.en : block.title.ru;
            }
        }
        
        // Fallback to legacy fields if title not found
        if (!blockName) {
            blockName = currentLang === 'ru' ? block.nameRu : block.nameEn;
        }
        
        return `
        <label class="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
            <input type="checkbox" 
                   value="${block.id}" 
                   ${state.filters.tourBlocks.includes(block.id) ? 'checked' : ''}
                   onchange="handleTourBlockChange(this)"
                   class="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500">
            <span>${escapeHtml(blockName || 'Unknown')}</span>
        </label>
        `;
    }).join('');
    
    console.log('📍 Tour blocks filter updated with', state.tourBlocks.length, 'blocks');
}

function renderCountryFilter() {
    const select = document.getElementById('search-country');
    if (!select) return;
    
    const currentLang = state.currentLang;
    const defaultOption = currentLang === 'ru' ? 'Все страны' : 'All countries';
    
    select.innerHTML = `<option value="">${defaultOption}</option>` +
        state.countries.map(country => {
            const name = currentLang === 'ru' ? country.nameRu : country.nameEn;
            return `<option value="${country.id}">${escapeHtml(name)}</option>`;
        }).join('');
        
    select.value = state.filters.country;
}

function renderCityFilter() {
    const select = document.getElementById('search-city');
    if (!select) return;
    
    const currentLang = state.currentLang;
    const defaultOption = currentLang === 'ru' ? 'Все города' : 'All cities';
    
    // Filter cities by selected country
    const citiesToShow = state.filters.country 
        ? state.cities.filter(city => city.countryId == state.filters.country)
        : state.cities;
    
    select.innerHTML = `<option value="">${defaultOption}</option>` +
        citiesToShow.map(city => {
            const name = currentLang === 'ru' ? city.nameRu : city.nameEn;
            return `<option value="${city.id}">${escapeHtml(name)}</option>`;
        }).join('');
        
    select.value = state.filters.city;
}

function updateLocationFilters() {
    renderCountryFilter();
    renderCityFilter();
}

function renderTourFilters() {
    // Render languages filter only (tour types are hardcoded in HTML)
    renderLanguagesFilter();
}

// Language name translations
const languageTranslations = {
    'Английский': { ru: 'Английский', en: 'English' },
    'Русский': { ru: 'Русский', en: 'Russian' },
    'Французский': { ru: 'Французский', en: 'French' },
    'Немецкий': { ru: 'Немецкий', en: 'German' },
    'Испанский': { ru: 'Испанский', en: 'Spanish' },
    'Итальянский': { ru: 'Итальянский', en: 'Italian' },
    'Китайский': { ru: 'Китайский', en: 'Chinese' },
    'Арабский': { ru: 'Арабский', en: 'Arabic' },
    'Персидский': { ru: 'Персидский', en: 'Persian' },
    'Таджикский': { ru: 'Таджикский', en: 'Tajik' },
    'Узбекский': { ru: 'Узбекский', en: 'Uzbek' },
    'Туркменский': { ru: 'Туркменский', en: 'Turkmen' },
    'Казахский': { ru: 'Казахский', en: 'Kazakh' },
    'Киргизский': { ru: 'Киргизский', en: 'Kyrgyz' }
};

function renderLanguagesFilter() {
    const container = document.getElementById('languages-checkboxes');
    if (!container) return;
    
    const languages = Array.from(state.languages).sort();
    const currentLang = state.currentLang;
    
    if (languages.length === 0) {
        const emptyMessage = currentLang === 'ru' 
            ? 'Языки появятся после добавления туров' 
            : 'Languages will appear after adding tours';
        container.innerHTML = `<div class="text-sm text-gray-500 py-2">${emptyMessage}</div>`;
        return;
    }
    
    container.innerHTML = languages.map(lang => {
        // Get translated language name
        const translatedName = languageTranslations[lang] 
            ? languageTranslations[lang][currentLang] 
            : lang;
        
        return `
        <div class="filter-option">
            <input type="checkbox" 
                   id="lang-${escapeHtml(lang)}"
                   value="${escapeHtml(lang)}" 
                   ${state.filters.languages.includes(lang) ? 'checked' : ''}
                   onchange="applyFilters()">
            <label for="lang-${escapeHtml(lang)}">${escapeHtml(translatedName)}</label>
        </div>
        `;
    }).join('');
}

function renderHotelFilters() {
    // Render star rating filter
    renderStarFilter();
    // Render amenities filter
    renderAmenitiesFilter();
}

function renderStarFilter() {
    const container = document.getElementById('stars-checkboxes');
    if (!container) return;
    
    const stars = Array.from(state.hotelStars).sort((a, b) => b - a);
    container.innerHTML = stars.map(star => `
        <label class="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
            <input type="checkbox" 
                   value="${star}" 
                   ${state.filters.stars.includes(star) ? 'checked' : ''}
                   onchange="handleStarChange(this)"
                   class="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500">
            <span>${'⭐'.repeat(star)}</span>
        </label>
    `).join('');
}

function renderAmenitiesFilter() {
    const container = document.getElementById('amenities-checkboxes');
    if (!container) return;
    
    const amenities = Array.from(state.amenities).sort();
    container.innerHTML = amenities.map(amenity => `
        <label class="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
            <input type="checkbox" 
                   value="${escapeHtml(amenity)}" 
                   ${state.filters.amenities.includes(amenity) ? 'checked' : ''}
                   onchange="handleAmenityChange(this)"
                   class="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500">
            <span>${escapeHtml(amenity)}</span>
        </label>
    `).join('');
}

// ============= UTILITY FUNCTIONS =============
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getDaysText(days) {
    if (days % 10 === 1 && days % 100 !== 11) return 'день';
    if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) return 'дня';
    return 'дней';
}

function getDaysTextEn(days) {
    return days === 1 ? 'day' : 'days';
}

// ============= ACCORDION FUNCTIONS =============
function toggleFilter(filterId) {
    const section = document.getElementById(`filter-section-${filterId}`);
    if (!section) return;
    
    if (state.openFilters.has(filterId)) {
        state.openFilters.delete(filterId);
        section.classList.remove('open');
    } else {
        state.openFilters.add(filterId);
        section.classList.add('open');
    }
    
    const content = document.getElementById(`${filterId}-content`);
    const chevron = section.querySelector('.chevron');
    
    if (content) {
        if (state.openFilters.has(filterId)) {
            content.style.maxHeight = content.scrollHeight + 'px';
            if (chevron) chevron.style.transform = 'rotate(180deg)';
        } else {
            content.style.maxHeight = '0';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    }
}

function updateAccordionUI(filterId) {
    const section = document.getElementById(`filter-section-${filterId}`);
    if (!section) return;
    
    const content = document.getElementById(`${filterId}-content`);
    const chevron = section.querySelector('.chevron');
    
    if (content) {
        if (state.openFilters.has(filterId)) {
            content.style.maxHeight = content.scrollHeight + 'px';
            if (chevron) chevron.style.transform = 'rotate(180deg)';
            section.classList.add('open');
        } else {
            content.style.maxHeight = '0';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            section.classList.remove('open');
        }
    }
}

// Initialize all accordions
function initializeAccordions() {
    state.openFilters.forEach(filterId => {
        updateAccordionUI(filterId);
    });
}

// ============= FILTER HANDLERS =============
function handleCountryFilterChange(checkbox) {
    const countryId = parseInt(checkbox.value);
    if (!state.filters.countries) state.filters.countries = [];
    
    if (checkbox.checked) {
        if (!state.filters.countries.includes(countryId)) {
            state.filters.countries.push(countryId);
        }
    } else {
        state.filters.countries = state.filters.countries.filter(id => id !== countryId);
        // Clear city filters for this country
        const citiesToRemove = state.cities.filter(city => city.countryId === countryId).map(c => c.id);
        state.filters.cities = state.filters.cities.filter(id => !citiesToRemove.includes(id));
    }
    
    // Re-render cities filter when countries change
    renderCitiesFilter();
    performSearch();
}

function handleCityFilterChange(checkbox) {
    const cityId = parseInt(checkbox.value);
    if (!state.filters.cities) state.filters.cities = [];
    
    if (checkbox.checked) {
        if (!state.filters.cities.includes(cityId)) {
            state.filters.cities.push(cityId);
        }
    } else {
        state.filters.cities = state.filters.cities.filter(id => id !== cityId);
    }
    performSearch();
}

function handleCategoryChange(checkbox) {
    const catId = parseInt(checkbox.value);
    if (checkbox.checked) {
        if (!state.filters.categories.includes(catId)) {
            state.filters.categories.push(catId);
        }
    } else {
        state.filters.categories = state.filters.categories.filter(id => id !== catId);
    }
    performSearch();
}

function handleTourBlockChange(checkbox) {
    const blockId = parseInt(checkbox.value);
    if (checkbox.checked) {
        if (!state.filters.tourBlocks.includes(blockId)) {
            state.filters.tourBlocks.push(blockId);
        }
    } else {
        state.filters.tourBlocks = state.filters.tourBlocks.filter(id => id !== blockId);
    }
    performSearch();
}

// Apply all filters (called from filter UI)
function applyFilters() {
    // Collect tour types
    state.filters.tourTypes = [];
    document.querySelectorAll('#tourtype-checkboxes input[type="checkbox"]:checked').forEach(cb => {
        state.filters.tourTypes.push(cb.value);
    });
    
    // Collect languages
    state.filters.languages = [];
    document.querySelectorAll('#languages-checkboxes input[type="checkbox"]:checked').forEach(cb => {
        state.filters.languages.push(cb.value);
    });
    
    performSearch();
}

function handleStarChange(checkbox) {
    const star = parseInt(checkbox.value);
    if (checkbox.checked) {
        if (!state.filters.stars.includes(star)) {
            state.filters.stars.push(star);
        }
    } else {
        state.filters.stars = state.filters.stars.filter(s => s !== star);
    }
    performSearch();
}

function handleAmenityChange(checkbox) {
    const amenity = checkbox.value;
    if (checkbox.checked) {
        if (!state.filters.amenities.includes(amenity)) {
            state.filters.amenities.push(amenity);
        }
    } else {
        state.filters.amenities = state.filters.amenities.filter(a => a !== amenity);
    }
    performSearch();
}

// ============= SEARCH & FILTER =============
function performSearch() {
    if (state.currentTab === 'tours') {
        searchTours();
    } else {
        searchHotels();
    }
}

function searchTours() {
    let results = [...state.allTours];
    
    // Apply text search
    if (state.filters.query) {
        const query = state.filters.query.toLowerCase();
        results = results.filter(tour => {
            const title = typeof tour.title === 'object' ? (tour.title.ru || tour.title.en || '') : tour.title;
            const desc = typeof tour.description === 'object' ? (tour.description.ru || tour.description.en || '') : tour.description;
            return title.toLowerCase().includes(query) || desc.toLowerCase().includes(query);
        });
    }
    
    // Apply countries filter (sidebar checkboxes)
    if (state.filters.countries && state.filters.countries.length > 0) {
        results = results.filter(tour => {
            if (!tour.tourCountries || tour.tourCountries.length === 0) return false;
            return tour.tourCountries.some(tc => 
                state.filters.countries.includes(tc.countryId)
            );
        });
    }
    
    // Apply cities filter (sidebar checkboxes)
    if (state.filters.cities && state.filters.cities.length > 0) {
        results = results.filter(tour => {
            if (!tour.tourCities || tour.tourCities.length === 0) return false;
            return tour.tourCities.some(tc => 
                state.filters.cities.includes(tc.cityId)
            );
        });
    }
    
    // Apply category filter
    if (state.filters.categories.length > 0) {
        results = results.filter(tour => {
            // Check if tour has any of the selected categories
            if (!tour.tourCategoryAssignments || tour.tourCategoryAssignments.length === 0) return false;
            return tour.tourCategoryAssignments.some(tca => 
                state.filters.categories.includes(tca.categoryId)
            );
        });
    }
    
    // Apply tour blocks filter
    if (state.filters.tourBlocks.length > 0) {
        results = results.filter(tour => {
            // Check if tour has any of the selected tour blocks
            if (!tour.tourBlockAssignments || tour.tourBlockAssignments.length === 0) return false;
            return tour.tourBlockAssignments.some(tba => 
                state.filters.tourBlocks.includes(tba.tourBlockId)
            );
        });
    }
    
    // Apply country filter (top search bar dropdown)
    if (state.filters.country) {
        results = results.filter(tour => {
            if (!tour.tourCountries || tour.tourCountries.length === 0) return false;
            return tour.tourCountries.some(tc => tc.countryId == state.filters.country);
        });
    }
    
    // Apply city filter (top search bar dropdown)
    if (state.filters.city) {
        results = results.filter(tour => {
            if (!tour.tourCities || tour.tourCities.length === 0) return false;
            return tour.tourCities.some(tc => tc.cityId == state.filters.city);
        });
    }
    
    // Apply tour type filter
    if (state.filters.tourTypes.length > 0) {
        results = results.filter(tour => {
            const tourType = tour.tourType || tour.format;
            return tourType && state.filters.tourTypes.includes(tourType);
        });
    }
    
    // Apply language filter
    if (state.filters.languages.length > 0) {
        results = results.filter(tour => {
            if (!tour.languages) return false;
            try {
                const tourLangs = typeof tour.languages === 'string' ? JSON.parse(tour.languages) : tour.languages;
                return Array.isArray(tourLangs) && state.filters.languages.some(lang => tourLangs.includes(lang));
            } catch (e) {
                return false;
            }
        });
    }
    
    // Apply price range filter
    results = results.filter(tour => {
        const price = parseFloat(tour.price) || 0;
        return price >= state.filters.priceMin && price <= state.filters.priceMax;
    });
    
    // Apply date filter
    if (state.filters.date) {
        results = results.filter(tour => {
            try {
                // Парсим дату в формате DD.MM.YYYY
                const dateParts = state.filters.date.split('.');
                if (dateParts.length !== 3) return true; // Если формат неверный, не фильтруем
                
                const day = parseInt(dateParts[0], 10);
                const month = parseInt(dateParts[1], 10);
                const year = parseInt(dateParts[2], 10);
                
                // Проверяем валидность даты
                const date = new Date(year, month - 1, day);
                if (isNaN(date.getTime())) {
                    console.warn('Invalid date:', state.filters.date);
                    return true; // При невалидной дате не фильтруем
                }
                
                // Получаем день недели (0 = Воскресенье, 1 = Понедельник, ...)
                const dayOfWeek = date.getDay();
                
                // Проверяем availableMonths
                if (tour.availableMonths) {
                    const availableMonths = typeof tour.availableMonths === 'string' 
                        ? JSON.parse(tour.availableMonths) 
                        : tour.availableMonths;
                    if (Array.isArray(availableMonths) && availableMonths.length > 0) {
                        // Нормализуем к числам для сравнения
                        const normalizedMonths = availableMonths.map(m => typeof m === 'string' ? parseInt(m, 10) : m);
                        if (!normalizedMonths.includes(month)) {
                            return false; // Тур недоступен в этом месяце
                        }
                    }
                }
                
                // Проверяем availableDays
                if (tour.availableDays) {
                    const availableDays = typeof tour.availableDays === 'string' 
                        ? JSON.parse(tour.availableDays) 
                        : tour.availableDays;
                    if (Array.isArray(availableDays) && availableDays.length > 0) {
                        // Нормализуем к числам для сравнения
                        const normalizedDays = availableDays.map(d => typeof d === 'string' ? parseInt(d, 10) : d);
                        if (!normalizedDays.includes(dayOfWeek)) {
                            return false; // Тур недоступен в этот день недели
                        }
                    }
                }
                
                return true;
            } catch (e) {
                console.error('Error parsing date filter:', e);
                return true; // При ошибке не фильтруем
            }
        });
    }
    
    state.filteredResults = results;
    renderTourCards();
    updateResultsCount();
}

function searchHotels() {
    let results = [...state.allHotels];
    
    // Apply text search
    if (state.filters.query) {
        const query = state.filters.query.toLowerCase();
        results = results.filter(hotel => {
            const name = hotel.nameRu || hotel.nameEn || hotel.name || '';
            const desc = hotel.descriptionRu || hotel.descriptionEn || hotel.description || '';
            return name.toLowerCase().includes(query) || desc.toLowerCase().includes(query);
        });
    }
    
    // Apply country filter (from sidebar checkboxes)
    if (state.filters.countries && state.filters.countries.length > 0) {
        results = results.filter(hotel => state.filters.countries.includes(hotel.countryId));
    }
    
    // Apply city filter (from sidebar checkboxes)
    if (state.filters.cities && state.filters.cities.length > 0) {
        results = results.filter(hotel => state.filters.cities.includes(hotel.cityId));
    }
    
    // Also apply top search bar filters
    if (state.filters.country) {
        results = results.filter(hotel => hotel.countryId == state.filters.country);
    }
    
    if (state.filters.city) {
        results = results.filter(hotel => hotel.cityId == state.filters.city);
    }
    
    // Apply star filter
    if (state.filters.stars.length > 0) {
        results = results.filter(hotel => state.filters.stars.includes(hotel.stars));
    }
    
    // Apply amenities filter
    if (state.filters.amenities.length > 0) {
        results = results.filter(hotel => {
            if (!hotel.amenities) return false;
            try {
                const hotelAmens = typeof hotel.amenities === 'string' ? JSON.parse(hotel.amenities) : hotel.amenities;
                return Array.isArray(hotelAmens) && state.filters.amenities.some(amen => hotelAmens.includes(amen));
            } catch (e) {
                return false;
            }
        });
    }
    
    state.filteredResults = results;
    renderHotelCards();
    updateResultsCount();
}

function updateResultsCount() {
    const countEl = document.querySelector('.results-count');
    if (countEl) {
        const text = state.currentLang === 'ru' ? `Найдено: ${state.filteredResults.length}` : `Found: ${state.filteredResults.length}`;
        countEl.textContent = text;
    }
}

// ============= TOUR TYPE NORMALIZATION =============
// Нормализует тип тура в стандартный enum формат для переводов
function normalizeTourType(tourType) {
    if (!tourType) return 'group_general';
    
    const type = tourType.toLowerCase();
    
    // Групповой персональный / Group Private
    if (type.includes('персональн') || type.includes('personal') || type === 'group_private') {
        return 'group_private';
    }
    
    // Групповой общий / Group General
    if (type.includes('общий') || type.includes('general') || type === 'group_general') {
        return 'group_general';
    }
    
    // Индивидуальный / Individual
    if (type.includes('индивидуальн') || type.includes('individual')) {
        return 'individual';
    }
    
    // Default: групповой общий
    return 'group_general';
}

// ============= ICON HELPERS =============
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

// Функция для получения отображаемого местоположения (только страны)
function getDisplayLocation(tour) {
    const currentLang = state.currentLang;
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

// ============= CARD RENDERING =============
function renderTourCards() {
    const container = document.getElementById('tours-results');
    if (!container) return;
    
    if (state.filteredResults.length === 0) {
        const emptyText = state.currentLang === 'ru' ? 'Туры не найдены' : 'No tours found';
        container.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">${emptyText}</div>`;
        return;
    }
    
    container.innerHTML = state.filteredResults.map(tour => createTourCard(tour)).join('');
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
        if (lang === 'en') {
            return days === 1 ? `${days} day` : `${days} days`;
        } else {
            // Русская форма числительных
            if (days % 10 === 1 && days % 100 !== 11) {
                return `${days} день`;
            } else if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) {
                return `${days} дня`;
            } else {
                return `${days} дней`;
            }
        }
    }
    
    // Если duration - это строка, проверяем её содержимое
    if (tour.duration) {
        const durationStr = String(tour.duration).trim().toLowerCase();
        
        // Проверка: это часы? (ищем 'час', 'hour' или строку заканчивающуюся на 'h')
        const hasHourKeyword = durationStr.includes('час') || durationStr.includes('hour');
        const endsWithH = /\d+\s*h$/i.test(durationStr);
        
        if (hasHourKeyword || endsWithH) {
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
            return tour.duration;
        }
        
        // Если это просто число, добавляем единицу измерения (дни)
        if (/^\d+$/.test(durationStr)) {
            const num = parseInt(durationStr);
            if (lang === 'en') {
                return num === 1 ? `${num} day` : `${num} days`;
            } else {
                if (num % 10 === 1 && num % 100 !== 11) {
                    return `${num} день`;
                } else if (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20)) {
                    return `${num} дня`;
                } else {
                    return `${num} дней`;
                }
            }
        }
        
        // Если уже есть единицы измерения, возвращаем как есть
        return durationStr;
    }
    
    return '';
}

function createTourCard(tour) {
    const currentLang = state.currentLang;
    
    // Многоязычная обработка
    const titleData = tour.title || {};
    const titleText = typeof titleData === 'object' ? (titleData[currentLang] || titleData.ru || titleData.en || '') : titleData;
    
    const descriptionData = tour.description || {};
    const descriptionText = typeof descriptionData === 'object' ? (descriptionData[currentLang] || descriptionData.ru || descriptionData.en || '') : descriptionData;
    
    // Обработка множественных категорий
    let categoryText = '';
    let allCategories = [];
    
    if (tour.tourCategoryAssignments && tour.tourCategoryAssignments.length > 0) {
        // Собираем все категории
        allCategories = tour.tourCategoryAssignments.map(tca => {
            const cat = tca.category;
            let catName;
            try {
                const nameData = typeof cat.name === 'string' ? JSON.parse(cat.name) : cat.name;
                catName = (typeof nameData === 'object' && nameData !== null) ? (nameData[currentLang] || nameData.ru || nameData.en || cat.name) : (cat.name || '');
            } catch (e) {
                catName = cat.name || '';
            }
            return catName;
        }).filter(Boolean);
        
        // Для отображения берем первую категорию
        categoryText = allCategories[0] || '';
    } else if (tour.category && tour.category.name) {
        // Fallback на старую одиночную категорию
        const categoryData = tour.category?.name || '';
        categoryText = typeof categoryData === 'object' ? (categoryData[currentLang] || categoryData.ru || categoryData.en || '') : categoryData;
    }
    
    // Изображения
    const tourImages = [];
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
    if (tourImages.length === 0) {
        tourImages.push('/placeholder-tour.jpg');
    }
    
    const uniqueCardId = `search-${tour.id}`;
    const priceText = currentLang === 'ru' ? 'от' : 'from';
    
    // ИСПРАВЛЕНО: Нормализуем тип тура в стандартный формат для переводов
    const rawTourType = tour.format || tour.tourType || 'group_general';
    const normalizedTourType = normalizeTourType(rawTourType);
    
    // Прямой перевод без использования getTranslation (которая возвращает ключ если нет перевода)
    const tourTypeTranslations = {
        'group_private': { ru: 'Групповой персональный', en: 'Group Personal' },
        'group_general': { ru: 'Групповой общий', en: 'Group General' },
        'individual': { ru: 'Индивидуальный', en: 'Individual' }
    };
    const tourTypeText = tourTypeTranslations[normalizedTourType]?.[currentLang] || rawTourType;
    
    const currentCurrency = window.currentCurrency || 'TJS';
    
    return `
        <div class="tour-card group cursor-pointer bg-white rounded-lg shadow-md hover:shadow-lg transition-all flex flex-col h-full"
             onclick="window.location.href='tour-template.html?tour=${tour.id || 1}'">
            <div class="relative overflow-hidden rounded-t-lg">
                <div class="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center" id="tour-image-container-${uniqueCardId}">
                    ${tourImages.map((imgSrc, index) => `
                        <img src="${imgSrc}" 
                             alt="${titleText}" 
                             class="w-full h-full object-cover absolute inset-0" 
                             onerror="this.style.display='none';">
                    `).join('')}
                </div>
            </div>
            <div class="p-4 flex flex-col flex-grow">
                <!-- Локация (только страны, все показываем) -->
                <div class="text-xs mb-1 sm:mb-2 flex items-center gap-1" style="color: #6B7280;">
                    <svg class="inline w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                    </svg>
                    <span class="font-medium">${getDisplayLocation(tour)}</span>
                </div>
                <!-- Тип тура -->
                <div class="text-xs mb-1 sm:mb-2 flex items-center gap-1" style="color: #3B82F6;">
                    ${getTourTypeIcon(normalizedTourType)}
                    <span class="font-medium">${tourTypeText}</span>${normalizedTourType !== 'individual' && tour.maxPeople ? ` <span class="text-gray-600">(${currentLang === 'en' ? `up to ${tour.maxPeople} people` : `до ${tour.maxPeople} чел.`})</span>` : ''}
                </div>
                <!-- Категория тура с множественными категориями и длительность -->
                <div class="text-xs mb-2" style="color: #3E3E3E;">
                    ${getCategoryIcon(categoryText)}
                    <span class="font-medium">${categoryText}${tour.duration || tour.durationDays ? ` <span class="text-gray-600">(${formatDuration(tour, currentLang)})</span>` : ''}</span>
                    ${allCategories.length > 1 ? `
                    <span class="relative group cursor-help ml-0.5">
                        <span class="text-gray-600 font-semibold hover:text-gray-800 transition-colors">...</span>
                        <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10 shadow-lg">
                            ${allCategories.map((cat, idx) => `<div class="py-0.5">${idx + 1}. ${cat}</div>`).join('')}
                            <div class="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                        </div>
                    </span>
                    ` : ''}
                </div>
                ${tour.rating ? `
                <div class="text-xs text-green-600 mb-2">
                    <span class="font-semibold">★ ${tour.rating}</span>
                    <span class="text-gray-500 ml-1">(${tour.reviewsCount || 0})</span>
                </div>` : ''}
                <h3 class="text-base font-semibold text-gray-900 mb-2 group-hover:text-blue-600 leading-tight">
                    ${titleText}
                </h3>
                <p class="text-xs text-gray-600 mb-2 line-clamp-2 leading-relaxed">${descriptionText}</p>
                <div class="flex items-start justify-between mt-auto gap-3">
                    <div class="flex-1 flex flex-col justify-center">
                        ${tour.originalPrice ? `
                            <div class="text-xs line-through text-gray-400 mb-0.5"><span>${priceText}</span> ${formatPrice(tour.originalPrice, currentCurrency)}</div>
                        ` : ''}
                        <div class="text-base font-bold text-gray-900 leading-tight">
                            <span>${priceText}</span> ${formatPrice(tour.price, currentCurrency)}
                        </div>
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
                    <button class="hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 self-center" 
                            style="background-color: #6B7280;"
                            onclick="event.stopPropagation(); window.location.href='tour-template.html?tour=${tour.id}'">
                        ${currentLang === 'en' ? 'Book' : 'Бронировать'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderHotelCards() {
    const container = document.getElementById('hotels-results');
    if (!container) return;
    
    if (state.filteredResults.length === 0) {
        const emptyText = state.currentLang === 'ru' ? 'Отели не найдены' : 'No hotels found';
        container.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">${emptyText}</div>`;
        return;
    }
    
    container.innerHTML = state.filteredResults.map(hotel => createHotelCard(hotel)).join('');
}

function createHotelCard(hotel) {
    const currentLang = state.currentLang;
    
    // Используем новые поля nameRu/nameEn с fallback на старый формат - ТОЧНО КАК В hotels-catalog.html
    const hotelName = currentLang === 'en' 
        ? (hotel.nameEn || hotel.name || '')
        : (hotel.nameRu || hotel.name || '');
    
    const hotelDesc = currentLang === 'en'
        ? (hotel.descriptionEn || hotel.description || '')
        : (hotel.descriptionRu || hotel.description || '');
    
    // Get first image
    const firstImage = hotel.images && hotel.images.length > 0 ? hotel.images[0] : null;
    const imageUrl = firstImage || '/placeholder-hotel.jpg';
    
    // Generate stars ТОЧНО КАК В hotels-catalog.html - Font Awesome иконки!
    const stars = Array.from({length: 5}, (_, i) => 
        `<i class="fas fa-star ${i < (hotel.stars || 3) ? 'text-yellow-400' : 'text-gray-300'}"></i>`
    ).join('');
    
    // Format amenities with translation - ТОЧНО КАК В hotels-catalog.html - цветные бейджи!
    const amenities = Array.isArray(hotel.amenities) ? hotel.amenities : [];
    const amenitiesHtml = amenities.slice(0, 3).map(amenity => {
        const amenityKey = 'amenity.' + amenity;
        const translated = getTranslation(amenityKey);
        // Если getTranslation вернул ключ обратно, значит перевода нет - используем оригинальный текст
        const translatedAmenity = (translated === amenityKey) ? amenity : translated;
        return `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${translatedAmenity}</span>`;
    }).join('');
    
    // Получаем данные о стране и городе с учетом текущего языка
    const countryName = currentLang === 'en' 
        ? (hotel.country?.nameEn || hotel.country?.nameRu || '')
        : (hotel.country?.nameRu || hotel.country?.nameEn || '');
    const cityName = currentLang === 'en'
        ? (hotel.city?.nameEn || hotel.city?.nameRu || '')
        : (hotel.city?.nameRu || hotel.city?.nameEn || '');
    
    // Формируем строку локации
    let locationText = '';
    if (cityName && countryName) {
        locationText = `${cityName}, ${countryName}`;
    } else if (cityName) {
        locationText = cityName;
    } else if (countryName) {
        locationText = countryName;
    }
    
    // Безопасный парсинг адреса (строка, JSON-строка или объект)
    const addressData = safeJsonParse(hotel.address, { ru: '', en: '' });
    const hotelAddress = getLocalizedText(addressData, currentLang) || '';
    
    // ТОЧНАЯ КОПИЯ карточки из hotels-catalog.html - БЕЗ ИЗМЕНЕНИЙ!
    return `
        <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
            <div class="relative">
                <img src="${getAbsoluteImageUrl(imageUrl)}" alt="${hotelName}" 
                     class="w-full h-48 object-cover" 
                     onerror="this.src='${getAbsoluteImageUrl('/placeholder-hotel.jpg')}'">
                <div class="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded">
                    ${stars}
                </div>
            </div>
            <div class="p-4">
                <h3 class="font-bold text-lg text-gray-900 mb-1 line-clamp-1">${hotelName}</h3>
                
                ${locationText ? `
                <p class="text-blue-600 text-sm mb-2">
                    <i class="fas fa-map-marker-alt mr-1"></i>
                    ${locationText}
                </p>
                ` : ''}
                
                ${hotelAddress ? `
                <p class="text-gray-600 text-sm mb-2">
                    <i class="fas fa-map text-gray-400 mr-1"></i>
                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelAddress + (cityName ? ', ' + cityName : '') + (countryName ? ', ' + countryName : ''))}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       class="hover:text-blue-600 transition-colors">
                        ${hotelAddress}
                        <i class="fas fa-external-link-alt text-xs ml-1"></i>
                    </a>
                </p>
                ` : ''}
                
                ${hotelDesc ? `
                <div class="text-gray-600 text-sm mb-3 line-clamp-2">${hotelDesc}</div>
                ` : ''}
                
                <div class="flex flex-wrap gap-1 mb-3">
                    ${amenitiesHtml}
                </div>
                
                <div class="flex items-center justify-between">
                    <div class="text-sm text-gray-500">
                        ${hotel.brand ? `<span class="font-medium">${hotel.brand}</span>` : ''}
                        ${hotel.category ? `<span class="ml-2">${hotel.category}</span>` : ''}
                    </div>
                    <a href="/hotel-template.html?hotel=${hotel.id}" 
                       class="text-white px-4 py-2 rounded-lg text-sm font-medium transition-all" 
                       style="background: #6B7280; box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3);"
                       onmouseover="this.style.background='#4B5563'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 15px rgba(107, 114, 128, 0.4)'"
                       onmouseout="this.style.background='#6B7280'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(107, 114, 128, 0.3)'">
                        ${getTranslation('btn.more_details')}
                    </a>
                </div>
            </div>
        </div>
    `;
}

function formatHotelLocation(country, city, lang) {
    if (!country && !city) return '';
    
    const countryName = country ? (lang === 'ru' ? (country.nameRu || country.name) : (country.nameEn || country.name)) : '';
    const cityName = city ? (lang === 'ru' ? (city.nameRu || city.name) : (city.nameEn || city.name)) : '';
    
    return [cityName, countryName].filter(Boolean).join(', ');
}

function getHotelAmenities(amenities) {
    if (!amenities) return [];
    try {
        return typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
    } catch (e) {
        return [];
    }
}

function getImageUrl(images) {
    if (!images) return '/api/placeholder/400/300';
    
    try {
        const imageArray = typeof images === 'string' ? JSON.parse(images) : images;
        if (Array.isArray(imageArray) && imageArray.length > 0) {
            return imageArray[0];
        }
    } catch (e) {}
    
    return typeof images === 'string' ? images : '/api/placeholder/400/300';
}

// ============= EVENT LISTENERS =============
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-query');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.filters.query = e.target.value;
            performSearch();
        });
    }
    
    // Country select
    const countrySelect = document.getElementById('search-country');
    if (countrySelect) {
        countrySelect.addEventListener('change', (e) => {
            state.filters.country = e.target.value;
            state.filters.city = ''; // Reset city when country changes
            renderCityFilter();
            performSearch();
        });
    }
    
    // City select
    const citySelect = document.getElementById('search-city');
    if (citySelect) {
        citySelect.addEventListener('change', (e) => {
            state.filters.city = e.target.value;
            performSearch();
        });
    }
    
    // Price range inputs
    const priceMinInput = document.getElementById('price-min');
    const priceMaxInput = document.getElementById('price-max');
    
    if (priceMinInput) {
        priceMinInput.addEventListener('input', (e) => {
            state.filters.priceMin = parseFloat(e.target.value) || 0;
            performSearch();
        });
    }
    
    if (priceMaxInput) {
        priceMaxInput.addEventListener('input', (e) => {
            state.filters.priceMax = parseFloat(e.target.value) || 100000;
            performSearch();
        });
    }
    
    // Tab switching
    const tourTab = document.querySelector('[data-tab="tours"]');
    const hotelTab = document.querySelector('[data-tab="hotels"]');
    
    if (tourTab) {
        tourTab.addEventListener('click', () => {
            state.currentTab = 'tours';
            switchTab('tours');
        });
    }
    
    if (hotelTab) {
        hotelTab.addEventListener('click', () => {
            state.currentTab = 'hotels';
            switchTab('hotels');
        });
    }
    
    // Language change event - reload data for new language
    document.addEventListener('languageChanged', (e) => {
        console.log('🔄 Language changed event received:', e.detail);
        state.currentLang = e.detail.language;
        
        // Обновляем локаль flatpickr календаря
        if (window.searchDatePickerInstance) {
            const newLocale = state.currentLang === 'ru' ? flatpickr.l10ns.ru : flatpickr.l10ns.default;
            window.searchDatePickerInstance.set('locale', newLocale);
            console.log('📅 Flatpickr locale updated to:', state.currentLang);
        }
        
        // Reload all data with new language
        loadAllData().then(() => {
            // Re-render filters with new language
            renderFilters();
            
            // Re-apply current search with new language
            performSearch();
            
            // Переводим статические элементы через i18n систему
            if (typeof translateAllDynamicContent === 'function') {
                translateAllDynamicContent(state.currentLang);
            }
            
            console.log(`✅ Язык страницы поиска обновлен на: ${state.currentLang}`);
        });
    });
    
    // Currency change event - re-render cards with new currency
    document.addEventListener('currencyChanged', (e) => {
        console.log('💱 Currency changed event received:', e.detail);
        
        // Обновляем глобальную валюту для formatPrice
        if (e.detail && e.detail.currency) {
            window.currentCurrency = e.detail.currency;
        }
        
        console.log('💱 Currency changed to:', window.currentCurrency);
        
        // Re-render tour/hotel cards to show new currency
        if (state.currentTab === 'tours') {
            renderTourCards();
        } else {
            renderHotelCards();
        }
        
        console.log('✅ Cards re-rendered with new currency');
    });
    
    // Search button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
}

function switchTab(tab) {
    state.currentTab = tab;
    
    // Update tab UI
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.classList.remove('active-tab');
    });
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active-tab');
    
    // Show/hide results containers
    const toursContainer = document.getElementById('tours-results');
    const hotelsContainer = document.getElementById('hotels-results');
    
    if (tab === 'tours') {
        if (toursContainer) toursContainer.classList.remove('hidden');
        if (hotelsContainer) hotelsContainer.classList.add('hidden');
    } else {
        if (toursContainer) toursContainer.classList.add('hidden');
        if (hotelsContainer) hotelsContainer.classList.remove('hidden');
    }
    
    // Re-render filters and results
    renderFilters();
    performSearch();
}

async function reloadDataAndFilters() {
    await loadAllData();
    renderFilters();
    performSearch();
}

function handleSortChange() {
    const select = document.getElementById('sort-select');
    if (!select) return;
    
    state.currentSort = select.value;
    applySort();
}

// ============= URL PARAMS HANDLING =============
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const blockId = urlParams.get('blockId');
    const categoryId = urlParams.get('categoryId');
    const category = urlParams.get('category'); // Может быть ID или название
    const cityId = urlParams.get('cityId');
    
    // Новые параметры с главной страницы
    const query = urlParams.get('query');
    const countryName = urlParams.get('country');
    const cityName = urlParams.get('city');
    const format = urlParams.get('format'); // тип тура
    const date = urlParams.get('date'); // дата тура
    
    let hasFilters = false;

    // Обработка поискового запроса
    if (query) {
        state.filters.query = query;
        hasFilters = true;
        console.log(`✅ Applied query filter from URL: ${query}`);
    }
    
    // Обработка даты тура
    if (date) {
        state.filters.date = date;
        // Устанавливаем значение в календарь
        const dateInput = document.getElementById('search-date-filter');
        if (dateInput) {
            dateInput.value = date;
        }
        hasFilters = true;
        console.log(`✅ Applied date filter from URL: ${date}`);
    }

    if (blockId) {
        const blockIdNum = parseInt(blockId);
        if (!state.filters.tourBlocks.includes(blockIdNum)) {
            state.filters.tourBlocks.push(blockIdNum);
        }
        hasFilters = true;
    }

    if (categoryId) {
        const catIdNum = parseInt(categoryId);
        if (!state.filters.categories.includes(catIdNum)) {
            state.filters.categories.push(catIdNum);
        }
        hasFilters = true;
    }
    
    // Обработка параметра category - может быть числом (ID) или строкой (название)
    if (category && !categoryId) {
        const catIdNum = parseInt(category);
        
        // Если это число - это ID категории
        if (!isNaN(catIdNum)) {
            if (!state.filters.categories.includes(catIdNum)) {
                state.filters.categories.push(catIdNum);
                hasFilters = true;
                console.log(`✅ Applied category filter from URL: ${catIdNum}`);
            }
        } else {
            // Если это строка - ищем категорию по названию
            const foundCategory = state.categories.find(cat => 
                cat.nameRu === category || cat.nameEn === category
            );
            if (foundCategory && !state.filters.categories.includes(foundCategory.id)) {
                state.filters.categories.push(foundCategory.id);
                hasFilters = true;
                console.log(`✅ Applied category filter by name from URL: ${category} (id=${foundCategory.id})`);
            }
        }
    }
    
    // Обработка названия страны
    if (countryName) {
        const foundCountry = state.countries.find(c => 
            c.nameRu === countryName || c.nameEn === countryName
        );
        if (foundCountry && !state.filters.countries.includes(foundCountry.id)) {
            state.filters.countries.push(foundCountry.id);
            hasFilters = true;
            console.log(`✅ Applied country filter from URL: ${countryName} (id=${foundCountry.id})`);
        }
    }
    
    // Обработка названия города
    if (cityName) {
        const foundCity = state.cities.find(c => 
            c.nameRu === cityName || c.nameEn === cityName
        );
        if (foundCity && !state.filters.cities.includes(foundCity.id)) {
            state.filters.cities.push(foundCity.id);
            hasFilters = true;
            console.log(`✅ Applied city filter by name from URL: ${cityName} (id=${foundCity.id})`);
        }
    }
    
    // Обработка параметра cityId - применяем к обоим фильтрам
    if (cityId) {
        const cityIdNum = parseInt(cityId);
        
        // Устанавливаем для верхнего селектора города
        state.filters.city = cityId;
        
        // Добавляем в массив для боковых чекбоксов (если еще нет)
        if (!isNaN(cityIdNum) && !state.filters.cities.includes(cityIdNum)) {
            state.filters.cities.push(cityIdNum);
        }
        hasFilters = true;
        console.log(`✅ Applied city filter from URL: cityId=${cityId} (added to sidebar checkboxes)`);
    }
    
    // Обработка типа тура (format)
    if (format) {
        if (!state.filters.tourTypes.includes(format)) {
            state.filters.tourTypes.push(format);
            hasFilters = true;
            console.log(`✅ Applied tour type filter from URL: ${format}`);
        }
    }
    
    if (hasFilters) {
        renderFilters(); // Re-render to show checked boxes
        searchTours(); // Apply filters and show results
        searchHotels(); // Also update hotels
    }
}

// ============= LANGUAGE HANDLING =============
// ПРИМЕЧАНИЕ: Обработчик languageChanged теперь находится в setupEventListeners() (строки 1237-1248)
// Он правильно перезагружает данные с API с новым языком параметром

// ============= INITIALIZATION =============
document.addEventListener('DOMContentLoaded', async () => {
    // 🔥 КРИТИЧНО: СНАЧАЛА читаем сохраненные настройки языка и валюты из localStorage
    // Это исправляет проблему когда страница не подхватывает текущий язык/валюту при переходе с других страниц
    const savedLanguage = localStorage.getItem('selectedLanguage') || window.currentLanguage || 'ru';
    const savedCurrency = localStorage.getItem('selectedCurrency') || window.currentCurrency || 'TJS';
    
    // Устанавливаем в state и window ДО загрузки данных
    state.currentLang = savedLanguage;
    window.currentLanguage = savedLanguage;
    window.currentCurrency = savedCurrency;
    
    console.log(`🌍 Инициализация страницы поиска: язык=${savedLanguage}, валюта=${savedCurrency}`);
    
    // ТЕПЕРЬ загружаем данные с правильным языком
    await loadAllData();
    checkUrlParams(); // Check URL parameters
    renderFilters();
    initializeAccordions();
    setupEventListeners();
    performSearch();
    
    // Инициализируем переводы
    if (typeof translateAllDynamicContent === 'function') {
        translateAllDynamicContent(state.currentLang);
    }
    
    // Инициализация flatpickr календаря с локализацией
    const dateInput = document.getElementById('search-date-filter');
    if (dateInput && typeof flatpickr !== 'undefined') {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Инициализация flatpickr
        const fp = flatpickr(dateInput, {
            dateFormat: "d.m.Y",
            minDate: tomorrow,
            locale: state.currentLang === 'ru' ? flatpickr.l10ns.ru : flatpickr.l10ns.default,
            allowInput: false,
            disableMobile: true,
            onChange: function(selectedDates, dateStr, instance) {
                // Обновляем фильтр при выборе даты
                state.filters.date = dateStr;
                performSearch();
                console.log(`📅 Date filter applied: ${dateStr}`);
            }
        });
        
        // Сохраняем инстанс для обновления локали при смене языка
        window.searchDatePickerInstance = fp;
        
        console.log('📅 Flatpickr calendar initialized with locale:', state.currentLang);
    }
});
