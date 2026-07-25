import { Router, Request, Response } from 'express';
import { emailService } from '../services/emailService';
import nodemailer from 'nodemailer';
import type { Customer } from '@prisma/client';

const router = Router();

/**
 * 🧪 ПОЛНЫЙ ТЕСТОВЫЙ НАБОР ПИСЕМ БЕЗ ОПЛАТЫ
 * 
 * Это набор endpoint'ов для полного тестирования системы отправки писем
 * БЕЗ необходимости делать реальные платежи
 */

// 1️⃣ БАЗОВЫЙ SMTP ТЕСТ - просто проверка подключения
router.get('/test-smtp', async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string) || 'greyversarex@gmail.com';
    
    console.log(`\n📧 [TEST 1] BASIC SMTP TEST - Email: ${email}`);
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.timeweb.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: parseInt(process.env.SMTP_PORT || '465') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: { rejectUnauthorized: false }
    });

    console.log(`📤 Verifying SMTP connection...`);
    await transporter.verify();
    console.log(`✅ SMTP connection OK`);

    const info = await transporter.sendMail({
      from: `"Bunyod-Tour" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: '✅ Тест 1: Базовое подключение SMTP',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">✅ СИСТЕМА ПИСЕМ РАБОТАЕТ!</h1>
            <p style="margin: 10px 0 0 0;">Тест 1: Базовое подключение SMTP</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937;">Поздравляем!</h2>
            <p>SMTP сервер Timeweb успешно подключен и готов отправлять письма.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <p><strong>Параметры:</strong></p>
              <ul>
                <li>Host: ${process.env.SMTP_HOST}</li>
                <li>Port: ${process.env.SMTP_PORT}</li>
                <li>User: ${process.env.SMTP_USER}</li>
                <li>From: ${process.env.SMTP_FROM}</li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 12px;">Время отправки: ${new Date().toLocaleString('ru-RU')}</p>
          </div>
        </div>
      `
    });

    console.log(`✅ Email sent! Message ID: ${info.messageId}\n`);

    return res.json({
      success: true,
      test: 'TEST 1 - Basic SMTP',
      message: `✅ Письмо отправлено на ${email}`,
      details: {
        messageId: info.messageId,
        from: process.env.SMTP_FROM,
        to: email,
        smtpHost: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT
      }
    });
  } catch (error: any) {
    console.error(`❌ TEST 1 FAILED:`, error.message);
    return res.status(500).json({
      success: false,
      test: 'TEST 1 - Basic SMTP',
      error: error.message
    });
  }
});

// 2️⃣ ПИСЬМО С PDF БИЛЕТОМ - имитирует реальное письмо платежа
router.get('/test-payment-email', async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string) || 'greyversarex@gmail.com';
    
    console.log(`\n📧 [TEST 2] PAYMENT EMAIL WITH PDF - Email: ${email}`);

    // Mock данные заказа
    const mockOrder = {
      id: 123,
      orderNumber: `BT-TEST-${Date.now()}`,
      totalAmount: 2500,
      currency: 'TJS',
      paymentMethod: 'Alif',
      createdAt: new Date(),
      tourists: JSON.stringify([
        { firstName: 'Тест', lastName: 'Клиент', passportNumber: 'A123456789' }
      ]),
      tour: {
        id: 1,
        title: { ru: 'Лучший тур по Таджикистану', en: 'Best Tour of Tajikistan' },
        durationDays: 5,
        tourType: 'Групповой',
        format: 'Групповой',
        pickupInfo: 'Рудаки парк, 9:00 утра'
      },
      hotel: {
        name: { ru: 'Отель Душанбе Серена', en: 'Dushanbe Serena Hotel' }
      },
      guide: {
        name: { ru: 'Алексей Гидов', en: 'Alexey Guidov' }
      }
    };

    const mockCustomer = {
      id: 999,
      email: email,
      firstName: 'Тестовый',
      lastName: 'Клиент',
      phone: '+992 917 123 456'
    };

    console.log(`📤 Sending payment confirmation email...`);
    const result = await emailService.sendPaymentConfirmation(mockOrder as any, mockCustomer as any);

    if (result) {
      console.log(`✅ Payment email sent successfully with PDF ticket\n`);
      return res.json({
        success: true,
        test: 'TEST 2 - Payment Email with PDF',
        message: `✅ Письмо с PDF билетом отправлено на ${email}`,
        details: {
          orderNumber: mockOrder.orderNumber,
          amount: `${mockOrder.totalAmount} ${mockOrder.currency}`,
          includesPDF: true,
          to: email
        }
      });
    } else {
      throw new Error('Failed to send payment email');
    }
  } catch (error: any) {
    console.error(`❌ TEST 2 FAILED:`, error.message);
    return res.status(500).json({
      success: false,
      test: 'TEST 2 - Payment Email with PDF',
      error: error.message
    });
  }
});

