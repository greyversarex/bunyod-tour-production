/**
 * HOT TOURS PAGE JAVASCRIPT MODULE
 * Модуль для страницы Акции (Горящие туры)
 * Loads and displays tours with "Hot Tours" block assignment
 */

// Глобальные переменные
let hotTours = [];
let currentCurrency = 'TJS';
let exchangeRates = {};

// Инициализация страницы
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔥 Hot Tours page initialization started');
    
    // Получаем текущую валюту из localStorage
    currentCurrency = localStorage.getItem('selectedCurrency') || 'TJS';
    
    // Загружаем данные
    await loadExchangeRates();
    await loadHotTours();
    
    // Слушаем изменения валюты
    window.updateCurrency = (currency) => {
        currentCurrency = currency;
        renderHotTours();
    };
});

// Загрузка курсов валют
async function loadExchangeRates() {
    try {
        const response = await fetch('/api/currencies');
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                result.data.forEach(currency => {
                    exchangeRates[currency.code] = currency.exchangeRate;
                });
                console.log('💱 Exchange rates loaded:', exchangeRates);
            }
        }
    } catch (error) {
        console.error('❌ Error loading exchange rates:', error);
        // Fallback курсы
        exchangeRates = { TJS: 1, USD: 10.5, EUR: 12, RUB: 0.11, CNY: 1.5 };
    }
}

