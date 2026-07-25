const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const countriesData = [
  {
    name: 'Tajikistan',
    nameRu: 'Таджикистан',
    nameEn: 'Tajikistan', 
    code: 'TJ',
    cities: [
      {
        name: 'Dushanbe',
        nameRu: 'Душанбе',
        nameEn: 'Dushanbe'
      },
      {
        name: 'Khujand',
        nameRu: 'Худжанд',
        nameEn: 'Khujand'
      },
      {
        name: 'Khorog',
        nameRu: 'Хорог',
        nameEn: 'Khorog'
      }
    ]
  },
  {
    name: 'Uzbekistan',
    nameRu: 'Узбекистан',
    nameEn: 'Uzbekistan',
    code: 'UZ',
    cities: [
      {
        name: 'Tashkent',
        nameRu: 'Ташкент',
        nameEn: 'Tashkent'
      },
      {
        name: 'Samarkand',
        nameRu: 'Самарканд',
        nameEn: 'Samarkand'
      },
      {
        name: 'Bukhara',
        nameRu: 'Бухара',
        nameEn: 'Bukhara'
      }
    ]
  },
  {
    name: 'Kyrgyzstan',
    nameRu: 'Кыргызстан',
    nameEn: 'Kyrgyzstan',
    code: 'KG',
    cities: [
      {
        name: 'Bishkek',
        nameRu: 'Бишкек',
        nameEn: 'Bishkek'
      }
    ]
  },
  {
    name: 'Kazakhstan',
    nameRu: 'Казахстан',
    nameEn: 'Kazakhstan',
    code: 'KZ',
    cities: [
      {
        name: 'Astana',
        nameRu: 'Астана',
        nameEn: 'Astana'
      },
      {
        name: 'Almaty',
        nameRu: 'Алматы',
        nameEn: 'Almaty'
      }
    ]
  },
  {
    name: 'Turkmenistan',
    nameRu: 'Туркменистан',
    nameEn: 'Turkmenistan',
    code: 'TM',
    cities: [
      {
        name: 'Ashgabat',
        nameRu: 'Ашхабад',
        nameEn: 'Ashgabat'
      }
    ]
  }
];

async function seedCountriesAndCities() {
  console.log('🌍 Создание стран и городов Центральной Азии...');
  
  try {
    for (const countryData of countriesData) {
      console.log(`📍 Создание страны: ${countryData.nameRu}`);
      
      // Проверяем, существует ли страна
      const existingCountry = await prisma.country.findUnique({
        where: { code: countryData.code }
      });
      
      let country;
      if (existingCountry) {
        console.log(`   ✅ Страна ${countryData.nameRu} уже существует`);
        country = existingCountry;
      } else {
        // Создаем страну
        country = await prisma.country.create({
          data: {
            name: countryData.name,
            nameRu: countryData.nameRu,
            nameEn: countryData.nameEn,
            code: countryData.code,
            isActive: true
          }
        });
        console.log(`   ✅ Страна ${countryData.nameRu} создана`);
      }
      
      // Создаем города для этой страны
      for (const cityData of countryData.cities) {
        const existingCity = await prisma.city.findFirst({
          where: {
            nameRu: cityData.nameRu,
            countryId: country.id
          }
        });
        
        if (existingCity) {
          console.log(`   🏙️ Город ${cityData.nameRu} уже существует`);
        } else {
          const city = await prisma.city.create({
            data: {
              name: cityData.name,
              nameRu: cityData.nameRu,
              nameEn: cityData.nameEn,
              countryId: country.id,
              isActive: true
            }
          });
          console.log(`   🏙️ Город ${cityData.nameRu} создан`);
        }
      }
    }
    
    console.log('🎉 Все страны и города Центральной Азии созданы успешно!');
    
    // Показать статистику
    const countriesCount = await prisma.country.count();
    const citiesCount = await prisma.city.count();
    
    console.log(`📊 Статистика:`);
    console.log(`   Стран: ${countriesCount}`);
    console.log(`   Городов: ${citiesCount}`);
    
  } catch (error) {
    console.error('❌ Ошибка при создании стран и городов:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем, если файл вызывается напрямую
if (require.main === module) {
  seedCountriesAndCities()
    .then(() => {
      console.log('✅ Seed выполнен успешно!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка при выполнении seed:', error);
      process.exit(1);
    });
}

module.exports = { seedCountriesAndCities };