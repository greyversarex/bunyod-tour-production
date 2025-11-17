// Global variables
let allVehicles = [];
let filteredVehicles = [];
let allCountries = [];

// Load vehicles on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚗 Vehicles catalog page loaded');
    await loadCountries();
    await loadVehicles();
    setupFilters();
});

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
    const lang = window.currentLanguage || 'ru';
    
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
    
    const lang = window.currentLanguage || 'ru';
    
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

// Load vehicles from API
async function loadVehicles() {
    try {
        const lang = window.currentLanguage || 'ru';
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
        showNoResults();
    }
}

// Setup filter event listeners
function setupFilters() {
    const typeFilter = document.getElementById('typeFilter');
    const countryFilter = document.getElementById('countryFilter');
    const capacityFilter = document.getElementById('capacityFilter');
    const searchInput = document.getElementById('searchInput');
    
    typeFilter?.addEventListener('change', applyFilters);
    countryFilter?.addEventListener('change', applyFilters);
    capacityFilter?.addEventListener('change', applyFilters);
    searchInput?.addEventListener('input', applyFilters);
}

// Apply all filters
function applyFilters() {
    const type = document.getElementById('typeFilter')?.value || '';
    const country = document.getElementById('countryFilter')?.value || '';
    const capacity = document.getElementById('capacityFilter')?.value || '';
    const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
    
    filteredVehicles = allVehicles.filter(vehicle => {
        // Type filter
        if (type && vehicle.type.toLowerCase() !== type.toLowerCase()) {
            return false;
        }
        
        // Country filter
        if (country && vehicle.countryId != country) {
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
        
        // Search filter
        if (search) {
            const nameMatch = (vehicle.nameRu || '').toLowerCase().includes(search) ||
                            (vehicle.nameEn || '').toLowerCase().includes(search);
            const plateMatch = (vehicle.licensePlate || '').toLowerCase().includes(search);
            const brandMatch = (vehicle.brand || '').toLowerCase().includes(search);
            
            if (!nameMatch && !plateMatch && !brandMatch) {
                return false;
            }
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
    document.getElementById('capacityFilter').value = '';
    document.getElementById('searchInput').value = '';
    applyFilters();
}

// Render vehicles grid
function renderVehicles() {
    const grid = document.getElementById('vehiclesGrid');
    const noResults = document.getElementById('noResults');
    
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
    const lang = window.currentLanguage || 'ru';
    const card = document.createElement('div');
    card.className = 'vehicle-card';
    
    // Get first image or placeholder
    let imageSrc = '/api/placeholder/400/200';
    if (vehicle.images) {
        try {
            const images = typeof vehicle.images === 'string' ? JSON.parse(vehicle.images) : vehicle.images;
            if (images && images.length > 0) {
                imageSrc = images[0].startsWith('http') ? images[0] : `/uploads/vehicles/${images[0]}`;
            }
        } catch (e) {
            console.error('Error parsing vehicle images:', e);
        }
    }
    
    // Get vehicle name
    const name = lang === 'ru' ? vehicle.nameRu : vehicle.nameEn;
    
    // Get type translation
    const typeKey = `vehicles.type_${vehicle.type.toLowerCase()}`;
    const typeTranslation = window.getTranslation ? window.getTranslation(typeKey, lang) : vehicle.typeTranslated || vehicle.type;
    
    // Get price display
    let priceDisplay = '';
    if (vehicle.pricePerDay) {
        const currency = vehicle.currency || 'TJS';
        const priceText = window.getTranslation ? window.getTranslation('vehicles.price_per_day', lang) : 'Цена за день';
        priceDisplay = `
            <div class="mt-3 pt-3 border-t border-white/20">
                <div class="flex items-center justify-between">
                    <span class="vehicle-info">${priceText}:</span>
                    <span class="vehicle-price">${vehicle.pricePerDay} ${currency}</span>
                </div>
            </div>
        `;
    }
    
    // Get location info
    const location = vehicle.country || vehicle.city ? 
        `<p class="vehicle-info mb-2"><i class="fas fa-map-marker-alt mr-2"></i>${vehicle.city ? vehicle.city.nameRu || vehicle.city.nameEn || '' : ''}${vehicle.city && vehicle.country ? ', ' : ''}${vehicle.country ? vehicle.country.nameRu || vehicle.country.nameEn || '' : ''}</p>` : '';
    
    card.innerHTML = `
        <div class="relative">
            <img src="${imageSrc}" alt="${name}" class="vehicle-image" onerror="this.src='/api/placeholder/400/200'">
            <div class="absolute top-3 left-3">
                <span class="glass-badge">${typeTranslation}</span>
            </div>
            ${vehicle.brand ? `<div class="absolute top-3 right-3"><span class="glass-badge">${vehicle.brand}</span></div>` : ''}
        </div>
        <div class="vehicle-card-content">
            <h3 class="vehicle-title">${name}</h3>
            ${location}
            <div class="space-y-1">
                ${vehicle.licensePlate ? `<p class="vehicle-info"><i class="fas fa-hashtag mr-2"></i>${vehicle.licensePlate}</p>` : ''}
                <p class="vehicle-info">
                    <i class="fas fa-users mr-2"></i>
                    ${vehicle.capacity} ${window.getTranslation ? window.getTranslation('vehicles.passengers', lang) : 'пассажиров'}
                </p>
                ${vehicle.year ? `<p class="vehicle-info"><i class="fas fa-calendar mr-2"></i>${vehicle.year}</p>` : ''}
            </div>
            ${priceDisplay}
            <button onclick="contactAboutVehicle(${vehicle.id})" class="w-full mt-4 px-4 py-3 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg" style="background-color: #3E3E3E;" onmouseover="this.style.backgroundColor='#2F2F2F'" onmouseout="this.style.backgroundColor='#3E3E3E'">
                <i class="fas fa-phone mr-2"></i>
                <span data-translate="vehicles.contact">Связаться</span>
            </button>
        </div>
    `;
    
    return card;
}

// Contact about vehicle
function contactAboutVehicle(vehicleId) {
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    
    const lang = window.currentLanguage || 'ru';
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
    const lang = window.currentLanguage || 'ru';
    
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
});
