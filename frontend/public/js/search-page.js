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
    currentLang: window.currentLanguage || 'ru',
    
    // Dynamic filter data
    categories: [],
    countries: [],
    cities: [],
    formats: new Set(),
    languages: new Set(),
    durations: new Set(),
    hotelStars: new Set(),
    amenities: new Set(),
    
    // Filter state
    filters: {
        query: '',
        country: '',
        city: '',
        categories: [],
        format: '',
        duration: '',
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
        'TJS': { rate: 1, symbol: 'с.', name: 'Сомони' },
        'USD': { rate: 11.0, symbol: '$', name: 'Доллар США' },
        'EUR': { rate: 12.0, symbol: '€', name: 'Евро' },
        'RUB': { rate: 0.12, symbol: '₽', name: 'Российский рубль' },
        'CNY': { rate: 1.5, symbol: '¥', name: 'Китайский юань' }
    };
    
    if (!priceInTJS || !exchangeRates[currency]) {
        return `${priceInTJS || 0} с.`;
    }
    
    const rate = exchangeRates[currency];
    
    if (currency === 'TJS') {
        return `${priceInTJS} ${rate.symbol}`;
    }
    
    // Convert from TJS to selected currency
    const convertedPrice = Math.round((priceInTJS / rate.rate) * 100) / 100;
    return `${convertedPrice} ${rate.symbol}`;
}

