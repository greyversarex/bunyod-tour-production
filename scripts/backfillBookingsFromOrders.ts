import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillBookingsFromPaidOrders() {
  console.log('Starting backfill of Booking records from paid Orders...');
  
  const paidOrders = await prisma.order.findMany({
    where: {
      paymentStatus: 'paid',
      tourId: { not: null },
      booking: null
    },
    include: {
      customer: true,
      tour: true
    }
  });

  console.log(`Found ${paidOrders.length} paid orders without Booking records`);

  let created = 0;
  let skipped = 0;

  for (const order of paidOrders) {
    try {
      if (!order.tourId) {
        console.log(`Skipping order ${order.orderNumber} - no tourId`);
        skipped++;
        continue;
      }

      const existingBooking = await prisma.booking.findUnique({
        where: { orderId: order.id }
      });

      if (existingBooking) {
        console.log(`Booking already exists for order ${order.orderNumber}`);
        skipped++;
        continue;
      }

      let touristsData: { name: string; birthDate: string }[] = [];
      try {
        touristsData = JSON.parse(order.tourists);
      } catch (e) {
        touristsData = [{ name: 'Tourist', birthDate: '' }];
      }

      await prisma.booking.create({
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

      console.log(`Created Booking for order ${order.orderNumber}`);
      created++;
    } catch (error) {
      console.error(`Error creating booking for order ${order.orderNumber}:`, error);
      skipped++;
    }
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total processed: ${paidOrders.length}`);
}

backfillBookingsFromPaidOrders()
  .then(() => {
    console.log('Backfill finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
