/**
 * Universal Layout Loader для динамической загрузки хедера и футера
 * Asynchronously loads _header.html and _footer.html into all pages
 * Standardized version with idempotence guard and layout:ready event
 */

class LayoutLoader {
    constructor() {
        // DOM-based idempotence guard - проверяем актуальный DOM, а не глобальную переменную
        if (document.body && document.body.dataset.layoutInitialized === 'true') {
            console.warn('⚠️ LayoutLoader already initialized for this page, skipping...');
            return;
        }
        
        this.headerLoaded = false;
        this.footerLoaded = false;
        this.API_BASE = window.location.origin;
        
        this.init();
    }

    async init() {
        try {
            await Promise.all([
                this.loadHeader(),
                this.loadFooter()
            ]);
            
            // После загрузки инициализируем интернационализацию
            this.initializeAfterLoad();
        } catch (error) {
            console.error('❌ Layout loading failed:', error);
        }
    }

    async loadHeader() {
        try {
            const response = await fetch('/_header.html?v=1.8');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const headerHTML = await response.text();
            
            // 🎯 УМНАЯ ВСТАВКА: используем контейнер если есть, иначе начало body
            const headerContainer = document.getElementById('header-container') || document.getElementById('header-placeholder');
            if (headerContainer) {
                headerContainer.innerHTML = headerHTML;
                
                // 📐 Добавляем spacer для fixed header (если еще не существует)
                if (!headerContainer.nextElementSibling || !headerContainer.nextElementSibling.classList.contains('header-spacer')) {
                    const spacer = document.createElement('div');
                    spacer.className = 'header-spacer';
                    spacer.style.height = '64px';
                    headerContainer.after(spacer);
                }
            } else {
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = headerHTML;
                document.body.insertBefore(tempContainer.firstElementChild, document.body.firstChild);
                
                // 📐 Добавляем spacer для fixed header
                const spacer = document.createElement('div');
                spacer.className = 'header-spacer';
                spacer.style.height = '64px';
                document.body.insertBefore(spacer, document.body.children[1]);
            }
            
            this.headerLoaded = true;
            console.log('✅ Header loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load header:', error);
        }
    }

    async loadFooter() {
        try {
            const response = await fetch('/_footer.html?v=1.5');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const footerHTML = await response.text();
            
            // 🎯 УМНАЯ ВСТАВКА: используем контейнер если есть, иначе конец body
            const footerContainer = document.getElementById('footer-container') || document.getElementById('footer-placeholder');
            if (footerContainer) {
                footerContainer.innerHTML = footerHTML;
            } else {
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = footerHTML;
                document.body.appendChild(tempContainer.firstElementChild);
            }
            
            this.footerLoaded = true;
            console.log('✅ Footer loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load footer:', error);
        }
    }

    initializeAfterLoad() {
        try {
            // Принудительно устанавливаем русский язык по умолчанию
            this.setDefaultLanguage();
            
            // Принудительно устанавливаем сохраненную валюту
            this.setDefaultCurrency();
            
            // Инициализируем интернационализацию после загрузки layout
            if (typeof window.initializeI18n === 'function') {
                window.initializeI18n();
            }
            
            // Инициализируем dropdown функции
            this.initializeDropdowns();
            
            // Инициализируем языковые переключатели
            this.initializeLanguageSwitcher();
            
            // Инициализируем валютные переключатели
            this.initializeCurrencySwitcher();
            
            // Feature-detected map initialization (only if container exists)
            this.initializeMapIfPresent();
            
            // Динамически загружаем категории туров в выпадающее меню шапки
            this.loadHeaderTourCategories();
            this.bindLanguageChangeForHeaderCategories();

            // Инициализируем плавающий виджет связи
            this.initializeContactWidget();
            
            // Инициализируем кнопку scroll-to-top
            this.initializeScrollToTop();
            
            // Mark as fully initialized - используем DOM-based флаг вместо глобального
            if (document.body) {
                document.body.dataset.layoutInitialized = 'true';
            }
            
            // Dispatch layout:ready event for page scripts
            const layoutReadyEvent = new CustomEvent('layout:ready', {
                detail: { 
                    headerLoaded: this.headerLoaded, 
                    footerLoaded: this.footerLoaded,
                    apiBase: this.API_BASE
                }
            });
            document.dispatchEvent(layoutReadyEvent);
            
            console.log('🎉 Layout initialization completed');
            
        } catch (error) {
            console.error('❌ Layout initialization failed:', error);
        }
    }