// 3️⃣ ПИСЬМО БРОНИРОВАНИЯ - имитирует письмо при создании заказа
router.get('/test-booking-email', async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string) || 'greyversarex@gmail.com';
    
    console.log(`\n📧 [TEST 3] BOOKING EMAIL - Email: ${email}`);

    const mockOrder = {
      id: 456,
      orderNumber: `BT-BOOKING-${Date.now()}`,
      createdAt: new Date(),
      tour: {
        title: { ru: 'Невероятный тур по Центральной Азии', en: 'Amazing Central Asia Tour' },
        durationDays: 7
      }
    };

    const mockCustomer = {
      id: 999,
      email: email,
      firstName: 'Иван',
      lastName: 'Петров'
    };

    console.log(`📤 Sending booking confirmation email...`);
    const result = await emailService.sendBookingConfirmation(mockOrder as any, mockCustomer as any, mockOrder.tour);

    if (result) {
      console.log(`✅ Booking email sent successfully\n`);
      return res.json({
        success: true,
        test: 'TEST 3 - Booking Email',
        message: `✅ Письмо подтверждения бронирования отправлено на ${email}`,
        details: {
          orderNumber: mockOrder.orderNumber,
          to: email
        }
      });
    } else {
      throw new Error('Failed to send booking email');
    }
  } catch (error: any) {
    console.error(`❌ TEST 3 FAILED:`, error.message);
    return res.status(500).json({
      success: false,
      test: 'TEST 3 - Booking Email',
      error: error.message
    });
  }
});

// 4️⃣ ПИСЬМО АДМИНУ - имитирует уведомление администратору
router.get('/test-admin-email', async (req: Request, res: Response) => {
  try {
    console.log(`\n📧 [TEST 4] ADMIN NOTIFICATION EMAIL`);

    const mockOrder = {
      id: 789,
      orderNumber: `BT-ADMIN-${Date.now()}`,
      totalAmount: 5000,
      currency: 'TJS',
      createdAt: new Date()
    };

    const mockCustomer = {
      id: 999,
      email: 'customer@example.com',
      firstName: 'Клиент',
      lastName: 'Тестовый',
      phone: '+992 917 000 000'
    };

    const mockTour = {
      title: { ru: 'Премиум тур', en: 'Premium Tour' }
    };

    console.log(`📤 Sending admin notification...`);
    const result = await emailService.sendAdminNotification(mockOrder as any, mockCustomer as any, mockTour);

    if (result) {
      console.log(`✅ Admin email sent to ${process.env.ADMIN_EMAIL}\n`);
      return res.json({
        success: true,
        test: 'TEST 4 - Admin Notification',
        message: `✅ Уведомление админу отправлено на ${process.env.ADMIN_EMAIL}`,
        details: {
          orderNumber: mockOrder.orderNumber,
          amount: `${mockOrder.totalAmount} ${mockOrder.currency}`,
          customer: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
          adminEmail: process.env.ADMIN_EMAIL
        }
      });
    } else {
      throw new Error('Failed to send admin email');
    }
  } catch (error: any) {
    console.error(`❌ TEST 4 FAILED:`, error.message);
    return res.status(500).json({
      success: false,
      test: 'TEST 4 - Admin Notification',
      error: error.message
    });
  }
});

