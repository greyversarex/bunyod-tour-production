// Global variables
let allVehicles = [];
let filteredVehicles = [];
let allCountries = [];
let allCities = []; // All cities from server
let availableCities = []; // Cities filtered by selected country
let currentCurrency = 'TJS';
let exchangeRates = {};

// Load vehicles on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚗 Vehicles catalog page loaded');

    // Текущая валюта из localStorage (как на других страницах)
    currentCurrency = localStorage.getItem('selectedCurrency') || 'TJS';

    await loadExchangeRates();
    await loadCountries();
    await loadAllCities();
    await loadVehicles();
    setupFilters();

    // Реагируем на смену валюты в хедере (layout-loader вызывает window.updateCurrency)
    window.updateCurrency = (currency) => {
        currentCurrency = currency || 'TJS';
        renderVehicles();
    };
});

// Загрузка курсов валют (тот же API и формат, что и на остальных страницах)
async function loadExchangeRates() {
    try {
        const response = await fetch('/api/exchange-rates/map');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                Object.keys(result.data).forEach(currency => {
                    exchangeRates[currency] = result.data[currency].rate;
                });
                console.log('💱 Exchange rates loaded:', exchangeRates);
            }
        }
    } catch (error) {
        console.error('❌ Error loading exchange rates:', error);
    }
    // Fallback курсы, если API не вернул данные (пустой ответ или ошибка),
    // чтобы конвертация не молча шла по rate=1
    if (Object.keys(exchangeRates).length === 0) {
        console.warn('⚠️ No exchange rates from API, using fallback rates');
        exchangeRates = { TJS: 1, USD: 10.6, EUR: 11.6, RUB: 0.109, CNY: 1.54 };
    }
}

// Конвертация цены (формат курса: сколько TJS за 1 единицу валюты)
function convertPrice(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[toCurrency] || 1;
    const amountInTJS = amount * fromRate;
    return amountInTJS / toRate;
}

