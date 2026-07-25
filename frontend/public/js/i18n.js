// === ЦЕНТРАЛЬНАЯ СИСТЕМА ИНТЕРНАЦИОНАЛИЗАЦИИ ===
// Используется на всех страницах сайта для двуязычной поддержки (EN/RU)

// === ЗАЩИТА ОТ ДВОЙНОЙ ЗАГРУЗКИ ===
(function() {
if (window.bunyodTourI18nLoaded) {
    return; // Просто выходим из IIFE без ошибки
}

// Помечаем что система загружена в самом начале
window.bunyodTourI18nLoaded = true;

// Поддерживаемые языки
window.supportedLanguages = window.supportedLanguages || ['en', 'ru'];

// === ЗАЩИТА ОТ FOUC (Flash of Untranslated Content) ===
// Скрываем body СРАЗУ — до того как браузер успеет его отрисовать с русским текстом.
// Работает как для синхронных скриптов (body ещё не существует — стиль применится
// при его создании), так и для defer-скриптов (скрываем до первой отрисовки).
(function injectFoucPrevention() {
    // Если ранний inline-boot в <head> уже спрятал body и определил язык —
    // НЕ дублируем стиль и НЕ ставим короткий таймер. Короткий таймер (150/500ms)
    // отсчитывается с момента парсинга <head>; на медленном соединении он сработал бы
    // ДО завершения перевода и показал бы русский текст до английского (та самая «вспышка»).
    if (window._i18nEarlyBoot) return;
    try {
        var style = document.createElement('style');
        style.id = 'i18n-fouc-prevention';
        style.textContent = 'body{opacity:0!important;transition:opacity 0.12s ease!important}';
        var head = document.head || document.getElementsByTagName('head')[0];
        if (head) {
            head.appendChild(style);
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                var s = document.getElementById('i18n-fouc-prevention');
                if (!s) {
                    document.head.appendChild(style);
                }
            }, { once: true, capture: true });
        }
        // Если в рамках сессии язык уже был определён — используем короткий timeout (150ms).
        // Первый вход (sessionStorage пуст) — 500ms на случай медленной сети.
        var sessionActive = false;
        try { sessionActive = !!sessionStorage.getItem('bt_i18n_sess'); } catch(e) {}
        window._foucSafetyTimer = setTimeout(function() {
            var s = document.getElementById('i18n-fouc-prevention');
            if (s) s.remove();
            if (document.body) document.body.style.opacity = '';
        }, sessionActive ? 150 : 500);
    } catch (e) {
        // Не ломаем страницу если что-то пошло не так
    }
})();

// === СИНХРОННАЯ ИНИЦИАЛИЗАЦИЯ ЯЗЫКА (БЕЗ ГОНКИ) ===
// Читаем сохранённый язык из localStorage СРАЗУ при загрузке скрипта,
// чтобы все последующие модули (home-page, layout-loader, vehicles, etc.)
// видели правильное значение window.currentLanguage с самого начала.
// По умолчанию — английский (фундаментальное правило проекта).
(function initSyncLanguage() {
    // Ранний inline-boot в <head> уже синхронно определил язык до первой отрисовки —
    // повторно не читаем хранилища, чтобы не было расхождений.
    if (window._i18nEarlyBoot && window.currentLanguage) return;
    let lang = 'en'; // По умолчанию английский
    try {
        // 1. Сначала пробуем sessionStorage — быстрый read в рамках текущей сессии
        const sess = sessionStorage.getItem('bt_lang');
        if (sess && window.supportedLanguages.includes(sess)) {
            lang = sess;
        } else {
            // 2. Fallback: читаем из localStorage (долгосрочное хранилище)
            const stored = localStorage.getItem('selectedLanguage');
            if (stored && window.supportedLanguages.includes(stored)) {
                lang = stored;
                // Синхронизируем sessionStorage для следующих страниц в этой сессии
                try { sessionStorage.setItem('bt_lang', lang); } catch(e) {}
            } else {
                // Нормализуем оба хранилища если значение невалидно
                try { localStorage.setItem('selectedLanguage', 'en'); } catch(e) {}
                try { sessionStorage.setItem('bt_lang', 'en'); } catch(e) {}
            }
        }
    } catch (e) {
        // localStorage/sessionStorage недоступны (приватный режим) — fallback 'en'
    }
    window.currentLanguage = lang;
    // Обновляем <html lang> синхронно, чтобы поисковики/скринридеры
    // видели корректный язык страницы немедленно.
    if (document.documentElement) {
        document.documentElement.lang = lang;
    }
})();

// === СЛОВАРЬ ПЕРЕВОДОВ ===
window.translations = window.translations || {
    // === Недостающие ключи (админ-панель, страница ошибки оплаты, загрузка) ===
    // Раньше эти ключи отсутствовали в словаре, поэтому элементы ВСЕГДА показывались
    // на русском, даже при выбранном английском. Добавлены EN+RU для корректного перевода.
    'admin.tour_monitoring': { ru: 'Мониторинг туров', en: 'Tour Monitoring' },
    'admin.custom_tour': { ru: 'Собственный тур', en: 'Custom Tour' },
    'admin.travel_agents': { ru: 'Турагенты B2B', en: 'B2B Travel Agents' },
    'admin.categories': { ru: 'Категории', en: 'Categories' },
    'admin.custom_tour_orders': { ru: 'Заказы собственных туров', en: 'Custom Tour Orders' },
    'admin.custom_tour_orders_title': { ru: 'Заказы собственных туров', en: 'Custom Tour Orders' },
    'admin.city_card_photos': { ru: 'Фото карточек городов', en: 'City Card Photos' },
    'admin.hotels_count': { ru: 'Количество отелей', en: 'Number of Hotels' },
    'table.direction': { ru: 'Направление', en: 'Direction' },
    'table.name_ru': { ru: 'Название (RU)', en: 'Name (RU)' },
    'table.name_en': { ru: 'Название (EN)', en: 'Name (EN)' },
    'btn.add_category': { ru: 'Добавить категорию', en: 'Add Category' },
    'loading': { ru: 'Загрузка...', en: 'Loading...' },
    'payment.fail_page_title': { ru: 'Ошибка оплаты - Bunyod-Tour', en: 'Payment Error - Bunyod-Tour' },
    'payment.fail_title': { ru: 'Ошибка оплаты', en: 'Payment Error' },
    'payment.fail_message': { ru: 'К сожалению, платеж не был завершен. Попробуйте еще раз или выберите другой способ оплаты.', en: 'Unfortunately, the payment was not completed. Please try again or choose another payment method.' },
    'payment.payment_failed': { ru: 'Платеж не прошел', en: 'Payment Failed' },
    'payment.possible_reasons': { ru: 'Возможные причины:', en: 'Possible reasons:' },
    'payment.reason_1': { ru: 'Недостаточно средств на карте', en: 'Insufficient funds on the card' },
    'payment.reason_2': { ru: 'Ошибка при вводе данных карты', en: 'Error entering card details' },
    'payment.reason_3': { ru: 'Платеж отклонен банком', en: 'Payment declined by the bank' },
    'payment.reason_4': { ru: 'Превышен лимит операций', en: 'Transaction limit exceeded' },
    'payment.try_again': { ru: 'Попробовать снова', en: 'Try Again' },
    'payment.contact_support': { ru: 'Связаться с поддержкой', en: 'Contact Support' },
    'placeholder.search_categories': { ru: 'Поиск категорий...', en: 'Search categories...' },
    'filter.select_date': { ru: 'ДД.ММ.ГГГГ', en: 'DD.MM.YYYY' },

    // Главное меню
    'nav.home': { ru: 'Главная', en: 'Home' },
    'nav.tours': { ru: 'Туры', en: 'Tours' },
    'nav.hotels': { ru: 'Отели', en: 'Hotels' },
    'nav.visa_support': { ru: 'Визовая поддержка', en: 'Visa Support' },
    'nav.order_transfer': { ru: 'Заказать трансфер', en: 'Order Transfer', tj: 'Фармоиши трансфер' },
    'nav.tour_agents': { ru: 'Турагентам', en: 'For Tour Agents' },
    'nav.about': { ru: 'О нас', en: 'About Us' },
    'nav.reviews': { ru: 'Отзывы', en: 'Reviews' },
    'nav.blog': { ru: 'Блог', en: 'Blog' },
    'nav.contacts': { ru: 'Контакты', en: 'Contacts' },
    'nav.transfer': { ru: 'Трансфер', en: 'Transfer' },
    'nav.guides': { ru: 'Тургиды', en: 'Tour Guides' },
    'nav.hire_guide': { ru: 'Найм Тур-гида', en: 'Hire a Tour Guide' },
    'nav.book_tour': { ru: 'Заказ тура', en: 'Book Tour' },
    'nav.create_tour': { ru: 'Создать свой тур', en: 'Create Your Tour' },
    'nav.become_partner': { ru: 'Стать Тур-партнёром', en: 'Become a Partner' },
    'nav.our_hotels': { ru: 'Наши отели', en: 'Our Hotels' },
    'nav.our_vehicles': { ru: 'Наш автопарк', en: 'Our Fleet' },
    'nav.tourists': { ru: 'Туристам', en: 'For Tourists' },
    'nav.services': { ru: 'Услуги', en: 'Services' },
    'nav.travel_agents': { ru: 'Турагентам', en: 'For Travel Agents' },
    'nav.site_guide': { ru: 'Руководство сайта', en: 'Website Guide' },
    'nav.special_notes': { ru: 'Особые отметки', en: 'Special Notes' },
    'nav.offer_agreement': { ru: 'Договор оферта', en: 'Offer Agreement' },
    'nav.payment_rules': { ru: 'Правила оплаты и возврата средств', en: 'Payment and Refund Rules' },
    'nav.accommodation_regulation': { ru: 'Положение о размещении', en: 'Accommodation Regulation' },
    'nav.promotions': { ru: 'Акции', en: 'Promotions' },
    'nav.news': { ru: 'Новости', en: 'News' },
    'nav.reviews': { ru: 'Отзывы', en: 'Reviews' },
    'nav.our_agents': { ru: 'Наши турагенты', en: 'Our Tour Agents' },
    'nav.services': { ru: 'Услуги', en: 'Services' },
    'nav.hire_guide': { ru: 'Найм Тур-гида', en: 'Hire a Guide' },
    'nav.create_tour': { ru: 'Создать свой тур', en: 'Create Your Tour' },
    'nav.become_partner': { ru: 'Стать Тур-партнёром', en: 'Become a Partner' },
    'nav.our_hotels': { ru: 'Наши отели', en: 'Our Hotels' },
    'nav.our_vehicles': { ru: 'Наш автопарк', en: 'Our Fleet' },
    'nav.travel_agents': { ru: 'Турагентам', en: 'For Travel Agents' },
    
    // Кнопки и действия
    'btn.more_details': { ru: 'Подробнее', en: 'More Details' },
    'btn.more_photos': { ru: 'Ещё фото', en: 'More Photos' },
    'btn.view_all_photos': { ru: 'Посмотреть все фотографии', en: 'View All Photos' },
    'btn.share': { ru: 'Поделиться', en: 'Share' },
    'btn.share_native': { ru: 'Поделиться в...', en: 'Share to...' },
    'btn.copy_link': { ru: 'Скопировать ссылку', en: 'Copy Link' },
    'btn.download_pdf': { ru: 'Скачать PDF', en: 'Download PDF' },
    'btn.book_now': { ru: 'Забронировать сейчас', en: 'Book Now' },
    'btn.check_availability': { ru: 'Проверить наличие', en: 'Check availability' },
    'btn.go_to_booking': { ru: 'К бронированию', en: 'Go to booking' },
    'btn.book': { ru: 'Бронировать', en: 'Book' },
    'btn.apply': { ru: 'Применить', en: 'Apply' },
    'btn.view_all': { ru: 'Смотреть все', en: 'View All' },
    'btn.send': { ru: 'Отправить', en: 'Send' },
    'btn.search': { ru: 'Поиск', en: 'Search' },
    'btn.filter': { ru: 'Фильтры', en: 'Filters' },
    'btn.contact_us': { ru: 'Связаться с нами', en: 'Contact Us' },
    'btn.submit_review': { ru: 'Отправить отзыв', en: 'Submit Review' },
    'btn.login': { ru: 'Войти', en: 'Login' },
    'btn.logout': { ru: 'Выход', en: 'Logout' },
    'btn.start_tour': { ru: 'Начать тур', en: 'Start Tour' },
    'btn.finish_day': { ru: 'Завершить день', en: 'Finish Day' },
    'btn.finish_tour': { ru: 'Завершить тур', en: 'Finish Tour' },
    'btn.collect_reviews': { ru: 'Собрать отзывы', en: 'Collect Reviews' },
    
    // Заголовки и подзаголовки
    'title.popular_tours': { ru: 'Популярные туры', en: 'Popular Tours' },
    'title.recommended_tours': { ru: 'Рекомендованные туры по Центральной Азии', en: 'Recommended Central Asia Tours' },
    'title.combined_tours': { ru: 'Комбинированные туры по Центральной Азии', en: 'Combined Central Asia Tours' },
    'title.tajikistan_tours': { ru: 'Туры по Таджикистану', en: 'Tajikistan Tours' },
    'title.uzbekistan_tours': { ru: 'Туры по Узбекистану', en: 'Uzbekistan Tours' },
    'title.kyrgyzstan_tours': { ru: 'Туры по Кыргызстану', en: 'Kyrgyzstan Tours' },
    'title.turkmenistan_tours': { ru: 'Туры по Туркменистану', en: 'Turkmenistan Tours' },
    'title.exclusive_tours': { ru: 'Эксклюзивные туры', en: 'Exclusive Tours' },
    'title.tours_by_cities': { ru: 'Туры по городам', en: 'Tours by Cities' },
    'title.find_perfect_tour': { ru: 'Найдите идеальный тур', en: 'Find the Perfect Tour' },
    'title.free_cancellation': { ru: 'Бесплатная отмена', en: 'Free Cancellation' },
    'title.book_now_pay_later': { ru: 'Бронируй сейчас - плати потом', en: 'Book Now - Pay Later' },
    'title.hot_tours': { ru: 'Горящие туры', en: 'Last-minute Tours' },
    'title.promotions': { ru: 'Акции', en: 'Promotions' },
    'title.search_results': { ru: 'Результаты поиска', en: 'Search Results' },
    'title.our_services': { ru: 'Наши услуги', en: 'Our Services' },
    'title.why_choose_us': { ru: 'Почему выбирают нас', en: 'Why Choose Us' },
    
    // Страница акций (Hot Tours)
    'hot_tours_page_title': { ru: 'Горящие туры - Bunyod-Tour', en: 'Hot Tours - Bunyod-Tour' },
    'hot_tours_title': { ru: 'Горящие туры', en: 'Hot Tours' },
    'hot_tours_subtitle': { ru: 'Успейте забронировать туры и экскурсии по специальным ценам!', en: 'Book tours and excursions at special prices!' },
    'how_to_save_title': { ru: 'Как получить максимальную выгоду?', en: 'How to Get Maximum Savings?' },
    'how_to_save_subtitle': { ru: 'Комбинируйте акции и получайте дополнительные скидки', en: 'Combine promotions and get additional discounts' },
    'plan_ahead_title': { ru: 'Планируйте заранее', en: 'Plan Ahead' },
    'plan_ahead_desc': { ru: 'Бронируйте туры за 3-6 месяцев и получите до 15% скидки', en: 'Book tours 3-6 months in advance and get up to 15% discount' },
    'group_discount_title': { ru: 'Собирайте группу', en: 'Gather a Group' },
    'group_discount_desc': { ru: 'Чем больше группа, тем больше скидка - до 20% при группе от 6 человек', en: 'The larger the group, the bigger the discount - up to 20% for groups of 6+' },
    'loyal_customer_title': { ru: 'Станьте постоянным клиентом', en: 'Become a Regular Customer' },
    'loyal_customer_desc': { ru: 'Накапливайте бонусы и получайте эксклюзивные предложения', en: 'Accumulate bonuses and receive exclusive offers' },
    'ready_to_save_title': { ru: 'Готовы сэкономить на путешествии?', en: 'Ready to Save on Your Trip?' },
    'ready_to_save_subtitle': { ru: 'Свяжитесь с нами и узнайте о всех актуальных акциях и скидках', en: 'Contact us to learn about all current promotions and discounts' },
    'contact_us_btn': { ru: 'Связаться с нами', en: 'Contact Us' },
    'view_all_tours_btn': { ru: 'Посмотреть все туры', en: 'View All Tours' },
    
    // Страница трансфера (Transfer)
    'transfer_page_title': { ru: 'Трансфер - Bunyod-Tour', en: 'Transfer - Bunyod-Tour' },
    'transfer_main_title': { ru: 'Трансфер', en: 'Transfer' },
    'transfer_main_subtitle': { ru: 'Закажите трансфер куда вам необходимо. Быстро, удобно и надежно.', en: 'Book a transfer anywhere you need. Fast, convenient, and reliable.' },
    'transfer_booking_note': { ru: 'Обратите внимание: перед бронированием мы рекомендуем внимательно ознакомиться с информацией о каждом транспортном средстве, включая зоны обслуживания и пункты назначения. Также обратите внимание, что в пиковый туристический сезон не все указанные транспортные средства могут быть доступны, но мы предоставим эквивалентное транспортное средство вместо выбранного вами. Если у вас возникнут какие-либо вопросы, пожалуйста, свяжитесь с нами, мы всегда рады помочь!', en: 'Please note: Before booking, we recommend carefully reviewing the information about each vehicle, including service zones and destinations. Please also note that during peak tourist season, not all listed vehicles may be available, but we will provide an equivalent vehicle for your selected vehicle. If you have any questions, please contact us, we are always happy to help!' },
    'vehicles.details_btn': { ru: 'Детали', en: 'Details' },
    'vehicles.details_modal_title': { ru: 'Описание автомобиля', en: 'Vehicle Details' },
    'vehicles.no_description': { ru: 'Описание не добавлено', en: 'No description available' },
    'vehicles.details_close': { ru: 'Закрыть', en: 'Close' },
    'transfer_form_title': { ru: 'Заказать трансфер', en: 'Book Transfer' },
    'transfer_form_subtitle': { ru: 'Заполните форму и мы свяжемся с вами в ближайшее время', en: 'Fill out the form and we will contact you shortly' },
    'transfer_fullname': { ru: 'ФИО', en: 'Full Name' },
    'transfer_fullname_placeholder': { ru: 'Введите ваше полное имя', en: 'Enter your full name' },
    'transfer_email': { ru: 'Email', en: 'Email' },
    'transfer_email_placeholder': { ru: 'your@email.com', en: 'your@email.com' },
    'transfer_phone': { ru: 'Телефон', en: 'Phone' },
    'transfer_phone_placeholder': { ru: '+992 XX XXX XXXX', en: '+992 XX XXX XXXX' },
    'transfer_country': { ru: 'Страна', en: 'Country' },
    'transfer_country_select': { ru: 'Выберите страну', en: 'Select country' },
    'transfer_city': { ru: 'Город отправления', en: 'Departure City' },
    'transfer_city_select': { ru: 'Выберите город', en: 'Select city' },
    'transfer_pickup': { ru: 'Место приёма', en: 'Pickup Location' },
    'transfer_pickup_placeholder': { ru: 'Откуда забрать (адрес, отель, аэропорт)', en: 'Pickup location (address, hotel, airport)' },
    'transfer_dropoff': { ru: 'Место высадки', en: 'Drop-off Location' },
    'transfer_dropoff_placeholder': { ru: 'Куда доставить (адрес, отель)', en: 'Drop-off location (address, hotel)' },
    'transfer_date': { ru: 'Дата', en: 'Date' },
    'transfer_date_start': { ru: 'Дата начала аренды', en: 'Rental Start Date' },
    'transfer_date_end': { ru: 'Дата окончания аренды', en: 'Rental End Date' },
    'transfer_rental_days_label': { ru: 'Количество дней аренды:', en: 'Number of rental days:' },
    'transfer_driver_daily_expenses': { ru: 'Суточные расходы водителя:', en: "Driver's daily expenses:" },
    'transfer_days_unit': { ru: 'дн.', en: 'days' },
    'transfer_time': { ru: 'Время подачи', en: 'Pickup Time' },
    'transfer_passengers': { ru: 'Количество пассажиров', en: 'Number of Passengers' },
    'transfer_vehicle_type': { ru: 'Тип транспорта', en: 'Vehicle Type' },
    'transfer_vehicle_select': { ru: 'Выберите тип', en: 'Select type' },
    'transfer_vehicle_sedan': { ru: 'Седан', en: 'Sedan' },
    'transfer_vehicle_suv': { ru: 'Внедорожник', en: 'SUV' },
    'transfer_vehicle_minibus': { ru: 'Микроавтобус', en: 'Minibus' },
    'transfer_vehicle_bus': { ru: 'Автобус', en: 'Bus' },
    'transfer_vehicle_minivan': { ru: 'Минивэн', en: 'Minivan' },
    'transfer_vehicle_luxury': { ru: 'Люкс', en: 'Luxury' },
    'transfer_vehicle_filters': { ru: 'Параметры автомобиля', en: 'Vehicle Parameters' },
    'transfer_vehicle_capacity': { ru: 'Вместимость', en: 'Capacity' },
    'transfer_capacity_any': { ru: 'Любая', en: 'Any' },
    'transfer_capacity_1_4': { ru: '1-4 пассажира', en: '1-4 passengers' },
    'transfer_capacity_5_8': { ru: '5-8 пассажиров', en: '5-8 passengers' },
    'transfer_capacity_9_15': { ru: '9-15 пассажиров', en: '9-15 passengers' },
    'transfer_capacity_16_plus': { ru: '16+ пассажиров', en: '16+ passengers' },
    'transfer_available_vehicles': { ru: 'Доступные автомобили', en: 'Available Vehicles' },
    'transfer_no_vehicles': { ru: 'Автомобили не найдены. Попробуйте изменить параметры поиска.', en: 'No vehicles found. Try changing search parameters.' },
    'transfer_swipe_hint': { ru: 'Листайте, чтобы увидеть другие автомобили', en: 'Swipe to see other vehicles' },
    'transfer_select_date_first': { ru: 'Выберите дату поездки, чтобы увидеть доступные автомобили', en: 'Select a travel date to see available vehicles' },
    'transfer_special_requests': { ru: 'Дополнительные пожелания', en: 'Special Requests' },
    'transfer_special_requests_placeholder': { ru: 'Детское автокресло, остановки в пути, особые требования...', en: 'Child seat, stops along the way, special requirements...' },
    'transfer_submit_btn': { ru: 'Забронировать', en: 'Book Now' },
    'transfer_submit_sending': { ru: 'Отправляется...', en: 'Sending...' },
    'transfer_success_title': { ru: 'Заявка отправлена!', en: 'Request Sent!' },
    'transfer_success_message': { ru: 'Мы свяжемся с вами в ближайшее время для подтверждения трансфера.', en: 'We will contact you shortly to confirm your transfer.' },
    'transfer_error_title': { ru: 'Ошибка', en: 'Error' },
    'transfer_error_validation': { ru: 'Ошибка валидации', en: 'Validation Error' },
    'transfer_error_contact': { ru: 'Укажите хотя бы один способ связи: email или телефон', en: 'Please provide at least one contact method: email or phone' },
    'transfer_error_message': { ru: 'Произошла ошибка при отправке заявки', en: 'An error occurred while submitting the request' },
    
    // Страница оплаты трансфера (Transfer Payment)
    'transfer_payment_title': { ru: 'Оплата трансфера | Bunyod-Tour', en: 'Transfer Payment | Bunyod-Tour' },
    'transfer_payment_heading': { ru: 'Оплата трансфера', en: 'Transfer Payment' },
    'transfer_payment_subtitle': { ru: 'Проверьте детали вашего заказа и выберите способ оплаты', en: 'Review your order details and select payment method' },
    'transfer_payment_options': { ru: 'Условия оплаты', en: 'Payment Terms' },
    'transfer_payment_full': { ru: 'Полная оплата (100%)', en: 'Full Payment (100%)' },
    'transfer_payment_full_desc': { ru: 'Оплатите полную стоимость трансфера сейчас', en: 'Pay the full transfer cost now' },
    'transfer_payment_deposit': { ru: 'Депозит 10%', en: '10% Deposit' },
    'transfer_payment_deposit_desc': { ru: 'Оплатите 10% сейчас, остальные 90% перед трансфером', en: 'Pay 10% now, remaining 90% before transfer' },
    'transfer_details': { ru: 'Детали трансфера', en: 'Transfer Details' },
    'transfer_vehicle': { ru: 'Автомобиль', en: 'Vehicle' },
    'transfer_route': { ru: 'Маршрут', en: 'Route' },
    'transfer_contact': { ru: 'Контактное лицо', en: 'Contact Person' },
    'transfer_total': { ru: 'Итого к оплате', en: 'Total to Pay' },
    'payment_select': { ru: 'Выберите способ оплаты', en: 'Select Payment Method' },
    'payment_payler': { ru: 'VISA / MasterCard — Payler', en: 'VISA / MasterCard — Payler' },
    'payment_payler_desc': { ru: 'Безопасная оплата банковской картой', en: 'Secure card payment' },
    'payment_alifpay': { ru: 'VISA / MasterCard — AlifPay', en: 'VISA / MasterCard — AlifPay' },
    'payment_alifpay_desc': { ru: 'Локальная платежная система Таджикистана', en: 'Local payment system of Tajikistan' },
    'btn_back': { ru: 'Назад', en: 'Back' },
    'btn_pay': { ru: 'Оплатить', en: 'Pay' },

    // Страница выбора оплаты (Payment Selection)
    'ps_title': { ru: 'Выбор способа оплаты', en: 'Payment Method Selection' },
    'ps_subtitle': { ru: 'Заказ успешно создан. Выберите способ оплаты для завершения', en: 'Order created successfully. Select a payment method to complete' },
    'ps_order_info': { ru: 'Информация о заказе', en: 'Order Information' },
    'ps_order_number': { ru: 'Номер заказа:', en: 'Order Number:' },
    'ps_service_type': { ru: 'Тип услуги:', en: 'Service Type:' },
    'ps_amount_label': { ru: 'Сумма к оплате', en: 'Amount Due' },
    'ps_choose_method': { ru: 'Выберите способ оплаты', en: 'Choose Payment Method' },
    'ps_alif_desc': { ru: 'Банковские карты Таджикистана', en: 'Tajikistan bank cards' },
    'ps_back_home': { ru: 'Вернуться на главную', en: 'Back to Home' },
    'ps_type_guide': { ru: 'Найм тургида', en: 'Guide Hire' },
    'ps_type_transfer': { ru: 'Трансфер', en: 'Transfer' },
    'ps_type_tour': { ru: 'Тур', en: 'Tour' },
    'ps_type_service': { ru: 'Услуга', en: 'Service' },
    'ps_no_order': { ru: 'Номер заказа не найден. Перенаправляем на главную...', en: 'Order number not found. Redirecting to home...' },
    'ps_error_no_order': { ru: 'Ошибка: номер заказа не найден', en: 'Error: order number not found' },
    'ps_error_no_url': { ru: 'Ошибка: URL оплаты не получен', en: 'Error: payment URL not received' },
    'ps_error_create': { ru: 'Ошибка создания платежа: ', en: 'Payment creation error: ' },
    'ps_error_init': { ru: 'Произошла ошибка при инициализации оплаты', en: 'An error occurred while initializing payment' },
    
    // Страница заказа собственного тура (Custom Tour Order)
    'custom_tour_page_title': { ru: 'Создать собственный тур - Bunyod-Tour', en: 'Create Custom Tour - Bunyod-Tour' },
    'custom_tour_main_title': { ru: 'Создать собственный тур', en: 'Create Custom Tour' },
    'custom_tour_main_subtitle': { ru: 'Создайте уникальный тур под ваши требования. Выберите страны, города и услуги.', en: 'Create a unique tour tailored to your needs. Select countries, cities, and services.' },
    'custom_tour_form_title': { ru: 'Заказать собственный тур', en: 'Order Custom Tour' },
    'custom_tour_form_subtitle': { ru: 'Заполните форму и мы создадим для вас идеальный тур', en: 'Fill out the form and we will create the perfect tour for you' },
    'custom_tour_contact_info': { ru: 'Контактная информация', en: 'Contact Information' },
    'custom_tour_fullname': { ru: 'ФИО', en: 'Full Name' },
    'custom_tour_email': { ru: 'Email', en: 'Email' },
    'custom_tour_phone': { ru: 'Телефон', en: 'Phone' },
    'custom_tour_destinations': { ru: 'Направления', en: 'Destinations' },
    'custom_tour_select_countries': { ru: 'Выберите страны', en: 'Select Countries' },
    'custom_tour_select_cities': { ru: 'Выберите города (опционально)', en: 'Select Cities (optional)' },
    'custom_tour_tourists_list': { ru: 'Список туристов', en: 'Tourists List' },
    'custom_tour_tourist_name': { ru: 'ФИО туриста', en: 'Tourist Full Name' },
    'custom_tour_add_tourist': { ru: 'Добавить туриста', en: 'Add Tourist' },
    'custom_tour_tourists_required': { ru: 'Необходимо добавить хотя бы одного туриста', en: 'At least one tourist is required' },
    'custom_tour_components': { ru: 'Компоненты тура', en: 'Tour Components' },
    'custom_tour_components_hint': { ru: 'Выберите необходимые услуги и количество', en: 'Select required services and quantity' },
    'custom_tour_notes': { ru: 'Ваши пожелания и комментарии', en: 'Your Wishes and Comments' },
    'custom_tour_total_price': { ru: 'Предварительная цена', en: 'Estimated Price' },
    'custom_tour_price_note': { ru: 'Окончательная цена будет рассчитана после обработки вашей заявки', en: 'Final price will be calculated after processing your request' },
    'custom_tour_submit_btn': { ru: 'Оплатить', en: 'Pay' },
    'custom_tour_submit_sending': { ru: 'Отправляется...', en: 'Sending...' },
    'custom_tour_duration_title': { ru: 'Продолжительность тура', en: 'Tour Duration' },
    'custom_tour_days_label': { ru: 'Количество дней', en: 'Number of Days' },
    'custom_tour_days_hint': { ru: 'Один день тура — это до 10 часов обслуживания. Это не значит, что услуги предоставляются все 10 часов: день считается завершённым, когда выполнена программа тура. Поэтому один день может занять как 1–2 часа, так и все 9–10.', en: 'One tour day means up to 10 hours of service. It does not mean that services are provided for the whole day: the day ends once the tour programme is complete. So a single day may take 1–2 hours or a full 9–10 hours.' },
    'custom_tour_specify_days_first': { ru: 'Сначала укажите количество дней тура', en: 'Please specify the number of tour days first' },
    'custom_tour_validation_warning': { ru: 'При {days} днях можно выбрать максимум {maxCountries} {countryWord}. Для {neededCountries} {neededCountryWord} нужно минимум {minDays} дней.', en: 'With {days} days you can select maximum {maxCountries} {countryWord}. For {neededCountries} {neededCountryWord} you need at least {minDays} days.' },
    'custom_tour_country_1': { ru: 'страну', en: 'country' },
    'custom_tour_country_2_4': { ru: 'страны', en: 'countries' },
    'custom_tour_country_5plus': { ru: 'стран', en: 'countries' },

    // Подсказка в разделе «Компоненты тура»
    'custom_tour_components_note': { ru: 'Вы можете выбрать несколько достопримечательностей, которые хотели бы посетить. Любые другие пожелания укажите ниже, в разделе «Ваши пожелания и комментарии».', en: 'You can select several attractions you would like to visit. Any other preferences can be described below, in the "Your Wishes and Comments" section.' },

    // Блок «Нужна только одна услуга?» — гид и трансфер отдельно
    'custom_tour_separate_services_title': { ru: 'Нужна только одна услуга?', en: 'Need just one service?' },
    'custom_tour_guide_only_title': { ru: 'Нужен только гид?', en: 'Only need a guide?' },
    'custom_tour_guide_only_text': { ru: 'Гида можно нанять отдельно, без оформления тура. Выберите гида по городу, языку и специализации.', en: 'You can hire a guide separately, without booking a full tour. Choose a guide by city, language and specialisation.' },
    'custom_tour_guide_only_btn': { ru: 'Нанять гида', en: 'Hire a guide' },
    'custom_tour_transfer_only_title': { ru: 'Нужен только трансфер?', en: 'Only need a transfer?' },
    'custom_tour_transfer_only_text': { ru: 'Трансфер можно заказать отдельно — выберите маршрут, класс автомобиля и дату поездки, без оформления тура.', en: 'You can order a transfer separately — pick the route, the vehicle class and the travel date, without booking a full tour.' },
    'custom_tour_transfer_only_btn': { ru: 'Заказать трансфер', en: 'Order a transfer' },

    // Плейсхолдеры для формы заказа тура
    'custom_tour_fullname_placeholder': { ru: 'Введите ваше полное имя', en: 'Enter your full name' },
    'custom_tour_email_placeholder': { ru: 'your@email.com', en: 'your@email.com' },
    'custom_tour_phone_placeholder': { ru: '+992 XX XXX XXXX', en: '+992 XX XXX XXXX' },
    'custom_tour_days_placeholder': { ru: 'Например: 7', en: 'For example: 7' },
    'custom_tour_tourist_name_placeholder': { ru: 'Введите имя и нажмите \'Добавить\'', en: 'Enter name and click \'Add\'' },
    'custom_tour_notes_placeholder': { ru: 'Расскажите нам о ваших предпочтениях, особых требованиях...', en: 'Tell us about your preferences, special requirements...' },
    'custom_tour_select_countries_hint': { ru: 'Выберите страны выше, чтобы увидеть доступные компоненты', en: 'Select countries above to see available components' },
    'custom_tour_select_cities_hint': { ru: 'Выберите страны, чтобы увидеть города', en: 'Select countries to see cities' },
    'custom_tour_remove': { ru: 'Удалить', en: 'Remove' },
    
    // Сообщения валидации и уведомления
    'custom_tour_error_no_countries': { ru: 'Выберите хотя бы одну страну', en: 'Select at least one country' },
    'custom_tour_error_no_tourists': { ru: 'Добавьте хотя бы одного туриста', en: 'Add at least one tourist' },
    'custom_tour_error_no_components': { ru: 'Выберите хотя бы один компонент тура', en: 'Select at least one tour component' },
    'custom_tour_error_min_days': { ru: 'Укажите количество дней тура — минимум 1 день', en: 'Please specify the tour duration — at least 1 day' },
    'custom_tour_success_message': { ru: 'Заказ успешно отправлен! Мы свяжемся с вами в ближайшее время.', en: 'Order successfully submitted! We will contact you shortly.' },
    'custom_tour_error_submit': { ru: 'Ошибка при отправке заказа', en: 'Error submitting order' },
    'custom_tour_error_try_later': { ru: 'Ошибка при отправке заказа. Попробуйте позже.', en: 'Error submitting order. Please try again later.' },
    
    // Ценовые обозначения
    'price.from': { ru: 'Цена от:', en: 'Price from:' },
    'price.from_prefix': { ru: 'от', en: 'from' },
    'price.per_person': { ru: 'за человека', en: 'per person' },
    'price.per_group': { ru: 'за группу', en: 'per group' },
    'price.days': { ru: 'дней', en: 'days' },
    'price.day': { ru: 'день', en: 'day' },
    
    // Временные метки
    'time.days': { ru: 'дней', en: 'days' },
    'time.day': { ru: 'день', en: 'day' },
    'time.years': { ru: 'лет', en: 'years' },
    'time.year': { ru: 'год', en: 'year' },
    
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
    
    // Услуги и заголовки секций
    'service.tours': { ru: 'Туры и экскурсии', en: 'Tours & Excursions' },
    'service.transfer': { ru: 'Трансфер', en: 'Transfer Service' },
    'service.guide': { ru: 'Гид-сопровождение', en: 'Guide Service' },
    'service.agency': { ru: 'Турагентство', en: 'Travel Agency' },
    'service.transfer_title': { ru: 'ТРАНСФЕР', en: 'TRANSFER' },
    'service.guides_title': { ru: 'ТУР-ГИДЫ', en: 'TOUR GUIDES' },
    'service.agency_title': { ru: 'B2B ПАРТНЕРСТВО', en: 'B2B PARTNERSHIP' },
    'service.custom_tour_title': { ru: 'СОБСТВЕННЫЙ ТУР', en: 'CUSTOM TOUR' },
    
    // Гиды - карточки и метки
    'guide.languages': { ru: 'языки', en: 'languages' },
    'guide.years': { ru: 'лет', en: 'years' },
    'guide.rating': { ru: 'рейтинг', en: 'rating' },
    'guide.hire': { ru: 'Нанять гида', en: 'Hire Guide' },
    'guide.more_details': { ru: 'Подробная информация', en: 'More Details' },
    'guide.professional': { ru: 'Профессиональный гид', en: 'Professional Guide' },
    'guide.professional_badge': { ru: 'Профессиональный гид', en: 'Professional Guide' },
    
    // Подвал сайта
    'footer.contact_info': { ru: 'Контактная информация', en: 'Contact Information' },
    'footer.quick_links': { ru: 'Быстрые ссылки', en: 'Quick Links' },
    'footer.social_media': { ru: 'Социальные сети', en: 'Social Media' },
    'footer.our_location': { ru: 'Наше местоположение:', en: 'Our Location:' },
    
    // Фильтры
    'filters.title': { ru: 'Фильтры поиска', en: 'Search Filters' },
    'filters.search_filters': { ru: '🔍 Фильтры поиска', en: '🔍 Search Filters' },
    'filters.destination': { ru: 'Направление', en: 'Destination' },
    'filter.country': { ru: 'Страна', en: 'Country' },
    'filter.city': { ru: 'Город', en: 'City' },
    'filter.tour_type': { ru: 'Тип тура', en: 'Tour Type' },
    'filter.category': { ru: 'Категория', en: 'Category' },
    'filter.date': { ru: 'Дата', en: 'Date' },
    'filter.hotel_brand': { ru: 'Бренд отеля', en: 'Hotel Brand' },
    'filter.hotel_stars': { ru: 'Звезды отеля', en: 'Hotel Stars' },
    
    // Модальное окно локации
    'location.details': { ru: 'Локация тура', en: 'Tour Location' },
    'location.countries': { ru: 'Страны', en: 'Countries' },
    'location.cities': { ru: 'Города', en: 'Cities' },
    
    // Формы
    'form.country': { ru: 'Страна', en: 'Country' },
    
    // Страны  
    'country.tajikistan': { ru: 'Таджикистан', en: 'Tajikistan' },
    'country.uzbekistan': { ru: 'Узбекистан', en: 'Uzbekistan' },
    'country.kyrgyzstan': { ru: 'Кыргызстан', en: 'Kyrgyzstan' },
    'country.turkmenistan': { ru: 'Туркменистан', en: 'Turkmenistan' },
    
    // Общие элементы
    'common.loading': { ru: 'Загрузка...', en: 'Loading...' },
    'common.no_results': { ru: 'Результаты не найдены', en: 'No results found' },
    'common.error': { ru: 'Произошла ошибка', en: 'An error occurred' },
    'common.success': { ru: 'Успешно!', en: 'Success!' },
    'common.show_all_tours': { ru: 'Показать все туры', en: 'Show All Tours' },
    'common.clear_search': { ru: 'Очистить поиск', en: 'Clear Search' },
    'common.save': { ru: 'Сохранить', en: 'Save' },
    'common.cancel': { ru: 'Отмена', en: 'Cancel' },
    'common.edit': { ru: 'Редактировать', en: 'Edit' },
    'common.delete': { ru: 'Удалить', en: 'Delete' },
    'common.add': { ru: 'Добавить', en: 'Add' },
    'common.create': { ru: 'Создать', en: 'Create' },
    'common.ok': { ru: 'Понятно', en: 'Got it' },
    
    // Placeholders для форм и поиска
    'placeholder.search_tours': { ru: 'Поиск туров...', en: 'Search tours...' },
    'placeholder.search_perfect_tour': { ru: 'Найдите идеальный тур: Памир, Искандеркуль, треккинг...', en: 'Find the perfect tour: Pamir, Iskanderkul, trekking...' },
    'placeholder.select_date': { ru: 'Выберите дату', en: 'Select date' },
    'placeholder.enter_name': { ru: 'Введите ваше имя', en: 'Enter your name' },
    'placeholder.enter_email': { ru: 'Введите email', en: 'Enter email' },
    'placeholder.enter_phone': { ru: 'Введите телефон', en: 'Enter phone' },
    'placeholder.enter_message': { ru: 'Введите сообщение', en: 'Enter message' },

    // === ИНФОРМАЦИОННЫЙ БАННЕР ===
    'banner.welcome_text': { 
        ru: 'Добро пожаловать в Онлайн-портал туристических услуг в Центральной Азии и Таджикистана! Бронируйте туры картами Visa/Mastercard с предоплатой 10% или 25%. Остаток — в первый день тура или ранее.', 
        en: 'Welcome to the Online Travel Services Portal for Central Asia and Tajikistan! Book tours with Visa/Mastercard with a 10% or 25% deposit. The remaining balance can be paid on the first day of the tour or earlier.' 
    },
    'banner.payment_title': {
        ru: 'e-Booking система для туров',
        en: 'e-Booking system for Tours'
    },
    'banner.payment_description': {
        ru: 'Вы можете забронировать туры, используя карты Visa или Mastercard, оплатив 10% или 25% от стоимости тура авансом, а остальную сумму — в первый день тура.',
        en: 'You can book tours using Visa or Mastercard by paying 10% or 25% of the tour cost in advance, with the remaining balance due on the first day of the tour.'
    },
    'banner.payment_description_short': {
        ru: 'Visa/Mastercard: оплата 10% или 25% авансом, остаток — в первый день тура',
        en: 'Visa/Mastercard: 10% or 25% advance payment, balance on tour day'
    },
    
    // === ЗАГОЛОВКИ СТРАНИЦ ===
    'page.title': { ru: 'Bunyod-Tour - Туры по Таджикистану', en: 'Bunyod-Tour - Tours in Tajikistan' },
    'hotel.catalog_title': { ru: 'Каталог отелей', en: 'Hotels Catalog' },
    'hotel.catalog_subtitle': { ru: 'Выберите идеальное место для вашего отдыха', en: 'Choose the perfect place for your stay' },
    'tours.page_title': { ru: 'Поиск туров - Bunyod-Tour', en: 'Search Tours - Bunyod-Tour' },
    'tour.page_title': { ru: 'Тур - Bunyod-Tour', en: 'Tour - Bunyod-Tour' },
    'hotel.catalog_description': { ru: 'Найдите идеальное размещение для вашего путешествия по Центральной Азии', en: 'Find the perfect accommodation for your Central Asia journey' },
    
    // Категории отелей
    'hotel.category_luxury': { ru: 'Люкс', en: 'Luxury' },
    'hotel.category_premium': { ru: 'Премиум', en: 'Premium' },
    'hotel.category_budget': { ru: 'Бюджетный', en: 'Budget' },
    
    // Поиск и сообщения отелей
    'hotel.search_placeholder': { ru: 'Название отеля...', en: 'Hotel name...' },
    'hotel.no_hotels_found': { ru: 'Отели не найдены', en: 'No hotels found' },
    'hotel.try_different_filters': { ru: 'Попробуйте изменить фильтры поиска', en: 'Try adjusting your search filters' },
    
    // Фильтры отелей - специфичные для модуля отелей
    'hotel.search_filters': { ru: 'Фильтры поиска', en: 'Search Filters' },
    'hotel.country': { ru: 'Страна', en: 'Country' },
    'hotel.all_countries': { ru: 'Все страны', en: 'All Countries' },
    'hotel.category': { ru: 'Категория', en: 'Category' },
    'hotel.all_categories': { ru: 'Все категории', en: 'All Categories' },
    'hotel.stars': { ru: 'Звезды', en: 'Stars' },
    'hotel.any_quantity': { ru: 'Любое количество', en: 'Any Rating' },
    'hotel.search': { ru: 'Поиск', en: 'Search' },
    'hotel.clear_filters': { ru: 'Очистить фильтры', en: 'Clear Filters' },
    'hotel.showing_results': { ru: 'Показано отелей:', en: 'Showing hotels:' },
    'hotel.showing_results_template': { ru: 'Показано {count} из {total} отелей', en: 'Showing {count} of {total} hotels' },
    
    // === ТРАНСПОРТ (VEHICLES) ===
    'vehicles.page_title': { ru: 'Каталог транспорта - Bunyod-Tour', en: 'Vehicles Catalog - Bunyod-Tour' },
    'vehicles.catalog_title': { ru: 'Каталог транспорта', en: 'Vehicles Catalog' },
    'vehicles.catalog_subtitle': { ru: 'Выберите идеальный транспорт для вашего путешествия', en: 'Choose the perfect vehicle for your journey' },
    'vehicles.filters_title': { ru: 'Фильтры', en: 'Filters' },
    
    // Типы транспорта
    'vehicles.type': { ru: 'Тип транспорта', en: 'Vehicle Type' },
    'vehicles.all_types': { ru: 'Все типы', en: 'All Types' },
    'vehicles.type_sedan': { ru: 'Седан', en: 'Sedan' },
    'vehicles.type_suv': { ru: 'Внедорожник', en: 'SUV' },
    'vehicles.type_minibus': { ru: 'Микроавтобус', en: 'Minibus' },
    'vehicles.type_bus': { ru: 'Автобус', en: 'Bus' },
    'vehicles.type_minivan': { ru: 'Минивэн', en: 'Minivan' },
    'vehicles.type_luxury': { ru: 'Люкс', en: 'Luxury' },
    
    // Фильтры
    'vehicles.country': { ru: 'Страна', en: 'Country' },
    'vehicles.all_countries': { ru: 'Все страны', en: 'All Countries' },
    'vehicles.capacity': { ru: 'Вместимость', en: 'Capacity' },
    'vehicles.capacity_any': { ru: 'Любая', en: 'Any' },
    'vehicles.capacity_1_4': { ru: '1-4 пассажира', en: '1-4 passengers' },
    'vehicles.capacity_5_8': { ru: '5-8 пассажиров', en: '5-8 passengers' },
    'vehicles.capacity_9_15': { ru: '9-15 пассажиров', en: '9-15 passengers' },
    'vehicles.capacity_16_plus': { ru: '16+ пассажиров', en: '16+ passengers' },
    'vehicles.search_placeholder': { ru: 'Марка, номер...', en: 'Brand, license plate...' },
    'vehicles.clear_filters': { ru: 'Очистить фильтры', en: 'Clear Filters' },
    'vehicles.found_count': { ru: 'Найдено 0 из 0 транспорта', en: 'Found 0 of 0 vehicles' },
    'vehicles.found_template': { ru: 'Найдено {count} из {total} транспорта', en: 'Found {count} of {total} vehicles' },
    
    // Сообщения
    'vehicles.no_vehicles': { ru: 'Транспорт не найден', en: 'No vehicles found' },
    'vehicles.try_change_filters': { ru: 'Попробуйте изменить фильтры поиска', en: 'Try changing search filters' },
    'vehicles.loading': { ru: 'Загрузка транспорта...', en: 'Loading vehicles...' },
    
    // Карточка транспорта
    'vehicles.price_per_day': { ru: 'Цена за день', en: 'Price per day' },
    'vehicles.per_day': { ru: 'за день', en: 'per day' },
    'vehicles.passengers': { ru: 'пассажиров', en: 'passengers' },
    'vehicles.contact': { ru: 'Связаться', en: 'Contact' },
    'vehicles.license_plate': { ru: 'Гос. номер', en: 'License Plate' },
    'vehicles.year': { ru: 'Год выпуска', en: 'Year' },
    'vehicles.brand': { ru: 'Марка', en: 'Brand' },
    
    // Фильтры отелей
    'filters.country': { ru: 'Страна', en: 'Country' },
    'filters.all_countries': { ru: 'Все страны', en: 'All Countries' },
    'filters.category': { ru: 'Категория', en: 'Category' },
    'filters.all_categories': { ru: 'Все категории', en: 'All Categories' },
    'filters.stars': { ru: 'Звезды', en: 'Stars' },
    'filters.any_stars': { ru: 'Любое количество', en: 'Any Rating' },
    'filters.five_stars': { ru: '5 звезд', en: '5 Stars' },
    'filters.four_stars': { ru: '4 звезды', en: '4 Stars' },
    'filters.three_stars': { ru: '3 звезды', en: '3 Stars' },
    'filters.two_stars': { ru: '2 звезды', en: '2 Stars' },
    'filters.one_star': { ru: '1 звезда', en: '1 Star' },
    'filters.search': { ru: 'Поиск', en: 'Search' },
    'filters.availability_calendar': { ru: 'Календарь доступности', en: 'Availability Calendar' },
    
    // Кнопки каталога отелей
    'btn.clear_filters': { ru: 'Очистить фильтры', en: 'Clear Filters' },
    
    // Ключи для tour-template.html
    'tour.duration_label': { ru: 'Длительность:', en: 'Duration:' },
    'tour.meals_not_included': { ru: 'Приём не включен', en: 'Meals Not Included' },
    'tour.languages_label': { ru: 'Языки:', en: 'Languages:' },
    'tour.type_label': { ru: 'Тип:', en: 'Type:' },
    'tour.meeting_point': { ru: 'Место сбора:', en: 'Meeting point:' },
    'tour.reviews': { ru: 'Отзывы', en: 'Reviews' },
    'tour.loading_reviews': { ru: 'Загрузка отзывов...', en: 'Loading reviews...' },
    'tour.similar_tours': { ru: 'Похожие туры', en: 'Similar Tours' },
    'tour.loading_similar': { ru: 'Загрузка похожих туров...', en: 'Loading similar tours...' },
    'tour.no_similar_tours': { ru: 'Похожих туров не найдено', en: 'No similar tours found' },
    'tour.from': { ru: 'от', en: 'from' },
    'tour.price_per_person': { ru: 'за человека', en: 'per person' },
    'tour.price_per_group': { ru: 'за группу', en: 'per group' },
    'tour.included': { ru: 'Включено:', en: 'Included:' },
    'tour.not_included': { ru: 'Не включено:', en: 'Not Included:' },
    'tour.whats_included_title': { ru: 'Что входит в комплект', en: 'What\'s Included' },
    'tour.show_more_services': { ru: 'Смотрите еще', en: 'Show more' },
    'tour.tab.description': { ru: 'Описание тура', en: 'Tour Description' },
    'tour.tab.program': { ru: 'Программа тура', en: 'Tour Program' },
    'tour.tab.map': { ru: 'Карта Тура', en: 'Tour Map' },
    'tour.day': { ru: 'День', en: 'Day' },
    'tour.stop_singular': { ru: 'Остановка', en: 'Stop' },
    'tour.stops_few': { ru: 'Остановки', en: 'Stops' },
    'tour.stops_many': { ru: 'Остановок', en: 'Stops' },
    'tour.ticket_included': { ru: 'Входной билет включен в стоимость', en: 'Entrance ticket included in price' },
    'tour.program_day': { ru: 'Программа дня', en: 'Day Program' },
    
    // Заголовки страниц
    'hotel.page_title': { ru: 'Каталог отелей - Bunyod-Tour', en: 'Hotels Catalog - Bunyod-Tour' },
    'guides.page_title': { ru: 'Тургиды - Bunyod-Tour', en: 'Tour Guides - Bunyod-Tour' },
    
    // Звезды отелей
    'hotel.5_stars': { ru: '5 звезд', en: '5 Stars' },
    'hotel.4_stars': { ru: '4 звезды', en: '4 Stars' },
    'hotel.3_stars': { ru: '3 звезды', en: '3 Stars' },
    'hotel.2_stars': { ru: '2 звезды', en: '2 Stars' },
    'hotel.1_star': { ru: '1 звезда', en: '1 Star' },
    
    // Страница гидов
    'guides.main_title': { ru: 'Профессиональные тургиды Центральной Азии', en: 'Professional Tour Guides of Central Asia' },
    'guides.subtitle': { ru: 'Откройте сокровища Центральной Азии с нашими опытными гидами', en: 'Discover the treasures of Central Asia with our experienced guides' },
    'guides.licensed_guides': { ru: 'Лицензированные гиды', en: 'Licensed Guides' },
    'guides.happy_clients': { ru: 'Более 1000 довольных клиентов', en: 'Over 1000 Happy Clients' },
    'guides.multilingual_support': { ru: 'Многоязычная поддержка', en: 'Multilingual Support' },
    'guides.coming_soon': { ru: 'Скоро здесь появятся наши тургиды', en: 'Our tour guides will appear here soon' },
    'guides.forming_team': { ru: 'Мы формируем команду профессиональных гидов для создания незабываемых путешествий', en: 'We are forming a team of professional guides to create unforgettable journeys' },
    'guides.hire_guide': { ru: 'Нанять тургида', en: 'Hire Guide' },
    'guides.select_dates': { ru: 'Выберите даты', en: 'Select Dates' },
    'guides.selected': { ru: 'Выбрано', en: 'Selected' },
    'guides.available': { ru: 'Доступно', en: 'Available' },
    'guides.occupied': { ru: 'Занято', en: 'Occupied' },
    'guides.unavailable': { ru: 'Недоступно', en: 'Unavailable' },
    'guides.cost_calculation': { ru: 'Расчет стоимости', en: 'Cost Calculation' },
    'guides.price_per_day': { ru: 'Цена за день:', en: 'Price per day:' },
    'guides.selected_days': { ru: 'Выбрано дней:', en: 'Selected days:' },
    'guides.total': { ru: 'Итого:', en: 'Total:' },
    'guides.your_data': { ru: 'Ваши данные', en: 'Your Details' },
    'guides.proceed_to_payment': { ru: 'Перейти к оплате', en: 'Proceed to Payment' },
    
    // Календарь - короткие названия дней
    'calendar.mon': { ru: 'Пн', en: 'Mon' },
    'calendar.tue': { ru: 'Вт', en: 'Tue' },
    'calendar.wed': { ru: 'Ср', en: 'Wed' },
    'calendar.thu': { ru: 'Чт', en: 'Thu' },
    'calendar.fri': { ru: 'Пт', en: 'Fri' },
    'calendar.sat': { ru: 'Сб', en: 'Sat' },
    'calendar.sun': { ru: 'Вс', en: 'Sun' },
    
    // Календарь - полные названия дней
    'calendar.monday': { ru: 'Понедельник', en: 'Monday' },
    'calendar.tuesday': { ru: 'Вторник', en: 'Tuesday' },
    'calendar.wednesday': { ru: 'Среда', en: 'Wednesday' },
    'calendar.thursday': { ru: 'Четверг', en: 'Thursday' },
    'calendar.friday': { ru: 'Пятница', en: 'Friday' },
    'calendar.saturday': { ru: 'Суббота', en: 'Saturday' },
    'calendar.sunday': { ru: 'Воскресенье', en: 'Sunday' },
    
    // Формы бронирования
    'form.check_dates': { ru: 'Проверить доступные даты', en: 'Check Available Dates' },
    'form.travelers_count': { ru: 'Количество туристов', en: 'Number of Travelers' },
    'form.one_adult': { ru: '1 взрослый', en: '1 Adult' },
    'form.adults': { ru: 'взрослых', en: 'adults' },
    'form.one_child': { ru: 'ребенок', en: 'child' },
    'form.children': { ru: 'детей', en: 'children' },
    
    // Короткие обозначения туристов (для booking)
    'booking.adults_short': { ru: 'взр.', en: 'ad.' },
    'booking.children_short': { ru: 'дет.', en: 'ch.' },
    
    // Особенности бронирования
    'booking.free_cancellation': { ru: 'Бесплатная отмена', en: 'Free Cancellation' },
    'booking.cancellation_terms': { ru: 'Бесплатная отмена и полный возврат средств за 30 дней до начала тура (по местному времени, UTC +5)', en: 'Free cancellation and full refund up to 30 days before the tour starts (local time, UTC +5)' },
    'booking.cancellation_special_notes': { ru: 'Другие требования указаны в разделе «Особые примечания», пункт 16.', en: 'Other requirements are specified in the Special Notes section, item 16.' },
    'booking.book_now_pay_later': { ru: 'Бронируй сейчас - плати потом', en: 'Book Now - Pay Later' },
    'booking.reserve_flexibility': { ru: 'Забронируйте тур за 30 дней до его начала и получите возможность оплатить сейчас только 10% от его стоимости а оставшиеся 90% перед началом тура', en: 'Book a tour 30 days before it starts and get the opportunity to pay only 10% of its cost now and the remaining 90% before the tour starts' },
    'booking.book_now_pay_later_details': { ru: 'Бронируй сейчас — плати позже, за 72 часа до начала тура или в первый день тура (по местному времени, UTC +5)', en: 'Book now - pay later, 72 hours before the tour starts or on the first day of the tour (local time, UTC +5)' },
    
    // Типы оплаты для групповых туров (30+ дней)
    'booking.payment_option_title': { ru: 'Шаг 1. Выберите условия оплаты', en: 'Step 1. Choose Payment Terms' },
    'booking.payment_full': { ru: 'Полная оплата', en: 'Full Payment' },
    'booking.payment_full_desc': { ru: 'Оплатить 100% стоимости тура', en: 'Pay 100% of the tour cost' },
    'booking.payment_deposit': { ru: 'Бронируй сейчас - плати потом (10%)', en: 'Book Now - Pay Later (10%)' },
    'booking.payment_deposit_desc': { ru: 'Оплатить 10% от общей стоимости тура сейчас и 90% остатка перед началом тура', en: 'Pay 10% of the total tour cost now and 90% of the balance before the tour starts' },
    'booking.payment_deposit_25': { ru: 'Депозит 25%', en: 'Deposit 25%' },
    'booking.payment_deposit_25_desc': { ru: 'Оплатить 25% от общей стоимости тура сейчас и 75% остатка перед началом тура', en: 'Pay 25% of the total tour cost now and 75% of the balance before the tour starts' },
    'booking.tour_total': { ru: 'Итого за тур:', en: 'Tour Total:' },
    'booking.deposit_now_10': { ru: 'Депозит (10%) — к оплате сейчас:', en: 'Deposit (10%) — pay now:' },
    'booking.deposit_now_25': { ru: 'Депозит (25%) — к оплате сейчас:', en: 'Deposit (25%) — pay now:' },
    'booking.remainder_90': { ru: 'Остаток (90%):', en: 'Remainder (90%):' },
    'booking.remainder_75': { ru: 'Остаток (75%):', en: 'Remainder (75%):' },
    'booking.pay_before_tour': { ru: 'Оплата перед началом тура', en: 'Payment before tour start' },
    'booking.deposit_badge_10_desc': { ru: 'Оплата 10% сейчас, 90% перед началом тура', en: 'Pay 10% now, 90% before tour start' },
    'booking.deposit_badge_25_desc': { ru: 'Оплата 25% сейчас, 75% перед началом тура', en: 'Pay 25% now, 75% before tour start' },
    'booking.full_payment_desc': { ru: '100% оплата сейчас', en: '100% payment now' },
    'booking.step1_instruction': { ru: 'После выбора условий оплаты выше, переходите к Шагу 2 для выбора способа оплаты', en: 'After selecting payment terms above, proceed to Step 2 to choose payment method' },
    'booking.cash_notice_title': { ru: 'Внимание:', en: 'Attention:' },
    'booking.cash_notice_text': { ru: 'Остаток оплаты производится наличными в национальной валюте в первый день тура.', en: 'The remaining balance is paid in cash in national currency on the first day of the tour.' },
    'booking.payment_free_cancel': { ru: 'Бесплатная отмена', en: 'Free Cancellation' },
    'booking.payment_free_cancel_desc': { ru: 'Отмена тура со стороны Туриста в срок до 30 календарных дней до даты (время) начала тура. В этом случае возврат средств будет осуществляться на 100%. Однако, данный бонус (возможность) не распространяется на те туры которые бронировались в течении 30 дней до начала тура!', en: 'Tour cancellation by the Tourist up to 30 calendar days before the tour start date (time). In this case, a 100% refund will be made. However, this bonus (opportunity) does not apply to tours booked within 30 days of the tour start!' },
    
    // Cancellation Policy (for "Free Cancellation" button)
    'booking.cancellation_policy_title': { ru: 'ПОЛИТИКА ОТМЕНЫ', en: 'CANCELLATION POLICY' },
    'booking.cancel_point_1': { ru: 'Бесплатная отмена бронированного тура (всех видов тура) и полный возврат средств возможен за 30 дней до начала тура (по местному времени, UTC +5). В этом случае возврат денежных средств производится в размере 100%.', en: 'Free cancellation of a booked tour (all types of tours) and a full refund are possible 30 days before the start of the tour (local time, UTC +5). In this case, a 100% refund will be made.' },
    'booking.cancel_point_2': { ru: 'Однако данная бонусная опция не распространяется на тех, кто забронировал тур в течение этого периода (в период 30 дней до начало тура).', en: 'However, this bonus option does not apply to those who booked a tour during this period (within 30 days before the start of the tour).' },
    'booking.cancel_point_3': { ru: 'При отмене тура менее чем за 30 дней до его начала уплаченная сумма возвращается за вычетом депозита.', en: 'If the tour is cancelled less than 30 days before its start, the amount paid will be refunded minus the deposit.' },
    'booking.cancel_point_4': { ru: 'Внесение любых изменений в турпродукт или иные условия Заявки на бронирование допускается по соглашению Сторон не позднее, чем за 48 часов до начала тура.', en: 'Any changes to the tour product or other conditions of the Booking Request are permitted by agreement of the Parties no later than 48 hours before the start of the tour.' },
    
    // Early Booking Policy (for "Book Now - Pay Later" button)
    'booking.early_booking_policy_title': { ru: 'ПОЛИТИКА РАННЕЕ БРОНИРОВАНИЕ', en: 'EARLY BOOKING POLICY' },
    'booking.early_point_1': { ru: 'Бронируй сейчас — плати позже, за 72 часа до начала тура или в первый день тура.', en: 'Book now - pay later, 72 hours before the tour start or on the first day of the tour.' },
    'booking.early_point_2': { ru: 'Туристы, которые бронируют (регистрируются) заранее на групповой общий тур, могут внести депозит всего в размере 10% от стоимости тура, чтобы записаться на тур', en: 'Tourists who book (register) in advance for a group shared tour can make a deposit of just 10% of the tour cost to sign up for the tour' },
    'booking.early_point_3': { ru: 'Баланс суммы (90%) необходимо оплатить за 72 часа до начала тура (доступными методами оплаты) или в первый день тура (наличными)', en: 'The balance (90%) should be paid due 72 hours before the tour start (via accepted payment methods) or on the first day of the tour (in cash).' },
    'booking.early_point_4': { ru: 'Однако, регистрация (запись) должна быть завершена не позднее, чем за 30 дней до начала тура.', en: 'However, registration (booking) must be completed no later than 30 days before the tour start.' },
    'booking.early_point_5': { ru: 'Внесение любых изменений в турпродукт или иные условия Заявки на бронирование допускается по соглашению Сторон не позднее, чем за 48 часов до начала тура.', en: 'Any changes to the tour product or other conditions of the Booking Request are permitted by agreement of the Parties no later than 48 hours before the start of the tour.' },
    'booking.book_ahead': { ru: 'Бронируйте заранее!', en: 'Book Ahead!' },
    'booking.average_notice': { ru: 'В среднем этот тур бронируют за 20 дней.', en: 'On average, this tour is booked 20 days in advance.' },
    'booking.tour_start_time': { ru: 'Время начала тура', en: 'Tour Start Time' },
    
    // Возрастные категории
    'form.adults_age': { ru: 'Взрослые (от 9 лет)', en: 'Adults (9+ years)' },
    'form.children_age': { ru: 'Ребёнок (до 8 лет)', en: 'Children (up to 8 years)' },
    'form.infants_age': { ru: 'Младенцы (0-2 лет)', en: 'Infants (0-2 years)' },
    'form.max_travelers_note': { ru: 'Вы можете выбрать до 15 туристов всего', en: 'You can select up to 15 travelers total' },
    'form.min': { ru: 'Минимум', en: 'Minimum' },
    'form.max': { ru: 'Максимум', en: 'Maximum' },
    
    // Навигация и breadcrumbs
    'breadcrumb.home': { ru: 'Главная', en: 'Home' },
    'breadcrumb.popular_tours': { ru: 'Популярные туры', en: 'Popular Tours' },
    'breadcrumb.central_asia': { ru: 'Туры по Центральной Азии', en: 'Central Asia Tours' },
    'breadcrumb.tajikistan': { ru: 'Туры по Таджикистану', en: 'Tajikistan Tours' },
    'breadcrumb.mountain_tours': { ru: 'Горные туры', en: 'Mountain Tours' },
    'breadcrumb.historical_tours': { ru: 'Исторические туры', en: 'Historical Tours' },
    
    // Страны Центральной Азии
    'country.uzbekistan': { ru: 'Узбекистан', en: 'Uzbekistan' },
    'country.tajikistan': { ru: 'Таджикистан', en: 'Tajikistan' },
    'country.kyrgyzstan': { ru: 'Кыргызстан', en: 'Kyrgyzstan' },
    'country.turkmenistan': { ru: 'Туркменистан', en: 'Turkmenistan' },
    'country.kazakhstan': { ru: 'Казахстан', en: 'Kazakhstan' },

    // Города Центральной Азии
    'city.dushanbe': { ru: 'Душанбе', en: 'Dushanbe' },
    'city.khorog': { ru: 'Хорог', en: 'Khorog' },
    'city.khujand': { ru: 'Худжанд', en: 'Khujand' },
    'city.tashkent': { ru: 'Ташкент', en: 'Tashkent' },
    'city.samarkand': { ru: 'Самарканд', en: 'Samarkand' },
    'city.bukhara': { ru: 'Бухара', en: 'Bukhara' },
    'city.bishkek': { ru: 'Бишкек', en: 'Bishkek' },
    'city.astana': { ru: 'Астана', en: 'Astana' },
    'city.almaty': { ru: 'Алматы', en: 'Almaty' },
    'city.osh': { ru: 'Ош', en: 'Osh' },
    'city.ashgabat': { ru: 'Ашхабад', en: 'Ashgabat' },
    
    // Расширенная навигация и услуги
    'nav.services': { ru: 'Услуги', en: 'Services' },
    'nav.guides': { ru: 'Тургиды', en: 'Tour Guides' },
    'nav.transfer': { ru: 'Трансфер', en: 'Transfer' },
    'nav.book_tour': { ru: 'Заказ тура', en: 'Book Tour' },
    'nav.tourists': { ru: 'Туристам', en: 'For Tourists' },
    'nav.site_guide': { ru: 'Руководство сайта', en: 'Website Guide' },
    'nav.special_notes': { ru: 'Особые отметки', en: 'Special Notes' },
    'nav.offer_agreement': { ru: 'Договор оферта', en: 'Offer Agreement' },
    'nav.payment_rules': { ru: 'Правила оплаты и возврата средств', en: 'Payment and Refund Rules' },
    'nav.promotions': { ru: 'Акции', en: 'Promotions' },
    'nav.news': { ru: 'Новости', en: 'News' },
    'nav.reviews': { ru: 'Отзывы', en: 'Reviews' },
    
    // Типы туров по категориям
    'tour.single_day': { ru: 'Однодневный', en: 'Day Tours' },
    'tour.multi_day': { ru: 'Многодневный', en: 'Multi-day Tours' },
    'tour.excursions': { ru: 'Экскурсия', en: 'Excursions' },
    'tour.city_tours': { ru: 'Городской', en: 'City Tours' },
    'tour.nature_eco': { ru: 'Природа/экологический', en: 'Nature/Ecological' },
    'tour.cultural': { ru: 'Культурно познавательный', en: 'Cultural & Educational' },
    'tour.historical': { ru: 'Исторический', en: 'Historical' },
    'tour.trekking': { ru: 'Походы/треккинги', en: 'Hiking/Trekking' },
    'tour.mountain_landscapes': { ru: 'Горные ландшафты', en: 'Mountain Landscapes' },
    'tour.lake_landscapes': { ru: 'Озерные ландшафты', en: 'Lake Landscapes' },
    'tour.adventure': { ru: 'Приключенческий', en: 'Adventure' },
    'tour.gastronomy': { ru: 'Гастрономический', en: 'Gastronomic' },
    'tour.auto_safari': { ru: 'Авто/сафари/джип', en: 'Auto/Safari/Jeep' },
    'tour.agro': { ru: 'Агротуризм', en: 'Agrotourism' },
    'tour.vip': { ru: 'VIP', en: 'VIP' },

    // Типы туров по формату (русские значения)
    'tour_type.personal': { ru: 'Персональный', en: 'Private' },
    'tour_type.персональный': { ru: 'Персональный', en: 'Private' },
    'tour_type.group_personal': { ru: 'Групповой персональный', en: 'Group Private' },
    'tour_type.групповой_персональный': { ru: 'Групповой персональный', en: 'Group Private' },
    'tour_type.group_general': { ru: 'Групповой общий', en: 'Group Shared' },
    'tour_type.групповой_общий': { ru: 'Групповой общий', en: 'Group Shared' },
    'tour_type.special': { ru: 'Специальный', en: 'Special' },
    'tour_type.специальный': { ru: 'Специальный', en: 'Special' },
    
    // Английские enum значения из базы данных
    'tour_type.individual': { ru: 'Персональный', en: 'Private' },
    'tour_type.group_private': { ru: 'Групповой персональный', en: 'Group Private' },
    'tour_type.group_shared': { ru: 'Групповой общий', en: 'Group Shared' },
    
    'footer.public_offer': { ru: 'Публичная Оферта-Договор', en: 'Public Offer Agreement' },
    'footer.payment_rules': { ru: 'Правила оплаты и возврата средств', en: 'Payment and Refund Rules' },
    'footer.privacy_policy': { ru: 'Политика конфиденциальности', en: 'Privacy Policy' },
    'footer.company_info': { ru: 'Все права защищены | ООО "Бунёд-Тур" 2017-2026 | ИНН: 010098739; ГОРН: 0110023137 | Лицензия на туристическую деятельность № 0000253, от 25.10.2022', en: 'All rights reserved | Bunyod-Tour LLC 2017-2026 | TIN: 010098739; PIN: 0110023137 | Tourism License # 0000253, dated 25.10.2022' },
    
    // Селектор языка
    'language.russian': { ru: 'Русский', en: 'Russian' },
    'language.english': { ru: 'English', en: 'English' },
    'language.tajik': { ru: 'Таджикский', en: 'Tajik' },
    'language.uzbek': { ru: 'Узбекский', en: 'Uzbek' },
    'language.kyrgyz': { ru: 'Киргизский', en: 'Kyrgyz' },
    'language.kazakh': { ru: 'Казахский', en: 'Kazakh' },
    'language.persian': { ru: 'Персидский', en: 'Persian' },
    'language.arabic': { ru: 'Арабский', en: 'Arabic' },
    'language.turkmen': { ru: 'Туркменский', en: 'Turkmen' },
    'language.chinese': { ru: 'Китайский', en: 'Chinese' },
    'language.spanish': { ru: 'Испанский', en: 'Spanish' },
    'language.italian': { ru: 'Итальянский', en: 'Italian' },
    'language.french': { ru: 'Французский', en: 'French' },
    'language.german': { ru: 'Немецкий', en: 'German' },
    'language.japanese': { ru: 'Японский', en: 'Japanese' },
    'language.korean': { ru: 'Корейский', en: 'Korean' },
    'language.turkish': { ru: 'Турецкий', en: 'Turkish' },
    'language.hindi': { ru: 'Хинди', en: 'Hindi' },
    'language.urdu': { ru: 'Урду', en: 'Urdu' },
    
    // Дополнительные языки (для совместимости)
    'lang.russian': { ru: 'Русский', en: 'Russian' },
    'lang.english': { ru: 'English', en: 'English' },
    
    // === ПОЛНЫЕ ПЕРЕВОДЫ ДЛЯ ВСЕХ СТРАНИЦ ===
    
    // About Us страница
    'about.page_title': { ru: 'О нас - Bunyod-Tour', en: 'About Us - Bunyod-Tour' },
    'about.main_title': { ru: 'О компании Bunyod-Tour', en: 'About Bunyod-Tour Company' },
    'about.subtitle': { ru: 'Ваш надежный партнер в путешествиях по Центральной Азии', en: 'Your reliable partner for travels in Central Asia' },
    'about.mission_title': { ru: 'Наша миссия', en: 'Our Mission' },
    'about.mission_text': { ru: 'Мы стремимся показать красоту и богатство культуры Центральной Азии каждому путешественнику, создавая незабываемые впечатления и безопасные путешествия.', en: 'We strive to show the beauty and richness of Central Asian culture to every traveler, creating unforgettable experiences and safe journeys.' },
    'about.vision_title': { ru: 'Наше видение', en: 'Our Vision' },
    'about.vision_text': { ru: 'Стать ведущей туристической компанией в регионе, объединяющей традиции и современные технологии для создания лучших туристических продуктов.', en: 'To become the leading tourism company in the region, combining traditions and modern technologies to create the best tourism products.' },
    'about.experience_years': { ru: 'лет опыта', en: 'years of experience' },
    'about.happy_clients': { ru: 'довольных клиентов', en: 'happy clients' },
    'about.tours_completed': { ru: 'проведенных туров', en: 'completed tours' },
    'about.team_members': { ru: 'участников команды', en: 'team members' },
    
    // News страница
    'news.page_title': { ru: 'Новости - Bunyod-Tour', en: 'News - Bunyod-Tour' },
    'news.main_title': { ru: 'Новости туризма', en: 'Tourism News' },
    'news.subtitle': { ru: 'Последние новости и события в мире туризма Центральной Азии', en: 'Latest news and events in Central Asian tourism' },
    'news.read_more': { ru: 'Читать далее', en: 'Read More' },
    'news.date_published': { ru: 'Дата публикации', en: 'Published on' },
    'news.no_news': { ru: 'Новостей пока нет', en: 'No news available yet' },
    'news.load_more': { ru: 'Загрузить еще', en: 'Load More' },
    'news.category_general': { ru: 'Общие новости', en: 'General News' },
    'news.category_tours': { ru: 'Туры', en: 'Tours' },
    'news.category_events': { ru: 'События', en: 'Events' },
    
    // Visa Support страница  
    'visa.page_title': { ru: 'Визовая поддержка - Bunyod-Tour', en: 'Visa Support - Bunyod-Tour' },
    'visa.main_title': { ru: 'Визовая поддержка', en: 'Visa Support' },
    'visa.subtitle': { ru: 'Полная поддержка в оформлении виз для путешествий по Центральной Азии', en: 'Complete support for visa processing for travel in Central Asia' },
    'visa.countries_title': { ru: 'Визовые требования по странам', en: 'Visa Requirements by Country' },
    'visa.tajikistan': { ru: 'Таджикистан', en: 'Tajikistan' },
    'visa.uzbekistan': { ru: 'Узбекистан', en: 'Uzbekistan' },
    'visa.kyrgyzstan': { ru: 'Кыргызстан', en: 'Kyrgyzstan' },
    'visa.kazakhstan': { ru: 'Казахстан', en: 'Kazakhstan' },
    'visa.turkmenistan': { ru: 'Туркменистан', en: 'Turkmenistan' },
    'visa.services_title': { ru: 'Наши услуги', en: 'Our Services' },
    'visa.consultation': { ru: 'Консультация по визовым вопросам', en: 'Visa consultation' },
    'visa.document_preparation': { ru: 'Подготовка документов', en: 'Document preparation' },
    'visa.invitation_letters': { ru: 'Приглашения и письма поддержки', en: 'Invitation and support letters' },
    'visa.processing_assistance': { ru: 'Помощь в подаче документов', en: 'Processing assistance' },
    'visa.contact_us': { ru: 'Свяжитесь с нами для получения визовой поддержки', en: 'Contact us for visa support' },
    
    // Tour Guides страница
    'guides.page_title': { ru: 'Тургиды - Bunyod-Tour', en: 'Tour Guides - Bunyod-Tour' },
    'guides.main_title': { ru: 'Наши профессиональные тургиды', en: 'Our Professional Tour Guides' },
    'guides.subtitle': { ru: 'Знакомьтесь с нашей командой экспертов, которые сделают ваше путешествие по Центральной Азии незабываемым. Каждый наш тургид — это профессионал с многолетним опытом и глубокими знаниями региона.', en: 'Meet our team of experts who will make your journey through Central Asia unforgettable. Each of our tour guides is a professional with years of experience and deep knowledge of the region.' },
    'guides.licensed_guides': { ru: 'Лицензированные гиды', en: 'Licensed Guides' },
    'guides.happy_clients': { ru: 'Более 1000 довольных клиентов', en: 'Over 1000 Happy Clients' },
    'guides.multilingual_support': { ru: 'Многоязычная поддержка', en: 'Multilingual Support' },
    'guides.coming_soon': { ru: 'Скоро здесь появятся наши тургиды', en: 'Our tour guides will appear here soon' },
    'guides.forming_team': { ru: 'Мы формируем команду профессиональных гидов для создания незабываемых путешествий', en: 'We are forming a team of professional guides to create unforgettable journeys' },
    'guides.hire_guide': { ru: 'Нанять тургида', en: 'Hire Tour Guide' },
    'guides.select_dates': { ru: 'Выберите даты', en: 'Select Dates' },
    'guides.cost_calculation': { ru: 'Расчет стоимости', en: 'Cost Calculation' },
    'guides.your_data': { ru: 'Ваши данные', en: 'Your Information' },
    'guides.price_per_day': { ru: 'Цена за день:', en: 'Price per day:' },
    'guides.selected_days': { ru: 'Выбрано дней:', en: 'Selected days:' },
    'guides.total': { ru: 'Итого:', en: 'Total:' },
    'guides.selected': { ru: 'Выбрано', en: 'Selected' },
    'guides.available': { ru: 'Доступно', en: 'Available' },
    'guides.occupied': { ru: 'Занято', en: 'Occupied' },
    'guides.unavailable': { ru: 'Недоступно', en: 'Unavailable' },
    'guides.experience': { ru: 'Опыт работы', en: 'Experience' },
    'guides.languages': { ru: 'Языки', en: 'Languages' },
    'guides.specialization': { ru: 'Специализация', en: 'Specialization' },
    'guides.rating': { ru: 'Рейтинг', en: 'Rating' },
    'guides.contact': { ru: 'Связаться', en: 'Contact' },
    'guides.reviews': { ru: 'отзывов', en: 'reviews' },
    'guides.book_guide': { ru: 'Забронировать гида', en: 'Book Guide' },
    'guides.view_profile': { ru: 'Посмотреть профиль', en: 'View Profile' },
    'guides.no_guides': { ru: 'Гиды не найдены', en: 'No guides found' },
    
    // Дни недели для календаря
    'calendar.monday': { ru: 'Пн', en: 'Mo' },
    'calendar.tuesday': { ru: 'Вт', en: 'Tu' },
    'calendar.wednesday': { ru: 'Ср', en: 'We' },
    'calendar.thursday': { ru: 'Чт', en: 'Th' },
    'calendar.friday': { ru: 'Пт', en: 'Fr' },
    'calendar.saturday': { ru: 'Сб', en: 'Sa' },
    'calendar.sunday': { ru: 'Вс', en: 'Su' },
    
    // Общие элементы для всех страниц
    'common.loading': { ru: 'Загрузка...', en: 'Loading...' },
    'common.error': { ru: 'Произошла ошибка', en: 'An error occurred' },
    'common.try_again': { ru: 'Попробовать снова', en: 'Try again' },
    'common.contact_us': { ru: 'Свяжитесь с нами', en: 'Contact Us' },
    'common.email': { ru: 'Электронная почта', en: 'Email' },
    'common.phone': { ru: 'Телефон', en: 'Phone' },
    'common.address': { ru: 'Адрес', en: 'Address' },
    'common.back_to_top': { ru: 'Наверх', en: 'Back to Top' },
    
    // НОВЫЕ PLACEHOLDER'Ы ДЛЯ АДМИН-ПАНЕЛИ
    'placeholder.search_hotels': { ru: 'Поиск отелей...', en: 'Search hotels...' },
    'placeholder.search_tour_agents': { ru: 'Поиск турагентов...', en: 'Search tour agents...' },
    'placeholder.enter_text_for_translation': { ru: 'Введите текст для перевода...', en: 'Enter text for translation...' },
    'placeholder.translated_text_will_appear': { ru: 'Переведенный текст появится здесь...', en: 'Translated text will appear here...' },
    'placeholder.service_name_example': { ru: 'Например: Обед в ресторане', en: 'For example: Restaurant lunch' },
    'placeholder.component_additional_info': { ru: 'Дополнительная информация о компоненте', en: 'Additional component information' },
    'placeholder.slide_title': { ru: 'Заголовок слайда', en: 'Slide title' },
    'placeholder.slide_description': { ru: 'Описание слайда', en: 'Slide description' },
    'placeholder.learn_more': { ru: 'Узнать больше', en: 'Learn more' },
    'placeholder.hotel_name_example': { ru: 'Отель Хилтон Душанбе, Серена Отель и т.д.', en: 'Hilton Dushanbe, Serena Hotel, etc.' },
    'placeholder.hotel_description_ru': { ru: 'Краткое описание отеля, расположения и особенностей на русском языке...', en: 'Brief hotel description, location and features in Russian...' },
    'placeholder.enter_new_brand': { ru: 'Введите название нового бренда', en: 'Enter new brand name' },
    'placeholder.city_examples': { ru: 'Душанбе, Самарканд, Бишкек и т.д.', en: 'Dushanbe, Samarkand, Bishkek, etc.' },
    'placeholder.enter_new_amenity': { ru: 'Введите название нового удобства', en: 'Enter new amenity name' },
    'placeholder.meeting_with_guide': { ru: 'Встреча с гидом', en: 'Meeting with guide' },
    'placeholder.detailed_stage_description': { ru: 'Подробное описание этапа программы', en: 'Detailed stage description' },
    'placeholder.pickup_info_example': { ru: 'Например: Приём включён, Место сбора: отель, и т.д.', en: 'For example: Pickup included, Meeting point: hotel, etc.' },
    'placeholder.enter_service_name': { ru: 'Введите название услуги', en: 'Enter service name' },
    'placeholder.news_brief_description': { ru: 'Краткое описание новости (optional)', en: 'Brief news description (optional)' },
    
    // Title атрибуты (всплывающие подсказки)
    'title.language_switcher': { ru: 'Переключить язык', en: 'Switch language' },
    'title.currency_switcher': { ru: 'Переключить валюту', en: 'Switch currency' },
    'title.search_button': { ru: 'Начать поиск', en: 'Start search' },
    'title.filter_button': { ru: 'Применить фильтры', en: 'Apply filters' },
    'title.book_tour': { ru: 'Забронировать тур', en: 'Book tour' },
    'title.view_details': { ru: 'Посмотреть детали', en: 'View details' },
    
    // АДМИН-ПАНЕЛЬ
    'admin.dashboard': { ru: 'Главная', en: 'Dashboard' },
    'admin.administrator': { ru: 'Администратор', en: 'Administrator' },
    'admin.logout': { ru: 'Выйти', en: 'Logout' },
    'admin.tours': { ru: 'Туры', en: 'Tours' },
    'admin.hotels': { ru: 'Отели', en: 'Hotels' },
    'admin.guides': { ru: 'Гиды', en: 'Guides' },
    'admin.vehicles': { ru: 'Транспорт', en: 'Vehicles' },
    'admin.manage_vehicles': { ru: 'Управление транспортом', en: 'Manage Vehicles' },
    'admin.add_vehicle': { ru: 'Добавить транспорт', en: 'Add Vehicle' },
    'admin.search_vehicles': { ru: 'Поиск транспорта...', en: 'Search vehicles...' },
    'admin.bookings': { ru: 'Заказы', en: 'Bookings' },
    'admin.orders': { ru: 'Заказы', en: 'Orders' },
    'admin.settings': { ru: 'Настройки', en: 'Settings' },
    'admin.translations': { ru: 'Переводы', en: 'Translations' },
    'admin.cms': { ru: 'CMS - Контент', en: 'CMS - Content' },
    'admin.news': { ru: 'Новости', en: 'News' },
    'admin.drivers': { ru: 'Водители', en: 'Drivers' },
    'admin.transfers': { ru: 'Трансферы', en: 'Transfers' },
    'admin.transfer': { ru: 'Трансфер', en: 'Transfer' },
    'admin.countries': { ru: 'Страны', en: 'Countries' },
    'admin.cities': { ru: 'Города', en: 'Cities' },
    'admin.customers': { ru: 'Клиенты', en: 'Customers' },
    'admin.reviews': { ru: 'Отзывы', en: 'Reviews' },
    'admin.payments': { ru: 'Платежи', en: 'Payments' },
    'admin.control_panel': { ru: 'Панель управления', en: 'Control Panel' },
    'admin.admin_panel': { ru: 'Админ-панель', en: 'Admin Panel' },
    'admin.login_message': { ru: 'Войдите в систему управления', en: 'Sign in to the management system' },
    'admin.username': { ru: 'Имя пользователя', en: 'Username' },
    'admin.password': { ru: 'Пароль', en: 'Password' },
    'admin.login_button': { ru: 'Войти в систему', en: 'Sign In' },
    'admin.test_credentials': { ru: 'Тестовые данные: admin / admin123', en: 'Test credentials: admin / admin123' },
    'admin.recent_orders': { ru: 'Последние заказы', en: 'Recent Orders' },
    'admin.active_tours': { ru: 'Активных туров', en: 'Active Tours' },
    'admin.orders_this_month': { ru: 'Заказов за месяц', en: 'Orders This Month' },
    'admin.monthly_revenue': { ru: 'Доход за месяц', en: 'Monthly Revenue' },
    'admin.active_customers': { ru: 'Активных клиентов', en: 'Active Customers' },
    
    // НОВЫЕ АДМИНИСТРАТИВНЫЕ РАЗДЕЛЫ
    'admin.price_calculator': { ru: 'Калькулятор цен', en: 'Price Calculator' },
    'admin.banner_management': { ru: 'Управление баннером', en: 'Banner Management' },
    
    // Категории отелей
    'hotel.category.STANDARD': { ru: 'Стандарт', en: 'Standard' },
    'hotel.category.SEMI_LUX': { ru: 'Полулюкс', en: 'Semi-Luxury' },
    'hotel.category.LUX': { ru: 'Люкс', en: 'Luxury' },
    'hotel.category.DELUXE': { ru: 'Делюкс', en: 'Deluxe' },
    'admin.tour_agents': { ru: 'Турагенты', en: 'Tour Agents' },
    'admin.trips': { ru: 'Поездки', en: 'Trips' },
    'admin.exchange_rates': { ru: 'Курсы валют', en: 'Exchange Rates' },
    'admin.cms_content': { ru: 'CMS - Контент', en: 'CMS - Content' },
    'admin.sales_chart': { ru: 'График продаж', en: 'Sales Chart' },
    'admin.popular_destinations': { ru: 'Популярные направления', en: 'Popular Destinations' },
    'admin.manage_hotels': { ru: 'Управление отелями', en: 'Hotel Management' },
    'admin.manage_guides': { ru: 'Управление гидами', en: 'Guide Management' },
    'admin.manage_tour_agents': { ru: 'Управление турагентами', en: 'Tour Agent Management' },
    'admin.manage_drivers': { ru: 'Управление водителями', en: 'Driver Management' },
    'admin.manage_trips': { ru: 'Управление поездками', en: 'Trip Management' },
    'admin.transfer_requests': { ru: 'Заявки на трансфер', en: 'Transfer Requests' },
    'admin.manage_countries': { ru: 'Управление странами', en: 'Country Management' },
    'admin.manage_cities': { ru: 'Управление городами', en: 'City Management' },
    'admin.total_views': { ru: 'Всего просмотров', en: 'Total Views' },
    'admin.total_news': { ru: 'Всего новостей', en: 'Total News' },
    'admin.published': { ru: 'Опубликовано', en: 'Published' },
    'admin.drafts': { ru: 'Черновики', en: 'Drafts' },
    'admin.tour_blocks': { ru: 'Блоки туров', en: 'Tour Blocks' },
    'admin.site_settings': { ru: 'Настройки сайта', en: 'Site Settings' },
    'admin.tour_form': { ru: 'Форма тура', en: 'Tour Form' },
    'admin.manage_tour_blocks': { ru: 'Управление блоками туров', en: 'Tour Block Management' },
    
    // ТАБЛИЦЫ
    'table.order_number': { ru: 'Номер заказа', en: 'Order #' },
    'table.client': { ru: 'Клиент', en: 'Client' },
    'table.tour': { ru: 'Тур', en: 'Tour' },
    'table.date': { ru: 'Дата', en: 'Date' },
    'table.amount': { ru: 'Сумма', en: 'Amount' },
    'table.status': { ru: 'Статус', en: 'Status' },
    'table.actions': { ru: 'Действия', en: 'Actions' },
    'table.name': { ru: 'Название', en: 'Name' },
    'table.category': { ru: 'Категория', en: 'Category' },
    'table.country': { ru: 'Страна', en: 'Country' },
    'table.city': { ru: 'Город', en: 'City' },
    'table.duration': { ru: 'Длительность', en: 'Duration' },
    'table.price': { ru: 'Цена', en: 'Price' },
    'table.title': { ru: 'Заголовок', en: 'Title' },
    'table.author': { ru: 'Автор', en: 'Author' },
    'table.publish_date': { ru: 'Дата публикации', en: 'Publish Date' },
    'table.views': { ru: 'Просмотры', en: 'Views' },
    'table.block_name_ru': { ru: 'Название блока (RU)', en: 'Block Name (RU)' },
    'table.block_name_en': { ru: 'Название блока (EN)', en: 'Block Name (EN)' },
    'table.slug': { ru: 'URL-адрес', en: 'Slug' },
    'table.tour_count': { ru: 'Количество туров', en: 'Tour Count' },
    'table.order': { ru: 'Порядок', en: 'Order' },
    
    // КНОПКИ
    'btn.add_tour': { ru: 'Добавить тур', en: 'Add Tour' },
    'btn.create_tour_block': { ru: 'Создать блок туров', en: 'Create Tour Block' },
    'btn.add_hotel': { ru: 'Добавить отель', en: 'Add Hotel' },
    'btn.add_guide': { ru: 'Добавить гида', en: 'Add Guide' },
    'btn.add_tour_agent': { ru: 'Добавить турагента', en: 'Add Tour Agent' },
    'btn.add_driver': { ru: 'Добавить водителя', en: 'Add Driver' },
    'btn.add_trip': { ru: 'Добавить поездку', en: 'Add Trip' },
    'btn.add_country': { ru: 'Добавить страну', en: 'Add Country' },
    'btn.add_city': { ru: 'Добавить город', en: 'Add City' },
    
    // СТАТУСЫ
    'status.pending': { ru: 'Ожидание', en: 'Pending' },
    'status.confirmed': { ru: 'Подтвержден', en: 'Confirmed' },
    'status.paid': { ru: 'Оплачен', en: 'Paid' },
    'status.completed': { ru: 'Завершен', en: 'Completed' },
    'status.cancelled': { ru: 'Отменен', en: 'Cancelled' },
    
    // ТАБЫ
    'tab.all_orders': { ru: 'Все заказы', en: 'All Orders' },
    
    // ФОРМЫ
    'form.pickup_info': { ru: 'Информация о встрече/трансфере', en: 'Pickup/Meeting Information' },
    'form.tour_languages': { ru: 'Языки тура', en: 'Tour Languages' },
    'form.min_people': { ru: 'Минимальное количество людей', en: 'Minimum Number of People' },
    'form.max_people': { ru: 'Максимальное количество людей', en: 'Maximum Number of People' },
    'form.available_months': { ru: 'Доступные месяцы', en: 'Available Months' },
    'form.available_days': { ru: 'Доступные дни', en: 'Available Days' },
    'form.tour_photos': { ru: 'Фотографии тура', en: 'Tour Photos' },
    
    // ЯЗЫКИ
    'language.russian': { ru: 'Русский', en: 'Russian' },
    
    // НОВЫЕ КЛЮЧИ ДЛЯ РАСШИРЕННОГО ПОКРЫТИЯ
    'nav.services': { ru: 'Услуги', en: 'Services' },
    'nav.guides': { ru: 'Тургиды', en: 'Tour Guides' },
    'nav.transfer': { ru: 'Трансфер', en: 'Transfer' },
    'nav.book_tour': { ru: 'Заказ тура', en: 'Book Tour' },
    'nav.tourists': { ru: 'Туристам', en: 'For Tourists' },
    'nav.promotions': { ru: 'Акции', en: 'Promotions' },
    'nav.news': { ru: 'Новости', en: 'News' },
    'nav.reviews': { ru: 'Отзывы', en: 'Reviews' },
    
    // Фильтры и кнопки
    'btn.apply_filters': { ru: 'Применить фильтры', en: 'Apply Filters' },
    'btn.reset_filters': { ru: 'Сбросить все фильтры', en: 'Reset all filters' },
    
    // Сообщения о поиске
    'common.no_tours_found': { ru: 'Туры не найдены', en: 'No tours found' },
    'common.try_different_search': { ru: 'Попробуйте изменить параметры поиска', en: 'Try changing search parameters' },
    'common.tours_shown': { ru: 'Показано туров:', en: 'Tours shown:' },
    
    // Формы и поля
    'form.date_from': { ru: 'От', en: 'From' },
    'form.date_to': { ru: 'До', en: 'To' },
    
    // Модальные окна
    'modal.tour_details': { ru: 'Детали тура', en: 'Tour Details' },
    'modal.description': { ru: 'Описание тура', en: 'Tour Description' },
    'modal.program': { ru: 'Программа тура', en: 'Tour Program' },
    'modal.hotels': { ru: 'Отели', en: 'Hotels' },
    'modal.features': { ru: 'Особенности тура:', en: 'Tour Features:' },
    
    // === НОВЫЕ КЛЮЧИ ДЛЯ index.html ===
    
    // Заголовок страницы
    'page.title': { ru: 'Bunyod-Tour - Туры по Таджикистану', en: 'Bunyod-Tour - Tours in Tajikistan' },

    // Дополнительная навигация
    'nav.site_guide': { ru: 'Руководство сайта', en: 'Website Guide' },
    'nav.special_notes': { ru: 'Особые отметки', en: 'Special Notes' },
    'nav.offer_agreement': { ru: 'Договор оферта', en: 'Offer Agreement' },
    'nav.payment_rules': { ru: 'Правила оплаты и возврата средств', en: 'Payment and Refund Rules' },
    'nav.our_agents': { ru: 'Наши турагенты', en: 'Our Travel Agents' },

    // Типы туров в навигации
    'tour.single_day': { ru: 'Однодневный', en: 'Day Tours' },
    'tour.multi_day': { ru: 'Многодневный', en: 'Multi-day Tours' },
    'tour.excursions': { ru: 'Экскурсия', en: 'Excursions' },
    'tour.city_tours': { ru: 'Городской', en: 'City Tours' },
    'tour.nature_eco': { ru: 'Природа/экологический', en: 'Nature/Ecological' },
    'tour.cultural': { ru: 'Культурно познавательный', en: 'Cultural & Educational' },
    'tour.historical': { ru: 'Исторический', en: 'Historical' },
    'tour.trekking': { ru: 'Походы/треккинги', en: 'Hiking/Trekking' },
    'tour.mountain_landscapes': { ru: 'Горные ландшафты', en: 'Mountain Landscapes' },
    'tour.lake_landscapes': { ru: 'Озерные ландшафты', en: 'Lake Landscapes' },
    'tour.adventure': { ru: 'Приключенческий', en: 'Adventure' },
    'tour.gastronomy': { ru: 'Гастрономический', en: 'Gastronomic' },
    'tour.auto_safari': { ru: 'Авто/сафари/джип', en: 'Auto/Safari/Jeep' },
    'tour.agro': { ru: 'Агротуризм', en: 'Agrotourism' },
    'tour.vip': { ru: 'VIP', en: 'VIP' },

    // Placeholder
    'placeholder.search_perfect_tour': { ru: 'Найдите идеальный тур: Памир, Искандеркуль, треккинг...', en: 'Find the perfect tour: Pamir, Iskanderkul, trekking...' },


    // Типы туров
    'tour_type.personal': { ru: 'Персональный', en: 'Private' },
    'tour_type.group_personal': { ru: 'Групповой персональный', en: 'Group Private' },
    'tour_type.group_general': { ru: 'Групповой общий', en: 'Group Shared' },
    'tour_type.special': { ru: 'Специальный', en: 'Special' },

    // Заголовки сервисов
    'service.transfer_title': { ru: 'ТРАНСФЕР', en: 'TRANSFER' },
    'service.guides_title': { ru: 'ТУР-ГИДЫ', en: 'TOUR GUIDES' },
    'service.agency_title': { ru: 'B2B ПАРТНЕРСТВО', en: 'B2B PARTNERSHIP' },
    'service.custom_tour_title': { ru: 'СОБСТВЕННЫЙ ТУР', en: 'CUSTOM TOUR' },

    // Города
    'city.dushanbe': { ru: 'Душанбе', en: 'Dushanbe' },
    'city.khorog': { ru: 'Хорог', en: 'Khorog' },
    'city.khujand': { ru: 'Худжанд', en: 'Khujand' },
    'city.tashkent': { ru: 'Ташкент', en: 'Tashkent' },
    'city.samarkand': { ru: 'Самарканд', en: 'Samarkand' },
    'city.bukhara': { ru: 'Бухара', en: 'Bukhara' },
    'city.bishkek': { ru: 'Бишкек', en: 'Bishkek' },
    'city.astana': { ru: 'Астана', en: 'Astana' },
    'city.almaty': { ru: 'Алматы', en: 'Almaty' },
    'city.osh': { ru: 'Ош', en: 'Osh' },
    'city.ashgabat': { ru: 'Ашхабад', en: 'Ashgabat' },

    // Подвал (без дублирования)

    // Языки
    'lang.russian': { ru: 'Русский', en: 'Russian' },

    // Дополнительные языки для списков
    'lang.english': { ru: 'Английский', en: 'English' },
    'lang.tajik': { ru: 'Таджикский', en: 'Tajik' },
    
    // Единицы времени
    'time.hours': { ru: 'часов', en: 'hours' },
    'time.hour': { ru: 'час', en: 'hour' },
    
    // Navigation submenus for tours
    'nav.tours.one_day': { ru: 'Однодневные', en: 'One Day' },
    'nav.tours.multi_day': { ru: 'Многодневные', en: 'Multi Day' },
    'nav.tours.excursions': { ru: 'Экскурсии', en: 'Excursions' },
    'nav.tours.city_tours': { ru: 'Городские', en: 'City' },
    'nav.tours.nature_eco': { ru: 'Природа/экологические', en: 'Nature/Eco' },
    'nav.tours.cultural': { ru: 'Культурно познавательные', en: 'Cultural Educational' },
    'nav.tours.historical': { ru: 'Исторические', en: 'Historical' },
    'nav.tours.hiking': { ru: 'Походы/трекинги', en: 'Hiking/Trekking' },
    'nav.tours.mountain': { ru: 'Горные ландшафты', en: 'Mountain Landscapes' },
    'nav.tours.lakes': { ru: 'Озерные ландшафты', en: 'Lake Landscapes' },
    'nav.tours.adventure': { ru: 'Приключенческие', en: 'Adventure' },
    'nav.tours.gastronomy': { ru: 'Гастрономические', en: 'Gastronomy' },
    'nav.tours.safari': { ru: 'Авто/сафари/джип', en: 'Auto/Safari/Jeep' },
    'nav.tours.agro': { ru: 'Агротуризм', en: 'Agro' },
    'nav.tours.vip': { ru: 'VIP', en: 'VIP' },
    
    // Tourist menu navigation
    'nav.tourists.instructions': { ru: 'Руководство сайта', en: 'Website Guide' },
    'nav.tourists.special_notes': { ru: 'Особые отметки', en: 'Special Notes' },
    'nav.tourists.contract': { ru: 'Договор оферта', en: 'Offer Agreement' },
    'nav.tourists.payment_rules': { ru: 'Правила оплаты и возврата средств', en: 'Payment and Refund Rules' },
    
    // Tour agents navigation
    'nav.agents': { ru: 'Тур-агенты', en: 'Tour Agents' },
    'nav.agents.our_agents': { ru: 'Наши турагенты', en: 'Our Tour Agents' },
    'nav.agents.for_agents': { ru: 'Для турагентов', en: 'For Tour Agents' },
    
    // Ключи для about-us.html
    'about.page_title': { ru: 'О нас - Bunyod-Tour', en: 'About Us - Bunyod-Tour' },
    'about.nav.about': { ru: 'О нас', en: 'About Us' },
    'about.nav.mission': { ru: 'Миссия', en: 'Mission' },
    'about.nav.team': { ru: 'Команда', en: 'Team' },
    'about.title': { ru: 'О НАС', en: 'ABOUT US' },
    'about.mission_title': { ru: 'МИССИЯ', en: 'MISSION' },
    'about.services_title': { ru: 'НАШИ УСЛУГИ / ПРОДУКТЫ', en: 'OUR SERVICES / PRODUCTS' },
    'about.company_title': { ru: 'Наша компания', en: 'Our Company' },
    'about.agency_service': { ru: 'АГЕНТСКИЙ СЕРВИС', en: 'AGENCY SERVICE' },
    
    // Ключи для news.html
    'news.page_title': { ru: 'Новости - Bunyod-Tour', en: 'News - Bunyod-Tour' },
    'news.featured_news': { ru: 'Рекомендуемая новость', en: 'Featured News' },
    'news.all_news': { ru: 'Все новости', en: 'All News' },
    'news.no_news_found': { ru: 'Новостей не найдено', en: 'No news found' },
    'news.loading_error': { ru: 'Ошибка при загрузке новостей', en: 'Error loading news' },
    'news.connection_error': { ru: 'Ошибка подключения к серверу', en: 'Server connection error' },
    'news.error': { ru: 'Ошибка', en: 'Error' },
    'news.read_more': { ru: 'Читать далее', en: 'Read More' },
    'news.read_full': { ru: 'Читать полностью', en: 'Read Full Article' },
    'news.min': { ru: 'мин', en: 'min' },
    'news.views': { ru: 'просмотров', en: 'views' },
    'news.featured': { ru: 'Рекомендуемое', en: 'Featured' },
    'news.no_news_desc': { ru: 'Новости появятся совсем скоро. Заходите позже!', en: 'News will appear very soon. Check back later!' },
    
    // Ключи для news-detail.html
    'news_detail.home': { ru: 'Главная', en: 'Home' },
    'news_detail.news': { ru: 'Новости', en: 'News' },
    'news_detail.loading': { ru: 'Загружаем новость...', en: 'Loading news...' },
    'news_detail.tags': { ru: 'Теги:', en: 'Tags:' },
    'news_detail.not_found': { ru: 'Новость не найдена', en: 'News not found' },
    'news_detail.not_found_desc': { ru: 'Запрашиваемая новость не существует или была удалена', en: 'The requested news article does not exist or has been removed' },
    'news_detail.back_to_news': { ru: 'Вернуться к новостям', en: 'Back to News' },
    'news_detail.related_news': { ru: 'Похожие новости', en: 'Related News' },
    'news_detail.subscribe_title': { ru: 'Подпишитесь на наши новости', en: 'Subscribe to our news' },
    'news_detail.subscribe_desc': { ru: 'Получайте уведомления о новых турах, специальных предложениях и интересных событиях в мире туризма', en: 'Get notifications about new tours, special offers, and interesting events in tourism' },
    'news_detail.email_placeholder': { ru: 'Введите ваш email', en: 'Enter your email' },
    'news_detail.subscribe_btn': { ru: 'Подписаться', en: 'Subscribe' },
    'news_detail.min_read': { ru: 'мин чтения', en: 'min read' },
    'news_detail.views': { ru: 'просмотров', en: 'views' },
    'news_detail.link_copied': { ru: 'Ссылка скопирована в буфер обмена!', en: 'Link copied to clipboard!' },
    'news_detail.thanks_subscribe': { ru: 'Спасибо за подписку! Мы будем уведомлять вас о новых новостях.', en: 'Thank you for subscribing! We will notify you about new updates.' },
    'news_detail.subscribe_error': { ru: 'Ошибка подписки', en: 'Subscription error' },
    'news_detail.connection_error': { ru: 'Ошибка соединения с сервером', en: 'Server connection error' },
    
    // Категории новостей
    'category.tours': { ru: 'Новые туры', en: 'New Tours' },
    'category.events': { ru: 'События', en: 'Events' },
    'category.announcements': { ru: 'Объявления', en: 'Announcements' },
    'category.tips': { ru: 'Советы', en: 'Tips' },
    'category.general': { ru: 'Общие', en: 'General' },
    
    // Ключи для visa-support.html
    'visa.page_title': { ru: 'Визовая поддержка - Bunyod-Tour', en: 'Visa Support - Bunyod-Tour' },
    'visa.main_title': { ru: 'ВИЗА ТАДЖИКИСТАНА', en: 'TAJIKISTAN VISA' },
    'visa.intro_text': { ru: 'Для визита в Таджикистан выдается три вида визы:', en: 'Three types of visas are issued for visiting Tajikistan:' },
    'visa.visa_free': { ru: 'Безвизовый режим', en: 'Visa-free regime' },
    'visa.e_visa': { ru: 'Электронная виза', en: 'Electronic visa' },
    'visa.standard_visa': { ru: 'Стандартная виза', en: 'Standard visa' },
    'visa.visa_free_section': { ru: 'БЕЗВИЗОВЫЙ РЕЖИМ', en: 'VISA-FREE REGIME' },
    'visa.electronic_visa_section': { ru: 'ЭЛЕКТРОННАЯ и УПРОЩЕННАЯ ВИЗА', en: 'ELECTRONIC AND SIMPLIFIED VISA' },
    'visa.electronic_visa_notice': { ru: 'ВНИМАНИЕ! — «электронная система оформления виз» не связана с системой «электронной визы».', en: 'ATTENTION! — "electronic visa processing system" is not related to "electronic visa" system.' },
    'visa.evisa_description': { ru: '«Электронная виза» оформляется по адресу', en: '"Electronic visa" is processed at' },
    'visa.evisa_details': { ru: 'это однократная виза и выдается на срок до 45 дней.', en: 'this is a single-entry visa issued for up to 45 days.' },
    'visa.visa_system_description': { ru: 'Однако, «Электронная система оформления виз» функционирует по адресу', en: 'However, "Electronic visa processing system" operates at' },
    'visa.visa_system_details': { ru: 'это система представления электронной заявки для получения визы.', en: 'this is a system for submitting electronic visa applications.' },
    'visa.eligible_countries': { ru: 'Список правомочных стран представлен ниже:', en: 'List of eligible countries is presented below:' },
    'visa.standard_visa_section': { ru: 'СТАНДАРТНАЯ ВИЗА', en: 'STANDARD VISA' },
    'visa.standard_visa_desc': { ru: 'Для граждан стран, не входящих в списки безвизового режима или электронной визы, требуется оформление стандартной визы через консульство Таджикистана.', en: 'For citizens of countries not included in visa-free or e-visa lists, a standard visa through a Tajikistan consulate is required.' },
    'visa.visa_free_desc': { ru: 'Граждане определённых стран могут въезжать без визы', en: 'Citizens of certain countries can enter without a visa' },
    'visa.e_visa_desc': { ru: 'Упрощенное получение визы онлайн', en: 'Simplified online visa processing' },
    'visa.standard_visa_desc_short': { ru: 'Традиционное оформление через консульства', en: 'Traditional processing through consulates' },
    
    // Visa type descriptions
    'visa.all_types_30': { ru: 'все виды заграничных, до 30 дней', en: 'all types of foreign, up to 30 days' },
    'visa.all_types_90': { ru: 'все виды заграничных, до 90 дней', en: 'all types of foreign, up to 90 days' },
    'visa.all_types_14_55': { ru: 'все виды, до 14 дней (для граждан старше 55 лет)', en: 'all types of foreign, up to 14 days (for citizens over 55 years of age)' },
    'visa.all_types_unlimited': { ru: 'все виды заграничных', en: 'all types of foreign' },
    'visa.diplomatic_30': { ru: 'дипломатический, до 30 дней', en: 'diplomatic, up to 30 days' },
    'visa.official_diplomatic_14': { ru: 'служебный, дипломатический, до 14 дней', en: 'official, diplomatic, up to 14 days' },
    'visa.official_diplomatic_30': { ru: 'служебный, дипломатический, до 30 дней', en: 'official, diplomatic, up to 30 days' },
    'visa.official_diplomatic_special_30': { ru: 'служебный, дипломатический и специальный, до 30 дней', en: 'official, diplomatic and special, up to 30 days' },
    'visa.diplomatic_service_30': { ru: 'дипломатический и служебный/специальный, до 30 дней', en: 'for diplomatic and service/special passports, up to 30 days' },
    
    // Country names
    'visa.country_andorra': { ru: 'Андорра', en: 'ANDORRA' },
    'visa.country_argentina': { ru: 'Аргентина', en: 'ARGENTINA' },
    'visa.country_armenia': { ru: 'Армения', en: 'ARMENIA' },
    'visa.country_australia': { ru: 'Австралия', en: 'AUSTRALIA' },
    'visa.country_austria': { ru: 'Австрия', en: 'AUSTRIA' },
    'visa.country_azerbaijan': { ru: 'Азербайджан', en: 'AZERBAIJAN' },
    'visa.country_afghanistan': { ru: 'Афганистан', en: 'AFGHANISTAN' },
    'visa.country_albania': { ru: 'Албания', en: 'ALBANIA' },
    'visa.country_algeria': { ru: 'Алжир', en: 'ALGERIA' },
    'visa.country_bahamas': { ru: 'Багамы', en: 'BAHAMAS' },
    'visa.country_bahrain': { ru: 'Бахрейн', en: 'BAHRAIN' },
    'visa.country_barbados': { ru: 'Барбадос', en: 'BARBADOS' },
    'visa.country_belarus': { ru: 'Беларусь', en: 'BELARUS' },
    'visa.country_belgium': { ru: 'Бельгия', en: 'BELGIUM' },
    'visa.country_bosnia': { ru: 'Босния и Герцеговина', en: 'BOSNIA and HERZEGOVINA' },
    'visa.country_brazil': { ru: 'Бразилия', en: 'BRAZIL' },
    'visa.country_brunei': { ru: 'Бруней', en: 'BRUNEI Darussalam' },
    'visa.country_bulgaria': { ru: 'Болгария', en: 'BULGARIA' },
    'visa.country_canada': { ru: 'Канада', en: 'CANADA' },
    'visa.country_chile': { ru: 'Чили', en: 'CHILE' },
    'visa.country_china': { ru: 'Китай', en: 'CHINA' },
    'visa.country_costa_rica': { ru: 'Коста-Рика', en: 'COSTA RICA' },
    'visa.country_croatia': { ru: 'Хорватия', en: 'CROATIA' },
    'visa.country_cuba': { ru: 'Куба', en: 'CUBA' },
    'visa.country_cyprus': { ru: 'Кипр', en: 'CYPRUS' },
    'visa.country_czech': { ru: 'Чехия', en: 'CZECH' },
    'visa.country_denmark': { ru: 'Дания', en: 'DENMARK' },
    'visa.country_dominica': { ru: 'Доминика', en: 'DOMINICA' },
    'visa.country_dominican': { ru: 'Доминиканская Республика', en: 'DOMINICAN Republic' },
    'visa.country_ecuador': { ru: 'Эквадор', en: 'ECUADOR' },
    'visa.country_estonia': { ru: 'Эстония', en: 'ESTONIA' },
    'visa.country_fiji': { ru: 'Фиджи', en: 'FIJI' },
    'visa.country_finland': { ru: 'Финляндия', en: 'FINLAND' },
    'visa.country_france': { ru: 'Франция', en: 'FRANCE' },
    'visa.country_georgia': { ru: 'Грузия', en: 'GEORGIA' },
    'visa.country_germany': { ru: 'Германия', en: 'GERMANY' },
    'visa.country_greece': { ru: 'Греция', en: 'HELLENIC (Greece)' },
    'visa.country_hungary': { ru: 'Венгрия', en: 'HUNGARY' },
    'visa.country_iceland': { ru: 'Исландия', en: 'ICELAND' },
    'visa.country_india': { ru: 'Индия', en: 'INDIA' },
    'visa.country_indonesia': { ru: 'Индонезия', en: 'INDONESIA' },
    'visa.country_iran': { ru: 'Иран', en: 'IRAN' },
    'visa.country_ireland': { ru: 'Ирландия', en: 'IRELAND' },
    'visa.country_italy': { ru: 'Италия', en: 'ITALY' },
    'visa.country_jamaica': { ru: 'Ямайка', en: 'JAMAICA' },
    'visa.country_japan': { ru: 'Япония', en: 'JAPAN' },
    'visa.country_jordan': { ru: 'Иордания', en: 'JORDAN' },
    'visa.country_kazakhstan': { ru: 'Казахстан', en: 'KAZAKHSTAN' },
    'visa.country_kuwait': { ru: 'Кувейт', en: 'KUWAIT' },
    'visa.country_kyrgyzstan': { ru: 'Кыргызстан', en: 'KYRGYZSTAN' },
    'visa.country_laos': { ru: 'Лаос', en: 'LAO' },
    'visa.country_latvia': { ru: 'Латвия', en: 'LATVIA' },
    'visa.country_lebanon': { ru: 'Ливан', en: 'LEBANON' },
    'visa.country_liechtenstein': { ru: 'Лихтенштейн', en: 'LIECHTENSTEIN' },
    'visa.country_lithuania': { ru: 'Литва', en: 'LITHUANIA' },
    'visa.country_luxembourg': { ru: 'Люксембург', en: 'LUXEMBOURG' },
    'visa.country_madagascar': { ru: 'Мадагаскар', en: 'MADAGASCAR' },
    'visa.country_malaysia': { ru: 'Малайзия', en: 'MALAYSIA' },
    'visa.country_maldives': { ru: 'Мальдивы', en: 'MALDIVES' },
    'visa.country_malta': { ru: 'Мальта', en: 'MALTA' },
    'visa.country_marshall': { ru: 'Маршалловы Острова', en: 'MARSHALL Islands' },
    'visa.country_mexico': { ru: 'Мексика', en: 'MEXICO' },
    'visa.country_moldova': { ru: 'Молдова', en: 'MOLDOVA' },
    'visa.country_monaco': { ru: 'Монако', en: 'MONACO' },
    'visa.country_mongolia': { ru: 'Монголия', en: 'MONGOLIA' },
    'visa.country_montenegro': { ru: 'Черногория', en: 'MONTENEGRO' },
    'visa.country_morocco': { ru: 'Марокко', en: 'MOROCCO' },
    'visa.country_netherlands': { ru: 'Нидерланды', en: 'NETHERLANDS' },
    'visa.country_new_zealand': { ru: 'Новая Зеландия', en: 'NEW ZEALAND' },
    'visa.country_nicaragua': { ru: 'Никарагуа', en: 'NICARAGUA' },
    'visa.country_north_korea': { ru: 'Северная Корея', en: 'NORTH KOREA' },
    'visa.country_north_macedonia': { ru: 'Северная Македония', en: 'NORTH MACEDONIA' },
    'visa.country_norway': { ru: 'Норвегия', en: 'NORWAY' },
    'visa.country_oman': { ru: 'Оман', en: 'OMAN' },
    'visa.country_pakistan': { ru: 'Пакистан', en: 'PAKISTAN' },
    'visa.country_palestine': { ru: 'Палестина', en: 'PALESTINE' },
    'visa.country_panama': { ru: 'Панама', en: 'PANAMA' },
    'visa.country_philippines': { ru: 'Филиппины', en: 'PHILIPPINES' },
    'visa.country_poland': { ru: 'Польша', en: 'POLAND' },
    'visa.country_portugal': { ru: 'Португалия', en: 'PORTUGAL' },
    'visa.country_qatar': { ru: 'Катар', en: 'QATAR' },
    'visa.country_romania': { ru: 'Румыния', en: 'ROMANIA' },
    'visa.country_russia': { ru: 'Россия', en: 'RUSSIA' },
    'visa.country_saint_kitts': { ru: 'Сент-Китс и Невис', en: 'SAINT KITTS and NEVIS' },
    'visa.country_saint_lucia': { ru: 'Сент-Люсия', en: 'SAINT LUCIA' },
    'visa.country_saint_vincent': { ru: 'Сент-Винсент и Гренадины', en: 'SAINT VINCENT and the Grenadines' },
    'visa.country_san_marino': { ru: 'Сан-Марино', en: 'SAN MARINO' },
    'visa.country_saudi_arabia': { ru: 'Саудовская Аравия', en: 'SAUDI ARABIA' },
    'visa.country_serbia': { ru: 'Сербия', en: 'SERBIA' },
    'visa.country_singapore': { ru: 'Сингапур', en: 'SINGAPORE' },
    'visa.country_slovakia': { ru: 'Словакия', en: 'SLOVAK' },
    'visa.country_slovenia': { ru: 'Словения', en: 'SLOVENIA' },
    'visa.country_solomon': { ru: 'Соломоновы Острова', en: 'SOLOMON Islands' },
    'visa.country_south_korea': { ru: 'Южная Корея', en: 'SOUTH KOREA' },
    'visa.country_spain': { ru: 'Испания', en: 'SPAIN' },
    'visa.country_sri_lanka': { ru: 'Шри-Ланка', en: 'SRI LANKA' },
    'visa.country_sweden': { ru: 'Швеция', en: 'SWEDEN' },
    'visa.country_switzerland': { ru: 'Швейцария', en: 'SWISS Confederation' },
    'visa.country_thailand': { ru: 'Таиланд', en: 'THAILAND' },
    'visa.country_tunisia': { ru: 'Тунис', en: 'TUNISIA' },
    'visa.country_turkey': { ru: 'Турция', en: 'TURKEY' },
    'visa.country_turkmenistan': { ru: 'Туркменистан', en: 'TURKMENISTAN' },
    'visa.country_ukraine': { ru: 'Украина', en: 'UKRAINE' },
    'visa.country_uae': { ru: 'ОАЭ', en: 'UNITED ARAB EMIRATES' },
    'visa.country_usa': { ru: 'США', en: 'UNITED STATES OF AMERICA' },
    'visa.country_uzbekistan': { ru: 'Узбекистан', en: 'UZBEKISTAN' },
    'visa.country_vanuatu': { ru: 'Вануату', en: 'VANUATU' },
    'visa.country_vatican': { ru: 'Ватикан', en: 'VATICAN' },
    'visa.country_vietnam': { ru: 'Вьетнам', en: 'VIETNAM' },
    
    // E-visa additional countries
    'visa.evisa_antigua': { ru: 'Антигуа и Барбуда', en: 'ANTIGUA and BARBUDA' },
    'visa.evisa_south_africa': { ru: 'ЮАР', en: 'SOUTH AFRICA' },
    'visa.evisa_belize': { ru: 'Белиз', en: 'BELIZE' },
    'visa.evisa_bolivia': { ru: 'Боливия', en: 'BOLIVIA' },
    'visa.evisa_uk': { ru: 'Великобритания', en: 'UNITED KINGDOM' },
    'visa.evisa_venezuela': { ru: 'Венесуэла', en: 'VENEZUELA' },
    'visa.evisa_guyana': { ru: 'Гайана', en: 'GUYANA' },
    'visa.evisa_guatemala': { ru: 'Гватемала', en: 'GUATEMALA' },
    'visa.evisa_grenada': { ru: 'Гренада', en: 'GRENADA' },
    'visa.evisa_egypt': { ru: 'Египет', en: 'EGYPT' },
    'visa.evisa_israel': { ru: 'Израиль', en: 'ISRAEL' },
    'visa.evisa_colombia': { ru: 'Колумбия', en: 'COLOMBIA' },
    'visa.evisa_mauritius': { ru: 'Маврикий', en: 'MAURITIUS' },
    'visa.evisa_paraguay': { ru: 'Парагвай', en: 'PARAGUAY' },
    'visa.evisa_papua': { ru: 'Папуа-Новая Гвинея', en: 'PAPUA NEW GUINEA' },
    'visa.evisa_peru': { ru: 'Перу', en: 'PERU' },
    'visa.evisa_seychelles': { ru: 'Сейшелы', en: 'SEYCHELLES' },
    'visa.evisa_senegal': { ru: 'Сенегал', en: 'SENEGAL' },
    'visa.evisa_suriname': { ru: 'Суринам', en: 'SURINAME' },
    'visa.evisa_trinidad': { ru: 'Тринидад и Тобаго', en: 'TRINIDAD and TOBAGO' },
    'visa.evisa_uruguay': { ru: 'Уругвай', en: 'URUGUAY' },
    'visa.evisa_el_salvador': { ru: 'Эль-Сальвадор', en: 'EL SALVADOR' },
    'visa.evisa_cambodia': { ru: 'Камбоджа', en: 'CAMBODIA' },
    'visa.evisa_bhutan': { ru: 'Бутан', en: 'BHUTAN' },
    'visa.evisa_honduras': { ru: 'Гондурас', en: 'HONDURAS' },
    'visa.evisa_cape_verde': { ru: 'Кабо-Верде', en: 'CABO VERDE' },
    'visa.evisa_ghana': { ru: 'Гана', en: 'GHANA' },
    'visa.evisa_cameroon': { ru: 'Камерун', en: 'CAMEROON' },
    'visa.evisa_benin': { ru: 'Бенин', en: 'BENIN' },
    'visa.evisa_tanzania': { ru: 'Танзания', en: 'TANZANIA' },
    'visa.evisa_kenya': { ru: 'Кения', en: 'KENYA' },
    'visa.evisa_congo': { ru: 'Конго', en: 'CONGO' },
    'visa.evisa_bangladesh': { ru: 'Бангладеш', en: 'BANGLADESH' },
    'visa.evisa_burkina': { ru: 'Буркина-Фасо', en: 'BURKINA FASO' },
    
    // Standard visa section
    'visa.standard_intro': { ru: 'Если ваша страна проживания не входит ни в один из вышеописанных списков, вы можете получить визу в Таджикистан в любой стране, где имеется посольство или консульство Республики Таджикистан.', en: 'If your country of residence is not included in any of the above lists, you can obtain a visa to Tajikistan in any country where there is an embassy or consulate of the Republic of Tajikistan.' },
    'visa.standard_fees': { ru: 'Список документов, а также размер консульских сборов могут отличаться в зависимости от гражданства иностранного гражданина и места получения визы. Минимальная стоимость консульских сборов составляет 25 долларов США.', en: 'The list of documents and consular fees may vary depending on the citizenship of the foreign national and the place of visa issuance. The minimum consular fee is 25 US dollars.' },
    'visa.standard_requirements_title': { ru: 'Стандартные требования к получению визы включают:', en: 'Standard visa requirements include:' },
    'visa.req_invitation': { ru: 'Визовая поддержка (приглашение*);', en: 'Visa support (invitation*);' },
    'visa.req_passport': { ru: 'Действующий паспорт с 2-мя чистыми листами для визы и въездных/выездных штампов. Срок истечения действия паспорта не должен быть менее 6 месяцев до истечения срока действия визы;', en: 'Valid passport with 2 blank pages for visa and entry/exit stamps. Passport expiration date must be at least 6 months after visa expiration;' },
    'visa.req_form': { ru: 'Визовая анкета**, заполненная в 2-х экземплярах;', en: 'Visa application form**, filled in 2 copies;' },
    'visa.req_photo': { ru: 'Цветное фото (3,5 x 4,5);', en: 'Color photo (3.5 x 4.5);' },
    'visa.req_receipt': { ru: 'Квитанция об уплате государственной пошлины и консульского сбора;', en: 'Receipt of state duty and consular fee payment;' },
    'visa.req_gbao': { ru: 'Туристам, желающим посетить ГБАО или Памирский регион, необходимо предоставить письмо-запрос на разрешение посещения.', en: 'Tourists wishing to visit GBAO or Pamir region must provide a request letter for visit permission.' },
    'visa.form_download': { ru: '* Вы можете загрузить официальную анкету на получение таджикской туристической визы', en: '* You can download the official Tajik tourist visa application form' },
    'visa.here': { ru: 'здесь', en: 'here' },
    'visa.form_accepted': { ru: 'Эта анкета принимается во всех посольствах и консульствах Республики Таджикистан', en: 'This form is accepted at all embassies and consulates of the Republic of Tajikistan' },
    'visa.invitation_note': { ru: '** Письмо приглашение выдается ООО «Бунёд-Тур» туристам только в рамках туристического пакета, приобретенного с сайта компании —', en: '** Invitation letter is issued by Bunyod-Tour LLC only to tourists who purchase a tour package from the company website —' },
    
    // Official invitation section
    'visa.invitation_section': { ru: 'ОФИЦИАЛЬНОЕ ПРИГЛАШЕНИЕ', en: 'OFFICIAL INVITATION' },
    'visa.invitation_intro': { ru: 'Наша компания может предоставить официальное приглашение, однако только своим клиентам / туристам, которым необходимо перейти на наш сайт —', en: 'Our company can provide an official invitation, but only to our clients/tourists who need to visit our website —' },
    'visa.invitation_process': { ru: 'выбрать подходящий тур-пакет, далее заполнят форму заявки, в поле «Другие пожелания» описать запрос о получении официальной приглашении и бронировать / оплатить тур; в скором времени мы свяжемся с Вами.', en: 'select a suitable tour package, then fill out the application form, describe the request for official invitation in the "Other wishes" field and book/pay for the tour; we will contact you shortly.' },
    'visa.invitation_dates_note': { ru: 'Обратите внимание, что сроки прибывания должны совпадать со сроками выбранного турпакета; если необходимо, можно будет бронировать два и более турпакетов – это требования законодательства.', en: 'Please note that the stay dates must match the dates of the selected tour package; if necessary, you can book two or more tour packages - this is a legal requirement.' },
    
    // Document requirements section
    'visa.requirements_section': { ru: 'ТРЕБОВАНИЯ К ДОКУМЕНТАМ', en: 'DOCUMENT REQUIREMENTS' },
    'visa.doc_authenticity': { ru: 'Подлинность данных и копии паспорта или другого документа в электронном виде, представленного иностранным гражданином и лицом без гражданства не должна вызывать сомнений.', en: 'The authenticity of data and electronic copies of passport or other documents submitted by foreign citizens and stateless persons must be beyond doubt.' },
    'visa.doc_validity': { ru: 'Срок действия документа, как правило, должен составлять не менее 6 месяцев до окончания срока его действия.', en: 'The document validity period should generally be at least 6 months before its expiration.' },
    'visa.border_entry_title': { ru: 'Разрешающий въезд в приграничные районы Республики Таджикистан', en: 'Entry permit to border areas of the Republic of Tajikistan' },
    'visa.processing_time': { ru: 'Срок рассмотрения и оформления визы устанавливается не более 20-ти рабочих дней со дня обращения иностранного гражданина и лицо без гражданства, за исключением случаев, предусмотренных настоящими Правилами, также, если в соответствии с нормативными правовыми актами Республики Таджикистан и международными договорами, признанными Республикой Таджикистан, не предусмотрен иной порядок.', en: 'The visa processing and issuance period is set at no more than 20 working days from the date of application by a foreign citizen or stateless person, except in cases provided for by these Rules, and unless otherwise provided by regulatory legal acts of the Republic of Tajikistan and international treaties recognized by the Republic of Tajikistan.' },
    'visa.registration_requirement': { ru: 'Иностранные граждане, имеющие стандартную визу и на которых распространяется безвизовый режим въезда, пребывания и выезда из Республики Таджикистан, обязаны в течении 10 (десяти) рабочих дней зарегистрироваться в органах внутренних дел или в Министерстве иностранных дел Республики Таджикистан (только для работников дипломатических служб).', en: 'Foreign citizens with a standard visa and those under the visa-free entry, stay and exit regime of the Republic of Tajikistan are required to register within 10 (ten) working days with the internal affairs authorities or the Ministry of Foreign Affairs of the Republic of Tajikistan (only for diplomatic service employees).' },
    
    // Ключи для accommodation-regulation.html
    'accommodation.page_title': { ru: 'Положение о размещении - Bunyod-Tour', en: 'Accommodation Regulation - Bunyod-Tour' },
    'accommodation.main_title': { ru: 'ПОЛОЖЕНИЕ О РАЗМЕЩЕНИИ', en: 'ACCOMMODATION REGULATION' },
    'accommodation.intro_text': { ru: 'Данное положение регулирует вопросы размещения туристов в отелях и других местах размещения в Центральной Азии и Таджикистане в соответствии с общепризнанными стандартами и местными условиями.', en: 'This regulation governs tourist accommodation in hotels and other accommodations in Central Asia and Tajikistan in accordance with generally recognized standards and local conditions.' },
    'accommodation.hotel_types_title': { ru: 'I. ВИДЫ И КЛАССИФИКАЦИИ ОТЕЛЕЙ', en: 'I. TYPES AND CLASSIFICATIONS OF HOTELS' },
    'accommodation.no_unified_standard': { ru: '(Единой международной классификации на сегодня не существует. Всемирная туристическая организация в 1989 году утвердила стандарты гостиниц, но они носят рекомендательный характер и не обязательны для исполнения)', en: '(No unified international classification exists today. The World Tourism Organization approved hotel standards in 1989, but they are recommendatory and not mandatory)' },
    'accommodation.hotel_1star': { ru: 'Отель-1★', en: 'Hotel-1★' },
    'accommodation.hotel_1star_desc': { ru: 'Несколько номеров, минимальные удобства и уровень сервиса. В номере в наличии кровать, тумбочка, стул, шкаф или вешалка, зеркало. Туалет и ванная (душ) – на этаже (общая). Гостям предоставляется 2 полотенца. Номера убираются ежедневно, смена постели – раз в неделю.', en: 'A few rooms, minimal amenities and service level. The room has a bed, nightstand, chair, closet or hanger, mirror. Toilet and bathroom (shower) are shared on the floor. Guests receive 2 towels. Rooms cleaned daily, bed linen changed weekly.' },
    'accommodation.hotel_2star': { ru: 'Отель-2★', en: 'Hotel-2★' },
    'accommodation.hotel_2star_desc': { ru: 'Несколько номеров, минимальные удобства и уровень сервиса. В номере в наличии кровать, тумбочка, стул, шкаф или вешалка, зеркало. В номере есть туалет и ванная (душ). Гостям предоставляется 2 полотенца. Номера убираются ежедневно, смена постели – раз в неделю.', en: 'Several rooms, minimal amenities and service level. Room has bed, nightstand, chair, closet or hanger, mirror. Room has toilet and bathroom (shower). Guests receive 2 towels. Rooms cleaned daily, bed linen changed weekly.' },
    'accommodation.hotel_3star': { ru: 'Отель-3★', en: 'Hotel-3★' },
    'accommodation.hotel_3star_desc': { ru: 'Хорошие удобства и уровень сервиса. Наличие в номере холодильника, телевизора, телефона, туалетного столика, отдельного санузла с душем или ванной. Возможно наличие кондиционера и мини-бара. Гостям обязательно предлагается завтрак. Уборка в номерах и смена полотенец производится каждый день, замена постельного белья – 2 раза в неделю.', en: 'Good amenities and service level. Room has refrigerator, TV, telephone, vanity table, separate bathroom with shower or bath. May have air conditioning and mini-bar. Breakfast is mandatory. Rooms cleaned and towels changed daily, bed linen changed twice a week.' },
    'accommodation.hotel_4star': { ru: 'Отель-4★', en: 'Hotel-4★' },
    'accommodation.hotel_4star_desc': { ru: 'Отличные удобства и уровень сервиса. Комнаты просторные, можно выбрать номера разных категорий. В номерах обязательно есть телевизор, холодильник, кондиционер, мини-бар, небольшой сейф, халат, тапочки, телефон с возможностью звонить в другие города. Отдельный санузел с туалетными принадлежностями. Белье и полотенца обновляются ежедневно. Возможна химчистка, стирка, глажка одежды.', en: 'Excellent amenities and service level. Spacious rooms with various categories available. Rooms must have TV, refrigerator, AC, mini-bar, small safe, bathrobe, slippers, phone with inter-city calling. Separate bathroom with toiletries. Linen and towels changed daily. Dry cleaning, laundry, ironing available.' },
    'accommodation.hotel_5star': { ru: 'Отель-5★', en: 'Hotel-5★' },
    'accommodation.hotel_5star_desc': { ru: 'Наивысший комфорт и уровень сервиса. Номера просторные, часто многокомнатные, с роскошной обстановкой. Санузел оснащен лежачей ванной (джакузи) и душевой кабиной, набором качественных косметических средств, махровым халатом и тапочками. Уборка номеров и смена белья производится каждый день. К услугам гостей сеть ресторанов, магазины, сауны, бассейны.', en: 'Highest comfort and service level. Spacious rooms, often multi-room, with luxurious furnishings. Bathroom has jacuzzi bath and shower cabin, quality cosmetics set, terry bathrobe and slippers. Room cleaning and linen change daily. Restaurants, shops, saunas, pools available.' },
    'accommodation.central_asia_note_title': { ru: 'Особенности Центральной Азии', en: 'Central Asia Specifics' },
    'accommodation.central_asia_note': { ru: 'В условиях Центральной Азии, в том числе в Таджикистане, где 93% площади — это горы, не всегда отели соответствуют классификациям. Например, в большой части отелей номера оформлены с двумя односпальными кроватями (размером 80х190), но это не означает, что в номере должно быть обязательно два человека.', en: 'In Central Asia, including Tajikistan, where 93% of the area is mountains, hotels do not always meet classification requirements. For example, many hotels have rooms with two single beds (80x190), but this does not mean the room must have two people.' },
    'accommodation.hostel': { ru: 'Hostel', en: 'Hostel' },
    'accommodation.hostel_desc': { ru: 'Недорогая гостиница с небольшим набором услуг, многоместный номер с большим количеством кроватей и общей ванной.', en: 'Inexpensive hotel with limited services, multi-bed rooms with shared bathroom.' },
    'accommodation.guesthouse': { ru: 'Guesthouse', en: 'Guesthouse' },
    'accommodation.guesthouse_desc': { ru: 'Двух-трехэтажные здания с 20-30 номерами, домашней атмосферой и малым количеством персонала.', en: 'Two or three-story buildings with 20-30 rooms, homely atmosphere and small staff.' },
    'accommodation.hotel_garni': { ru: 'Hotel Garni', en: 'Hotel Garni' },
    'accommodation.hotel_garni_desc': { ru: 'Отель без ресторана (даже без завтрака).', en: 'Hotel without restaurant (even without breakfast).' },
    'accommodation.tourist_class': { ru: 'Tourist Class', en: 'Tourist Class' },
    'accommodation.tourist_class_desc': { ru: 'Гостиницы строго пансионного типа для гостей с очень скромными требованиями к комфорту.', en: 'Strictly boarding-type hotels for guests with very modest comfort requirements.' },
    'accommodation.room_categories_title': { ru: 'II-VII. КАТЕГОРИИ НОМЕРОВ', en: 'II-VII. ROOM CATEGORIES' },
    'accommodation.standard': { ru: 'Стандарт (Standard)', en: 'Standard' },
    'accommodation.standard_1': { ru: '• Стандартная мебель', en: '• Standard furniture' },
    'accommodation.standard_2': { ru: '• Спальня с удобной кроватью', en: '• Bedroom with comfortable bed' },
    'accommodation.standard_3': { ru: '• Ванная комната', en: '• Bathroom' },
    'accommodation.standard_4': { ru: '• ТВ, кондиционер, интернет', en: '• TV, AC, internet' },
    'accommodation.deluxe': { ru: 'Делюкс (De Luxe)', en: 'De Luxe' },
    'accommodation.deluxe_1': { ru: '• Стильный дизайн интерьера', en: '• Stylish interior design' },
    'accommodation.deluxe_2': { ru: '• Ванная и туалет отдельно', en: '• Separate bathroom and toilet' },
    'accommodation.deluxe_3': { ru: '• Мини-бар, халаты, тапочки', en: '• Mini-bar, bathrobes, slippers' },
    'accommodation.deluxe_4': { ru: '• Бассейн, сауна, фитнес', en: '• Pool, sauna, fitness' },
    'accommodation.suite': { ru: 'Сьют (Suite)', en: 'Suite' },
    'accommodation.suite_1': { ru: '• Роскошные 2-комнатные номера', en: '• Luxurious 2-room suites' },
    'accommodation.suite_2': { ru: '• Отдельная гостиная', en: '• Separate living room' },
    'accommodation.suite_3': { ru: '• Просторная ванная', en: '• Spacious bathroom' },
    'accommodation.suite_4': { ru: '• Возможен балкон или терраса', en: '• May have balcony or terrace' },
    'accommodation.premium': { ru: 'Премиум (Premium/Luxe)', en: 'Premium/Luxe' },
    'accommodation.premium_1': { ru: '• Личный батлер, VIP-зоны', en: '• Personal butler, VIP areas' },
    'accommodation.premium_2': { ru: '• Несколько спален', en: '• Multiple bedrooms' },
    'accommodation.premium_3': { ru: '• Лимузинное обслуживание', en: '• Limousine service' },
    'accommodation.premium_4': { ru: '• Эксклюзивные услуги', en: '• Exclusive services' },
    'accommodation.family': { ru: 'Семейный (Family Room)', en: 'Family Room' },
    'accommodation.family_1': { ru: '• Номера для 4+ человек', en: '• Rooms for 4+ people' },
    'accommodation.family_2': { ru: '• Дополнительные кровати', en: '• Extra beds available' },
    'accommodation.family_3': { ru: '• Игровые зоны для детей', en: '• Play areas for children' },
    'accommodation.family_4': { ru: '• Все удобства', en: '• All amenities' },
    'accommodation.economy': { ru: 'Эконом (Economy)', en: 'Economy' },
    'accommodation.economy_1': { ru: '• Однокомнатный номер', en: '• One-room accommodation' },
    'accommodation.economy_2': { ru: '• Стандартная мебель', en: '• Standard furniture' },
    'accommodation.economy_3': { ru: '• Двухместные кровати', en: '• Double beds' },
    'accommodation.economy_4': { ru: '• Минимальные удобства', en: '• Minimum amenities' },
    'accommodation.abbreviations_title': { ru: 'VIII. ОБОЗНАЧЕНИЯ РАЗМЕЩЕНИЯ', en: 'VIII. ACCOMMODATION DESIGNATIONS' },
    'accommodation.std': { ru: ' — стандартный номер', en: ' — standard room' },
    'accommodation.dbl': { ru: ' — двухместный номер с одной двуспальной кроватью', en: ' — double room with one double bed' },
    'accommodation.sgl': { ru: ' — одноместный номер', en: ' — single room' },
    'accommodation.twn': { ru: ' — двухместный с двумя односпальными кроватями', en: ' — twin room with two single beds' },
    'accommodation.tpl': { ru: ' — трехместный номер', en: ' — triple room' },
    'accommodation.qdpl': { ru: ' — четырехместный номер', en: ' — quadruple room' },
    'accommodation.dorm': { ru: ' — многоместный номер', en: ' — dormitory room' },
    'accommodation.eb': { ru: ' — дополнительная кровать', en: ' — extra bed' },
    'accommodation.sup': { ru: ' — улучшенный номер', en: ' — superior room' },
    'accommodation.checkin': { ru: ' — заселение (обычно 14:00)', en: ' — check-in (usually 14:00)' },
    'accommodation.checkout': { ru: ' — выезд (обычно 12:00)', en: ' — check-out (usually 12:00)' },
    'accommodation.foc': { ru: ' — бесплатные услуги', en: ' — free of charge services' },
    'accommodation.meals_title': { ru: 'IX. ПИТАНИЕ В МЕСТАХ РАЗМЕЩЕНИЯ', en: 'IX. MEALS IN ACCOMMODATION' },
    'accommodation.fb': { ru: 'Полный пансион — трехразовое питание (завтрак + обед + ужин). Напитки за обедом и ужином обычно не входят в стоимость.', en: 'Full Board — three meals a day (breakfast + lunch + dinner). Drinks at lunch and dinner usually not included.' },
    'accommodation.hb': { ru: 'Полупансион — двухразовое питание (завтрак + ужин или обед).', en: 'Half Board — two meals a day (breakfast + dinner or lunch).' },
    'accommodation.all': { ru: 'Все включено — трехразовое питание плюс закуски, напитки и дополнительные услуги.', en: 'All Inclusive — three meals plus snacks, drinks and extra services.' },
    'accommodation.bb': { ru: 'Номер с завтраком (Bed & Breakfast).', en: 'Bed & Breakfast — room with breakfast.' },
    'accommodation.bbf': { ru: 'Популярный вариант организации завтрака — шведский стол.', en: 'Popular breakfast option — buffet.' },
    
    // Ключи для website-guide.html (Руководство сайта / FAQ)
    'guide.page_title': { ru: 'Руководство сайта - Bunyod-Tour', en: 'Website Guide - Bunyod-Tour' },
    'guide.main_title': { ru: 'Руководство Веб-Сайта', en: 'Website User Guide' },
    'guide.intro_text': { ru: 'Вашему вниманию представляем инструкции по использованию услуг нашего веб-сайта.', en: 'We present to your attention the instructions for using the services of our website.' },
    'guide.services_title': { ru: '1. Наши Услуги', en: '1. Our Services' },
    'guide.services_text': { ru: 'Наш веб-сайт является центральноазиатским порталом туристских услуг и представляет собой интернет-портал по онлайн продажам 5 видов туристских продуктов: (1) туров, (2) экскурсий, (3) услуги тур-гида, (4) трансфер и (5) B2B-партнерство. А также в разделе «Собственный тур» вы можете разработать себе и по своему усмотрению и предпочтению персональный собственный тур.', en: 'Our website is a Central Asian portal for tourism services and offers online sales of five types of tourism products: (1) tours, (2) excursions, (3) tour guide services, (4) transfers, and (5) B2B partnerships. In the "Create your Tour" section, you can also create a personalized tour tailored to your needs and preferences.' },
    'guide.how_to_start_title': { ru: '1A. Как начать пользоваться веб-сайтом?', en: '1A. How to start using the website?' },
    'guide.how_to_start_text': { ru: 'Наш веб-сайт в использовании очень прост и содержит несколько важных для туриста услуг, в том числе туров по всем странам Центральной Азии. Для нахождения предпочтительного турпакета необходимо воспользоваться разделом «Поиска», включая фильтром туров.', en: 'Our website is very easy to use and offers several essential services for tourists, including tours to all Central Asian countries. To find your preferred tour package, use the "Search" section, including the tour filter.' },
    'guide.how_to_start_steps': { ru: 'Все что нужно, это знать: (1) куда вы собираетесь, какой (2) категории и (3) вид тура вы планируете бронировать и (4) сколько туристов вас. Таким образом как выберите эти параметры на фильтре раздела «Поиска», вы увидите все доступные туры. Заметьте на карточки туров вы найдете ответ на множество вопросов организационного характера.', en: 'All you need to know is (1) your destination, (2) the category and (3) type of tour you plan to book, and (4) how many tourists you have. Once you select these parameters in the "Search" section filter, you will see all available tours. Note that on the tour cards you will find answers to many organizational questions.' },
    'guide.currency_title': { ru: '1B. Валюта веб-сайта', en: '1B. Website currency' },
    'guide.currency_text': { ru: 'На нашем веб-сайте цены на все туристические продукты представлены в таких валютах как: TJS, US$, EUR, RUB, CNY. Чтобы изменить валюту, просто выберите нужную в меню. Однако основной валютой сайта является сомони (TJS).', en: 'On our website, prices for all travel products are presented in the following currencies: TJS, US$, EUR, RUB, and CNY. To change the currency, simply select the desired one from the menu. However, the site\'s primary currency is the Somoni (TJS).' },
    'guide.language_title': { ru: '1C. Язык веб-сайта', en: '1C. Website language' },
    'guide.language_text': { ru: 'В связи с тем, что наш веб-сайт является региональным порталом и его туристические продукты предназначены для наших иностранных гостей, основными языками сайта являются английский и русский. Чтобы изменить язык, просто выберите нужную в меню.', en: 'Since our website is a regional portal and its tourism products are intended for our international guests, the primary languages are English and Russian. To change the language, simply select the desired language from the menu.' },
    'guide.tours_title': { ru: '2. Туры', en: '2. Tours' },
    'guide.tours_text': { ru: 'Наши туры разделяются на 3 вида: (i) однодневные, (ii) многодневные и (iii) экскурсии и 15 категорий: городские, экологические, культурные, исторические, приключенческие и т.п., которых можно выбрать в меню «Туры» или фильтровать в разделе «Поиск», а также их можно выбрать или изучать по странам и городам в основном странице сайта.', en: 'Our tours are divided into 3 types: (i) one-day, (ii) multi-day and (iii) excursions and 15 categories: city, ecological, cultural, historical, adventure, etc., which can be selected in the "Tours" menu or filtered in the "Search" section, and they can also be selected or studied by countries and cities on the main page of the site.' },
    'guide.guide_services_title': { ru: '3. Услуги Тур-Гида', en: '3. Tour Guide Services' },
    'guide.guide_services_text1': { ru: 'Если пожелаете экономить бюджет и бронировать только услуги тур-гида, тогда в раздел «Услуги» воспользуйтесь порталом «Тур-гиды». Здесь ознакомитесь: со списком тур-гидов и их уровень профессионализма; доступности (наличие) тур-гида согласно ее/его локации для найма; их личные данные как пол, возраст, опыт и языки, которых обладают.', en: 'If you\'d like to save money and book only tour guide services, then use the "Tour Guides" portal in the "Services" section. Here you\'ll find: a list of tour guides and their level of professionalism; tour guide availability according to the hiring location; their personal information, such as gender, age, experience, and languages spoken.' },
    'guide.guide_services_text2': { ru: 'Выбрав (нажав на ФИО) желаемого тур-гида переходите на форму заявки, где необходимо:', en: 'After selecting (by clicking on the full name) the desired tour guide, proceed to the application form, where you need to:' },
    'guide.guide_step1': { ru: 'Выбрать даты (все дни), когда вам нужен гид (доступные даты выделены зеленым цветом)', en: 'Select dates (all days) when you need a guide (available dates are highlighted in green)' },
    'guide.guide_step2': { ru: 'В соответствующие колонки набрать ФИО, эл. почту, номер телефона', en: 'Enter your full name, email, and phone number in the appropriate columns' },
    'guide.guide_step3': { ru: 'В колонки «Комментарии» напечатать список туристов и других необходимых информаций', en: 'In the "Comments" column, type a list of tourists and other necessary information' },
    'guide.guide_services_text3': { ru: 'Далее увидите стоимость и, сможете бронировать и оплатит онлайн.', en: 'Next you will see the cost and you can book and pay online.' },
    'guide.guide_note': { ru: 'Примечание: рекомендуем перед бронированием ознакомится с Правилом оплаты и возврата средств.', en: 'Note: We recommend that you read the Payment and Refund Policy before booking.' },
    'guide.transfer_title': { ru: '4. Трансфер', en: '4. Transfer' },
    'guide.transfer_text1': { ru: 'Если пожелаете экономить бюджет и бронировать только услуги трансфер, транспорт с её водителем, тогда в раздел «Услуги» воспользуйтесь порталом «Трансфер». Здесь ознакомитесь: с парком (списком) наших автомобилей, их марка, мощности и год выпуска; доступности (наличие) автомобиля согласно ее/его локации для заказа.', en: 'If you\'d like to save money and book only transfer services or chauffeured transportation, then use the "Transfer" portal in the "Services" section. Here you\'ll find information about our fleet (list) of vehicles, including their make, engine size, and year of manufacture; and vehicle availability based on your booking location.' },
    'guide.transfer_text2': { ru: 'Выбрав (нажав на название) желаемого автомобиля переходите на форму заявки, где необходимо выбрать / указать:', en: 'After selecting (by clicking on the name) the desired vehicle, proceed to the application form, where you\'ll need to select/specify:' },
    'guide.transfer_step1': { ru: 'Вашего маршрута, включая место приема и место высадки', en: 'Your route, including pick-up location and drop-off location' },
    'guide.transfer_step2': { ru: 'Дату начало поездки и время приема', en: 'The start date of the trip and the time of reception' },
    'guide.transfer_step3': { ru: 'Дату завершения поездки и время высадки', en: 'Trip completion date and drop-off time' },
    'guide.transfer_step4': { ru: 'Нужно набрать список туристов и других необходимых информаций', en: 'We need to collect a list of tourists and other necessary information' },
    'guide.transfer_text3': { ru: 'Далее увидите стоимость и, сможете бронировать и оплатит онлайн.', en: 'Next you will see the cost and you can book and pay online.' },
    'guide.transfer_note': { ru: 'Примечание: рекомендуем перед бронированием ознакомится с Правилом оплаты и возврата средств.', en: 'Note: We recommend that you read the Payment and Refund Policy before booking.' },
    'guide.custom_tour_title': { ru: '5. Собственный Тур', en: '5. Custom Tour' },
    'guide.custom_tour_text1': { ru: 'Если наши пакеты не устраивают Вас, то можно самим создать собственный тур, с нами это легко!', en: 'If our packages don\'t suit you, you can create your own tour – it\'s easy with us!' },
    'guide.custom_tour_text2': { ru: 'Для этого необходимо в раздел «Услуги» зайти в портал «Собственный тур». Здесь представляются две вида турпродуктов: 1) по умолчанию и 2) на выбор. Заметьте, во время выбора каждого турпродукта на правой стороне автономно формируется стоимость вашего тура (для информации).', en: 'To do this, go to the "Services" section of the "Custom Tour" portal. Two types of tour products are available here: 1) default and 2) custom. Note that as you select each tour product, the price of your tour is automatically calculated on the right side (for reference).' },
    'guide.custom_tour_text3': { ru: 'Таким образом, необходимо будет:', en: 'Thus, it will be necessary:' },
    'guide.custom_step1': { ru: 'Напечатать ФИО руководителя группы туристов (если один, то ФИО самого туриста)', en: 'Type the full name of the tour group leader (if there is only one, then the full name of the tourist)' },
    'guide.custom_step2': { ru: 'Телефон и электронную почту', en: 'Phone number and email address' },
    'guide.custom_step3': { ru: 'Набрать список туристов, и их пол, и год рождения', en: 'Enter a list of tourists, including their gender and year of birth' },
    'guide.custom_step4': { ru: 'Выбрать срок тура (сколько дней?)', en: 'Select the tour duration (how many days?)' },
    'guide.custom_step5': { ru: 'Указать дату начало поездки и время приема', en: 'Specify the start date and pick-up time' },
    'guide.custom_step6': { ru: 'Выбрать направления тура – страны и города', en: 'Select tour destinations – countries and cities' },
    'guide.custom_step7': { ru: 'Выбрать желаемые места посещения (туристские достопримечательности)', en: 'Select desired places to visit (tourist attractions)' },
    'guide.custom_step8': { ru: 'Выбрать тип питания (полный пансион или только завтрак, или полупансион)', en: 'Select meal plan (full board, breakfast only, or half board)' },
    'guide.custom_step9': { ru: 'Выбрать гостиницу и категорий номера', en: 'Select hotel and room categories' },
    'guide.custom_step10': { ru: 'По умолчанию представляется тип автомобиля (марка, мощности и год выпуска)', en: 'Vehicle type (make, engine, and year of manufacture) is displayed by default' },
    'guide.custom_step11': { ru: 'По умолчанию представляется тур-гид относительно языка разговора', en: 'Tour guide language is displayed by default' },
    'guide.custom_tour_note': { ru: 'Заметьте: для тура в два и более стран нужно будет выбрать 4 и более дней (2 страна=4 дня, 3 страна=8 дней, 4=12 дней и 5=16 дней).', en: 'Note: for a tour of two or more countries, you will need to select 4 or more days (2nd country = 4 days, 3rd country = 8 days, 4th = 12 days, and 5th = 16 days).' },
    'guide.custom_tour_text4': { ru: 'По завершению, далее увидите общую стоимость составленного тура, и сможете бронировать и оплатит онлайн.', en: 'Upon completion, you will see the total cost of the tour and will be able to book and pay online.' },
    'guide.b2b_title': { ru: '6. B2B Партнерство', en: '6. B2B Partnership' },
    'guide.b2b_text1': { ru: 'Наши партнёры делятся на две группы: стратегические партнёры и туристические партнёры. Со стратегическими партнёрами мы работаем по традиционному принципу, но с туристическими партнёрами, также известными как турагентства, мы работаем преимущественно через онлайн-платформы, в частности, через наш веб-сайт.', en: 'Our partners are divided into two groups: strategic partners and travel partners. We collaborate with strategic partners in a conventional manner, but we primarily engage with travel partners, also referred to as travel agencies, via online platforms, particularly our website.' },
    'guide.b2b_text2': { ru: 'Наше предложение будущим тур-партнерам (турагентам) это вознаграждение (комиссия) в размере 10% от стоимости реализованных (проданных) турпакетов, которые размещены (опубликованы) на нашем веб-сайте по адресу https://bunyodtour.tj.', en: 'We offer a commission of 10% of the cost of sold tour packages posted on our website at https://bunyodtour.tj to travel agents interested in becoming our travel partners.' },
    'guide.b2b_text3': { ru: 'Обратите внимание, что у нас нет строгих ограничений по выбору турагентов — нашим тур-партнером (турагентом) может стать любое физическое или юридическое лицо, отвечающее основным критериям и требованиям турагента и проживающее или осуществляющее деятельность на территории стран Центральной Азии.', en: 'Please note that we do not have strict restrictions on the selection of travel agents. Any individual or legal entity that meets the basic criteria and requirements of a travel agent and resides or operates in the countries of Central Asia can become our travel partner.' },
    'guide.b2b_text4': { ru: 'Таким образом, чтобы стать нашим тур-партнером необходимо воспользоваться порталом «Турагентам» в разделе «Услуги». Здесь вам необходимо: 1) ознакомится с электронном Договором, включая условия партнёрства; 2) подписать Партнерский Договор (отметив галочками соответствующие поля); 3) заполнить все поля формы заявки; 4) прикрепить скан-копию необходимых документов и отправить их на рассмотрение. В случае подтверждения вы получите уведомление на указанный вами адрес электронной почты для доступа к личному кабинету.', en: 'To become our travel partner, please visit the "Tour Agents" portal in the "Services" section. Here you will need to: 1) review the online Agreement, including the partnership terms; 2) sign the Partnership Agreement (by checking the appropriate boxes); 3) complete all fields of the application form; 4) attach a scanned copy of the required documents and submit them for review. If approved, you will receive a notification to the email address you provided to access your personal account.' },
    'guide.personal_tour_title': { ru: '7. Что Такое «Персональный Тур»?', en: '7. What Is a "Private Tour"?' },
    'guide.personal_tour_text': { ru: 'Стандартный тип тура, индивидуальный, услуги предоставляются персонально. Туристский пакет может быть бронирован со стороны одного или нескольких лиц; оплата взимается за каждого человека.', en: 'Standard tour type, individual, services are provided personally. The tour package can be booked by one or more people; payment is charged per person.' },
    'guide.group_private_title': { ru: '8. Что Такое «Групповой Тур, Персональный»?', en: '8. What Is a "Group Tour, Private"?' },
    'guide.group_private_text': { ru: 'Комфортный тип тура, групповой, индивидуальный; услуги предоставляются персонально (индивидуально). В группе может быть один или несколько туристов в указанное (ограниченное) количество; оплата взимается за группу.', en: 'A comfortable tour type, group or individual; services are provided on a personal (individual) basis. A group may consist of one or more tourists, up to a specified (limited) number; payment is charged per group.' },
    'guide.group_shared_title': { ru: '9. Что Такое «Групповой Тур, Общий»?', en: '9. What Is a "Group Tour, Shared"?' },
    'guide.group_shared_text': { ru: 'Экономный (бюджетный) тип тура, групповой, общий. В группу каждый может записаться, услуги предоставляются всем одинаково, количество туристов ограничено (указывается на карточки тура); оплата взимается за каждого человека.', en: 'This is a budget tour type, group tour, and shared tour. Anyone can join the group, services are provided equally to everyone, and the number of tourists is limited (indicated on the tour card); payment is charged per person.' },
    'guide.group_shared_warning': { ru: '<strong>⚠ Внимание:</strong> если группа не наберет полную численность, зарегистрированным туристам будет предложен выбор альтернативных турпакетов.', en: '<strong>⚠ Attention:</strong> If the group does not reach its full capacity, registered tourists will be offered a choice of alternative tour packages.' },
    'guide.one_day_title': { ru: '10. Однодневный Тур', en: '10. One-Day Tour' },
    'guide.one_day_text': { ru: 'Представляется комплекс туристических услуг в течении одного дня, продолжительностью 5-12 часов; проживание не предусмотрено.', en: 'A package of tourist services which is provided for one day, lasting 5-12 hours; accommodation is not included.' },
    'guide.multi_day_title': { ru: '11. Многодневный Тур', en: '11. Multi-Day Tour' },
    'guide.multi_day_text': { ru: 'Представляется комплекс туристических услуг в течение двух или более дней. Продолжительность каждого дня составляет от 5 до 12 часов в зависимости от условий путешествия и сложности тура. Дополнительное время, по желанию туриста, оплачивается дополнительно в размере 10 долларов США в час (с экипажа).', en: 'A comprehensive package of tourist services which is provided over two or more days. Each day lasts from 5 to 12 hours, depending on travel conditions and the complexity of the tour. Additional time, at the tourist\'s request, is charged at an additional $10 per hour (per crew).' },
    'guide.excursion_title': { ru: '12. Экскурсия', en: '12. Excursion' },
    'guide.excursion_text': { ru: 'Представляется один или несколько видов туристических услуг, в основном, в центральных городах в течении 2-4 часа. Это групповой, экономичный (бюджетный) тип тура, в которой каждый может записаться, услуги предоставляются всем одинаково, количество туристов ограничено (указывается на карточки тура).', en: 'One or more types of tourist services are offered, primarily in central cities, for 2-4 hours. This is a group, budget tour type in which anyone can sign up, services are provided equally to everyone, and the number of tourists is limited (indicated on the tour card).' },
    'guide.promotion_title': { ru: '13. Акция', en: '13. Promotion' },
    'guide.promotion_text1': { ru: 'Это особая привилегия для туристов, забронировавших любой многодневный тур в категории «Персональный тур» или «Групповой тур, персональный» не позднее чем за 12 месяцев до начала тура.', en: 'This is a special privilege for tourists who book any multi-day tour in the "Private Tour" or "Private Group Tour" categories no later than 12 months before the tour start date.' },
    'guide.promotion_text2': { ru: 'Кэшбэк для таких туристов составляет от 12% от стоимости забронированного тура по формуле: 12 месяцев = 12%; 13 месяцев = 13%; 14 месяцев = 14%; 15 месяцев = 15% и так далее до 20 месяцев. Кэшбэк возвращается туристам в течение 10 рабочих дней (с даты оплаты).', en: 'Cashback for such tourists amounts to 12% of the booked tour cost according to the following formula: 12 months = 12%; 13 months = 13%; 14 months = 14%; 15 months = 15%, and so on up to 20 months. Cashback is returned to tourists within 10 business days (from the date of payment).' },
    'guide.promotion_text3': { ru: 'А также другие виды акции будут объявлены на сайте.', en: 'Other types of promotions will also be announced on the website.' },
    'guide.last_minute_title': { ru: '14. Горящие Туры', en: '14. Last Minute Tours' },
    'guide.last_minute_text': { ru: 'Это специальная, но необходимая мера со стороны туроператора, в рамках которой туры предлагаются по сниженным ценам от 10% до 50%. Срок бронирования горящих туров будет ограничен, поэтому вам следует поторопиться с бронированием.', en: 'This is a special but necessary measure by the tour operator, offering tours at discounted prices ranging from 10% to 50%. The booking window for last-minute tours will be limited, so you should book quickly.' },
    'guide.book_now_title': { ru: '15. Бронируй Сейчас – Плати Позже', en: '15. Book Now – Pay Later!' },
    'guide.book_now_text1': { ru: 'Это привилегия доступна только для туров по категории «Групповой тур, общий».', en: 'This benefit is only available for tours in the "Group Tour, Shared" category.' },
    'guide.book_now_text2': { ru: 'Туристы, забронировавшие (зарегистрировавшиеся) заранее на групповой общий тур, могут внести депозит всего в размере всего 10% от стоимости тура, чтобы записаться на тур, а баланс суммы (90%) необходимо оплатить (a) наличными в первый день тура или (b) другими приемлемыми методами оплаты за 72 часа до начала тура.', en: 'Tourists who have booked (registered) in advance for a group shared tour can make a deposit of just 10% of the tour cost to sign up for the tour, with the balance (90%) due (a) in cash on the first day of the tour or (b) by other accepted payment methods 72 hours before the tour start.' },
    'guide.book_now_text3': { ru: 'Однако регистрация (запись) должна быть завершена не позднее, чем за 30 дней до начала тура.', en: 'However, registration (enrollment) must be completed no later than 30 days before the tour start.' },
    'guide.free_cancel_title': { ru: '16. Бесплатная Отмена', en: '16. Free Cancellation' },
    'guide.free_cancel_text1': { ru: 'Отмена забронированного тура (всех видов тура) и полный возврат средств возможен за 30 дней до начала тура (по местному времени, UTC +5). В этом случае возврат средств осуществляется в размере 100%.', en: 'You can cancel your booked tour (all types of tours) and receive a full refund up to 30 days before the tour start date (local time, UTC +5). In this case, a 100% refund is issued.' },
    'guide.free_cancel_text2': { ru: 'Однако данная бонусная опция не распространяется на тех, кто забронировал тур в течение этого периода (30 дней до даты начала тура).', en: 'However, this bonus option does not apply to those who booked a tour within this period (30 days before the tour start date).' },
    'guide.free_cancel_note': { ru: 'Подробные детали в Правилах оплаты и возврата денежных средств.', en: 'For more details, see the Payment and Refund Policy.' },
    'guide.accommodation_title': { ru: '17. Как Выбрать Опции по Проживанию?', en: '17. How to Choose Accommodation Options?' },
    'guide.accommodation_text1': { ru: 'На нашем веб-сайте представлено широкий возможность размещения с доступными ценами в двух опций: 1) базовый и 2) комфорт.', en: 'Our website offers a wide range of accommodation options at affordable prices in two options: 1) basic and 2) comfort.' },
    'guide.accommodation_text2': { ru: 'Опция «Базовый» представляет собой гостиницы малого типа с ограниченными видами услуг для проживания, такие как хостели, гестхоусы и т.п.', en: 'The "Basic" option represents small hotels with limited accommodation services, such as hostels, guesthouses, etc.' },
    'guide.accommodation_text3': { ru: 'Опция «Комфорт» представляет на выбор различных гостиниц, начиная от 2 до 5 звезд; номера, стандартные с хорошими условиями проживания.', en: 'The "Comfort" option offers a choice of various hotels, ranging from 2 to 5 stars; standard rooms with good living conditions.' },
    'guide.accommodation_point1': { ru: 'Замете, все цены многодневных туров автономно включают размещению с опцией «Базовый». Это означает, что если пожелаете сэкономить и бронировать тур с опцией «Базовый», тогда можете пропускать второй этап бронирования, нажимая кнопку «Продолжить с базовым отелем».', en: 'Please note that all multi-day tour prices include accommodation with the "Basic" option. This means that if you want to save money and book a tour with the "Basic" option, you can skip the second step of booking by clicking the "Continue with Basic Hotel" button.' },
    'guide.accommodation_point2': { ru: 'Однако, если пожелаете бронировать тур с опцией «Комфорт», тогда на втором этапе бронирования нужно будет выбрать желаемые гостиницы и тип номера. Следовательно, при выборе гостиниц цена на базовую опцию снимается; Вы можете это увидеть на правой стороне страницы.', en: 'However, if you wish to book a tour with the "Comfort" option, you will need to select your desired hotels and room type in the second step of the booking process. Therefore, when selecting hotels, the price for the basic option is deducted; you can see this on the right side of the page.' },
    'guide.accommodation_point3': { ru: 'Пожалуйста при выборе отелей и номеров будьте бдительны – нужно выбрать номера (а) в соотношении с количеством туристов и (б) количество ночей по городам проживания.', en: 'Please be careful when choosing hotels and rooms - you need to select rooms (a) in relation to the number of tourists and (b) the number of nights by city of residence.' },
    'guide.accommodation_warning': { ru: '<strong>⚠ Внимание:</strong> в случае форс-мажора и бронирования турпродукта менее чем за 30 дней до начала тура, существует вероятность, что отель может быть заменен на отель той же или более высокой категории.', en: '<strong>⚠ Attention:</strong> in case of force majeure and booking of a tour product less than 30 days before the start of the tour, there is a possibility that the hotel may be replaced with a hotel of the same or higher category.' },
    'guide.payment_title': { ru: '18. Как Оплатить за Тур / Услуги?', en: '18. How to Pay for Tour / Services?' },
    'guide.payment_text1': { ru: 'На нашем сайте доступна система онлайн-оплаты. После выбора всех компонентов на последнем этапе вам будут предложены для выбора два варианта оплаты: (1) полная оплата и (2) депозит - 25% (или 10% для групповых туров, общий) от стоимости тура.', en: 'Our website offers an online payment system. After selecting all components, you will be presented with two payment options at the final stage: (1) full payment and (2) a deposit of 25% (or 10% for group tours, total) of the tour cost.' },
    'guide.payment_warning': { ru: '<strong>⚠ Внимание:</strong> если выбираете второй вариант, баланс (остатку) нужно будет оплатить (1) наличными в первый день тура или (2) другими приемлемыми методами оплаты за 72 часов до начала тура.', en: '<strong>⚠ Attention:</strong> If you choose the second option, the remaining balance will need to be paid (1) in cash on the first day of the tour or (2) by other accepted payment methods 72 hours before the tour start.' },
    'guide.payment_text2': { ru: 'Для оплаты можно воспользоваться, в основном, банковскими картами Visa, Mastercard, Корти Милли и Мир.', en: 'Visa, Mastercard, Korti Milli, and Mir bank cards are generally accepted for payment.' },
    'guide.other_payment_title': { ru: '19. Другие Методы Оплаты', en: '19. Other Payment Methods' },
    'guide.other_payment_text': { ru: 'Другие методы оплаты, которые являются приемлемыми для нас, включают онлайн-кошельки (в том числе Paysend), криптовалюты, оплату банковскими картами Visa, Mastercard или через системы переводов, доступные в странах, таких как Western Union, Корона и т.п.', en: 'Other payment methods we accept include online wallets (including Paysend), cryptocurrencies, Visa and Mastercard bank cards, or transfer systems available in the countries such as Western Union, Corona, etc.' },
    'guide.reviews_title': { ru: '20. Отзывы о Наших Услугах', en: '20. Reviews of Our Services' },
    'guide.reviews_text': { ru: 'Чтобы прочитать отзывы о наших услугах и оценить компетентность нашей команды, посетите страницу «Отзывы».', en: 'To read reviews of our services and evaluate the competence of our team, please visit the "Reviews" page.' },
    'guide.submit_review_title': { ru: '21. Как Оставить Отзыв?', en: '21. How to Submit a Review?' },
    'guide.submit_review_text1': { ru: 'Мы будем рады получить ваши отзывы о нашем сервисе. Запрос для отзыва будет отправлена нашим туристам по электронной почте после завершения тура (заказа).', en: 'We welcome your feedback on our service. A request for feedback will be sent to our tourists via email after their tour (order) is complete.' },
    'guide.submit_review_text2': { ru: 'У вас есть возможность оценить и оставить отзыв о нашем гиде и туре по пятизвёздочной шкале, обозначенной соответствующими значками, где 1 — очень плохо (низкий рейтинг) и 5 — отлично (высший рейтинг). Также вы можете написать свои мысли и советы в предоставленном поле.', en: 'You can rate and review our guide and tour on a five-star scale, marked with the appropriate icons, where 1 is very poor (low rating) and 5 is excellent (highest rating). You can also write your thoughts and advice in the space provided.' },
    
    // Ключи для tour-guides.html
    'guides.page_title': { ru: 'Тургиды - Bunyod-Tour', en: 'Tour Guides - Bunyod-Tour' },
    'guides.main_title': { ru: 'НАШИ ТУРГИДЫ', en: 'OUR TOUR GUIDES' },
    'guides.coming_soon': { ru: 'Скоро здесь появятся наши тургиды', en: 'Our tour guides will appear here soon' },
    'guides.hire_guide': { ru: 'Нанять тургида', en: 'Hire a Tour Guide' },
    'guides.select_dates': { ru: 'Выберите даты', en: 'Select Dates' },
    'guides.cost_calculation': { ru: 'Расчет стоимости', en: 'Cost Calculation' },
    'guides.your_data': { ru: 'Ваши данные', en: 'Your Information' },
    'guides.submit_hire_request': { ru: 'Отправить заявку на найм', en: 'Submit Hire Request' },
    'guides.price_per_day': { ru: 'Цена за день:', en: 'Price per day:' },
    'guides.selected_days': { ru: 'Выбрано дней:', en: 'Selected days:' },
    'guides.total': { ru: 'Итого:', en: 'Total:' },
    
    // === ОСОБЫЕ ОТМЕТКИ (SPECIAL NOTES) ===
    'special.page_title': { ru: 'Особые отметки - Bunyod-Tour', en: 'Special Notes - Bunyod-Tour' },
    'special.main_title': { ru: 'Особые отметки', en: 'Special Notes' },
    'special.main_description': { ru: 'Особые отметки — это нормативно-правовые и поведенческие нормы, содержащиеся в договорной основе наших услуг и туров, которые предоставляются туристам в качестве информации и рекомендации при бронировании наших туров/услуг.', en: 'Special Notes are the legal and behavioral norms contained in the contractual basis of our services and tours, which are provided to tourists as information and recommendations when booking our tours/services.' },
    'special.company_policy_title': { ru: '1. Политика Компании', en: '1. Company Policy' },
    'special.company_policy_text': { ru: 'Обеспечение всем гостям атмосферу доверия, комфорта и справедливого отношения. Мы придерживаемся правовых норм, этических стандартов и международно признанных стандартов предоставления услуг и практики оплаты. Мы приветствуем предложения туристов по улучшению наших услуг.', en: 'To provide all guests with an atmosphere of trust, comfort and fair treatment. We adhere to legal regulations, ethical standards and internationally accepted standards for service provision and payment practices. We welcome suggestions from tourists to improve our services.' },
    'special.legal_aspects_title': { ru: '2. Правовые аспекты', en: '2. Legal Aspects' },
    'special.legal_aspects_text': { ru: 'Любые отношения, споры и претензии между Компанией и туристом регулируются законодательством Республики Таджикистан.', en: 'Any relations, disputes and claims between the Company and the tourist are governed by the laws of the Republic of Tajikistan.' },
    'special.offer_agreement_title': { ru: '3. Оферта-договор', en: '3. Offer-Agreement' },
    'special.offer_agreement_text': { ru: 'Оферта-договор — это публичное предложение для туриста, которое является типовой формой договора о предоставлении туристских услуг и опубликован на веб-сайте http://bunyodtour.tj.', en: 'The Offer-Agreement is a public offer for tourists, which is a standard form of agreement for the provision of tourist services and is published on the website http://bunyodtour.tj.' },
    'special.offer_acceptance_title': { ru: '4. Акцепт оферты', en: '4. Offer Acceptance' },
    'special.offer_acceptance_text': { ru: 'Акцепт оферты — это согласие туриста с условиями Оферты-договора. Турист акцептует (принимает) условия оферты-договора путём заполнения онлайн-формы с личными данными и оплаты тура или услуги.', en: 'Offer acceptance is the tourist\'s agreement to the terms of the Offer-Agreement. The tourist accepts the terms of the offer-agreement by filling out an online form with personal data and paying for the tour or service.' },
    'special.website_title': { ru: '5. Веб-сайт', en: '5. Website' },
    'special.website_text': { ru: 'Веб-сайт — это веб-сайт нашей Компании, расположенный по адресу http://bunyodtour.tj.', en: 'Website is our Company\'s website located at http://bunyodtour.tj.' },
    'special.client_title': { ru: '6. Клиент (турист)', en: '6. Client (Tourist)' },
    'special.client_text': { ru: 'Клиент (турист) — это физическое лицо, которое заказывает и/или оплачивает туристические услуги для себя или третьих лиц.', en: 'A client (tourist) is an individual who orders and/or pays for tourist services for themselves or third parties.' },
    'special.tour_product_title': { ru: '7. Туристский продукт', en: '7. Tour Product' },
    'special.tour_product_text': { ru: 'Туристский продукт — это комплекс туристских услуг, состоящий как минимум из двух (2) компонентов: транспортировка и услуги гида-переводчика, а также другие услуги, не являющиеся дополнительными к транспортировке или услуг гида-переводчика, такие как: размещение, питание, экскурсии и другие туристические услуги.', en: 'A tour product is a package of tourist services consisting of at least two (2) components: transportation and guide-interpreter services, as well as other services that are not additional to transportation or guide-interpreter services, such as: accommodation, meals, excursions and other tourist services.' },
    'special.tour_types_title': { ru: '8. Типы туров', en: '8. Types of Tours' },
    'special.tour_types_text': { ru: 'Типы туров: (1) Персональный тур — комфортный тип тура, индивидуальный, услуги предоставляются персонально; оплата взимается за группу; (2) Групповой тур, персональный — комфортный тип тура, групповой, индивидуальный; услуги предоставляются персонально; оплата взимается за группу; (3) Групповой тур, общий — экономный тип тура, групповой, общий; оплата взимается за человека.', en: 'Types of tours: (1) Private Tour - comfortable tour type, individual, services are provided personally; payment is charged per group; (2) Group Tour, Private - comfortable tour type, group, individual; services are provided personally; payment is charged per group; (3) Group Tour, Shared - budget tour type, group, shared; payment is charged per person.' },
    'special.tour_time_types_title': { ru: '9. Виды туров', en: '9. Tour Types by Duration' },
    'special.tour_time_types_text': { ru: 'Виды туров по времени: (1) Однодневный тур — турпакет в течение одного дня, продолжительностью 5-12 часов; (2) Многодневный тур — турпакет в течение двух или более дней; (3) Экскурсия — один или несколько видов туруслуг в центральных городах в течении 2-4 часа.', en: 'Types of tours by duration: (1) One-day tour - a tour package for one day, lasting 5-12 hours; (2) Multi-day tour - a tour package for two or more days; (3) Excursion - one or more types of tour services in central cities for 2-4 hours.' },
    'special.booked_product_title': { ru: '10. Забронированный турпродукт', en: '10. Booked Tour Product' },
    'special.booked_product_text': { ru: 'Забронированный турпродукт — это оплаченный турпродукт (ваучер), выданный туристу после акцепта оферты-договора, онлайн заявки (заказа) турпродукта и оплаты.', en: 'A booked tour product is a paid tour product (voucher) issued to the tourist after acceptance of the offer-agreement, online application (order) for the tour product and payment.' },
    'special.application_title': { ru: '11. Заявка (заказ) турпродукта', en: '11. Tour Product Application (Order)' },
    'special.application_text': { ru: 'Заявка (заказ) турпродукта — онлайн заявка для бронирования турпродукта, в котором турист указывает свои данные (ФИО, номера паспортов, контакты) и др. информации.', en: 'A tour product application (order) is an online application for booking a tour product, in which the tourist indicates their data (full name, passport numbers, contacts) and other information.' },
    'special.confirmation_title': { ru: '12. Подтверждение заявки', en: '12. Application Confirmation' },
    'special.confirmation_text': { ru: 'Подтверждение заявки на турпродукт — это официальное подтверждение бронирования турпродукта после получения оплаты.', en: 'Tour product application confirmation is the official confirmation of the tour product booking after payment is received.' },
    'special.payment_product_title': { ru: '13. Оплата турпродукта', en: '13. Tour Product Payment' },
    'special.payment_product_text': { ru: 'Оплата турпродукта — это внесение туристом (от имени туриста) полной суммы или депозита за турпродукт через систему онлайн-оплаты веб-сайта или иными методами оплаты.', en: 'Tour product payment is the tourist (or on behalf of the tourist) making a full payment or deposit for the tour product through the website\'s online payment system or other payment methods.' },
    'special.payment_policy_title': { ru: '14. Политика оплаты', en: '14. Payment Policy' },
    'special.payment_policy_text': { ru: 'Политика оплаты — документ, регулирующий порядок оплаты за туристические услуги и опубликован на веб-сайте http://bunyodtour.tj.', en: 'Payment Policy is a document regulating the procedure for payment for tourist services and is published on the website http://bunyodtour.tj.' },
    'special.refund_policy_title': { ru: '15. Политика оплаты и возврата', en: '15. Payment and Refund Policy' },
    'special.refund_policy_text': { ru: 'Политика оплаты и возврата денежных средств — документ, регулирующий порядок оплаты и возврата за туристические услуги и опубликован на веб-сайте http://bunyodtour.tj.', en: 'Payment and Refund Policy is a document regulating the procedure for payment and refund for tourist services and is published on the website http://bunyodtour.tj.' },
    'special.free_cancellation_title': { ru: '16. Бесплатная отмена', en: '16. Free Cancellation' },
    'special.free_cancellation_text': { ru: 'Отмена забронированного тура и полный возврат средств (100%) возможен за 30 дней до начала тура (по местному времени, UTC +5). Данная опция не распространяется на тех, кто забронировал тур в течение 30 дней до даты начала тура.', en: 'Cancellation of a booked tour and a full refund (100%) is possible 30 days before the tour start (local time, UTC +5). This option does not apply to those who booked a tour within 30 days before the tour start date.' },
    'special.free_cancellation_loi': { ru: 'Этот бонус не распространяется на забронированные туристические пакеты, для которых требуется официальное приглашение.', en: 'This bonus does not apply to booked travel packages that require a Letter of Official Invitation (LOI).' },
    'special.early_booking_title': { ru: '17. Раннее бронирование', en: '17. Early Booking (Book Now - Pay Later!)' },
    'special.early_booking_text': { ru: 'Бронируй сейчас — плати потом! Туристы могут внести депозит всего 10% от стоимости тура, а остаток (90%) необходимо оплатить наличными в первый день тура или другими методами оплаты за 72 часа до начала тура. Регистрация должна быть завершена не позднее, чем за 30 дней до начала тура. Эта опция доступна только для туров категории «Групповой тур, общий».', en: 'Book now - pay later! Tourists can make a deposit of just 10% of the tour cost, with the balance (90%) due in cash on the first day of the tour or by other payment methods 72 hours before the tour start. Registration must be completed no later than 30 days before the tour start. This option is only available for "Group Tour, Shared" category tours.' },
    'special.last_minute_title': { ru: '18. Горящие туры', en: '18. Last Minute Tours' },
    'special.last_minute_text': { ru: 'Бронируйте туры и экскурсии по доступным ценам прямо сейчас! Горящие туры доступны на нашем сайте только в определённое время, незадолго до начала тура. Горящие туры можно найти в разделе «Спецпредложения».', en: 'Book tours and excursions at affordable prices now! Last-minute tours are available on our website only at specific times, just a short time before the tour starts. You can find last-minute tours in the "Special Offers" section.' },
    'special.special_offers_title': { ru: '19. Акции', en: '19. Special Offers' },
    'special.special_offers_text': { ru: 'Забронируйте любой тур за 12 месяцев заранее и сэкономьте 12% — и получите другие бонусы только у нас! Следите за горящими предложениями и экономьте от 10% до 20% на турпакетах.', en: 'Book any tour 12 months in advance and save 12% — and enjoy other perks only with us! Stay up-to-date with last-minute deals and save 10% to 20% on package tours.' },
    'special.primary_currency_title': { ru: '20. Основная валюта', en: '20. Primary Currency' },
    'special.primary_currency_text': { ru: 'Основной валютой сайта является сомони (TJS), поэтому все платежи будут производиться в сомони (TJS). Другие валюты, такие как USD, евро, рубль и юань, представлены в качестве справочных валют.', en: 'The site\'s primary currency is the somoni (TJS), so all payments will be made in somoni (TJS). Other currencies, such as the USD, Euro, Ruble, and Yuan, are presented as reference currencies.' },
    'special.payment_methods_title': { ru: '21. Методы оплаты', en: '21. Payment Methods' },
    'special.payment_methods_text': { ru: 'Для оплаты туров/услуг вы можете использовать такие способы оплаты, как банковские счета (TJS, US$, EUR и RUB), карты Visa, Mastercard, Корти Милли, Мир, а также онлайн-кошельки и криптовалюты (подробнее см. в Правилах оплаты и возврата).', en: 'To pay for tours/services, you can use payment methods such as bank accounts (TJS, US$, EUR and RUB), Visa, Mastercard, Korti Milli, Mir cards, as well as online wallets and cryptocurrencies (for more details, see the Payment and Refund Rules).' },
    'special.changes_title': { ru: '22. Изменения в турпродукт', en: '22. Changes to the Tour Product' },
    'special.changes_text': { ru: 'Любые изменения в турпродукт или другие условия заявки на бронирование допускаются по соглашению сторон не позднее чем за 48 часов до начала тура.', en: 'Any changes to the Tour Product or other conditions of the Booking Application are permitted by agreement of the Parties no later than 48 hours before the start of the tour.' },
    'special.accommodation_title': { ru: '23. Политика размещения', en: '23. Accommodation Policy' },
    'special.accommodation_text': { ru: 'Размещение — это варианты (отели), представленные в системе бронирования на веб-сайте по категориям отелей. В случае форс-мажора и бронирования турпродукта менее чем за 30 дней до начала тура, существует вероятность, что отель может быть заменен на отель той же или более высокой категории.', en: 'Accommodation refers to the options (hotels) presented in the booking system on the website by hotel categories. In case of force majeure and booking of a Tour Product less than 30 days before the start of the tour, there is a possibility that the hotel may be replaced with a hotel of the same or higher category.' },
    'special.meal_title': { ru: '24. Питание — стандартная опция', en: '24. Standard Meal' },
    'special.meal_text': { ru: 'Стандартное питание включает салат, первое и/или второе горячее блюдо, хлеб, чай. Однако гости могут заказать другие блюда за дополнительную плату.', en: 'Standard meal includes salad, 1st and/or 2nd hot dish, bread, tea, however guests can order other dishes for an additional fee.' },
    'special.privacy_title': { ru: '25. Политика конфиденциальности', en: '25. Privacy Policy' },
    'special.privacy_text': { ru: 'Политика конфиденциальности — документ, разработанный в соответствии с требованиями закона Республики Таджикистан от 3 августа 2018 г. № 1537 «О защите персональных данных» и опубликованный на веб-сайте http://bunyodtour.tj.', en: 'Privacy Policy is a document developed in accordance with the requirements of the Law of the Republic of Tajikistan dated August 3, 2018 No. 1537 "On the Protection of Personal Data" and published on the website http://bunyodtour.tj.' },
    'special.insurance_title': { ru: '26. Страховка', en: '26. Insurance' },
    'special.insurance_text': { ru: 'Некоторые из наших турпродуктов экстремальны, следовательно, туристам рекомендуется соблюдать осторожность во время путешествия. Заранее застрахуйтесь от несчастных случаев. Наша компания несёт ответственность за предоставление услуг, указанных в турпакете.', en: 'Some of our tour products are extreme, so tourists are advised to exercise caution while traveling. Please insure yourself against accidents in advance. Our company is responsible for providing the services specified in the tour package.' },
    'special.force_majeure_title': { ru: '27. Форс-мажор', en: '27. Force Majeure' },
    'special.force_majeure_text': { ru: 'Форс-мажор — непреодолимая сила, непредсказуемое событие, которое находится вне нашего контроля и приводит к невозможности предоставления туристических услуг, в том числе стихийные бедствия, эпидемии и пандемии, военные действия, беспорядки, забастовки, решения государственных органов.', en: 'Force majeure is an irresistible force, an unpredictable event that is beyond our control and leads to the impossibility of providing tourist services, including natural disasters, epidemics and pandemics, military actions, riots, strikes, decisions of government authorities.' },
    'special.registration_title': { ru: '28. Временная регистрация', en: '28. Temporary Registration' },
    'special.registration_text': { ru: 'Гости (иностранные граждане), намеревающиеся находиться в Таджикистане более 10 дней, должны зарегистрироваться в Отделе паспортного контроля и временной регистрации Министерства внутренних дел Таджикистана.', en: 'Guests (foreign citizens) intending to stay in Tajikistan for more than 10 days must register with the Passport Control and Temporary Registration Department of the Ministry of Internal Affairs of Tajikistan.' },
    'special.hiking_tips_title': { ru: '29. Рекомендации туристам в турпоходе', en: '29. Tourist Recommendations for Hiking' },
    'special.hiking_tips_text': { ru: 'Туристам, которые собираются в поход, рекомендуется взять с собой: паспорт и основные документы; рюкзак (35-50 литров); спальный мешок; солнцезащитные очки; треккинговые палки; предметы личной гигиены; лёгкое полотенце; купальник; рубашку с длинным рукавом; тёплую флисовую кофту; пуховик; перчатки; тёплую шапку; треккинговые ботинки.', en: 'Tourists who are going hiking are recommended to take: passport and other essential documents; backpack (35-50 liters); sleeping bag; sunglasses; trekking poles; personal hygiene items; light towel; swimming suit; long-sleeved shirt; warm fleece sweater; down jacket; gloves; warm hat; trekking boots.' },
    'special.how_to_use_title': { ru: '30. Как пользоваться веб-сайтом?', en: '30. How to Use the Website?' },
    'special.how_to_use_text': { ru: 'Пошаговые инструкции по бронированию туристических продуктов см. в Руководстве пользователя веб-сайта.', en: 'For step-by-step instructions on booking travel products, see the Website User Guide.' },
    'special.contact_us_title': { ru: '31. Как связаться с нами?', en: '31. How to Contact Us?' },
    'special.contact_us_text': { ru: 'Если у вас возникнут дополнительные вопросы о наших турах, услугах или вам нужна помощь с бронированием, мы будем рады помочь. Просто позвоните нам — мы всегда на связи по телефону, WhatsApp и/или Telegram (+992) 915-123-344 или напишите на электронную почту — info@bunyodtour.tj', en: 'If you have any additional questions about our tours, services, or need help with booking, we will be happy to help. Just call us — we are always available by phone, WhatsApp and/or Telegram (+992) 915-123-344 or email us at info@bunyodtour.tj' },
    'special.download_pdf_ru': { ru: 'Скачать PDF (RU)', en: 'Download PDF (RU)' },
    'special.download_pdf_en': { ru: 'Скачать PDF (EN)', en: 'Download PDF (EN)' },
    
    // Language selector
    'nav.lang.russian': { ru: 'Русский', en: 'Russian' },
    
    // Breadcrumb navigation
    'breadcrumb.central_asia': { ru: 'Туры по Центральной Азии', en: 'Central Asia Tours' },
    'breadcrumb.tajikistan': { ru: 'Туры по Таджикистану', en: 'Tajikistan Tours' },
    'breadcrumb.mountain_tours': { ru: 'Горные туры', en: 'Mountain Tours' },
    
    // Buttons and actions
    'btn.more_photos': { ru: 'Ещё фото', en: 'More Photos' },
    'btn.view_all_photos': { ru: 'Посмотреть все фотографии', en: 'View All Photos' },
    'btn.share': { ru: 'Поделиться', en: 'Share' },
    'btn.copy_link': { ru: 'Скопировать ссылку', en: 'Copy Link' },
    'btn.download_pdf': { ru: 'Скачать PDF', en: 'Download PDF' },
    'btn.apply': { ru: 'Применить', en: 'Apply' },
    
    // Form elements
    'form.check_dates': { ru: 'Проверить доступные даты', en: 'Check Available Dates' },
    'form.travelers_count': { ru: 'Количество туристов', en: 'Number of Travelers' },
    'form.one_adult': { ru: '1 взрослый', en: '1 Adult' },
    'form.adults': { ru: 'взрослых', en: 'adults' },
    'form.one_child': { ru: 'ребенок', en: 'child' },
    'form.children': { ru: 'детей', en: 'children' },
    'form.max_travelers_note': { ru: 'Вы можете выбрать до 15 туристов всего', en: 'You can select up to 15 travelers total' },
    'form.adults_age': { ru: 'Взрослые (от 9 лет)', en: 'Adults (9+ years)' },
    'form.adults_range': { ru: 'Минимум: 1, Максимум: 15', en: 'Minimum: 1, Maximum: 15' },
    'form.children_age': { ru: 'Ребёнок (до 8 лет)', en: 'Child (up to 8 years)' },
    'form.children_range': { ru: 'Минимум: 0, Максимум: 15', en: 'Minimum: 0, Maximum: 15' },
    'form.infants_age': { ru: 'Младенцы (0-2 лет)', en: 'Infants (0-2 years)' },
    'form.tour_start_time': { ru: 'Время начала тура', en: 'Tour Start Time' },
    'form.no_hidden_fees': { ru: 'Никаких скрытых платежей', en: 'No Hidden Fees' },
    'form.select_country_first': { ru: 'Сначала выберите страну', en: 'Select country first' },
    'form.your_name': { ru: 'Ваше имя *', en: 'Your Name *' },
    'form.phone': { ru: 'Телефон', en: 'Phone' },
    'form.comments': { ru: 'Комментарии', en: 'Comments' },
    
    // Calendar days
    'calendar.mon': { ru: 'Пн', en: 'Mon' },
    'calendar.tue': { ru: 'Вт', en: 'Tue' },
    'calendar.wed': { ru: 'Ср', en: 'Wed' },
    'calendar.thu': { ru: 'Чт', en: 'Thu' },
    'calendar.fri': { ru: 'Пт', en: 'Fri' },
    'calendar.sat': { ru: 'Сб', en: 'Sat' },
    'calendar.sun': { ru: 'Вс', en: 'Sun' },
    'calendar.monday': { ru: 'Пн', en: 'Mo' },
    'calendar.tuesday': { ru: 'Вт', en: 'Tu' },
    'calendar.wednesday': { ru: 'Ср', en: 'We' },
    'calendar.thursday': { ru: 'Чт', en: 'Th' },
    'calendar.friday': { ru: 'Пт', en: 'Fr' },
    'calendar.saturday': { ru: 'Сб', en: 'Sa' },
    'calendar.sunday': { ru: 'Вс', en: 'Su' },
    'guides.selected': { ru: 'Выбрано', en: 'Selected' },
    'guides.available': { ru: 'Доступно', en: 'Available' },
    'guides.occupied': { ru: 'Занято', en: 'Occupied' },
    'guides.unavailable': { ru: 'Недоступно', en: 'Unavailable' },
    
    // Filter sections for tours-search.html
    'filters.title': { ru: 'Фильтры поиска', en: 'Search Filters' },
    'filters.destination': { ru: 'Направление', en: 'Destination' },
    'filters.format': { ru: 'Формат тура', en: 'Tour Format' },
    'filters.duration': { ru: 'Длительность тура', en: 'Tour Duration' },
    'filters.theme': { ru: 'Тематика тура', en: 'Tour Theme' },
    'filters.group': { ru: 'Групповой', en: 'Group' },
    'filters.individual': { ru: 'Индивидуальный', en: 'Individual' },
    'filters.one_day': { ru: 'Однодневный', en: 'One Day' },
    'filters.multi_day': { ru: 'Многодневный (2-5 дней)', en: 'Multi Day (2-5 days)' },
    'filters.long_term': { ru: 'Длительный (6+ дней)', en: 'Long Term (6+ days)' },
    
    // Filter theme options
    'filters.theme.overview': { ru: 'Обзорная экскурсия', en: 'Overview Excursion' },
    'filters.theme.trekking': { ru: 'Походы / трекинг', en: 'Hiking / Trekking' },
    'filters.theme.mountain': { ru: 'Горные маршруты', en: 'Mountain Routes' },
    'filters.theme.lake': { ru: 'Озёрные маршруты', en: 'Lake Routes' },
    'filters.theme.historical': { ru: 'Исторический тур', en: 'Historical Tour' },
    'filters.theme.recreational': { ru: 'Рекреационный тур', en: 'Recreational Tour' },
    'filters.theme.agro': { ru: 'Агро-туризм', en: 'Agro Tourism' },
    'filters.theme.health': { ru: 'Санаторно-оздоровительный тур', en: 'Health & Wellness Tour' },
    'filters.theme.combined': { ru: 'Комбинированный тур по Центральной Азии', en: 'Combined Central Asia Tour' },
    
    // Date filter
    'filters.date': { ru: 'Дата проведения', en: 'Date' },
    
    // === НОВЫЕ КЛЮЧИ ДЛЯ АДМИН-ПАНЕЛИ ===
    
    // Дополнительные административные разделы
    'admin.price_calculator': { ru: 'Калькулятор цен', en: 'Price Calculator' },
    'admin.banner_management': { ru: 'Управление баннерами', en: 'Banner Management' },
    'admin.tour_agents': { ru: 'Турагенты', en: 'Tour Agents' },
    'admin.trips': { ru: 'Поездки', en: 'Trips' },
    'admin.exchange_rates': { ru: 'Курсы валют', en: 'Exchange Rates' },
    'admin.cms_content': { ru: 'CMS - Контент', en: 'CMS - Content' },
    'admin.translations': { ru: 'Переводы', en: 'Translations' },
    'admin.monthly_revenue': { ru: 'Доход за месяц', en: 'Monthly Revenue' },
    'admin.active_customers': { ru: 'Активные клиенты', en: 'Active Customers' },
    'admin.sales_chart': { ru: 'График продаж', en: 'Sales Chart' },
    'admin.popular_destinations': { ru: 'Популярные направления', en: 'Popular Destinations' },
    'admin.manage_hotels': { ru: 'Управление отелями', en: 'Hotel Management' },
    'admin.manage_guides': { ru: 'Управление гидами', en: 'Guide Management' },
    'admin.manage_tour_agents': { ru: 'Управление турагентами', en: 'Tour Agent Management' },
    'admin.manage_drivers': { ru: 'Управление водителями', en: 'Driver Management' },
    'admin.manage_trips': { ru: 'Управление поездками', en: 'Trip Management' },
    'admin.transfer_requests': { ru: 'Запросы трансфера', en: 'Transfer Requests' },
    'admin.manage_countries': { ru: 'Управление странами', en: 'Country Management' },
    'admin.manage_cities': { ru: 'Управление городами', en: 'City Management' },
    'admin.total_views': { ru: 'Всего просмотров', en: 'Total Views' },
    'admin.total_news': { ru: 'Всего новостей', en: 'Total News' },
    'admin.published': { ru: 'Опубликовано', en: 'Published' },
    'admin.drafts': { ru: 'Черновики', en: 'Drafts' },
    'admin.tour_blocks': { ru: 'Блоки туров', en: 'Tour Blocks' },
    'admin.site_settings': { ru: 'Настройки сайта', en: 'Site Settings' },
    'admin.tour_form': { ru: 'Форма тура', en: 'Tour Form' },
    'admin.manage_tour_blocks': { ru: 'Управление блоками туров', en: 'Tour Block Management' },

    // Заголовки таблиц
    'table.order_number': { ru: 'Заказ №', en: 'Order #' },
    'table.client': { ru: 'Клиент', en: 'Client' },
    'table.tour': { ru: 'Тур', en: 'Tour' },
    'table.date': { ru: 'Дата', en: 'Date' },
    'table.amount': { ru: 'Сумма', en: 'Amount' },
    'table.status': { ru: 'Статус', en: 'Status' },
    'table.actions': { ru: 'Действия', en: 'Actions' },
    'table.name': { ru: 'Название', en: 'Name' },
    'table.category': { ru: 'Категория', en: 'Category' },
    'table.country': { ru: 'Страна', en: 'Country' },
    'table.city': { ru: 'Город', en: 'City' },
    'table.duration': { ru: 'Длительность', en: 'Duration' },
    'table.price': { ru: 'Цена', en: 'Price' },
    'table.title': { ru: 'Заголовок', en: 'Title' },
    'table.author': { ru: 'Автор', en: 'Author' },
    'table.publish_date': { ru: 'Дата публикации', en: 'Publish Date' },
    'table.views': { ru: 'Просмотры', en: 'Views' },
    'table.block_name_ru': { ru: 'Название блока (RU)', en: 'Block Name (RU)' },
    'table.block_name_en': { ru: 'Название блока (EN)', en: 'Block Name (EN)' },
    'table.slug': { ru: 'Слаг', en: 'Slug' },
    'table.tour_count': { ru: 'Количество туров', en: 'Tour Count' },
    'table.order': { ru: 'Порядок', en: 'Order' },

    // Дополнительные кнопки
    'btn.add_tour': { ru: 'Добавить тур', en: 'Add Tour' },
    'btn.create_tour_block': { ru: 'Создать блок туров', en: 'Create Tour Block' },
    'btn.add_hotel': { ru: 'Добавить отель', en: 'Add Hotel' },
    'btn.add_guide': { ru: 'Добавить гида', en: 'Add Guide' },
    'btn.add_tour_agent': { ru: 'Добавить турагента', en: 'Add Tour Agent' },
    'btn.add_driver': { ru: 'Добавить водителя', en: 'Add Driver' },
    'btn.add_trip': { ru: 'Добавить поездку', en: 'Add Trip' },
    'btn.add_country': { ru: 'Добавить страну', en: 'Add Country' },
    'btn.add_city': { ru: 'Добавить город', en: 'Add City' },

    // Статусы заказов
    'status.pending': { ru: 'В ожидании', en: 'Pending' },
    'status.confirmed': { ru: 'Подтвержден', en: 'Confirmed' },
    'status.paid': { ru: 'Оплачен', en: 'Paid' },
    'status.completed': { ru: 'Завершен', en: 'Completed' },
    'status.cancelled': { ru: 'Отменен', en: 'Cancelled' },

    // Вкладки
    'tab.all_orders': { ru: 'Все заказы', en: 'All Orders' },

    // Формы и поля
    'form.pickup_info': { ru: 'Информация о встрече/трансфере', en: 'Pickup/Meeting Information' },
    'form.tour_languages': { ru: 'Языки тура', en: 'Tour Languages' },
    'form.min_people': { ru: 'Минимальное количество людей', en: 'Minimum Number of People' },
    'form.max_people': { ru: 'Максимальное количество людей', en: 'Maximum Number of People' },
    'form.available_months': { ru: 'Доступные месяцы', en: 'Available Months' },
    'form.available_days': { ru: 'Доступные дни', en: 'Available Days' },
    'form.tour_photos': { ru: 'Фотографии тура', en: 'Tour Photos' },

    // Дополнительные placeholder'ы
    'placeholder.search_tours': { ru: 'Поиск туров...', en: 'Search tours...' },
    'placeholder.search_hotels': { ru: 'Поиск отелей...', en: 'Search hotels...' },
    'placeholder.search_tour_agents': { ru: 'Поиск турагентов...', en: 'Search tour agents...' },
    'placeholder.enter_text_for_translation': { ru: 'Введите текст для перевода...', en: 'Enter text for translation...' },
    'placeholder.translated_text_will_appear': { ru: 'Переведенный текст появится здесь...', en: 'Translated text will appear here...' },
    'placeholder.service_name_example': { ru: 'Например: Обед в ресторане', en: 'For example: Restaurant lunch' },
    'placeholder.component_additional_info': { ru: 'Дополнительная информация о компоненте', en: 'Additional component information' },
    'placeholder.slide_title': { ru: 'Заголовок слайда', en: 'Slide title' },
    'placeholder.slide_description': { ru: 'Описание слайда', en: 'Slide description' },
    'placeholder.learn_more': { ru: 'Узнать больше', en: 'Learn more' },
    'placeholder.hotel_name_example': { ru: 'Hilton Dushanbe, Serena Hotel и т.д.', en: 'Hilton Dushanbe, Serena Hotel, etc.' },
    'placeholder.hotel_description_ru': { ru: 'Краткое описание отеля, местоположение и особенности на русском...', en: 'Brief hotel description, location and features in Russian...' },
    'placeholder.enter_new_brand': { ru: 'Введите название нового бренда', en: 'Enter new brand name' },
    'placeholder.city_examples': { ru: 'Душанбе, Самарканд, Бишкек и т.д.', en: 'Dushanbe, Samarkand, Bishkek, etc.' },
    'placeholder.enter_new_amenity': { ru: 'Введите название новой услуги', en: 'Enter new amenity name' },
    'placeholder.meeting_with_guide': { ru: 'Встреча с гидом', en: 'Meeting with guide' },
    'placeholder.detailed_stage_description': { ru: 'Подробное описание этапа', en: 'Detailed stage description' },
    'placeholder.pickup_info_example': { ru: 'Например: Трансфер включен, Место встречи: отель и т.д.', en: 'For example: Pickup included, Meeting point: hotel, etc.' },
    'placeholder.enter_service_name': { ru: 'Введите название услуги', en: 'Enter service name' },
    'placeholder.news_brief_description': { ru: 'Краткое описание новости (по желанию)', en: 'Brief news description (optional)' },

    // Языки
    'language.russian': { ru: 'Русский', en: 'Russian' },
    
    // === ДОПОЛНИТЕЛЬНЫЕ ПЕРЕВОДЫ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ ===
    
    // Заголовки основных секций
    'hero.more_with_bunyod': { ru: 'Больше с Bunyod-Tour', en: 'More with Bunyod-Tour' },
    'title.tour_types': { ru: 'Виды туров', en: 'Tour Types' },
    
    // Описания типов туров
    'tour_type.personal_desc': { ru: 'Только для вас с персональным подходом', en: 'Just for you with a personal approach' },
    'tour_type.group_personal_desc': { ru: 'Комфортный тур для группы до 4 человек с персональным подходом', en: 'Comfortable tour for groups up to 4 people with personal approach' },
    'tour_type.group_general_desc': { ru: 'Экономичный тур для группы до 20 человек, куда каждый может присоединиться', en: 'Economical tour for groups up to 20 people, anyone can join' },
    'tour_type.special_desc': { ru: 'Тур, составленный по вашим личным пожеланиям с персональным подходом', en: 'Tour tailored to your personal preferences with individual approach' },
    
    // Информационные блоки - краткие описания
    'info.free_cancellation_desc': { ru: 'Отмена бронирования до 30 дней до начала тура, возврат 100%', en: 'Cancel booking up to 30 days before tour start, 100% refund' },
    'info.book_pay_later_desc': { ru: 'Записывайтесь на групповые туры всего за 10% от стоимости тура', en: 'Book group tours for just 10% of the tour cost' },
    'info.hot_tours_desc': { ru: 'Успейте забронировать туры и экскурсии за доступные цены!', en: 'Hurry to book last-minute deals at great prices!' },
    'info.promotions_desc': { ru: 'Бронируйте любой тур за 12 месяцев и экономьте 12%, это и другие привилегии у нас!', en: 'Book any tour 12 months in advance and save 12%, plus other privileges!' },
    
    // Кнопки для информационных блоков
    'btn.details': { ru: 'подробнее', en: 'details' },
    'btn.hide': { ru: 'скрыть', en: 'hide' },
    
    // Детальные описания в overlay блоках
    'info.free_cancellation_detail1': { ru: 'Бесплатная отмена – отмена тура со стороны клиента в срок до 30 дней до начала тура, возврат 100%. Однако данный возврат не распространяется на туры, забронированные менее чем за этот срок.', en: 'Free cancellation - tour cancellation by the client up to 30 days before the tour start, 100% refund. However, this refund does not apply to tours booked less than this period.' },
    'info.free_cancellation_detail2': { ru: 'Система должна распознавать эти требования автоматически.', en: 'The system should recognize these requirements automatically.' },
    
    'info.book_pay_later_detail1': { ru: 'Турист записывается на групповой общий тур; оплачивает 10% от стоимости тура, чтобы забронировать тур. Это раннее бронирование за 12 месяцев (минимум до 30 дней до начала тура).', en: 'Tourist books a group shared tour; pays 10% of the tour cost to reserve the tour. This is early booking up to 12 months (minimum until 30 days before tour start).' },
    'info.book_pay_later_detail2': { ru: 'В калькуляторе нужно установить ограничение: любая запись на тур доступна в срок бронирования до 30 дней; в 29-й день до срока доступ закрывается.', en: 'In the calculator, a restriction should be set: any tour booking is available up to 30 days; on the 29th day before the deadline, access closes.' },
    
    'info.hot_tours_detail1': { ru: 'В системе бронирования необходимо установить лимит, когда необходимо, чтобы туры, особенно групповые общие экскурсии, были переключены в категорию "Горящие туры".', en: 'In the booking system, it is necessary to set a limit when tours, especially group shared excursions, should be switched to the "Hot Tours" category.' },
    'info.hot_tours_detail2': { ru: 'Пока остается так, однако два предыдущих блока "Бронируй сейчас, плати потом" и "Горящие туры" входят в этот компонент.', en: 'For now it remains like this, however the two previous blocks "Book now, pay later" and "Hot tours" are part of this component.' },
    
    'info.promotions_detail': { ru: 'Пока остается так, однако два предыдущих блока "Бронируй сейчас, плати потом" входят в этот компонент.', en: 'For now it remains like this, however the two previous blocks "Book now, pay later" are part of this component.' },
    
    // Описания услуг в карточках
    'service.transfer_feature1': { ru: 'Поездки по территории всех 5-СТАН с опытными водителями', en: 'Trips across all 5-STAN territories with experienced drivers' },
    'service.transfer_feature2': { ru: 'Встречи в аэропорту, ЖД и границах 5-СТАН', en: 'Airport, railway and border pickups in 5-STAN' },
    'service.transfer_feature3': { ru: 'Межстрановые и межгородские поездки', en: 'Inter-country and inter-city trips' },
    'service.transfer_feature4': { ru: 'Доступные и комфортные автомобили', en: 'Affordable and comfortable vehicles' },
    'btn.order_transfer': { ru: 'Заказать трансфер', en: 'Order Transfer' },
    
    'service.guides_feature1': { ru: 'Опытные тур-гиды во всех 5-СТАН', en: 'Experienced tour guides in all 5-STAN' },
    'service.guides_feature2': { ru: 'Профессиональное сопровождение', en: 'Professional accompaniment' },
    'service.guides_feature3': { ru: 'Знание местности и владение разными языками', en: 'Local knowledge and multilingual skills' },
    'service.guides_feature4': { ru: 'Друг в поездке, экономия и безопасность', en: 'Friend on the trip, savings and safety' },
    
    'service.agency_feature1': { ru: 'Тур-агентские услуги во всех 5-СТАН', en: 'Tour agency services in all 5-STAN' },
    'service.agency_feature2': { ru: 'Готовые и доступные тур-пакеты для реализации', en: 'Ready and accessible tour packages for sale' },
    'service.agency_feature3': { ru: 'Вознаграждения за каждый реализованный пакет', en: 'Rewards for each sold package' },
    'service.agency_feature4': { ru: 'Гибкие и взаимовыгодные условия партнерства', en: 'Flexible and mutually beneficial partnership terms' },
    
    'service.custom_feature1': { ru: 'Создайте свой тур по всем 5-СТАН', en: 'Create your tour across all 5-STAN' },
    'service.custom_feature2': { ru: 'Выбор маршрута по своему усмотрению', en: 'Route selection at your discretion' },
    'service.custom_feature3': { ru: 'Подбор отелей и класс проживания', en: 'Hotel selection and accommodation class' },
    'service.custom_feature4': { ru: 'Гибкая настройка времени визитов', en: 'Flexible visit time settings' },
    'btn.order_guide': { ru: 'Заказать тур-гида', en: 'Order Tour Guide' },
    
    // Optgroup labels для селекторов отелей
    'hotel_segment.luxury': { ru: 'Люкс сегмент', en: 'Luxury Segment' },
    'hotel_segment.premium': { ru: 'Премиум сегмент', en: 'Premium Segment' },
    'hotel_segment.middle': { ru: 'Средний сегмент', en: 'Mid-range Segment' },
    'hotel_segment.budget': { ru: 'Бюджетный сегмент', en: 'Budget Segment' },
    'hotel_segment.local': { ru: 'Местные и региональные', en: 'Local and Regional' },

    // === ФИЛЬТРЫ СТРАНИЦЫ TOURS ===
    'filters.duration': { ru: 'Длительность тура', en: 'Tour duration' },
    'filters.theme': { ru: 'Тематика тура', en: 'Tour theme' },
    'filters.date_period': { ru: 'Дата проведения', en: 'Date range' },
    
    // Варианты длительности
    'duration.single_day': { ru: 'Однодневный', en: 'Single-day' },
    'duration.multi_day': { ru: 'Многодневный (2-5 дней)', en: 'Multi-day (2-5 days)' },
    'duration.long_term': { ru: 'Длительный (6+ дней)', en: 'Extended (6+ days)' },
    
    // Тематики туров
    'theme.overview': { ru: 'Обзорная экскурсия', en: 'Sightseeing tour' },
    'theme.trekking': { ru: 'Походы / треккинг', en: 'Hiking / trekking' },
    'theme.mountain': { ru: 'Горные маршруты', en: 'Mountain tours' },
    'theme.lake': { ru: 'Озёрные маршруты', en: 'Lake tours' },
    'theme.historical': { ru: 'Исторический тур', en: 'Historical tour' },
    'theme.recreational': { ru: 'Рекреационный тур', en: 'Leisure tour' },
    'theme.agro': { ru: 'Агро-туризм', en: 'Agritourism' },
    'theme.health': { ru: 'Санаторно-оздоровительный тур', en: 'Health & wellness tour' },
    'theme.combined': { ru: 'Комбинированный тур по Центральной Азии', en: 'Multi-country Central Asia tour' },
    
    // Кнопки и действия для tours
    'btn.reset_filters': { ru: 'Сбросить все фильтры', en: 'Reset all filters' },
    'tours.results_count': { ru: 'Показано туров:', en: 'Tours shown:' },
    'tours.tour_details': { ru: 'Детали тура', en: 'Tour Details' },
    
    // Поля дат
    'form.date_from': { ru: 'От', en: 'From' },
    'form.date_to': { ru: 'До', en: 'To' },

    // === ОТЕЛИ - ДОПОЛНИТЕЛЬНЫЕ ПЕРЕВОДЫ ===
    'hotel.page_title': { ru: 'Каталог отелей - Bunyod-Tour', en: 'Hotel catalog - Bunyod-Tour' },
    'tour.page_title': { ru: 'Тур - Bunyod-Tour', en: 'Tour - Bunyod-Tour' },
    'hotel.5_stars': { ru: '5 звезд', en: '5 stars' },
    'hotel.4_stars': { ru: '4 звезды', en: '4 stars' },
    'hotel.3_stars': { ru: '3 звезды', en: '3 stars' },
    'hotel.2_stars': { ru: '2 звезды', en: '2 stars' },
    'hotel.1_star': { ru: '1 звезда', en: '1 star' },
    'hotel.loading_error': { ru: 'Ошибка загрузки', en: 'Loading error' },
    'hotel.failed_to_load': { ru: 'Не удалось загрузить список отелей', en: 'Failed to load the hotel list' },
    
    // Дополнительные ключи для отелей
    'hotel.default_name': { ru: 'Отель', en: 'Hotel' },
    'hotel.no_description': { ru: 'Описание недоступно', en: 'Description unavailable' },
    'hotel.no_location': { ru: 'Местоположение не указано', en: 'Location not specified' },
    'hotel.view_details': { ru: 'Подробнее', en: 'View details' },

    // === ФУТЕР ===
    'footer.company': { ru: 'Компания:', en: 'Company:' },
    'footer.social_pages': { ru: 'Социальные страницы:', en: 'Social Pages:' },
    'footer.contact_info': { ru: 'Контакты:', en: 'Contact Info:' },
    
    // Ссылки в разделе компании  
    'footer.tour_agents': { ru: 'Тур-агентам', en: 'For Tour Agents' },
    'footer.partners': { ru: 'Партнеры', en: 'Partners' },
    'footer.investment_projects': { ru: 'Инвестиционные Проекты', en: 'Investment Projects' },
    'footer.how_to_book': { ru: 'Как бронировать туры?', en: 'How to Book a Tour?' },
    'footer.tours_catalog': { ru: 'Каталог туров', en: 'Tour Catalog' },

    // === Страница «Инвестиционные проекты» ===
    'investment.page_title': { ru: 'Инвестиционные проекты', en: 'Investment Projects' },
    'investment.page_subtitle': { ru: 'Инновационные идеи для развития туризма и бизнеса в Центральной Азии', en: 'Innovative ideas for the development of tourism and business in Central Asia' },
    'investment.section_projects': { ru: 'Проекты', en: 'Projects' },
    'investment.intro': { ru: 'Представлены следующие проекты - инновационные идеи, разработанные в контексте развития компании, рынка услуг и общества в целом (для инвестирования/финансирования) для рассмотрения инвесторами и другими лицами, заинтересованными в развитии прибыльного и устойчивого бизнеса.', en: 'Presented below are projects — innovative ideas developed in the context of company growth, the services market and society as a whole (for investment / financing) for review by investors and other parties interested in building a profitable and sustainable business.' },

    'investment.project_description': { ru: 'Описание проекта:', en: 'Project description:' },

    'investment.project1_title': { ru: 'ПРИКЛЮЧЕНЧЕСКИЙ ТУРИЗМ', en: 'ADVENTURE TOURISM' },
    'investment.project1_subtitle': { ru: 'Adventure Tourism', en: 'Adventure Tourism' },
    'investment.project1_point1': { ru: 'Развитие экстремального и приключенческого туризма в горных регионах Таджикистана', en: 'Development of extreme and adventure tourism in the mountain regions of Tajikistan' },
    'investment.project1_point2': { ru: 'Создание инфраструктуры для активного отдыха: треккинг, скалолазание, рафтинг', en: 'Building infrastructure for active recreation: trekking, climbing, rafting' },
    'investment.project1_point3': { ru: 'Обучение местных гидов международным стандартам безопасности', en: 'Training local guides to international safety standards' },
    'investment.project1_point4': { ru: 'Привлечение международных туристов, ищущих уникальные приключения', en: 'Attracting international tourists seeking unique adventures' },

    'investment.project2_title': { ru: 'E-ПОРТАЛ TAJHOTELS.TJ', en: 'E-PORTAL TAJHOTELS.TJ' },
    'investment.project2_subtitle': { ru: 'Digital Hospitality Platform', en: 'Digital Hospitality Platform' },
    'investment.project2_point1': { ru: 'Создание единой цифровой платформы для всех отелей Таджикистана', en: 'Building a single digital platform for all hotels in Tajikistan' },
    'investment.project2_point2': { ru: 'Онлайн-бронирование и управление номерным фондом', en: 'Online booking and room inventory management' },
    'investment.project2_point3': { ru: 'Интеграция с международными системами бронирования', en: 'Integration with international booking systems' },
    'investment.project2_point4': { ru: 'Продвижение отечественного гостиничного бизнеса на мировом рынке', en: 'Promotion of the national hotel industry on the global market' },

    'investment.opportunities_title': { ru: 'Возможности для инвесторов', en: 'Opportunities for Investors' },
    'investment.opp1_title': { ru: 'Высокий потенциал роста', en: 'High Growth Potential' },
    'investment.opp1_text': { ru: 'Туристический рынок Центральной Азии показывает стабильный рост', en: 'The Central Asian tourism market shows steady growth' },
    'investment.opp2_title': { ru: 'Опытная команда', en: 'Experienced Team' },
    'investment.opp2_text': { ru: 'Более 8 лет успешной работы в сфере туризма', en: 'More than 8 years of successful work in the tourism industry' },
    'investment.opp3_title': { ru: 'Государственная поддержка', en: 'Government Support' },
    'investment.opp3_text': { ru: 'Туризм - приоритетное направление развития экономики страны', en: 'Tourism is a priority direction for the country\'s economic development' },

    'investment.contact_title': { ru: 'Заинтересованы в инвестировании?', en: 'Interested in investing?' },
    'investment.contact_text': { ru: 'Свяжитесь с нами для получения подробной информации о проектах', en: 'Contact us to get detailed information about the projects' },
    'investment.contact_call': { ru: 'Позвонить: +992 915-123-344', en: 'Call: +992 915-123-344' },
    'investment.contact_email': { ru: 'Написать: info@bunyodtour.tj', en: 'Email: info@bunyodtour.tj' },

    'investment.copyright_notice': { ru: 'ПРЕДСТАВЛЕННЫЕ ПРОЕКТЫ ЯВЛЯЮТСЯ СОБСТВЕННОСТЬЮ КОМПАНИИ И ЗАЩИЩЕНЫ АВТОРСКИМ ПРАВОМ.', en: 'THE PROJECTS PRESENTED ARE THE PROPERTY OF THE COMPANY AND ARE PROTECTED BY COPYRIGHT.' },
    
    // Информация о лицензии
    'footer.license_info': { ru: 'Лицензия на туристическую деятельность ФС№ 0000253, от 25.10.2022 г.', en: 'Tourism Activity License FS№ 0000253, dated 25.10.2022' },
    'footer.recommended_by': { ru: 'Рекомендовано', en: 'Recommended by' },
    'footer.approved_by': { ru: 'Одобрено', en: 'Approved by' },
    'footer.pata_member': { ru: 'Член PATA', en: 'PATA Member' },
    
    // Документы
    'footer.public_offer': { ru: 'Публичная Оферта-Договор', en: 'Public Offer Agreement' },
    'footer.payment_rules': { ru: 'Правила оплаты и возврата средств', en: 'Payment and Refund Rules' },
    'footer.privacy_policy': { ru: 'Политика конфиденциальности', en: 'Privacy Policy' },
    
    // Копирайт
    'footer.copyright': { ru: 'Все права защищены | ООО "Бунёд-Тур" 2017-2026 | ИНН: 010098739; ГОРН: 0110023137 | Лицензия на туристическую деятельность № 0000253, от 25.10.2022', en: 'All rights reserved | Bunyod-Tour LLC 2017-2026 | TIN: 010098739; PIN: 0110023137 | Tourism License # 0000253, dated 25.10.2022' },
    
    // === HOME PAGE KEYS ===
    'home.hero.title': { ru: 'Откройте красоту Таджикистана', en: 'Discover the Beauty of Tajikistan' },
    'home.view_all': { ru: 'Посмотреть все', en: 'View All' },
    'footer.we_accept': { ru: 'Мы принимаем', en: 'We accept' },
    'home.hero.subtitle': { ru: 'Исследуйте захватывающие горы Памира, древние города Шёлкового пути и богатую культуру этой удивительной страны', en: 'Explore the breathtaking Pamir Mountains, ancient Silk Road cities, and the rich culture of this amazing country' },
    'home.filter.category_label': { ru: 'Категория тура', en: 'Tour Category' },
    'home.filter.all_categories': { ru: 'Все категории', en: 'All Categories' },
    'home.filter.adventure': { ru: 'Приключения', en: 'Adventure' },
    'home.filter.culture': { ru: 'Культурные', en: 'Cultural' },
    'home.filter.nature': { ru: 'Природа', en: 'Nature' },
    'home.filter.duration_label': { ru: 'Длительность', en: 'Duration' },
    'home.filter.any': { ru: 'Любая', en: 'Any' },
    'home.filter.1_3_days': { ru: '1-3 дня', en: '1-3 days' },
    'home.filter.4_7_days': { ru: '4-7 дней', en: '4-7 days' },
    'home.filter.8_plus_days': { ru: '8+ дней', en: '8+ days' },
    'home.filter.price_label': { ru: 'Цена (USD)', en: 'Price (USD)' },
    'home.filter.any_price': { ru: 'Любая цена', en: 'Any Price' },
    'home.filter.up_to_100': { ru: 'До $100', en: 'Up to $100' },
    'home.filter.100_500': { ru: '$100-$500', en: '$100-$500' },
    'home.filter.500_plus': { ru: '$500+', en: '$500+' },
    'home.filter.find_tours_button': { ru: 'Найти туры', en: 'Find Tours' },
    'home.branding': { ru: 'Больше с Bunyod-Tour', en: 'More with Bunyod-Tour' },
    'home.tour1.title': { ru: 'Панорамная дорога Памира', en: 'Pamir Panoramic Road' },
    'home.tour1.description': { ru: 'Захватывающее путешествие по одной из самых высокогорных дорог мира', en: 'An exciting journey along one of the highest mountain roads in the world' },
    'home.tour2.title': { ru: 'Озеро Искандеркуль', en: 'Lake Iskanderkul' },
    'home.tour2.description': { ru: 'Живописное горное озеро в окружении заснеженных пиков', en: 'Picturesque mountain lake surrounded by snow-capped peaks' },
    'home.tour3.title': { ru: 'Древний Пенджикент', en: 'Ancient Panjakent' },
    'home.tour3.description': { ru: 'Исследуйте руины древнего согдийского города и музей Рудаки', en: 'Explore the ruins of an ancient Sogdian city and the Rudaki Museum' },
    'home.stats.happy_tourists': { ru: 'Довольных туристов', en: 'Happy Tourists' },
    'home.stats.unique_tours': { ru: 'Уникальных туров', en: 'Unique Tours' },
    'home.stats.years_experience': { ru: 'Лет опыта', en: 'Years of Experience' },
    'home.stats.avg_rating': { ru: 'Средняя оценка', en: 'Average Rating' },
    'home.price_prefix': { ru: 'от', en: 'from' },
    'price.за_человека': { ru: 'за человека', en: 'per person' },
    'price.за_группу': { ru: 'за группу', en: 'per group' },
    'tour_type.персональный': { ru: 'Персональный', en: 'Private' },
    'tour_type.групповой': { ru: 'Групповой', en: 'Group' },
    'tour_type.групповой_персональный': { ru: 'Групповой персональный', en: 'Group Private' },
    'tour_type.групповой_общий': { ru: 'Групповой общий', en: 'Group Shared' },
    'tour.type_personal': { ru: 'Персональный', en: 'Private' },
    'tour.type_group_personal': { ru: 'Групповой персональный', en: 'Group Private' },
    'tour.type_group_common': { ru: 'Групповой общий', en: 'Group Shared' },
    'tour_type.частный': { ru: 'Частный', en: 'Private' },
    'tour_type.индивидуальный': { ru: 'Индивидуальный', en: 'Individual' },
    'language.kyrgyz': { ru: 'Киргизский', en: 'Kyrgyz' },
    'language.turkmen': { ru: 'Туркменский', en: 'Turkmen' },
    'language.киргизский': { ru: 'Киргизский', en: 'Kyrgyz' },
    'language.туркменский': { ru: 'Туркменский', en: 'Turkmen' },
    'tour.pickup_label': { ru: 'Место сбора:', en: 'Pickup location:' },
    'home.services.title': { ru: 'Наши услуги', en: 'Our Services' },
    'home.services.become_agent_btn': { ru: 'Стать Тур.партнёром', en: 'Become a Partner' },
    'home.services.create_tour_btn': { ru: 'Создать Тур', en: 'Create a Tour' },
    
    // === BOOKING PAGES ===
    'booking.page_title': { ru: 'Бронирование - Выбор отеля | Bunyod-Tour', en: 'Booking - Hotel Selection | Bunyod-Tour' },
    'booking.step1.title': { ru: 'Выбор отеля', en: 'Hotel Selection' },
    'booking.step2.title': { ru: 'Данные туриста', en: 'Tourist Information' },
    'booking.step3.title': { ru: 'Оплата', en: 'Payment' },
    'booking.choose_hotel': { ru: 'Выберите отель', en: 'Choose Hotel' },
    'booking.continue_with_base_hotel': { ru: 'Продолжить с базовым отелем', en: 'Continue with Base Hotel' },
    'booking.continue_to_step2': { ru: 'Продолжить', en: 'Continue' },
    'booking.tour_details': { ru: 'Детали тура', en: 'Tour Details' },
    'booking.tour_date': { ru: 'Дата тура:', en: 'Tour Date:' },
    'booking.duration': { ru: 'Длительность:', en: 'Duration:' },
    'booking.days': { ru: 'дн.', en: 'days' },
    'booking.tourists_count': { ru: 'Количество туристов:', en: 'Number of Tourists:' },
    'booking.tour_type': { ru: 'Тип тура:', en: 'Tour Type:' },
    'booking.selected_hotel': { ru: 'Выбранный отель', en: 'Selected Hotel' },
    'booking.rooms_and_meals': { ru: 'Номера и питание', en: 'Rooms and Meals' },
    'booking.price_calculation': { ru: 'Расчёт стоимости', en: 'Price Calculation' },
    'booking.accommodation_deduction': { ru: 'Вычет проживания за счет базовой опции', en: 'Accommodation Deduction (Base Option)' },
    'booking.tour_price': { ru: 'Цена тура', en: 'Tour Price' },
    'booking.per_group': { ru: 'за группу', en: 'per group' },
    'booking.total_amount': { ru: 'Итоговая сумма:', en: 'Total Amount:' },
    'booking.support_service': { ru: 'Служба поддержки', en: 'Support Service' },
    'booking.loading_hotels': { ru: 'Загрузка отелей...', en: 'Loading hotels...' },
    'booking.no_hotels': { ru: 'Отелей для этого тура не найдено', en: 'No hotels found for this tour' },
    'booking.amenities': { ru: 'Удобства:', en: 'Amenities:' },
    // Individual amenities translations
    'amenity.Парковка': { ru: 'Парковка', en: 'Parking' },
    'amenity.Ресторан': { ru: 'Ресторан', en: 'Restaurant' },
    'amenity.Бассейн': { ru: 'Бассейн', en: 'Pool' },
    'amenity.Wi-Fi': { ru: 'Wi-Fi', en: 'Wi-Fi' },
    'amenity.Спортзал': { ru: 'Спортзал', en: 'Gym' },
    'amenity.Спа': { ru: 'Спа', en: 'Spa' },
    'amenity.Кондиционер': { ru: 'Кондиционер', en: 'Air Conditioning' },
    'amenity.Трансфер': { ru: 'Трансфер', en: 'Transfer' },
    'amenity.Бар': { ru: 'Бар', en: 'Bar' },
    'amenity.Сауна': { ru: 'Сауна', en: 'Sauna' },
    'amenity.Прачечная': { ru: 'Прачечная', en: 'Laundry' },
    'amenity.Конференц-зал': { ru: 'Конференц-зал', en: 'Conference Hall' },
    'booking.room_categories': { ru: 'Категории номеров:', en: 'Room Categories:' },
    'booking.select_hotel': { ru: 'Выбрать отель', en: 'Select Hotel' },
    'booking.insufficient_data': { ru: 'Недостаточно данных для бронирования', en: 'Insufficient data for booking' },
    'booking.error_starting': { ru: 'Ошибка при начале бронирования', en: 'Error starting booking' },
    
    // === BOOKING STEP 2 ===
    'booking.step2.page_title': { ru: 'Бронирование - Данные туриста | Bunyod-Tour', en: 'Booking - Tourist Information | Bunyod-Tour' },
    'booking.data_for_booking': { ru: 'Данные для бронирования', en: 'Booking Information' },
    'booking.contact_person': { ru: 'Контактное лицо', en: 'Contact Person' },
    'booking.full_name': { ru: 'ФИО контактного лица', en: 'Full Name of Contact Person' },
    'booking.full_name_placeholder': { ru: 'Иванов Иван Иванович', en: 'John Smith' },
    'booking.phone': { ru: 'Телефон', en: 'Phone' },
    'booking.phone_placeholder': { ru: '+992 xx xxx xxxx', en: '+992 xx xxx xxxx' },
    'booking.email': { ru: 'Email', en: 'Email' },
    'booking.email_placeholder': { ru: 'example@email.com', en: 'example@email.com' },
    'booking.tourists_list': { ru: 'Список туристов', en: 'List of Tourists' },
    'booking.add_tourist': { ru: 'Добавить туриста', en: 'Add Tourist' },
    'booking.special_requests': { ru: 'Особые пожелания', en: 'Special Requests' },
    'booking.additional_requests': { ru: 'Дополнительные пожелания', en: 'Additional Requests' },
    'booking.additional_requests_placeholder': { ru: 'Укажите любые особые пожелания или требования...', en: 'Specify any special requests or requirements...' },
    'booking.agreement': { ru: 'Оферта-договор', en: 'Offer-agreement' },
    'booking.consent_offer_prefix': { ru: 'Я ознакомился с', en: 'I have read and agreed to the' },
    'booking.offer_agreement': { ru: 'Оферта-договор', en: 'Offer-Agreement' },
    'booking.consent_offer_suffix': { ru: 'и всеми его условиями и положениями и согласен с ними. Я подтверждаю, что предоставленные мной Туроператору персональные данные являются точными и могут быть обработаны Туроператором и его уполномоченными представителями.', en: 'and all its terms and conditions. I confirm that the personal data I provided to the Tour operator is accurate and may be processed by the Tour operator and its authorized representatives.' },
    'booking.consent_payment_prefix': { ru: 'Я ознакомился с', en: 'I have read' },
    'booking.payment_rules': { ru: 'Правилами оплаты и возврата средств', en: 'the Payment and Refund Rules' },
    'booking.back': { ru: 'Назад', en: 'Back' },
    'booking.confirm_and_pay': { ru: 'Подтвердить и перейти к оплате', en: 'Confirm and Proceed to Payment' },
    'booking.date': { ru: 'Дата:', en: 'Date:' },
    'booking.duration_label': { ru: 'Продолжительность:', en: 'Duration:' },
    'booking.tourists': { ru: 'Туристов:', en: 'Tourists:' },
    'booking.persons': { ru: 'чел.', en: 'persons' },
    'booking.price_label': { ru: 'Цена тура:', en: 'Tour Price:' },
    'booking.monday_friday': { ru: 'Пн-Пт: 9:00-18:00', en: 'Mon-Fri: 9:00-18:00' },
    
    // === BOOKING STEP 3 (PAYMENT) ===
    'booking.step3.page_title': { ru: 'Бронирование - Оплата | Bunyod-Tour', en: 'Booking - Payment | Bunyod-Tour' },
    'booking.select_payment': { ru: 'Шаг 2. Выберите способ оплаты', en: 'Step 2. Select Payment Method' },
    'booking.payler_title': { ru: 'VISA / MasterCard — Payler', en: 'VISA / MasterCard — Payler' },
    'booking.payler_desc': { ru: 'Безопасная оплата банковской картой', en: 'Secure bank card payment' },
    'booking.alifpay_title': { ru: 'VISA / MasterCard — AlifPay', en: 'VISA / MasterCard — AlifPay' },
    'booking.alifpay_desc': { ru: 'Локальная платежная система Таджикистана', en: 'Local payment system of Tajikistan' },
    'booking.binance_title': { ru: 'Binance (Криптовалюта)', en: 'Binance (Cryptocurrency)' },
    'booking.binance_desc': { ru: 'Оплата криптовалютой через Binance', en: 'Cryptocurrency payment via Binance' },
    'booking.korti_milli_title': { ru: 'Корти Милли', en: 'Korti Milli' },
    'booking.korti_milli_desc': { ru: 'Национальная платежная система Таджикистана', en: 'National payment system of Tajikistan' },
    'booking.pay': { ru: 'Оплатить', en: 'Pay' },
    'booking.loading_data': { ru: 'Загрузка данных бронирования...', en: 'Loading booking data...' },
    'booking.ssl_protected': { ru: 'Ваши данные защищены SSL-шифрованием', en: 'Your data is protected by SSL encryption' },
    'booking.processing_payment': { ru: 'Обработка платежа', en: 'Processing Payment' },
    'booking.please_wait': { ru: 'Пожалуйста, подождите...', en: 'Please wait...' },
    'booking.payment_success': { ru: 'Оплата успешна!', en: 'Payment Successful!' },
    'booking.booking_confirmed': { ru: 'Ваше бронирование подтверждено', en: 'Your booking is confirmed' },
    'booking.view_details': { ru: 'Посмотреть детали', en: 'View Details' },
    'booking.payment_error': { ru: 'Ошибка оплаты', en: 'Payment Error' },
    'booking.try_again_message': { ru: 'Попробуйте еще раз или выберите другой способ оплаты', en: 'Try again or choose another payment method' },
    'booking.try_again': { ru: 'Попробовать снова', en: 'Try Again' },
    
    // === GUIDE PROFILE PAGE ===
    'guide.profile_title': { ru: 'Профиль Гида | Bunyod-Tour', en: 'Guide Profile | Bunyod-Tour' },
    'guide.loading': { ru: 'Загрузка профиля гида...', en: 'Loading guide profile...' },
    'guide.error': { ru: 'Ошибка загрузки профиля гида', en: 'Error loading guide profile' },
    'guide.back_to_guides': { ru: 'Вернуться к списку гидов', en: 'Back to guides list' },
    'guide.experience': { ru: 'Опыт', en: 'Experience' },
    'guide.languages': { ru: 'Языки', en: 'Languages' },
    'guide.region': { ru: 'Регион обслуживания', en: 'Service Region' },
    'guide.contact': { ru: 'Контакт', en: 'Contact' },
    'guide.certificate': { ru: 'Сертификат', en: 'Certificate' },
    'guide.about': { ru: 'О гиде', en: 'About Guide' },
    'guide.accredited': { ru: 'Аккредитовано', en: 'Accredited by' },
    'guide.valid_registry': { ru: 'действителен согласно Реестру гидов по адресу', en: 'valid according to the Register of Guides at' },
    'guide.reviews_title': { ru: 'Отзывы', en: 'Reviews' },
    'guide.ratings_title': { ru: 'Оценки', en: 'Ratings' },
    'guide.leave_review': { ru: 'Оставить отзыв', en: 'Leave Review' },
    'guide.no_reviews': { ru: 'Пока нет отзывов', en: 'No reviews yet' },
    'guide.no_ratings': { ru: 'Пока нет оценок', en: 'No ratings yet' },
    'guide.first_review': { ru: 'Будьте первым, кто оставит отзыв!', en: 'Be the first to leave a review!' },
    
    // === REVIEWS (HOMEPAGE) ===
    'reviews.title': { ru: 'Отзывы наших клиентов', en: 'Customer Reviews' },
    'reviews.no_reviews': { ru: 'Пока нет отзывов', en: 'No reviews yet' },
    'reviews.tripadvisor_title': { ru: 'Отзывы на TripAdvisor', en: 'TripAdvisor Reviews' },
    'reviews.universal_title': { ru: 'Оставить отзыв', en: 'Leave a Review' },
    'reviews.universal_desc': { ru: 'Мы будем очень благодарны, если вы уделите немного времени и оставите отзыв нашим услугам!', en: 'We would be very grateful if you could take a little time to leave a review of our services!' },
    'reviews.leave_review': { ru: 'Оставить отзыв', en: 'Leave Review' },
    'reviews.leave_review_desc': { ru: 'Поделитесь вашими впечатлениями о туре и гиде', en: 'Share your feedback about the tour and guide' },
    'reviews.tour_rating': { ru: 'Рейтинг тура', en: 'Tour Rating' },
    'reviews.guide_rating': { ru: 'Рейтинг гида', en: 'Guide Rating' },
    'reviews.your_review': { ru: 'Ваш отзыв', en: 'Your Review' },
    'reviews.photos': { ru: 'Фотографии', en: 'Photos' },
    'reviews.moderation_notice': { ru: 'Ваш отзыв будет проверен модератором перед публикацией', en: 'Your review will be moderated before publication' },
    'reviews.success_message': { ru: 'Спасибо! Ваш отзыв успешно отправлен и будет опубликован после модерации.', en: 'Thank you! Your review has been submitted and will be published after moderation.' },
    'form.tour': { ru: 'Тур', en: 'Tour' },
    'form.guide': { ru: 'Гид', en: 'Guide' },
    'form.optional': { ru: '(необязательно)', en: '(optional)' },
    'form.guide_not_specified': { ru: 'Гид не указан', en: 'Guide not specified' },
    'form.tour_rating_error': { ru: 'Пожалуйста, укажите рейтинг тура', en: 'Please rate the tour' },
    'form.photos_optional': { ru: '(необязательно, до 5 фото)', en: '(optional, up to 5 photos)' },
    'form.photos_limit': { ru: 'Максимум 5 фото, до 5 МБ каждое', en: 'Maximum 5 photos, up to 5 MB each' },
    'form.choose_files': { ru: 'Выбрать файлы', en: 'Choose files' },
    'form.no_file_selected': { ru: 'Файл не выбран', en: 'No file selected' },
    'form.files_selected': { ru: '{count} файлов выбрано', en: '{count} files selected' },
    'form.review_placeholder': { ru: 'Расскажите о вашем опыте путешествия...', en: 'Share your travel experience...' },
    'form.name_placeholder': { ru: 'Иван Иванов', en: 'John Doe' },
    'form.select_tour_option': { ru: 'Выберите тур...', en: 'Select tour...' },
    'time.yesterday': { ru: 'вчера', en: 'yesterday' },
    'time.days_ago': { ru: 'дн. назад', en: 'days ago' },
    'time.weeks_ago': { ru: 'нед. назад', en: 'weeks ago' },
    'form.select_guide': { ru: 'Выберите гида', en: 'Select Guide' },
    'form.guide_help': { ru: 'Если хотите оценить гида, который вас сопровождал', en: 'If you want to rate the guide who accompanied you' },
    'form.select_tour': { ru: 'Выберите тур', en: 'Select Tour' },
    'form.login': { ru: 'Логин', en: 'Login' },
    'form.password': { ru: 'Пароль', en: 'Password' },
    'form.enter_login': { ru: 'Введите логин', en: 'Enter login' },
    'form.enter_password': { ru: 'Введите пароль', en: 'Enter password' },
    'form.guide_cabinet': { ru: 'Кабинет тургида', en: 'Tour Guide Cabinet' },
    'form.sign_in': { ru: 'Войдите в свой аккаунт', en: 'Sign in to your account' },
    'form.forgot_password': { ru: 'Забыли пароль? Обратитесь к администратору', en: 'Forgot password? Contact administrator' },
    'form.back_home': { ru: 'На главную', en: 'Back Home' },
    'form.loading_login': { ru: 'Вход в систему...', en: 'Signing in...' },
    'guide.my_tours': { ru: 'Мои туры', en: 'My Tours' },
    'guide.dashboard': { ru: 'Кабинет гида', en: 'Guide Dashboard' },
    'guide.tour_code': { ru: 'Код тура', en: 'Tour Code' },
    'guide.tourists': { ru: 'Туристы', en: 'Tourists' },
    'guide.status': { ru: 'Статус', en: 'Status' },
    'guide.actions': { ru: 'Действия', en: 'Actions' },
    'guide.no_tours': { ru: 'У вас нет активных туров', en: 'You have no active tours' },
    'guide.view_details': { ru: 'Подробнее', en: 'View Details' },
    'guide.logout_confirm': { ru: 'Вы уверены? Выход из системы', en: 'Are you sure? Sign out' },

    // === КАБИНЕТ ГИДА (guide-cabinet.html) ===
    'guide.cabinet_loading': { ru: 'Загрузка...', en: 'Loading...' },
    'guide.dates': { ru: 'Дата', en: 'Date' },
    'guide.day_label': { ru: 'День', en: 'Day' },
    'guide.hires_tab': { ru: 'Наймы', en: 'Hires' },
    'guide.filter_all': { ru: 'Все', en: 'All' },
    'guide.filter_approved': { ru: 'Подтверждённые', en: 'Approved' },
    'guide.filter_pending': { ru: 'Ожидающие', en: 'Pending' },
    'guide.filter_completed': { ru: 'Завершённые', en: 'Completed' },
    'guide.no_hires': { ru: 'У вас нет заявок на найм', en: 'You have no hire requests' },
    'guide.tour_progress': { ru: 'Прогресс тура', en: 'Tour Progress' },
    'guide.completed_label': { ru: 'Завершено', en: 'Completed' },
    'guide.days_completed': { ru: 'Завершено дней', en: 'Days completed' },
    'guide.tour_in_progress': { ru: 'Тур в процессе', en: 'Tour in progress' },
    'guide.tour_finished': { ru: 'Тур завершён', en: 'Tour finished' },
    'guide.tour_program': { ru: 'Программа тура', en: 'Tour Program' },
    'guide.bookings_count': { ru: 'Бронирований', en: 'Bookings' },
    'guide.tourists_label': { ru: 'Туристов', en: 'Tourists' },
    'guide.persons': { ru: 'чел.', en: 'persons' },
    'guide.no_title': { ru: 'Без названия', en: 'No title' },
    'guide.customer': { ru: 'Клиент', en: 'Customer' },
    'guide.modal_close': { ru: 'Закрыть', en: 'Close' },
    'guide.completed_days_label': { ru: 'Завершённые дни', en: 'Completed days' },

    // Статусы туров
    'guide.status_scheduled': { ru: 'Запланирован', en: 'Scheduled' },
    'guide.status_active': { ru: 'В процессе', en: 'In Progress' },
    'guide.status_finished': { ru: 'Завершён', en: 'Completed' },
    'guide.status_cancelled': { ru: 'Отменён', en: 'Cancelled' },

    // Наймы гида
    'guide.hire_dates': { ru: 'Даты', en: 'Dates' },
    'guide.hire_days': { ru: 'Дней', en: 'Days' },
    'guide.hire_price_per_day': { ru: 'Цена/день', en: 'Price/day' },
    'guide.hire_total': { ru: 'Итого', en: 'Total' },
    'guide.hire_created': { ru: 'Создано', en: 'Created' },
    'guide.hire_responded': { ru: 'Ответ', en: 'Response' },
    'guide.your_response': { ru: 'Ваш ответ', en: 'Your response' },
    'guide.accept_hire': { ru: 'Принять заявку', en: 'Accept Request' },
    'guide.reject_hire': { ru: 'Отклонить', en: 'Reject' },
    'guide.hire_response_pending': { ru: 'Ожидает вашего ответа', en: 'Awaiting your response' },
    'guide.hire_response_accepted': { ru: 'Вы приняли', en: 'You accepted' },
    'guide.hire_response_rejected': { ru: 'Вы отклонили', en: 'You rejected' },
    'guide.hire_status_pending': { ru: 'Ожидает', en: 'Pending' },
    'guide.hire_status_approved': { ru: 'Подтверждён', en: 'Approved' },
    'guide.hire_status_rejected': { ru: 'Отклонён', en: 'Rejected' },
    'guide.hire_status_completed': { ru: 'Завершён', en: 'Completed' },
    'guide.hire_status_cancelled': { ru: 'Отменён', en: 'Cancelled' },
    'guide.payment_unpaid': { ru: 'Не оплачено', en: 'Unpaid' },
    'guide.payment_paid': { ru: 'Оплачено', en: 'Paid' },
    'guide.payment_refunded': { ru: 'Возврат', en: 'Refunded' },

    // Модал отклонения найма
    'guide.reject_modal_title': { ru: 'Отклонить заявку', en: 'Reject Request' },
    'guide.reject_reason_label': { ru: 'Укажите причину отклонения (необязательно):', en: 'Specify rejection reason (optional):' },
    'guide.reject_placeholder': { ru: 'Например: Я уже занят в эти даты...', en: 'For example: I\'m already busy on those dates...' },
    'guide.cancel_btn': { ru: 'Отмена', en: 'Cancel' },
    'btn.cancel': { ru: 'Закрыть', en: 'Close' },

    // Алерты и подтверждения в кабинете гида
    'guide.confirm_start_tour': { ru: 'Начать тур?', en: 'Start tour?' },
    'guide.confirm_finish_day': { ru: 'Завершить день?', en: 'Finish day?' },
    'guide.confirm_finish_tour': { ru: 'Завершить тур?', en: 'Finish tour?' },
    'guide.hire_accepted_alert': { ru: 'Заявка принята! Турист получит уведомление.', en: 'Request accepted! The tourist will be notified.' },
    'guide.hire_rejected_alert': { ru: 'Заявка отклонена.', en: 'Request rejected.' },
    'guide.error_hire_response': { ru: 'Ошибка при обработке ответа', en: 'Error processing response' },
    'guide.collect_reviews_success': { ru: 'Запрос на сбор отзывов отправлен туристам!', en: 'Review collection request sent to tourists!' },
    'guide.collect_reviews_error': { ru: 'Ошибка при отправке запроса на отзывы', en: 'Error sending review request' },
    'guide.error_action': { ru: 'Ошибка выполнения действия', en: 'Error performing action' },
    'guide.error_connection': { ru: 'Ошибка подключения', en: 'Connection error' },
    'guide.error_tour_details': { ru: 'Ошибка загрузки деталей тура', en: 'Error loading tour details' },

    // Авторизация гида
    'guide.error_login': { ru: 'Ошибка входа', en: 'Login error' },
    'guide.error_server': { ru: 'Ошибка подключения к серверу', en: 'Server connection error' },
    'guide.login_page_title': { ru: 'Вход для тургидов - Bunyod-Tour', en: 'Tour Guide Login - Bunyod-Tour' },
    'guide.cabinet_page_title': { ru: 'Кабинет гида | Bunyod-Tour', en: 'Guide Dashboard | Bunyod-Tour' },
    
    // === GUIDE REVIEW FORM ===
    'guide_review.page_title': { ru: 'Оставить отзыв о гиде | Bunyod-Tour', en: 'Leave Guide Review | Bunyod-Tour' },
    'guide_review.leave_review': { ru: 'Оставить отзыв о гиде', en: 'Leave Guide Review' },
    'guide_review.your_name': { ru: 'Ваше имя *', en: 'Your Name *' },
    'guide_review.rating_label': { ru: 'Оценка гида *', en: 'Guide Rating *' },
    'guide_review.click_stars': { ru: 'Нажмите на звезды для оценки', en: 'Click stars to rate' },
    'guide_review.your_review': { ru: 'Ваш отзыв *', en: 'Your Review *' },
    'guide_review.min_characters': { ru: 'Минимум 20 символов', en: 'Minimum 20 characters' },
    'guide_review.photos': { ru: 'Фотографии (необязательно)', en: 'Photos (optional)' },
    'guide_review.choose_photos': { ru: 'Выбрать фотографии', en: 'Choose Photos' },
    'guide_review.photo_limit': { ru: 'Максимум 5 фотографий, до 5MB каждая', en: 'Maximum 5 photos, up to 5MB each' },
    'guide_review.submit': { ru: 'Отправить отзыв', en: 'Submit Review' },
    'guide_review.moderation': { ru: 'Ваш отзыв будет опубликован после модерации', en: 'Your review will be published after moderation' },
    'guide_review.thank_you': { ru: 'Спасибо за отзыв!', en: 'Thank You for Your Review!' },
    'guide_review.success_message': { ru: 'Ваш отзыв успешно отправлен и будет опубликован после модерации.', en: 'Your review has been successfully submitted and will be published after moderation.' },
    'guide_review.back_to_guides': { ru: 'Вернуться к гидам', en: 'Back to Guides' },
    'guide.badge_tour': { ru: 'Тур', en: 'Tour' },
    'guide.badge_guide': { ru: 'ГИД', en: 'GUIDE' },
    'guide.company_name': { ru: 'ООО «Бунёд-Тур»', en: 'Bunyod-Tour LLC' },
    
    // === TOUR SEARCH PAGE ===
    'search.page_title': { ru: 'Поиск туров - Bunyod-Tour', en: 'Tour Search - Bunyod-Tour' },
    'search.search_placeholder': { ru: 'Поиск туров...', en: 'Search tours...' },
    'search.hero_title': { ru: 'Найдите идеальный тур', en: 'Find Your Perfect Tour' },
    'search.destination_placeholder': { ru: 'Куда вы хотите поехать?', en: 'Where do you want to go?' },
    'search.dates_placeholder': { ru: 'Выберите даты', en: 'Select dates' },
    'search.duration_placeholder': { ru: 'Длительность', en: 'Duration' },
    'search.search_button': { ru: 'Найти туры', en: 'Find Tours' },
    'search.filters': { ru: 'Фильтры', en: 'Filters' },
    'search.price_range': { ru: 'Диапазон цен', en: 'Price Range' },
    'search.tour_type': { ru: 'Тип тура', en: 'Tour Type' },
    'search.difficulty': { ru: 'Сложность', en: 'Difficulty' },
    'search.sort_by': { ru: 'Сортировать по:', en: 'Sort by:' },
    'search.price_low_high': { ru: 'Цена (по возрастанию)', en: 'Price (Low to High)' },
    'search.price_high_low': { ru: 'Цена (по убыванию)', en: 'Price (High to Low)' },
    'search.rating': { ru: 'Рейтинг', en: 'Rating' },
    'search.duration': { ru: 'Длительность', en: 'Duration' },
    'search.no_results': { ru: 'Туры не найдены', en: 'No tours found' },
    'search.try_filters': { ru: 'Попробуйте изменить параметры поиска или фильтры', en: 'Try changing search parameters or filters' },
    'search.showing_results': { ru: 'Показано результатов:', en: 'Showing results:' },
    'search.clear_all': { ru: 'Очистить все', en: 'Clear All' },
    'search.apply_filters': { ru: 'Применить фильтры', en: 'Apply Filters' },
    'search.found': { ru: 'Найдено:', en: 'Found:' },
    'search.tours': { ru: 'Туры', en: 'Tours' },
    'search.recommended': { ru: 'Рекомендуемые', en: 'Recommended' },
    'search.by_rating': { ru: 'По рейтингу', en: 'By Rating' },
    'search.by_duration': { ru: 'По длительности', en: 'By Duration' },
    'search.loading': { ru: 'Загрузка туров...', en: 'Loading tours...' },
    'search.min_price': { ru: 'От', en: 'From' },
    'search.max_price': { ru: 'До', en: 'To' },
    'search.hotel_chains': { ru: 'Сетевые отели', en: 'Hotel Chains' },
    'search.luxury': { ru: 'Люкс сегмент', en: 'Luxury Segment' },
    'search.premium': { ru: 'Премиум сегмент', en: 'Premium Segment' },
    'search.mid_range': { ru: 'Средний сегмент', en: 'Mid-Range Segment' },
    'search.duration_1_3': { ru: '1-3 дня', en: '1-3 days' },
    'search.duration_4_7': { ru: '4-7 дней', en: '4-7 days' },
    'search.duration_8_14': { ru: '8-14 дней', en: '8-14 days' },
    'search.duration_15_plus': { ru: '15+ дней', en: '15+ days' },
    'search.per_person': { ru: '/ чел', en: '/ person' },
    'search.from': { ru: 'от', en: 'from' },
    'search.reviews': { ru: 'отзывов', en: 'reviews' },
    'search.title': { ru: 'Найдите идеальный тур или отель', en: 'Find the Perfect Tour or Hotel' },
    'search.input_placeholder': { ru: 'Поиск по названию...', en: 'Search by name...' },
    'search.all_countries': { ru: 'Все страны', en: 'All Countries' },
    'search.all_cities': { ru: 'Все города', en: 'All Cities' },
    'search.search_btn': { ru: 'Поиск', en: 'Search' },
    'search.categories': { ru: 'Категории', en: 'Categories' },
    'search.price_from': { ru: 'От', en: 'From' },
    'search.price_to': { ru: 'До', en: 'To' },
    'search.group_size': { ru: 'Численность группы', en: 'Group Size' },
    'search.group_min_label': { ru: 'Мин:', en: 'Min:' },
    'search.group_max_label': { ru: 'Макс:', en: 'Max:' },
    'search.people_label': { ru: 'чел.', en: 'ppl.' },
    'search.group_from': { ru: 'От', en: 'From' },
    'search.group_to': { ru: 'До', en: 'To' },
    'search.tour_blocks': { ru: 'Направления', en: 'Directions' },
    'search.tour_date': { ru: 'Дата тура', en: 'Tour Date' },
    'search.filter_countries': { ru: 'Страны', en: 'Countries' },
    'search.filter_cities': { ru: 'Города', en: 'Cities' },
    'search.filter_locations': { ru: 'Локации', en: 'Locations' },
    'search.tour_format': { ru: 'Формат тура', en: 'Tour Format' },
    'search.tour_duration': { ru: 'Длительность', en: 'Duration' },
    'search.tour_languages': { ru: 'Языки тура', en: 'Tour Languages' },
    'search.hotel_stars': { ru: 'Звезды', en: 'Stars' },
    'search.hotel_amenities': { ru: 'Удобства', en: 'Amenities' },
    'search.hotel_rating': { ru: 'Рейтинг отеля', en: 'Hotel Rating' },
    'search.reset_filters': { ru: 'Сбросить фильтры', en: 'Reset Filters' },
    'search.hotels': { ru: 'Отели', en: 'Hotels' },
    'search.sort_relevance': { ru: 'По релевантности', en: 'By Relevance' },
    'search.sort_price_asc': { ru: 'Цена: по возрастанию', en: 'Price: Low to High' },
    'search.sort_price_desc': { ru: 'Цена: по убыванию', en: 'Price: High to Low' },
    'search.sort_rating': { ru: 'По рейтингу', en: 'By Rating' },
    'hotel.price_on_request': { ru: 'Цена по запросу', en: 'Price on Request' },
    'btn.view_details': { ru: 'Подробнее', en: 'View Details' },
    
    // === ABOUT US PAGE ===
    'about.page_title': { ru: 'О нас - Bunyod-Tour', en: 'About Us - Bunyod-Tour' },
    'about.title': { ru: 'О НАС', en: 'ABOUT US' },
    'about.company_description': { ru: 'Туристическая компания "Бунёд-Тур" была создана в 2017 году и является одним из лидеров туристической индустрии в Республике Таджикистан. Компания специализируется на организации туров по всему Таджикистану и странам Центральной Азии.', en: 'Bunyod-Tour travel company was established in 2017 and is one of the leaders in the tourism industry in the Republic of Tajikistan. The company specializes in organizing tours throughout Tajikistan and Central Asian countries.' },
    'about.company_title': { ru: 'Наша компания', en: 'Our Company' },
    'about.company_services': { ru: '"Бунёд-Тур" предлагает широкий спектр туристических услуг, включая организацию индивидуальных и групповых туров, экскурсий, трансферов, бронирование отелей и визовую поддержку.', en: '"Bunyod-Tour" offers a wide range of tourism services, including organizing individual and group tours, excursions, transfers, hotel bookings, and visa support.' },
    'about.company_partner': { ru: 'Мы гордимся тем, что являемся надежным партнером для туристов со всего мира, желающих познакомиться с уникальной культурой и природными красотами Таджикистана.', en: 'We are proud to be a reliable partner for tourists from around the world who want to discover the unique culture and natural beauty of Tajikistan.' },
    'about.company_image': { ru: 'Изображение офиса компании', en: 'Company office image' },
    'about.mission_title': { ru: 'МИССИЯ', en: 'MISSION' },
    'about.mission_founded': { ru: 'ООО «Бунёд-Тур» - туристическая компания, учреждена в 2017 году в Таджикистане.', en: 'LLC "Bunyod-Tour" - a travel company, established in 2017 in Tajikistan.' },
    'about.mission_description': { ru: 'Основная миссия компании, это формирование и устойчивое развитие организационно-практических и перспективных основ сферы туризма в Таджикистане, в том числе внутреннего рынка туристических услуг — экологического и приключенческого туризма.', en: 'The main mission of the company is the formation and sustainable development of organizational, practical and prospective foundations of the tourism sector in Tajikistan, including the domestic market of tourist services - ecological and adventure tourism.' },
    'about.mission_image': { ru: 'Изображение миссии компании', en: 'Company mission image' },
    'about.potential_title': { ru: 'ПОТЕНЦИАЛ', en: 'POTENTIAL' },
    'about.potential_license': { ru: 'Бунёд-Тур, лицензированная компания (№0000253, от 25.10.2022) располагает более чем 500 турпродуктами, имеет партнерства с более чем 50 отечественными и зарубежными организациями, является партнером Комитета по развитию туризма при Правительстве Республики Таджикистан по внутреннему туризму;', en: 'Bunyod-Tour, a licensed company (№0000253, dated 25.10.2022) has more than 500 tour products, has partnerships with more than 50 domestic and foreign organizations, and is a partner of the Committee for Tourism Development under the Government of the Republic of Tajikistan for domestic tourism;' },
    'about.potential_services': { ru: 'Сегодня наши основные услуги — это туры и экскурсии, бронирование отелей, трансфер, авиабилеты, визовая поддержка, подарочные сертификаты и т.п.', en: 'Today, our main services include tours and excursions, hotel reservations, transfers, air tickets, visa support, gift certificates, and more.' },
    'about.associations_title': { ru: 'ЧЛЕНСТВО В АССОЦИАЦИЯХ', en: 'ASSOCIATION MEMBERSHIP' },
    'about.pata_member': { ru: 'Бунёд-Тур является членом PATA - Азиатской Тихоокеанской ассоциации туристических компаний.', en: 'Bunyod-Tour is a member of PATA - Pacific Asia Travel Association.' },
    'about.pata_description': { ru: 'PATA — это некоммерческая ассоциация, которая была создана в 1951 году и получила международное признание как ответственный катализатор в развитии путешествий и туризма в Азиатско-Тихоокеанском регионе и за его пределами.', en: 'PATA is a non-profit association that was created in 1951 and has gained international recognition as a responsible catalyst in the development of travel and tourism in the Asia-Pacific region and beyond.' },
    'about.pata_certificate': { ru: 'Сертификат PATA', en: 'PATA Certificate' },
    'about.services_title': { ru: 'НАШИ УСЛУГИ / ПРОДУКТЫ', en: 'OUR SERVICES / PRODUCTS' },
    'about.tours_title': { ru: 'ТУРЫ', en: 'TOURS' },
    'about.tours_individual_group': { ru: 'Индивидуальные и групповые туры по Таджикистану', en: 'Individual and group tours in Tajikistan' },
    'about.tours_cultural': { ru: 'Экскурсии: Культурно-исторические', en: 'Excursions: Cultural and Historical' },
    'about.tours_school': { ru: 'Школьные', en: 'School Tours' },
    'about.tours_wellness': { ru: 'Оздоровительные', en: 'Wellness Tours' },
    'about.tours_adventure': { ru: 'Приключенческие', en: 'Adventure Tours' },
    'about.tours_hunting': { ru: 'Охота', en: 'Hunting' },
    'about.tours_custom': { ru: 'Туры на заказ', en: 'Custom Tours' },
    'about.tours_cis': { ru: 'Туры по странам СНГ', en: 'CIS Countries Tours' },
    'about.tours_international': { ru: 'Международные туры', en: 'International Tours' },
    'about.credit_tours_title': { ru: 'ТУРЫ В КРЕДИТ', en: 'TOURS ON CREDIT' },
    'about.credit_tours_description': { ru: 'Это вид сервиса, который представляется для клиентов, желающих путешествовать в качестве возможности или шанса реализации своих туристических целей и планов.', en: 'This is a type of service offered to clients who wish to travel as an opportunity to realize their travel goals and plans.' },
    'about.credit_tours_partner': { ru: 'Данная программа реализуется в партнерстве с кредитной организацией Алиф-Капитал.', en: 'This program is implemented in partnership with Alif Capital credit organization.' },
    'about.gift_certificate_title': { ru: 'ПОДАРОЧНЫЙ СЕРТИФИКАТ', en: 'GIFT CERTIFICATE' },
    'about.gift_certificate_description': { ru: 'Туристический подарочный сертификат имеет номинал в определённой сумме, и обладатель получает право приобрести тур стоимостью, равной указанному номиналу.', en: 'A travel gift certificate has a nominal value of a certain amount, and the holder has the right to purchase a tour worth the specified nominal value.' },
    
    // === ABOUT PAGE KEYS ===
    'about.nav.potential': { ru: 'Потенциал', en: 'Potential' },
    'about.nav.associations': { ru: 'Ассоциации', en: 'Associations' },
    'about.nav.services': { ru: 'Услуги', en: 'Services' },
    'about.nav.partners': { ru: 'Партнёры', en: 'Partners' },
    'about.nav.achievements': { ru: 'Достижения', en: 'Achievements' },
    'about.office_image_alt': { ru: 'Изображение офиса компании', en: 'Company office image' },
    'about.mission_image_alt': { ru: 'Изображение миссии компании', en: 'Company mission image' },
    'about.potential_title': { ru: 'ПОТЕНЦИАЛ', en: 'POTENTIAL' },
    'about.pata_title': { ru: 'ЧЛЕНСТВО В АССОЦИАЦИЯХ', en: 'MEMBERSHIP IN ASSOCIATIONS' },
    'about.pata_certificate_alt': { ru: 'Сертификат PATA', en: 'PATA Certificate' },
    'about.tours_credit_title': { ru: 'ТУРЫ В КРЕДИТ', en: 'TOURS ON CREDIT' },
    'about.gift_certificate_title': { ru: 'ПОДАРОЧНЫЙ СЕРТИФИКАТ', en: 'GIFT CERTIFICATE' },
    'about.flights_title': { ru: 'АВИАБИЛЕТЫ', en: 'AIRLINE TICKETS' },
    'about.transfer_title': { ru: 'ТРАНСФЕР', en: 'TRANSFER' },
    'about.visa_support_title': { ru: 'ВИЗА ПОДДЕРЖКА', en: 'VISA SUPPORT' },
    'about.partners_title': { ru: 'НАШИ ПАРТНЁРЫ', en: 'OUR PARTNERS' },
    'about.partner1.name': { ru: 'Алиф-Капитал', en: 'Alif-Capital' },
    'about.partner1.description': { ru: 'Кредитная организация для туров в кредит', en: 'Credit organization for tours on credit' },
    'about.partner2.description': { ru: 'Международная туристическая платформа', en: 'International tourism platform' },
    'about.partner3.description': { ru: 'Платформа для элитных туров', en: 'Platform for elite tours' },
    'about.achievements_title': { ru: 'НАШИ ДОСТИЖЕНИЯ', en: 'OUR ACHIEVEMENTS' },
    'about.achievement1.title': { ru: 'Лет опыта', en: 'Years of Experience' },
    'about.achievement1.description': { ru: 'С 2017 года в туристической сфере', en: 'Since 2017 in the tourism industry' },
    'about.achievement2.title': { ru: 'Довольных клиентов', en: 'Satisfied Clients' },
    'about.achievement2.description': { ru: 'Успешно организованных туров', en: 'Successfully organized tours' },
    'about.achievement3.title': { ru: 'Туристических программ', en: 'Tourist Programs' },
    'about.achievement3.description': { ru: 'По Центральной Азии', en: 'Throughout Central Asia' },
    'about.achievement4.title': { ru: 'Стран покрытия', en: 'Countries Covered' },
    'about.achievement4.description': { ru: 'Таджикистан, Узбекистан, Кыргызстан, Казахстан, Туркменистан', en: 'Tajikistan, Uzbekistan, Kyrgyzstan, Kazakhstan, Turkmenistan' },
    'about.team_title': { ru: 'КОМАНДА', en: 'TEAM' },
    'about.team1.name': { ru: 'МИРАЛИЕВА СИТОРАМО', en: 'MIRALIEVA SITORAMO' },
    'about.team1.position': { ru: 'Руководитель проекта', en: 'Project Manager' },
    'about.team2.name': { ru: 'КУРБОНОВ СУХРОБ', en: 'KURBONOV SUKHROB' },
    
    // === NEW ABOUT PAGE TRANSLATIONS (2025) ===
    'about.nav.why_us': { ru: 'Почему мы', en: 'Why Us' },
    'about.nav.awards': { ru: 'Награды', en: 'Awards' },
    'about.intro_1': { ru: 'была основана в 2017 году и является одной из ведущих туристических компаний в Таджикистане и Центральной Азии. Компания специализируется на организации туров и других туристических услуг по всей Центральной Азии.', en: 'was founded in 2017 and is one of the leading tourism companies in Tajikistan and Central Asia. The company specializes in organizing tours and other travel services throughout Central Asia.' },
    'about.intro_2': { ru: 'Наша компания предоставляет широкий спектр туристических услуг, включая групповые и индивидуальные (персональные) туры, экскурсии, внутренние и центральноазиатские, а также культурные, исторические, экологические, приключенческие и т.д.', en: 'Our Company provides a wide range of tourism services, including group and individual (personal) tours, excursions, domestic and Central Asian, as well as cultural, historical, ecological, adventure, etc.' },
    'about.intro_3_part1': { ru: 'Наш сайт работает как центральноазиатская туристическая платформа и является онлайн-порталом продаж пяти типов туристических продуктов:', en: 'Our website operates as a Central Asian tourism platform and is an online sales portal for five types of tourism products:' },
    'about.intro_3_products': { ru: '(1) туры, (2) экскурсии, (3) услуги гидов, (4) трансферы и (5) B2B партнёрство', en: '(1) tours, (2) excursions, (3) tour guide services, (4) transfers, and (5) B2B partnerships' },
    'about.intro_3_part2': { ru: 'В разделе "Создать тур" вы также можете создать индивидуальный тур в соответствии с вашими предпочтениями и потребностями.', en: 'In the "Create Your Tour" section, you can also design a personalized tour according to your preferences and needs.' },
    'about.intro_4_part1': { ru: 'Bunyod-Tour разработала более', en: 'Bunyod-Tour has developed over' },
    'about.intro_4_part2': { ru: 'туристических программ в сотрудничестве с', en: 'travel programs in collaboration with' },
    'about.intro_4_part3': { ru: 'национальными и региональными компаниями (нашими партнёрами в различных странах), что позволяет нам выполнять пожелания наших гостей (туристов).', en: 'national and regional companies (our partners in various countries), enabling us to fulfill the wishes of our guests (tourists).' },
    'about.why_us_title': { ru: 'ПОЧЕМУ МЫ?', en: 'WHY CHOOSE US?' },
    'about.reason_1_title': { ru: 'Наша политика', en: 'Our Policy' },
    'about.reason_1_desc': { ru: 'Наша политика — обеспечить всем гостям атмосферу доверия, комфорта и справедливого отношения. Мы соблюдаем правовые нормы, этику и общепринятые международные стандарты.', en: 'Our policy is to provide all guests with an atmosphere of trust, comfort and fair treatment. We comply with legal regulations, ethics and generally accepted international standards.' },
    'about.reason_2_title': { ru: 'Местная компания', en: 'Local Company' },
    'about.reason_2_desc': { ru: 'Мы — местная компания, базирующаяся в Центральной Азии. Мы знаем наш регион, рынок услуг, культуру и обычаи лучше, чем кто-либо другой, поэтому мы лучше приветствуем и обслуживаем наших гостей.', en: 'We are a local company based in Central Asia. We know our region, service market, culture, and customs better than anyone else, which is why we are better able to welcome and serve our guests.' },
    'about.reason_3_title': { ru: 'Высокое качество туров', en: 'High Quality Tours' },
    'about.reason_3_desc': { ru: 'Наши туристические продукты отличаются высоким качеством, реалистичностью и доступными ценами, так как мы регулярно обновляем цены в соответствии с региональным туристическим рынком.', en: 'Our travel products are distinguished by their high quality, realism, and affordable prices, as we regularly update prices in line with the regional travel market.' },
    'about.reason_4_title': { ru: 'Прямое бронирование B2C', en: 'B2C Direct Booking' },
    'about.reason_4_desc': { ru: 'Мы работаем напрямую с клиентами (B2C), любой может забронировать туры напрямую на нашем сайте без участия третьих лиц.', en: 'We interact directly with customers (B2C), anyone can book tours directly on our website without the involvement of third parties.' },
    'about.reason_5_title': { ru: 'Онлайн-магазин туров', en: 'E-Tour Services Store' },
    'about.reason_5_desc': { ru: 'Наш сайт представлен как магазин туристических услуг с огромным разнообразием вариантов, где каждый может найти и мгновенно забронировать подходящий туристический продукт.', en: 'Our website is presented as a tour services store with a huge variety of options, where everyone can find and instantly book a tour product that suits them.' },
    'about.reason_6_title': { ru: 'Доступные услуги', en: 'Affordable Services' },
    'about.reason_6_desc': { ru: 'На нашем сайте любой может забронировать доступные туристические услуги, такие как экскурсии, услуги гидов, трансферы или создать свой собственный тур.', en: 'On our website, anyone can book affordable tourist services such as excursions, tour guide services, transfers, or create their own tour.' },
    'about.reason_7_title': { ru: 'Разнообразие продуктов', en: 'Variety of Products' },
    'about.reason_7_desc': { ru: 'Мы предлагаем разнообразные туристические продукты: частные, групповые, экскурсионные, региональные и комбинированные (по всем странам Центральной Азии).', en: 'We offer a variety of tourism products: private, group, excursion, regional, and combined (in all countries of Central Asia).' },
    'about.reason_8_title': { ru: 'Опытные гиды', en: 'Experienced Tour Guides' },
    'about.reason_8_desc': { ru: 'Мы предоставляем профессиональных, сертифицированных и опытных гидов, владеющих английским, русским, китайским и персидским языками.', en: 'We provide professional, certified, and experienced tour guides who speak English, Russian, Chinese, and Persian.' },
    'about.reason_9_title': { ru: 'B2B партнёрство', en: 'B2B Partnership' },
    'about.reason_9_desc': { ru: 'В рамках нашего B2B партнёрства любой может сотрудничать с нами как турпартнёр (турагент). Просто посетите наш сайт и зарегистрируйтесь.', en: 'As part of our B2B partnership, anyone can collaborate with us as a Tour partner (Tour agent). Simply visit our website and register.' },
    'about.reason_10_title': { ru: 'Онлайн-бронирование', en: 'Online Booking System' },
    'about.reason_10_desc': { ru: 'Наш сайт — один из первых в регионе, функционирующий как система онлайн-бронирования.', en: 'Our website is one of the first in the region to function as an online booking system.' },
    'about.reason_11_title': { ru: 'Онлайн-оплата', en: 'Online Payment System' },
    'about.reason_11_desc': { ru: 'Наш сайт предлагает несколько способов онлайн-оплаты, включая Visa, Mastercard, криптовалюту, МИР и Корти Милли.', en: 'Our website offers several online payment methods, including Visa, Mastercard, cryptocurrency, MIR, and Korti Milli.' },
    'about.reason_12_title': { ru: 'Признанная компания', en: 'Recognized Company' },
    'about.reason_12_desc': { ru: 'Мы гордимся репутацией нашей компании; наши достижения можно найти на нескольких международных интернет-порталах, таких как Google, TripAdvisor, Trip.com, Viator, GYG и др.', en: 'We are proud of our company\'s reputation; our achievements can be found on several international internet portals, such as Google, TripAdvisor, Trip.com, Viator, GYG, and others.' },
    'about.reason_13_title': { ru: 'Международное признание', en: 'International Recognition' },
    'about.reason_13_desc': { ru: 'Наши достижения признаны международным туристическим сообществом; мы являемся членами PATA (Тихоокеанская ассоциация туристических агентов) и WTTS (Всемирное общество путешествий и туризма).', en: 'Our achievements are recognized by the international tourism community; we are members of PATA (Pacific Asia Travel Association) and WTTS (World Travel and Tourism Society).' },
    'about.reason_14_title': { ru: 'Лидер региона', en: 'Regional Leader' },
    'about.reason_14_desc': { ru: 'Мы занимаем лидирующие позиции среди туристических компаний в Центральной Азии и Таджикистане.', en: 'We are a leading tour operator in Central Asia and Tajikistan.' },
    'about.service_1': { ru: 'Частные и групповые туры в Таджикистан и Центральную Азию', en: 'Private and group tours to Tajikistan & Central Asia' },
    'about.service_2': { ru: 'Комбинированные туры по странам Центральной Азии', en: 'Combined tours to Central Asia countries' },
    'about.service_3': { ru: 'Однодневные туры и городские экскурсии', en: 'One-day tours and city excursions' },
    'about.service_4': { ru: 'Треккинг-туры в Фанские и Памирские горы', en: 'Trekking tours to Fann & Pamir Mountains' },
    'about.service_5': { ru: 'Туры по трассе M41-Памирское шоссе и Ваханская долина', en: 'Tours to M41-Pamir Highway & Wakhan Valley' },
    'about.service_6': { ru: 'Санаторные и оздоровительные туры', en: 'Sanatorium and healthy tours' },
    'about.service_7': { ru: 'Визовая поддержка, официальное приглашение', en: 'Visa support, Official Invitation Letter' },
    'about.service_8': { ru: 'MICE — конференции, семинары', en: 'MICE – conferences, seminars' },
    'about.service_9': { ru: 'Трансфер — транспортные услуги', en: 'Transfer – transportation services' },
    'about.service_10': { ru: 'Услуги гидов', en: 'Tour-guide services' },
    'about.service_11': { ru: 'Бронирование отелей, проживание', en: 'Hotel booking, accommodation' },
    'about.service_12': { ru: 'B2B партнёрство, агентские услуги', en: 'B2B partnership, Tour Agent services' },
    'about.awards_title': { ru: 'НАШИ НАГРАДЫ', en: 'OUR AWARDS' },
    'about.award_2023_title': { ru: 'Сертификат мэрии Душанбе', en: 'Dushanbe Mayor\'s Certificate' },
    'about.award_2023_desc': { ru: 'Сертификат от мэрии города Душанбе за реализацию лучших инициатив и вклад в развитие туристической инфраструктуры Душанбе.', en: 'Certificate from the Dushanbe Mayor\'s Office for implementing the best initiatives and contributing to the development of Dushanbe\'s tourism infrastructure.' },
    'about.award_2024_title': { ru: 'Лучший туристический сайт', en: 'Best Tourism Website' },
    'about.award_2024_desc': { ru: 'Диплом первой степени «Лучший сайт в сфере туризма» от Комитета по развитию туризма при Правительстве Республики Таджикистан.', en: 'First-degree diploma "Best Website in the Field of Tourism" from the Committee for Tourism Development under the Government of the Republic of Tajikistan.' },
    'about.award_2025_title': { ru: 'Лучшие туристические услуги', en: 'Best Tourism Services' },
    'about.award_2025_desc': { ru: 'Диплом третьей степени «Лучшая организация, оказывающая туристические услуги в Таджикистане» от Комитета по развитию туризма при Правительстве Республики Таджикистан.', en: 'Third-degree diploma "Best Organization Providing Tourism Services in Tajikistan" from the Committee for Tourism Development under the Government of the Republic of Tajikistan.' },
    'about.associations_title': { ru: 'ЧЛЕНСТВО В АССОЦИАЦИЯХ', en: 'MEMBERSHIPS' },
    'about.pata_title': { ru: 'Член PATA', en: 'PATA Member' },
    'about.pata_since': { ru: 'С сентября 2019 года', en: 'Since September 2019' },
    'about.pata_desc': { ru: 'Тихоокеанская Азиатская Туристическая Ассоциация — некоммерческая организация, признанная на международном уровне как ответственный катализатор развития путешествий и туризма в Азиатско-Тихоокеанском регионе и за его пределами.', en: 'Pacific Asia Travel Association - a non-profit organization recognized internationally as a responsible catalyst for the development of travel and tourism in the Asia-Pacific region and beyond.' },
    'about.wtts_title': { ru: 'Член WTTS', en: 'WTTS Member' },
    'about.wtts_since': { ru: 'С августа 2025 года', en: 'Since August 2025' },
    'about.wtts_desc': { ru: 'Всемирное Общество Путешествий и Туризма — демонстрирует нашу приверженность профессиональному развитию и глобальным связям в туристической индустрии.', en: 'World Travel and Tourism Society - demonstrating our commitment to professional development and global connections in the tourism industry.' },
    'about.team_title': { ru: 'НАША КОМАНДА', en: 'OUR TEAM' },
    'about.team_1_name': { ru: 'МИРАЛИЕВА СИТОРАМО', en: 'MIRALIEVA SITORAMO' },
    'about.team_1_role': { ru: 'Генеральный директор', en: 'General Director' },
    'about.team_1_desc': { ru: 'Основатель и генеральный директор Bunyod-Tour LLC с 2017 года. Более 15 лет опыта в туризме, торговле и продажах.', en: 'Founder and General Director of Bunyod-Tour LLC since 2017. Over 15 years of experience in tourism, trade, and sales.' },
    'about.team_2_name': { ru: 'КИЁМИДДИН МИРАЛИЁН', en: 'QIYOMIDDIN MIRALIYON' },
    'about.team_2_role': { ru: 'Советник по управлению', en: 'Management Advisor' },
    'about.team_2_desc': { ru: 'Основатель Bunyod-Tour LLC. Более 20 лет опыта в управлении туризмом, международных отношениях и разработке политики.', en: 'Founder of Bunyod-Tour LLC. Over 20 years of experience in tourism management, international relations, and policy development.' },
    'about.team_3_name': { ru: 'МИРАЛИЁН ХИКМАТУЛЛО', en: 'MIRALIYON HIKMATULLO' },
    'about.team_3_role': { ru: 'Исполнительный директор', en: 'Executive Director' },
    'about.team_3_desc': { ru: 'Высшее профессиональное образование в области экономики, опыт работы в туризме, логистике и налогообложении более пяти лет.', en: 'Higher professional education in economics, with experience in tourism, logistics, and taxation for more than five years.' },
    'about.team_4_name': { ru: 'ОЯТУЛЛО МИРАЛИЁН', en: 'OYATULLO MIRALIYON' },
    'about.team_4_role': { ru: 'Менеджер по международным связям', en: 'Manager for International Relationships' },
    'about.team_4_desc': { ru: 'Высшее профессиональное образование в области дипломатии, опыт работы в туризме, маркетинге более шести лет.', en: 'Higher professional education in diplomacy, with experience in tourism, marketing, and analog for more than six years.' },
    'about.team_5_name': { ru: 'КУРБОНОВ СУХРОБ', en: 'QURBONOV SUHROB' },
    'about.team_5_role': { ru: 'Технический менеджер', en: 'Technic Manager' },
    'about.team_5_desc': { ru: 'Экономист с высшим профессиональным образованием. Опыт работы в туризме, логистике и налогообложении более 12 лет.', en: 'Economist with a degree in higher professional education. Experience in tourism, logistics, and taxation for more than 12 years.' },
    'about.team_6_name': { ru: 'РУЗИБОЕВ ХУРШЕД', en: 'RUZIBOEV KHURSHED' },
    'about.team_6_role': { ru: 'IT-менеджер', en: 'IT Manager' },
    'about.team_6_desc': { ru: 'Высшее профессиональное образование, техник-технолог. Более 5 лет опыта в информационных технологиях и гостиничных услугах.', en: 'Higher education professional and technician-technologist. Over 5 years of experience in information technology and hotel services.' },
    'about.stat_years': { ru: 'Лет опыта', en: 'Years of Experience' },
    'about.stat_programs': { ru: 'Туристических программ', en: 'Travel Programs' },
    'about.stat_partners': { ru: 'Компаний-партнёров', en: 'Partner Companies' },
    'about.stat_countries': { ru: 'Стран покрытия', en: 'Countries Covered' },
    
    // === TOURS PAGE KEYS ===
    'tours.modal.description_loading': { ru: 'Описание тура будет загружено...', en: 'Tour description will be loaded...' },
    'tours.modal.features_title': { ru: 'Особенности тура:', en: 'Tour Features:' },
    'tours.modal.feature_loading': { ru: 'Особенность будет загружена', en: 'Feature will be loaded' },
    'tours.modal.guide_meeting': { ru: 'Встреча с гидом', en: 'Meeting with guide' },
    
    // === HOTELS PAGE KEYS ===  
    'hotel.loading_error_title': { ru: 'Ошибка загрузки', en: 'Loading Error' },
    'hotel.failed_to_load_text': { ru: 'Не удалось загрузить список отелей', en: 'Failed to load hotel list' },
    
    // === HOTEL AMENITIES KEYS ===
    'hotel.amenities_title': { ru: 'Удобства отеля', en: 'Hotel Amenities' },
    'hotel.description_title': { ru: 'Описание отеля', en: 'Hotel Description' },
    'hotel.pension_label': { ru: 'Питание', en: 'Meals' },
    'hotel.category_label': { ru: 'Категория', en: 'Category' },
    'amenity.WiFi': { ru: 'WiFi', en: 'WiFi' },
    'amenity.Завтрак': { ru: 'Завтрак', en: 'Breakfast' },
    'amenity.Парковка': { ru: 'Парковка', en: 'Parking' },
    'amenity.Ресторан': { ru: 'Ресторан', en: 'Restaurant' },
    'amenity.Бассейн': { ru: 'Бассейн', en: 'Pool' },
    'amenity.Спа': { ru: 'Спа', en: 'Spa' },
    'amenity.Фитнес-центр': { ru: 'Фитнес-центр', en: 'Fitness Center' },
    'amenity.Кондиционер': { ru: 'Кондиционер', en: 'Air Conditioning' },
    'amenity.Мини-бар': { ru: 'Мини-бар', en: 'Mini-bar' },
    'amenity.Трансфер': { ru: 'Трансфер', en: 'Transfer' },
    
    // === GUIDES PAGE KEYS ===
    'guides.form.name_label': { ru: 'Ваше имя *', en: 'Your Name *' },
    'guides.form.phone_label': { ru: 'Телефон', en: 'Phone' },
    'guides.form.comments_label': { ru: 'Комментарии', en: 'Comments' },
    
    // === BOOKING PAGE KEYS ===
    'booking.page_title': { ru: 'Бронирование тура - Bunyod-Tour', en: 'Tour Booking - Bunyod-Tour' },
    'booking.step1.title': { ru: 'Выбор отеля', en: 'Hotel Selection' },
    'booking.step2.title': { ru: 'Данные туриста', en: 'Tourist Information' },
    'booking.step3.title': { ru: 'Оплата', en: 'Payment' },
    'booking.choose_hotel': { ru: 'Выберите отель', en: 'Choose Hotel' },
    'booking.loading_hotels': { ru: 'Загрузка отелей...', en: 'Loading hotels...' },
    'booking.tour_details': { ru: 'Детали тура', en: 'Tour Details' },
    'booking.tour_date': { ru: 'Дата тура:', en: 'Tour Date:' },
    'booking.duration': { ru: 'Длительность:', en: 'Duration:' },
    'booking.days': { ru: 'дн.', en: 'days' },
    'booking.tourists_count': { ru: 'Количество туристов:', en: 'Number of Tourists:' },
    'booking.tour_type': { ru: 'Тип тура:', en: 'Tour Type:' },
    'booking.selected_hotel': { ru: 'Выбранный отель', en: 'Selected Hotel' },
    'booking.rooms_and_meals': { ru: 'Номера и питание', en: 'Rooms and Meals' },
    'booking.price_calculation': { ru: 'Расчёт стоимости', en: 'Price Calculation' },
    'booking.accommodation_deduction': { ru: 'Вычет проживания за счет базовой опции', en: 'Accommodation Deduction (Base Option)' },
    'booking.tour_price': { ru: 'Цена тура', en: 'Tour Price' },
    'booking.per_group': { ru: 'за группу', en: 'per group' },
    'booking.total_amount': { ru: 'Итоговая сумма:', en: 'Total Amount:' },
    'booking.support_service': { ru: 'Служба поддержки', en: 'Support Service' },
    'booking.amenities': { ru: 'Удобства:', en: 'Amenities:' },
    'booking.room_categories': { ru: 'Категории номеров:', en: 'Room Categories:' },
    'booking.meal_types': { ru: 'Типы питания:', en: 'Meal Types:' },
    'booking.select_this_hotel': { ru: 'Выбрать этот отель', en: 'Select this hotel' },
    'booking.stars': { ru: 'звезд', en: 'stars' },
    'booking.no_address': { ru: 'Адрес не указан', en: 'No address' },
    
    // Room types translations
    'room.Одноместный': { ru: 'Одноместный', en: 'Single' },
    'room.Двухместный': { ru: 'Двухместный', en: 'Twin/Double' },
    'room.Двухместный с двумя кроватями': { ru: 'Двухместный с двумя кроватями', en: 'Twin' },
    'room.Трехместный': { ru: 'Трехместный', en: 'Triple' },
    'room.Люкс': { ru: 'Люкс', en: 'Suite' },
    'room.Семейный': { ru: 'Семейный', en: 'Family' },
    
    // Meal types translations  
    'meal.Завтрак': { ru: 'Завтрак', en: 'Breakfast' },
    'meal.Полупансион': { ru: 'Полупансион', en: 'Half-board' },
    'meal.Полный пансион': { ru: 'Полный пансион', en: 'Full-board' },
    'meal.Все включено': { ru: 'Все включено', en: 'All-inclusive' },
    'meal.Без питания': { ru: 'Без питания', en: 'No meals' },
    'booking.no_rooms_selected': { ru: 'Номера не выбраны', en: 'No rooms selected' },
    'booking.meal': { ru: 'Питание', en: 'Meal' },
    'booking.per_day': { ru: 'сутки', en: 'day' },
    'booking.per_day_short': { ru: '/сутки', en: '/day' },
    'booking.no_hotels_found': { ru: 'Отелей для этого тура не найдено', en: 'No hotels found for this tour' },
    'booking.hotels_loading_error': { ru: 'Ошибка загрузки отелей', en: 'Error loading hotels' },
    
    // === BOOKING ERROR MESSAGES ===
    'booking.error.missing_data': { ru: 'Недостаточно данных для бронирования', en: 'Insufficient booking data' },
    'booking.error.start_booking': { ru: 'Ошибка при начале бронирования', en: 'Error starting booking' },
    'booking.error.load_hotels': { ru: 'Ошибка загрузки отелей', en: 'Error loading hotels' },
    'booking.error.load_hotels_failed': { ru: 'Не удалось загрузить отели. Попробуйте обновить страницу.', en: 'Failed to load hotels. Please refresh the page.' },
    'booking.error.select_room': { ru: 'Пожалуйста, выберите хотя бы один номер', en: 'Please select at least one room' },
    'booking.error.select_hotel': { ru: 'Пожалуйста, выберите отель', en: 'Please select a hotel' },
    'booking.error.select_room_category': { ru: 'Пожалуйста, выберите хотя бы одну категорию номера', en: 'Please select at least one room category' },
    'booking.error.save_draft': { ru: 'Ошибка сохранения выбора', en: 'Error saving selection' },
    'booking.tour_type.group': { ru: 'Групповой', en: 'Group' },
    'booking.tour_type.personal': { ru: 'Персональный', en: 'Private' },
    
    // Units of measurement
    'booking.person': { ru: 'чел.', en: 'person' },
    'booking.person_short': { ru: 'чел.', en: 'pax' },
    'booking.day': { ru: 'дн.', en: 'day' },
    'booking.days_short': { ru: 'дн.', en: 'days' },
    'booking.nights_short': { ru: 'ноч.', en: 'nights' },
    
    // Capacity text
    'booking.total_capacity': { ru: 'Общая вместимость:', en: 'Total capacity:' },
    'booking.required': { ru: 'требуется:', en: 'required:' },
    'booking.capacity': { ru: 'Вместимость:', en: 'Capacity:' },
    'booking.sufficient': { ru: 'достаточно', en: 'sufficient' },
    'booking.insufficient_for': { ru: 'недостаточно для', en: 'insufficient for' },
    
    // Price calculation labels
    'booking.rooms': { ru: 'Номера', en: 'Room' },
    'booking.meals': { ru: 'Питание', en: 'Meal' },
    
    // Support service
    'booking.working_hours': { ru: 'Пн-Пт: 9:00-18:00', en: 'Mon-Fri: 9:00-18:00' },
    
    // Step 2 - Tourist Information
    'booking.step2.contact_person': { ru: 'Контактное лицо', en: 'Contact Person' },
    'booking.step2.full_name': { ru: 'Полное имя контактного лица', en: 'Full Name of Contact Person' },
    'booking.step2.phone': { ru: 'Телефон', en: 'Phone' },
    'booking.step2.email': { ru: 'Email', en: 'Email' },
    'booking.step2.list_of_tourists': { ru: 'Список туристов', en: 'List of Tourists' },
    'booking.step2.add_tourist': { ru: 'Добавить туриста', en: 'Add Tourist' },
    'booking.step2.tourist': { ru: 'Турист', en: 'Tourist' },
    'booking.step2.tourist_fullname': { ru: 'ФИО туриста', en: 'Full Name' },
    'booking.step2.date_of_birth': { ru: 'Дата рождения', en: 'Date of Birth' },
    'booking.step2.special_requests': { ru: 'Особые требования', en: 'Special Requests' },
    'booking.step2.additional_requests': { ru: 'Дополнительные пожелания', en: 'Additional Requests' },
    'booking.step2.placeholder_requests': { ru: 'Укажите любые особые пожелания или требования...', en: 'Specify any special requests or requirements...' },
    'booking.tour_name': { ru: 'Название тура', en: 'Tour Name' },
    'booking.date': { ru: 'Дата:', en: 'Date:' },
    'booking.duration_label': { ru: 'Продолжительность:', en: 'Duration:' },
    'booking.tourists': { ru: 'Туристов:', en: 'Tourists:' },
    'booking.hotel': { ru: 'Отель', en: 'Hotel' },
    
    // Step 3 - Voucher/Ticket
    'booking.confirmed': { ru: 'ПОДТВЕРЖДЕН', en: 'CONFIRMED' },
    'booking.voucher.tagline': { ru: 'Ваш надёжный спутник в мире путешествий по Центральной Азии', en: 'Your reliable travel companion in Central Asia' },
    'booking.voucher.contact_person': { ru: 'Контактное лицо:', en: 'Contact Person:' },
    'booking.voucher.participants': { ru: 'Участники тура:', en: 'Tour Participants:' },
    'booking.voucher.adults': { ru: 'взрослый(ых)', en: 'adult(s)' },
    'booking.voucher.children': { ru: 'детей', en: 'child(ren)' },
    'booking.voucher.participants_count': { ru: 'участников', en: 'participants' },
    'booking.voucher.participant_singular': { ru: 'участник', en: 'participant' },
    'booking.voucher.tour_language': { ru: 'Язык тура:', en: 'Tour Language:' },
    'booking.voucher.included': { ru: 'Включено:', en: 'Included:' },
    'booking.voucher.client_phone': { ru: 'Номер телефона клиента:', en: 'Client Phone:' },
    'booking.voucher.pickup_location': { ru: 'Место сбора:', en: 'Pickup Location:' },
    'booking.voucher.booking_source': { ru: 'Источник бронирования:', en: 'Booking Source:' },
    'booking.voucher.product_code': { ru: 'Код продукта:', en: 'Product Code:' },
    'booking.voucher.tour_guide': { ru: 'Гид тура:', en: 'Tour Guide:' },
    'booking.voucher.assigned_at_start': { ru: 'Назначается при начале тура', en: 'Assigned at tour start' },
    'booking.voucher.special_requests': { ru: 'Особые требования:', en: 'Special Requests:' },
    'booking.voucher.confirmed_at': { ru: 'Подтверждено', en: 'Confirmed at' },
    'booking.voucher.personal': { ru: 'Персональный', en: 'Private' },
    'booking.voucher.group': { ru: 'Групповой', en: 'Group' },
    'booking.voucher.days': { ru: 'дней', en: 'days' },
    'booking.voucher.day': { ru: 'день', en: 'day' },
    'booking.voucher.hours': { ru: 'часов', en: 'hours' },
    'booking.voucher.hour': { ru: 'час', en: 'hour' },
    'booking.accommodation': { ru: 'Проживание в отеле', en: 'Hotel Accommodation' },
    'booking.accommodation_details': { ru: 'Детали проживания', en: 'Accommodation Details' },
    'booking.category': { ru: 'Категория', en: 'Category' },
    
    // B2B Travel Agents Section
    'nav.travel_agents': { ru: 'Турагентам', en: 'For Travel Agents' },
    
    // Travel Agent Application Page
    'agent.apply_title': { ru: 'Партнерство - Bunyod-Tour', en: 'Partnership - Bunyod-Tour' },
    'agent.hero_title': { ru: 'Станьте нашим партнером', en: 'Become Our Partner' },
    'agent.hero_subtitle': { ru: 'Присоединяйтесь к ведущей туристической платформе Центральной Азии', en: 'Join the Leading Tourism Platform in Central Asia' },
    'agent.benefit1_title': { ru: 'Выгодные комиссии', en: 'Attractive Commissions' },
    'agent.benefit1_desc': { ru: 'Получайте до 15% комиссии с каждого тура', en: 'Earn up to 15% commission on every tour' },
    'agent.benefit2_title': { ru: 'Широкая география', en: 'Wide Geography' },
    'agent.benefit2_desc': { ru: '5 стран Центральной Азии, сотни туров', en: '5 Central Asian countries, hundreds of tours' },
    'agent.benefit3_title': { ru: 'Личный кабинет', en: 'Personal Dashboard' },
    'agent.benefit3_desc': { ru: 'Удобное управление заявками и отчетность', en: 'Convenient request management and reporting' },
    'agent.benefit4_title': { ru: 'Поддержка 24/7', en: '24/7 Support' },
    'agent.benefit4_desc': { ru: 'Всегда на связи для решения ваших вопросов', en: 'Always available to help with your questions' },
    'agent.form_title': { ru: 'Заявка на партнерство', en: 'Partnership Application' },
    'agent.success_message': { ru: '✓ Заявка успешно отправлена! Мы свяжемся с вами в ближайшее время.', en: '✓ Application submitted successfully! We will contact you soon.' },
    'agent.error_message': { ru: 'Ошибка при отправке заявки. Пожалуйста, попробуйте еще раз.', en: 'Error submitting application. Please try again.' },
    'agent.full_name': { ru: 'ФИО', en: 'Full Name' },
    'agent.full_name_placeholder': { ru: 'Иванов Иван Иванович', en: 'John Smith' },
    'agent.citizenship': { ru: 'Гражданство', en: 'Citizenship' },
    'agent.citizenship_placeholder': { ru: 'Российская Федерация', en: 'Russian Federation' },
    'agent.company_name': { ru: 'Название компании', en: 'Company Name' },
    'agent.company_placeholder': { ru: 'ООО Туристическое агентство', en: 'Travel Agency LLC' },
    'agent.email': { ru: 'Email', en: 'Email' },
    'agent.phone': { ru: 'Телефон', en: 'Phone' },
    'agent.address': { ru: 'Адрес офиса', en: 'Office Address' },
    'agent.address_placeholder': { ru: 'г. Душанбе, ул. Рудаки 123', en: 'Dushanbe, Rudaki St. 123' },
    'agent.website': { ru: 'Сайт компании', en: 'Company Website' },
    'agent.experience': { ru: 'Опыт работы в туризме', en: 'Tourism Experience' },
    'agent.experience_placeholder': { ru: 'Расскажите о вашем опыте работы в туризме', en: 'Tell us about your tourism experience' },
    'agent.documents': { ru: 'Документы (лицензия, регистрация)', en: 'Documents (license, registration)' },
    'agent.documents_individual': { ru: 'Документы (Паспорт, свидетельство, диплом и т.д)', en: 'Documents (Passport, certificate, diploma, etc.)' },
    'agent.residence_address': { ru: 'Адрес проживания', en: 'Residence Address' },
    'agent.documents_hint': { ru: 'Форматы: PDF, JPG, PNG. Максимум 5 файлов', en: 'Formats: PDF, JPG, PNG. Maximum 5 files' },
    'agent.agree_text': { ru: 'Я соглашаюсь с условиями партнерского соглашения и политикой конфиденциальности', en: 'I agree to the partnership terms and privacy policy' },
    'agent.agree_prefix': { ru: 'Я соглашаюсь с условиями', en: 'I agree to the terms of the' },
    'agent.agency_agreement_link': { ru: 'партнерского соглашения', en: 'Agency Agreement' },
    'agent.agree_and': { ru: 'и', en: 'and' },
    'agent.tour_program_link': { ru: 'программой Тур-агента', en: 'Tour Agent Program' },
    'agent.program_title_link': { ru: 'Программа Тур-агента', en: 'Tour Agent Program' },
    'agent.program_section_title': { ru: 'Программа Тур-агента', en: 'Tour Agent Program' },
    'agent.program_section_desc': { ru: 'Ознакомьтесь с подробной информацией о партнёрской программе, условиях сотрудничества и вознаграждениях', en: 'Learn about the partnership program details, cooperation terms and rewards' },
    'agent.download_program': { ru: 'Скачать программу (PDF)', en: 'Download Program (PDF)' },
    'agent.submit_button': { ru: 'Отправить заявку', en: 'Submit Application' },
    'agent.sending': { ru: 'Отправка...', en: 'Sending...' },
    'agent.already_partner': { ru: 'Уже партнер?', en: 'Already a partner?' },
    'agent.login_link': { ru: 'Войти в кабинет', en: 'Login to Dashboard' },
    
    // Who can become partner section
    'agent.who_can_title': { ru: 'Кто может стать нашим партнером', en: 'Who Can Become Our Partner' },
    'agent.partner_type1': { ru: 'Обозреватели путешествий', en: 'Travel reviewers' },
    'agent.partner_type2': { ru: 'Тревел блогеры', en: 'Travel bloggers' },
    'agent.partner_type3': { ru: 'Тур.агентства в Центральной Азии', en: 'Travel agencies in Central Asia' },
    'agent.partner_type4': { ru: 'Владельцы туристических сайтов, форумов', en: 'Owners of tourism websites and forums' },
    'agent.partner_type5': { ru: 'Владельцы интернет магазинов с товарами для спорта, туризма', en: 'Owners of online stores with sports and tourism goods' },
    'agent.partner_type6': { ru: 'Турагентства', en: 'Travel agencies' },
    'agent.partner_type7': { ru: 'Владельцы отелей', en: 'Hotel owners' },
    'agent.partner_type8': { ru: 'Студенты и фрилансеры', en: 'Students and freelancers' },
    'agent.partner_conclusion': { ru: 'Заработать на партнерках в туризме можно практически всем', en: 'Almost anyone can earn from tourism partnerships' },
    'agent.partnership_info_short': { 
        ru: 'Наши партнёры делятся на две группы: стратегические партнёры и туристические партнёры. Со стратегическими партнёрами мы работаем по традиционному принципу, но с туристическими партнёрами, также известными как турагентства, мы работаем преимущественно через онлайн-платформы, в частности, через наш веб-сайт.', 
        en: 'Our partners are divided into two groups: strategic partners and travel partners. We collaborate with strategic partners in a conventional manner, but we primarily engage with travel partners, also referred to as travel agencies, via online platforms, particularly our website.' 
    },
    'agent.partnership_info_full': { 
        ru: ' Наше предложение будущим тур-партнерам (турагентам) это вознаграждение (комиссия) в размере 10% от стоимости реализованных (проданных) турпакетов, которые размещены (опубликованы) на нашем веб-сайте по адресу', 
        en: ' We offer a commission of 10% of the cost of sold tour packages posted on our website at' 
    },
    'agent.partnership_info_full2': { 
        ru: '. Обратите внимание, что у нас нет строгих ограничений по выбору турагентов — нашим тур-партнером (турагентом) может стать любое физическое или юридическое лицо, отвечающее основным критериям и требованиям турагента и проживающее или осуществляющее деятельность на территории стран Центральной Азии.', 
        en: ' to travel agents interested in becoming our travel partners. Please note that we do not have strict restrictions on the selection of travel agents. Any individual or legal entity that meets the basic criteria and requirements of a travel agent and resides or operates in the countries of Central Asia can become our travel partner.' 
    },
    'agent.show_more': { ru: 'Показать полностью', en: 'Show More' },
    'agent.show_less': { ru: 'Скрыть', en: 'Show Less' },
    'agent.select_partner_type': { ru: 'Выберите тип партнёра', en: 'Select Partner Type' },
    'agent.individual': { ru: 'Физическое лицо', en: 'Individual' },
    'agent.legal_entity': { ru: 'Юридическое лицо', en: 'Legal Entity' },
    
    // Agent Login Page
    'agent.login_title': { ru: 'Вход для турагентов - Bunyod-Tour', en: 'Agent Login - Bunyod-Tour' },
    'agent.login_hero_title': { ru: 'Вход для турагентов', en: 'Travel Agent Login' },
    'agent.login_hero_subtitle': { ru: 'Войдите в личный кабинет турагента B2B', en: 'Login to your B2B travel agent dashboard' },
    'agent.login_form_title': { ru: 'Вход в систему', en: 'Login' },
    'agent.password': { ru: 'Пароль', en: 'Password' },
    'agent.login_button': { ru: 'Войти', en: 'Login' },
    'agent.logging_in': { ru: 'Вход...', en: 'Logging in...' },
    'agent.no_account': { ru: 'Нет аккаунта?', en: "Don't have an account?" },
    'agent.apply_link': { ru: 'Подать заявку на партнерство', en: 'Apply for partnership' },
    
    // Agent Dashboard
    'agent.dashboard_title': { ru: 'Личный кабинет турагента - Bunyod-Tour', en: 'Travel Agent Dashboard - Bunyod-Tour' },
    'agent.dashboard_header': { ru: 'Личный кабинет турагента', en: 'Travel Agent Dashboard' },
    'agent.logout': { ru: 'Выход', en: 'Logout' },
    'agent.password_change_alert': { ru: 'Необходимо сменить пароль перед началом работы.', en: 'You must change your password before continuing.' },
    'agent.tab_booking': { ru: 'Заявка на тур', en: 'Tour Request' },
    'agent.tab_history': { ru: 'История заявок', en: 'Request History' },
    'agent.tab_password': { ru: 'Смена пароля', en: 'Change Password' },
    'agent.booking_form_title': { ru: 'Заявка на бронирование тура', en: 'Tour Booking Request' },
    'agent.tour_id': { ru: 'ID тура', en: 'Tour ID' },
    'agent.voucher_id_label': { ru: 'ID Ваучера клиента', en: 'Client Voucher ID' },
    'agent.voucher_id_placeholder': { ru: 'Например: BT-52026', en: 'E.g.: BT-52026' },
    'agent.voucher_id_help': { ru: 'Введите код ваучера из письма клиента (формат: BT-XXXXXX). Нажмите «Проверить» — система автоматически найдёт тур и дату.', en: 'Enter the voucher code from the client\'s confirmation email (format: BT-XXXXXX). Click "Verify" and the system will find the tour and date automatically.' },
    'agent.verify_voucher': { ru: 'Проверить', en: 'Verify' },
    'agent.voucher_checking': { ru: 'Проверяем ваучер...', en: 'Verifying voucher...' },
    'agent.voucher_found': { ru: 'Ваучер найден', en: 'Voucher found' },
    'agent.voucher_not_found': { ru: 'Ваучер не найден. Проверьте код из письма клиента', en: 'Voucher not found. Please check the code from the client\'s email' },
    'agent.voucher_lookup_error': { ru: 'Ошибка при проверке ваучера', en: 'Error verifying voucher' },
    'agent.voucher_enter_first': { ru: 'Сначала введите код ваучера', en: 'Please enter the voucher code first' },
    'agent.voucher_required': { ru: 'Укажите ID Ваучера из письма клиента', en: 'Please enter the Voucher ID from the client\'s email' },
    'agent.tourists_count_label': { ru: 'туристов', en: 'tourists' },
    'agent.tour_date': { ru: 'Дата начала тура', en: 'Tour Start Date' },
    'agent.number_of_tourists': { ru: 'Количество туристов', en: 'Number of Tourists' },
    'agent.client_name': { ru: 'Имя клиента', en: 'Client Name' },
    'agent.client_email': { ru: 'Email клиента', en: 'Client Email' },
    'agent.client_phone': { ru: 'Телефон клиента', en: 'Client Phone' },
    'agent.special_requests': { ru: 'Особые пожелания', en: 'Special Requests' },
    'agent.submit_booking': { ru: 'Отправить заявку', en: 'Submit Request' },
    'agent.history_title': { ru: 'История ваших заявок', en: 'Your Request History' },
    'agent.password_change_title': { ru: 'Смена пароля', en: 'Change Password' },
    'agent.current_password': { ru: 'Текущий пароль', en: 'Current Password' },
    'agent.new_password': { ru: 'Новый пароль', en: 'New Password' },
    'agent.confirm_password': { ru: 'Подтвердите новый пароль', en: 'Confirm New Password' },
    'agent.change_password_button': { ru: 'Сменить пароль', en: 'Change Password' },

    // Agent Dashboard — dynamic strings
    'agent.password_alert_title': { ru: 'Внимание!', en: 'Attention!' },
    'agent.partnership_status': { ru: 'Статус партнерства', en: 'Partnership Status' },
    'agent.account_status': { ru: 'Статус аккаунта:', en: 'Account status:' },
    'agent.partner_since': { ru: 'Партнер с:', en: 'Partner since:' },
    'agent.status_active': { ru: 'Активный', en: 'Active' },
    'agent.status_suspended': { ru: 'Приостановлен', en: 'Suspended' },
    'agent.col_booking_id': { ru: 'ID заявки', en: 'Request ID' },
    'agent.col_tour': { ru: 'Тур', en: 'Tour' },
    'agent.col_tour_date': { ru: 'Дата тура', en: 'Tour Date' },
    'agent.col_tourists': { ru: 'Туристов', en: 'Tourists' },
    'agent.col_status': { ru: 'Статус', en: 'Status' },
    'agent.col_created': { ru: 'Дата заявки', en: 'Request Date' },
    'agent.loading': { ru: 'Загрузка...', en: 'Loading...' },
    'agent.no_bookings': { ru: 'Заявок пока нет', en: 'No requests yet' },
    'agent.load_error': { ru: 'Ошибка загрузки', en: 'Loading error' },
    'agent.booking_success_prefix': { ru: 'Заявка успешно отправлена! ID заявки:', en: 'Request submitted successfully! Request ID:' },
    'agent.booking_error': { ru: 'Ошибка при отправке заявки', en: 'Error submitting request' },
    'agent.password_changed': { ru: 'Пароль успешно изменен!', en: 'Password changed successfully!' },
    'agent.passwords_mismatch': { ru: 'Новые пароли не совпадают', en: 'Passwords do not match' },
    'agent.password_too_short': { ru: 'Пароль должен содержать минимум 8 символов', en: 'Password must be at least 8 characters' },
    'agent.saving': { ru: 'Сохранение...', en: 'Saving...' },
    'agent.submitting': { ru: 'Отправка...', en: 'Submitting...' },
    'agent.password_change_required': { ru: 'Необходимо сменить пароль', en: 'Password change required' },
    'agent.fill_all_fields': { ru: 'Пожалуйста, заполните все поля', en: 'Please fill in all fields' },
    'agent.login_error_general': { ru: 'Произошла ошибка при входе. Попробуйте позже.', en: 'A login error occurred. Please try again later.' },
    'agent.invalid_credentials': { ru: 'Неверный email или пароль', en: 'Invalid email or password' },
    'agent.enter_phone': { ru: 'Пожалуйста, введите номер телефона клиента', en: 'Please enter client phone number' },
    'agent.blocked_account': { ru: 'Ваш аккаунт заблокирован. Обратитесь к администратору.', en: 'Your account is blocked. Contact the administrator.' },
    'agent.status_pending': { ru: 'Ожидает', en: 'Pending' },
    'agent.status_confirmed': { ru: 'Подтверждено', en: 'Confirmed' },
    'agent.status_completed': { ru: 'Завершено', en: 'Completed' },
    'agent.status_cancelled': { ru: 'Отменено', en: 'Cancelled' },
    'agent.col_voucher': { ru: 'Ваучер', en: 'Voucher' },
    'agent.tour_id_placeholder': { ru: 'Введите ID тура из каталога', en: 'Enter tour ID from catalog' },
    'agent.voucher_note_title': { ru: 'Примечание:', en: 'Note:' },
    'agent.voucher_note_intro': { ru: 'заметьте здесь три источника, где можно будет получить ID Ваучера, забронированного тура:', en: 'There are three sources where you can obtain the Voucher ID for a booked tour:' },
    'agent.voucher_note_1': { ru: 'Вы как турагент забронируете тур для вашего туриста указав свою эл.почту — Ваучер придет на вашу эл.почту.', en: 'You, as a travel agent, book a tour for your tourist by providing your email address — the Voucher will be sent to your email address.' },
    'agent.voucher_note_2': { ru: 'Турист самостоятельно но при вашей помощи забронирует тур указав свой эл.почту — Ваучер придет на эл.почту туриста.', en: 'The tourist, with your assistance, books a tour independently by providing their email address — the Voucher will be sent to the tourist\'s email address.' },
    'agent.voucher_note_3': { ru: 'Вы представляете специальный заказ туроператору — в этом случае ID Ваучера это номер договора, который вы заключите с туристом.', en: 'You submit a special order to the tour operator — in this case, the Voucher ID is the contract number you entered into with the tourist.' },
    'agent.special_requests_placeholder': { ru: 'Укажите любые особые требования или пожелания', en: 'Enter any special requirements or requests' },
    'agent.min_8_chars': { ru: 'Минимум 8 символов', en: 'Minimum 8 characters' },
    
    // Vehicles / Transport Section
    'nav.vehicles': { ru: 'Транспорт', en: 'Transport' },
    'vehicles.page_title': { ru: 'Каталог транспорта - Bunyod-Tour', en: 'Vehicle Catalog - Bunyod-Tour' },
    'vehicles.catalog_title': { ru: 'Каталог транспорта', en: 'Vehicle Catalog' },
    'vehicles.catalog_subtitle': { ru: 'Выберите подходящий транспорт для вашего путешествия', en: 'Choose the perfect transport for your journey' },
    'vehicles.filters_title': { ru: 'Фильтры', en: 'Filters' },
    'vehicles.type': { ru: 'Тип транспорта', en: 'Vehicle Type' },
    'vehicles.all_types': { ru: 'Все типы', en: 'All Types' },
    'vehicles.type_sedan': { ru: 'Седан', en: 'Sedan' },
    'vehicles.type_suv': { ru: 'Внедорожник', en: 'SUV' },
    'vehicles.type_minibus': { ru: 'Микроавтобус', en: 'Minibus' },
    'vehicles.type_bus': { ru: 'Автобус', en: 'Bus' },
    'vehicles.type_minivan': { ru: 'Минивэн', en: 'Minivan' },
    'vehicles.type_luxury': { ru: 'Люкс', en: 'Luxury' },
    'vehicles.capacity': { ru: 'Вместимость', en: 'Capacity' },
    'vehicles.passengers': { ru: 'пассажиров', en: 'passengers' },
    'vehicles.price_per_day': { ru: 'Цена за день', en: 'Price per Day' },
    'vehicles.license_plate': { ru: 'Номер машины', en: 'License Plate' },
    'vehicles.brand': { ru: 'Марка', en: 'Brand' },
    'vehicles.year': { ru: 'Год выпуска', en: 'Year' },
    'vehicles.country': { ru: 'Страна', en: 'Country' },
    'vehicles.city': { ru: 'Город', en: 'City' },
    'vehicles.description': { ru: 'Описание', en: 'Description' },
    'vehicles.book_now': { ru: 'Забронировать', en: 'Book Now' },
    'vehicles.contact': { ru: 'Связаться', en: 'Contact' },
    'vehicles.no_vehicles': { ru: 'Транспорт не найден', en: 'No vehicles found' },
    'vehicles.loading': { ru: 'Загрузка транспорта...', en: 'Loading vehicles...' },
    'vehicles.min_price': { ru: 'Минимальная цена', en: 'Min Price' },
    'vehicles.max_price': { ru: 'Максимальная цена', en: 'Max Price' },
    'vehicles.filter_capacity': { ru: 'Фильтр по вместимости', en: 'Filter by Capacity' },
    'vehicles.clear_filters': { ru: 'Очистить фильтры', en: 'Clear Filters' },
    'vehicles.results_count': { ru: 'Найдено', en: 'Found' },
    'vehicles.vehicle': { ru: 'транспорт', en: 'vehicle' },
    'vehicles.vehicles': { ru: 'транспорта', en: 'vehicles' },
    'vehicles.all_countries': { ru: 'Все страны', en: 'All Countries' },
    'vehicles.city': { ru: 'Город', en: 'City' },
    'vehicles.all_cities': { ru: 'Все города', en: 'All Cities' },
    'vehicles.capacity_any': { ru: 'Любая', en: 'Any' },
    'vehicles.capacity_1_4': { ru: '1-4 пассажира', en: '1-4 passengers' },
    'vehicles.capacity_5_8': { ru: '5-8 пассажиров', en: '5-8 passengers' },
    'vehicles.capacity_9_15': { ru: '9-15 пассажиров', en: '9-15 passengers' },
    'vehicles.capacity_16_plus': { ru: '16+ пассажиров', en: '16+ passengers' },
    'vehicles.search_placeholder': { ru: 'Марка, номер...', en: 'Brand, plate number...' },
    'vehicles.try_change_filters': { ru: 'Попробуйте изменить фильтры поиска', en: 'Try changing search filters' },
    'vehicles.found_template': { ru: 'Найдено {count} из {total} транспорта', en: 'Found {count} of {total} vehicles' },
    
    // Transfer page - vehicle catalog info
    'transfer.catalog_info_title': { ru: 'Ознакомьтесь с нашим автопарком', en: 'Browse Our Vehicle Fleet' },
    'transfer.catalog_info_text': { ru: 'Хотите узнать больше о нашем транспорте? Посмотрите полный каталог с фотографиями, описаниями и ценами всех доступных автомобилей.', en: 'Want to learn more about our vehicles? Check out our complete catalog with photos, descriptions, and prices of all available vehicles.' },
    'transfer.view_catalog_btn': { ru: 'Смотреть каталог транспорта', en: 'View Vehicle Catalog' },

    'payment.success_page_title': { ru: 'Оплата прошла успешно - Bunyod-Tour', en: 'Payment Successful - Bunyod-Tour' },
    'payment.success_title': { ru: 'Оплата прошла успешно!', en: 'Payment Successful!' },
    'payment.booking_confirmed': { ru: 'Ваше бронирование подтверждено. На указанный email отправлено подтверждение с деталями заказа.', en: 'Your booking is confirmed. A confirmation with order details has been sent to your email.' },
    'payment.order_number': { ru: 'Номер заказа:', en: 'Order number:' },
    'payment.amount': { ru: 'Сумма:', en: 'Amount:' },
    'payment.payment_method': { ru: 'Способ оплаты:', en: 'Payment method:' },
    'payment.download_receipt': { ru: 'Скачать чек', en: 'Download receipt' },
    'payment.return_home': { ru: 'Вернуться на главную', en: 'Return to home' },
    'payment.to_home': { ru: 'На главную', en: 'Home' },
    'payment.email_sent': { ru: 'Детали бронирования отправлены на ваш email', en: 'Booking details have been sent to your email' },
    'payment.questions_call': { ru: 'Вопросы? Звоните:', en: 'Questions? Call:' },
    'payment.loading': { ru: 'Загрузка данных заказа...', en: 'Loading order details...' },
    'payment.verified': { ru: 'Платёж подтверждён!', en: 'Payment confirmed!' },
    'payment.failed_title': { ru: 'Платёж не прошёл', en: 'Payment Failed' },
    'payment.failed_text': { ru: 'К сожалению, ваш платёж не был завершён успешно.', en: 'Unfortunately, your payment was not completed successfully.' },
    'payment.refunded_title': { ru: 'Платёж возвращён', en: 'Payment Refunded' },
    'payment.processing_title': { ru: 'Обработка платежа', en: 'Processing Payment' },
    'payment.processing_text': { ru: 'Ваш платёж находится в обработке.', en: 'Your payment is being processed.' },
    'payment.status': { ru: 'Статус:', en: 'Status:' },
    'payment.refresh_status': { ru: 'Обновить статус', en: 'Refresh status' },
    'payment.receipt_unavailable': { ru: 'Информация о заказе недоступна', en: 'Order information is unavailable' },
    'payment.service_type': { ru: 'Услуга:', en: 'Service:' },
    'common.company_name': { ru: 'Bunyod-Tour', en: 'Bunyod-Tour' },

    // === Страница «Тур-агентам» / Tour Agents page ===
    'tour_agents.page_title': {
        ru: 'Программа «Тур-агент» | Bunyod-Tour',
        en: 'Tour Agent Program | Bunyod-Tour'
    },
    'tour_agents.meta_description': {
        ru: 'Партнёрская программа «Тур-агент» от ООО «Бунёд-Тур». Получайте 10% (15% для членов АТАЦА) от стоимости тура за реализацию туристических продуктов с bunyodtour.tj.',
        en: "Affiliate program 'Tour Agent' by Bunyod-Tour LLC. Earn 10% (15% for ATACA members) of the tour price for selling tour packages from bunyodtour.tj."
    },
    'tour_agents.hero_badge': {
        ru: 'Партнёрская программа',
        en: 'Affiliate Program'
    },
    'tour_agents.hero_title': {
        ru: '«ТУР-АГЕНТ»',
        en: '«TOUR AGENT»'
    },
    'tour_agents.hero_subtitle': {
        ru: 'Лояльная партнёрская платформа от ООО «Бунёд-Тур» — условия сотрудничества и возможность найти доступную профессию в туризме.',
        en: 'A loyal partner platform from Bunyod-Tour LLC — terms of cooperation and an opportunity to find an accessible profession in tourism.'
    },

    'tour_agents.purpose_title': {
        ru: 'Цель программы',
        en: 'Program Purpose'
    },
    'tour_agents.purpose_text': {
        ru: 'Данная программа в рамках деятельности ООО «Бунёд-Тур» представлена как лояльная партнёрская платформа, условие сотрудничества и возможность найти доступное место и вид занятости (профессии) для соответствующих групп лиц.',
        en: 'This program, within the framework of the activities of Bunyod-Tour LLC, is presented as a loyal partner platform, a condition for cooperation, and an opportunity to find an accessible place and type of employment (profession) for relevant groups of people.'
    },

    'tour_agents.about_title': {
        ru: 'ООО «Бунёд-Тур»',
        en: 'Bunyod-Tour LLC'
    },
    'tour_agents.about_p1': {
        ru: 'Общество с ограниченной ответственностью «Бунёд-Тур» — региональная туристическая компания, основанная в 2017 году в городе Душанбе, Таджикистан (лицензия № 0000253 от 25 октября 2022 года). Основным видом деятельности является въездной туризм, направленный на приём иностранных туристов и предоставление им услуг в Таджикистане и странах Центральной Азии.',
        en: 'Limited Liability Company "Bunyod-Tour" is a regional travel company founded in 2017 in Dushanbe, Tajikistan (license No. 0000253 dated October 25, 2022). Its primary activity is inbound tourism — welcoming foreign tourists and providing them with services in Tajikistan and Central Asia.'
    },
    'tour_agents.about_p2': {
        ru: '«Бунёд-Тур» располагает онлайн-порталом заказа туристических продуктов (один из первых в Центральной Азии), более 200 туристических маршрутов (туров), предоставляет транспортные (трансфер) и тургид-услуги, а также систему самостоятельной автономной (онлайн) разработки туристического маршрута. Компания сотрудничает с более чем 50 региональными и международными организациями.',
        en: 'Bunyod-Tour operates an online portal for booking tourism products (one of the first in Central Asia), offers over 200 tourist routes (tours), provides transportation (transfers) and tour-guide services, and features an independent, autonomous (online) tourist route development system. The company collaborates with over 50 regional and international organizations.'
    },
    'tour_agents.stat_founded': { ru: 'Год основания', en: 'Founded' },
    'tour_agents.stat_tours': { ru: 'Туристических маршрутов', en: 'Tour routes' },
    'tour_agents.stat_partners': { ru: 'Партнёрских организаций', en: 'Partner organizations' },
    'tour_agents.stat_license': { ru: 'Лицензия на туристическую деятельность', en: 'Tourism license' },

    'tour_agents.who_title': {
        ru: 'Кто может стать тур-партнёром (турагентом)?',
        en: 'Who Can Become a Tour Partner (Tour Agent)?'
    },
    'tour_agents.who_intro': {
        ru: 'Нашими тур-партнёрами могут стать следующие группы:',
        en: 'The following groups can become our tour partners:'
    },
    'tour_agents.who_item1': { ru: 'Туристические компании', en: 'Travel companies' },
    'tour_agents.who_item2': { ru: 'Блогеры', en: 'Bloggers' },
    'tour_agents.who_item3': { ru: 'Специалисты туристической отрасли', en: 'Travel-industry specialists' },
    'tour_agents.who_item4': { ru: 'Практиканты', en: 'Interns' },
    'tour_agents.who_item5': { ru: 'Фрилансеры', en: 'Freelancers' },
    'tour_agents.who_item6': { ru: 'Ищущие работу', en: 'Job seekers' },
    'tour_agents.who_item7': { ru: 'Студенты', en: 'Students' },

    'tour_agents.duties_title': {
        ru: 'Каковы основные обязанности турагента?',
        en: 'Main Responsibilities of a Tour Agent'
    },
    'tour_agents.duties_intro': {
        ru: 'Посредством сайта',
        en: 'Through the website'
    },
    'tour_agents.duties_1a': {
        ru: 'Реализация (продажа) туристических продуктов (тур-пакетов) туристам.',
        en: 'Selling tourist products (tour packages) to tourists.'
    },
    'tour_agents.duties_1b': {
        ru: 'Предложение туристических продуктов всеми доступными способами, включая выставки и Интернет.',
        en: 'Offering tourism products to tourists in any way possible, including at exhibitions and online.'
    },
    'tour_agents.duties_1c': {
        ru: 'Продвижение (реклама) туристских продуктов всеми доступными средствами, особенно через Интернет, для привлечения иностранных туристов.',
        en: 'Advertising tourist products in any way possible, especially online, to attract foreign tourists.'
    },
    'tour_agents.duties_2': {
        ru: 'Разработка и реализация специального туристического продукта с использованием возможностей Компании.',
        en: "Come up with a special type of tourism product and put it into action using the Company's capabilities."
    },

    'tour_agents.product_title': {
        ru: 'Что такое туристический продукт?',
        en: 'What Is a Tourist Product?'
    },
    'tour_agents.product_text_before': {
        ru: 'Туристический продукт — это туры и туристические услуги, представленные на нашем сайте —',
        en: 'A tourist product is a tour or tourism service that is available for tourists to book on our website —'
    },
    'tour_agents.product_text_after': {
        ru: 'и доступные для бронирования туристами.',
        en: 'and available for booking by tourists.'
    },

    'tour_agents.howto_title': {
        ru: 'Как стать турагентом',
        en: 'How to Become a Tour Agent'
    },
    'tour_agents.howto_step1_before': {
        ru: 'Для сотрудничества или партнёрства с нами подайте заявку через наш сайт —',
        en: 'Submit an application through our website —'
    },
    'tour_agents.howto_step1_after': {
        ru: ', страница «Стать Тур-партнёром», и ознакомьтесь с соответствующими условиями и соглашением о партнёрстве.',
        en: ', the page "Become a Partner" — and read the relevant terms and conditions and the partnership agreement.'
    },
    'tour_agents.howto_step2': {
        ru: 'В случае одобрения на адрес электронной почты заявителя будет отправлено письмо-подтверждение.',
        en: "If approved, a confirmation email will be sent to the applicant's email address."
    },
    'tour_agents.howto_cta': {
        ru: 'Стать Тур-партнёром',
        en: 'Become a Tour Partner'
    },

    'tour_agents.system_title': {
        ru: 'Как работает эта система?',
        en: 'How Does the System Work?'
    },
    'tour_agents.system_intro': {
        ru: 'Система очень проста и удобна:',
        en: 'The system is very simple and easy:'
    },
    'tour_agents.system_step1': {
        ru: 'После завершения заказа туристического пакета туристом турагент направляет в компанию через личный кабинет соответствующую информацию, включая порядковый номер (ID) Ваучера заказанного тура (полученный от туриста), как запрос на выполненный заказ.',
        en: "After the tourist has finished choosing a tour, the tour agent sends the relevant information to the company through the personal account, including the Voucher ID number of the ordered tour received from the tourist."
    },
    'tour_agents.system_step2': {
        ru: 'В ответ на личный кабинет турагента отправляется подтверждение о принятии заказа.',
        en: "A confirmation that the order has been accepted is then sent to the tour agent's personal account."
    },

    'tour_agents.earn_title': {
        ru: 'Как зарабатывает турагент?',
        en: 'How Does a Tour Agent Make Money?'
    },
    'tour_agents.earn_commission_label': {
        ru: 'Комиссия',
        en: 'Commission'
    },
    'tour_agents.earn_commission_value': {
        ru: 'от стоимости тура за реализацию (продажу) туристического продукта',
        en: 'of the tour price for selling the tour product'
    },
    'tour_agents.earn_commission_note': {
        ru: 'Для членов АТАЦА — 15%',
        en: '15% for ATACA members'
    },
    'tour_agents.earn_payment_label': {
        ru: 'Выплата',
        en: 'Payout'
    },
    'tour_agents.earn_payment_value': {
        ru: '10 дней',
        en: '10 days'
    },
    'tour_agents.earn_payment_note': {
        ru: 'Сумма переводится на банковский счёт или карту турагента в течение 10 дней с момента завершения тура.',
        en: "Funds are transferred to the tour agent's bank account or card within 10 days after the tour is completed."
    },

    'tour_agents.cta_join': {
        ru: 'Будьте с нами — добивайтесь успеха!',
        en: 'Come and join us — and you can achieve success!'
    },
    'tour_agents.cta_subtitle': {
        ru: 'Подайте заявку на участие в партнёрской программе или скачайте полное описание программы.',
        en: 'Apply to the partner program or download the full program description.'
    },
    'tour_agents.cta_button': {
        ru: 'Стать Тур-партнёром',
        en: 'Become a Tour Partner'
    },
    'tour_agents.download_program': {
        ru: 'Скачать программу (PDF)',
        en: 'Download program (PDF)'
    },

    // Hero CTA + статистика
    'tour_agents.hero_cta': {
        ru: 'Стать Тур-партнёром',
        en: 'Become a Tour Partner'
    },
    'tour_agents.hero_cta_secondary': {
        ru: 'Как это работает?',
        en: 'How does it work?'
    },
    'tour_agents.hero_stat_commission': {
        ru: 'Комиссия с продажи',
        en: 'Commission per sale'
    },
    'tour_agents.hero_stat_payout': {
        ru: 'Дней до выплаты',
        en: 'Days to payout'
    },
    'tour_agents.hero_stat_tours': {
        ru: 'Туров в каталоге',
        en: 'Tours to sell'
    },

    // Eyebrow-метки секций
    'tour_agents.purpose_eyebrow': { ru: 'О программе', en: 'About the program' },
    'tour_agents.about_eyebrow':   { ru: 'О нас',         en: 'Who we are' },
    'tour_agents.who_eyebrow':     { ru: 'Открыто для всех', en: 'Open to everyone' },
    'tour_agents.duties_eyebrow':  { ru: 'Что вы делаете',   en: 'What you do' },
    'tour_agents.product_eyebrow': { ru: 'Определение',      en: 'Definition' },
    'tour_agents.howto_eyebrow':   { ru: 'Начните',          en: 'Get started' },
    'tour_agents.system_eyebrow':  { ru: 'Процесс',          en: 'Workflow' },
    'tour_agents.earn_eyebrow':    { ru: 'Ваше вознаграждение', en: 'Your reward' },
    'tour_agents.final_eyebrow':   { ru: 'Присоединяйтесь',  en: 'Join the program' },

    // Доп. карточка в "Кто может стать"
    'tour_agents.who_item_more': {
        ru: '…а вы?',
        en: '…and you?'
    },

};

// Убираем const aliases - используем прямые ссылки на window.*

// === ФУНКЦИЯ ПОЛУЧЕНИЯ ПЕРЕВОДА ===
function getTranslation(key, lang = window.currentLanguage) {
    if (window.translations[key] && window.translations[key][lang]) {
        return window.translations[key][lang];
    }
    // Возвращаем русский как fallback
    if (window.translations[key] && window.translations[key]['ru']) {
        return window.translations[key]['ru'];
    }
    // Если перевода вообще нет, возвращаем ключ
    return key;
}

// === ОБНОВЛЕНИЕ ССЫЛОК НА ДОКУМЕНТЫ В ЗАВИСИМОСТИ ОТ ЯЗЫКА ===
function updateDocumentLinks(lang) {
    const docLinks = document.querySelectorAll('.lang-doc-link');
    docLinks.forEach(link => {
        const docRu = link.getAttribute('data-doc-ru');
        const docEn = link.getAttribute('data-doc-en');
        if (docRu && docEn) {
            link.href = lang === 'en' ? docEn : docRu;
        }
    });
}

// === ГЛАВНАЯ УНИФИЦИРОВАННАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ЯЗЫКА ===
// Это единственная точка входа для смены языка на всем сайте
function updatePageLanguage(lang) {
    // ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
    if (!lang || typeof lang !== 'string') {
        console.warn('🌐 Недопустимый язык, используем русский по умолчанию');
        lang = 'ru';
    }
    
    if (!window.supportedLanguages.includes(lang)) {
        console.warn(`🌐 Неподдерживаемый язык "${lang}", используем русский`);
        lang = 'ru';
    }
    
    console.log(`🌍 Переключение языка на: ${lang}`);
    
    // СОХРАНЯЕМ ЯЗЫК В LOCALSTORAGE (долгосрочно) И SESSIONSTORAGE (быстрый доступ в сессии)
    try {
        localStorage.setItem('selectedLanguage', lang);
    } catch (error) {
        console.error('❌ Ошибка сохранения в localStorage:', error);
    }
    try {
        sessionStorage.setItem('bt_lang', lang);
        sessionStorage.setItem('bt_i18n_sess', '1');
    } catch (e) { /* sessionStorage недоступен — игнорируем */ }
    
    window.currentLanguage = lang;
    
    // ОБНОВЛЯЕМ UI ПЕРЕКЛЮЧАТЕЛЯ ЯЗЫКА
    updateLanguageSelector(lang);
    
    // === ПРИОРИТЕТ 1: ОБЪЕДИНЕНИЕ СИСТЕМ ПЕРЕВОДОВ ===
    // 1. Переводим статические элементы (data-translate, data-translate-placeholder, etc.)
    translateStaticInterface(lang);
    
    // 2. Переводим динамический контент (data-multilingual-*, data-tour-title, etc.)
    if (typeof window.translateAllDynamicContent === 'function') {
        window.translateAllDynamicContent(lang);
        console.log('✅ Динамический контент обновлен');
    } else {
        console.warn('⚠️ translateAllDynamicContent не найдена - динамический контент не обновлен');
    }
    
    // 3. Обновляем ссылки на документы в зависимости от языка
    updateDocumentLinks(lang);
    
    // ОБНОВЛЯЕМ HTML LANG АТРИБУТ
    document.documentElement.lang = lang;
    
    // ОТПРАВЛЯЕМ СОБЫТИЕ ДЛЯ СТРАНИЦ С СПЕЦИФИЧНЫМ КОНТЕНТОМ
    const event = new CustomEvent('languageChanged', {
        detail: { language: lang }
    });
    document.dispatchEvent(event);
    console.log(`📢 Событие languageChanged отправлено для языка: ${lang}`);
    
    // ЗАКРЫВАЕМ DROPDOWN БЕЗОПАСНО
    const dropdown = document.getElementById('langDropdown');
    const arrow = document.querySelector('.dropdown-arrow');
    
    if (dropdown) dropdown.classList.remove('show');
    if (arrow) arrow.classList.remove('open');
    
    console.log(`🎉 Переключение языка на ${lang} завершено`);
}

// === ОБНОВЛЕНИЕ ПЕРЕКЛЮЧАТЕЛЯ ЯЗЫКОВ ===
function updateLanguageSelector(lang) {
    const languages = {
        'ru': { name: 'Русский', flag: '🇷🇺', flagClass: 'flag-ru', code: 'RU' },
        'en': { name: 'English', flag: '🇺🇸', flagClass: 'flag-us', code: 'EN' },
    };
    
    const selectedLang = languages[lang];
    if (!selectedLang) return;
    
    // Обновляем основную кнопку (обычные страницы)
    const selectedFlag = document.querySelector('.selected-flag');
    const selectedLangElements = document.querySelectorAll('.selected-lang');
    
    if (selectedFlag) {
        selectedFlag.textContent = selectedLang.flag;
        selectedFlag.className = `selected-flag ${selectedLang.flagClass}`;
    }
    
    // Обновляем ВСЕ элементы .selected-lang только инициалами (десктоп и мобильный)
    selectedLangElements.forEach(el => {
        el.textContent = selectedLang.code;
    });
    
    // Обновляем новый переключатель с ID current-language
    const currentLanguageElement = document.getElementById('current-language');
    if (currentLanguageElement) {
        currentLanguageElement.textContent = selectedLang.code;
    }
    
    // ОБНОВЛЯЕМ ПЕРЕКЛЮЧАТЕЛЬ В АДМИН-ПАНЕЛИ
    const currentLanguageAdmin = document.getElementById('currentLanguageAdmin');
    if (currentLanguageAdmin) {
        currentLanguageAdmin.textContent = selectedLang.code;
    }
    
    // Обновляем активную опцию в dropdown (обычные страницы)
    document.querySelectorAll('.lang-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.lang === lang) {
            option.classList.add('active');
        }
    });
    
    // Обновляем активную опцию в dropdown админ-панели
    document.querySelectorAll('#languageDropdownAdmin .lang-option, #languageDropdownAdmin a[onclick*="switchAdminLanguage"]').forEach(option => {
        option.classList.remove('active');
        if (option.getAttribute('onclick') && option.getAttribute('onclick').includes(`'${lang}'`)) {
            option.classList.add('active');
        }
    });
}

// === ИНИЦИАЛИЗАЦИЯ ЯЗЫКА ===
function initializeLanguage() {
    let savedLanguage = 'en'; // Безопасное значение по умолчанию - английский
    
    // БЕЗОПАСНОЕ ЧТЕНИЕ ИЗ LOCALSTORAGE
    try {
        const stored = localStorage.getItem('selectedLanguage');
        
        // Валидируем сохранённое значение
        if (stored && window.supportedLanguages.includes(stored)) {
            savedLanguage = stored;
        } else {
            console.warn(`Недопустимое значение "${stored}", используем английский по умолчанию`);
            // Исправляем в localStorage
            localStorage.setItem('selectedLanguage', 'en');
        }
    } catch (error) {
        console.error('Ошибка чтения localStorage:', error);
    }
    
    // УСТАНАВЛИВАЕМ ЯЗЫК
    window.currentLanguage = savedLanguage;
    
    // ОБНОВЛЯЕМ HTML LANG АТРИБУТ
    document.documentElement.lang = savedLanguage;
    
    // ПРИМЕНЯЕМ ПЕРЕВОДЫ И ОБНОВЛЯЕМ ИНТЕРФЕЙС
    updateLanguageSelector(savedLanguage);
    translateStaticInterface(savedLanguage);

    // ФИКСИРУЕМ СЕССИЮ — следующие страницы будут знать язык быстрее
    try {
        sessionStorage.setItem('bt_lang', savedLanguage);
        sessionStorage.setItem('bt_i18n_sess', '1');
    } catch (e) { /* sessionStorage недоступен — игнорируем */ }

    // === СНИМАЕМ FOUC-ЗАЩИТУ ===
    // Переводы применены — теперь показываем страницу плавно.
    try {
        if (window._foucSafetyTimer) {
            clearTimeout(window._foucSafetyTimer);
            window._foucSafetyTimer = null;
        }
        var foucStyle = document.getElementById('i18n-fouc-prevention');
        if (foucStyle) foucStyle.remove();
        if (document.body) {
            document.body.style.opacity = '';
        }
    } catch (e) { /* безопасно игнорируем */ }
}

// === ФУНКЦИЯ ПЕРЕВОДА СТАТИЧЕСКОГО ИНТЕРФЕЙСА ===
function translateStaticInterface(lang) {
    let translatedCount = 0;
    
    // ПЕРЕВОДИМ ОСНОВНОЙ ТЕКСТ (data-translate ИЛИ data-i18n)
    // Если задан data-translate-attr="имя_атрибута" — переводим этот атрибут вместо текста
    // (например, <meta data-translate="..." data-translate-attr="content">)
    document.querySelectorAll('[data-translate], [data-i18n]').forEach(element => {
        const key = element.getAttribute('data-translate') || element.getAttribute('data-i18n');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            const attrName = element.getAttribute('data-translate-attr');
            if (attrName) {
                element.setAttribute(attrName, translation);
            } else if (element.hasAttribute('data-translate-html')) {
                element.innerHTML = translation;
            } else if (element.children.length === 0) {
                element.textContent = translation;
            } else {
                updateTextNodes(element, translation);
            }
            translatedCount++;
        } else {
            console.warn(`Перевод не найден для ключа: ${key}`);
        }
    });
    
    // ПЕРЕВОДИМ PLACEHOLDERS (data-translate-placeholder ИЛИ data-i18n-placeholder)
    document.querySelectorAll('[data-translate-placeholder], [data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-translate-placeholder') || element.getAttribute('data-i18n-placeholder');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            element.placeholder = translation;
            translatedCount++;
        } else {
            console.warn(`Placeholder перевод не найден для ключа: ${key}`);
        }
    });
    
    // ПЕРЕВОДИМ ALT АТРИБУТЫ (data-translate-alt)
    document.querySelectorAll('[data-translate-alt]').forEach(element => {
        const key = element.getAttribute('data-translate-alt');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            element.alt = translation;
            translatedCount++;
        }
    });
    
    // ПЕРЕВОДИМ TITLE АТРИБУТЫ (data-translate-title)
    document.querySelectorAll('[data-translate-title]').forEach(element => {
        const key = element.getAttribute('data-translate-title');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            element.title = translation;
            translatedCount++;
        }
    });
    
    // ПЕРЕВОДИМ VALUE АТРИБУТЫ (data-translate-value)
    document.querySelectorAll('[data-translate-value]').forEach(element => {
        const key = element.getAttribute('data-translate-value');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            element.value = translation;
            translatedCount++;
        }
    });
    
    // ПЕРЕВОДИМ LABEL АТРИБУТЫ (data-translate-label) - для optgroup и других элементов
    document.querySelectorAll('[data-translate-label]').forEach(element => {
        const key = element.getAttribute('data-translate-label');
        const translation = getTranslation(key, lang);
        
        if (translation && translation !== key) {
            element.label = translation;
            translatedCount++;
        }
    });
    
}

// === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ТЕКСТОВЫХ УЗЛОВ ===
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

// === ПРИОРИТЕТ 2: АВТОМАТИЧЕСКИЙ ПЕРЕВОД НОВЫХ ЭЛЕМЕНТОВ ===
/**
 * Переводит отдельный элемент и все его дочерние элементы с data-translate атрибутами
 * @param {HTMLElement} element - Элемент для перевода
 * @param {string} lang - Код языка
 */
function translateNewElement(element, lang) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    
    const currentLang = lang || window.currentLanguage;
    let translatedCount = 0;
    
    // Функция для обработки одного элемента
    const translateSingleElement = (el) => {
        // 1. СТАТИЧЕСКИЕ ПЕРЕВОДЫ (data-translate)
        if (el.hasAttribute('data-translate')) {
            const key = el.getAttribute('data-translate');
            const translation = getTranslation(key, currentLang);
            if (translation && translation !== key) {
                if (el.hasAttribute('data-translate-html')) {
                    el.innerHTML = translation;
                } else if (el.children.length === 0) {
                    el.textContent = translation;
                } else {
                    updateTextNodes(el, translation);
                }
                translatedCount++;
            }
        }
        
        // 2. Placeholders
        if (el.hasAttribute('data-translate-placeholder')) {
            const key = el.getAttribute('data-translate-placeholder');
            const translation = getTranslation(key, currentLang);
            if (translation && translation !== key) {
                el.placeholder = translation;
                translatedCount++;
            }
        }
        
        // 3. Alt атрибуты
        if (el.hasAttribute('data-translate-alt')) {
            const key = el.getAttribute('data-translate-alt');
            const translation = getTranslation(key, currentLang);
            if (translation && translation !== key) {
                el.alt = translation;
                translatedCount++;
            }
        }
        
        // 4. Title атрибуты
        if (el.hasAttribute('data-translate-title')) {
            const key = el.getAttribute('data-translate-title');
            const translation = getTranslation(key, currentLang);
            if (translation && translation !== key) {
                el.title = translation;
                translatedCount++;
            }
        }
        
        // 5. ДИНАМИЧЕСКИЕ ПЕРЕВОДЫ (data-multilingual-*)
        if (typeof window.updateMultilingualElement === 'function') {
            if (el.hasAttribute('data-multilingual-text')) {
                const content = el.dataset.multilingualText;
                window.updateMultilingualElement(el, content, currentLang, 'textContent');
                translatedCount++;
            }
            if (el.hasAttribute('data-multilingual-html')) {
                const content = el.dataset.multilingualHtml;
                window.updateMultilingualElement(el, content, currentLang, 'innerHTML');
                translatedCount++;
            }
            if (el.hasAttribute('data-multilingual-placeholder')) {
                const content = el.dataset.multilingualPlaceholder;
                window.updateMultilingualElement(el, content, currentLang, 'placeholder');
                translatedCount++;
            }
        }
    };
    
    // Переводим сам элемент
    translateSingleElement(element);
    
    // Переводим все дочерние элементы с data-translate/data-multilingual атрибутами
    const elementsToTranslate = element.querySelectorAll(
        '[data-translate], [data-translate-placeholder], [data-translate-alt], [data-translate-title], ' +
        '[data-multilingual-text], [data-multilingual-html], [data-multilingual-placeholder]'
    );
    
    elementsToTranslate.forEach(translateSingleElement);
    
    if (translatedCount > 0) {
        console.log(`🔄 MutationObserver: переведено ${translatedCount} новых элементов на ${currentLang}`);
    }
}

// === MUTATION OBSERVER: АВТОМАТИЧЕСКИЙ ПЕРЕВОД НОВЫХ ЭЛЕМЕНТОВ ===
let languageObserver = null;

/**
 * Инициализирует MutationObserver для автоматического перевода новых элементов
 */
function initializeLanguageObserver() {
    // Предотвращаем создание нескольких observer'ов
    if (languageObserver) {
        console.log('⚠️ MutationObserver уже инициализирован');
        return;
    }
    
    languageObserver = new MutationObserver((mutations) => {
        const currentLang = window.currentLanguage || 'en';
        
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Переводим новый элемент
                    translateNewElement(node, currentLang);
                }
            });
        });
    });
    
    // Начинаем наблюдение за изменениями в DOM
    languageObserver.observe(document.body, {
        childList: true,      // Отслеживаем добавление/удаление дочерних элементов
        subtree: true         // Отслеживаем изменения во всем поддереве
    });
    
    console.log('👁️ MutationObserver запущен - новые элементы будут автоматически переводиться');
}

/**
 * Останавливает MutationObserver
 */
function stopLanguageObserver() {
    if (languageObserver) {
        languageObserver.disconnect();
        languageObserver = null;
        console.log('🛑 MutationObserver остановлен');
    }
}

// === ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ DROPDOWN ЯЗЫКОВ ===
function toggleLanguageDropdown() {
    const dropdown = document.getElementById('langDropdown');
    const arrow = document.querySelector('.dropdown-arrow');
    
    if (dropdown) dropdown.classList.toggle('show');
    if (arrow) arrow.classList.toggle('open');
}

// === БЕЗОПАСНАЯ ФУНКЦИЯ ЭКРАНИРОВАНИЯ HTML ===
function escapeHTML(unsafe) {
    if (typeof unsafe !== 'string') {
        unsafe = String(unsafe || '');
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// === БЕЗОПАСНАЯ ФУНКЦИЯ ЭКРАНИРОВАНИЯ ДЛЯ DATA-АТРИБУТОВ ===
function escapeDataAttribute(unsafe) {
    if (typeof unsafe !== 'string') {
        unsafe = String(unsafe || '');
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// === АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ===
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация языка
    initializeLanguage();
    
    // === ПРИОРИТЕТ 2: ЗАПУСКАЕМ MUTATION OBSERVER ===
    // Автоматический перевод новых элементов при их добавлении в DOM
    initializeLanguageObserver();
});

// === ЭКСПОРТ ДЛЯ ГЛОБАЛЬНОГО ИСПОЛЬЗОВАНИЯ ===
window.i18n = {
    supportedLanguages: window.supportedLanguages,
    currentLanguage: () => window.currentLanguage,
    initializeLanguage,
    updatePageLanguage,              // Главная унифицированная функция
    switchSiteLanguage: updatePageLanguage,  // Алиас для совместимости
    translateStaticInterface,
    getTranslation,
    toggleLanguageDropdown,
    updateLanguageSelector,
    // === ПРИОРИТЕТ 2: Функции для работы с новыми элементами ===
    translateNewElement,             // Перевод отдельного элемента
    initializeLanguageObserver,      // Запуск MutationObserver
    stopLanguageObserver,            // Остановка MutationObserver
    // Безопасные функции экранирования
    escapeHTML,
    escapeDataAttribute
};

// === ЭКСПОРТ ФУНКЦИЙ ЭКРАНИРОВАНИЯ ===
window.escapeHTML = escapeHTML;
window.escapeDataAttribute = escapeDataAttribute;

// === ГЛОБАЛЬНЫЕ HELPER ФУНКЦИИ ДЛЯ ДИНАМИЧЕСКОГО КОНТЕНТА (БЕЗОПАСНЫЕ) ===
window.getTitleByLanguage = function(titleObject, lang) {
    try {
        const title = typeof titleObject === 'string' ? JSON.parse(titleObject) : titleObject;
        const result = title[lang] || title.ru || title.en || 'Название не указано';
        return escapeHTML(result);
    } catch (e) {
        return escapeHTML(titleObject || 'Название не указано');
    }
};

window.getDescriptionByLanguage = function(descriptionObject, lang) {
    try {
        const description = typeof descriptionObject === 'string' ? JSON.parse(descriptionObject) : descriptionObject;
        const result = description[lang] || description.ru || description.en || 'Описание не указано';
        return escapeHTML(result);
    } catch (e) {
        return escapeHTML(descriptionObject || 'Описание не указано');
    }
};

window.getCategoryNameByLanguage = function(categoryObject, lang) {
    try {
        const category = typeof categoryObject === 'string' ? JSON.parse(categoryObject) : categoryObject;
        const result = category[lang] || category.ru || category.en || 'Категория';
        return escapeHTML(result);
    } catch (e) {
        return escapeHTML(categoryObject || 'Категория');
    }
};

// === НЕБЕЗОПАСНЫЕ ВЕРСИИ ДЛЯ ОСОБЫХ СЛУЧАЕВ (ИСПОЛЬЗОВАТЬ ОСТОРОЖНО) ===
window.getTitleByLanguageRaw = function(titleObject, lang) {
    try {
        const title = typeof titleObject === 'string' ? JSON.parse(titleObject) : titleObject;
        return title[lang] || title.ru || title.en || 'Название не указано';
    } catch (e) {
        return titleObject || 'Название не указано';
    }
};

window.getDescriptionByLanguageRaw = function(descriptionObject, lang) {
    try {
        const description = typeof descriptionObject === 'string' ? JSON.parse(descriptionObject) : descriptionObject;
        return description[lang] || description.ru || description.en || 'Описание не указано';
    } catch (e) {
        return descriptionObject || 'Описание не указано';
    }
};

window.getCategoryNameByLanguageRaw = function(categoryObject, lang) {
    try {
        const category = typeof categoryObject === 'string' ? JSON.parse(categoryObject) : categoryObject;
        return category[lang] || category.ru || category.en || 'Категория';
    } catch (e) {
        return categoryObject || 'Категория';
    }
};


// === ГЛОБАЛЬНАЯ УТИЛИТА ДЛЯ МНОГОЯЗЫЧНЫХ ДАННЫХ ===
window.getMultilingualValue = function(obj, baseKey, fallback = '') {
    if (!obj) return fallback || '';
    const lang = (window.currentLanguage || 'en').toLowerCase();
    const suffix = lang === 'en' ? 'En' : lang === 'ru' ? 'Ru' : 'Tj';
    const tryKeys = [baseKey + suffix, baseKey + 'En', baseKey + 'Ru', baseKey + 'Tj', baseKey, 'name', 'title'];
    for (const k of tryKeys) {
        const v = obj[k];
        if (v) {
            if (typeof v === 'object') {
                return v[lang] || v.en || v.ru || fallback || '';
            }
            return String(v);
        }
    }
    return fallback || '';
};

// === ЭКСПОРТ КЛЮЧЕВЫХ ФУНКЦИЙ ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ ===

// ГЛАВНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ЯЗЫКА - единственная точка входа
window.updatePageLanguage = updatePageLanguage;

// АЛИАСЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
window.switchLanguage = updatePageLanguage;           // Используется в layout-loader.js
window.switchSiteLanguage = updatePageLanguage;       // Старое название

// Функция применения переводов (для прямого вызова)
window.applyTranslations = translateStaticInterface;

// Функция инициализации языка
window.initializeLanguage = initializeLanguage;

// Функция обновления селектора языка
window.updateLanguageSelector = updateLanguageSelector;

// Функция получения переводов
window.getTranslation = getTranslation;

console.log('🌍 i18n система инициализирована | Унифицированное переключение языка: updatePageLanguage()');

})(); // Закрываем IIFE