import { Router } from 'express';
import { Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
import { paylerController } from '../controllers/paylerController';
import { alifController } from '../controllers/alifController';

const router = Router();

// Get payment methods (for admin panel)
router.get('/payment-methods', async (req: Request, res: Response) => {
  try {
    const methods = [
      {
        id: 'alif',
        name: 'AlifPay',
        enabled: !!(process.env.ALIF_MERCHANT_KEY && process.env.ALIF_MERCHANT_PASSWORD),
        description: 'Tajikistan payment system (Alif Bank)',
      },
      {
        id: 'payler',
        name: 'Payler',
        enabled: !!process.env.PAYLER_KEY,
        description: 'Tajikistan payment system',
      },
    ];

    return res.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment methods',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Payler integration (OLD - DEPRECATED, use /payler/create instead)
router.post('/payler', async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.body;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required',
      });
    }

    // Get order details
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

    if (!paylerKey) {
      return res.status(500).json({
        success: false,
        message: 'Payler configuration missing',
      });
    }

    // Call Payler StartSession API
    const paylerAmount = Math.round(order.totalAmount * 100); // Convert to tiyin
    const fetch = require('node-fetch');

    const startSessionBody = new URLSearchParams({
      key: paylerKey,
      type: 'OneStep',
      currency: 'TJS',
      amount: paylerAmount.toString(),
      order_id: order.id.toString(),
    });

    const response = await fetch('https://secure.payler.com/gapi/StartSession', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: startSessionBody,
    });

    const responseData = await response.text();
    console.log('Payler StartSession response:', responseData);

    // Parse response (format: session_id=XXXXX)
    const sessionIdMatch = responseData.match(/session_id=([^&\s]+)/);
    
    if (!sessionIdMatch) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create Payler session',
        error: responseData,
      });
    }

    const sessionId = sessionIdMatch[1];

    // Update order with payment method
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: 'payler',
        paymentStatus: 'processing',
        paymentIntentId: sessionId,
      },
    });

    return res.json({
      success: true,
      paymentUrl: `https://secure.payler.com/gapi/Pay/?session_id=${sessionId}`,
      sessionId: sessionId,
    });

  } catch (error) {
    console.error('Payler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payler integration error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Payler callback (OLD - DEPRECATED, use /payler/callback instead)
router.post('/payler-callback', async (req: Request, res: Response) => {
  try {
    const { order_id, status, session_id } = req.body;

    console.log('Payler callback received:', req.body);

    if (!order_id) {
      return res.status(400).send('Bad Request');
    }

    const order = await prisma.order.findUnique({
      where: { id: parseInt(order_id) },
      include: {
        customer: true,
      },
    });

    if (!order) {
      return res.status(404).send('Order Not Found');
    }

    // Update payment status based on Payler response
    if (status === 'success' || status === 'Charged') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'paid',
        },
      });

      // Send confirmation email
      try {
        await emailService.sendPaymentConfirmation(order, order.customer);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'failed',
        },
      });
    }

    return res.status(200).send('OK');

  } catch (error) {
    console.error('Payler callback error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// ✅ НОВЫЕ БЕЗОПАСНЫЕ PAYLER РОУТЫ
// Создание платежа через улучшенный Payler контроллер
router.post('/payler/create', paylerController.createPayment);

// Callback от Payler с улучшенной валидацией
router.post('/payler/callback', paylerController.callback);

// ✅ НОВЫЕ БЕЗОПАСНЫЕ ALIF РОУТЫ
// Создание платежа через AlifPay контроллер
router.post('/alif/create', alifController.createPayment);

// Callback от AlifPay с проверкой подписи
router.post('/alif/callback', alifController.callback);

export default router;