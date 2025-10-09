const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedData() {
  try {
    console.log('🌱 Seeding hotels and guides...');

    // Seed hotels
    const hotels = await prisma.hotel.createMany({
      data: [
        {
          name: JSON.stringify({
            en: "Serena Hotel Dushanbe",
            ru: "Серена Отель Душанбе"
          }),
          description: JSON.stringify({
            en: "Luxury 5-star hotel in the heart of Dushanbe",
            ru: "Роскошный 5-звездочный отель в центре Душанбе"
          }),
          address: 'Ismaili Samani Avenue 14, Dushanbe',
          rating: 5.0,
          amenities: JSON.stringify(['Wi-Fi', 'Spa', 'Pool', 'Restaurant', 'Airport Transfer']),
          isActive: true
        },
        {
          name: JSON.stringify({
            en: "Hyatt Regency Dushanbe", 
            ru: "Хаятт Ридженси Душанбе"
          }),
          description: JSON.stringify({
            en: "Modern international hotel with mountain views",
            ru: "Современный международный отель с видом на горы"
          }),
          address: 'Ismaili Samani Avenue 26/1, Dushanbe',
          rating: 5.0,
          amenities: JSON.stringify(['Wi-Fi', 'Fitness Center', 'Business Center', 'Room Service']),
          isActive: true
        },
        {
          name: JSON.stringify({
            en: "Tajikistan Hotel",
            ru: "Отель Таджикистан"
          }),
          description: JSON.stringify({
            en: "Classic Soviet-era hotel in central Dushanbe",
            ru: "Классический отель советской эпохи в центре Душанбе"
          }),
          address: 'Shotemur Street 22, Dushanbe',
          rating: 3.5,
          amenities: JSON.stringify(['Wi-Fi', 'Restaurant', 'Conference Room']),
          isActive: true
        },
        {
          name: JSON.stringify({
            en: "Pamir Lodge",
            ru: "Памир Лодж"
          }),
          description: JSON.stringify({
            en: "Mountain guesthouse in Khorog with stunning Pamir views",
            ru: "Горный гостевой дом в Хороге с потрясающими видами на Памир"
          }),
          address: 'Lenin Street 15, Khorog',
          rating: 4.2,
          amenities: JSON.stringify(['Wi-Fi', 'Mountain Views', 'Traditional Cuisine', 'Hiking Guides']),
          isActive: true
        }
      ]
    });

    console.log(`✅ Created ${hotels.count} hotels`);

    // Seed guides
    const guides = await prisma.guide.createMany({
      data: [
        {
          name: JSON.stringify({
            en: "Aziz Rahimov",
            ru: "Азиз Рахимов"
          }),
          description: JSON.stringify({
            en: "Professional mountain guide with 15 years of experience in Pamir Mountains",
            ru: "Профессиональный горный гид с 15-летним опытом работы в горах Памира"
          }),
          languages: JSON.stringify(['Russian', 'English', 'Tajik']),
          contact: JSON.stringify({
            phone: '+992987654321',
            email: 'aziz@pamirguides.tj'
          }),
          experience: 15,
          rating: 4.9,
          isActive: true
        },
        {
          name: JSON.stringify({
            en: "Farida Mahmudova",
            ru: "Фарида Махмудова"
          }),
          description: JSON.stringify({
            en: "Cultural heritage specialist and city tour expert for Dushanbe and Samarkand",
            ru: "Специалист по культурному наследию и эксперт городских туров по Душанбе и Самарканду"
          }),
          languages: JSON.stringify(['Russian', 'English', 'Tajik', 'Uzbek']),
          contact: JSON.stringify({
            phone: '+992912345678',
            email: 'farida@cultureguides.tj'
          }),
          experience: 12,
          rating: 4.8,
          isActive: true
        },
        {
          name: JSON.stringify({
            en: "Rustam Kholikov",
            ru: "Рустам Холиков"
          }),
          description: JSON.stringify({
            en: "Adventure tour guide specializing in trekking and camping in Fann Mountains",
            ru: "Гид приключенческих туров, специализирующийся на треккинге и кемпинге в Фанских горах"
          }),
          languages: JSON.stringify(['Russian', 'English', 'Tajik', 'German']),
          contact: JSON.stringify({
            phone: '+992901234567',
            email: 'rustam@fannadventure.tj'
          }),
          experience: 10,
          rating: 4.7,
          isActive: true
        },
        {
          name: JSON.stringify({
            en: "Sojida Nazarova",
            ru: "Содида Назарова"
          }),
          description: JSON.stringify({
            en: "Eco-tourism guide for Iskanderkul and Seven Lakes region",
            ru: "Гид экологического туризма для региона Искандеркуль и Семи озёр"
          }),
          languages: JSON.stringify(['Russian', 'English', 'Tajik', 'French']),
          contact: JSON.stringify({
            phone: '+992934567890',
            email: 'sojida@ecoguides.tj'
          }),
          experience: 8,
          rating: 4.6,
          isActive: true
        }
      ]
    });

    console.log(`✅ Created ${guides.count} guides`);

    console.log('🎉 Seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedData();