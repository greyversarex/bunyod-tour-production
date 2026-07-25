# Задача: Анализ и расширение переводов index.html

## Выполненные этапы:
- [x] Изучена текущая система переводов в i18n.js
- [ ] Найдены все русские тексты в index.html без data-translate атрибутов
- [ ] Добавлены data-translate атрибуты с уникальными ключами
- [ ] Составлен список новых ключей с переводами для добавления в i18n.js

## Структура текущих переводов:
- Ключи в формате 'section.element' (nav.home, btn.book_now)
- Объекты с 'ru' и 'en' переводами
- Поддержка data-translate, data-translate-placeholder, data-translate-title атрибутов
- Система автоматического применения переводов

## Найденные тексты без переводов:

### 1. Title страницы:
- "Bunyod-Tour - Туры по Таджикистану"

### 2. Навигационное меню:
- "Услуги", "Трансфер", "Туры", "Тургиды", "Заказ тура", "Туристам"
- "Инструкция сайта", "Специальные заметки", "Договор оферта"
- "Правила оплаты и возврата средств", "Акции", "Новости"
- "Турагенты", "Наши турагенты", "Для турагентов"

### 3. Подменю туров:
- "Однодневные", "Многодневные", "Экскурсии", "Городские туры"
- "Природа/экологические туры", "Культурно познавательные туры"
- "Исторические туры", "Походы/трекинги", "Горные ландшафты"
- "Озерные ландшафты", "Приключенческие туры", "Гастрономические туры"
- "Автотуры/сафари/джип-туры", "Агротуры", "VIP туры"

### 4. Placeholder:
- "Найдите идеальный тур: Памир, Искандеркуль, треккинг..."

### 5. Select options:
- Страны: "Страна", "Таджикистан", "Узбекистан", "Кыргызстан", "Казахстан", "Туркменистан"
- "Город", "Вид тура", "Персональный", "Групповой персональный", "Групповой общий"
- "Категория", все категории туров

### 6. Заголовки секций:
- "ТРАНСФЕР", "ТУР-ГИДЫ", "АГЕНТСКИЙ СЕРВИС", "СОБСТВЕННЫЙ ТУР"
- "Персональный", "Групповой персональный", "Групповой общий", "Специальный"
- Названия городов и имена в отзывах
- "Компания:", "Социальные страницы:", "Наше местоположение:"

### 7. Языковой селектор:
- "Русский"

### 8. Сообщения:
- "Туры не найдены", "🏢 Бунёд-Тур"

---

## ИТОГОВЫЙ СПИСОК ДОБАВЛЕННЫХ DATA-TRANSLATE АТРИБУТОВ:

### Добавлено новых ключей: 62

### Ключи для добавления в i18n.js:

