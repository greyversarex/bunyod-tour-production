const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

// Данные туров из sample-tour-data.js
const sampleTours = {
    pamir_highway: {
        "title": "Полный день: Памирское шоссе, горы и озёра",
        "location": "Памирские горы, Таджикистан",
        "rating": 4.8,
        "reviews_count": 234,
        "images": [
            "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop",
            "https://images.unsplash.com/photo-1464822759844-d150b377fc24?w=600&h=400&fit=crop",
            "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=600&h=400&fit=crop"
        ],
        "price_from": 120,
        "currency": "$",
        "duration": "6-7 часов",
        "overview": "Откройте для себя величественную красоту Памирских гор в этом незабываемом однодневном туре.",
        "highlights": [
            "Проезд по легендарному Памирскому шоссе",
            "Посещение высокогорных озёр с кристально чистой водой",
            "Панорамные виды на вершины свыше 7000 метров"
        ]
    },
    culture_dushanbe: {
        "title": "Культурный тур по Душанбе с посещением музеев",
        "location": "Душанбе, Таджикистан",
        "rating": 4.6,
        "reviews_count": 187,
        "price_from": 65,
        "currency": "$",
        "duration": "5-6 часов",
        "overview": "Познакомьтесь с культурой и историей столицы Таджикистана",
        "highlights": [
            "Национальный музей Таджикистана",
            "Дворец нации",
            "Флагшток и парк Рудаки"
        ]
    },
    iskanderkul: {
        "title": "Треккинг к озеру Искандеркуль",
        "location": "Фанские горы, Таджикистан", 
        "rating": 4.9,
        "reviews_count": 412,
        "price_from": 95,
        "currency": "$",
        "duration": "Полный день",
        "overview": "Поход к жемчужине Фанских гор - озеру Искандеркуль",
        "highlights": [
            "Треккинг по горным тропам",
            "Кристально чистое горное озеро",
            "Водопад Искандеркуль"
        ]
    },
    silk_road: {
        "title": "Шёлковый путь: древние города и крепости",
        "location": "Северный Таджикистан",
        "rating": 4.7,
        "reviews_count": 298,
        "price_from": 150,
        "currency": "$", 
        "duration": "2 дня",
        "overview": "Путешествие по следам Великого Шёлкового пути",
        "highlights": [
            "Древняя крепость Худжанд",
            "Археологические памятники",
            "Музей Шёлкового пути"
        ]
    }
};

async function migrateTours() {
    try {
        console.log('🚀 Начинаем миграцию туров...');

        // 1. Создаем блоки туров
        console.log('📦 Создаём блоки туров...');
        
        const tourBlocks = await Promise.all([
            prisma.tourBlock.create({
                data: {
                    title: JSON.stringify({"ru":"Рекомендуемые туры по Таджикистану","en":"Recommended Tours in Tajikistan"}),
                    description: JSON.stringify({"ru":"Лучшие туры для знакомства с Таджикистаном","en":"Best tours to discover Tajikistan"}),
                    slug: "recommended-tajikistan",
                    isActive: true,
                    sortOrder: 1
                }
            }),
            prisma.tourBlock.create({
                data: {
                    title: JSON.stringify({"ru":"Памирские приключения","en":"Pamir Adventures"}),
                    description: JSON.stringify({"ru":"Туры по Памирским горам и высокогорным озерам","en":"Tours through Pamir mountains and high-altitude lakes"}),
                    slug: "pamir-adventures",
                    isActive: true,
                    sortOrder: 2
                }
            }),
            prisma.tourBlock.create({
                data: {
                    title: JSON.stringify({"ru":"Культурно-исторические туры","en":"Cultural Historical Tours"}),
                    description: JSON.stringify({"ru":"Погружение в богатую историю и культуру региона","en":"Immersion in the rich history and culture of the region"}),
                    slug: "cultural-historical",
                    isActive: true,
                    sortOrder: 3
                }
            })
        ]);

        console.log('✅ Создано блоков туров:', tourBlocks.length);

        // 2. Получаем категории для привязки
        const categories = await prisma.category.findMany();
        console.log('📋 Найдено категорий:', categories.length);

        // 3. Создаем туры
        console.log('🏔️ Создаём туры...');
        
        const tours = [];
        let index = 0;
        
        for (const [key, tourData] of Object.entries(sampleTours)) {
            // Определяем блок и категорию для тура
            let tourBlockId = tourBlocks[0].id; // По умолчанию рекомендуемые
            let categoryId = categories[0].id; // По умолчанию первая категория
            
            if (key === 'pamir_highway') {
                tourBlockId = tourBlocks[1].id; // Памирские приключения  
                categoryId = categories.find(c => JSON.parse(c.name).ru.includes('Однодневные'))?.id || categoryId;
            } else if (key === 'culture_dushanbe' || key === 'silk_road') {
                tourBlockId = tourBlocks[2].id; // Культурно-исторические
                categoryId = categories.find(c => JSON.parse(c.name).ru.includes('Культурно'))?.id || categoryId;
            } else if (key === 'iskanderkul') {
                tourBlockId = tourBlocks[1].id; // Памирские приключения
                categoryId = categories.find(c => JSON.parse(c.name).ru.includes('Походы'))?.id || categoryId;
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
                    country: "Таджикистан",
                    city: tourData.location.split(',')[0].trim(),
                    format: "Групповой",
                    durationDays: tourData.duration.includes('день') ? (tourData.duration.includes('2') ? 2 : 1) : 1,
                    theme: "Природа и культура",
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    images: JSON.stringify(tourData.images || []),
                    mainImage: tourData.images?.[0] || null,
                    services: JSON.stringify([
                        "Трансфер",
                        "Гид",
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
                    reviewsCount: tourData.reviews_count,
                    maxPeople: 15,
                    minPeople: 2,
                    location: JSON.stringify({
                        "name": tourData.location,
                        "coordinates": null
                    }),
                    tags: JSON.stringify([
                        "Природа",
                        "Культура",
                        "Горы"
                    ]),
                    isActive: true,
                    isFeatured: index < 2, // Первые 2 тура делаем рекомендуемыми
                    categoryId: categoryId,
                    tourBlockId: tourBlockId
                }
            });
            
            tours.push(tour);
            console.log(`✅ Создан тур: ${tourData.title}`);
            index++;
        }

        console.log('🎉 Миграция завершена успешно!');
        console.log(`📊 Создано туров: ${tours.length}`);
        console.log(`📦 Создано блоков: ${tourBlocks.length}`);

    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Запускаем миграцию
migrateTours();