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

// Simple SMTP test without PDF - just sends basic email to test connection
router.get('/smtp-test', async (req: Request, res: Response) => {
  try {
    const testEmail = req.query.email as string || 'greyversarex@gmail.com';
    
    console.log(`📧 Testing SMTP connection by sending simple HTML email to: ${testEmail}`);
    
    const nodemailer = require('nodemailer');
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: parseInt(process.env.SMTP_PORT || '465') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log(`📧 SMTP Config: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}, User: ${process.env.SMTP_USER}`);
    
    // Test connection
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');
    
    // Send simple email
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: testEmail,
      subject: 'Тест SMTP - Bunyod-Tour',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3E3E3E 0%, #2a2a2a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 32px;">BUNYOD-TOUR</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Ваш надежный спутник в мире путешествий</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #667eea;">✅ Тест отправки Email</h2>
            <p>Если вы видите это письмо, значит SMTP сервер Timeweb работает корректно!</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Параметры подключения:</h3>
              <ul style="color: #4b5563; line-height: 1.8;">
                <li><strong>SMTP сервер:</strong> ${process.env.SMTP_HOST}</li>
                <li><strong>Порт:</strong> ${process.env.SMTP_PORT}</li>
                <li><strong>Отправитель:</strong> ${process.env.SMTP_FROM}</li>
                <li><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px;">
              © ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.
            </p>
          </div>
        </div>
      `
    });
    
    console.log(`✅ Test email sent successfully! Message ID: ${info.messageId}`);
    
    return res.json({
      success: true,
      message: `✅ Тестовое письмо отправлено на ${testEmail}`,
      details: {
        messageId: info.messageId,
        from: process.env.SMTP_FROM,
        to: testEmail,
        smtpServer: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT
      }
    });
    
  } catch (error: any) {
    console.error('❌ SMTP Test Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка SMTP подключения',
      error: error.message,
      details: {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        smtpUser: process.env.SMTP_USER
      }
    });
  }
});

export default router;
