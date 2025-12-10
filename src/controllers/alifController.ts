import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
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

        // Проверить что у трансфера установлена цена
        const transferPrice = transferRequest.finalPrice || transferRequest.estimatedPrice;
        if (!transferPrice || transferPrice <= 0) {
          console.error(`❌ Transfer payment validation failed: Transfer has no price set`);
          return res.status(400).json({
            success: false,
            message: 'Цена трансфера не установлена. Пожалуйста, обратитесь к администратору.',
          });
        }

        // Сравнить с суммой в заказе (допускаем погрешность 0.01 из-за округления)
        if (Math.abs(order.totalAmount - transferPrice) > 0.01) {
          console.error(`❌ Transfer payment validation failed: Expected ${transferPrice}, got ${order.totalAmount}`);
          return res.status(400).json({
            success: false,
            message: 'Цена трансфера изменилась. Пожалуйста, создайте новый заказ.',
            expectedPrice: transferPrice,
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

        console.log(`✅ Transfer payment validated: ${transferPrice} TJS for order ${orderNumber}`);
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
      // Редирект на главную страницу после оплаты (без дополнительных модалов)
      const returnUrl = `${frontendUrl}/`;
      
      // Определяем тип заказа для корректного описания
      const isGuideHire = orderNumber.startsWith('GH-');
      const isTransfer = orderNumber.startsWith('TR-');
      const isCustomTour = orderNumber.startsWith('CT-');
      const orderTypeText = isGuideHire ? 'Найм гида' 
        : isTransfer ? 'Трансфер'
        : isCustomTour ? 'Собственный тур'
        : 'Тур';
      const info = `${orderTypeText} №${orderId}`;
      
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
      console.log(`   📧 Customer: ${email}`);

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
        paymentStatus: order.paymentStatus
      });

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

        // Create Booking record for tour monitoring
        if (order.tourId) {
          await createBookingFromOrder(Number(orderId));
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
        
        // GUARD: Check customer exists FIRST before any logging that accesses customer properties
        if (!order.customer) {
          console.warn('⚠️ Order', order.orderNumber, 'has no customer relation, skipping email notifications');
          console.warn('⚠️ This may indicate missing data - order was marked as paid but notifications skipped');
          return res.json({ success: true });
        }

        // 🔍 GUIDE HIRE: Обновить статус GuideHireRequest после успешной оплаты
        // ВАЖНО: Явно загружаем guideHireRequest если он не был включён в запрос
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

        // Если это GH- заказ, но guideHireData всё ещё null - логируем, но продолжаем отправку email
        if (isGuideHireOrder && !guideHireData) {
          console.warn('⚠️ [GUIDE HIRE] guideHireData is null for order:', order.orderNumber);
          console.warn('⚠️ [GUIDE HIRE] Email will be sent with minimal details');
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
          } catch (updateError) {
            console.error('❌ [GUIDE HIRE] Failed to update GuideHireRequest:', updateError);
          }
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
            const isTransfer = order.orderNumber.startsWith('TR-');
            const isCustomTour = order.orderNumber.startsWith('CT-');
            
            console.log('📧 Non-tour payment detected:', { isGuideHire: isGuideHireOrder, isTransfer, isCustomTour, orderNumber: order.orderNumber });
            
            const isTourOrder = order.orderNumber.startsWith('BT-');
            const orderTypeText = isGuideHireOrder ? 'Найм гида' 
              : isTransfer ? 'Трансфер'
              : isCustomTour ? 'Собственный тур'
              : isTourOrder ? 'Бронирование тура'
              : 'Услуга';
            
            console.log('📧 Preparing email for:', orderTypeText);

            // Формируем детали заказа
            let detailsHTML = '';
            
            // Используем guideHireData (явно загруженный) вместо order.guideHireRequest
            if (isGuideHireOrder && guideHireData?.guide) {
              console.log('📧 [GUIDE HIRE] Building email with guide details');
              const guide = guideHireData.guide;
              const guideName = typeof guide.name === 'object' && guide.name !== null ? (guide.name as any).ru || (guide.name as any).en || 'Не указано' : String(guide.name || 'Не указано');
              
              detailsHTML = `
                <p><strong>Гид:</strong> ${guideName}</p>
                <p><strong>Языки:</strong> ${guide.languages || 'не указаны'}</p>
                <p><strong>Выбранные даты:</strong> ${guideHireData?.selectedDates || 'не указаны'}</p>
                <p><strong>Количество дней:</strong> ${guideHireData?.numberOfDays || 'не указано'}</p>
                <p><strong>Цена за день:</strong> ${guide.pricePerDay || 'не указана'} TJS</p>
              `;
            } else if (isGuideHireOrder && !guideHireData?.guide) {
              // Fallback: отправляем email даже без деталей гида
              console.warn('⚠️ [GUIDE HIRE] Guide details not available, using fallback template');
              detailsHTML = `
                <p><strong>Услуга:</strong> Найм гида</p>
                <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                <p><strong>Детали заказа сохранены в системе</strong></p>
                <p>Наш менеджер свяжется с вами для подтверждения деталей.</p>
              `;
            } else if (isTransfer && order.transferRequest) {
              console.log('📧 [TRANSFER] Building email with transfer details');
              const transfer = order.transferRequest;
              
              detailsHTML = `
                <p><strong>Откуда:</strong> ${transfer.pickupLocation || 'не указано'}</p>
                <p><strong>Куда:</strong> ${transfer.dropoffLocation || 'не указано'}</p>
                <p><strong>Дата:</strong> ${transfer.pickupDate || 'не указана'}</p>
                <p><strong>Время:</strong> ${transfer.pickupTime || 'не указано'}</p>
                <p><strong>Количество человек:</strong> ${transfer.numberOfPeople || 1}</p>
                ${transfer.specialRequests ? `<p><strong>Пожелания:</strong> ${transfer.specialRequests}</p>` : ''}
              `;
            } else if (isTransfer && !order.transferRequest) {
              // Fallback: отправляем email даже без деталей трансфера
              console.warn('⚠️ [TRANSFER] Transfer details not available, using fallback template');
              detailsHTML = `
                <p><strong>Услуга:</strong> Трансфер</p>
                <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                <p><strong>Детали заказа сохранены в системе</strong></p>
                <p>Наш менеджер свяжется с вами для подтверждения деталей.</p>
              `;
            } else if (order.orderNumber.startsWith('BT-')) {
              // BT- заказ тура без связанного тура - используем данные из заказа
              console.warn('⚠️ [TOUR] BT- order without tour relation, using order data');
              console.warn('⚠️ [TOUR] Order details:', { 
                orderNumber: order.orderNumber, 
                tourDate: order.tourDate,
                tourists: order.tourists,
                wishes: order.wishes 
              });
              
              // Парсим туристов
              let touristsInfo = '';
              try {
                const tourists = order.tourists ? JSON.parse(order.tourists) : [];
                if (Array.isArray(tourists) && tourists.length > 0) {
                  touristsInfo = `<p><strong>Количество туристов:</strong> ${tourists.length}</p>`;
                }
              } catch {}
              
              detailsHTML = `
                <p><strong>Услуга:</strong> Бронирование тура</p>
                <p><strong>Дата:</strong> ${order.tourDate ? new Date(order.tourDate).toLocaleDateString('ru-RU') : 'по согласованию'}</p>
                ${touristsInfo}
                ${order.wishes ? `<p><strong>Пожелания:</strong> ${order.wishes}</p>` : ''}
                <p><strong>Детали тура будут отправлены отдельным письмом</strong></p>
              `;
            } else {
              // Другие типы заказов (неизвестный префикс)
              console.log('📧 [OTHER] Unknown order type, using generic template');
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
                    <p style="margin: 5px 0;">📞 +992 44 625 7575; +992 93-126-1134</p>
                    <p style="margin: 5px 0;">📞 +992 00-110-0087; +992 88-235-3434</p>
                    <p style="margin: 5px 0;">✉️ booking@bunyodtour.tj</p>
                    <p style="margin: 5px 0;">🌐 <a href="https://bunyodtour.tj" style="color: #10b981;">bunyodtour.tj</a></p>
                    <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">Туристическая платформа Центральной Азии</p>
                  </div>
                </div>
              `
            });
            
            console.log('📧 Customer email sent successfully');

            // Email админу
            const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
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
