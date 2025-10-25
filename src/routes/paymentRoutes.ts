import { Router } from 'express';
import { Request, Response } from 'express';
import prisma from '../config/database';
import { paymentService } from '../services/paymentService';
import { emailService } from '../services/emailService';
import { paylerController } from '../controllers/paylerController';
import { alifController } from '../controllers/alifController';
import Stripe from 'stripe';

const router = Router();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// Create payment intent for Stripe
router.post('/create-payment-intent', async (req: Request, res: Response) => {
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

    // Create payment intent
    const paymentIntent = await paymentService.createPaymentIntent(order);

    // Update order with payment intent ID
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentIntentId: paymentIntent.paymentIntentId,
      },
    });

    return res.json({
      success: true,
      clientSecret: paymentIntent.clientSecret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create checkout session for full Stripe checkout
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { orderNumber, successUrl, cancelUrl } = req.body;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required',
      });
    }

    // Get order details
    const order = await prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Create checkout session
    const session = await paymentService.createCheckoutSession(
      order,
      successUrl || `${process.env.FRONTEND_URL}/payment-success?order=${orderNumber}`,
      cancelUrl || `${process.env.FRONTEND_URL}/payment-cancel?order=${orderNumber}`
    );

    return res.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Confirm payment status
router.post('/confirm-payment', async (req: Request, res: Response) => {
  try {
    const { paymentIntentId, orderNumber } = req.body;

    if (!paymentIntentId || !orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID and order number are required',
      });
    }

    // Confirm payment status with Stripe
    const result = await paymentService.confirmPayment(paymentIntentId);

    if (result.success) {
      // Update order status
      const order = await prisma.order.update({
        where: { orderNumber },
        data: {
          paymentStatus: 'paid',
          status: 'confirmed',
          paymentIntentId: result.transactionId,
        },
        include: {
          customer: true,
          tour: true,
        },
      });

      // Send payment confirmation email
      await emailService.sendPaymentConfirmation(order, order.customer);

      return res.json({
        success: true,
        message: 'Payment confirmed successfully',
        transactionId: result.transactionId,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Payment confirmation failed',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error confirming payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Stripe webhook endpoint
router.post('/stripe-webhook', async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(503).json({
      success: false,
      message: 'Stripe is not configured',
    });
  }
  
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    
    // Handle the event
    const result = await paymentService.handleWebhook(event);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderNumber = paymentIntent.metadata.orderNumber;

      if (orderNumber) {
        // Update order status
        const order = await prisma.order.update({
          where: { orderNumber },
          data: {
            paymentStatus: 'paid',
            status: 'confirmed',
            paymentIntentId: paymentIntent.id,
          },
          include: {
            customer: true,
            tour: true,
          },
        });

        // Send payment confirmation email
        await emailService.sendPaymentConfirmation(order, order.customer);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({
      success: false,
      message: 'Webhook error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Process refund
router.post('/refund', async (req: Request, res: Response) => {
  try {
    const { orderNumber, amount } = req.body;

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
      },
    });

    if (!order || !order.paymentIntentId) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or no payment to refund',
      });
    }

    // Process refund
    const result = await paymentService.refundPayment(order.paymentIntentId, amount);

    if (result.success) {
      // Update order status
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'refunded',
          paymentStatus: 'refunded',
        },
      });

      // Send cancellation email
      await emailService.sendCancellationEmail(order, order.customer);

      return res.json({
        success: true,
        message: 'Refund processed successfully',
        transactionId: result.transactionId,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Refund failed',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error processing refund:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get payment methods (for admin panel)
router.get('/payment-methods', async (req: Request, res: Response) => {
  try {
    const methods = [
      {
        id: 'stripe',
        name: 'Stripe',
        enabled: !!process.env.STRIPE_SECRET_KEY,
        description: 'Credit/Debit cards via Stripe',
      },
      {
        id: 'paypal',
        name: 'PayPal',
        enabled: !!process.env.PAYPAL_CLIENT_ID,
        description: 'PayPal payments',
      },
      {
        id: 'payme',
        name: 'Payme',
        enabled: !!process.env.PAYME_MERCHANT_ID,
        description: 'Uzbekistan payment system',
      },
      {
        id: 'click',
        name: 'Click',
        enabled: !!process.env.CLICK_MERCHANT_ID,
        description: 'Uzbekistan payment system',
      },
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