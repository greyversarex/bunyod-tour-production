# Новые ключи переводов для admin-dashboard.html

## Административные разделы (admin.*)
```javascript
admin: {
    price_calculator: "Price Calculator",
    banner_management: "Banner Management", 
    tour_agents: "Tour Agents",
    trips: "Trips",
    exchange_rates: "Exchange Rates",
    cms_content: "CMS - Content",
    translations: "Translations",
    monthly_revenue: "Monthly Revenue",
    active_customers: "Active Customers", 
    sales_chart: "Sales Chart",
    popular_destinations: "Popular Destinations",
    manage_hotels: "Hotel Management",
    manage_guides: "Guide Management",
    manage_tour_agents: "Tour Agent Management",
    manage_drivers: "Driver Management",
    manage_trips: "Trip Management",
    transfer_requests: "Transfer Requests",
    manage_countries: "Country Management",
    manage_cities: "City Management",
    total_views: "Total Views",
    total_news: "Total News",
    published: "Published",
    drafts: "Drafts",
    tour_blocks: "Tour Blocks",
    site_settings: "Site Settings",
    tour_form: "Tour Form",
    manage_tour_blocks: "Tour Block Management"
}
```

## Таблицы (table.*)
```javascript
table: {
    order_number: "Order #",
    client: "Client",
    tour: "Tour", 
    date: "Date",
    amount: "Amount",
    status: "Status",
    actions: "Actions",
    name: "Name",
    category: "Category",
    country: "Country",
    city: "City",
    duration: "Duration",
    price: "Price",
    title: "Title",
    author: "Author",
    publish_date: "Publish Date",
    views: "Views",
    block_name_ru: "Block Name (RU)",
    block_name_en: "Block Name (EN)",
    slug: "Slug",
    tour_count: "Tour Count",
    order: "Order"
}
```

## Кнопки (btn.*)
```javascript
btn: {
    add_tour: "Add Tour",
    create_tour_block: "Create Tour Block",
    add_hotel: "Add Hotel",
    add_guide: "Add Guide", 
    add_tour_agent: "Add Tour Agent",
    add_driver: "Add Driver",
    add_trip: "Add Trip",
    add_country: "Add Country",
    add_city: "Add City"
}
```

## Статусы (status.*)
```javascript
status: {
    pending: "Pending",
    confirmed: "Confirmed", 
    paid: "Paid",
    completed: "Completed",
    cancelled: "Cancelled"
}
```

## Табы (tab.*)
```javascript
tab: {
    all_orders: "All Orders"
}
```

## Формы (form.*)
```javascript
form: {
    pickup_info: "Pickup/Meeting Information",
    tour_languages: "Tour Languages",
    min_people: "Minimum Number of People",
    max_people: "Maximum Number of People", 
    available_months: "Available Months",
    available_days: "Available Days",
    tour_photos: "Tour Photos"
}
```

## Placeholder'ы (placeholder.*)
```javascript
placeholder: {
    search_tours: "Search tours...",
    search_hotels: "Search hotels...",
    search_tour_agents: "Search tour agents...",
    enter_text_for_translation: "Enter text for translation...",
    translated_text_will_appear: "Translated text will appear here...",
    service_name_example: "For example: Restaurant lunch",
    component_additional_info: "Additional component information",
    slide_title: "Slide title",
    slide_description: "Slide description",
    learn_more: "Learn more",
    hotel_name_example: "Hilton Dushanbe, Serena Hotel, etc.",
    hotel_description_ru: "Brief hotel description, location and features in Russian...",
    enter_new_brand: "Enter new brand name",
    city_examples: "Dushanbe, Samarkand, Bishkek, etc.",
    enter_new_amenity: "Enter new amenity name",
    meeting_with_guide: "Meeting with guide",
    detailed_stage_description: "Detailed stage description",
    pickup_info_example: "For example: Pickup included, Meeting point: hotel, etc.",
    enter_service_name: "Enter service name",
    news_brief_description: "Brief news description (optional)"
}
```

## Языки (language.*)
```javascript
language: {
    russian: "Russian"
}
```

## Инструкции по интеграции

1. **Добавить эти ключи в i18n.js** в соответствующие разделы ru и en
2. **Проверить все data-translate атрибуты** в admin-dashboard.html соответствуют этим ключам
3. **Протестировать переключение языков** в админ-панели

## Статистика покрытия

- **Административные разделы**: 27 ключей
- **Таблицы**: 21 ключ  
- **Кнопки**: 9 ключей
- **Статусы**: 5 ключей
- **Табы**: 1 ключ
- **Формы**: 7 ключей
- **Placeholder'ы**: 18 ключей
- **Языки**: 1 ключ

**Общее количество новых ключей**: 89

## Примечания

- Все переводы ориентированы на административную панель
- Используется профессиональная терминология для CRUD операций
- Ключи структурированы по логическим группам для удобства сопровождения
- Сохранена консистентность с существующей системой переводов