const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Туры по странам для заполнения блоков
const countryTours = {
    uzbekistan: [
        {
            title: "Бухара: древний город искусств",
            country: "Узбекистан",
            city: "Бухара",
            overview: "Откройте для себя жемчужину Востока - древнюю Бухару с её мечетями, медресе и базарами",
            price: 180,
            duration: "1 день",
            rating: 4.7,
            reviews: 156,
            highlights: [
                "Комплекс Пои-Калян с минаретом Калян",
                "Медресе Мир-и-Араб",
                "Торговые купола Бухары",
                "Крепость Арк"
            ]
        },
        {
            title: "Хива - музей под открытым небом",
            country: "Узбекистан", 
            city: "Хива",
            overview: "Путешествие в сказочную Хиву - единственный полностью сохранившийся город Средней Азии",
            price: 165,
            duration: "1 день",
            rating: 4.8,
            reviews: 98,
            highlights: [
                "Ичан-Кала - внутренний город",
                "Минарет Кальта-Минор",
                "Мавзолей Пахлаван-Махмуда",
                "Дворец Таш-Хаули"
            ]
        }
    ],
    kyrgyzstan: [
        {
            title: "Алматы и Большое Алматинское озеро",
            country: "Киргизстан",
            city: "Алматы",
            overview: "Исследуйте красоты Тянь-Шаня и посетите знаменитое высокогорное озеро",
            price: 130,
            duration: "1 день", 
            rating: 4.6,
            reviews: 203,
            highlights: [
                "Большое Алматинское озеро",
                "Панорамы Заилийского Алатау",
                "Горная обсерватория",
                "Альпийские луга"
            ]
        },
        {
            title: "Сон-Куль: озеро в облаках",
            country: "Киргизстан",
            city: "Нарын",
            overview: "Высокогорное озеро Сон-Куль на высоте 3000 метров - настоящая жемчужина Киргизстана",
            price: 190,
            duration: "2 дня",
            rating: 4.9,
            reviews: 67,
            highlights: [
                "Озеро Сон-Куль на высоте 3016 м",
                "Проживание в юртах пастухов",
                "Наблюдение за яками и лошадьми",
                "Звёздное небо высокогорья"
            ]
        }
    ],
    tajikistan: [
        {
            title: "Семь озёр Маргузор",
            country: "Таджикистан",
            city: "Пенджикент",
            overview: "Путешествие к каскаду из семи горных озёр с кристально чистой водой",
            price: 110,
            duration: "1 день",
            rating: 4.8,
            reviews: 134,
            highlights: [
                "Семь озёр разных оттенков",
                "Горные пейзажи Фанских гор",
                "Пешие прогулки по тропам",
                "Традиционные горные деревни"
            ]
        },
        {
            title: "Крепость Гиссар и водопады",
            country: "Таджикистан",
            city: "Гиссар",
            overview: "Исследуйте древнюю крепость Гиссар и насладитесь красотой горных водопадов",
            price: 85,
            duration: "6 часов",
            rating: 4.5,
            reviews: 89,
            highlights: [
                "Крепость Гиссар XVIII века",
                "Медресе и мавзолей",
                "Горные водопады",
                "Традиционный базар"
            ]
        }
    ],
    turkmenistan: [
        {
            title: "Мерв - древняя столица Великих Сельджуков",
            country: "Туркменистан",
            city: "Мары",
            overview: "Посетите руины древнего Мерва, одного из крупнейших городов средневекового мира",
            price: 200,
            duration: "1 день",
            rating: 4.4,
            reviews: 45,
            highlights: [
                "Руины древнего Мерва",
                "Мавзолей султана Санджара",
                "Крепость Большая Кыз-Кала",
                "Археологический музей"
            ]
        }
    ]
};

