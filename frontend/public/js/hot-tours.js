// Strip HTML tags for card descriptions
function stripHtmlTags(html) {
    if (!html) return '';
    // Use regex to strip HTML tags - works even before DOM is ready
    return String(html)
        .replace(/<[^>]*>/g, '') // Remove all HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
        .replace(/&amp;/g, '&')  // Replace &amp; with &
        .replace(/&lt;/g, '<')   // Replace &lt; with <
        .replace(/&gt;/g, '>')   // Replace &gt; with >
        .replace(/&quot;/g, '"') // Replace &quot; with "
        .replace(/&#39;/g, "'")  // Replace &#39; with '
        .replace(/\s+/g, ' ')    // Collapse multiple spaces
        .trim();
}

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
        // Используем тот же API что и остальные страницы
        const response = await fetch('/api/exchange-rates/map');
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                // Преобразуем в формат {currency: rate} для совместимости
                Object.keys(result.data).forEach(currency => {
                    exchangeRates[currency] = result.data[currency].rate;
                });
                console.log('💱 Exchange rates loaded:', exchangeRates);
            }
        }
    } catch (error) {
        console.error('❌ Error loading exchange rates:', error);
        // Fallback курсы (формат: сколько TJS за 1 единицу валюты)
        exchangeRates = { TJS: 1, USD: 10.6, EUR: 11.6, RUB: 0.109, CNY: 1.54 };
    }
}

// Загрузка туров со скидками (isPromotion = true)
async function loadHotTours() {
    try {
        const currentLang = getCurrentLanguage();
        console.log(`🔥 Loading promotional tours (lang: ${currentLang})...`);
        
        // Используем search endpoint с фильтром isPromotion=true
        // Этот endpoint возвращает images (в отличие от /api/tours)
        const response = await fetch(`/api/tours/search?isPromotion=true&lang=${currentLang}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            hotTours = result.data;
            
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
    
    // Загружаем реальные рейтинги из отзывов (как на главной странице)
    loadHotTourRatings();
}

// Загрузка реальных рейтингов туров из отзывов (механика идентична home-page.js)
async function loadHotTourRatings() {
    const placeholders = document.querySelectorAll('.tour-rating-placeholder');
    if (placeholders.length === 0) return;
    
    // Собираем уникальные tourId
    const tourIds = new Set();
    placeholders.forEach(el => {
        const tourId = el.dataset.tourId;
        if (tourId) tourIds.add(tourId);
    });
    
    for (const tourId of tourIds) {
        try {
            const response = await fetch(`/api/reviews/tours/${tourId}/stats`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const { averageRating, totalReviews } = result.data;
                
                document.querySelectorAll(`.tour-rating-placeholder[data-tour-id="${tourId}"]`).forEach(el => {
                    const ratingValue = el.querySelector('.rating-value');
                    const starsContainer = el.querySelector('.rating-stars');
                    if (ratingValue) {
                        if (totalReviews > 0) {
                            ratingValue.textContent = `${averageRating.toFixed(1)} (${totalReviews})`;
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
}

// Создание карточки тура
function createTourCard(tour) {
    const currentLang = getCurrentLanguage();
    const title = getMultilingualValue(tour, 'title') || 'Untitled Tour';
    const description = stripHtmlTags(getMultilingualValue(tour, 'description') || '');
    
    // Получаем цену в выбранной валюте
    const priceInfo = getTourPrice(tour);
    
    // Получаем первое изображение тура (API возвращает images, не photos)
    const imageUrl = getTourImage(tour);
    
    // 🔥 Скидка из нового поля discountPercent
    const discount = tour.discountPercent || 0;
    
    // Длительность тура (учитываем тип: дни или часы)
    const durationRaw = tour.duration || tour.durationDays || '';
    let durationText = '';
    if (durationRaw !== '' && durationRaw !== null && durationRaw !== undefined) {
        const numMatch = String(durationRaw).match(/(\d+)/);
        const n = numMatch ? parseInt(numMatch[1]) : null;
        const isHours = (tour.durationType || 'days') === 'hours';
        if (n !== null) {
            if (isHours) {
                durationText = currentLang === 'en'
                    ? (n === 1 ? `${n} hour` : `${n} hours`)
                    : (n % 10 === 1 && n % 100 !== 11) ? `${n} час`
                    : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? `${n} часа`
                    : `${n} часов`;
            } else {
                durationText = currentLang === 'en'
                    ? (n === 1 ? `${n} day` : `${n} days`)
                    : (n % 10 === 1 && n % 100 !== 11) ? `${n} день`
                    : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? `${n} дня`
                    : `${n} дней`;
            }
        } else {
            durationText = String(durationRaw);
        }
    }
    
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
                    <span class="tour-rating-placeholder text-sm whitespace-nowrap ml-2" data-tour-id="${tour.id}">
                        <span class="rating-stars text-yellow-500">☆☆☆☆☆</span> <span class="rating-value text-gray-500 text-xs">--</span>
                    </span>
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
                        style="background-color: #0ea5e9;"
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
    
    // Пометка типа цены (как в других карточках): за человека / за группу
    const priceTypeLabel = (() => {
        const pt = tour.priceType || '';
        if (pt === 'per_person' || pt === 'за человека') {
            return currentLang === 'en' ? 'per person' : 'за человека';
        } else if (pt === 'per_group' || pt === 'за группу') {
            return currentLang === 'en' ? 'per group' : 'за группу';
        }
        return pt || (currentLang === 'en' ? 'per person' : 'за человека');
    })();
    const priceTypeHtml = `<span class="text-xs text-gray-500">${priceTypeLabel}</span>`;
    
    // 🔥 Если есть скидка, показываем зачёркнутую старую цену
    if (tour.isPromotion && discountPercent > 0 && convertedPrice > 0) {
        // Вычисляем оригинальную цену до скидки
        const originalPrice = convertedPrice / (1 - discountPercent / 100);
        return {
            html: `
                <div class="flex flex-col">
                    <span class="text-sm line-through text-gray-400">${pricePrefix} ${formatPrice(originalPrice, currentCurrency)}</span>
                    <span class="text-xl font-bold text-red-600">${pricePrefix} ${formatPrice(convertedPrice, currentCurrency)}</span>
                    ${priceTypeHtml}
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
                    ${priceTypeHtml}
                </div>
            `,
            value: convertedPrice
        };
    }
    
    return {
        html: `<div class="flex flex-col"><span class="text-xl font-bold text-gray-900">${pricePrefix} ${formatPrice(convertedPrice, currentCurrency)}</span>${priceTypeHtml}</div>`,
        value: convertedPrice
    };
}

// Конвертация цены
// Формат курсов: rate = сколько TJS за 1 единицу валюты (например USD: 10.6)
function convertPrice(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[toCurrency] || 1;
    
    // Конвертируем в TJS, затем в целевую валюту
    // Если fromRate = 10.6 (USD), то 1 USD * 10.6 = 10.6 TJS
    // Если toRate = 0.109 (RUB), то 10.6 TJS / 0.109 = ~97 RUB
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
    const isWholeCurrency = (currency === 'TJS');
    const formattedAmount = isWholeCurrency
        ? Math.round(amount).toLocaleString('ru-RU')
        : parseFloat(amount.toFixed(2)).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
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
    return window.currentLanguage || localStorage.getItem('selectedLanguage') || 'en';
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
