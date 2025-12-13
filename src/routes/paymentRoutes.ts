import { Router } from 'express';
import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
import { sendBookingConfirmation } from '../services/emailServiceSendGrid';
import { createBookingFromOrder } from '../services/paymentService';
import { paylerController } from '../controllers/paylerController';
import { alifController } from '../controllers/alifController';

const router = Router();

// Get payment methods (for admin panel)
router.get('/payment-methods', async (req: Request, res: Response) => {
  try {
    const methods = [
      {
        id: 'alif',
        name: 'AlifPay',
        enabled: !!(process.env.ALIF_MERCHANT_KEY && process.env.ALIF_MERCHANT_PASSWORD),
        description: 'Tajikistan payment system (Alif Bank)',
      },
      {
        id: 'payler',
        name: 'Payler',
        enabled: !!process.env.PAYLER_KEY,
        description: 'Tajikistan payment system',
      },
    ];

    return res.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment methods',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Payler integration (OLD - DEPRECATED, use /payler/create instead)
router.post('/payler', async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.body;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required',
      });
    }

    // Get order details
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        customer: true,
        tour: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const paylerKey = process.env.PAYLER_KEY;

    if (!paylerKey) {
      return res.status(500).json({
        success: false,
        message: 'Payler configuration missing',
      });
    }

    // Call Payler StartSession API
    const paylerAmount = Math.round(order.totalAmount * 100); // Convert to tiyin
    const fetch = require('node-fetch');

    const startSessionBody = new URLSearchParams({
      key: paylerKey,
      type: 'OneStep',
      currency: 'TJS',
      amount: paylerAmount.toString(),
      order_id: order.id.toString(),
    });

    const response = await fetch('https://secure.payler.com/gapi/StartSession', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: startSessionBody,
    });

    const responseData = await response.text();
    console.log('Payler StartSession response:', responseData);

    // Parse response (format: session_id=XXXXX)
    const sessionIdMatch = responseData.match(/session_id=([^&\s]+)/);
    
    if (!sessionIdMatch) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create Payler session',
        error: responseData,
      });
    }

    const sessionId = sessionIdMatch[1];

    // Update order with payment method
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: 'payler',
        paymentStatus: 'processing',
        paymentIntentId: sessionId,
      },
    });

    return res.json({
      success: true,
      paymentUrl: `https://secure.payler.com/gapi/Pay/?session_id=${sessionId}`,
      sessionId: sessionId,
    });

  } catch (error) {
    console.error('Payler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payler integration error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Payler callback (OLD - DEPRECATED, use /payler/callback instead)
router.post('/payler-callback', async (req: Request, res: Response) => {
  try {
    const { order_id, status, session_id } = req.body;

    console.log('Payler callback received:', req.body);

    if (!order_id) {
      return res.status(400).send('Bad Request');
    }

    const order = await prisma.order.findUnique({
      where: { id: parseInt(order_id) },
      include: {
        customer: true,
      },
    });

    if (!order) {
      return res.status(404).send('Order Not Found');
    }

    // Update payment status based on Payler response
    if (status === 'success' || status === 'Charged') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'paid',
        },
      });

      // Send confirmation email
      try {
        await emailService.sendPaymentConfirmation(order, order.customer);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'failed',
        },
      });
    }

    return res.status(200).send('OK');

  } catch (error) {
    console.error('Payler callback error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// ✅ НОВЫЕ БЕЗОПАСНЫЕ PAYLER РОУТЫ
// Создание платежа через улучшенный Payler контроллер
router.post('/payler/create', paylerController.createPayment);

// Callback от Payler с улучшенной валидацией
router.post('/payler/callback', paylerController.callback);

// Возврат средств через Payler
router.post('/payler/refund', paylerController.refund);

// ✅ Проверка и обновление статуса платежа (для страницы payment-success)
// Используется когда турист возвращается с Payler, но callback ещё не пришёл
router.post('/verify-payment', async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.body;
    
    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required'
      });
    }
    
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        customer: true,
        tour: true,
        guideHireRequest: {
          include: { guide: true }
        },
        transferRequest: {
          include: { assignedDriver: true }
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Если уже оплачен - просто возвращаем статус
    if (order.paymentStatus === 'paid') {
      return res.json({
        success: true,
        data: {
          orderNumber: order.orderNumber,
          paymentStatus: 'paid',
          status: order.status,
          totalAmount: order.totalAmount,
          verified: true
        }
      });
    }
    
    // Если paymentMethod - payler и есть paymentIntentId (session_id), проверяем статус
    if (order.paymentMethod === 'payler' && order.paymentStatus === 'processing') {
      try {
        console.log(`🔍 Verifying Payler payment for order ${orderNumber} (ID: ${order.id})`);
        const statusData = await paylerController.getStatus(order.id.toString());
        
        if (statusData.status === 'Charged') {
          // Платёж успешен - обновляем статус
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'paid',
              status: 'confirmed',
            },
          });
          
          // Обновляем связанные записи для Guide Hire
          if (order.guideHireRequestId) {
            await prisma.guideHireRequest.update({
              where: { id: order.guideHireRequestId },
              data: { 
                paymentStatus: 'paid',
                status: 'confirmed' 
              }
            });
          }
          
          console.log(`✅ Payment verified and order ${orderNumber} updated to paid`);
          
          // Отправляем email уведомления (в фоне) - ПОЛНОЦЕННЫЕ как в callback
          setImmediate(async () => {
            try {
              if (!order.customer) return;
              
              const isTourOrder = order.orderNumber.startsWith('BT-');
              const isGuideHire = order.orderNumber.startsWith('GH-');
              const isTransfer = order.orderNumber.startsWith('TR-');
              const orderTypeText = isTourOrder ? 'Тур' : isGuideHire ? 'Найм гида' : isTransfer ? 'Трансфер' : 'Услуга';
              
              console.log('📧 [VERIFY-PAYMENT] Starting email process for:', order.orderNumber, 'Type:', orderTypeText);
              
              // 🎯 ТУР: Отправляем полноценный PDF билет (как в callback)
              if (isTourOrder || order.tour || order.tourId) {
                console.log('📧 [VERIFY-PAYMENT] Tour order detected, sending PDF ticket...');
                
                // Создаём booking если его нет
                const existingBooking = await prisma.booking.findFirst({
                  where: { orderId: order.id },
                  include: { tour: true, hotel: true }
                });
                
                let tourData = order.tour;
                
                if (!tourData && existingBooking?.tour) {
                  tourData = existingBooking.tour;
                }
                
                if (!tourData && order.tourId) {
                  tourData = await prisma.tour.findUnique({ where: { id: order.tourId } });
                }
                
                if (!existingBooking) {
                  console.log('📧 [VERIFY-PAYMENT] Creating booking from order...');
                  await createBookingFromOrder(order.id);
                } else {
                  // Обновляем статус booking на paid
                  await prisma.booking.update({
                    where: { id: existingBooking.id },
                    data: { status: 'paid' }
                  });
                }
                
                if (tourData) {
                  try {
                    await sendBookingConfirmation(order, order.customer, tourData);
                    console.log('✅ [VERIFY-PAYMENT] PDF ticket email sent successfully');
                  } catch (pdfError) {
                    console.error('❌ [VERIFY-PAYMENT] PDF email failed, using fallback:', pdfError);
                    await emailService.sendPaymentConfirmation(order, order.customer);
                  }
                  
                  await emailService.sendAdminNotification(order, order.customer, tourData);
                } else {
                  console.warn('⚠️ [VERIFY-PAYMENT] Tour data not found, sending fallback email');
                  await emailService.sendPaymentConfirmation(order, order.customer);
                }
              } else {
                // 🎯 НЕ-ТУР: Отправляем детальный email (гид/трансфер)
                console.log('📧 [VERIFY-PAYMENT] Non-tour order, sending detailed confirmation...');
                
                let detailsHTML = '';
                
                if (isGuideHire && order.guideHireRequest?.guide) {
                  const guide = order.guideHireRequest.guide;
                  const guideName = typeof guide.name === 'object' && guide.name !== null 
                    ? (guide.name as any).ru || (guide.name as any).en || 'Не указано' 
                    : String(guide.name || 'Не указано');
                  
                  detailsHTML = `
                    <p><strong>Гид:</strong> ${guideName}</p>
                    <p><strong>Количество дней:</strong> ${order.guideHireRequest.numberOfDays || 'не указано'}</p>
                    <p><strong>Цена за день:</strong> ${guide.pricePerDay || 'не указана'} TJS</p>
                  `;
                } else if (isTransfer && order.transferRequest) {
                  const transfer = order.transferRequest;
                  detailsHTML = `
                    <p><strong>Откуда:</strong> ${transfer.pickupLocation || 'не указано'}</p>
                    <p><strong>Куда:</strong> ${transfer.dropoffLocation || 'не указано'}</p>
                    <p><strong>Дата:</strong> ${transfer.pickupDate || 'не указана'}</p>
                  `;
                }
                
                await emailService.sendEmail({
                  to: order.customer.email,
                  subject: `✅ Оплата подтверждена - ${orderTypeText}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center;">
                        <h1 style="margin: 0;">✅ Оплата подтверждена!</h1>
                      </div>
                      <div style="padding: 30px;">
                        <p>Уважаемый(ая) <strong>${order.customer.fullName}</strong>,</p>
                        <p>Благодарим за оплату! Ваш заказ успешно обработан.</p>
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                          <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                          <p><strong>Услуга:</strong> ${orderTypeText}</p>
                          ${detailsHTML}
                          <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
                          <p style="font-size: 18px; color: #10b981;"><strong>Оплачено:</strong> ${order.totalAmount} TJS</p>
                        </div>
                      </div>
                      <div style="background: #3E3E3E; color: white; padding: 20px; text-align: center;">
                        <p style="margin: 5px 0;">📞 +992 44 625 7575 | +992 93-126-1134</p>
                        <p style="margin: 5px 0;">✉️ booking@bunyodtour.tj</p>
                      </div>
                    </div>
                  `
                });
                
                const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
                await emailService.sendEmail({
                  to: adminEmail,
                  subject: `💰 Платёж подтверждён (verify): ${orderTypeText} - ${order.totalAmount} TJS`,
                  html: `
                    <div style="font-family: Arial, sans-serif;">
                      <h2>💰 Платёж подтверждён через verify-payment</h2>
                      <p><strong>Заказ:</strong> ${order.orderNumber}</p>
                      <p><strong>Клиент:</strong> ${order.customer.fullName} (${order.customer.email})</p>
                      <p><strong>Сумма:</strong> ${order.totalAmount} TJS</p>
                    </div>
                  `
                });
              }
              
              console.log('✅ [VERIFY-PAYMENT] All emails sent for:', order.orderNumber);
            } catch (emailError) {
              console.error('❌ [VERIFY-PAYMENT] Failed to send emails:', emailError);
            }
          });
          
          return res.json({
            success: true,
            data: {
              orderNumber: order.orderNumber,
              paymentStatus: 'paid',
              status: 'confirmed',
              totalAmount: order.totalAmount,
              verified: true,
              justVerified: true
            }
          });
        } else if (statusData.status === 'Rejected' || statusData.status === 'Refunded') {
          // Платёж отклонён
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: statusData.status === 'Refunded' ? 'refunded' : 'failed',
            },
          });
          
          return res.json({
            success: true,
            data: {
              orderNumber: order.orderNumber,
              paymentStatus: statusData.status === 'Refunded' ? 'refunded' : 'failed',
              status: order.status,
              totalAmount: order.totalAmount,
              verified: true
            }
          });
        } else {
          // Статус ещё неизвестен (Authorized, Created и т.д.)
          return res.json({
            success: true,
            data: {
              orderNumber: order.orderNumber,
              paymentStatus: order.paymentStatus,
              paylerStatus: statusData.status,
              status: order.status,
              totalAmount: order.totalAmount,
              verified: false,
              message: 'Payment still processing'
            }
          });
        }
      } catch (paylerError) {
        console.error('Error verifying Payler payment:', paylerError);
        // Возвращаем текущий статус без обновления
        return res.json({
          success: true,
          data: {
            orderNumber: order.orderNumber,
            paymentStatus: order.paymentStatus,
            status: order.status,
            totalAmount: order.totalAmount,
            verified: false,
            error: 'Could not verify with payment gateway'
          }
        });
      }
    }
    
    // Для других случаев - просто возвращаем текущий статус
    return res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        status: order.status,
        totalAmount: order.totalAmount,
        verified: order.paymentStatus === 'paid'
      }
    });
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ✅ НОВЫЕ БЕЗОПАСНЫЕ ALIF РОУТЫ
// Создание платежа через AlifPay контроллер
router.post('/alif/create', alifController.createPayment);

// Callback от AlifPay с проверкой подписи
router.post('/alif/callback', alifController.callback);

export default router;