async function addCountryTours() {
    try {
        console.log('🌍 Добавляем туры по странам...');

        // Получаем блоки и категории
        const tourBlocks = await prisma.tourBlock.findMany();
        const categories = await prisma.category.findMany();

        console.log(`📦 Найдено блоков: ${tourBlocks.length}`);

        let totalAdded = 0;

        // Добавляем туры по Узбекистану
        const uzbekistanBlock = tourBlocks.find(b => JSON.parse(b.title).ru.includes('Узбекистан'));
        if (uzbekistanBlock) {
            for (const tourData of countryTours.uzbekistan) {
                const tour = await createTour(tourData, uzbekistanBlock.id, categories);
                console.log(`✅ Узбекистан: ${tourData.title}`);
                totalAdded++;
            }
        }

        // Добавляем туры по Киргизстану  
        const kyrgyzstanBlock = tourBlocks.find(b => JSON.parse(b.title).ru.includes('Киргизстан'));
        if (kyrgyzstanBlock) {
            for (const tourData of countryTours.kyrgyzstan) {
                const tour = await createTour(tourData, kyrgyzstanBlock.id, categories);
                console.log(`✅ Киргизстан: ${tourData.title}`);
                totalAdded++;
            }
        }

        // Добавляем туры по Таджикистану
        const tajikistanBlock = tourBlocks.find(b => JSON.parse(b.title).ru.includes('Таджикистан'));
        if (tajikistanBlock) {
            for (const tourData of countryTours.tajikistan) {
                const tour = await createTour(tourData, tajikistanBlock.id, categories);
                console.log(`✅ Таджикистан: ${tourData.title}`);
                totalAdded++;
            }
        }

        // Добавляем туры по Туркменистану
        const turkmenistanBlock = tourBlocks.find(b => JSON.parse(b.title).ru.includes('Туркменистан'));
        if (turkmenistanBlock) {
            for (const tourData of countryTours.turkmenistan) {
                const tour = await createTour(tourData, turkmenistanBlock.id, categories);
                console.log(`✅ Туркменистан: ${tourData.title}`);
                totalAdded++;
            }
        }

        // Показываем итоговую статистику
        const blocksWithTours = await prisma.tourBlock.findMany({
            include: {
                tours: true
            },
            orderBy: { sortOrder: 'asc' }
        });

        console.log('\n📊 ФИНАЛЬНАЯ СТРУКТУРА:');
        for (const block of blocksWithTours) {
            const blockTitle = JSON.parse(block.title).ru;
            console.log(`📦 ${blockTitle}: ${block.tours.length} туров`);
        }

        console.log(`\n🎉 Добавлено новых туров: ${totalAdded}`);
        console.log(`📈 Общее количество туров: ${await prisma.tour.count()}`);

    } catch (error) {
        console.error('❌ Ошибка добавления туров:', error);
    } finally {
        await prisma.$disconnect();
    }
}

async function createTour(tourData, tourBlockId, categories) {
    // Определяем категорию
    let categoryId = categories.find(c => JSON.parse(c.name).ru.includes('Исторические'))?.id || categories[0].id;
    
    if (tourData.title.includes('озер') || tourData.title.includes('Озер')) {
        categoryId = categories.find(c => JSON.parse(c.name).ru.includes('Озерные'))?.id || categoryId;
    }

    return await prisma.tour.create({
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
            price: `$${tourData.price}`,
            originalPrice: null,
            country: tourData.country,
            city: tourData.city,
            format: "Групповой",
            durationDays: tourData.duration.includes('2') ? 2 : 1,
            theme: "Культурно-исторический туризм",
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
            highlights: JSON.stringify(tourData.highlights),
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
                "Входные билеты"
            ]),
            excluded: JSON.stringify([
                "Личные расходы",
                "Чаевые"
            ]),
            requirements: JSON.stringify({
                "age": "18+",
                "fitness": "Средний уровень физической подготовки"
            }),
            difficulty: "Medium",
            rating: tourData.rating,
            reviewsCount: tourData.reviews,
            maxPeople: 15,
            minPeople: 2,
            location: JSON.stringify({
                "name": `${tourData.city}, ${tourData.country}`,
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
}

addCountryTours();