    initializeDropdowns() {
        // Проверяем, не были ли уже добавлены обработчики (предотвращаем дублирование)
        if (document.body && document.body.dataset.dropdownHandlersAdded === 'true') {
            console.log('⚠️ Dropdown handlers already added, skipping...');
            return;
        }
        
        // Обработка выпадающих меню
        document.addEventListener('click', (e) => {
            // Закрываем dropdown меню при клике вне их (навигационные dropdown управляются через CSS :hover)
            // Закрываем только языковые/валютные dropdown через удаление класса 'show'
            if (!e.target.closest('.language-dropdown') && !e.target.closest('.currency-dropdown')) {
                const langDropdowns = document.querySelectorAll('.lang-dropdown-content');
                langDropdowns.forEach(dropdown => dropdown.classList.remove('show'));
            }
        });
        
        // Отмечаем что обработчики добавлены
        if (document.body) {
            document.body.dataset.dropdownHandlersAdded = 'true';
        }
    }

    initializeLanguageSwitcher() {
        // Десктоп версия
        window.toggleLanguageDropdown = () => {
            const dropdown = document.getElementById('langDropdown');
            if (dropdown) {
                dropdown.classList.toggle('show');
            }
        };

        // Мобильная версия
        window.toggleLanguageDropdownMobile = () => {
            const dropdown = document.getElementById('langDropdownMobile');
            if (dropdown) {
                dropdown.classList.toggle('show');
            }
        };

        window.switchSiteLanguage = (lang) => {
            if (typeof window.switchLanguage === 'function') {
                window.switchLanguage(lang);
            } else {
                // Fallback для страниц без i18n
                window.currentLanguage = lang;
                localStorage.setItem('selectedLanguage', lang);
                
                // Обновляем UI селектора
                this.updateLanguageSelector(lang);
            }
            
            // Закрываем оба dropdown (десктоп и мобильный)
            const dropdown = document.getElementById('langDropdown');
            if (dropdown) dropdown.classList.remove('show');
            
            const mobileDropdown = document.getElementById('langDropdownMobile');
            if (mobileDropdown) mobileDropdown.classList.remove('show');
        };
    }

    initializeCurrencySwitcher() {
        // Десктоп версия
        window.toggleCurrencyDropdown = () => {
            const dropdown = document.getElementById('currencyDropdown');
            if (dropdown) {
                dropdown.classList.toggle('show');
            }
        };

        // Мобильная версия
        window.toggleCurrencyDropdownMobile = () => {
            const dropdown = document.getElementById('currencyDropdownMobile');
            if (dropdown) {
                dropdown.classList.toggle('show');
            }
        };

        window.selectCurrency = (currency, symbol) => {
            // Обновляем отображение выбранной валюты (все элементы - десктоп и мобильные)
            const selectedCurrencies = document.querySelectorAll('.selected-currency');
            selectedCurrencies.forEach(element => {
                element.textContent = currency;
            });
            
            // ✅ Обновляем активный класс на опциях dropdown
            document.querySelectorAll('[data-currency]').forEach(option => {
                if (option.getAttribute('data-currency') === currency) {
                    option.classList.add('active');
                } else {
                    option.classList.remove('active');
                }
            });
            
            // Сохраняем в localStorage
            localStorage.setItem('selectedCurrency', currency);
            
            // Закрываем оба dropdown (десктоп и мобильный)
            const dropdown = document.getElementById('currencyDropdown');
            if (dropdown) dropdown.classList.remove('show');
            
            const mobileDropdown = document.getElementById('currencyDropdownMobile');
            if (mobileDropdown) mobileDropdown.classList.remove('show');
            
            // Вызываем обработчик смены валюты если он существует
            if (typeof window.updateCurrency === 'function') {
                window.updateCurrency(currency);
            }
            
            // Отправляем событие для страниц бронирования и других страниц
            const currencyChangedEvent = new CustomEvent('currencyChanged', {
                detail: { currency: currency, symbol: symbol }
            });
            window.dispatchEvent(currencyChangedEvent);
            document.dispatchEvent(currencyChangedEvent);
            
            console.log('💱 Currency changed to:', currency);
        };
    }

