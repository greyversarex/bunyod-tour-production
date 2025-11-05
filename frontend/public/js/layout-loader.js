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
            const response = await fetch('/_header.html?v=1.6');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const headerHTML = await response.text();
            
            // 🎯 УМНАЯ ВСТАВКА: используем контейнер если есть, иначе начало body
            const headerContainer = document.getElementById('header-container');
            if (headerContainer) {
                headerContainer.innerHTML = headerHTML;
            } else {
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = headerHTML;
                document.body.insertBefore(tempContainer.firstElementChild, document.body.firstChild);
            }
            
            this.headerLoaded = true;
            console.log('✅ Header loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load header:', error);
        }
    }

    async loadFooter() {
        try {
            const response = await fetch('/_footer.html?v=1.4');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const footerHTML = await response.text();
            
            // 🎯 УМНАЯ ВСТАВКА: используем контейнер если есть, иначе конец body
            const footerContainer = document.getElementById('footer-container');
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
        // Создаем глобальные функции для переключения языка
        window.toggleLanguageDropdown = () => {
            const dropdown = document.getElementById('langDropdown');
            if (dropdown) {
                // Используем класс 'show' вместо прямой манипуляции display
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
            
            const mobileDropdown = document.getElementById('mobileLangDropdown');
            if (mobileDropdown) mobileDropdown.classList.remove('show');
        };
    }

    initializeCurrencySwitcher() {
        window.toggleCurrencyDropdown = () => {
            const dropdown = document.getElementById('currencyDropdown');
            if (dropdown) {
                // Используем класс 'show' вместо прямой манипуляции display
                dropdown.classList.toggle('show');
            }
        };

        window.selectCurrency = (currency, symbol) => {
            // Обновляем отображение выбранной валюты (все элементы - десктоп и мобильные)
            const selectedCurrencies = document.querySelectorAll('.selected-currency');
            selectedCurrencies.forEach(element => {
                element.textContent = currency;
            });
            
            // Сохраняем в localStorage
            localStorage.setItem('selectedCurrency', currency);
            
            // Закрываем оба dropdown (десктоп и мобильный)
            const dropdown = document.getElementById('currencyDropdown');
            if (dropdown) dropdown.classList.remove('show');
            
            const mobileDropdown = document.getElementById('mobileCurrencyDropdown');
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
        // 🎯 УМНАЯ ЛОГИКА: RU по умолчанию, но сохраняем выбор пользователя
        let savedLanguage = localStorage.getItem('selectedLanguage');
        
        // Если язык не сохранен, устанавливаем русский как дефолтный
        if (!savedLanguage || !['en', 'ru'].includes(savedLanguage)) {
            savedLanguage = 'ru';
            localStorage.setItem('selectedLanguage', 'ru');
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
            
            // Официальный embed URL Google Maps с маркером "Bunyod-Tour"
            const mapURL = "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3120.1494011721334!2d68.8439764!3d38.5533715!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x38b5d11dd22fc90f%3A0xcca6b041d950e7d5!2sBunyod-Tour!5e0!3m2!1sen!2s!4v1758353913075!5m2!1sen!2s";
            console.log('🔗 Official Google Maps URL loaded');
            
            const mapHTML = `
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
            `;
            
            mapElement.innerHTML = mapHTML;
            console.log('✅ Official Bunyod-Tour Google Maps embedded successfully!');
            console.log('🎯 Company: Bunyod-Tour with official Google Maps marker');
            
        } catch (error) {
            console.error('❌ Footer map initialization failed:', error);
        }
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

// Автоматическая инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    window.layoutLoader = new LayoutLoader();
});

// Для совместимости экспортируем класс
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayoutLoader;
}