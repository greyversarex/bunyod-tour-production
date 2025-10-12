import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create default admin user (ENV-driven)
  const defaultPwd = process.env.ADMIN_DEFAULT_PASSWORD || 'admin12345';
  const defaultEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@bunyod-tour.tj';
  const hashedPassword = await bcrypt.hash(defaultPwd, 10);
  
  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {
      password: hashedPassword,
      email: defaultEmail,
      fullName: 'System Administrator',
      role: 'admin',
      isActive: true
    },
    create: {
      username: 'admin',
      email: defaultEmail,
      password: hashedPassword,
      fullName: 'System Administrator',
      role: 'admin',
      isActive: true
    }
  });
  console.log('✅ Default admin created/updated:', admin.username);

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

  // 5. Create categories (15 tourism categories - ONLY RU/EN, NO TJ)
  const categoriesData = [
    { type: 'tour', name: JSON.stringify({ ru: 'Однодневный', en: 'Day Tours' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Многодневный', en: 'Multi-day Tours' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Экскурсия', en: 'Excursions' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Городской', en: 'City Tours' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Природа/экологический', en: 'Nature/Ecological' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Культурно познавательный', en: 'Cultural & Educational' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Исторический', en: 'Historical' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Походы/треккинги', en: 'Hiking/Trekking' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Горные ландшафты', en: 'Mountain Landscapes' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Озерные ландшафты', en: 'Lake Landscapes' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Приключенческий', en: 'Adventure' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Гастрономический', en: 'Gastronomic' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Авто/сафари/джип', en: 'Auto/Safari/Jeep' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'Агротуризм', en: 'Agrotourism' }) },
    { type: 'tour', name: JSON.stringify({ ru: 'VIP', en: 'VIP' }) }
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

  // 6. Create tour blocks (ЖЕЛЕЗОБЕТОННО 7 БЛОКОВ - НЕ МЕНЯТЬ!)
  const tourBlocksData = [
    { 
      title: JSON.stringify({ ru: 'Популярные туры', en: 'Popular Tours' }),
      description: JSON.stringify({ ru: 'Самые популярные туристические направления', en: 'Most popular tourist destinations' }),
      slug: 'popular-tours',
      sortOrder: 1,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Комбинированные туры', en: 'Combined Tours' }),
      description: JSON.stringify({ ru: 'Комбинированные маршруты по нескольким странам', en: 'Combined routes across multiple countries' }),
      slug: 'combined-tours',
      sortOrder: 2,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Туры по Таджикистану', en: 'Tours in Tajikistan' }),
      description: JSON.stringify({ ru: 'Путешествия по Таджикистану', en: 'Travels in Tajikistan' }),
      slug: 'tours-tajikistan',
      sortOrder: 3,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Туры по Узбекистану', en: 'Tours in Uzbekistan' }),
      description: JSON.stringify({ ru: 'Путешествия по Узбекистану', en: 'Travels in Uzbekistan' }),
      slug: 'tours-uzbekistan',
      sortOrder: 4,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Туры по Казахстану', en: 'Tours in Kazakhstan' }),
      description: JSON.stringify({ ru: 'Путешествия по Казахстану', en: 'Travels in Kazakhstan' }),
      slug: 'tours-kazakhstan',
      sortOrder: 5,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Туры по Туркменистану', en: 'Tours in Turkmenistan' }),
      description: JSON.stringify({ ru: 'Путешествия по Туркменистану', en: 'Travels in Turkmenistan' }),
      slug: 'tours-turkmenistan',
      sortOrder: 6,
      isActive: true
    },
    { 
      title: JSON.stringify({ ru: 'Туры по Кыргызстану', en: 'Tours in Kyrgyzstan' }),
      description: JSON.stringify({ ru: 'Путешествия по Кыргызстану', en: 'Travels in Kyrgyzstan' }),
      slug: 'tours-kyrgyzstan',
      sortOrder: 7,
      isActive: true
    }
  ];

  // Upsert with ID enforcement
  for (let i = 0; i < tourBlocksData.length; i++) {
    await prisma.tourBlock.upsert({
      where: { id: i + 1 },
      update: {
        title: tourBlocksData[i].title,
        description: tourBlocksData[i].description,
        slug: tourBlocksData[i].slug,
        sortOrder: tourBlocksData[i].sortOrder,
        isActive: tourBlocksData[i].isActive
      },
      create: { 
        id: i + 1, 
        ...tourBlocksData[i] 
      }
    });
  }

  console.log('✅ Tour blocks created (7 IRON-CONCRETE blocks - unchangeable!)');

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