// Загрузка туров со скидками (isPromotion = true)
async function loadHotTours() {
    try {
        const currentLang = getCurrentLanguage();
        console.log(`🔥 Loading promotional tours (lang: ${currentLang})...`);
        
        // Загружаем ВСЕ туры
        const response = await fetch(`/api/tours?lang=${currentLang}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            // 🔥 Фильтруем туры с флагом isPromotion = true
            hotTours = result.data.filter(tour => tour.isPromotion === true);
            
            console.log(`🔥 Promotional tours loaded: ${hotTours.length} tours`);
            renderHotTours();
        } else {
            console.error('❌ Failed to load promotional tours:', result.error);
            showEmptyState();
        }
    } catch (error) {
        console.error('❌ Error loading promotional tours:', error);
        showEmptyState();
    }
}

// Рендер туров
function renderHotTours() {
    const container = document.getElementById('hot-tours-container');
    
    if (!container) {
        console.error('❌ Container #hot-tours-container not found');
        return;
    }
    
    if (hotTours.length === 0) {
        showEmptyState();
        return;
    }
    
    container.innerHTML = hotTours.map(tour => createTourCard(tour)).join('');
}

// Создание карточки тура
function createTourCard(tour) {
    const currentLang = getCurrentLanguage();
    const title = getMultilingualValue(tour, 'title') || 'Untitled Tour';
    const description = getMultilingualValue(tour, 'description') || '';
    
    // Получаем цену в выбранной валюте
    const priceInfo = getTourPrice(tour);
    
    // Получаем первое изображение тура (API возвращает images, не photos)
    const imageUrl = getTourImage(tour);
    
    // Рейтинг (если есть)
    const rating = tour.rating || 4.5;
    
    // 🔥 Скидка из нового поля discountPercent
    const discount = tour.discountPercent || 0;
    
    // Длительность тура
    const duration = tour.duration || tour.durationDays || '';
    const durationText = duration ? (currentLang === 'en' ? `${duration} days` : `${duration} дней`) : '';
    
    return `
        <div class="bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col relative">
            ${discount > 0 ? `
                <div class="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold z-10">
                    -${Math.round(discount)}%
                </div>
            ` : ''}
            
            <a href="/tour.html?id=${tour.id}" class="block h-64 bg-gray-200 overflow-hidden">
                <img 
                    src="${imageUrl}" 
                    alt="${title}"
                    class="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                    onerror="this.src='/api/placeholder/400/300'"
                >
            </a>
            
            <div class="p-6 flex flex-col flex-grow">
                <div class="flex justify-between items-start mb-2">
                    <a href="/tour.html?id=${tour.id}" class="text-xl font-bold text-gray-900 flex-1 hover:text-gray-700">${title}</a>
                    <div class="flex items-center bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium ml-2">
                        ★ ${rating.toFixed(1)}
                    </div>
                </div>
                
                ${durationText ? `<p class="text-sm text-gray-500 mb-2">${durationText}</p>` : ''}
                
                <p class="text-gray-600 mb-4 flex-grow line-clamp-3">
                    ${description}
                </p>
                
                <div class="flex justify-between items-center mt-auto">
                    <div>
                        ${priceInfo.html}
                    </div>
                    <a 
                        href="/tour.html?id=${tour.id}" 
                        class="text-white px-4 py-2 rounded-md hover:opacity-90 transition-colors"
                        style="background-color: #3E3E3E;"
                    >
                        ${currentLang === 'en' ? 'Book now' : 'Бронировать'}
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Получение изображения тура
function getTourImage(tour) {
    // Проверяем mainImage
    if (tour.mainImage) {
        return tour.mainImage;
    }
    
    // Проверяем images (может быть строка JSON или массив)
    if (tour.images) {
        let images = tour.images;
        if (typeof images === 'string') {
            try {
                images = JSON.parse(images);
            } catch (e) {
                return '/api/placeholder/400/300';
            }
        }
        if (Array.isArray(images) && images.length > 0) {
            return images[0];
        }
    }
    
    // Проверяем photos
    if (tour.photos && Array.isArray(tour.photos) && tour.photos.length > 0) {
        return tour.photos[0].url || tour.photos[0];
    }
    
    return '/api/placeholder/400/300';
}

// Получение цены тура с учетом валюты и скидки
function getTourPrice(tour) {
    // API возвращает price как строку, конвертируем в число
    const basePrice = parseFloat(tour.price) || parseFloat(tour.pricePerPerson) || 0;
    
    if (basePrice <= 0) {
        return {
            html: `<span class="text-xl font-bold text-gray-900">${getCurrentLanguage() === 'en' ? 'Price on request' : 'Цена по запросу'}</span>`,
            value: 0
        };
    }
    
    const baseCurrency = tour.currency || 'TJS';
    const discountPercent = parseFloat(tour.discountPercent) || 0;
    
    // Конвертируем цену
    const convertedPrice = convertPrice(basePrice, baseCurrency, currentCurrency);
    
    const currentLang = getCurrentLanguage();
    const pricePrefix = currentLang === 'en' ? 'from' : 'от';
    
    // 🔥 Если есть скидка, показываем зачёркнутую старую цену
    if (tour.isPromotion && discountPercent > 0 && convertedPrice > 0) {
        // Вычисляем оригинальную цену до скидки
        const originalPrice = convertedPrice / (1 - discountPercent / 100);
        return {
            html: `
                <div class="flex flex-col">
                    <span class="text-sm line-through text-gray-400">${pricePrefix} ${formatPrice(originalPrice, currentCurrency)}</span>
                    <span class="text-xl font-bold text-red-600">${pricePrefix} ${formatPrice(convertedPrice, currentCurrency)}</span>
                </div>
            `,
            value: convertedPrice
        };
    }
    
    // Если есть старая цена (для скидки) - старый способ
    if (tour.oldPrice && parseFloat(tour.oldPrice) > basePrice) {
        const convertedOldPrice = convertPrice(parseFloat(tour.oldPrice), baseCurrency, currentCurrency);
        return {
            html: `
                <div class="flex flex-col">
                    <span class="text-sm line-through text-gray-400">${pricePrefix} ${formatPrice(convertedOldPrice, currentCurrency)}</span>
                    <span class="text-xl font-bold text-red-600">${pricePrefix} ${formatPrice(convertedPrice, currentCurrency)}</span>
                </div>
            `,
            value: convertedPrice
        };
    }
    
    return {
        html: `<span class="text-xl font-bold text-gray-900">${pricePrefix} ${formatPrice(convertedPrice, currentCurrency)}</span>`,
        value: convertedPrice
    };
}

// Конвертация цены
function convertPrice(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[toCurrency] || 1;
    
    // Конвертируем в TJS, затем в целевую валюту
    const amountInTJS = amount * fromRate;
    return amountInTJS / toRate;
}

// Форматирование цены
function formatPrice(amount, currency) {
    const symbols = {
        TJS: 'TJS',
        USD: '$',
        EUR: '€',
        RUB: '₽',
        CNY: '¥'
    };
    
    const symbol = symbols[currency] || currency;
    const formattedAmount = Math.round(amount).toLocaleString('ru-RU');
    
    return `${formattedAmount} ${symbol}`;
}

// Показать пустое состояние
function showEmptyState() {
    const container = document.getElementById('hot-tours-container');
    if (!container) return;
    
    const currentLang = getCurrentLanguage();
    const emptyMessage = currentLang === 'en' 
        ? 'No hot tours available at the moment. Please check back later!' 
        : 'В данный момент горящих туров нет. Загляните позже!';
    
    container.innerHTML = `
        <div class="col-span-full text-center py-16">
            <div class="text-6xl mb-4">🔥</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">
                ${currentLang === 'en' ? 'No Hot Tours' : 'Нет горящих туров'}
            </h3>
            <p class="text-gray-600 mb-6">${emptyMessage}</p>
            <a 
                href="/tours-search.html" 
                class="inline-block text-white px-6 py-3 rounded-lg transition-colors"
                style="background-color: #6B7280;"
            >
                ${currentLang === 'en' ? 'View All Tours' : 'Посмотреть все туры'}
            </a>
        </div>
    `;
}

// Вспомогательные функции
function getCurrentLanguage() {
    return window.currentLanguage || localStorage.getItem('selectedLanguage') || 'ru';
}

function getMultilingualValue(obj, field) {
    if (!obj) return '';
    
    const currentLang = getCurrentLanguage();
    const value = obj[field];
    
    if (typeof value === 'object' && value !== null) {
        return value[currentLang] || value.ru || value.en || '';
    }
    
    return value || '';
}
