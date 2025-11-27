import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
import crypto from 'crypto';
import axios from 'axios';

export const paylerController = {
  /**
   * Создать платеж через Payler StartSession API
   * POST /api/payments/payler/create
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

      // Получить данные заказа
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

      // 🔒 SECURITY: Payment revalidation для custom tour orders
      if (orderNumber.startsWith('CT-')) {
        try {
          const customTourData = JSON.parse(order.wishes || '{}');
          
          if (customTourData.type !== 'custom_tour' || !customTourData.selectedComponents) {
            console.error('❌ Custom tour payment validation failed: Invalid order data');
            return res.status(400).json({
              success: false,
              message: 'Недействительный заказ собственного тура',
            });
          }

          // Пересчитать цену на основе актуальных данных компонентов
          const componentIds = customTourData.selectedComponents.map((c: any) => c.id);
          const dbComponents = await prisma.customTourComponent.findMany({
            where: {
              id: { in: componentIds },
              isActive: true
            }
          });

          if (dbComponents.length !== customTourData.selectedComponents.length) {
            console.error('❌ Custom tour payment validation failed: Some components unavailable');
            return res.status(400).json({
              success: false,
              message: 'Некоторые компоненты тура больше недоступны',
            });
          }

          let expectedPrice = 0;
          for (const component of customTourData.selectedComponents) {
            const dbComponent = dbComponents.find((c: any) => c.id === component.id);
            if (!dbComponent) {
              return res.status(400).json({
                success: false,
                message: `Компонент ${component.id} не найден`,
              });
            }
            expectedPrice += dbComponent.price * (component.quantity || 1);
          }

          expectedPrice = Math.round(expectedPrice * 100) / 100;

          if (Math.abs(order.totalAmount - expectedPrice) > 0.01) {
            console.error(`❌ Custom tour payment validation failed: Expected ${expectedPrice}, got ${order.totalAmount}`);
            return res.status(400).json({
              success: false,
              message: 'Цены компонентов изменились. Пожалуйста, создайте новый заказ.',
              expectedPrice,
              currentPrice: order.totalAmount
            });
          }

          console.log(`✅ Custom tour payment validated: ${expectedPrice} TJS`);
        } catch (error) {
          console.error('❌ Custom tour payment validation error:', error);
          return res.status(400).json({
            success: false,
            message: 'Ошибка валидации заказа собственного тура',
          });
        }
      }

      const paylerKey = process.env.PAYLER_KEY;
      const frontendUrl = process.env.FRONTEND_URL || 'https://bunyodtour.tj';

      if (!paylerKey) {
        return res.status(500).json({
          success: false,
          message: 'Payler configuration missing (PAYLER_KEY)',
        });
      }

      // Преобразовать сумму в дирамы (минимальная единица TJS = 1 дирам = 0.01 TJS)
      // Умножить на 100 для конвертации в дирамы
      const amount = Math.round(order.totalAmount * 100);
      const orderId = order.id.toString();

      // URLs для возврата (используем FRONTEND_URL для production)
      const returnUrl = `${frontendUrl}/payment-success?orderNumber=${orderNumber}`;
      const failUrl = `${frontendUrl}/payment-fail?orderNumber=${orderNumber}`;

      // Email клиента (обязательный параметр)
      const customerEmail = order.customer?.email || 'noemail@bunyodtour.com';

      console.log(`🔄 Creating Payler payment: Order ${orderId}, Amount ${amount} дирамов (${order.totalAmount} TJS)`);

      // Подготовить данные для StartSession API согласно документации Payler
      const fields = {
        key: paylerKey,
        type: 'OneStep',  // Одностадийный платеж (авторизация + списание)
        currency: 'TJS',   // Таджикский сомони
        amount: amount.toString(),
        order_id: orderId,
        email: customerEmail,  // Обязательный параметр
        return_url_success: returnUrl,  // URL при успехе
        return_url_decline: failUrl      // URL при отказе
      };

      console.log('📤 Payler request:', { ...fields, key: '***' });

      // Отправить запрос к боевому Payler StartSession API (убрали sandbox)
      const response = await axios.post('https://secure.payler.com/gapi/StartSession', 
        new URLSearchParams(fields).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        validateStatus: () => true,
      });

      console.log('📥 Payler response status:', response.status, response.statusText);

      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      console.log('📥 Payler response body:', responseText);

      if (response.status < 200 || response.status >= 300) {
        console.error('❌ Payler StartSession failed:', response.status, response.statusText);
        return res.status(500).json({
          success: false,
          message: 'Failed to communicate with Payler API',
          details: responseText,
        });
      }

      // Парсим ответ
      let responseData;
      try {
        responseData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch {
        // Если не JSON, пытаемся извлечь session_id из строки
        const sessionIdMatch = responseText.match(/session_id=([^&\s]+)/);
        if (sessionIdMatch) {
          responseData = { session_id: sessionIdMatch[1] };
        } else {
          throw new Error('Invalid response format');
        }
      }

      if (!responseData.session_id) {
        console.error('❌ No session_id in Payler response:', responseData);
        return res.status(500).json({
          success: false,
          message: 'Failed to create Payler session',
          error: responseData.error?.message || 'Unknown error',
        });
      }

      const sessionId = responseData.session_id;

      // Обновить заказ в БД
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: 'payler',
          paymentStatus: 'processing',
          paymentIntentId: sessionId,
        },
      });

      console.log(`✅ Payler session created: ${sessionId}`);

      // Вернуть URL для редиректа
      const redirectUrl = `https://secure.payler.com/gapi/Pay/?session_id=${sessionId}`;

      return res.json({
        success: true,
        data: {
          sessionId,
          paymentUrl: redirectUrl
        }
      });

    } catch (error) {
      console.error('❌ Payler createPayment error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create Payler payment',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Получение статуса платежа через GetStatus API
   * Используется для проверки текущего статуса платежа
   */
  async getStatus(orderId: string): Promise<any> {
    try {
      const paylerKey = process.env.PAYLER_KEY;
      
      if (!paylerKey) {
        throw new Error('Payler configuration missing (PAYLER_KEY)');
      }

      const params = {
        key: paylerKey,
        order_id: orderId
      };

      console.log(`🔍 Checking Payler status for order: ${orderId}`);

      const response = await axios.post('https://secure.payler.com/gapi/GetStatus',
        new URLSearchParams(params).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        console.error('❌ Payler GetStatus failed:', response.status);
        throw new Error(`GetStatus failed with status ${response.status}`);
      }

      // Защитная обработка ответа (может быть строка или JSON)
      let statusData;
      try {
        statusData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (parseError) {
        console.error('❌ Failed to parse GetStatus response:', response.data);
        throw new Error('Invalid GetStatus response format');
      }

      console.log('✅ Payler status retrieved:', statusData);

      return statusData;
    } catch (error) {
      console.error('❌ GetStatus error:', error);
      throw error;
    }
  },

  /**
   * Обработка callback от Payler (webhook)
   * POST /api/payments/payler/callback
   * Согласно документации Payler:
   * - Callback отправляет только order_id в POST запросе
   * - Статус платежа нужно получать через GetStatus API
   * - IP источника: 178.20.235.180
   * - Требуется вернуть HTTP 2xx для успеха
   */
  async callback(req: Request, res: Response) {
    try {
      // Payler отправляет order_id в теле POST запроса
      const { order_id } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress;
      
      console.log('🔔 Payler callback received:', { order_id, clientIp });

      if (!order_id) {
        console.error('❌ Missing order_id in Payler callback');
        return res.status(400).json({
          success: false,
          message: 'Missing order_id'
        });
      }

      // Проверка IP источника для безопасности
      // Payler отправляет callback с IP: 178.20.235.180
      const paylerIp = '178.20.235.180';
      const forwardedFor = req.headers['x-forwarded-for'] as string;
      const sourceIp = forwardedFor ? forwardedFor.split(',')[0].trim() : clientIp;
      
      if (sourceIp && sourceIp !== paylerIp && !sourceIp.includes('127.0.0.1') && !sourceIp.includes('::1')) {
        console.warn('⚠️ Callback from unexpected IP:', sourceIp, '(expected:', paylerIp + ')');
        // Не блокируем запрос, только логируем для мониторинга
      }

      // Получить актуальный статус платежа через GetStatus API
      let statusData;
      try {
        statusData = await paylerController.getStatus(order_id);
      } catch (statusError) {
        console.error('❌ Failed to get payment status:', statusError);
        // Возвращаем 200, чтобы Payler не повторял callback
        return res.status(200).json({
          success: false,
          message: 'Failed to retrieve status'
        });
      }

      const status = statusData.status;
      const transactionId = statusData.transaction_id || statusData.session_id;
      console.log(`📊 Payment status for order ${order_id}:`, status, 'Transaction ID:', transactionId);

      // Найти заказ в базе данных с полными данными для email билета
      const order = await prisma.order.findUnique({
        where: { id: Number(order_id) },
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
        console.error('❌ Order not found for Payler callback:', order_id);
        // Возвращаем 200, чтобы Payler не повторял callback
        return res.status(200).json({
          success: false,
          message: 'Order not found'
        });
      }

      // ✅ Обновить статус платежа на основе статуса из GetStatus
      // Статусы Payler: Charged (успешно), Refunded (возврат), Authorized (заблокировано), Rejected (отклонено)
      if (status === 'Charged') {
        await prisma.order.update({
          where: { id: Number(order_id) },
          data: {
            paymentStatus: 'paid',
            status: 'confirmed', // Обновляем статус заказа
            // Сохраняем transaction_id или session_id для отображения в админке
            ...(transactionId && !order.paymentIntentId ? { paymentIntentId: transactionId } : {}),
          },
        });

        console.log('✅ Payment confirmed for order:', order_id);

        // CUSTOM TOUR: Update CustomTourOrder status after successful payment
        if (order.orderNumber.startsWith('CT-')) {
          try {
            if (!order.customer) {
              console.error(`❌ Cannot process CustomTourOrder: customer is null for order ${order.orderNumber}`);
              return res.status(200).json({ success: true });
            }

            // Defensive: Parse wishes safely
            let customTourData;
            try {
              customTourData = order.wishes ? JSON.parse(order.wishes) : null;
            } catch (parseError) {
              console.error(`❌ Failed to parse order.wishes for ${order.orderNumber}:`, parseError);
              // Return 200 to prevent Payler retry
              return res.status(200).json({ success: true });
            }

            // Update CustomTourOrder status to 'paid' (already created in createDirectCustomTourOrder)
            const updatedCustomOrder = await prisma.customTourOrder.updateMany({
              where: { orderNumber: order.orderNumber },
              data: { status: 'paid' }
            });

            if (updatedCustomOrder.count === 0) {
              console.warn(`⚠️ CustomTourOrder not found for ${order.orderNumber}, may need manual check`);
            } else {
              console.log(`✅ CustomTourOrder status updated to 'paid' for order ${order.orderNumber}`);
            }

            // Send simple confirmation email to tourist
            try {
              const touristEmail = order.customer.email;
              if (touristEmail) {
                const countries = customTourData?.selectedCountries || [];
                const countriesText = countries.length > 0 ? countries.join(', ') : 'Центральная Азия';
                
                await emailService.sendEmail({
                  to: touristEmail,
                  subject: `Оплата принята - Собственный тур ${order.orderNumber}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #3E3E3E;">Спасибо за оплату!</h2>
                      
                      <p>Здравствуйте, ${order.customer.fullName}!</p>
                      
                      <p>Ваш платеж успешно получен.</p>
                      
                      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Детали заказа</h3>
                        <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                        <p><strong>Направления:</strong> ${countriesText}</p>
                        <p><strong>Продолжительность:</strong> ${customTourData?.totalDays || 0} дней</p>
                        <p><strong>Оплачено:</strong> ${order.totalAmount} TJS</p>
                      </div>

                      <p>Наш менеджер свяжется с вами в ближайшее время для подтверждения деталей тура.</p>
                      
                      <p>С уважением,<br><strong>Команда Bunyod Tour</strong></p>
                      
                      <p style="font-size: 12px; color: #666; margin-top: 30px;">
                        Если у вас есть вопросы, свяжитесь с нами:<br>
                        📧 Email: info@bunyodtour.tj<br>
                        📞 Телефоны: +992 44 625 7575; +992 93-126-1134<br>
                        📞 +992 00-110-0087; +992 88-235-3434<br>
                        🌐 Сайт: bunyodtour.tj
                      </p>
                    </div>
                  `
                });
                
                console.log(`✅ Confirmation email sent to tourist: ${touristEmail}`);
              }
            } catch (emailError) {
              console.error('❌ Failed to send tourist confirmation email:', emailError);
              // Don't fail the payment
            }

            // Email admin was already sent when order was created
            console.log(`ℹ️ Custom tour order ${order.orderNumber} paid - tourist notified`);
            return res.status(200).json({ success: true });

          } catch (customTourError) {
            console.error('❌ Failed to process CustomTourOrder payment:', customTourError);
            // Return 200 even on error to prevent Payler retry
            return res.status(200).json({ success: true });
          }
        }

        // REGULAR ORDERS: Send email confirmations
        // (CT orders return early above, so we only reach here for tour/transfer/guide orders)
        try {
          if (!order.customer) {
            console.warn('⚠️ Order has no customer, skipping email notifications');
            return res.status(200).json({ success: true });
          }

          if (order.tour) {
            // Оплата тура - стандартный email с PDF билетом
            await emailService.sendPaymentConfirmation(order, order.customer);
            await emailService.sendAdminNotification(order, order.customer, order.tour);
            console.log('✅ Tour payment emails sent');
          } else {
            // Оплата гида/трансфера - детальное уведомление
            const isGuideHire = order.orderNumber.startsWith('GH-');
            const isTransfer = order.orderNumber.startsWith('TR-');
            const isCustomTour = order.orderNumber.startsWith('CT-');
            
            const orderTypeText = isGuideHire ? 'Найм гида' 
              : isTransfer ? 'Трансфер'
              : isCustomTour ? 'Собственный тур'
              : 'Услуга';

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
                    <p style="margin: 5px 0;">📞 +992 44 625 7575; +992 93-126-1134</p>
                    <p style="margin: 5px 0;">📞 +992 00-110-0087; +992 88-235-3434</p>
                    <p style="margin: 5px 0;">✉️ info@bunyodtour.tj</p>
                    <p style="margin: 5px 0;">🌐 <a href="https://bunyodtour.tj" style="color: #10b981;">bunyodtour.tj</a></p>
                    <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">Туристическая платформа Центральной Азии</p>
                  </div>
                </div>
              `
            });

            // Email админу
            await emailService.sendEmail({
              to: process.env.ADMIN_EMAIL || 'admin@bunyodtour.tj',
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
            console.log('✅ Non-tour payment emails sent');
          }
        } catch (emailError) {
          console.error('❌ Email sending failed:', emailError);
        }
      } else if (status === 'Refunded') {
        await prisma.order.update({
          where: { id: Number(order_id) },
          data: {
            paymentStatus: 'refunded',
          },
        });
        console.log('💰 Payment refunded for order:', order_id);
      } else if (status === 'Rejected') {
        await prisma.order.update({
          where: { id: Number(order_id) },
          data: {
            paymentStatus: 'failed',
          },
        });
        console.log('⚠️ Payment rejected for order:', order_id);
      } else {
        console.log(`ℹ️ Payment status for order ${order_id}:`, status);
      }

      // ВАЖНО: Вернуть HTTP 200 для подтверждения получения callback
      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('❌ Payler callback error:', error);
      // Возвращаем 200 даже при ошибке, чтобы Payler не повторял callback
      return res.status(200).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  /**
   * Возврат средств клиенту (Refund)
   * POST /api/payments/payler/refund
   * Используется для полного или частичного возврата средств
   */
  async refund(req: Request, res: Response) {
    try {
      const { orderId, amount } = req.body;

      console.log('💰 Payler refund request:', { orderId, amount });

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: 'Missing orderId'
        });
      }

      const paylerKey = process.env.PAYLER_KEY;
      const paylerPassword = process.env.PAYLER_PASSWORD;

      if (!paylerKey || !paylerPassword) {
        console.error('❌ Payler configuration missing (PAYLER_KEY or PAYLER_PASSWORD)');
        return res.status(500).json({
          success: false,
          message: 'Payment configuration error',
        });
      }

      // Получить информацию о заказе
      const order = await prisma.order.findUnique({
        where: { id: Number(orderId) },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Проверить, что заказ оплачен
      if (order.paymentStatus !== 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Order is not paid, cannot refund'
        });
      }

      // Сумма возврата (в дирамах, минимальная единица TJS)
      // Если amount не указан, возвращаем полную сумму
      const refundAmount = amount ? Math.round(amount * 100) : Math.round(order.totalAmount * 100);

      // Валидация суммы возврата
      if (refundAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount must be positive'
        });
      }

      const paidAmount = Math.round(order.totalAmount * 100);
      if (refundAmount > paidAmount) {
        return res.status(400).json({
          success: false,
          message: `Refund amount (${refundAmount / 100} TJS) cannot exceed paid amount (${paidAmount / 100} TJS)`
        });
      }

      console.log(`🔄 Refunding ${refundAmount} дирамов (${refundAmount / 100} TJS) for order ${orderId}`);

      // Подготовить данные для Refund API
      const fields = {
        key: paylerKey,
        password: paylerPassword,
        order_id: orderId,
        amount: refundAmount.toString()
      };

      // Отправить запрос к Payler Refund API
      const response = await axios.post('https://secure.payler.com/gapi/Refund',
        new URLSearchParams(fields).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        validateStatus: () => true,
      });

      console.log('📥 Payler refund response status:', response.status);

      if (response.status < 200 || response.status >= 300) {
        console.error('❌ Payler refund failed:', response.status, response.data);
        return res.status(500).json({
          success: false,
          message: 'Failed to process refund',
          details: response.data,
        });
      }

      // Защитная обработка ответа (может быть строка или JSON)
      let responseData;
      try {
        responseData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (parseError) {
        console.error('❌ Failed to parse Refund response:', response.data);
        return res.status(500).json({
          success: false,
          message: 'Invalid refund response format',
        });
      }

      console.log('✅ Payler refund successful:', responseData);

      // Обновить статус заказа
      await prisma.order.update({
        where: { id: Number(orderId) },
        data: {
          paymentStatus: 'refunded',
        },
      });

      console.log(`✅ Order ${orderId} marked as refunded`);

      return res.json({
        success: true,
        message: 'Refund processed successfully',
        data: responseData
      });

    } catch (error) {
      console.error('❌ Payler refund error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to process refund',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};