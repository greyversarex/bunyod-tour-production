import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';

const router = Router();

// Simple test endpoint - sends email with mock data to specified email
router.get('/send-simple-email', async (req: Request, res: Response) => {
  try {
    const testEmail = req.query.email as string || 'greyversarex@gmail.com';
    
    console.log(`📧 Sending simple test email to: ${testEmail}`);
    
    // Create mock order data for testing
    const mockOrder = {
      id: 999,
      orderNumber: 'BT-TEST-2025',
      tourDate: new Date('2025-11-15'),
      tourists: JSON.stringify([
        { firstName: 'Иван', lastName: 'Тестовый', passportNumber: 'TEST123456' }
      ]),
      totalAmount: 1500.00,
      createdAt: new Date(),
      tour: {
        title: { ru: 'Тестовый тур по Таджикистану', en: 'Test Tour of Tajikistan' },
        durationDays: 5,
        tourType: 'Групповой',
        services: JSON.stringify([
          { ru: 'Проживание в отеле', en: 'Hotel accommodation' },
          { ru: 'Трансфер', en: 'Transfer' },
          { ru: 'Экскурсии', en: 'Excursions' }
        ])
      },
      hotel: {
        name: { ru: 'Отель Душанбе', en: 'Dushanbe Hotel' }
      },
      guide: {
        firstName: 'Алексей',
        lastName: 'Гидов'
      }
    };
    
    const mockCustomer = {
      id: 999,
      email: testEmail,
      firstName: 'Тестовый',
      lastName: 'Клиент',
      phone: '+992000000000'
    };
    
    const emailSent = await emailService.sendPaymentConfirmation(mockOrder as any, mockCustomer as any);
    
    if (emailSent) {
      return res.json({
        success: true,
        message: `✅ Тестовое письмо с PDF билетом отправлено на ${testEmail}`,
        note: 'Проверьте почту (также папку "Спам")'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Не удалось отправить письмо. Проверьте логи сервера.'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка отправки тестового письма:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка отправки письма',
      error: error.message
    });
  }
});

router.get('/test-email', async (req: Request, res: Response) => {
  try {
    console.log('📧 Testing email with PDF attachment...');
    
    const order = await prisma.order.findFirst({
      where: {
        status: 'paid'
      },
      include: {
        customer: true,
        tour: {
          include: {
            tourHotels: {
              include: {
                hotel: true
              }
            }
          }
        },
        hotel: true,
        guide: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'No paid orders found for testing. Please complete a payment first.'
      });
    }

    if (!order.customer) {
      return res.status(404).json({
        success: false,
        message: 'Order has no customer associated'
      });
    }

    console.log(`📧 Sending test email to: ${order.customer.email}`);
    console.log(`📦 Order: ${order.orderNumber}`);
    
    const emailSent = await emailService.sendPaymentConfirmation(order, order.customer);
    
    if (emailSent) {
      return res.json({
        success: true,
        message: `✅ Test email with PDF ticket sent successfully to ${order.customer.email}`,
        orderNumber: order.orderNumber,
        customerEmail: order.customer.email
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email. Check console logs for details.'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error sending test email:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message
    });
  }
});

export default router;
