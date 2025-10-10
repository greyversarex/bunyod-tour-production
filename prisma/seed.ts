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
    { currency: 'TJS', rate: 1.0, symbol: 'TJS', name: 'Tajik Somoni' },
    { currency: 'USD', rate: 0.094, symbol: '$', name: 'US Dollar' },
    { currency: 'EUR', rate: 0.086, symbol: '€', name: 'Euro' },
    { currency: 'RUB', rate: 9.2, symbol: '₽', name: 'Russian Ruble' },
    { currency: 'CNY', rate: 0.68, symbol: '¥', name: 'Chinese Yuan' }
  ];

  for (const curr of currencies) {
    await prisma.exchangeRate.upsert({
      where: { currency: curr.currency },
      update: { rate: curr.rate },
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

  // 5. Create categories (idempotent)
  const categoriesData = [
    { type: 'tour', name: JSON.stringify({ en: 'Mountain', ru: 'Горные', tj: 'Кӯҳсорӣ' }) },
    { type: 'tour', name: JSON.stringify({ en: 'Cultural', ru: 'Культурные', tj: 'Фарҳангӣ' }) },
    { type: 'tour', name: JSON.stringify({ en: 'Adventure', ru: 'Приключенческие', tj: 'Таҷрибавӣ' }) },
    { type: 'tour', name: JSON.stringify({ en: 'City', ru: 'Городские', tj: 'Шаҳрӣ' }) }
  ];

  const categories: any[] = [];
  for (let i = 0; i < categoriesData.length; i++) {
    const cat = await prisma.category.upsert({
      where: { id: i + 1 },
      update: {},
      create: { id: i + 1, ...categoriesData[i] }
    });
    categories.push(cat);
  }

  console.log('✅ Categories created');

  // 6. Create sample tours (only if none exist)
  const existingToursCount = await prisma.tour.count();
  
  if (existingToursCount > 0) {
    console.log('✅ Tours already exist, skipping sample tours creation');
  } else {
    const tours = [
    {
      title: JSON.stringify({
        en: 'Pamir Highway Adventure',
        ru: 'Памирское шоссе'
      }),
      description: JSON.stringify({
        en: 'Epic journey through one of the world\'s highest mountain roads',
        ru: 'Захватывающее путешествие по одной из самых высокогорных дорог мира'
      }),
      duration: '7 days',
      price: '299',
      country: 'Таджикистан',
      city: 'Душанбе',
      format: 'Групповой',
      durationDays: 7,
      theme: 'Горные маршруты',
      startDate: '2025-06-01',
      endDate: '2025-09-30',
      categoryId: categories[0].id
    },
    {
      title: JSON.stringify({
        en: 'Iskanderkul Lake Tour',
        ru: 'Озеро Искандеркуль'
      }),
      description: JSON.stringify({
        en: 'Beautiful mountain lake surrounded by snow-capped peaks',
        ru: 'Живописное горное озеро в окружении заснеженных пиков'
      }),
      duration: '2 days',
      price: '149',
      country: 'Таджикистан',
      city: 'Душанбе',
      format: 'Индивидуальный',
      durationDays: 2,
      theme: 'Озёрные маршруты',
      startDate: '2025-05-15',
      endDate: '2025-10-15',
      categoryId: categories[0].id
    },
    {
      title: JSON.stringify({
        en: 'Ancient Penjikent',
        ru: 'Древний Пенджикент'
      }),
      description: JSON.stringify({
        en: 'Explore ruins of ancient Sogdian city and Rudaki Museum',
        ru: 'Исследуйте руины древнего согдийского города и музей Рудаки'
      }),
      duration: '1 day',
      price: '89',
      country: 'Таджикистан',
      city: 'Худжанд',
      format: 'Групповой',
      durationDays: 1,
      theme: 'Исторический тур',
      startDate: '2025-04-01',
      endDate: '2025-11-30',
      categoryId: categories[1].id
    },
    {
      title: JSON.stringify({
        en: 'Dushanbe City Tour',
        ru: 'Обзор Душанбе'
      }),
      description: JSON.stringify({
        en: 'Cultural tour of Tajikistan\'s capital',
        ru: 'Культурный тур по столице Таджикистана'
      }),
      duration: '1 day',
      price: '75',
      country: 'Таджикистан',
      city: 'Душанбе',
      format: 'VIP',
      durationDays: 1,
      theme: 'Обзорная экскурсия',
      startDate: '2025-03-01',
      endDate: '2025-12-31',
      categoryId: categories[3].id
    },
    {
      title: JSON.stringify({
        en: 'Samarkand Heritage',
        ru: 'Наследие Самарканда'
      }),
      description: JSON.stringify({
        en: 'UNESCO World Heritage sites in ancient Samarkand',
        ru: 'Объекты всемирного наследия ЮНЕСКО в древнем Самарканде'
      }),
      duration: '3 days',
      price: '220',
      country: 'Узбекистан',
      city: 'Самарканд',
      format: 'Групповой',
      durationDays: 3,
      theme: 'Исторический тур',
      startDate: '2025-04-15',
      endDate: '2025-10-30',
      categoryId: categories[1].id
    },
    {
      title: JSON.stringify({
        en: 'Tashkent Modern Tour',
        ru: 'Современный Ташкент'
      }),
      description: JSON.stringify({
        en: 'Discover the modern capital of Uzbekistan',
        ru: 'Откройте для себя современную столицу Узбекистана'
      }),
      duration: '2 days',
      price: '180',
      country: 'Узбекистан',
      city: 'Ташкент',
      format: 'Индивидуальный',
      durationDays: 2,
      theme: 'Обзорная экскурсия',
      startDate: '2025-03-15',
      endDate: '2025-11-15',
      categoryId: categories[3].id
    },
    {
      title: JSON.stringify({
        en: 'Bishkek Nature Trek',
        ru: 'Треккинг вокруг Бишкека'
      }),
      description: JSON.stringify({
        en: 'Hiking adventure in Kyrgyzstan\'s beautiful mountains',
        ru: 'Пешие походы в красивых горах Киргизстана'
      }),
      duration: '5 days',
      price: '195',
      country: 'Киргизстан',
      city: 'Бишкек',
      format: 'Групповой',
      durationDays: 5,
      theme: 'Походы / треккинг',
      startDate: '2025-06-01',
      endDate: '2025-09-15',
      categoryId: categories[2].id
    },
    {
      title: JSON.stringify({
        en: 'Central Asia Grand Tour',
        ru: 'Большой тур по Центральной Азии'
      }),
      description: JSON.stringify({
        en: 'Epic 14-day journey across multiple countries',
        ru: 'Эпическое 14-дневное путешествие по нескольким странам'
      }),
      duration: '14 days',
      price: '899',
      country: 'Таджикистан',
      city: 'Душанбе',
      format: 'VIP',
      durationDays: 14,
      theme: 'Комбинированный тур по Центральной Азии',
      startDate: '2025-07-01',
      endDate: '2025-08-31',
      categoryId: categories[2].id
    },
    {
      title: JSON.stringify({
        en: 'Almaty Mountain Adventure',
        ru: 'Горное приключение в Алматы'
      }),
      description: JSON.stringify({
        en: 'Explore the mountains around Kazakhstan\'s former capital',
        ru: 'Исследуйте горы вокруг бывшей столицы Казахстана'
      }),
      duration: '4 days',
      price: '250',
      country: 'Казахстан',
      city: 'Алматы',
      format: 'Групповой',
      durationDays: 4,
      theme: 'Горные маршруты',
      startDate: '2025-05-01',
      endDate: '2025-09-30',
      categoryId: categories[0].id
    },
    {
      title: JSON.stringify({
        en: 'Wellness Retreat Tajikistan',
        ru: 'Оздоровительный отдых в Таджикистане'
      }),
      description: JSON.stringify({
        en: 'Relaxing spa and wellness experience in mountain resorts',
        ru: 'Расслабляющий спа и оздоровительный отдых в горных курортах'
      }),
      duration: '6 days',
      price: '320',
      country: 'Таджикистан',
      city: 'Хорог',
      format: 'VIP',
      durationDays: 6,
      theme: 'Санаторно-оздоровительный тур',
      startDate: '2025-06-15',
      endDate: '2025-09-15',
      categoryId: categories[2].id
    }
  ];

    // Create tours
    await Promise.all(
      tours.map(tour => prisma.tour.create({ data: tour }))
    );

    console.log('✅ Tours created');
  }
  
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