import { Router } from 'express';
import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
import { sendBookingConfirmation, sendNonTourPaymentConfirmation } from '../services/emailServiceSendGrid';
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
        // 🆕 hotel relation нужен для fallback рендера отеля в email (legacy заказы без selectedHotels)
        hotel: true,
        booking: true,
        guideHireRequest: {
          include: { guide: true }
        },
        transferRequest: {
          include: {
            assignedDriver: true,
            vehicle: {
              include: {
                driver: true
              }
            }
          }
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
    // ВАЖНО: Мы используем уникальные order_id с суффиксом для Payler (формат: {id}_{suffix})
    // Поэтому нужно использовать paymentIntentId для проверки статуса, если он есть
    if (order.paymentMethod === 'payler' && order.paymentStatus === 'processing') {
      try {
        // Используем paymentIntentId как Payler order_id, если он сохранён
        // Иначе пробуем с обычным ID (для старых заказов без суффикса)
        const paylerOrderId = order.paymentIntentId || order.id.toString();
        console.log(`🔍 Verifying Payler payment for order ${orderNumber} (Payler ID: ${paylerOrderId})`);
        const statusData = await paylerController.getStatus(paylerOrderId);
        
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
            console.log(`✅ [VERIFY-PAYMENT] GuideHireRequest ${order.guideHireRequestId} updated to paid`);
            const { removeGuideDatesAfterPayment } = await import('../controllers/guideHireController');
            await removeGuideDatesAfterPayment(order.guideHireRequestId);
          }
          
          // 🚗 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Обновляем TransferRequest для Payler платежей!
          if (order.transferRequestId) {
            console.log(`🚗 [VERIFY-PAYMENT] Updating TransferRequest ${order.transferRequestId} to paid`);
            await prisma.transferRequest.update({
              where: { id: order.transferRequestId },
              data: { 
                paymentStatus: 'paid',
                status: 'confirmed' 
              }
            });
            console.log(`✅ [VERIFY-PAYMENT] TransferRequest ${order.transferRequestId} updated to paid`);
            
            // 📧 Отправить уведомление водителю
            const transferWithDriver = await prisma.transferRequest.findUnique({
              where: { id: order.transferRequestId },
              include: {
                vehicle: { include: { driver: true } },
                assignedDriver: true
              }
            });
            
            const driver = transferWithDriver?.assignedDriver || transferWithDriver?.vehicle?.driver;
            if (driver?.email) {
              try {
                const rentalDays = transferWithDriver?.rentalDays || 1;
                const dateDisplay = rentalDays > 1 && transferWithDriver?.dropoffDate
                  ? `${transferWithDriver.pickupDate} — ${transferWithDriver.dropoffDate} (${rentalDays} дн.)`
                  : (transferWithDriver?.pickupDate || 'Не указана');
                await emailService.sendEmail({
                  to: driver.email,
                  subject: '🚗 Новый оплаченный трансфер',
                  html: `
                    <div style="font-family: Arial, sans-serif;">
                      <h2>У вас новый оплаченный трансфер!</h2>
                      <p>Клиент: ${order.customer?.fullName || 'Не указан'}</p>
                      <p>Дата: ${dateDisplay}</p>
                      <p>Время: ${transferWithDriver?.pickupTime || 'Не указано'}</p>
                      <p>Откуда: ${transferWithDriver?.pickupLocation || 'Не указано'}</p>
                      <p>Куда: ${transferWithDriver?.dropoffLocation || 'Не указано'}</p>
                      <p>Пассажиров: ${transferWithDriver?.numberOfPeople || 1}</p>
                      <p>Сумма: ${order.totalAmount} TJS</p>
                      <p><a href="${process.env.FRONTEND_URL || 'https://bunyodtour.tj'}/driver-login.html">Перейти в личный кабинет</a></p>
                    </div>
                  `
                });
                console.log(`📧 [VERIFY-PAYMENT] Driver notification sent to: ${driver.email}`);
              } catch (emailError) {
                console.error('❌ [VERIFY-PAYMENT] Failed to send driver email:', emailError);
              }
            }
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
                // 🎯 НЕ-ТУР: Отправляем двуязычный email (гид/трансфер)
                console.log('📧 [VERIFY-PAYMENT] Non-tour order, sending bilingual confirmation...');
                
                const orderType = isGuideHire ? 'guideHire' : isTransfer ? 'transfer' : 'other';
                let detailsData: any = {};
                
                if (isGuideHire && order.guideHireRequest?.guide) {
                  const guide = order.guideHireRequest.guide;
                  const lang = order.language === 'en' ? 'en' : 'ru';
                  const guideName = typeof guide.name === 'object' && guide.name !== null 
                    ? (guide.name as any)[lang] || (guide.name as any).ru || (guide.name as any).en 
                    : String(guide.name || '');
                  
                  detailsData = {
                    guideName,
                    guideLanguages: guide.languages,
                    selectedDates: order.guideHireRequest.selectedDates,
                    numberOfDays: order.guideHireRequest.numberOfDays,
                    pricePerDay: guide.pricePerDay
                  };
                } else if (isTransfer && order.transferRequest) {
                  const transfer = order.transferRequest;
                  const vehicle = (transfer as any).vehicle;
                  const tDriver = (transfer as any).assignedDriver || vehicle?.driver;
                  const lang = order.language === 'en' ? 'en' : 'ru';
                  const tDriverName = tDriver ? (typeof tDriver.name === 'object' ? ((tDriver.name as any)[lang] || (tDriver.name as any).ru || (tDriver.name as any).en) : String(tDriver.name || '')) : undefined;
                  detailsData = {
                    pickupLocation: transfer.pickupLocation,
                    dropoffLocation: transfer.dropoffLocation,
                    date: transfer.pickupDate,
                    dropoffDate: (transfer as any).dropoffDate,
                    rentalDays: (transfer as any).rentalDays,
                    pickupTime: (transfer as any).pickupTime,
                    passengers: (transfer as any).numberOfPeople,
                    vehicleType: vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() : undefined,
                    driverName: tDriverName
                  };
                }
                
                await sendNonTourPaymentConfirmation(order, order.customer, orderType as any, detailsData);
                
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
    
    if (order.paymentMethod === 'alif' && order.paymentStatus === 'processing') {
      const { verifyToken } = req.body;
      
      if (!verifyToken || !order.paymentIntentId || verifyToken !== order.paymentIntentId) {
        console.warn(`⚠️ [VERIFY-ALIF] Invalid verify token for order ${orderNumber}`);
        return res.json({
          success: true,
          data: {
            orderNumber: order.orderNumber,
            paymentStatus: order.paymentStatus,
            status: order.status,
            totalAmount: order.totalAmount,
            verified: false,
            message: 'Invalid verification token'
          }
        });
      }
      
      const createdAt = new Date(order.createdAt);
      const now = new Date();
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceCreation > 24) {
        return res.json({
          success: true,
          data: {
            orderNumber: order.orderNumber,
            paymentStatus: order.paymentStatus,
            status: order.status,
            totalAmount: order.totalAmount,
            verified: false,
            message: 'Order too old for auto-verification'
          }
        });
      }
      
      console.log(`🔄 [VERIFY-ALIF] Auto-verifying AlifPay order ${orderNumber} (user returned from payment page)`);
      
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'paid',
          status: 'confirmed',
        },
      });
      
      if (order.guideHireRequestId) {
        await prisma.guideHireRequest.update({
          where: { id: order.guideHireRequestId },
          data: { paymentStatus: 'paid', status: 'confirmed' }
        });
        console.log(`✅ [VERIFY-ALIF] GuideHireRequest ${order.guideHireRequestId} updated to paid`);
        const { removeGuideDatesAfterPayment } = await import('../controllers/guideHireController');
        await removeGuideDatesAfterPayment(order.guideHireRequestId);
      }
      
      if (order.transferRequestId) {
        await prisma.transferRequest.update({
          where: { id: order.transferRequestId },
          data: { paymentStatus: 'paid', status: 'confirmed' }
        });
        console.log(`✅ [VERIFY-ALIF] TransferRequest ${order.transferRequestId} updated to paid`);
        
        const transferWithDriver = await prisma.transferRequest.findUnique({
          where: { id: order.transferRequestId },
          include: {
            vehicle: { include: { driver: true } },
            assignedDriver: true
          }
        });
        
        const driver = transferWithDriver?.assignedDriver || transferWithDriver?.vehicle?.driver;
        if (driver?.email) {
          try {
            const rentalDaysAlif = transferWithDriver?.rentalDays || 1;
            const dateDisplayAlif = rentalDaysAlif > 1 && transferWithDriver?.dropoffDate
              ? `${transferWithDriver.pickupDate} — ${transferWithDriver.dropoffDate} (${rentalDaysAlif} дн.)`
              : (transferWithDriver?.pickupDate || 'Не указана');
            await emailService.sendEmail({
              to: driver.email,
              subject: '🚗 Новый оплаченный трансфер',
              html: `
                <div style="font-family: Arial, sans-serif;">
                  <h2>У вас новый оплаченный трансфер!</h2>
                  <p>Клиент: ${order.customer?.fullName || 'Не указан'}</p>
                  <p>Дата: ${dateDisplayAlif}</p>
                  <p>Время: ${transferWithDriver?.pickupTime || 'Не указано'}</p>
                  <p>Откуда: ${transferWithDriver?.pickupLocation || 'Не указано'}</p>
                  <p>Куда: ${transferWithDriver?.dropoffLocation || 'Не указано'}</p>
                  <p>Пассажиров: ${transferWithDriver?.numberOfPeople || 1}</p>
                  <p>Сумма: ${order.totalAmount} TJS</p>
                  <p><a href="${process.env.FRONTEND_URL || 'https://bunyodtour.tj'}/driver-login.html">Перейти в личный кабинет</a></p>
                </div>
              `
            });
            console.log(`📧 [VERIFY-ALIF] Driver notification sent to: ${driver.email}`);
          } catch (emailError) {
            console.error('❌ [VERIFY-ALIF] Failed to send driver email:', emailError);
          }
        }
      }
      
      console.log(`✅ [VERIFY-ALIF] AlifPay order ${orderNumber} marked as paid`);
      
      setImmediate(async () => {
        try {
          if (!order.customer) return;
          
          const isTourOrder = order.orderNumber.startsWith('BT-');
          const isGuideHire = order.orderNumber.startsWith('GH-');
          const isTransfer = order.orderNumber.startsWith('TR-');
          const orderTypeText = isTourOrder ? 'Тур' : isGuideHire ? 'Найм гида' : isTransfer ? 'Трансфер' : 'Услуга';
          
          console.log('📧 [VERIFY-ALIF] Starting email process for:', order.orderNumber, 'Type:', orderTypeText);
          
          if (isTourOrder || order.tour || order.tourId) {
            const existingBooking = await prisma.booking.findFirst({
              where: { orderId: order.id },
              include: { tour: true, hotel: true }
            });
            
            let tourData = order.tour;
            if (!tourData && existingBooking?.tour) tourData = existingBooking.tour;
            if (!tourData && order.tourId) tourData = await prisma.tour.findUnique({ where: { id: order.tourId } });
            
            if (!existingBooking) {
              console.log('📧 [VERIFY-ALIF] Creating booking from order...');
              await createBookingFromOrder(order.id);
            } else {
              await prisma.booking.update({
                where: { id: existingBooking.id },
                data: { status: 'paid' }
              });
            }
            
            if (tourData) {
              try {
                await sendBookingConfirmation(order, order.customer, tourData);
                console.log('✅ [VERIFY-ALIF] PDF ticket email sent successfully');
              } catch (pdfError) {
                console.error('❌ [VERIFY-ALIF] PDF email failed, using fallback:', pdfError);
                await emailService.sendPaymentConfirmation(order, order.customer);
              }
              await emailService.sendAdminNotification(order, order.customer, tourData);
            } else {
              await emailService.sendPaymentConfirmation(order, order.customer);
            }
          } else {
            const orderType = isGuideHire ? 'guideHire' : isTransfer ? 'transfer' : 'other';
            let detailsData: any = {};
            
            if (isGuideHire && order.guideHireRequest?.guide) {
              const guide = order.guideHireRequest.guide;
              const lang = order.language === 'en' ? 'en' : 'ru';
              const guideName = typeof guide.name === 'object' && guide.name !== null 
                ? (guide.name as any)[lang] || (guide.name as any).ru || (guide.name as any).en 
                : String(guide.name || '');
              detailsData = {
                guideName,
                guideLanguages: guide.languages,
                selectedDates: order.guideHireRequest.selectedDates,
                numberOfDays: order.guideHireRequest.numberOfDays,
                pricePerDay: guide.pricePerDay
              };
            } else if (isTransfer && order.transferRequest) {
              const transfer = order.transferRequest;
              const vehicle = (transfer as any).vehicle;
              const tDriver = (transfer as any).assignedDriver || vehicle?.driver;
              const lang = order.language === 'en' ? 'en' : 'ru';
              const tDriverName = tDriver ? (typeof tDriver.name === 'object' ? ((tDriver.name as any)[lang] || (tDriver.name as any).ru || (tDriver.name as any).en) : String(tDriver.name || '')) : undefined;
              detailsData = {
                pickupLocation: transfer.pickupLocation,
                dropoffLocation: transfer.dropoffLocation,
                date: transfer.pickupDate,
                dropoffDate: (transfer as any).dropoffDate,
                rentalDays: (transfer as any).rentalDays,
                pickupTime: (transfer as any).pickupTime,
                passengers: (transfer as any).numberOfPeople,
                vehicleType: vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() : undefined,
                driverName: tDriverName
              };
            }
            
            await sendNonTourPaymentConfirmation(order, order.customer, orderType as any, detailsData);
            
            const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
            await emailService.sendEmail({
              to: adminEmail,
              subject: `💰 AlifPay платёж подтверждён: ${orderTypeText} - ${order.totalAmount} TJS`,
              html: `
                <div style="font-family: Arial, sans-serif;">
                  <h2>💰 AlifPay платёж подтверждён (auto-verify)</h2>
                  <p><strong>Заказ:</strong> ${order.orderNumber}</p>
                  <p><strong>Клиент:</strong> ${order.customer.fullName} (${order.customer.email})</p>
                  <p><strong>Сумма:</strong> ${order.totalAmount} TJS</p>
                </div>
              `
            });
          }
          
          console.log('✅ [VERIFY-ALIF] All emails sent for:', order.orderNumber);
        } catch (emailError) {
          console.error('❌ [VERIFY-ALIF] Failed to send emails:', emailError);
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
    }
    
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

router.get('/alif/callback', (req: Request, res: Response): void => {
  console.log('🔍 AlifPay callback GET received, query:', JSON.stringify(req.query));
  if (req.query.orderId || req.query.order_id || req.query.orderid) {
    alifController.callback(req, res);
    return;
  }
  res.json({ status: 'ok', service: 'alifpay-callback', timestamp: new Date().toISOString() });
});

export default router;