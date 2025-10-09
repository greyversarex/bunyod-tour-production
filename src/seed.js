const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedCategories() {
    console.log('🌱 Создание базовых категорий...');

    const categories = [
        { name: JSON.stringify({ ru: 'Однодневные', en: 'Day', tj: 'Якрӯза' }) },
        { name: JSON.stringify({ ru: 'Многодневные', en: 'Multi-day', tj: 'Чандрӯза' }) },
        { name: JSON.stringify({ ru: 'Экскурсии', en: 'Excursions', tj: 'Экскурсияҳо' }) },
        { name: JSON.stringify({ ru: 'Городские', en: 'City', tj: 'Шаҳрӣ' }) },
        { name: JSON.stringify({ ru: 'Природа/экологические', en: 'Nature/Ecological', tj: 'Табиат/экологӣ' }) },
        { name: JSON.stringify({ ru: 'Культурно познавательные', en: 'Cultural & Educational', tj: 'Фарҳангӣ' }) },
        { name: JSON.stringify({ ru: 'Исторические', en: 'Historical', tj: 'Таърихӣ' }) },
        { name: JSON.stringify({ ru: 'Походы/треккинги', en: 'Hiking/Trekking', tj: 'Треккинг' }) },
        { name: JSON.stringify({ ru: 'Горные ландшафты', en: 'Mountain Landscapes', tj: 'Кӯҳсорӣ' }) },
        { name: JSON.stringify({ ru: 'Озерные ландшафты', en: 'Lake Landscapes', tj: 'Кӯлҳо' }) },
        { name: JSON.stringify({ ru: 'Приключенческие', en: 'Adventure', tj: 'Таҷрибавӣ' }) },
        { name: JSON.stringify({ ru: 'Гастрономические', en: 'Gastronomic', tj: 'Гастрономӣ' }) },
        { name: JSON.stringify({ ru: 'Авто/сафари/джип', en: 'Auto/Safari/Jeep', tj: 'Автосафарӣ' }) },
        { name: JSON.stringify({ ru: 'Агротуризм', en: 'Agrotourism', tj: 'Агросайёҳат' }) },
        { name: JSON.stringify({ ru: 'VIP', en: 'VIP', tj: 'VIP' }) }
    ];

    for (const category of categories) {
        try {
            await prisma.category.create({
                data: category
            });
        } catch (error) {
            // Ignore if already exists
            console.log(`Категория уже существует: ${category.name}`);
        }
    }

    console.log('✅ Базовые категории созданы');
}

async function seedTourBlocks() {
    console.log('🌱 Создание блоков туров...');
    
    const tourBlocks = [
        {
            title: JSON.stringify({ ru: 'Популярные туры', en: 'Popular Tours', tj: 'Туризми машҳур' }),
            description: JSON.stringify({ ru: 'Самые популярные туры', en: 'Most popular tours', tj: 'Туризми хеле машҳур' }),
            slug: 'popular-tours'
        },
        {
            title: JSON.stringify({ ru: 'Рекомендованные туры по Центральной Азии', en: 'Recommended Central Asia Tours', tj: 'Туризми тавсияшуда' }),
            description: JSON.stringify({ ru: 'Лучшие туры по региону', en: 'Best regional tours', tj: 'Беhtарин туризм' }),
            slug: 'recommended-tours'
        },
        {
            title: JSON.stringify({ ru: 'Туры по Таджикистану', en: 'Tajikistan Tours', tj: 'Туризм дар Тоҷикистон' }),
            description: JSON.stringify({ ru: 'Путешествия по Таджикистану', en: 'Traveling in Tajikistan', tj: 'Сафар дар Тоҷикистон' }),
            slug: 'tajikistan-tours'
        },
        {
            title: JSON.stringify({ ru: 'Туры по Узбекистану', en: 'Uzbekistan Tours', tj: 'Туризм дар Ӯзбакистон' }),
            description: JSON.stringify({ ru: 'Путешествия по Узбекистану', en: 'Traveling in Uzbekistan', tj: 'Сафар дар Ӯзбакистон' }),
            slug: 'uzbekistan-tours'
        },
        {
            title: JSON.stringify({ ru: 'Туры по Киргизстану', en: 'Kyrgyzstan Tours', tj: 'Туризм дар Қирғизистон' }),
            description: JSON.stringify({ ru: 'Путешествия по Киргизстану', en: 'Traveling in Kyrgyzstan', tj: 'Сафар дар Қирғизистон' }),
            slug: 'kyrgyzstan-tours'
        },
        {
            title: JSON.stringify({ ru: 'Туры по Туркменистану', en: 'Turkmenistan Tours', tj: 'Туризм дар Туркманистон' }),
            description: JSON.stringify({ ru: 'Путешествия по Туркменистану', en: 'Traveling in Turkmenistan', tj: 'Сафар дар Туркманистон' }),
            slug: 'turkmenistan-tours'
        }
    ];

    for (const block of tourBlocks) {
        try {
            await prisma.tourBlock.create({
                data: block
            });
        } catch (error) {
            console.log(`Блок уже существует: ${block.slug}`);
        }
    }

    console.log('✅ Блоки туров созданы');
}

async function seedAdminUser() {
    console.log('🌱 Создание администратора...');
    
    try {
        await prisma.admin.create({
            data: {
                username: 'admin',
                email: 'admin@bunyod-tour.com',
                password: '$2a$10$xVp9ZF5PqOPqbxCaKsYI5OZOeIzB8lw9QlBXj5VaOLzJcwV6VLg1G', // "admin123"
                fullName: 'Administrator',
                role: 'admin'
            }
        });
        console.log('✅ Администратор создан (логин: admin, пароль: admin123)');
    } catch (error) {
        console.log('Администратор уже существует');
    }
}

async function main() {
    try {
        await seedCategories();
        await seedTourBlocks();
        await seedAdminUser();
        console.log('🎉 Seed данные успешно созданы!');
    } catch (error) {
        console.error('Ошибка при создании seed данных:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();