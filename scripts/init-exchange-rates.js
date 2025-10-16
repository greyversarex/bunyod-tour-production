const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initExchangeRates() {
  try {
    console.log('💱 Initializing exchange rates...');

    // Check if exchange rates already exist
    const existingRates = await prisma.exchangeRate.count();
    
    if (existingRates > 0) {
      console.log('✅ Exchange rates already initialized');
      console.log(`Found ${existingRates} exchange rates in database`);
      return;
    }

    // Default exchange rates (rate = how many TJS for 1 unit of currency)
    const defaultRates = [
      {
        currency: 'TJS',
        rate: 1,
        symbol: 'tjs',
        name: 'Сомони',
        isActive: true
      },
      {
        currency: 'USD',
        rate: 11.0,
        symbol: '$',
        name: 'Доллар США',
        isActive: true
      },
      {
        currency: 'EUR',
        rate: 12.0,
        symbol: '€',
        name: 'Евро',
        isActive: true
      },
      {
        currency: 'RUB',
        rate: 0.12,
        symbol: '₽',
        name: 'Российский рубль',
        isActive: true
      },
      {
        currency: 'CNY',
        rate: 1.5,
        symbol: '¥',
        name: 'Китайский юань',
        isActive: true
      }
    ];

    // Create exchange rates
    const result = await prisma.exchangeRate.createMany({
      data: defaultRates,
      skipDuplicates: true
    });

    console.log(`✅ Successfully initialized ${result.count} exchange rates`);
    console.log('📊 Default rates:');
    defaultRates.forEach(rate => {
      console.log(`   ${rate.currency} (${rate.symbol}): ${rate.rate} TJS`);
    });

  } catch (error) {
    console.error('❌ Error initializing exchange rates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

initExchangeRates()
  .then(() => {
    console.log('✨ Exchange rates initialization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
