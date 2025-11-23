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
