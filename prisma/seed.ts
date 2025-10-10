import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create default admin user
  const hashedPassword = await bcrypt.hash('admin12345', 10);
  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@bunyod-tour.tj',
      password: hashedPassword,
      fullName: 'System Administrator',
      role: 'admin',
      isActive: true
    }
  });
  console.log('✅ Default admin created:', admin.username);

  // 2. Create exchange rates (currencies)
  const currencies = [
    { currency: 'TJS', rate: 1.0, symbol: 'с.', name: 'Сомони' },
    { currency: 'USD', rate: 0.094, symbol: '$', name: 'Доллар США' },
    { currency: 'EUR', rate: 0.086, symbol: '€', name: 'Евро' },
    { currency: 'RUB', rate: 9.2, symbol: '₽', name: 'Российский рубль' },
    { currency: 'CNY', rate: 0.65, symbol: '¥', name: 'Китайский юань' }
  ];

  for (const curr of currencies) {
    await prisma.exchangeRate.upsert({
      where: { currency: curr.currency },
      update: { rate: curr.rate, symbol: curr.symbol, name: curr.name },
      create: curr
    });
  }
  console.log('✅ Exchange rates created');

  // 3. Create countries
  const countriesData = [
    { name: 'Таджикистан', nameRu: 'Таджикистан', nameEn: 'Tajikistan', code: 'TJ' },
    { name: 'Узбекистан', nameRu: 'Узбекистан', nameEn: 'Uzbekistan', code: 'UZ' },
    { name: 'Киргизстан', nameRu: 'Киргизстан', nameEn: 'Kyrgyzstan', code: 'KG' },
    { name: 'Казахстан', nameRu: 'Казахстан', nameEn: 'Kazakhstan', code: 'KZ' },
    { name: 'Туркменистан', nameRu: 'Туркменистан', nameEn: 'Turkmenistan', code: 'TM' }
  ];

  const countries: any[] = [];
  for (const country of countriesData) {
    const created = await prisma.country.upsert({
      where: { code: country.code },
      update: {},
      create: country
    });
    countries.push(created);
  }
  console.log('✅ Countries created');

  // 4. Create cities
  const citiesData = [
    // Tajikistan
    { name: 'Душанбе', nameRu: 'Душанбе', nameEn: 'Dushanbe', countryCode: 'TJ' },
    { name: 'Худжанд', nameRu: 'Худжанд', nameEn: 'Khujand', countryCode: 'TJ' },
    { name: 'Хорог', nameRu: 'Хорог', nameEn: 'Khorog', countryCode: 'TJ' },
    { name: 'Куляб', nameRu: 'Куляб', nameEn: 'Kulob', countryCode: 'TJ' },
    // Uzbekistan
    { name: 'Ташкент', nameRu: 'Ташкент', nameEn: 'Tashkent', countryCode: 'UZ' },
    { name: 'Самарканд', nameRu: 'Самарканд', nameEn: 'Samarkand', countryCode: 'UZ' },
    { name: 'Бухара', nameRu: 'Бухара', nameEn: 'Bukhara', countryCode: 'UZ' },
    // Kyrgyzstan
    { name: 'Бишкек', nameRu: 'Бишкек', nameEn: 'Bishkek', countryCode: 'KG' },
    { name: 'Ош', nameRu: 'Ош', nameEn: 'Osh', countryCode: 'KG' },
    // Kazakhstan
    { name: 'Алматы', nameRu: 'Алматы', nameEn: 'Almaty', countryCode: 'KZ' },
    { name: 'Астана', nameRu: 'Астана', nameEn: 'Astana', countryCode: 'KZ' }
  ];

  for (const city of citiesData) {
    const country = countries.find(c => c.code === city.countryCode);
    if (country) {
      await prisma.city.upsert({
        where: { 
          name_countryId: {
            name: city.name,
            countryId: country.id
          }
        },
        update: {},
        create: {
          name: city.name,
          nameRu: city.nameRu,
          nameEn: city.nameEn,
          countryId: country.id
        }
      });
    }
  }
  console.log('✅ Cities created');

  // 5. Create categories (15 tourism categories)
  const categoriesData = [
    { type: 'tour', name: JSON.stringify({ ru: 'Однодневные', en: 'Day', tj: 'Якрӯза' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Многодневные', en: 'Multi-day', tj: 'Чандрӯза' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Экскурсии', en: 'Excursions', tj: 'Экскурсияҳо' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Городские', en: 'City', tj: 'Шаҳрӣ' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Природа/экологические', en: 'Nature/Ecological', tj: 'Табиат/экологӣ' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Культурно познавательные', en: 'Cultural & Educational', tj: 'Фарҳангӣ' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Исторические', en: 'Historical', tj: 'Таърихӣ' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Походы/треккинги', en: 'Hiking/Trekking', tj: 'Треккинг' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Горные ландшафты', en: 'Mountain Landscapes', tj: 'Кӯҳсорӣ' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Озерные ландшафты', en: 'Lake Landscapes', tj: 'Кӯлҳо' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Приключенческие', en: 'Adventure', tj: 'Таҷрибавӣ' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Гастрономические', en: 'Gastronomic', tj: 'Гастрономӣ' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Авто/сафари/джип', en: 'Auto/Safari/Jeep', tj: 'Автосафарӣ' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Агротуризм', en: 'Agrotourism', tj: 'Агросайёҳат' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'VIP', en: 'VIP', tj: 'VIP' }) }
  ];

  const categories: any[] = [];
  for (let i = 0; i < categoriesData.length; i++) {
    const cat = await prisma.category.upsert({
      where: { id: i + 1 },
      update: {
        type: categoriesData[i].type,
        name: categoriesData[i].name
      },
      create: { id: i + 1, ...categoriesData[i] }
    });
    categories.push(cat);
  }

  console.log('✅ Categories created (15 types)');

  // 6. Create tour blocks (6 main blocks for homepage)
  const tourBlocksData = [
    { 
      title: JSON.stringify({ ru: 'Популярные туры', en: 'Popular Tours' }),
      description: JSON.stringify({ ru: 'Самые популярные туристические направления', en: 'Most popular tourist destinations' }),
      slug: 'popular-tours',
      sortOrder: 1,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Горные приключения', en: 'Mountain Adventures' }),
      description: JSON.stringify({ ru: 'Захватывающие горные туры и треккинг', en: 'Exciting mountain tours and trekking' }),
      slug: 'mountain-adventures',
      sortOrder: 2,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Культурное наследие', en: 'Cultural Heritage' }),
      description: JSON.stringify({ ru: 'Исторические и культурные туры', en: 'Historical and cultural tours' }),
      slug: 'cultural-heritage',
      sortOrder: 3,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Экскурсии', en: 'Excursions' }),
      description: JSON.stringify({ ru: 'Однодневные и многодневные экскурсии', en: 'Day and multi-day excursions' }),
      slug: 'excursions',
      sortOrder: 4,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Семейный отдых', en: 'Family Tours' }),
      description: JSON.stringify({ ru: 'Туры для всей семьи', en: 'Tours for the whole family' }),
      slug: 'family-tours',
      sortOrder: 5,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'VIP туры', en: 'VIP Tours' }),
      description: JSON.stringify({ ru: 'Премиум туры с индивидуальным обслуживанием', en: 'Premium tours with personalized service' }),
      slug: 'vip-tours',
      sortOrder: 6,
      isActive: true
    }
  ];

  for (const block of tourBlocksData) {
    await prisma.tourBlock.upsert({
      where: { slug: block.slug },
      update: {},
      create: block
    });
  }

  console.log('✅ Tour blocks created (6 blocks)');

  // 7. Sample tours removed - users will create their own tours
  console.log('✅ Seed completed - no demo tours created');
  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
