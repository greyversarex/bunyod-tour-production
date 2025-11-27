import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
import crypto from 'crypto';

export const alifController = {
  /**
   * Создать платеж через AlifPay Legacy (POST форма на https://web.alif.tj/)
   * POST /api/payments/alif/create
   */
  async createPayment(req: Request, res: Response) {
    try {
      const { orderNumber } = req.body;

      if (!orderNumber) {
        return res.status(400).json({
          success: false,
          message: 'Order number is required',
        });
      }

      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          customer: true,
          tour: true,
          transferRequest: {
            include: {
              assignedDriver: true
            }
          },
          guideHireRequest: {
            include: {
              guide: true
            }
          }
        },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      // 🔒 SECURITY: Payment revalidation для guide hire orders
      if (order.guideHireRequestId && order.guideHireRequest) {
        const guideHireRequest = order.guideHireRequest;
        const guide = guideHireRequest.guide;

        if (!guide) {
          return res.status(404).json({
            success: false,
            message: 'Guide not found for hire request',
          });
        }

        // Проверить что у тургида установлена цена
        if (!guide.pricePerDay || guide.pricePerDay <= 0) {
          console.error(`❌ Guide hire payment validation failed: Guide has no price`);
          return res.status(400).json({
            success: false,
            message: 'У тургида не установлена цена',
          });
        }

        // Пересчитать ожидаемую цену на основе актуальных данных тургида
        const expectedPrice = guide.pricePerDay * guideHireRequest.numberOfDays;

        // Сравнить с суммой в заказе (допускаем погрешность 0.01 из-за округления)
        if (Math.abs(order.totalAmount - expectedPrice) > 0.01) {
          console.error(`❌ Guide hire payment validation failed: Expected ${expectedPrice}, got ${order.totalAmount}`);
          return res.status(400).json({
            success: false,
            message: 'Цена тургида изменилась. Пожалуйста, создайте новый заказ с актуальной ценой.',
            expectedPrice,
            currentPrice: order.totalAmount
          });
        }

        // Проверить что заявка на найм все еще активна (confirmed)
        // ВАЖНО: Даты УЖЕ удалены из availableDates при создании заказа, это нормально
        if (guideHireRequest.status !== 'confirmed') {
          console.error(`❌ Guide hire payment validation failed: Request status is ${guideHireRequest.status}`);
          return res.status(400).json({
            success: false,
            message: `Заявка на найм недействительна (статус: ${guideHireRequest.status})`,
          });
        }

        console.log(`✅ Guide hire payment validated: ${guide.pricePerDay} x ${guideHireRequest.numberOfDays} days = ${expectedPrice} TJS`);
      }

      const key = process.env.ALIF_MERCHANT_KEY;
      const password = process.env.ALIF_MERCHANT_PASSWORD;
      const frontendUrl = process.env.FRONTEND_URL || 'https://bunyodtour.tj';
      const baseUrl = process.env.BASE_URL || 'https://api.bunyodtour.tj';

      if (!key || !password) {
        return res.status(500).json({
          success: false,
          message: 'AlifPay configuration missing (ALIF_MERCHANT_KEY, ALIF_MERCHANT_PASSWORD)',
        });
      }

      const orderId = order.id.toString();
      const amount = order.totalAmount;
      const callbackUrl = `${baseUrl}/api/payments/alif/callback`;
      const returnUrl = frontendUrl;
      const info = `Оплата тура №${orderId}`;
      const email = order.customer.email;
      const phone = order.customer.phone || '';
      const gate = 'vsa';

      const amountFormatted = amount.toFixed(2);
      
      const secretkey = crypto.createHmac('sha256', key).update(password).digest('hex');
      const token = crypto.createHmac('sha256', secretkey)
        .update(key + orderId + amountFormatted + callbackUrl)
        .digest('hex');

      console.log(`🔄 Creating AlifPay Legacy payment: Order ${orderId}, Amount ${amount} TJS`);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: 'alif',
          paymentStatus: 'processing',
        },
      });

      return res.json({
        success: true,
        data: {
          method: 'POST',
          action: 'https://web.alif.tj/',
          formData: {
            key,
            token,
            orderId,
            amount: amountFormatted,
            callbackUrl,
            returnUrl,
            info,
            email,
            phone,
            gate
          }
        }
      });

    } catch (error) {
      console.error('❌ AlifPay createPayment error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create AlifPay payment',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Обработка callback от AlifPay Legacy
   * POST /api/payments/alif/callback
   */
  async callback(req: Request, res: Response) {
    try {
      const { orderId, status, transactionId } = req.body;
      
      console.log('🔄 AlifPay Legacy callback received:', { orderId, status, transactionId });

      if (!orderId || !status) {
        console.error('❌ Missing required fields in AlifPay callback');
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      const key = process.env.ALIF_MERCHANT_KEY;
      const password = process.env.ALIF_MERCHANT_PASSWORD;
      
      if (!key || !password) {
        console.error('❌ AlifPay configuration missing for callback validation');
        return res.status(500).json({
          success: false,
          message: 'Payment configuration error'
        });
      }

      const order = await prisma.order.findUnique({
        where: { id: Number(orderId) },
        include: {
          customer: true,
          tour: true,
          hotel: true,
          guide: true,
          transferRequest: {
            include: {
              assignedDriver: true
            }
          },
          guideHireRequest: {
            include: {
              guide: true
            }
          }
        },
      });

      if (!order) {
        console.error('❌ Order not found for AlifPay callback:', orderId);
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Нормализуем статус (приводим к нижнему регистру для сравнения)
      const normalizedStatus = status?.toLowerCase();
      
      // Список успешных статусов от Alif
      const successStatuses = ['ok', 'success', 'paid', 'charged', 'complete', 'completed', '1', 'true'];
      
      console.log('📊 Alif status check:', { 
        originalStatus: status, 
        normalizedStatus, 
        isSuccess: successStatuses.includes(normalizedStatus) 
      });
      
      if (successStatuses.includes(normalizedStatus)) {
        await prisma.order.update({
          where: { id: Number(orderId) },
          data: {
            paymentStatus: 'paid',
            status: 'confirmed', // Обновляем статус заказа
            paymentIntentId: transactionId || null,
          },
        });

        console.log('✅ Payment confirmed for order:', orderId);

        // Отправить email подтверждение клиенту и уведомление администратору
        
        // GUARD: Check customer exists FIRST before any logging that accesses customer properties
        if (!order.customer) {
          console.warn('⚠️ Order', order.orderNumber, 'has no customer relation, skipping email notifications');
          console.warn('⚠️ This may indicate missing data - order was marked as paid but notifications skipped');
          return res.json({ success: true });
        }
        
        console.log('📧 Starting email notification process for order:', order.orderNumber);
        console.log('📧 Order type:', order.tour ? 'Tour' : (order.orderNumber.startsWith('GH-') ? 'Guide Hire' : (order.orderNumber.startsWith('TR-') ? 'Transfer' : 'Other')));
        console.log('📧 Customer:', { email: order.customer.email, name: order.customer.fullName });
        
        try {
          if (order.tour) {
            // Оплата тура - стандартный email с PDF билетом
            console.log('📧 Sending tour payment confirmation email to:', order.customer.email);
            await emailService.sendPaymentConfirmation(order, order.customer);
            console.log('📧 Sending admin notification for tour payment');
            await emailService.sendAdminNotification(order, order.customer, order.tour);
            console.log('✅ Tour payment emails sent successfully');
          } else {
            // Оплата гида/трансфера/собственного тура - детальное уведомление
            const isGuideHire = order.orderNumber.startsWith('GH-');
            const isTransfer = order.orderNumber.startsWith('TR-');
            const isCustomTour = order.orderNumber.startsWith('CT-');
            
            console.log('📧 Non-tour payment detected:', { isGuideHire, isTransfer, isCustomTour, orderNumber: order.orderNumber });
            
            const orderTypeText = isGuideHire ? 'Найм гида' 
              : isTransfer ? 'Трансфер'
              : isCustomTour ? 'Собственный тур'
              : 'Услуга';
            
            console.log('📧 Preparing email for:', orderTypeText);

            // Формируем детали заказа
            let detailsHTML = '';
            
            if (isGuideHire && order.guideHireRequest?.guide) {
              const guide = order.guideHireRequest.guide;
              const guideName = typeof guide.name === 'object' && guide.name !== null ? (guide.name as any).ru || (guide.name as any).en || 'Не указано' : String(guide.name || 'Не указано');
              
              detailsHTML = `
                <p><strong>Гид:</strong> ${guideName}</p>
                <p><strong>Языки:</strong> ${guide.languages || 'не указаны'}</p>
                <p><strong>Выбранные даты:</strong> ${order.guideHireRequest.selectedDates || 'не указаны'}</p>
                <p><strong>Количество дней:</strong> ${order.guideHireRequest.numberOfDays}</p>
                <p><strong>Цена за день:</strong> ${guide.pricePerDay} TJS</p>
              `;
            } else if (isTransfer && order.transferRequest) {
              const transfer = order.transferRequest;
              
              detailsHTML = `
                <p><strong>Откуда:</strong> ${transfer.pickupLocation || 'не указано'}</p>
                <p><strong>Куда:</strong> ${transfer.dropoffLocation || 'не указано'}</p>
                <p><strong>Дата:</strong> ${transfer.pickupDate || 'не указана'}</p>
                <p><strong>Время:</strong> ${transfer.pickupTime || 'не указано'}</p>
                <p><strong>Количество человек:</strong> ${transfer.numberOfPeople || 1}</p>
                ${transfer.specialRequests ? `<p><strong>Пожелания:</strong> ${transfer.specialRequests}</p>` : ''}
              `;
            } else {
              detailsHTML = `
                <p><strong>Дата:</strong> ${order.tourDate ? new Date(order.tourDate).toLocaleDateString('ru-RU') : 'не указана'}</p>
              `;
            }

            // Email клиенту
            console.log('📧 Sending customer email to:', order.customer.email);
            await emailService.sendEmail({
              to: order.customer.email,
              subject: `✅ Оплата подтверждена - ${orderTypeText}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0;">✅ Оплата подтверждена!</h1>
                  </div>
                  
                  <div style="padding: 30px;">
                    <p style="font-size: 16px;">Уважаемый(ая) <strong>${order.customer.fullName}</strong>,</p>
                    <p>Благодарим за оплату! Ваш заказ успешно обработан.</p>
                    
                    <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      <h2 style="margin-top: 0; color: #059669; font-size: 20px;">📋 Детали заказа</h2>
                      <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                      <p><strong>Услуга:</strong> ${orderTypeText}</p>
                      ${detailsHTML}
                      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                      <p style="font-size: 18px; color: #059669;"><strong>Итого:</strong> ${order.totalAmount} TJS</p>
                      <p style="color: #10b981; font-size: 14px;">✓ Оплачено</p>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 25px 0;">
                      <p style="margin: 0;"><strong>ℹ️ Важно:</strong> Сохраните этот номер заказа для связи с нами.</p>
                    </div>
                  </div>
                  
                  <div style="background: #3E3E3E; color: white; padding: 30px; text-align: center;">
                    <h3 style="margin-top: 0;">Bunyod-Tour</h3>
                    <p style="margin: 5px 0;">📍 Душанбе, Таджикистан</p>
                    <p style="margin: 5px 0;">📞 Телефон: +992 XXX XXX XXX</p>
                    <p style="margin: 5px 0;">✉️ Email: info@bunyodtour.tj</p>
                    <p style="margin: 5px 0;">🌐 Сайт: <a href="https://bunyodtour.tj" style="color: #10b981;">bunyodtour.tj</a></p>
                    <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">Туристическая платформа Центральной Азии</p>
                  </div>
                </div>
              `
            });
            
            console.log('📧 Customer email sent successfully');

            // Email админу
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@bunyodtour.tj';
            console.log('📧 Sending admin notification to:', adminEmail);
            await emailService.sendEmail({
              to: adminEmail,
              subject: `💰 Новый платеж: ${orderTypeText} - ${order.totalAmount} TJS`,
              html: `
                <div style="font-family: Arial, sans-serif;">
                  <h2>💰 Получен новый платеж!</h2>
                  <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                  <p><strong>Услуга:</strong> ${orderTypeText}</p>
                  <p><strong>Клиент:</strong> ${order.customer.fullName} (${order.customer.email})</p>
                  <p><strong>Сумма:</strong> ${order.totalAmount} TJS</p>
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/admin-dashboard.html">Перейти в админ панель</a>
                </div>
              `
            });
            console.log('✅ Non-tour payment emails sent successfully to customer and admin');
          }
        } catch (emailError) {
          console.error('❌ Email sending failed for order:', order.orderNumber);
          console.error('❌ Email error details:', emailError);
          // Логируем полный стек ошибки для диагностики
          if (emailError instanceof Error) {
            console.error('❌ Email error stack:', emailError.stack);
          }
        }
      } else {
        await prisma.order.update({
          where: { id: Number(orderId) },
          data: {
            paymentStatus: 'failed',
          },
        });
        console.log('⚠️ Payment failed for order:', orderId, 'with status:', status);
      }

      return res.json({ success: true });

    } catch (error) {
      console.error('❌ AlifPay callback error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
};
