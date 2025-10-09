const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Дополнительные туры из sample-tour-data.js
const additionalTours = {
    samarkand: {
        "title": "Древний Самарканд и мавзолей Гур-Эмир",
        "location": "Самарканд, Узбекистан",
        "rating": 4.9,
        "reviews_count": 312,
        "price_from": 150,
        "currency": "$",
        "duration": "8 часов",
        "overview": "Погрузитесь в богатую историю Самарканда, одного из древнейших городов мира. Посетите знаменитый Регистан, мавзолей Гур-Эмир и другие архитектурные шедевры Великого Шёлкового пути.",
        "highlights": [
            "Площадь Регистан с тремя медресе",
            "Мавзолей Гур-Эмир - усыпальница Тамерлана",
            "Мечеть Биби-Ханым",
            "Древний базар Сиабский"
        ]
    },
    darvaza: {
        "title": "Врата ада: газовый кратер Дарваза",
        "location": "Дашогуз, Туркменистан",
        "rating": 4.6,
        "reviews_count": 89,
        "price_from": 320,
        "currency": "$",
        "duration": "2 дня / 1 ночь",
        "overview": "Отправьтесь в незабываемое путешествие к одному из самых удивительных природных феноменов планеты - газовому кратеру Дарваза, известному как 'Врата ада'.",
        "highlights": [
            "Посещение знаменитого газового кратера Дарваза",
            "Ночёвка в пустыне под звёздным небом",
            "Фотосессия на фоне горящего кратера",
            "Переезд через пустыню Каракумы"
        ]
    },
    issyk_kul: {
        "title": "Иссык-Куль и ущелье Джеты-Огуз",
        "location": "Каракол, Киргизстан",
        "rating": 4.7,
        "reviews_count": 145,
        "price_from": 140,
        "currency": "$",
        "duration": "Полный день",
        "overview": "Исследуйте красоту озера Иссык-Куль, второго по величине высокогорного озера в мире, и посетите живописное ущелье Джеты-Огуз с его знаменитыми красными скалами.",
        "highlights": [
            "Озеро Иссык-Куль - жемчужина Тянь-Шаня",
            "Ущелье Джеты-Огуз с красными скалами",
            "Скала 'Разбитое сердце'",
            "Посещение киргизской юрты"
        ]
    }
};

async function addMoreTours() {
    try {
        console.log('🚀 Добавляем дополнительные туры...');

        // Получаем существующие блоки и категории
        const tourBlocks = await prisma.tourBlock.findMany();
        const categories = await prisma.category.findMany();
        
        console.log(`📦 Найдено блоков: ${tourBlocks.length}`);
        console.log(`📋 Найдено категорий: ${categories.length}`);

        // Добавляем туры
        const tours = [];
        let index = 0;
        
        for (const [key, tourData] of Object.entries(additionalTours)) {
            // Определяем блок для тура
            let tourBlockId = tourBlocks.find(b => JSON.parse(b.title).ru.includes('Центральная'))?.id || tourBlocks[0].id;
            let categoryId = categories.find(c => JSON.parse(c.name).ru.includes('Исторические'))?.id || categories[0].id;
            
            if (key === 'darvaza') {
                categoryId = categories.find(c => JSON.parse(c.name).ru.includes('Приключенческие'))?.id || categoryId;
            } else if (key === 'issyk_kul') {
                categoryId = categories.find(c => JSON.parse(c.name).ru.includes('Озерные'))?.id || categoryId;
            }

            const tour = await prisma.tour.create({
                data: {
                    title: JSON.stringify({
                        "ru": tourData.title,
                        "en": tourData.title
                    }),
                    description: JSON.stringify({
                        "ru": tourData.overview,
                        "en": tourData.overview
                    }),
                    shortDesc: JSON.stringify({
                        "ru": tourData.overview.substring(0, 100) + "...",
                        "en": tourData.overview.substring(0, 100) + "..."
                    }),
                    duration: tourData.duration,
                    price: `${tourData.currency}${tourData.price_from}`,
                    originalPrice: null,
                    country: tourData.location.split(',')[1].trim(),
                    city: tourData.location.split(',')[0].trim(),
                    format: "Групповой",
                    durationDays: tourData.duration.includes('день') ? (tourData.duration.includes('2') ? 2 : 1) : 1,
                    theme: "Исторический туризм",
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    images: JSON.stringify([
                        "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&h=400&fit=crop",
                        "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=600&h=400&fit=crop"
                    ]),
                    mainImage: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&h=400&fit=crop",
                    services: JSON.stringify([
                        "Трансфер",
                        "Профессиональный гид",
                        "Обед"
                    ]),
                    highlights: JSON.stringify(tourData.highlights || []),
                    itinerary: JSON.stringify([
                        {
                            "day": 1,
                            "title": "Основная программа",
                            "description": tourData.overview
                        }
                    ]),
                    included: JSON.stringify([
                        "Транспорт",
                        "Профессиональный гид",
                        "Входные билеты",
                        "Обед"
                    ]),
                    excluded: JSON.stringify([
                        "Личные расходы",
                        "Чаевые",
                        "Ужин"
                    ]),
                    requirements: JSON.stringify({
                        "age": "18+",
                        "fitness": "Средний уровень физической подготовки"
                    }),
                    difficulty: "Medium",
                    rating: tourData.rating,
                    reviewsCount: tourData.reviews_count,
                    maxPeople: 12,
                    minPeople: 2,
                    location: JSON.stringify({
                        "name": tourData.location,
                        "coordinates": null
                    }),
                    tags: JSON.stringify([
                        "История",
                        "Культура",
                        "Архитектура"
                    ]),
                    isActive: true,
                    isFeatured: false,
                    categoryId: categoryId,
                    tourBlockId: tourBlockId
                }
            });
            
            tours.push(tour);
            console.log(`✅ Создан тур: ${tourData.title}`);
            index++;
        }

        console.log('🎉 Дополнительные туры добавлены!');
        console.log(`📊 Добавлено туров: ${tours.length}`);

        // Показываем статистику
        const totalTours = await prisma.tour.count();
        const totalBlocks = await prisma.tourBlock.count();
        
        console.log('\n📈 ИТОГОВАЯ СТАТИСТИКА:');
        console.log(`🏔️ Всего туров: ${totalTours}`);
        console.log(`📦 Всего блоков: ${totalBlocks}`);
        console.log(`📋 Всего категорий: ${categories.length}`);

    } catch (error) {
        console.error('❌ Ошибка добавления туров:', error);
    } finally {
        await prisma.$disconnect();
    }
}

addMoreTours();