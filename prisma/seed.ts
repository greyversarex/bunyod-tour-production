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

  // 6. Sample tours removed - users will create their own tours
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
