const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createFrontendStructure() {
    try {
        console.log('🏗️ Создаём структуру блоков согласно фронтенду...');

        // Сначала удаляем существующие блоки (кроме связанных туров)
        await prisma.tour.updateMany({
            data: { tourBlockId: null }
        });
        await prisma.tourBlock.deleteMany({});

        // Создаём блоки согласно структуре фронтенда
        const tourBlocks = await Promise.all([
            // 1. Популярные туры
            prisma.tourBlock.create({
                data: {
                    title: JSON.stringify({
                        "ru": "Популярные туры",
                        "en": "Popular Tours"
                    }),
                    description: JSON.stringify({
                        "ru": "Самые востребованные туры нашей компании",
                        "en": "Most popular tours of our company"
                    }),
                    slug: "popular-tours",
                    isActive: true,
                    sortOrder: 1
                }
            }),

            // 2. Рекомендованные туры по Центральной Азии
            prisma.tourBlock.create({
                data: {
                    title: JSON.stringify({
                        "ru": "Рекомендованные туры по Центральной Азии",
                        "en": "Recommended Central Asia Tours"
                    }),
                    description: JSON.stringify({
                        "ru": "Лучшие туры для знакомства с Центральной Азией",
                        "en": "Best tours to discover Central Asia"
                    }),
                    slug: "recommended-central-asia",
                    isActive: true,
                    sortOrder: 2
                }
            }),

            // 3. Туры по Таджикистану
            prisma.tourBlock.create({
                data: {
                    title: JSON.stringify({
                        "ru": "Туры по Таджикистану",
                        "en": "Tours in Tajikistan"
                    }),
                    description: JSON.stringify({
                        "ru": "Откройте для себя красоты Таджикистана",
                        "en": "Discover the beauty of Tajikistan"
                    }),
                    slug: "tours-tajikistan",
                    isActive: true,
                    sortOrder: 3
                }
            }),

            // 4. Туры по Узбекистану
            prisma.tourBlock.create({
                data: {
                    title: JSON.stringify({
                        "ru": "Туры по Узбекистану",
                        "en": "Tours in Uzbekistan"
                    }),
                    description: JSON.stringify({
                        "ru": "Исследуйте древние города Великого Шёлкового пути",
                        "en": "Explore ancient cities of the Great Silk Road"
                    }),
                    slug: "tours-uzbekistan",
                    isActive: true,
                    sortOrder: 4
                }
            }),

            // 5. Туры по Киргизстану
            prisma.tourBlock.create({
                data: {
                    title: JSON.stringify({
                        "ru": "Туры по Киргизстану",
                        "en": "Tours in Kyrgyzstan"
                    }),
                    description: JSON.stringify({
                        "ru": "Горные приключения и кочевая культура",
                        "en": "Mountain adventures and nomadic culture"
                    }),
                    slug: "tours-kyrgyzstan",
                    isActive: true,
                    sortOrder: 5
                }
            }),

            // 6. Туры по Туркменистану
            prisma.tourBlock.create({
                data: {
                    title: JSON.stringify({
                        "ru": "Туры по Туркменистану",
                        "en": "Tours in Turkmenistan"
                    }),
                    description: JSON.stringify({
                        "ru": "Пустынные пейзажи и древние города",
                        "en": "Desert landscapes and ancient cities"
                    }),
                    slug: "tours-turkmenistan",
                    isActive: true,
                    sortOrder: 6
                }
            })
        ]);

        console.log('✅ Создано блоков туров:', tourBlocks.length);

        // Получаем все существующие туры для распределения по блокам
        const tours = await prisma.tour.findMany();
        console.log('📋 Найдено туров для распределения:', tours.length);

        // Распределяем туры по блокам согласно странам
        for (const tour of tours) {
            let targetBlockId = tourBlocks[0].id; // По умолчанию Популярные

            const tourTitle = JSON.parse(tour.title).ru.toLowerCase();
            const tourCountry = tour.country?.toLowerCase() || '';

            // Определяем блок по стране или содержанию
            if (tourCountry.includes('таджикистан') || tourTitle.includes('памир') || tourTitle.includes('душанбе')) {
                targetBlockId = tourBlocks[2].id; // Туры по Таджикистану
            } else if (tourCountry.includes('узбекистан') || tourTitle.includes('самарканд')) {
                targetBlockId = tourBlocks[3].id; // Туры по Узбекистану
            } else if (tourCountry.includes('киргизстан') || tourTitle.includes('иссык-куль')) {
                targetBlockId = tourBlocks[4].id; // Туры по Киргизстану
            } else if (tourCountry.includes('туркменистан') || tourTitle.includes('дарваза')) {
                targetBlockId = tourBlocks[5].id; // Туры по Туркменистану
            } else {
                // Если не определили страну, добавляем в Центральную Азию
                targetBlockId = tourBlocks[1].id;
            }

            // Если тур популярный (высокий рейтинг), дублируем его в Популярные
            if (tour.rating >= 4.8 || tour.isFeatured) {
                // Сначала добавляем в Популярные
                await prisma.tour.update({
                    where: { id: tour.id },
                    data: { tourBlockId: tourBlocks[0].id }
                });
                console.log(`✅ Тур "${JSON.parse(tour.title).ru}" добавлен в Популярные туры`);
            } else {
                // Добавляем в соответствующий блок по стране
                await prisma.tour.update({
                    where: { id: tour.id },
                    data: { tourBlockId: targetBlockId }
                });
                console.log(`✅ Тур "${JSON.parse(tour.title).ru}" добавлен в блок ${JSON.parse(tourBlocks.find(b => b.id === targetBlockId).title).ru}`);
            }
        }

        // Показываем итоговую статистику
        const blocksWithTours = await prisma.tourBlock.findMany({
            include: {
                tours: true
            }
        });

        console.log('\n📊 ИТОГОВАЯ СТРУКТУРА:');
        for (const block of blocksWithTours) {
            const blockTitle = JSON.parse(block.title).ru;
            console.log(`📦 ${blockTitle}: ${block.tours.length} туров`);
        }

        console.log('\n🎉 Структура фронтенда успешно создана!');

    } catch (error) {
        console.error('❌ Ошибка создания структуры:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createFrontendStructure();