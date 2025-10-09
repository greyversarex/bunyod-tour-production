import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
import crypto from 'crypto';
import fetch from 'node-fetch';

export const alifController = {
  /**
   * Создать платеж через AlifPay API
   * POST /api/payments/alif/create
   */
  async createPayment(req: Request, res: Response) {
    try {
      const { orderNumber, returnUrl, failUrl } = req.body;

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

      const alifMerchantKey = process.env.ALIF_MERCHANT_KEY;
      const alifMerchantPassword = process.env.ALIF_MERCHANT_PASSWORD;
      const alifApiUrl = process.env.ALIF_API_URL;
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

      if (!alifMerchantKey || !alifMerchantPassword || !alifApiUrl) {
        return res.status(500).json({
          success: false,
          message: 'AlifPay configuration missing (ALIF_MERCHANT_KEY, ALIF_MERCHANT_PASSWORD, ALIF_API_URL)',
        });
      }

      // Генерируем HMAC-SHA256 хэш от пароля для безопасности
      const hashedPassword = crypto
        .createHmac('sha256', alifMerchantKey)
        .update(alifMerchantPassword)
        .digest('hex');

      // Преобразовать сумму в тийины (умножить на 100)
      const amount = Math.round(order.totalAmount * 100);
      const orderId = order.id.toString();

      // URLs для возврата
      const defaultReturnUrl = `${baseUrl}/payment-success?orderNumber=${orderNumber}`;
      const defaultFailUrl = `${baseUrl}/payment-fail?orderNumber=${orderNumber}`;

      console.log(`🔄 Creating AlifPay v2 payment: Order ${orderId}, Amount ${amount} тийинов`);

      // AlifPay API v2 payload
      const paymentData = {
        merchant_id: alifMerchantKey,
        password: hashedPassword,
        order_id: orderId,
        amount: Math.round(order.totalAmount * 100), // в тийинах
        description: `Order ${orderId}`,
        return_url: `${baseUrl}/payment/success`,
        fail_url: `${baseUrl}/payment/fail`,
        lang: "ru"
      };

      // Отправить запрос к AlifPay API v2
      const response = await fetch(`${alifApiUrl}/v2/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        console.error('❌ AlifPay API v2 failed:', response.statusText);
        return res.status(500).json({
          success: false,
          message: 'Failed to communicate with AlifPay API v2',
        });
      }

      const responseData = await response.json() as any;
      console.log('🔄 AlifPay API v2 response:', responseData);

      if (!responseData.success || !responseData.checkout_url) {
        console.error('❌ AlifPay v2 payment creation failed:', responseData);
        return res.status(500).json({
          success: false,
          message: 'Failed to create AlifPay v2 payment',
          error: responseData.error || 'Unknown error',
        });
      }

      // Обновить заказ в БД с payment_id
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: 'alif',
          paymentStatus: 'processing',
          paymentIntentId: responseData.payment_id,
        },
      });

      console.log(`✅ AlifPay v2 payment created successfully`);

      // Возвращаем checkout_url клиенту
      return res.json({
        success: true,
        redirectUrl: responseData.checkout_url,
        payment_id: responseData.payment_id,
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
   * Обработка callback от AlifPay с проверкой подписи
   * POST /api/payments/alif/callback
   */
  async callback(req: Request, res: Response) {
    try {
      const { merchant_id, order_id, amount, status, signature } = req.body;
      
      console.log('🔄 AlifPay v2 callback received:', { merchant_id, order_id, amount, status, signature: signature ? 'present' : 'missing' });

      if (!merchant_id || !order_id || !status || !signature) {
        console.error('❌ Missing required fields in AlifPay v2 callback');
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // ✅ КРИТИЧЕСКИ ВАЖНО: Валидация подписи
      const alifMerchantKey = process.env.ALIF_MERCHANT_KEY;
      const alifMerchantPassword = process.env.ALIF_MERCHANT_PASSWORD;
      
      if (!alifMerchantKey || !alifMerchantPassword) {
        console.error('❌ AlifPay configuration missing for callback validation');
        return res.status(500).json({
          success: false,
          message: 'Payment configuration error'
        });
      }

      // Проверяем signature == HMAC-SHA256(originalPassword, merchant_id)
      const expected = crypto
        .createHmac('sha256', alifMerchantPassword)
        .update(merchant_id)
        .digest('hex');

      if (signature !== expected) {
        console.error('❌ Invalid signature in AlifPay v2 callback:', {
          received: signature,
          expected: expected,
          merchant_id: merchant_id
        });
        return res.status(403).json({
          success: false,
          message: 'Invalid signature'
        });
      }

      console.log('✅ AlifPay v2 callback signature validated successfully');

      // Найти заказ
      const order = await prisma.order.findUnique({
        where: { id: Number(order_id) },
        include: {
          customer: true,
          tour: true,
        },
      });

      if (!order) {
        console.error('❌ Order not found for AlifPay v2 callback:', order_id);
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // ✅ Обновить статус платежа
      if (status === 'PAID') {
        await prisma.order.update({
          where: { id: Number(order_id) },
          data: {
            paymentStatus: 'paid',
          },
        });

        console.log('✅ Payment confirmed for order:', order_id);

        // Отправить email подтверждение
        try {
          await emailService.sendPaymentConfirmation(order, order.customer);
          console.log('✅ Confirmation email sent for order:', order_id);
        } catch (emailError) {
          console.error('❌ Email sending failed:', emailError);
        }
      } else if (status === 'FAILED') {
        await prisma.order.update({
          where: { id: Number(order_id) },
          data: {
            paymentStatus: 'failed',
          },
        });
        console.log('⚠️ Payment failed for order:', order_id, 'with status:', status);
      } else {
        console.log('ℹ️ Unknown payment status for order:', order_id, 'status:', status);
      }

      return res.json({ success: true });

    } catch (error) {
      console.error('❌ AlifPay v2 callback error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
};