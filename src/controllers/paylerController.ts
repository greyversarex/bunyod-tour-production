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
        },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      const paylerKey = process.env.PAYLER_KEY;
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

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

      // URLs для возврата
      const returnUrl = `${baseUrl}/payment-success?orderNumber=${orderNumber}`;
      const failUrl = `${baseUrl}/payment-fail?orderNumber=${orderNumber}`;

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
        redirectUrl,
        sessionId,
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
      console.log(`📊 Payment status for order ${order_id}:`, status);

      // Найти заказ в базе данных с полными данными для email билета
      const order = await prisma.order.findUnique({
        where: { id: Number(order_id) },
        include: {
          customer: true,
          tour: true,
          hotel: true,
          guide: true,
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
          },
        });

        console.log('✅ Payment confirmed for order:', order_id);

        // Отправить email подтверждение клиенту и уведомление администратору
        try {
          // Email клиенту с билетом
          await emailService.sendPaymentConfirmation(order, order.customer);
          console.log('✅ Confirmation email sent to customer:', order.customer.email);
          
          // Email администратору о новой оплате
          await emailService.sendAdminNotification(order, order.customer, order.tour);
          console.log('✅ Admin notification email sent');
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