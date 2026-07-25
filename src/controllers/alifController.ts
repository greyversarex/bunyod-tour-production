import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
import { sendBookingConfirmation, sendNonTourPaymentConfirmation } from '../services/emailServiceSendGrid';
import { createBookingFromOrder } from '../services/paymentService';
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
              assignedDriver: true,
              vehicle: {
                include: {
                  driver: true
                }
              }
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

        // Проверить что заявка на найм все еще активна (confirmed или approved)
        // ВАЖНО: Даты УЖЕ удалены из availableDates при создании заказа, это нормально
        // 'confirmed' - для прямой оплаты без одобрения админа
        // 'approved' - для потока с одобрением админа
        const validStatuses = ['confirmed', 'approved'];
        if (!validStatuses.includes(guideHireRequest.status)) {
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

      // 🔒 SECURITY: Payment revalidation для transfer orders
      if (orderNumber.startsWith('TR-')) {
        const transferRequest = order.transferRequest;
        
        if (!transferRequest) {
          console.error(`❌ Transfer payment validation failed: TransferRequest not found for order ${orderNumber}`);
          return res.status(404).json({
            success: false,
            message: 'Заявка на трансфер не найдена',
          });
        }

        // Проверить что у трансфера установлена цена (за 1 день)
        const pricePerDay = transferRequest.finalPrice || transferRequest.estimatedPrice;
        if (!pricePerDay || pricePerDay <= 0) {
          console.error(`❌ Transfer payment validation failed: Transfer has no price set`);
          return res.status(400).json({
            success: false,
            message: 'Цена трансфера не установлена. Пожалуйста, обратитесь к администратору.',
          });
        }

        // ВАЖНО: estimatedPrice/finalPrice — цена за 1 день, итог = price × rentalDays + суточные водителя
        const rentalDays = Math.max(1, transferRequest.rentalDays || 1);
        // 🆕 Суточные расходы водителя: +300 TJS за каждый день после первого
        const driverDailyExpense = Math.max(0, rentalDays - 1) * 300;
        const expectedTotal = pricePerDay * rentalDays + driverDailyExpense;

        // 🆕 Учитываем опцию оплаты: для депозита ожидаем 10% от полной стоимости
        const trPayOpt = order.paymentOption || 'full';
        const trPctMul = trPayOpt === 'deposit' ? 0.1 : trPayOpt === 'deposit_25' ? 0.25 : 1;
        const expectedPayable = Math.round(expectedTotal * trPctMul * 100) / 100;

        // Сравнить с суммой в заказе (допускаем погрешность 0.01 из-за округления)
        if (Math.abs(order.totalAmount - expectedPayable) > 0.01) {
          console.error(`❌ Transfer payment validation failed: Expected ${expectedPayable} (${pricePerDay} × ${rentalDays} × ${trPctMul} [${trPayOpt}]), got ${order.totalAmount}`);
          return res.status(400).json({
            success: false,
            message: 'Цена трансфера изменилась. Пожалуйста, создайте новый заказ.',
            expectedPrice: expectedPayable,
            currentPrice: order.totalAmount
          });
        }

        // Проверить что заявка на трансфер активна
        const validTransferStatuses = ['confirmed', 'approved', 'pending'];
        if (!validTransferStatuses.includes(transferRequest.status)) {
          console.error(`❌ Transfer payment validation failed: Request status is ${transferRequest.status}`);
          return res.status(400).json({
            success: false,
            message: `Заявка на трансфер недействительна (статус: ${transferRequest.status})`,
          });
        }

        console.log(`✅ Transfer payment validated: ${expectedTotal} TJS (${pricePerDay} × ${rentalDays} days) for order ${orderNumber}`);
      }

      // Общая проверка суммы для всех типов заказов
      if (order.totalAmount <= 0) {
        console.error(`❌ Payment validation failed: Order amount is ${order.totalAmount}`);
        return res.status(400).json({
          success: false,
          message: 'Сумма заказа должна быть больше 0',
        });
      }

      const key = process.env.ALIF_MERCHANT_KEY;
      const password = process.env.ALIF_MERCHANT_PASSWORD;
      const frontendUrl = process.env.FRONTEND_URL || 'https://bunyodtour.tj';
      const baseUrl = process.env.BASE_URL || 'https://bunyodtour.tj';

      if (!key || !password) {
        return res.status(500).json({
          success: false,
          message: 'AlifPay configuration missing (ALIF_MERCHANT_KEY, ALIF_MERCHANT_PASSWORD)',
        });
      }

      const orderId = order.id.toString();
      
      // Сумма к оплате уже рассчитана в bookingController.createOrderFromBooking()
      // order.totalAmount уже содержит правильную сумму (10% для deposit, 100% для full)
      // НЕ пересчитываем здесь, чтобы избежать двойного применения скидки
      const paymentOption = req.body.paymentOption || order.paymentOption || 'full';
      const amount = order.totalAmount;
      
      const callbackUrl = `${baseUrl}/api/payments/alif/callback`;
      const verifyToken = crypto.createHmac('sha256', key).update(order.orderNumber + order.id).digest('hex').substring(0, 16);
      const lang = req.body.language || order.language || 'ru';
      const returnUrl = `${frontendUrl}/payment-success.html?orderNumber=${order.orderNumber}&vt=${verifyToken}&lang=${lang}`;
      
      // Определяем тип заказа для корректного описания
      const isGuideHire = orderNumber.startsWith('GH-');
      const isTransfer = orderNumber.startsWith('TR-');
      const isCustomTour = orderNumber.startsWith('CT-');
      const orderTypeText = isGuideHire ? 'Найм гида' 
        : isTransfer ? 'Трансфер'
        : isCustomTour ? 'Собственный тур'
        : 'Тур';
      const info = `${orderTypeText} №${orderId}${paymentOption === 'deposit' ? ' (Депозит 10%)' : ''}`;
      
      const email = order.customer.email;
      const phone = order.customer.phone || '';
      const gate = 'vsa';

      const amountFormatted = amount.toFixed(2);
      
      const secretkey = crypto.createHmac('sha256', key).update(password).digest('hex');
      const token = crypto.createHmac('sha256', secretkey)
        .update(key + orderId + amountFormatted + callbackUrl)
        .digest('hex');

      console.log(`🔄 Creating AlifPay payment:`);
      console.log(`   📋 Order: ${orderNumber} (${orderTypeText})`);
      console.log(`   💰 Amount: ${amount} TJS`);
      console.log(`   💳 Payment Option: ${paymentOption} (Total: ${order.totalAmount} TJS)`);
      console.log(`   📧 Customer: ${email}`);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: 'alif',
          paymentStatus: 'processing',
          paymentIntentId: verifyToken,
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
      console.log('🔄 ===== AlifPay Legacy callback received =====');
      console.log('🔄 [CALLBACK] Method:', req.method);
      console.log('🔄 [CALLBACK] Content-Type:', req.get('content-type'));
      console.log('🔄 [CALLBACK] Full body:', JSON.stringify(req.body));
      console.log('🔄 [CALLBACK] Query params:', JSON.stringify(req.query));
      console.log('🔄 [CALLBACK] IP:', req.ip);

      const body = req.body || {};
      const query = req.query || {};

      const orderId = body.orderId || body.order_id || body.orderid || body.OrderId || body.ORDER_ID
        || query.orderId || query.order_id || query.orderid;
      const status = body.status || body.Status || body.STATUS || body.state || body.State
        || query.status || query.Status;
      const transactionId = body.transactionId || body.transaction_id || body.transactionid 
        || body.TransactionId || body.TRANSACTION_ID || body.trans_id
        || query.transactionId || query.transaction_id;
      
      console.log('🔄 [CALLBACK] Parsed fields:', { orderId, status, transactionId });

      if (!orderId) {
        console.error('❌ Missing orderId in AlifPay callback. Body:', JSON.stringify(body), 'Query:', JSON.stringify(query));
        return res.status(400).json({
          success: false,
          message: 'Missing orderId'
        });
      }

      if (!status) {
        console.warn('⚠️ Missing status in AlifPay callback, will treat as success for orderId:', orderId);
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
          booking: {
            include: {
              tour: true,
              hotel: true
            }
          }, // 🎯 КРИТИЧНО: включаем связанный Booking с туром для email билета
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

      // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ EMAIL
      console.log('🔍 [ALIF CALLBACK] Order details:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.tour ? 'Tour' : (order.orderNumber.startsWith('GH-') ? 'Guide Hire' : (order.orderNumber.startsWith('TR-') ? 'Transfer' : (order.orderNumber.startsWith('CT-') ? 'Custom Tour' : 'Unknown'))),
        hasTour: !!order.tour,
        hasGuideHireRequest: !!order.guideHireRequest,
        guideHireGuide: order.guideHireRequest?.guide ? 'exists' : 'null',
        hasCustomer: !!order.customer,
        customerEmail: order.customer?.email || 'NO EMAIL',
        customerName: order.customer?.fullName || 'NO NAME',
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        // 🚗 TRANSFER DEBUG
        transferRequestId: order.transferRequestId || 'NULL',
        hasTransferRequest: !!order.transferRequest,
        transferVehicleId: order.transferRequest?.vehicleId || 'NULL',
        transferVehicleDriver: order.transferRequest?.vehicle?.driver ? 'exists' : 'NULL',
        transferAssignedDriver: order.transferRequest?.assignedDriver ? 'exists' : 'NULL'
      });

      const normalizedStatus = status ? String(status).toLowerCase().trim() : '';
      
      const successStatuses = ['ok', 'success', 'paid', 'charged', 'complete', 'completed', '1', 'true'];
      const failStatuses = ['fail', 'failed', 'error', 'declined', 'rejected', 'cancel', 'cancelled', '0', 'false'];
      
      const isSuccess = successStatuses.includes(normalizedStatus);
      const isFail = failStatuses.includes(normalizedStatus);
      
      console.log('📊 Alif status check:', { 
        originalStatus: status, 
        normalizedStatus, 
        isSuccess,
        isFail
      });
      
      if (!isSuccess && !isFail) {
        console.warn('⚠️ Unknown or missing status from AlifPay:', status);
        console.warn('⚠️ Full callback body for debugging:', JSON.stringify(req.body));
        console.log('✅ [ALIF CALLBACK] Treating as SUCCESS (AlifPay sends callback only for completed payments)');
      }
      
      const treatAsSuccess = isSuccess || (!isSuccess && !isFail);
      
      if (treatAsSuccess) {
        if (order.paymentStatus === 'paid') {
          console.log('ℹ️ [ALIF CALLBACK] Order already paid, skipping duplicate callback for:', orderId);
          return res.json({ success: true });
        }
        
        if (order.paymentStatus !== 'processing') {
          console.warn('⚠️ [ALIF CALLBACK] Order not in processing state:', order.paymentStatus, 'for orderId:', orderId);
          return res.json({ success: true });
        }
        
        await prisma.order.update({
          where: { id: Number(orderId) },
          data: {
            paymentStatus: 'paid',
            status: 'confirmed',
            paymentIntentId: transactionId || null,
          },
        });

        console.log('✅ Payment confirmed for order:', orderId);

        // 🚗 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Обновляем TransferRequest.paymentStatus ПЕРЕД проверкой customer
        console.log('🚗 [TRANSFER CHECK] order.transferRequestId =', order.transferRequestId, '| order.transferRequest =', order.transferRequest ? 'EXISTS' : 'NULL');
        if (order.transferRequestId) {
          console.log('🚗 [TRANSFER] Updating TransferRequest paymentStatus to paid for ID:', order.transferRequestId);
          try {
            await prisma.transferRequest.update({
              where: { id: order.transferRequestId },
              data: { 
                paymentStatus: 'paid',
                status: 'confirmed' 
              }
            });
            console.log('✅ [TRANSFER] TransferRequest paymentStatus updated to paid');
            
            // 📧 Отправить уведомление водителю
            const driver = order.transferRequest?.assignedDriver || order.transferRequest?.vehicle?.driver;
            console.log('📧 [TRANSFER] Driver for notification:', driver ? `${driver.email || 'NO EMAIL'}` : 'NULL');
            if (driver?.email) {
              try {
                const tr = order.transferRequest;
                const rentalDays = tr?.rentalDays || 1;
                const dateDisplay = rentalDays > 1 && tr?.dropoffDate
                  ? `${tr.pickupDate} — ${tr.dropoffDate} (${rentalDays} дн.)`
                  : (tr?.pickupDate || 'Не указана');
                await emailService.sendEmail({
                  to: driver.email,
                  subject: '🚗 Новый оплаченный трансфер',
                  html: `
                    <div style="font-family: Arial, sans-serif;">
                      <h2>У вас новый оплаченный трансфер!</h2>
                      <p>Клиент: ${order.customer?.fullName || 'Не указан'}</p>
                      <p>Дата: ${dateDisplay}</p>
                      <p>Время: ${tr?.pickupTime || 'Не указано'}</p>
                      <p>Откуда: ${tr?.pickupLocation || 'Не указано'}</p>
                      <p>Куда: ${tr?.dropoffLocation || 'Не указано'}</p>
                      <p>Пассажиров: ${tr?.numberOfPeople || 1}</p>
                      <p>Сумма: ${order.totalAmount} TJS</p>
                      <p><a href="${process.env.FRONTEND_URL || 'https://bunyodtour.tj'}/driver-login.html">Перейти в личный кабинет</a></p>
                    </div>
                  `
                });
                console.log('📧 [TRANSFER] Driver notification sent to:', driver.email);
              } catch (emailError) {
                console.error('❌ [TRANSFER] Failed to send driver email:', emailError);
              }
            }
          } catch (updateError) {
            console.error('❌ [TRANSFER] Failed to update TransferRequest paymentStatus:', updateError);
          }
        }

        // 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Обновляем GuideHireRequest.paymentStatus
        if (order.guideHireRequestId) {
          console.log('🎯 [GUIDE HIRE] Updating GuideHireRequest paymentStatus to paid');
          try {
            await prisma.guideHireRequest.update({
              where: { id: order.guideHireRequestId },
              data: { 
                paymentStatus: 'paid',
                status: 'confirmed' 
              }
            });
            console.log('✅ [GUIDE HIRE] GuideHireRequest updated successfully');
            const { removeGuideDatesAfterPayment } = await import('./guideHireController');
            await removeGuideDatesAfterPayment(order.guideHireRequestId);
          } catch (updateError) {
            console.error('❌ [GUIDE HIRE] Failed to update GuideHireRequest:', updateError);
          }
        }

        // 🎯 КРИТИЧНО: Обновить статус Booking на 'paid' для мониторинга туров
        const isBTOrder = order.orderNumber.startsWith('BT-');
        const tourIdToUse = order.tourId || order.tour?.id;
        
        console.log('📋 [BOOKING] Order analysis:', {
          orderNumber: order.orderNumber,
          isBTOrder,
          orderTourId: order.tourId,
          tourRelationId: order.tour?.id,
          tourIdToUse
        });
        
        if (isBTOrder || tourIdToUse) {
          // 🎯 ПРИОРИТЕТ 1: Используем booking из связи order.booking
          if (order.booking) {
            await prisma.booking.update({
              where: { id: order.booking.id },
              data: { status: 'paid' }
            });
            console.log(`✅ [BOOKING] Updated order.booking #${order.booking.id} status to 'paid'`);
          } else {
            // ПРИОРИТЕТ 2: Ищем booking по orderId или email+дате
            const existingBooking = await prisma.booking.findFirst({
              where: {
                OR: [
                  { orderId: order.id },
                  {
                    AND: [
                      { contactEmail: order.customer?.email },
                      { tourDate: order.tourDate },
                      { tourId: order.tourId || undefined }
                    ]
                  }
                ]
              }
            });
            
            if (existingBooking) {
              await prisma.booking.update({
                where: { id: existingBooking.id },
                data: { 
                  status: 'paid',
                  orderId: order.id
                }
              });
              console.log(`✅ [BOOKING] Updated found Booking #${existingBooking.id} status to 'paid'`);
            } else {
              // ПРИОРИТЕТ 3: Создаём новый booking
              console.log('📋 [BOOKING] No booking found, creating new one...');
              const bookingCreated = await createBookingFromOrder(Number(orderId));
              console.log('📋 [BOOKING] Create result:', bookingCreated ? 'SUCCESS' : 'FAILED/SKIPPED');
            }
          }
        } else {
          console.log('📋 [BOOKING] Skipping - not a tour order (orderNumber:', order.orderNumber, ')');
        }

        // CUSTOM TOUR: Update CustomTourOrder status after successful payment
        if (order.orderNumber.startsWith('CT-')) {
          try {
            if (!order.customer) {
              console.error(`❌ Cannot process CustomTourOrder: customer is null for order ${order.orderNumber}`);
              return res.json({ success: true });
            }

            // Defensive: Parse wishes safely
            let customTourData;
            try {
              customTourData = order.wishes ? JSON.parse(order.wishes) : null;
            } catch (parseError) {
              console.error(`❌ Failed to parse order.wishes for ${order.orderNumber}:`, parseError);
              return res.json({ success: true });
            }

            // Update CustomTourOrder status to 'paid'
            const updatedCustomOrder = await prisma.customTourOrder.updateMany({
              where: { orderNumber: order.orderNumber },
              data: { status: 'paid' }
            });

            if (updatedCustomOrder.count === 0) {
              console.warn(`⚠️ CustomTourOrder not found for ${order.orderNumber}, may need manual check`);
            } else {
              console.log(`✅ CustomTourOrder status updated to 'paid' for order ${order.orderNumber}`);
            }

            // Send confirmation email to tourist with components
            try {
              const touristEmail = order.customer.email;
              if (touristEmail) {
                const countries = customTourData?.selectedCountries || [];
                const countriesText = countries.length > 0 ? countries.join(', ') : 'Центральная Азия';
                
                // Format selected components for email
                const components = customTourData?.selectedComponents || [];
                let componentsHTML = '';
                if (components.length > 0) {
                  componentsHTML = `
                    <div style="margin-top: 15px;">
                      <h4 style="margin-bottom: 10px; color: #3E3E3E;">Включённые услуги:</h4>
                      <ul style="margin: 0; padding-left: 20px;">
                        ${components.map((c: any) => {
                          const name = typeof c.name === 'object' ? (c.name.ru || c.name.en || 'Услуга') : (c.name || 'Услуга');
                          const price = c.price || 0;
                          const days = c.days || customTourData?.totalDays || 1;
                          return `<li style="margin-bottom: 5px;">${name} - ${price} TJS x ${days} дней</li>`;
                        }).join('')}
                      </ul>
                    </div>
                  `;
                }
                
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
                        <p><strong>Количество туристов:</strong> ${customTourData?.numberOfTourists || 1}</p>
                        ${componentsHTML}
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
                        <p style="font-size: 18px; color: #10b981;"><strong>Оплачено:</strong> ${order.totalAmount} TJS</p>
                      </div>

                      <p>Наш менеджер свяжется с вами в ближайшее время для подтверждения деталей тура.</p>
                      
                      <p>С уважением,<br><strong>Команда Bunyod Tour</strong></p>
                      
                      <p style="font-size: 12px; color: #666; margin-top: 30px;">
                        Если у вас есть вопросы, свяжитесь с нами:<br>
                        📧 Email: booking@bunyodtour.tj<br>
                        📞 Телефоны: +992 44 625 7575; +992 93-126-1134<br>
                        📞 +992 00-110-0087; +992 88-235-3434<br>
                        🌐 Сайт: bunyodtour.tj
                      </p>
                    </div>
                  `
                });
                
                console.log(`✅ Confirmation email sent to tourist: ${touristEmail}`);

                // 📧 Уведомление админу о новом оплаченном собственном туре
                const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
                console.log('📧 [CUSTOM TOUR] Sending admin notification to:', adminEmail);
                await emailService.sendEmail({
                  to: adminEmail,
                  subject: `💰 Новый платеж: Собственный тур - ${order.totalAmount} TJS`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #10b981;">💰 Получен новый платеж за собственный тур!</h2>
                      
                      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                        <p><strong>Клиент:</strong> ${order.customer.fullName}</p>
                        <p><strong>Email:</strong> ${order.customer.email}</p>
                        <p><strong>Телефон:</strong> ${order.customer.phone || 'не указан'}</p>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
                        <p><strong>Направления:</strong> ${countriesText}</p>
                        <p><strong>Продолжительность:</strong> ${customTourData?.totalDays || 0} дней</p>
                        <p><strong>Количество туристов:</strong> ${customTourData?.numberOfTourists || 1}</p>
                        ${componentsHTML}
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
                        <p style="font-size: 18px; color: #10b981;"><strong>Сумма:</strong> ${order.totalAmount} TJS</p>
                      </div>
                      
                      <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/admin-dashboard.html" style="display: inline-block; background: #3E3E3E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">
                        Перейти в админ панель
                      </a>
                    </div>
                  `
                });
                console.log('✅ [CUSTOM TOUR] Admin notification sent');
              }
            } catch (emailError) {
              console.error('❌ Failed to send custom tour emails:', emailError);
            }

            console.log(`ℹ️ Custom tour order ${order.orderNumber} paid - tourist and admin notified`);
            return res.json({ success: true });

          } catch (customTourError) {
            console.error('❌ Failed to process CustomTourOrder payment:', customTourError);
            return res.json({ success: true });
          }
        }

        // Отправить email подтверждение клиенту и уведомление администратору
        
        // 🔧 КРИТИЧНО: Обновляем статусы ПЕРЕД проверкой customer!
        // Иначе если customer отсутствует, статусы не обновятся
        
        // 🔍 GUIDE HIRE: Обновить статус GuideHireRequest после успешной оплаты
        let guideHireData = order.guideHireRequest;
        const isGuideHireOrder = order.orderNumber.startsWith('GH-');
        
        if (isGuideHireOrder && order.guideHireRequestId && !guideHireData) {
          console.log('🔍 [GUIDE HIRE] guideHireRequest not included, fetching explicitly...');
          try {
            guideHireData = await prisma.guideHireRequest.findUnique({
              where: { id: order.guideHireRequestId },
              include: { guide: true }
            });
            console.log('✅ [GUIDE HIRE] Explicitly fetched guideHireRequest:', guideHireData ? 'found' : 'not found');
          } catch (fetchError) {
            console.error('❌ [GUIDE HIRE] Failed to fetch guideHireRequest:', fetchError);
            guideHireData = null;
          }
        }

        if (order.guideHireRequestId) {
          console.log('🎯 [GUIDE HIRE] Updating GuideHireRequest paymentStatus to paid');
          try {
            await prisma.guideHireRequest.update({
              where: { id: order.guideHireRequestId },
              data: { 
                paymentStatus: 'paid',
                status: 'confirmed' 
              }
            });
            console.log('✅ [GUIDE HIRE] GuideHireRequest updated successfully');
            const { removeGuideDatesAfterPayment } = await import('./guideHireController');
            await removeGuideDatesAfterPayment(order.guideHireRequestId);
          } catch (updateError) {
            console.error('❌ [GUIDE HIRE] Failed to update GuideHireRequest:', updateError);
          }
        }

        // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Обновляем TransferRequest.paymentStatus ПЕРЕД проверкой customer
        if (order.transferRequestId) {
          console.log('🚗 [TRANSFER] Updating TransferRequest paymentStatus to paid');
          try {
            await prisma.transferRequest.update({
              where: { id: order.transferRequestId },
              data: { 
                paymentStatus: 'paid',
                status: 'confirmed' 
              }
            });
            console.log('✅ [TRANSFER] TransferRequest paymentStatus updated to paid');
          } catch (updateError) {
            console.error('❌ [TRANSFER] Failed to update TransferRequest paymentStatus:', updateError);
          }
        }
        
        // GUARD: Check customer exists before sending emails
        // Статусы уже обновлены выше, поэтому email можно пропустить если customer отсутствует
        if (!order.customer) {
          console.warn('⚠️ Order', order.orderNumber, 'has no customer relation, skipping email notifications');
          console.warn('⚠️ Payment statuses were updated, but email notifications skipped');
          return res.json({ success: true });
        }

        // Если это GH- заказ, но guideHireData всё ещё null - логируем, но продолжаем отправку email
        if (isGuideHireOrder && !guideHireData) {
          console.warn('⚠️ [GUIDE HIRE] guideHireData is null for order:', order.orderNumber);
          console.warn('⚠️ [GUIDE HIRE] Email will be sent with minimal details');
        }
        
        console.log('📧 Starting email notification process for order:', order.orderNumber);
        console.log('📧 Order type:', order.tour ? 'Tour' : (order.orderNumber.startsWith('GH-') ? 'Guide Hire' : (order.orderNumber.startsWith('TR-') ? 'Transfer' : 'Other')));
        console.log('📧 Customer:', { email: order.customer.email, name: order.customer.fullName });
        
        try {
          // Определяем тип заказа
          const isTourOrder = order.orderNumber.startsWith('BT-');
          const isTransfer = order.orderNumber.startsWith('TR-');
          const isCustomTour = order.orderNumber.startsWith('CT-');
          
          if (order.tour || order.tourId || isTourOrder) {
            // Оплата тура - стандартный email с PDF билетом
            console.log('📧 [TOUR] Processing tour payment email for:', order.orderNumber);
            
            // Пробуем загрузить тур из разных источников:
            // 1. order.tour (если tourId установлен на Order)
            // 2. order.booking?.tour (если тур связан через Booking)
            // 3. Явный запрос по tourId (fallback)
            let tourData = order.tour;
            
            // Пробуем из booking (уже загружен с include)
            if (!tourData && order.booking?.tour) {
              tourData = order.booking.tour;
              console.log('📧 [TOUR] Tour loaded from order.booking:', tourData.id);
            }
            
            // Fallback: явный запрос
            if (!tourData && (isTourOrder || order.tourId)) {
              console.log('📧 [TOUR] Tour not in order or booking, fetching explicitly...');
              try {
                // Пробуем найти booking по orderId
                const booking = await prisma.booking.findFirst({
                  where: { orderId: order.id },
                  include: { 
                    tour: true,
                    hotel: true 
                  }
                });
                
                if (booking?.tour) {
                  tourData = booking.tour;
                  console.log('📧 [TOUR] Tour loaded from explicit booking query:', tourData.id);
                } else if (order.tourId) {
                  // Fallback: загружаем тур напрямую по tourId
                  tourData = await prisma.tour.findUnique({
                    where: { id: order.tourId }
                  });
                  console.log('📧 [TOUR] Tour loaded by tourId:', tourData?.id);
                }
              } catch (fetchError) {
                console.error('📧 [TOUR] Failed to fetch tour:', fetchError);
              }
            }
            
            if (tourData) {
              // Отправляем полноценное письмо с PDF билетом
              console.log('📧 [TOUR] Sending booking confirmation with PDF ticket to:', order.customer.email);
              try {
                await sendBookingConfirmation(order, order.customer, tourData);
                console.log('✅ [TOUR] Booking confirmation with PDF sent successfully');
              } catch (pdfError) {
                console.error('❌ [TOUR] PDF email failed, falling back to standard email:', pdfError);
                // Fallback на стандартный email если PDF не сработал
                await emailService.sendPaymentConfirmation(order, order.customer);
              }
              
              console.log('📧 Sending admin notification for tour payment');
              await emailService.sendAdminNotification(order, order.customer, tourData);
              console.log('✅ Tour payment emails sent successfully');
            } else {
              // Тур не найден - отправляем стандартное уведомление
              console.warn('⚠️ [TOUR] Tour data not found for order:', order.orderNumber);
              await emailService.sendPaymentConfirmation(order, order.customer);
              console.log('✅ Fallback payment confirmation sent');
            }
          } else {
            // Оплата гида/трансфера/собственного тура - двуязычное уведомление
            console.log('📧 Non-tour payment detected:', { isGuideHire: isGuideHireOrder, isTransfer, isCustomTour, orderNumber: order.orderNumber });
            
            const orderType = isGuideHireOrder ? 'guideHire' 
              : isTransfer ? 'transfer'
              : isCustomTour ? 'customTour'
              : 'other';
            
            console.log('📧 Preparing bilingual email for:', orderType);

            // Формируем данные для двуязычного email
            let detailsData: any = {};
            const lang = order.language === 'en' ? 'en' : 'ru';
            
            if (isGuideHireOrder && guideHireData?.guide) {
              console.log('📧 [GUIDE HIRE] Building bilingual email with guide details');
              const guide = guideHireData.guide;
              const guideName = typeof guide.name === 'object' && guide.name !== null 
                ? (guide.name as any)[lang] || (guide.name as any).ru || (guide.name as any).en 
                : String(guide.name || '');
              
              detailsData = {
                guideName,
                guideLanguages: guide.languages,
                selectedDates: guideHireData?.selectedDates,
                numberOfDays: guideHireData?.numberOfDays,
                pricePerDay: guide.pricePerDay
              };
            } else if (isTransfer && order.transferRequest) {
              console.log('📧 [TRANSFER] Building bilingual email with transfer details');
              const transfer = order.transferRequest;
              const vehicle = (transfer as any).vehicle;
              const tDriver = (transfer as any).assignedDriver || vehicle?.driver;
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

            // Email клиенту (двуязычный)
            console.log('📧 Sending bilingual customer email to:', order.customer.email);
            await sendNonTourPaymentConfirmation(order, order.customer, orderType as any, detailsData);
            console.log('📧 Bilingual customer email sent successfully');

            // Email админу
            const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
            console.log('📧 Sending admin notification to:', adminEmail);
            
            const orderTypeRu = orderType === 'guideHire' ? 'Найм гида' 
              : orderType === 'transfer' ? 'Трансфер'
              : orderType === 'customTour' ? 'Собственный тур'
              : 'Услуга';
            
            await emailService.sendEmail({
              to: adminEmail,
              subject: `💰 Новый платеж: ${orderTypeRu} - ${order.totalAmount} TJS`,
              html: `
                <div style="font-family: Arial, sans-serif;">
                  <h2>💰 Получен новый платеж!</h2>
                  <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                  <p><strong>Услуга:</strong> ${orderTypeRu}</p>
                  <p><strong>Клиент:</strong> ${order.customer.fullName} (${order.customer.email})</p>
                  <p><strong>Сумма:</strong> ${order.totalAmount} TJS</p>
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/admin-dashboard.html">Перейти в админ панель</a>
                </div>
              `
            });
            console.log('✅ Non-tour payment emails sent successfully to customer and admin');
            
            // 📧 Email водителю о новом трансфере (только для Transfer)
            // ✅ FIX: Проверяем ОБОИХ: vehicle.driver И assignedDriver
            const transferDriver = order.transferRequest?.vehicle?.driver || order.transferRequest?.assignedDriver;
            if (isTransfer && order.transferRequest && transferDriver) {
              const driver = transferDriver;
              const driverEmail = driver.email || (driver.contact && typeof driver.contact === 'string' && driver.contact.includes('@') ? driver.contact : null) 
                || (driver.login && driver.login.includes('@') ? driver.login : null);
              
              console.log('📧 [TRANSFER] Checking driver email:', { 
                driverEmail, 
                driverId: driver.id, 
                driverName: driver.name,
                source: order.transferRequest?.vehicle?.driver ? 'vehicle.driver' : 'assignedDriver'
              });
              
              if (driverEmail) {
                const driverName = typeof driver.name === 'object' && driver.name !== null 
                  ? (driver.name as any).ru || (driver.name as any).en || 'Водитель' 
                  : String(driver.name || 'Водитель');
                
                const transfer = order.transferRequest;
                const vehicleName = transfer.vehicle ? 
                  (typeof transfer.vehicle.name === 'object' && transfer.vehicle.name !== null
                    ? (transfer.vehicle.name as any).ru || (transfer.vehicle.name as any).en || 'Транспорт'
                    : String(transfer.vehicle.name || 'Транспорт'))
                  : 'Транспорт';
                
                console.log('📧 [TRANSFER] Sending notification to driver:', driverEmail);
                try {
                  await emailService.sendEmail({
                    to: driverEmail,
                    subject: `🚗 Новый заказ на трансфер! - ${order.orderNumber}`,
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                        <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; padding: 30px; text-align: center;">
                          <h1 style="margin: 0;">🚗 Новый заказ на трансфер!</h1>
                          <p style="margin-top: 10px; opacity: 0.9;">Заказ #${order.orderNumber}</p>
                        </div>
                        
                        <div style="padding: 30px; background: white;">
                          <p style="font-size: 16px;">Уважаемый <strong>${driverName}</strong>!</p>
                          <p>Турист оплатил заказ на трансфер с использованием вашего транспорта.</p>
                          
                          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #374151;">📍 Детали заказа</h3>
                            <p><strong>Откуда:</strong> ${transfer.pickupLocation || 'Не указано'}</p>
                            <p><strong>Куда:</strong> ${transfer.dropoffLocation || 'Не указано'}</p>
                            <p><strong>Дата:</strong> ${transfer.pickupDate || 'Уточняется'}</p>
                            <p><strong>Время:</strong> ${transfer.pickupTime || 'Уточняется'}</p>
                            <p><strong>Количество человек:</strong> ${transfer.numberOfPeople || 1}</p>
                            ${transfer.specialRequests ? `<p><strong>Пожелания:</strong> ${transfer.specialRequests}</p>` : ''}
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
                            <p><strong>Транспорт:</strong> ${vehicleName}</p>
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
                            <p><strong>Клиент:</strong> ${order.customer.fullName}</p>
                            <p><strong>Email туриста:</strong> ${order.customer.email}</p>
                            <p><strong>Телефон туриста:</strong> ${order.customer.phone || 'Не указан'}</p>
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
                            <p style="font-size: 18px; color: #10b981;"><strong>Сумма заказа:</strong> ${order.totalAmount} TJS</p>
                            <p style="color: #10b981; font-size: 14px;">✓ Оплачено туристом</p>
                          </div>
                          
                          <div style="background: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3B82F6; margin: 25px 0;">
                            <p style="margin: 0;"><strong>🔔 Важно:</strong> Пожалуйста, войдите в личный кабинет для подтверждения или отклонения заказа.</p>
                          </div>
                          
                          <div style="text-align: center; margin: 25px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://bunyodtour.tj'}/driver-login.html" 
                               style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                              Перейти в личный кабинет
                            </a>
                          </div>
                        </div>
                        
                        <div style="background: #3E3E3E; color: white; padding: 30px; text-align: center;">
                          <h3 style="margin-top: 0;">Bunyod-Tour</h3>
                          <p style="margin: 5px 0;">📍 Душанбе, Таджикистан</p>
                          <p style="margin: 5px 0;">📞 +992 44 625 7575</p>
                          <p style="margin: 5px 0;">✉️ booking@bunyodtour.tj</p>
                        </div>
                      </div>
                    `
                  });
                  console.log('✅ [TRANSFER] Driver notification email sent successfully');
                } catch (driverEmailError) {
                  console.error('❌ [TRANSFER] Failed to send driver notification:', driverEmailError);
                }
              }
            }
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
