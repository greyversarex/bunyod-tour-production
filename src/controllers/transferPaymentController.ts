/**
 * Transfer Payment Controller
 * Handles creating orders from transfer requests and processing payments
 */

import { Request, Response } from 'express';
import prisma, { withRetry } from '../config/database';

export const transferPaymentController = {
  /**
   * Create an order from a transfer request
   * POST /api/transfers/:id/create-order
   */
  async createOrderFromTransfer(req: Request, res: Response) {
    try {
      const transferId = parseInt(req.params.id);

      if (isNaN(transferId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transfer request ID'
        });
      }

      // Получить transfer request с информацией о водителе
      const transferRequest = await withRetry(() => 
        prisma.transferRequest.findUnique({
          where: { id: transferId },
          include: {
            assignedDriver: true
          }
        })
      );

      if (!transferRequest) {
        return res.status(404).json({
          success: false,
          message: 'Transfer request not found'
        });
      }

      // ✅ ПРЯМАЯ ОПЛАТА: Разрешаем оплату в любом статусе (как guide hire)
      // Водитель будет назначен админом после оплаты
      // (Проверка assignedDriver убрана для прямой оплаты)

      // Проверить что заказ еще не создан
      const existingOrder = await withRetry(() =>
        prisma.order.findUnique({
          where: { transferRequestId: transferId }
        })
      );

      if (existingOrder) {
        return res.json({
          success: true,
          data: {
            orderNumber: existingOrder.orderNumber,
            totalAmount: existingOrder.totalAmount
          },
          message: 'Order already exists for this transfer'
        });
      }

      // Получить или создать клиента
      let customer = await withRetry(() =>
        prisma.customer.findFirst({
          where: {
            OR: [
              { email: transferRequest.email || undefined },
              { phone: transferRequest.phone || undefined }
            ]
          }
        })
      );

      if (!customer) {
        customer = await withRetry(() =>
          prisma.customer.create({
            data: {
              fullName: transferRequest.fullName,
              email: transferRequest.email || `noemail_${Date.now()}@bunyodtour.tj`,
              phone: transferRequest.phone || ''
            }
          })
        );
      }

      // ✅ CRITICAL: Проверить что customer создан успешно
      if (!customer) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create customer'
        });
      }

      // Рассчитать сумму (используем finalPrice если установлена, иначе estimatedPrice)
      const totalAmount = transferRequest.finalPrice || transferRequest.estimatedPrice || 0;

      if (totalAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Transfer price not set. Please contact admin to set the price.'
        });
      }

      // Сгенерировать orderNumber (формат: TR-timestamp-customerId)
      const orderNumber = `TR-${Date.now()}-${customer.id}`;

      // Создать заказ
      const order = await withRetry(() =>
        prisma.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            transferRequestId: transferId,
            tourDate: transferRequest.pickupDate,
            tourists: JSON.stringify([{
              name: transferRequest.fullName,
              phone: transferRequest.phone,
              email: transferRequest.email
            }]),
            wishes: transferRequest.specialRequests || '',
            totalAmount,
            status: 'pending',
            paymentStatus: 'unpaid'
          },
          include: {
            customer: true
          }
        })
      );

      console.log(`✅ Order created for transfer ${transferId}: ${orderNumber}, Amount: ${totalAmount} TJS`);

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
      console.error('❌ Error creating order from transfer:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};