    updateLanguageSelector(lang) {
        const flags = {
            'en': '🇺🇸',
            'ru': '🇷🇺'
        };
        
        const names = {
            'en': 'English',
            'ru': 'Русский'
        };
        
        // Обновляем все элементы флага (десктоп и мобильные)
        const selectedFlags = document.querySelectorAll('.selected-flag');
        selectedFlags.forEach(flag => {
            flag.textContent = flags[lang] || flags['en'];
        });
        
        // Обновляем все элементы текста языка (десктоп и мобильные)
        const selectedLangs = document.querySelectorAll('.selected-lang');
        selectedLangs.forEach(langEl => {
            langEl.textContent = names[lang] || names['en'];
        });
    }

    setDefaultLanguage() {
        // 🎯 УМНАЯ ЛОГИКА: EN по умолчанию, но сохраняем выбор пользователя
        let savedLanguage = localStorage.getItem('selectedLanguage');
        
        // Если язык не сохранен, устанавливаем английский как дефолтный
        if (!savedLanguage || !['en', 'ru'].includes(savedLanguage)) {
            savedLanguage = 'en';
            localStorage.setItem('selectedLanguage', 'en');
        }
        
        // Применяем выбранный/дефолтный язык
        document.documentElement.lang = savedLanguage;
        window.currentLanguage = savedLanguage;
        
        // Обновляем селектор языка
        this.updateLanguageSelector(savedLanguage);
        
        // Применяем язык через системы переводов
        if (typeof window.switchLanguage === 'function') {
            window.switchLanguage(savedLanguage);
        } else if (typeof window.switchSiteLanguage === 'function') {
            window.switchSiteLanguage(savedLanguage);
        }
        if (typeof window.initializeI18n === 'function') {
            window.initializeI18n(savedLanguage);
        }
        
        console.info(`🌍 Language set to: ${savedLanguage}`);
    }

