const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTourBlocks() {
  console.log('🎯 Creating tour blocks...');

  const tourBlocks = [
    {
      title: JSON.stringify({ ru: "Популярные туры", en: "Popular Tours" }),
      description: JSON.stringify({ ru: "Самые популярные туристические направления", en: "Most popular tourist destinations" }),
      slug: "popular-tours",
      sortOrder: 1
    },
    {
      title: JSON.stringify({ ru: "Комбинированные туры по Центральной Азии", en: "Combined Tours in Central Asia" }),
      description: JSON.stringify({ ru: "Лучшие маршруты по странам Центральной Азии", en: "Best routes through Central Asian countries" }),
      slug: "combined-central-asia",
      sortOrder: 2
    },
    {
      title: JSON.stringify({ ru: "Туры по Таджикистану", en: "Tours in Tajikistan" }),
      description: JSON.stringify({ ru: "Путешествия по Таджикистану", en: "Travel through Tajikistan" }),
      slug: "tours-tajikistan",
      sortOrder: 3
    },
    {
      title: JSON.stringify({ ru: "Туры по Узбекистану", en: "Tours in Uzbekistan" }),
      description: JSON.stringify({ ru: "Путешествия по Узбекистану", en: "Travel through Uzbekistan" }),
      slug: "tours-uzbekistan",
      sortOrder: 4
    },
    {
      title: JSON.stringify({ ru: "Туры по Киргизстану", en: "Tours in Kyrgyzstan" }),
      description: JSON.stringify({ ru: "Путешествия по Киргизстану", en: "Travel through Kyrgyzstan" }),
      slug: "tours-kyrgyzstan",
      sortOrder: 5
    },
    {
      title: JSON.stringify({ ru: "Туры по Казахстану", en: "Tours in Kazakhstan" }),
      description: JSON.stringify({ ru: "Путешествия по Казахстану", en: "Travel through Kazakhstan" }),
      slug: "tours-kazakhstan",
      sortOrder: 6
    },
    {
      title: JSON.stringify({ ru: "Туры по Туркменистану", en: "Tours in Turkmenistan" }),
      description: JSON.stringify({ ru: "Путешествия по Туркменистану", en: "Travel through Turkmenistan" }),
      slug: "tours-turkmenistan",
      sortOrder: 7
    }
  ];

  for (const blockData of tourBlocks) {
    const tourBlock = await prisma.tourBlock.create({
      data: blockData
    });
    console.log(`✅ Created tour block: ${JSON.parse(tourBlock.title).ru}`);
  }

  // Назначим существующие туры к блокам
  const tours = await prisma.tour.findMany({
    select: { id: true, country: true, title: true }
  });

  for (const tour of tours) {
    let blockId = null;
    const country = tour.country;
    
    if (country === "Таджикистан") {
      blockId = 3; // Туры по Таджикистану
    } else if (country === "Узбекистан") {
      blockId = 4; // Туры по Узбекистану
    } else if (country === "Киргизстан") {
      blockId = 5; // Туры по Киргизстану
    } else if (country === "Казахстан") {
      blockId = 6; // Туры по Казахстану
    } else if (country === "Туркменистан") {
      blockId = 7; // Туры по Туркменистану
    } else {
      blockId = 2; // Комбинированные туры по Центральной Азии
    }

    // Назначение туров к блокам через TourBlockAssignment
    await prisma.tourBlockAssignment.create({
      data: {
        tourId: tour.id,
        tourBlockId: blockId,
        isPrimary: true
      }
    });

    console.log(`📍 Assigned tour ${JSON.parse(tour.title).ru} to block ${blockId}`);
  }

  console.log('🎉 Tour blocks setup completed!');
  await prisma.$disconnect();
}

createTourBlocks().catch(console.error);