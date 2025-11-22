/**
 * Guide Payment Controller
 * Handles creating orders from guide hire requests and processing payments
 */

import { Request, Response } from 'express';
import prisma, { withRetry } from '../config/database';

export const guidePaymentController = {
  /**
   * Create an order from a guide hire request
   * POST /api/guide-hire/:id/create-order
   */
  async createOrderFromGuideHire(req: Request, res: Response) {
    try {
      const hireRequestId = parseInt(req.params.id);

      if (isNaN(hireRequestId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid guide hire request ID'
        });
      }

      // Получить guide hire request с информацией о гиде
      const hireRequest = await withRetry(() => 
        prisma.guideHireRequest.findUnique({
          where: { id: hireRequestId },
          include: {
            guide: true
          }
        })
      );

      if (!hireRequest) {
        return res.status(404).json({
          success: false,
          message: 'Guide hire request not found'
        });
      }

      // Проверить статус заявки - должна быть одобрена перед оплатой
      // Это гарантирует что админ проверил заявку и подтвердил доступность гида
      if (hireRequest.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: `Guide hire request must be approved before payment. Current status: ${hireRequest.status}. Please wait for admin approval.`
        });
      }

      // Проверить что гид активен и доступен для найма
      if (!hireRequest.guide.isActive || !hireRequest.guide.isHireable) {
        return res.status(400).json({
          success: false,
          message: 'Guide is not available for hire'
        });
      }

      // Проверить что заказ еще не создан
      const existingOrder = await withRetry(() =>
        prisma.order.findUnique({
          where: { guideHireRequestId: hireRequestId }
        })
      );

      if (existingOrder) {
        return res.json({
          success: true,
          data: {
            orderNumber: existingOrder.orderNumber,
            totalAmount: existingOrder.totalAmount
          },
          message: 'Order already exists for this guide hire request'
        });
      }

      // Получить или создать клиента
      let customer = await withRetry(() =>
        prisma.customer.findFirst({
          where: {
            OR: [
              { email: hireRequest.touristEmail || undefined },
              { phone: hireRequest.touristPhone || undefined }
            ]
          }
        })
      );

      if (!customer) {
        customer = await withRetry(() =>
          prisma.customer.create({
            data: {
              fullName: hireRequest.touristName,
              email: hireRequest.touristEmail || `noemail_${Date.now()}@bunyodtour.tj`,
              phone: hireRequest.touristPhone || ''
            }
          })
        );
      }

      // Получить сумму
      const totalAmount = hireRequest.totalPrice;

      if (totalAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Guide hire price not set. Please contact admin.'
        });
      }

      // Парсим выбранные даты
      let selectedDates: string[] = [];
      try {
        selectedDates = JSON.parse(hireRequest.selectedDates);
      } catch (error) {
        selectedDates = [hireRequest.selectedDates];
      }

      // Первая дата как дата тура
      const tourDate = selectedDates[0] || new Date().toISOString().split('T')[0];

      // Сгенерировать orderNumber
      const orderNumber = `GUIDE-${Date.now()}-${hireRequestId}`;

      // Создать заказ
      const order = await withRetry(() =>
        prisma.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            guideHireRequestId: hireRequestId,
            guideId: hireRequest.guideId,
            tourDate: tourDate,
            tourists: JSON.stringify([{
              name: hireRequest.touristName,
              phone: hireRequest.touristPhone,
              email: hireRequest.touristEmail
            }]),
            wishes: hireRequest.comments || '',
            totalAmount,
            status: 'pending',
            paymentStatus: 'unpaid'
          },
          include: {
            customer: true
          }
        })
      );

      console.log(`✅ Order created for guide hire request ${hireRequestId}: ${orderNumber}, Amount: ${totalAmount} ${hireRequest.currency}`);

      return res.json({
        success: true,
        data: {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          orderId: order.id
        },
        message: 'Order created successfully'
      });

    } catch (error) {
      console.error('❌ Error creating order from guide hire request:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};