    setDefaultCurrency() {
        // 💱 УМНАЯ ЛОГИКА: TJS по умолчанию, но сохраняем выбор пользователя
        let savedCurrency = localStorage.getItem('selectedCurrency');
        
        // Список поддерживаемых валют
        const supportedCurrencies = ['TJS', 'USD', 'EUR', 'RUB', 'CNY'];
        
        // Если валюта не сохранена или не поддерживается, устанавливаем TJS по умолчанию
        if (!savedCurrency || !supportedCurrencies.includes(savedCurrency)) {
            savedCurrency = 'TJS';
            localStorage.setItem('selectedCurrency', savedCurrency);
        }
        
        // Обновляем отображение выбранной валюты (все элементы - десктоп и мобильные)
        const selectedCurrencies = document.querySelectorAll('.selected-currency');
        selectedCurrencies.forEach(element => {
            element.textContent = savedCurrency;
        });
        
        // ✅ Обновляем активный класс на опциях dropdown
        document.querySelectorAll('[data-currency]').forEach(option => {
            if (option.getAttribute('data-currency') === savedCurrency) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        
        // Вызываем обработчик смены валюты если он существует
        if (typeof window.updateCurrency === 'function') {
            window.updateCurrency(savedCurrency);
        }
        
        console.info(`💱 Currency set to: ${savedCurrency}`);
    }

    initializeMapIfPresent() {
        console.log('🔄 Initializing footer map after component injection...');
        
        // Ожидаем немного, чтобы footer был полностью вставлен в DOM
        setTimeout(() => {
            this.initFooterMap();
        }, 100);
    }

    // Перенесенная функция инициализации карты из footer HTML
    initFooterMap() {
        console.log('🔄 initFooterMap() called, looking for #map element...');
        
        const mapElement = document.getElementById('map');
        console.log('🔍 Map element found:', !!mapElement);
        if (mapElement) {
            console.log('📏 Map element dimensions:', mapElement.clientWidth + 'x' + mapElement.clientHeight);
        }
        
        if (!mapElement) {
            console.error('❌ Map container #map not found in DOM!');
            // Поищем все элементы с id, чтобы понять что есть в DOM
            const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
            console.log('🔍 Available element IDs:', allIds);
            return;
        }
        
        try {
            console.log('🗺️ Creating official Google Maps iframe with Bunyod-Tour marker...');
            
            // Официальный embed URL Google Maps с маркером "Bunyod-Tour" (новые координаты: 38.560902, 68.800468)
            const mapURL = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3120.1817155814637!2d68.80046849999999!3d38.560902!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1sBunyod-Tour!2s38.560902,68.800468!5e0!3m2!1sen!2s!4v1758353913075!5m2!1sen!2s";
            const fullMapURL = "https://maps.google.com/?q=38.560902,68.800468";
            console.log('🔗 Official Google Maps URL loaded with new coordinates: 38.560902, 68.800468');
            
            const mapHTML = `
                <div style="position: relative; width: 100%; height: 100%; border-radius: 8px; overflow: hidden;">
                    <iframe 
                        src="${mapURL}"
                        width="100%" 
                        height="100%" 
                        style="border:0; border-radius: 8px;" 
                        allowfullscreen="" 
                        loading="lazy" 
                        referrerpolicy="no-referrer-when-downgrade"
                        onload="console.log('📍 Bunyod-Tour Google Maps loaded successfully!');"
                        onerror="console.error('❌ Google Maps failed to load!');">
                    </iframe>
                </div>
            `;
            
            mapElement.innerHTML = mapHTML;
            
            console.log('✅ Official Bunyod-Tour Google Maps embedded successfully!');
            console.log('🎯 Company: Bunyod-Tour with official Google Maps marker');
            console.log('📍 Click the map to open full Google Maps with coordinates');
            console.log('📍 Use Ctrl+Scroll on map to open in full screen');
            
        } catch (error) {
            console.error('❌ Footer map initialization failed:', error);
        }
    }

    async loadHeaderTourCategories() {
        const container = document.getElementById('header-tour-categories');
        if (!container) return;

        // Безопасный фоллбэк: показываем одну ссылку на все туры, чтобы убрать
        // устаревшие захардкоженные ID, которые не совпадают с прод-БД.
        const renderFallback = () => {
            const lang = (window.currentLanguage || 'en').toLowerCase();
            const label = lang === 'en' ? 'All tours' : 'Все туры';
            container.innerHTML = `<a href="/tours-search.html" style="padding: 8px; grid-column: span 2; text-align: center;">${label}</a>`;
        };

        try {
            const lang = (window.currentLanguage || localStorage.getItem('selectedLanguage') || 'en').toLowerCase();
            const response = await fetch(`/api/categories?type=tour&lang=${lang}`);
            if (!response.ok) {
                console.warn('⚠️ Failed to load tour categories for header:', response.status);
                renderFallback();
                return;
            }

            const data = await response.json();
            let categories = Array.isArray(data) ? data : (data.data || data.categories || []);
            // Оставляем только туристические категории (на случай если в таблице есть другие типы)
            categories = categories.filter(c => !c.type || c.type === 'tour');
            if (!categories.length) {
                renderFallback();
                return;
            }

            const html = categories.map(cat => {
                const name = (lang === 'en' ? (cat.nameEn || cat.name_en || cat.name) : (cat.nameRu || cat.name_ru || cat.name)) || cat.name || '';
                const safeName = String(name).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
                return `<a href="/tours-search.html?categories=${cat.id}" style="padding: 8px;">${safeName}</a>`;
            }).join('');

            container.innerHTML = html;
            console.log(`✅ Header tour categories loaded: ${categories.length}`);
        } catch (error) {
            console.error('❌ Failed to load header tour categories:', error);
            renderFallback();
        }
    }

    // Подписываемся на смену языка один раз — перезагружаем подписи категорий
    bindLanguageChangeForHeaderCategories() {
        if (this._headerCategoriesLangBound) return;
        this._headerCategoriesLangBound = true;
        const reload = () => this.loadHeaderTourCategories();
        document.addEventListener('languageChanged', reload);
        document.addEventListener('language:changed', reload);
        window.addEventListener('languageChanged', reload);
    }

    initializeContactWidget() {
        if (document.body && document.body.dataset.contactWidgetInit === 'true') {
            return;
        }

        // Не загружаем виджет на dev-доменах (localhost, staging) —
        // он привязан к bunyodtour.tj и бросает непойманное исключение на других доменах
        const hostname = window.location.hostname;
        const isDevDomain = hostname === 'localhost' ||
                            hostname === '127.0.0.1' ||
                            hostname.includes('.local') ||
                            hostname.startsWith('192.168.') ||
                            hostname.startsWith('staging.') ||
                            hostname.startsWith('dev.');
        if (isDevDomain) {
            return;
        }

        const script = document.createElement('script');
        script.defer = true;
        script.src = 'https://static.getbutton.io/widget/bundle.js?id=yBWNz';
        script.onload = () => {
            console.log('✅ GetButton widget loaded');
        };
        script.onerror = (e) => {
            console.error('❌ GetButton widget failed to load:', e);
        };
        document.body.appendChild(script);
    }
    
    initializeScrollToTop() {
        // Предотвращаем повторную инициализацию
        if (document.body && document.body.dataset.scrollToTopInit === 'true') {
            return;
        }
        
        const scrollBtn = document.getElementById('scrollToTopBtn');
        if (!scrollBtn) {
            console.log('⚠️ Scroll-to-top button not found');
            return;
        }
        
        const showThreshold = 400;
        let isVisible = false;
        
        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // Click handler
        scrollBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            scrollToTop();
        });
        
        // Touch handler for iOS
        scrollBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            scrollToTop();
        }, { passive: false });
        
        function toggleScrollBtn() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
            const shouldShow = scrollTop > showThreshold;
            
            if (shouldShow !== isVisible) {
                isVisible = shouldShow;
                if (shouldShow) {
                    scrollBtn.style.opacity = '1';
                    scrollBtn.style.pointerEvents = 'auto';
                } else {
                    scrollBtn.style.opacity = '0';
                    scrollBtn.style.pointerEvents = 'none';
                }
            }
        }
        
        window.addEventListener('scroll', toggleScrollBtn, { passive: true });
        window.addEventListener('resize', toggleScrollBtn, { passive: true });
        
        // Initial check
        setTimeout(toggleScrollBtn, 100);
        toggleScrollBtn();
        
        if (document.body) {
            document.body.dataset.scrollToTopInit = 'true';
        }
        console.log('✅ Scroll-to-top button initialized');
    }
}