// ============= DATA LOADING =============
async function loadAllData() {
    console.log('🔍 Initializing search page...');
    
    const lang = state.currentLang;
    
    try {
        // Load all data in parallel
        const [toursRes, hotelsRes, categoriesRes, countriesRes, citiesRes] = await Promise.all([
            fetch(`/api/tours/search?lang=${lang}`),
            fetch(`/api/hotels?lang=${lang}`),
            fetch(`/api/categories?type=tour&lang=${lang}`),
            fetch(`/api/countries`),
            fetch(`/api/cities`)
        ]);
        
        const [toursData, hotelsData, categoriesData, countriesData, citiesData] = await Promise.all([
            toursRes.json(),
            hotelsRes.json(),
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
    state.formats.clear();
    state.languages.clear();
    state.durations.clear();
    
    state.allTours.forEach(tour => {
        // Extract formats
        if (tour.format) {
            state.formats.add(tour.format);
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
        
        // Extract durations
        if (tour.durationDays) {
            state.durations.add(tour.durationDays);
        }
    });
    
    console.log('📊 Extracted filter data:', {
        formats: Array.from(state.formats),
        languages: Array.from(state.languages),
        durations: Array.from(state.durations).sort((a, b) => a - b)
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
    renderCategoryFilters();
    renderCountryFilter();
    renderCityFilter();
    
    if (state.currentTab === 'tours') {
        renderTourFilters();
    } else {
        renderHotelFilters();
    }
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
    // Render format filter
    renderFormatFilter();
    // Render duration filter
    renderDurationFilter();
    // Render languages filter  
    renderLanguagesFilter();
}

function renderFormatFilter() {
    const container = document.getElementById('format-checkboxes');
    if (!container) return;
    
    const formats = Array.from(state.formats);
    container.innerHTML = formats.map(format => `
        <label class="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
            <input type="checkbox" 
                   value="${escapeHtml(format)}" 
                   ${state.filters.format === format ? 'checked' : ''}
                   onchange="handleFormatChange(this)"
                   class="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500">
            <span>${escapeHtml(format)}</span>
        </label>
    `).join('');
}

function renderDurationFilter() {
    const container = document.getElementById('duration-checkboxes');
    if (!container) return;
    
    const durations = Array.from(state.durations).sort((a, b) => a - b);
    const currentLang = state.currentLang;
    
    container.innerHTML = durations.map(days => {
        const label = currentLang === 'ru' ? `${days} ${getDaysText(days)}` : `${days} ${getDaysTextEn(days)}`;
        return `
            <label class="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
                <input type="checkbox" 
                       value="${days}" 
                       ${state.filters.duration == days ? 'checked' : ''}
                       onchange="handleDurationChange(this)"
                       class="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500">
                <span>${label}</span>
            </label>
        `;
    }).join('');
}

function renderLanguagesFilter() {
    const container = document.getElementById('languages-checkboxes');
    if (!container) return;
    
    const languages = Array.from(state.languages).sort();
    container.innerHTML = languages.map(lang => `
        <label class="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
            <input type="checkbox" 
                   value="${escapeHtml(lang)}" 
                   ${state.filters.languages.includes(lang) ? 'checked' : ''}
                   onchange="handleLanguageFilterChange(this)"
                   class="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500">
            <span>${escapeHtml(lang)}</span>
        </label>
    `).join('');
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

function handleFormatChange(checkbox) {
    state.filters.format = checkbox.checked ? checkbox.value : '';
    performSearch();
}

function handleDurationChange(checkbox) {
    state.filters.duration = checkbox.checked ? parseInt(checkbox.value) : '';
    performSearch();
}

function handleLanguageFilterChange(checkbox) {
    const lang = checkbox.value;
    if (checkbox.checked) {
        if (!state.filters.languages.includes(lang)) {
            state.filters.languages.push(lang);
        }
    } else {
        state.filters.languages = state.filters.languages.filter(l => l !== lang);
    }
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
    
    // Apply category filter
    if (state.filters.categories.length > 0) {
        results = results.filter(tour => state.filters.categories.includes(tour.categoryId));
    }
    
    // Apply country filter
    if (state.filters.country) {
        results = results.filter(tour => tour.countryId == state.filters.country);
    }
    
    // Apply city filter
    if (state.filters.city) {
        results = results.filter(tour => tour.cityId == state.filters.city);
    }
    
    // Apply format filter
    if (state.filters.format) {
        results = results.filter(tour => tour.format === state.filters.format);
    }
    
    // Apply duration filter
    if (state.filters.duration) {
        results = results.filter(tour => tour.durationDays == state.filters.duration);
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
    
    // Apply country filter
    if (state.filters.country) {
        results = results.filter(hotel => hotel.countryId == state.filters.country);
    }
    
    // Apply city filter
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

function createTourCard(tour) {
    const currentLang = state.currentLang;
    
    // Многоязычная обработка
    const titleData = tour.title || {};
    const titleText = typeof titleData === 'object' ? (titleData[currentLang] || titleData.ru || titleData.en || '') : titleData;
    
    const descriptionData = tour.description || {};
    const descriptionText = typeof descriptionData === 'object' ? (descriptionData[currentLang] || descriptionData.ru || descriptionData.en || '') : descriptionData;
    
    const categoryData = tour.category?.name || '';
    const categoryText = typeof categoryData === 'object' ? (categoryData[currentLang] || categoryData.ru || categoryData.en || '') : categoryData;
    
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
    
    // Локация
    const getDisplayLocation = (tour) => {
        const country = tour.country;
        const city = tour.city;
        
        if (country && city) {
            const countryName = typeof country === 'object' ? (country[`name${currentLang === 'en' ? 'En' : 'Ru'}`] || country.nameRu || country.name) : country;
            const cityName = typeof city === 'object' ? (city[`name${currentLang === 'en' ? 'En' : 'Ru'}`] || city.nameRu || city.name) : city;
            return `${cityName}, ${countryName}`;
        }
        if (city) return typeof city === 'object' ? (city[`name${currentLang === 'en' ? 'En' : 'Ru'}`] || city.nameRu || city.name) : city;
        if (country) return typeof country === 'object' ? (country[`name${currentLang === 'en' ? 'En' : 'Ru'}`] || country.nameRu || country.name) : country;
        return currentLang === 'en' ? 'Location not specified' : 'Локация не указана';
    };
    
    const uniqueCardId = `search-${tour.id}`;
    const priceText = currentLang === 'ru' ? 'от' : 'from';
    
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
                <div class="text-xs text-gray-500 mb-2">
                    📍 ${getDisplayLocation(tour)}
                </div>
                <div class="text-xs text-blue-600 mb-2">
                    🎯 <span class="font-medium">${tour.format || tour.tourType || (currentLang === 'en' ? 'Group' : 'Групповой')}</span>
                </div>
                <div class="text-xs mb-2" style="color: #3E3E3E;">
                    🏷️ <span class="font-medium">${categoryText}</span>
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
                <div class="flex items-center justify-between mt-auto gap-3">
                    <div class="flex-1">
                        ${tour.originalPrice ? `
                            <div class="text-xs line-through text-gray-400 mb-1"><span>${priceText}</span> ${tour.originalPrice} с.</div>
                        ` : ''}
                        <div class="text-lg font-bold text-gray-900">
                            <span>${priceText}</span> ${tour.price} с.
                        </div>
                        <div class="text-xs text-gray-500">${tour.priceType || (currentLang === 'en' ? 'per person' : 'за человека')}</div>
                    </div>
                    <button class="hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0" 
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
    
    // Используем новые поля nameRu/nameEn с fallback
    const hotelName = currentLang === 'en' 
        ? (hotel.nameEn || hotel.name || '')
        : (hotel.nameRu || hotel.name || '');
    
    const hotelDesc = currentLang === 'en'
        ? (hotel.descriptionEn || hotel.description || '')
        : (hotel.descriptionRu || hotel.description || '');
    
    // Get first image
    const firstImage = hotel.images && hotel.images.length > 0 ? hotel.images[0] : null;
    const imageUrl = firstImage || '/placeholder-hotel.jpg';
    
    // Generate stars
    const stars = Array.from({length: 5}, (_, i) => 
        `<i class="fas fa-star ${i < (hotel.stars || 3) ? 'text-yellow-400' : 'text-gray-300'}"></i>`
    ).join('');
    
    // Format amenities
    const amenities = Array.isArray(hotel.amenities) ? hotel.amenities : [];
    const amenitiesHtml = amenities.slice(0, 3).map(amenity => {
        return `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${amenity}</span>`;
    }).join('');
    
    // Получаем данные о стране и городе
    const countryName = currentLang === 'en' 
        ? (hotel.country?.nameEn || hotel.country?.nameRu || '')
        : (hotel.country?.nameRu || hotel.country?.nameEn || '');
    const cityName = currentLang === 'en'
        ? (hotel.city?.nameEn || hotel.city?.nameRu || '')
        : (hotel.city?.nameRu || hotel.city?.nameEn || '');
    
    // Формируем локацию
    let locationText = '';
    if (cityName && countryName) {
        locationText = `${cityName}, ${countryName}`;
    } else if (cityName) {
        locationText = cityName;
    } else if (countryName) {
        locationText = countryName;
    }
    
    // Адрес
    const addressData = typeof hotel.address === 'string' ? hotel.address : '';
    const hotelAddress = addressData;
    
    const detailsText = currentLang === 'en' ? 'More Details' : 'Подробнее';
    
    return `
        <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
            <div class="relative">
                <img src="${imageUrl}" alt="${hotelName}" 
                     class="w-full h-48 object-cover" 
                     onerror="this.src='/placeholder-hotel.jpg'">
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
                    ${hotelAddress}
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
                       style="background: #6B7280;"
                       onmouseover="this.style.background='#4B5563'"
                       onmouseout="this.style.background='#6B7280'">
                        ${detailsText}
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
        state.currentLang = e.detail.language;
        
        // Reload data with new language but keep it fast
        Promise.all([
            loadToursData(),
            loadHotelsData(),
            loadCountries(),
            loadCities()
        ]).then(() => {
            // Re-render filters with new language
            renderFilters();
            
            // Re-apply current search with new language
            performSearch();
        });
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

// ============= INITIALIZATION =============
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllData();
    renderFilters();
    initializeAccordions();
    setupEventListeners();
    performSearch();
});