// 5️⃣ ПОЛНЫЙ ТЕСТ ВСЕХ ПИСЕМ - отправить все 4 типа
router.get('/test-all-emails', async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string) || 'greyversarex@gmail.com';
    
    console.log(`\n📧 [FULL TEST] SENDING ALL 4 EMAIL TYPES\n`);

    const results = {
      smtp_test: false,
      payment_email: false,
      booking_email: false,
      admin_email: false
    };

    // Test 1: SMTP
    try {
      console.log(`  1️⃣ Testing SMTP...`);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.timeweb.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: parseInt(process.env.SMTP_PORT || '465') === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: { rejectUnauthorized: false }
      });
      await transporter.verify();
      results.smtp_test = true;
      console.log(`  ✅ SMTP OK`);
    } catch (e) {
      console.log(`  ❌ SMTP FAILED`);
    }

    // Test 2: Payment Email
    try {
      console.log(`  2️⃣ Sending payment email...`);
      const mockOrder = {
        id: 1,
        orderNumber: `BT-FULL-TEST-${Date.now()}`,
        totalAmount: 2000,
        currency: 'TJS',
        paymentMethod: 'Alif',
        createdAt: new Date(),
        tourists: JSON.stringify([{ firstName: 'Test', lastName: 'User' }]),
        tour: { title: { ru: 'Тур 1', en: 'Tour 1' }, durationDays: 5 },
        hotel: { name: { ru: 'Отель', en: 'Hotel' } },
        guide: { name: { ru: 'Гид', en: 'Guide' } }
      };
      const mockCustomer = { id: 1, email, firstName: 'Test', lastName: 'User' };
      
      const paymentResult = await emailService.sendPaymentConfirmation(mockOrder as any, mockCustomer as any);
      results.payment_email = paymentResult;
      console.log(`  ${paymentResult ? '✅' : '❌'} Payment email`);
    } catch (e) {
      console.log(`  ❌ Payment email FAILED`);
    }

    // Test 3: Booking Email
    try {
      console.log(`  3️⃣ Sending booking email...`);
      const mockOrder = {
        id: 2,
        orderNumber: `BT-BOOKING-${Date.now()}`,
        createdAt: new Date(),
        tour: { title: { ru: 'Тур', en: 'Tour' }, durationDays: 3 }
      };
      const mockCustomer = { id: 1, email, firstName: 'Test', lastName: 'User' };
      
      const bookingResult = await emailService.sendBookingConfirmation(mockOrder as any, mockCustomer as any, mockOrder.tour);
      results.booking_email = bookingResult;
      console.log(`  ${bookingResult ? '✅' : '❌'} Booking email`);
    } catch (e) {
      console.log(`  ❌ Booking email FAILED`);
    }

    // Test 4: Admin Email
    try {
      console.log(`  4️⃣ Sending admin email...`);
      const mockOrder = { id: 3, orderNumber: `BT-ADMIN-${Date.now()}`, totalAmount: 3000, currency: 'TJS', createdAt: new Date() };
      const mockCustomer = { id: 1, email, firstName: 'Test', lastName: 'User', phone: '+992' };
      const mockTour = { title: { ru: 'Тур', en: 'Tour' } };
      
      const adminResult = await emailService.sendAdminNotification(mockOrder as any, mockCustomer as any, mockTour);
      results.admin_email = adminResult;
      console.log(`  ${adminResult ? '✅' : '❌'} Admin email`);
    } catch (e) {
      console.log(`  ❌ Admin email FAILED`);
    }

    console.log(`\n✅ ПОЛНЫЙ ТЕСТ ЗАВЕРШЕН\n`);

    return res.json({
      success: true,
      test: 'FULL TEST - All Email Types',
      message: '✅ Полный тест системы писем завершен',
      results: results,
      summary: {
        passed: Object.values(results).filter(v => v).length,
        total: Object.keys(results).length,
        status: Object.values(results).every(v => v) ? '🎉 ВСЕ ТЕСТЫ ПРОШЛИ!' : '⚠️ Некоторые тесты не прошли'
      }
    });
  } catch (error: any) {
    console.error(`❌ FULL TEST FAILED:`, error.message);
    return res.status(500).json({
      success: false,
      test: 'FULL TEST - All Email Types',
      error: error.message
    });
  }
});