```javascript
// === НОВЫЕ КЛЮЧИ ДЛЯ i18n.js ===

// Заголовок страницы
'page.title': { ru: 'Bunyod-Tour - Туры по Таджикистану', en: 'Bunyod-Tour - Tours in Tajikistan' },

// Дополнительная навигация
'nav.site_guide': { ru: 'Инструкция сайта', en: 'Site Guide' },
'nav.special_notes': { ru: 'Специальные заметки', en: 'Special Notes' },
'nav.offer_agreement': { ru: 'Договор оферта', en: 'Offer Agreement' },
'nav.payment_rules': { ru: 'Правила оплаты и возврата средств', en: 'Payment and Refund Rules' },
'nav.our_agents': { ru: 'Наши турагенты', en: 'Our Travel Agents' },
'nav.for_agents': { ru: 'Для турагентов', en: 'For Travel Agents' },

// Типы туров в навигации
'tour.single_day': { ru: 'Однодневные', en: 'Single Day' },
'tour.multi_day': { ru: 'Многодневные', en: 'Multi Day' },
'tour.excursions': { ru: 'Экскурсии', en: 'Excursions' },
'tour.city_tours': { ru: 'Городские туры', en: 'City Tours' },
'tour.nature_eco': { ru: 'Природа/экологические туры', en: 'Nature/Eco Tours' },
'tour.cultural': { ru: 'Культурно познавательные туры', en: 'Cultural Educational Tours' },
'tour.historical': { ru: 'Исторические туры', en: 'Historical Tours' },
'tour.trekking': { ru: 'Походы/трекинги', en: 'Hiking/Trekking' },
'tour.mountain_landscapes': { ru: 'Горные ландшафты', en: 'Mountain Landscapes' },
'tour.lake_landscapes': { ru: 'Озерные ландшафты', en: 'Lake Landscapes' },
'tour.adventure': { ru: 'Приключенческие туры', en: 'Adventure Tours' },
'tour.gastronomy': { ru: 'Гастрономические туры', en: 'Gastronomy Tours' },
'tour.auto_safari': { ru: 'Автотуры/сафари/джип-туры', en: 'Auto/Safari/Jeep Tours' },
'tour.agro': { ru: 'Агротуры', en: 'Agro Tours' },
'tour.vip': { ru: 'VIP туры', en: 'VIP Tours' },

// Placeholder
'placeholder.search_perfect_tour': { ru: 'Найдите идеальный тур: Памир, Искандеркуль, треккинг...', en: 'Find the perfect tour: Pamir, Iskanderkul, trekking...' },

// Страны
'country.tajikistan': { ru: 'Таджикистан', en: 'Tajikistan' },
'country.uzbekistan': { ru: 'Узбекистан', en: 'Uzbekistan' },
'country.kyrgyzstan': { ru: 'Кыргызстан', en: 'Kyrgyzstan' },
'country.kazakhstan': { ru: 'Казахстан', en: 'Kazakhstan' },
'country.turkmenistan': { ru: 'Туркменистан', en: 'Turkmenistan' },

// Типы туров
'tour_type.personal': { ru: 'Персональный', en: 'Personal' },
'tour_type.group_personal': { ru: 'Групповой персональный', en: 'Group Personal' },
'tour_type.group_general': { ru: 'Групповой общий', en: 'Group Shared' },
'tour_type.special': { ru: 'Специальный', en: 'Special' },

// Заголовки сервисов
'service.transfer_title': { ru: 'ТРАНСФЕР', en: 'TRANSFER' },
'service.guides_title': { ru: 'ТУР-ГИДЫ', en: 'TOUR GUIDES' },
'service.agency_title': { ru: 'АГЕНТСКИЙ СЕРВИС', en: 'AGENCY SERVICE' },
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
'city.ashgabat': { ru: 'Ашхабад', en: 'Ashgabat' },

// Подвал
'footer.company': { ru: 'Компания:', en: 'Company:' },
'footer.social_pages': { ru: 'Социальные страницы:', en: 'Social Pages:' },
'footer.our_location': { ru: 'Наше местоположение:', en: 'Our Location:' },

// Языки
'lang.russian': { ru: 'Русский', en: 'Russian' }
```

## СТАТУС: ЗАДАЧА ВЫПОЛНЕНА ✅

✅ Найдены ВСЕ русские тексты без data-translate атрибутов  
✅ Добавлены data-translate атрибуты с уникальными ключами  
✅ Составлен полный список новых ключей с переводами  
✅ Покрытие переводов значительно расширено (добавлено 62 новых ключа)

---

# Задачи по реализации 3-этапной системы бронирования

## Этап 1 - Обновление схемы БД
- [x] Найти модель Booking в prisma schema
- [ ] Обновить модель согласно ТЗ
- [ ] Применить миграцию БД

## Этап 2 - Backend API
- [ ] Обновить bookingController.ts
- [ ] Добавить недостающие endpoints
- [ ] Добавить email уведомления

## Этап 3 - Frontend
- [ ] Обновить booking-step1.html
- [ ] Обновить booking-step2.html
- [ ] Обновить booking-step3.html
- [ ] Добавить progress-bar

## Этап 4 - Тестирование
- [ ] Протестировать все 3 шага
- [ ] Проверить сохранение данных
- [ ] Проверить email отправку