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
        // 🆕 Если пользователь поменял опцию оплаты или формула цены изменилась
        // (например, добавлены суточные расходы водителя в новой версии),
        // обновляем существующий неоплаченный заказ под актуальный расчёт.
        // Уже оплаченный заказ не трогаем.
        const rawOpt = req.body.paymentOption;
        const requestedOption = (rawOpt === 'deposit' || rawOpt === 'deposit_25') ? rawOpt : 'full';
        // 🔒 Менять можно только пока платёж ещё не начат.
        const safeToMutate = ['unpaid', 'pending', null, undefined].includes(existingOrder.paymentStatus as any)
          && !['paid', 'processing'].includes(existingOrder.status as any);
        const currentOption = existingOrder.paymentOption || 'full';
        const optionChanged = currentOption !== requestedOption;

        if (!safeToMutate && optionChanged) {
          console.warn(`⚠️ Transfer order ${existingOrder.orderNumber}: option change blocked (paymentStatus=${existingOrder.paymentStatus}, status=${existingOrder.status})`);
          return res.status(409).json({
            success: false,
            message: 'Платёж по этому заказу уже начат. Дождитесь завершения или обратитесь к администратору.',
          });
        }

        // Считаем актуальную полную сумму по текущей формуле (включает суточные водителя)
        const pricePerDayE = transferRequest.finalPrice || transferRequest.estimatedPrice || 0;
        const rentalDaysE = transferRequest.rentalDays || 1;
        const driverDailyExpenseE = Math.max(0, rentalDaysE - 1) * 300;
        const fullAmtE = pricePerDayE * rentalDaysE + driverDailyExpenseE;
        if (fullAmtE <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Transfer price not set. Please contact admin to set the price.'
          });
        }
        const mul = requestedOption === 'deposit' ? 0.1 : requestedOption === 'deposit_25' ? 0.25 : 1;
        const newPayable = Math.round(fullAmtE * mul * 100) / 100;
        const amountMismatch = Math.abs((existingOrder.totalAmount || 0) - newPayable) > 0.01;

        if (safeToMutate && (optionChanged || amountMismatch)) {
          const updated = await withRetry(() =>
            prisma.order.update({
              where: { id: existingOrder.id },
              data: {
                paymentOption: requestedOption,
                totalAmount: newPayable
              }
            })
          );
          console.log(`🔁 Existing transfer order ${updated.orderNumber} synced: option ${currentOption}→${requestedOption}, totalAmount ${existingOrder.totalAmount}→${newPayable} (full=${fullAmtE})`);
          return res.json({
            success: true,
            data: {
              orderNumber: updated.orderNumber,
              totalAmount: updated.totalAmount,
              fullAmount: fullAmtE,
              paymentOption: requestedOption,
              orderId: updated.id
            },
            message: 'Order updated to current pricing'
          });
        }

        return res.json({
          success: true,
          data: {
            orderNumber: existingOrder.orderNumber,
            totalAmount: existingOrder.totalAmount,
            fullAmount: fullAmtE,
            paymentOption: existingOrder.paymentOption || 'full',
            orderId: existingOrder.id
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

      // Рассчитать сумму: цена × количество дней аренды + суточные расходы водителя
      const pricePerDay = transferRequest.finalPrice || transferRequest.estimatedPrice || 0;
      const rentalDays = transferRequest.rentalDays || 1;
      const dropoffDate = transferRequest.dropoffDate;
      // 🆕 Суточные расходы водителя: 300 TJS за каждый дополнительный день (после первого)
      const driverDailyExpense = Math.max(0, rentalDays - 1) * 300;
      const vehicleSubtotal = pricePerDay * rentalDays;
      const fullAmount = vehicleSubtotal + driverDailyExpense;

      if (fullAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Transfer price not set. Please contact admin to set the price.'
        });
      }

      console.log(`💰 Transfer price: ${pricePerDay} × ${rentalDays} = ${vehicleSubtotal} TJS + суточные водителя ${driverDailyExpense} TJS = ${fullAmount} TJS`);

      // Сгенерировать orderNumber (формат: TR-timestamp-customerId)
      const orderNumber = `TR-${Date.now()}-${customer.id}`;

      const customerLanguage = req.body.language || req.query.lang || transferRequest.language || 'ru';
      
      // Получаем опцию оплаты (full / deposit 10% / deposit_25 25%).
      const rawPayOpt = req.body.paymentOption;
      const paymentOption = (rawPayOpt === 'deposit' || rawPayOpt === 'deposit_25') ? rawPayOpt : 'full';
      // 🆕 Сумма к списанию: депозит — 10% или 25% от полной стоимости (вкл. суточные водителя).
      const payMul = paymentOption === 'deposit' ? 0.1 : paymentOption === 'deposit_25' ? 0.25 : 1;
      const paymentAmount = Math.round(fullAmount * payMul * 100) / 100;
      console.log(`💰 Payment option for transfer: ${paymentOption} → к оплате ${paymentAmount} TJS из ${fullAmount} TJS`);

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
            totalAmount: paymentAmount, // 🎯 Сумма к списанию (10% для deposit, 100% для full)
            status: 'pending',
            paymentStatus: 'unpaid',
            paymentOption: paymentOption, // 'full' или 'deposit' (10%)
            language: customerLanguage
          },
          include: {
            customer: true
          }
        })
      );

      console.log(`✅ Order created for transfer ${transferId}: ${orderNumber}, к оплате: ${paymentAmount} TJS (полная: ${fullAmount} TJS)`);

      return res.json({
        success: true,
        data: {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          fullAmount, // 🆕 Полная стоимость трансфера для справки на фронте
          paymentOption,
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