// INFO - информация о системе
router.get('/info', (req: Request, res: Response) => {
  return res.json({
    success: true,
    message: '📧 Система отправки писем Bunyod-Tour',
    endpoints: {
      'diagnose': 'GET /diagnose?email=test@example.com - Полная диагностика Resend + SMTP',
      'test-smtp': 'GET /test-smtp?email=грей@example.com - Базовый SMTP тест',
      'test-payment-email': 'GET /test-payment-email?email=грей@example.com - Письмо с PDF билетом',
      'test-booking-email': 'GET /test-booking-email?email=грей@example.com - Письмо бронирования',
      'test-admin-email': 'GET /test-admin-email - Письмо админу',
      'test-all-emails': 'GET /test-all-emails?email=грей@example.com - Все 4 типа писем'
    },
    config: {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpUser: process.env.SMTP_USER ? '✅ Configured' : '❌ Not set',
      smtpFrom: process.env.SMTP_FROM,
      adminEmail: process.env.ADMIN_EMAIL
    }
  });
});

// 🔍 ДИАГНОСТИКА - проверяет Resend и SMTP по отдельности с точными ошибками
router.get('/diagnose', async (req: Request, res: Response) => {
  const https = require('https');
  const email = (req.query.email as string) || process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
  const results: any = {
    timestamp: new Date().toISOString(),
    testEmail: email,
    resend: { configured: false, status: 'not_tested', error: null as string | null },
    smtp465: { status: 'not_tested', error: null as string | null },
    smtp587: { status: 'not_tested', error: null as string | null }
  };

  // --- TEST RESEND ---
  if (process.env.RESEND_API_KEY) {
    results.resend.configured = true;
    results.resend.apiKeyPrefix = process.env.RESEND_API_KEY.substring(0, 8) + '...';
    results.resend.fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || 'booking@bunyodtour.tj';
    try {
      const payload = JSON.stringify({
        from: `Bunyod-Tour <${results.resend.fromEmail}>`,
        to: [email],
        subject: '🔍 Диагностика Resend - Bunyod-Tour',
        html: `<p>Тест отправлен в ${new Date().toISOString()}. Если видите это письмо — Resend работает.</p>`
      });
      await new Promise<void>((resolve, reject) => {
        const r = https.request({
          hostname: 'api.resend.com',
          path: '/emails',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        }, (res2: any) => {
          let data = '';
          res2.on('data', (c: any) => data += c);
          res2.on('end', () => {
            results.resend.httpStatus = res2.statusCode;
            results.resend.rawBody = data;
            if (res2.statusCode >= 200 && res2.statusCode < 300) resolve();
            else reject(new Error(`HTTP ${res2.statusCode}: ${data}`));
          });
        });
        r.on('error', reject);
        r.setTimeout(15000, () => { r.destroy(); reject(new Error('Resend timeout')); });
        r.write(payload);
        r.end();
      });
      results.resend.status = 'success';
    } catch (err: any) {
      results.resend.status = 'failed';
      results.resend.error = err.message || String(err);
    }
  } else {
    results.resend.status = 'not_configured';
    results.resend.error = 'RESEND_API_KEY not set';
  }

  // --- TEST SMTP PORT 465 ---
  try {
    const t465 = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.timeweb.com',
      port: 465,
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 15000
    } as any);
    await t465.verify();
    await t465.sendMail({
      from: `"Bunyod-Tour" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: '🔍 Диагностика SMTP:465 - Bunyod-Tour',
      html: `<p>SMTP порт 465 работает. Тест: ${new Date().toISOString()}</p>`
    });
    results.smtp465.status = 'success';
  } catch (err: any) {
    results.smtp465.status = 'failed';
    results.smtp465.error = `${err.code || ''} ${err.message}`.trim();
  }

  // --- TEST SMTP PORT 587 ---
  try {
    const t587 = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.timeweb.com',
      port: 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 15000
    } as any);
    await t587.verify();
    await t587.sendMail({
      from: `"Bunyod-Tour" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: '🔍 Диагностика SMTP:587 - Bunyod-Tour',
      html: `<p>SMTP порт 587 работает. Тест: ${new Date().toISOString()}</p>`
    });
    results.smtp587.status = 'success';
  } catch (err: any) {
    results.smtp587.status = 'failed';
    results.smtp587.error = `${err.code || ''} ${err.message}`.trim();
  }

  const anySuccess = results.resend.status === 'success' || results.smtp465.status === 'success' || results.smtp587.status === 'success';
  return res.status(anySuccess ? 200 : 500).json({
    success: anySuccess,
    summary: anySuccess
      ? `✅ Хотя бы один метод работает. Проверьте ${email}.`
      : '❌ Все методы отправки не работают. Смотрите детали ниже.',
    results
  });
});

export default router;