// Глобальная функция для переключения секций футера (аккордеон на мобильных)
window.toggleFooterSection = function(section) {
    const menu = document.getElementById(`${section}-menu`);
    const arrow = document.getElementById(`${section}-arrow`);
    
    if (menu && arrow) {
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            arrow.style.transform = 'rotate(180deg)';
        } else {
            menu.classList.add('hidden');
            arrow.style.transform = 'rotate(0deg)';
        }
    }
};

// Глобальная функция для переключения мобильного меню
window.toggleMobileMenu = function() {
    const menu = document.getElementById('mobileMenu');
    const button = document.getElementById('mobileMenuButton');
    
    if (menu && menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Предотвращаем прокрутку фона
    } else if (menu) {
        menu.classList.add('hidden');
        document.body.style.overflow = ''; // Восстанавливаем прокрутку
    }
};

// Глобальная функция для переключения dropdown в мобильном меню
window.toggleMobileDropdown = function(id) {
    const dropdown = document.getElementById('mobile-' + id);
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
};

// Функции для мобильных языковых и валютных dropdown
window.toggleMobileLangDropdown = function() {
    const dropdown = document.getElementById('mobileLangDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

window.toggleMobileCurrencyDropdown = function() {
    const dropdown = document.getElementById('mobileCurrencyDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

// Функция для поиска из хедера
window.performHeaderSearch = function() {
    const searchInput = document.getElementById('headerSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    
    if (searchQuery.length > 0) {
        // Перенаправляем на страницу поиска с параметром поиска
        window.location.href = '/tours-search.html?search=' + encodeURIComponent(searchQuery);
    } else {
        // Если поле пусто, просто идём на страницу поиска
        window.location.href = '/tours-search.html';
    }
};

// Функция для открытия фильтров из хедера
window.openHeaderFilters = function() {
    // Перенаправляем на страницу поиска (фильтры там откроются по умолчанию)
    window.location.href = '/tours-search.html?showFilters=true';
};

// ============= МОБИЛЬНЫЕ ПОДСКАЗКИ ПОИСКА =============
let headerSearchTimeout;
let headerCurrentSuggestions = [];

function initHeaderSearchSuggestions() {
    const headerSearchInput = document.getElementById('headerSearchInput');
    const headerSearchSuggestions = document.getElementById('headerSearchSuggestions');
    
    if (!headerSearchInput || !headerSearchSuggestions) return;
    
    headerSearchInput.addEventListener('input', function() {
        const query = this.value.trim();
        clearTimeout(headerSearchTimeout);
        
        if (query.length >= 2) {
            headerSearchTimeout = setTimeout(() => {
                fetchHeaderSuggestions(query);
            }, 300);
        } else {
            hideHeaderSuggestions();
        }
    });
    
    headerSearchInput.addEventListener('focus', function() {
        const query = this.value.trim();
        if (query.length >= 2 && headerCurrentSuggestions.length > 0) {
            showHeaderSuggestions();
        }
    });
    
    headerSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            hideHeaderSuggestions();
            window.performHeaderSearch();
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!headerSearchInput.contains(e.target) && !headerSearchSuggestions.contains(e.target)) {
            hideHeaderSuggestions();
        }
    });
}

async function fetchHeaderSuggestions(query) {
    try {
        const response = await fetch(`${window.location.origin}/api/tours/suggestions?query=${encodeURIComponent(query)}`);
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            headerCurrentSuggestions = result.data;
            displayHeaderSuggestions(result.data);
        } else {
            showDefaultHeaderSuggestions(query);
        }
    } catch (error) {
        console.error('Ошибка получения подсказок:', error);
        showDefaultHeaderSuggestions(query);
    }
}

function showDefaultHeaderSuggestions(query) {
    const defaultSuggestions = [
        { text: query, type: 'search', id: null },
        { text: 'Памир', type: 'search', id: null },
        { text: 'Искандеркуль', type: 'search', id: null },
        { text: 'Душанбе', type: 'city', id: null },
        { text: 'Треккинг', type: 'category', id: null }
    ];
    headerCurrentSuggestions = defaultSuggestions;
    displayHeaderSuggestions(defaultSuggestions.slice(0, 5));
}

function displayHeaderSuggestions(suggestions) {
    const container = document.getElementById('headerSearchSuggestions');
    if (!container) return;
    
    if (suggestions.length === 0) {
        hideHeaderSuggestions();
        return;
    }
    
    container.innerHTML = '';
    
    suggestions.slice(0, 6).forEach(suggestion => {
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'flex items-center gap-3 px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0';
        suggestionDiv.onclick = () => selectHeaderSuggestion(suggestion.text, suggestion.type, suggestion.id);
        
        const iconSvg = document.createElement('div');
        iconSvg.className = 'w-5 h-5 text-gray-400 flex-shrink-0';
        iconSvg.innerHTML = getHeaderSuggestionIcon(suggestion.type);
        
        const textSpan = document.createElement('span');
        textSpan.className = 'text-sm text-gray-700 flex-1';
        textSpan.textContent = suggestion.text;
        
        const typeSpan = document.createElement('span');
        typeSpan.className = 'text-xs text-gray-400';
        typeSpan.textContent = getHeaderSuggestionTypeLabel(suggestion.type);
        
        suggestionDiv.appendChild(iconSvg);
        suggestionDiv.appendChild(textSpan);
        suggestionDiv.appendChild(typeSpan);
        container.appendChild(suggestionDiv);
    });
    
    showHeaderSuggestions();
}

function getHeaderSuggestionIcon(type) {
    const t = (type || '').toLowerCase();
    
    // Туры
    if (t === 'tour' || t === 'тур') {
        return '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';
    }
    // Города
    if (t === 'city' || t === 'город') {
        return '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>';
    }
    // Страны
    if (t === 'country' || t === 'страна') {
        return '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    }
    // Категории
    if (t === 'category' || t === 'категория') {
        return '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>';
    }
    // Формат
    if (t === 'format' || t === 'формат') {
        return '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>';
    }
    // По умолчанию - поиск
    return '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>';
}

function getHeaderSuggestionTypeLabel(type) {
    const lang = localStorage.getItem('selectedLanguage') || window.currentLanguage || 'en';
    const t = (type || '').toLowerCase();
    
    // Маппинг типов к меткам
    const typeMap = {
        'tour': { ru: 'Тур', en: 'Tour' },
        'тур': { ru: 'Тур', en: 'Tour' },
        'city': { ru: 'Город', en: 'City' },
        'город': { ru: 'Город', en: 'City' },
        'country': { ru: 'Страна', en: 'Country' },
        'страна': { ru: 'Страна', en: 'Country' },
        'category': { ru: 'Категория', en: 'Category' },
        'категория': { ru: 'Категория', en: 'Category' },
        'format': { ru: 'Формат', en: 'Format' },
        'формат': { ru: 'Формат', en: 'Format' },
        'search': { ru: 'Поиск', en: 'Search' }
    };
    
    return typeMap[t]?.[lang] || typeMap[t]?.ru || '';
}

function selectHeaderSuggestion(text, type, id) {
    const searchInput = document.getElementById('headerSearchInput');
    if (searchInput) {
        searchInput.value = text;
    }
    hideHeaderSuggestions();
    
    const typeNormalized = (type || '').toLowerCase();
    
    // Туры → страница тура (проверяем и русский и английский вариант)
    if ((typeNormalized === 'тур' || typeNormalized === 'tour') && id) {
        window.location.href = '/tour.html?id=' + id;
        return;
    }
    
    // Города → поиск по городу
    if ((typeNormalized === 'город' || typeNormalized === 'city') && id) {
        window.location.href = '/tours-search.html?city=' + id;
        return;
    }
    
    // Страны → поиск по стране
    if ((typeNormalized === 'страна' || typeNormalized === 'country') && id) {
        window.location.href = '/tours-search.html?country=' + id;
        return;
    }
    
    // Категории → поиск по категории
    if (typeNormalized === 'категория' || typeNormalized === 'category') {
        const params = new URLSearchParams();
        if (id) {
            params.append('category', id.toString());
        } else {
            params.append('search', text);
        }
        window.location.href = '/tours-search.html?' + params.toString();
        return;
    }
    
    // Формат тура
    if (typeNormalized === 'формат' || typeNormalized === 'format') {
        const formatMap = {
            'индивидуальный': 'individual',
            'individual': 'individual',
            'групповой': 'group',
            'group': 'group',
            'групповой общий': 'group_shared',
            'shared group': 'group_shared'
        };
        const format = formatMap[text.toLowerCase()] || text;
        const params = new URLSearchParams();
        params.append('format', format);
        window.location.href = '/tours-search.html?' + params.toString();
        return;
    }
    
    // По умолчанию → поиск по тексту
    window.location.href = '/tours-search.html?search=' + encodeURIComponent(text);
}

function showHeaderSuggestions() {
    const container = document.getElementById('headerSearchSuggestions');
    if (container) {
        container.classList.remove('hidden');
    }
}

function hideHeaderSuggestions() {
    const container = document.getElementById('headerSearchSuggestions');
    if (container) {
        setTimeout(() => {
            container.classList.add('hidden');
        }, 150);
    }
}

// Автоматическая инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    window.layoutLoader = new LayoutLoader();
    
    setTimeout(() => {
        initHeaderSearchSuggestions();
    }, 500);
});

// Для совместимости экспортируем класс
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayoutLoader;
}