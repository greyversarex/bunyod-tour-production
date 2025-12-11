import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
import { sendBookingConfirmation } from '../services/emailServiceSendGrid';
import { createBookingFromOrder } from '../services/paymentService';
import crypto from 'crypto';
import axios from 'axios';

/**
 * 🚀 Асинхронная отправка email без блокировки callback
 * Позволяет быстро вернуть 200 Payler, пока email отправляются в фоне
 */
function sendEmailAsync(emailFn: () => Promise<void>, description: string): void {
  setImmediate(async () => {
    try {
      await emailFn();
      console.log(`✅ [ASYNC EMAIL] ${description} - sent successfully`);
    } catch (error) {
      console.error(`❌ [ASYNC EMAIL] ${description} - failed:`, error);
    }
  });
}

/**
 * 🔄 Retry wrapper для API запросов с экспоненциальной задержкой
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number; description?: string } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, description = 'API call' } = options;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      
      if (isLastAttempt) {
        console.error(`❌ [RETRY] ${description} failed after ${maxAttempts} attempts`);
        throw error;
      }
      
      const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
      console.warn(`⚠️ [RETRY] ${description} attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Unreachable');
}

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

      // Определяем тип заказа для логирования
      const orderType = orderNumber.startsWith('GH-') ? 'GuideHire' 
        : orderNumber.startsWith('TR-') ? 'Transfer'
        : orderNumber.startsWith('CT-') ? 'CustomTour'
        : 'Tour';
      
      console.log(`🔄 Creating Payler payment:`);
      console.log(`   📋 Order: ${orderNumber} (${orderType})`);
      console.log(`   💰 Amount: ${amount} дирамов (${order.totalAmount} TJS)`);
      console.log(`   📧 Customer: ${customerEmail}`);

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

      console.log('📤 Payler StartSession request:', { 
        ...fields, 
        key: '***', 
        orderType,
        originalOrderNumber: orderNumber 
      });

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
        console.error('❌ Payler StartSession HTTP error:');
        console.error('   🔢 Status:', response.status, response.statusText);
        console.error('   📝 Response:', responseText);
        console.error('   📋 Order:', orderNumber, `(${orderType})`);
        console.error('   💰 Amount:', amount, 'дирамов =', order.totalAmount, 'TJS');
        console.error('   📧 Customer:', customerEmail);
        
        // Парсим ошибку для более понятного сообщения
        let userMessage = 'Ошибка связи с платежной системой Payler';
        try {
          const errorData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          if (errorData?.error?.message) {
            userMessage = `Payler: ${errorData.error.message}`;
          }
        } catch {}
        
        return res.status(500).json({
          success: false,
          message: userMessage,
          details: responseText,
          orderType,
          orderNumber,
        });
      }
      
      // Проверка на ошибку в ответе Payler (даже при статусе 200)
      if (typeof response.data === 'object' && response.data.error) {
        console.error('❌ Payler API returned error:', response.data.error);
        return res.status(500).json({
          success: false,
          message: response.data.error.message || 'Payler API error',
          details: response.data.error,
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

      // 🛡️ SECURITY: Проверка IP источника
      // Payler отправляет callback с IP: 178.20.235.180
      const PAYLER_ALLOWED_IPS = ['178.20.235.180'];
      const forwardedFor = req.headers['x-forwarded-for'] as string;
      const sourceIp = forwardedFor ? forwardedFor.split(',')[0].trim() : clientIp;
      const isLocalhost = sourceIp?.includes('127.0.0.1') || sourceIp?.includes('::1') || sourceIp?.includes('::ffff:127.0.0.1');
      const isProduction = process.env.NODE_ENV === 'production';
      
      // В production блокируем неизвестные IP, в dev только логируем
      if (sourceIp && !PAYLER_ALLOWED_IPS.includes(sourceIp) && !isLocalhost) {
        if (isProduction) {
          console.error(`🚫 [SECURITY] Callback BLOCKED from unauthorized IP: ${sourceIp}`);
          return res.status(403).json({
            success: false,
            message: 'Forbidden'
          });
        } else {
          console.warn(`⚠️ [SECURITY] Callback from unexpected IP: ${sourceIp} (allowed in dev mode)`);
        }
      }

      // 🔄 Получить актуальный статус платежа через GetStatus API с retry
      let statusData;
      try {
        statusData = await withRetry(
          () => paylerController.getStatus(order_id),
          { maxAttempts: 3, delayMs: 500, description: `GetStatus for order ${order_id}` }
        );
      } catch (statusError) {
        console.error('❌ Failed to get payment status after retries:', statusError);
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

      // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ EMAIL
      console.log('🔍 [PAYLER CALLBACK] Order details:', {
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
        paylerStatus: status
      });

      // 🛡️ IDEMPOTENCY: Проверка на повторную обработку
      // Если статус заказа УЖЕ соответствует конечному состоянию - пропускаем (защита от дублей)
      // Важно: проверяем что переход УЖЕ произошёл, а не находится в процессе
      // processing → paid/failed/refunded = нужно обработать (первый раз)
      // paid → paid (Charged снова) = пропустить (дубль)
      // partially_refunded → refunded = нужно обработать (финальный возврат)
      const isAlreadyProcessed = 
        (status === 'Charged' && order.paymentStatus === 'paid') ||
        (status === 'Refunded' && order.paymentStatus === 'refunded') || // НЕ включаем partially_refunded!
        (status === 'Rejected' && order.paymentStatus === 'failed');
      
      if (isAlreadyProcessed) {
        console.log(`ℹ️ [IDEMPOTENCY] Order ${order_id} already has final status: ${order.paymentStatus}. Skipping duplicate callback for Payler status: ${status}`);
        return res.status(200).json({ 
          success: true, 
          message: 'Already processed',
          idempotent: true 
        });
      }
      
      // Дополнительная проверка: если заказ уже в реальном конечном состоянии, но Payler статус другой - логируем
      // partially_refunded НЕ является конечным - ещё можно сделать полный возврат
      const isInFinalState = ['paid', 'refunded', 'failed'].includes(order.paymentStatus);
      if (isInFinalState && status !== 'Charged' && order.paymentStatus !== 'paid') {
        console.warn(`⚠️ [IDEMPOTENCY] Order ${order_id} is in final state ${order.paymentStatus}, but Payler reports ${status}. Processing anyway.`);
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

        // Create Booking record for tour monitoring
        const isBTOrder = order.orderNumber.startsWith('BT-');
        const tourIdToUse = order.tourId || order.tour?.id;
        
        console.log('📋 [BOOKING] Order analysis:', {
          orderNumber: order.orderNumber,
          isBTOrder,
          orderTourId: order.tourId,
          tourRelationId: order.tour?.id,
          tourIdToUse
        });
        
        if (tourIdToUse || isBTOrder) {
          console.log('📋 [BOOKING] Creating booking for order:', order_id);
          const bookingCreated = await createBookingFromOrder(Number(order_id));
          console.log('📋 [BOOKING] Result:', bookingCreated ? 'SUCCESS' : 'FAILED/SKIPPED');
        } else {
          console.log('📋 [BOOKING] Skipping - not a tour order (no tourId, orderNumber:', order.orderNumber, ')');
        }

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
              // Don't fail the payment
            }

            console.log(`ℹ️ Custom tour order ${order.orderNumber} paid - tourist and admin notified`);
            return res.status(200).json({ success: true });

          } catch (customTourError) {
            console.error('❌ Failed to process CustomTourOrder payment:', customTourError);
            // Return 200 even on error to prevent Payler retry
            return res.status(200).json({ success: true });
          }
        }

        // REGULAR ORDERS: Send email confirmations
        // (CT orders return early above, so we only reach here for tour/transfer/guide orders)
        
        // GUARD: Check customer exists FIRST before any logging that accesses customer properties
        if (!order.customer) {
          console.warn('⚠️ Order', order.orderNumber, 'has no customer relation, skipping email notifications');
          console.warn('⚠️ This may indicate missing data - order was marked as paid but notifications skipped');
          return res.status(200).json({ success: true });
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
        console.log('📧 Order type:', order.tour ? 'Tour' : (isGuideHireOrder ? 'Guide Hire' : (order.orderNumber.startsWith('TR-') ? 'Transfer' : 'Other')));
        console.log('📧 Customer:', { email: order.customer.email, name: order.customer.fullName });
        
        try {

          // Определяем тип заказа
          const isTourOrder = order.orderNumber.startsWith('BT-');
          const isTransfer = order.orderNumber.startsWith('TR-');
          const isCustomTour = order.orderNumber.startsWith('CT-');
          
          if (order.tour || isTourOrder) {
            // Оплата тура - стандартный email с PDF билетом
            console.log('📧 [TOUR] Processing tour payment email for:', order.orderNumber);
            
            // Если order.tour не загружен, загружаем его явно
            let tourData = order.tour;
            if (!tourData && isTourOrder) {
              console.log('📧 [TOUR] Tour not loaded, fetching from booking...');
              try {
                // Сначала пробуем найти booking по orderId
                const booking = await prisma.booking.findFirst({
                  where: { orderId: order.id },
                  include: { 
                    tour: true,
                    hotel: true 
                  }
                });
                
                if (booking?.tour) {
                  tourData = booking.tour;
                  console.log('📧 [TOUR] Tour loaded from booking:', tourData.id);
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
            // Оплата гида/трансфера - детальное уведомление
            console.log('📧 Non-tour payment detected:', { isGuideHire: isGuideHireOrder, isTransfer, isCustomTour, orderNumber: order.orderNumber });
            
            const orderTypeText = isGuideHireOrder ? 'Найм гида' 
              : isTransfer ? 'Трансфер'
              : isCustomTour ? 'Собственный тур'
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

            // 📧 Email гиду о новом найме (только для Guide Hire)
            // Guide использует поле contact для email или login (если это email)
            const guideEmail = guideHireData?.guide?.contact && guideHireData.guide.contact.includes('@')
              ? guideHireData.guide.contact
              : (guideHireData?.guide?.login && guideHireData.guide.login.includes('@') 
                  ? guideHireData.guide.login 
                  : null);
            
            if (isGuideHireOrder && guideEmail && guideHireData) {
              const guide = guideHireData.guide;
              const guideName = typeof guide.name === 'object' && guide.name !== null 
                ? (guide.name as any).ru || (guide.name as any).en || 'Гид' 
                : String(guide.name || 'Гид');
              
              // Парсим даты из JSON строки
              let selectedDatesArray: string[] = [];
              try {
                selectedDatesArray = guideHireData.selectedDates 
                  ? JSON.parse(guideHireData.selectedDates as string) 
                  : [];
              } catch (e) {
                selectedDatesArray = guideHireData.selectedDates 
                  ? [String(guideHireData.selectedDates)] 
                  : [];
              }
              
              const numberOfDaysForEmail = guideHireData.numberOfDays || 1;
              
              console.log('📧 [GUIDE HIRE] Sending notification to guide:', guideEmail);
              try {
                await emailService.sendEmail({
                  to: guideEmail,
                  subject: `🎉 Новое бронирование! Вас выбрали гидом - ${order.orderNumber}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                      <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; padding: 30px; text-align: center;">
                        <h1 style="margin: 0;">🎉 Новое бронирование!</h1>
                        <p style="margin-top: 10px; opacity: 0.9;">Турист забронировал и оплатил ваши услуги</p>
                      </div>
                      
                      <div style="padding: 30px;">
                        <p style="font-size: 16px;">Здравствуйте, <strong>${guideName}</strong>!</p>
                        <p>Поздравляем! Турист забронировал и оплатил ваши услуги гида.</p>
                        
                        <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                          <h2 style="margin-top: 0; color: #1D4ED8; font-size: 20px;">📋 Детали бронирования</h2>
                          <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                          <p><strong>Турист:</strong> ${order.customer.fullName}</p>
                          <p><strong>Email туриста:</strong> ${order.customer.email}</p>
                          <p><strong>Телефон туриста:</strong> ${order.customer.phone || 'Не указан'}</p>
                          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
                          <p><strong>Даты:</strong> ${selectedDatesArray.join(', ') || 'Уточняются'}</p>
                          <p><strong>Количество дней:</strong> ${numberOfDaysForEmail}</p>
                          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
                          <p style="font-size: 18px; color: #10b981;"><strong>Ваш заработок:</strong> ${order.totalAmount} TJS</p>
                          <p style="color: #10b981; font-size: 14px;">✓ Оплачено туристом</p>
                        </div>
                        
                        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3B82F6; margin: 25px 0;">
                          <p style="margin: 0;"><strong>📞 Важно:</strong> Пожалуйста, свяжитесь с туристом для согласования деталей встречи.</p>
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
                console.log('✅ [GUIDE HIRE] Guide notification email sent successfully');
              } catch (guideEmailError) {
                console.error('❌ [GUIDE HIRE] Failed to send guide notification:', guideEmailError);
                // Не прерываем процесс - это некритичная ошибка
              }
            }
            
            // Email админу
            const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
            console.log('📧 Sending admin notification to:', adminEmail);
            
            // Для Guide Hire добавляем имя гида в email админу
            const guideNameForAdmin = (isGuideHireOrder && guideHireData?.guide) 
              ? (typeof guideHireData.guide.name === 'object' && guideHireData.guide.name !== null 
                  ? (guideHireData.guide.name as any).ru || (guideHireData.guide.name as any).en || 'Гид' 
                  : String(guideHireData.guide.name || 'Гид'))
              : null;
            
            await emailService.sendEmail({
              to: adminEmail,
              subject: `💰 Новый платеж: ${orderTypeText}${guideNameForAdmin ? ` - ${guideNameForAdmin}` : ''} - ${order.totalAmount} TJS`,
              html: `
                <div style="font-family: Arial, sans-serif;">
                  <h2>💰 Получен новый платеж!</h2>
                  <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                  <p><strong>Услуга:</strong> ${orderTypeText}</p>
                  ${guideNameForAdmin ? `<p><strong>Гид:</strong> ${guideNameForAdmin}</p>` : ''}
                  <p><strong>Клиент:</strong> ${order.customer.fullName} (${order.customer.email})</p>
                  <p><strong>Сумма:</strong> ${order.totalAmount} TJS</p>
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/admin-dashboard.html">Перейти в админ панель</a>
                </div>
              `
            });
            console.log('✅ Non-tour payment emails sent successfully to customer, guide (if applicable), and admin');
          }
        } catch (emailError) {
          console.error('❌ Email sending failed for order:', order.orderNumber);
          console.error('❌ Email error details:', emailError);
          // Логируем полный стек ошибки для диагностики
          if (emailError instanceof Error) {
            console.error('❌ Email error stack:', emailError.stack);
          }
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
   * С аудитом и защитой от повторных возвратов
   */
  async refund(req: Request, res: Response) {
    try {
      const { orderId, amount, reason, adminId } = req.body;

      console.log('💰 Payler refund request:', { orderId, amount, reason, adminId });

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

      // Получить информацию о заказе с историей возвратов
      const order = await prisma.order.findUnique({
        where: { id: Number(orderId) },
        include: {
          refundLogs: {
            where: { status: 'success' }
          }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Проверить, что заказ оплачен или частично возвращён
      if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') {
        return res.status(400).json({
          success: false,
          message: 'Order is not paid, cannot refund'
        });
      }

      // 📊 Рассчитать уже возвращённую сумму
      const alreadyRefundedDirams = order.refundLogs.reduce((sum, log) => sum + log.amountDirams, 0);
      const alreadyRefundedTJS = alreadyRefundedDirams / 100;
      
      // Сумма возврата (в дирамах, минимальная единица TJS)
      // Если amount не указан, возвращаем оставшуюся сумму
      const remainingAmount = order.totalAmount - alreadyRefundedTJS;
      const refundAmountTJS = amount ? Math.min(amount, remainingAmount) : remainingAmount;
      const refundAmount = Math.round(refundAmountTJS * 100);

      // Валидация суммы возврата
      if (refundAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount must be positive'
        });
      }

      const paidAmount = Math.round(order.totalAmount * 100);
      const maxRefundable = paidAmount - alreadyRefundedDirams;
      
      if (refundAmount > maxRefundable) {
        return res.status(400).json({
          success: false,
          message: `Cannot refund ${refundAmount / 100} TJS. Already refunded: ${alreadyRefundedTJS} TJS. Max refundable: ${maxRefundable / 100} TJS`
        });
      }

      console.log(`🔄 Refunding ${refundAmount} dirams (${refundAmount / 100} TJS) for order ${orderId}`);
      console.log(`📊 Already refunded: ${alreadyRefundedTJS} TJS. Remaining after this: ${(order.totalAmount - alreadyRefundedTJS - refundAmount / 100).toFixed(2)} TJS`);

      // 📝 Создать запись аудита ПЕРЕД запросом к Payler
      const refundLog = await prisma.paymentRefundLog.create({
        data: {
          orderId: Number(orderId),
          orderNumber: order.orderNumber,
          amount: refundAmount / 100,
          amountDirams: refundAmount,
          reason: reason || null,
          status: 'pending',
          processedBy: adminId ? Number(adminId) : null
        }
      });

      console.log(`📝 Refund log created: ID ${refundLog.id}`);

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

      // Обработка ошибки от Payler
      if (response.status < 200 || response.status >= 300) {
        console.error('❌ Payler refund failed:', response.status, response.data);
        
        // Обновить лог с ошибкой
        await prisma.paymentRefundLog.update({
          where: { id: refundLog.id },
          data: {
            status: 'failed',
            paylerResponse: JSON.stringify(response.data),
            completedAt: new Date()
          }
        });
        
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
        
        // Обновить лог с ошибкой парсинга
        await prisma.paymentRefundLog.update({
          where: { id: refundLog.id },
          data: {
            status: 'failed',
            paylerResponse: String(response.data),
            completedAt: new Date()
          }
        });
        
        return res.status(500).json({
          success: false,
          message: 'Invalid refund response format',
        });
      }

      console.log('✅ Payler refund successful:', responseData);

      // ✅ Обновить лог как успешный
      await prisma.paymentRefundLog.update({
        where: { id: refundLog.id },
        data: {
          status: 'success',
          paylerResponse: JSON.stringify(responseData),
          completedAt: new Date()
        }
      });

      // Рассчитать новый статус платежа
      const totalRefundedAfter = alreadyRefundedDirams + refundAmount;
      const isFullyRefunded = totalRefundedAfter >= paidAmount;
      const newPaymentStatus = isFullyRefunded ? 'refunded' : 'partially_refunded';

      // Обновить статус заказа
      await prisma.order.update({
        where: { id: Number(orderId) },
        data: {
          paymentStatus: newPaymentStatus,
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