// Форматирование цены (идентично остальным карточкам)
function formatPrice(amount, currency) {
    const symbols = { TJS: 'TJS', USD: '$', EUR: '€', RUB: '₽', CNY: '¥' };
    const symbol = symbols[currency] || currency;
    const isWholeCurrency = (currency === 'TJS');
    const formattedAmount = isWholeCurrency
        ? Math.round(amount).toLocaleString('ru-RU')
        : parseFloat(amount.toFixed(2)).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formattedAmount} ${symbol}`;
}

// Load countries for filter
async function loadCountries() {
    try {
        const response = await fetch('/api/countries');
        const data = await response.json();
        
        if (data.success) {
            allCountries = data.data;
            populateCountryFilter();
        } else {
            console.error('Failed to load countries:', data.message);
            handleCountriesLoadError();
        }
    } catch (error) {
        console.error('Error loading countries:', error);
        handleCountriesLoadError();
    }
}

// Handle countries load error
function handleCountriesLoadError() {
    const countryFilter = document.getElementById('countryFilter');
    const errorBanner = document.getElementById('errorBanner');
    const errorMessage = document.getElementById('errorMessage');
    const lang = window.currentLanguage || 'en';
    
    if (countryFilter) {
        countryFilter.disabled = true;
    }
    
    // Show error banner
    if (errorBanner && errorMessage) {
        const message = lang === 'ru' ? 
            'Не удалось загрузить список стран. Попробуйте обновить страницу.' : 
            'Failed to load countries list. Please refresh the page.';
        errorMessage.textContent = message;
        errorBanner.classList.remove('hidden');
    }
}

// Populate country filter
function populateCountryFilter() {
    const countryFilter = document.getElementById('countryFilter');
    if (!countryFilter) return;
    
    const lang = window.currentLanguage || 'en';
    
    // Clear all existing options
    countryFilter.innerHTML = '';
    
    // Add default option with translation
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    const defaultText = window.getTranslation ? 
        window.getTranslation('vehicles.all_countries', lang) : 
        (lang === 'ru' ? 'Все страны' : 'All Countries');
    defaultOption.textContent = defaultText;
    countryFilter.appendChild(defaultOption);
    
    // Add country options
    allCountries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.id;
        option.textContent = lang === 'ru' ? country.nameRu : country.nameEn;
        countryFilter.appendChild(option);
    });
    
    // Re-apply translations to all filter elements after DOM update
    if (typeof applyTranslations === 'function') {
        applyTranslations();
    } else if (window.updatePageLanguage) {
        window.updatePageLanguage(lang);
    }
}

// Load all cities once
async function loadAllCities() {
    try {
        const response = await fetch('/api/cities');
        const data = await response.json();
        
        if (data.success) {
            allCities = data.data;
            availableCities = [...allCities]; // Initially all cities are available
            populateCityFilter();
        } else {
            console.error('Failed to load cities:', data.message);
            allCities = [];
            availableCities = [];
            populateCityFilter();
        }
    } catch (error) {
        console.error('Error loading cities:', error);
        allCities = [];
        availableCities = [];
        populateCityFilter();
    }
}

// Filter cities by selected country
function filterCitiesByCountry(countryId) {
    if (!countryId) {
        // No country selected - show all cities
        availableCities = [...allCities];
    } else {
        // Filter cities by country
        availableCities = allCities.filter(city => city.countryId == countryId);
    }
    populateCityFilter();
}

// Populate city filter
function populateCityFilter() {
    const cityFilter = document.getElementById('cityFilter');
    if (!cityFilter) return;
    
    const lang = window.currentLanguage || 'en';
    
    // Clear all existing options
    cityFilter.innerHTML = '';
    
    // Add default option with translation
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    const defaultText = window.getTranslation ? 
        window.getTranslation('vehicles.all_cities', lang) : 
        (lang === 'ru' ? 'Все города' : 'All Cities');
    defaultOption.textContent = defaultText;
    cityFilter.appendChild(defaultOption);
    
    // Add city options from availableCities (filtered by country)
    availableCities.forEach(city => {
        const option = document.createElement('option');
        option.value = city.id;
        option.textContent = lang === 'ru' ? city.nameRu : city.nameEn;
        cityFilter.appendChild(option);
    });
    
    // Re-apply translations
    if (typeof applyTranslations === 'function') {
        applyTranslations();
    } else if (window.updatePageLanguage) {
        window.updatePageLanguage(lang);
    }
}

// Load vehicles from API
async function loadVehicles() {
    try {
        const lang = window.currentLanguage || 'en';
        const response = await fetch(`/api/vehicles?lang=${lang}`);
        const data = await response.json();
        
        if (data.success) {
            allVehicles = data.data.filter(v => v.isActive);
            filteredVehicles = [...allVehicles];
            renderVehicles();
            updateResultsCount();
        }
    } catch (error) {
        console.error('Error loading vehicles:', error);
        // CRITICAL: Clear slideshows before showing error to prevent memory leaks
        clearAllVehicleSlideshows();
        showNoResults();
    }
}

// Setup filter event listeners
function setupFilters() {
    const typeFilter = document.getElementById('typeFilter');
    const countryFilter = document.getElementById('countryFilter');
    const cityFilter = document.getElementById('cityFilter');
    const capacityFilter = document.getElementById('capacityFilter');
    
    typeFilter?.addEventListener('change', applyFilters);
    capacityFilter?.addEventListener('change', applyFilters);
    cityFilter?.addEventListener('change', applyFilters);
    
    // Country filter updates available cities and applies filters
    countryFilter?.addEventListener('change', (e) => {
        const countryId = e.target.value;
        filterCitiesByCountry(countryId);
        
        // Reset city filter when country changes
        const cityFilterEl = document.getElementById('cityFilter');
        if (cityFilterEl) cityFilterEl.value = '';
        applyFilters();
    });
}

// Apply all filters
function applyFilters() {
    const type = document.getElementById('typeFilter')?.value || '';
    const country = document.getElementById('countryFilter')?.value || '';
    const city = document.getElementById('cityFilter')?.value || '';
    const capacity = document.getElementById('capacityFilter')?.value || '';
    
    filteredVehicles = allVehicles.filter(vehicle => {
        // Type filter
        if (type && vehicle.type.toLowerCase() !== type.toLowerCase()) {
            return false;
        }
        
        // Country filter
        if (country && vehicle.countryId != country) {
            return false;
        }
        
        // City filter
        if (city && vehicle.cityId != city) {
            return false;
        }
        
        // Capacity filter
        if (capacity) {
            const cap = vehicle.capacity;
            if (capacity === '1-4' && (cap < 1 || cap > 4)) return false;
            if (capacity === '5-8' && (cap < 5 || cap > 8)) return false;
            if (capacity === '9-15' && (cap < 9 || cap > 15)) return false;
            if (capacity === '16+' && cap < 16) return false;
        }
        
        return true;
    });
    
    renderVehicles();
    updateResultsCount();
}

// Clear all filters
function clearFilters() {
    document.getElementById('typeFilter').value = '';
    document.getElementById('countryFilter').value = '';
    document.getElementById('cityFilter').value = '';
    document.getElementById('capacityFilter').value = '';
    
    // Reset available cities to all cities
    availableCities = [...allCities];
    populateCityFilter();
    applyFilters();
}

// Render vehicles grid
function renderVehicles() {
    const grid = document.getElementById('vehiclesGrid');
    const noResults = document.getElementById('noResults');
    
    // CRITICAL: Clear all existing slideshows FIRST to prevent memory leaks
    // This must happen before the zero-results check to ensure intervals are always cleared
    clearAllVehicleSlideshows();
    
    if (filteredVehicles.length === 0) {
        showNoResults();
        return;
    }
    
    grid.innerHTML = '';
    noResults.classList.add('hidden');
    
    filteredVehicles.forEach(vehicle => {
        const card = createVehicleCard(vehicle);
        grid.appendChild(card);
    });
}

// Create vehicle card
function createVehicleCard(vehicle) {
    const lang = window.currentLanguage || 'en';
    const card = document.createElement('div');
    card.className = 'vehicle-card';
    
    // Parse images array and normalize paths
    let vehicleImages = [];
    if (vehicle.images) {
        try {
            const images = typeof vehicle.images === 'string' ? JSON.parse(vehicle.images) : vehicle.images;
            if (Array.isArray(images) && images.length > 0) {
                // Normalize image paths
                vehicleImages = images.map(img => {
                    // If already absolute URL (http/https) or starts with /, use as is
                    if (img.startsWith('http') || img.startsWith('/')) {
                        return img;
                    }
                    // Otherwise prepend /uploads/vehicles/
                    return `/uploads/vehicles/${img}`;
                });
            }
        } catch (e) {
            console.error('Error parsing vehicle images:', e);
        }
    }
    
    // Add placeholder if no images
    if (vehicleImages.length === 0) {
        vehicleImages = ['/api/placeholder/400/200'];
    }
    
    // Get vehicle name
    const name = lang === 'ru' ? vehicle.nameRu : vehicle.nameEn;
    
    // Get type translation
    const typeKey = `vehicles.type_${vehicle.type.toLowerCase()}`;
    const typeTranslation = window.getTranslation ? window.getTranslation(typeKey, lang) : vehicle.typeTranslated || vehicle.type;
    
    // Get price display (конвертируем в выбранную валюту)
    let priceDisplay = '';
    if (vehicle.pricePerDay) {
        const baseCurrency = vehicle.currency || 'TJS';
        const basePrice = parseFloat(vehicle.pricePerDay) || 0;
        const convertedPrice = convertPrice(basePrice, baseCurrency, currentCurrency);
        const priceText = window.getTranslation ? window.getTranslation('vehicles.price_per_day', lang) : 'Цена за день';
        priceDisplay = `
            <div class="mt-3 pt-3 border-t border-white/20">
                <div class="flex items-center justify-between">
                    <span class="vehicle-info">${priceText}:</span>
                    <span class="vehicle-price">${formatPrice(convertedPrice, currentCurrency)}</span>
                </div>
            </div>
        `;
    }
    
    // Get location info with proper translation
    let locationText = '';
    if (vehicle.country || vehicle.city) {
        const cityName = vehicle.city ? (lang === 'ru' ? vehicle.city.nameRu : vehicle.city.nameEn) || vehicle.city.nameRu || vehicle.city.nameEn || '' : '';
        const countryName = vehicle.country ? (lang === 'ru' ? vehicle.country.nameRu : vehicle.country.nameEn) || vehicle.country.nameRu || vehicle.country.nameEn || '' : '';
        const separator = cityName && countryName ? ', ' : '';
        locationText = `<p class="vehicle-info mb-2"><i class="fas fa-map-marker-alt" style="display: inline-block; width: 16px; margin-right: 8px;"></i>${cityName}${separator}${countryName}</p>`;
    }
    
    // Generate unique ID for this card
    const uniqueId = `vehicle-${vehicle.id}-${Date.now()}`;
    
    card.innerHTML = `
        <div class="relative">
            <div class="vehicle-image-container relative overflow-hidden" id="img-container-${uniqueId}">
                ${vehicleImages.map((imgSrc, index) => `
                    <img src="${imgSrc}" 
                         alt="${name}" 
                         class="vehicle-image ${index === 0 ? 'active' : ''}" 
                         style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: ${index === 0 ? '1' : '0'}; transition: opacity 0.5s ease-in-out;"
                         onerror="this.src='/api/placeholder/400/200'">
                `).join('')}
            </div>
            ${vehicleImages.length > 1 ? `
                <div class="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                    ${vehicleImages.map((_, index) => `
                        <div class="slideshow-dot ${index === 0 ? 'active' : ''}" 
                             style="width: 8px; height: 8px; border-radius: 50%; background: ${index === 0 ? 'white' : 'rgba(255,255,255,0.5)'}; cursor: pointer;"
                             onclick="switchVehicleImage('${uniqueId}', ${index})"></div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="absolute top-3 left-3">
                <span class="glass-badge">${typeTranslation}</span>
            </div>
            ${vehicle.brand ? `<div class="absolute top-3 right-3"><span class="glass-badge">${vehicle.brand}</span></div>` : ''}
        </div>
        <div class="vehicle-card-content">
            <h3 class="vehicle-title">${name}</h3>
            ${locationText}
            <div class="space-y-1">
                ${vehicle.licensePlate ? `<p class="vehicle-info"><i class="fas fa-hashtag" style="display: inline-block; width: 16px; margin-right: 8px;"></i>${vehicle.licensePlate}</p>` : ''}
                <p class="vehicle-info">
                    <i class="fas fa-users" style="display: inline-block; width: 16px; margin-right: 8px;"></i>
                    ${vehicle.capacity} ${window.getTranslation ? window.getTranslation('vehicles.passengers', lang) : 'пассажиров'}
                </p>
                ${vehicle.year ? `<p class="vehicle-info"><i class="fas fa-calendar" style="display: inline-block; width: 16px; margin-right: 8px;"></i>${vehicle.year}</p>` : ''}
            </div>
            ${priceDisplay}
        </div>
    `;
    
    // Start auto slideshow if multiple images
    if (vehicleImages.length > 1) {
        startVehicleSlideshow(uniqueId, vehicleImages.length);
    }
    
    return card;
}

// Vehicle slideshow management
const vehicleSlideshows = new Map();

function clearAllVehicleSlideshows() {
    // Clear all intervals to prevent memory leaks
    vehicleSlideshows.forEach((slideshow, id) => {
        if (slideshow.interval) {
            clearInterval(slideshow.interval);
        }
    });
    vehicleSlideshows.clear();
}

function startVehicleSlideshow(uniqueId, imageCount) {
    if (imageCount <= 1) return;
    
    // Store slideshow state
    const slideshowState = {
        currentIndex: 0,
        interval: null
    };
    
    slideshowState.interval = setInterval(() => {
        slideshowState.currentIndex = (slideshowState.currentIndex + 1) % imageCount;
        switchVehicleImage(uniqueId, slideshowState.currentIndex);
    }, 3000); // Change image every 3 seconds
    
    vehicleSlideshows.set(uniqueId, slideshowState);
}

function switchVehicleImage(uniqueId, index) {
    const container = document.getElementById(`img-container-${uniqueId}`);
    if (!container) return;
    
    const images = container.querySelectorAll('img');
    const dots = container.parentElement.querySelectorAll('.slideshow-dot');
    
    images.forEach((img, i) => {
        img.style.opacity = i === index ? '1' : '0';
    });
    
    dots.forEach((dot, i) => {
        dot.style.background = i === index ? 'white' : 'rgba(255,255,255,0.5)';
    });
    
    // Update stored current index
    const slideshow = vehicleSlideshows.get(uniqueId);
    if (slideshow) {
        slideshow.currentIndex = index;
    }
}

// Contact about vehicle
function contactAboutVehicle(vehicleId) {
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    
    const lang = window.currentLanguage || 'en';
    const name = lang === 'ru' ? vehicle.nameRu : vehicle.nameEn;
    const message = lang === 'ru' 
        ? `Здравствуйте! Меня интересует транспорт: ${name} (${vehicle.licensePlate})`
        : `Hello! I'm interested in vehicle: ${name} (${vehicle.licensePlate})`;
    
    // Open contact page or WhatsApp
    window.location.href = `/contacts.html?vehicle=${vehicleId}&message=${encodeURIComponent(message)}`;
}

// Show no results message
function showNoResults() {
    const grid = document.getElementById('vehiclesGrid');
    const noResults = document.getElementById('noResults');
    
    grid.innerHTML = '';
    noResults.classList.remove('hidden');
}

// Update results count
function updateResultsCount() {
    const count = document.getElementById('resultsCount');
    const lang = window.currentLanguage || 'en';
    
    const template = window.getTranslation ? 
        window.getTranslation('vehicles.found_template', lang) : 
        (lang === 'ru' ? 'Найдено {count} из {total} транспорта' : 'Found {count} of {total} vehicles');
    
    count.textContent = template
        .replace('{count}', filteredVehicles.length)
        .replace('{total}', allVehicles.length);
}

// Listen for language change
document.addEventListener('languageChanged', (e) => {
    console.log('🌍 Language changed to:', e.detail.language);
    loadVehicles(); // Reload vehicles with new language
    populateCountryFilter(); // Update country filter with new language
    populateCityFilter(); // Update city filter with new language
});
