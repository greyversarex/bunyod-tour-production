#!/usr/bin/env node

/**
 * Скрипт миграции данных: перенос существующих countryId/cityId в новые many-to-many таблицы
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateTourLocations() {
    console.log('🚀 Начинаем миграцию данных туров...');

    try {
        // Получаем все туры с существующими countryId и cityId
        const tours = await prisma.tour.findMany({
            where: {
                OR: [
                    { countryId: { not: null } },
                    { cityId: { not: null } }
                ]
            },
            select: {
                id: true,
                countryId: true,
                cityId: true,
                title: true
            }
        });

        console.log(`📋 Найдено ${tours.length} туров для миграции`);

        let countryMigrations = 0;
        let cityMigrations = 0;

        for (const tour of tours) {
            console.log(`\n🔄 Обрабатываем тур ID ${tour.id}: ${JSON.stringify(tour.title)}`);

            // Миграция страны
            if (tour.countryId) {
                // Проверяем, не существует ли уже связь
                const existingCountryLink = await prisma.tourCountry.findUnique({
                    where: {
                        tourId_countryId: {
                            tourId: tour.id,
                            countryId: tour.countryId
                        }
                    }
                });

                if (!existingCountryLink) {
                    await prisma.tourCountry.create({
                        data: {
                            tourId: tour.id,
                            countryId: tour.countryId,
                            isPrimary: true // Устанавливаем как основную для обратной совместимости
                        }
                    });
                    countryMigrations++;
                    console.log(`  ✅ Добавлена связь со страной ID ${tour.countryId} (основная)`);
                } else {
                    console.log(`  ⏩ Связь со страной ID ${tour.countryId} уже существует`);
                }
            }

            // Миграция города
            if (tour.cityId) {
                // Проверяем, не существует ли уже связь
                const existingCityLink = await prisma.tourCity.findUnique({
                    where: {
                        tourId_cityId: {
                            tourId: tour.id,
                            cityId: tour.cityId
                        }
                    }
                });

                if (!existingCityLink) {
                    await prisma.tourCity.create({
                        data: {
                            tourId: tour.id,
                            cityId: tour.cityId,
                            isPrimary: true // Устанавливаем как основной для обратной совместимости
                        }
                    });
                    cityMigrations++;
                    console.log(`  ✅ Добавлена связь с городом ID ${tour.cityId} (основной)`);
                } else {
                    console.log(`  ⏩ Связь с городом ID ${tour.cityId} уже существует`);
                }
            }
        }

        console.log(`\n🎉 Миграция завершена!`);
        console.log(`📊 Статистика:`);
        console.log(`  - Обработано туров: ${tours.length}`);
        console.log(`  - Создано связей со странами: ${countryMigrations}`);
        console.log(`  - Создано связей с городами: ${cityMigrations}`);

        // Проверяем результат
        const totalTourCountries = await prisma.tourCountry.count();
        const totalTourCities = await prisma.tourCity.count();
        
        console.log(`\n📈 Итого в новых таблицах:`);
        console.log(`  - Всего связей туров со странами: ${totalTourCountries}`);
        console.log(`  - Всего связей туров с городами: ${totalTourCities}`);

    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Запускаем миграцию если скрипт вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateTourLocations()
        .then(() => {
            console.log('✨ Миграция успешно завершена!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Ошибка выполнения миграции:', error);
            process.exit(1);
        });
}

export default migrateTourLocations;