import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillBookingsFromPaidOrders() {
  console.log('🔄 Starting backfill of Booking records from paid Orders...\n');
  
  // ЧАСТЬ 1: Обновить статус существующих бронирований на 'paid' если Order оплачен
  console.log('📋 ЧАСТЬ 1: Обновление статуса существующих бронирований...');
  
  const bookingsWithPaidOrders = await prisma.booking.findMany({
    where: {
      orderId: { not: null },
      status: { not: 'paid' },
      order: {
        paymentStatus: 'paid'
      }
    },
    include: {
      order: true
    }
  });
  
  console.log(`   Найдено ${bookingsWithPaidOrders.length} бронирований с оплаченным Order, но статус != 'paid'`);
  
  let updated = 0;
  for (const booking of bookingsWithPaidOrders) {
    try {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'paid' }
      });
      console.log(`   ✅ Обновлено: Booking #${booking.id} (Order: ${booking.order?.orderNumber})`);
      updated++;
    } catch (error) {
      console.error(`   ❌ Ошибка обновления Booking #${booking.id}:`, error);
    }
  }
  
  console.log(`   Обновлено: ${updated} из ${bookingsWithPaidOrders.length}\n`);
  
  // ЧАСТЬ 2: Найти оплаченные BT-заказы без связанного Booking и связать их
  console.log('📋 ЧАСТЬ 2: Связывание бронирований по данным заказа...');
  
  const paidBTOrdersWithoutBooking = await prisma.order.findMany({
    where: {
      paymentStatus: 'paid',
      orderNumber: { startsWith: 'BT-' },
      booking: null
    },
    include: {
      customer: true,
      tour: true
    }
  });
  
  console.log(`   Найдено ${paidBTOrdersWithoutBooking.length} оплаченных BT-заказов без привязанного Booking`);
  
  let linked = 0;
  let created = 0;
  
  for (const order of paidBTOrdersWithoutBooking) {
    try {
      // Попробуем найти Booking по email + дате + tourId (без сравнения цены - депозит != полная цена)
      const matchingBooking = await prisma.booking.findFirst({
        where: {
          contactEmail: order.customer?.email,
          tourDate: order.tourDate,
          tourId: order.tourId || undefined,
          orderId: null
        }
      });
      
      if (matchingBooking) {
        // Связываем и обновляем статус
        await prisma.booking.update({
          where: { id: matchingBooking.id },
          data: { 
            orderId: order.id,
            status: 'paid'
          }
        });
        console.log(`   ✅ Связано: Booking #${matchingBooking.id} с Order ${order.orderNumber}`);
        linked++;
      } else if (order.tourId) {
        // Создаём новый Booking
        let touristsData: { name: string; birthDate: string }[] = [];
        try {
          touristsData = JSON.parse(order.tourists);
        } catch (e) {
          touristsData = [{ name: 'Tourist', birthDate: '' }];
        }

        const newBooking = await prisma.booking.create({
          data: {
            orderId: order.id,
            tourId: order.tourId,
            hotelId: order.hotelId,
            tourists: order.tourists,
            contactName: order.customer?.fullName || null,
            contactPhone: order.customer?.phone || null,
            contactEmail: order.customer?.email || null,
            totalPrice: order.totalAmount,
            tourDate: order.tourDate,
            numberOfTourists: Array.isArray(touristsData) ? touristsData.length : 1,
            status: 'paid',
            paymentMethod: order.paymentMethod,
            paymentOption: 'full',
            executionStatus: 'pending',
            specialRequests: order.wishes
          }
        });
        console.log(`   ✅ Создано: Booking #${newBooking.id} для Order ${order.orderNumber}`);
        created++;
      } else {
        console.log(`   ⚠️  Пропущен: Order ${order.orderNumber} - нет tourId`);
      }
    } catch (error) {
      console.error(`   ❌ Ошибка для Order ${order.orderNumber}:`, error);
    }
  }
  
  console.log(`   Связано: ${linked}`);
  console.log(`   Создано: ${created}\n`);
  
  // ЧАСТЬ 3: Итоги
  console.log('📊 ИТОГИ:');
  console.log(`   Обновлено статусов: ${updated}`);
  console.log(`   Связано бронирований: ${linked}`);
  console.log(`   Создано бронирований: ${created}`);
  console.log(`   ВСЕГО обработано: ${updated + linked + created}`);
}

backfillBookingsFromPaidOrders()
  .then(() => {
    console.log('\n✅ Backfill finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
