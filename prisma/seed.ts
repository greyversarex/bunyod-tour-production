import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: JSON.stringify({
          en: 'Mountain',
          ru: 'Горные',
          tj: 'Кӯҳсорӣ'
        })
      }
    }),
    prisma.category.create({
      data: {
        name: JSON.stringify({
          en: 'Cultural',
          ru: 'Культурные',
          tj: 'Фарҳангӣ'
        })
      }
    }),
    prisma.category.create({
      data: {
        name: JSON.stringify({
          en: 'Adventure',
          ru: 'Приключенческие',
          tj: 'Таҷрибавӣ'
        })
      }
    }),
    prisma.category.create({
      data: {
        name: JSON.stringify({
          en: 'City',
          ru: 'Городские',
          tj: 'Шаҳрӣ'
        })
      }
    })
  ]);

  console.log('✅ Categories created');

  // Create tours with filter fields
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