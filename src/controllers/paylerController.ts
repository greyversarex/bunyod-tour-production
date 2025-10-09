import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
import crypto from 'crypto';
import fetch from 'node-fetch';

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

      // Преобразовать сумму в копейки (умножить на 100)
      const amount = Math.round(order.totalAmount * 100);
      const orderId = order.id.toString();

      // URLs для возврата
      const returnUrl = `${baseUrl}/payment-success?orderNumber=${orderNumber}`;
      const failUrl = `${baseUrl}/payment-fail?orderNumber=${orderNumber}`;

      console.log(`🔄 Creating Payler payment: Order ${orderId}, Amount ${amount} копеек`);

      // Подготовить данные для StartSession API (как в PHP-версии)
      const fields = {
        key: paylerKey, // ключ берём теперь из .env
        type: 'OneStep',
        currency: 'TJS',
        lang: 'en',
        amount: amount.toString(),
        order_id: orderId,
        return_url: returnUrl,
        fail_url: failUrl
      };

      // Отправить запрос к боевому Payler StartSession API (убрали sandbox)
      const response = await fetch('https://secure.payler.com/gapi/StartSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(fields),
      });

      if (!response.ok) {
        console.error('❌ Payler StartSession failed:', response.statusText);
        return res.status(500).json({
          success: false,
          message: 'Failed to communicate with Payler API',
        });
      }

      const responseText = await response.text();
      console.log('🔄 Payler StartSession response:', responseText);

      // Парсим ответ
      let responseData;
      try {
        responseData = JSON.parse(responseText);
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
   * Обработка callback от Payler с HMAC валидацией
   * POST /api/payments/payler/callback
   */
  async callback(req: Request, res: Response) {
    try {
      const { orderId, status } = req.body;
      const signature = req.headers['x-payler-signature'] as string;
      
      console.log('🔄 Payler callback received:', { orderId, status, signature: signature ? 'present' : 'missing' });

      if (!orderId || !status) {
        console.error('❌ Missing required fields in Payler callback');
        return res.status(400).json({
          success: false,
          message: 'Missing orderId or status'
        });
      }

      // ✅ КРИТИЧЕСКИ ВАЖНО: Валидация HMAC подписи
      const paylerKey = process.env.PAYLER_KEY;
      
      if (!paylerKey) {
        console.error('❌ Payler configuration missing for callback validation');
        return res.status(500).json({
          success: false,
          message: 'Payment configuration error'
        });
      }

      if (!signature) {
        console.error('❌ Missing signature in Payler callback');
        return res.status(403).json({
          success: false,
          message: 'Invalid signature'
        });
      }

      // Формируем строку для HMAC (orderId + status)
      const message = `${orderId}${status}`;
      const expected = crypto
        .createHmac('sha256', paylerKey)
        .update(message)
        .digest('hex');

      if (signature !== expected) {
        console.error('❌ Invalid HMAC signature in Payler callback:', {
          received: signature,
          expected: expected,
          message: message
        });
        return res.status(403).json({
          success: false,
          message: 'Invalid signature'
        });
      }

      console.log('✅ Payler callback signature validated successfully');

      // Найти заказ
      const order = await prisma.order.findUnique({
        where: { id: Number(orderId) },
        include: {
          customer: true,
          tour: true,
        },
      });

      if (!order) {
        console.error('❌ Order not found for Payler callback:', orderId);
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // ✅ Обновить статус платежа
      if (status === 'Charged') {
        await prisma.order.update({
          where: { id: Number(orderId) },
          data: {
            paymentStatus: 'paid',
          },
        });

        console.log('✅ Payment confirmed for order:', orderId);

        // Отправить email подтверждение
        try {
          await emailService.sendPaymentConfirmation(order, order.customer);
          console.log('✅ Confirmation email sent for order:', orderId);
        } catch (emailError) {
          console.error('❌ Email sending failed:', emailError);
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
      console.error('❌ Payler callback error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
};