import Stripe from 'stripe';
import { Order } from '@prisma/client';

// Initialize Stripe with secret key (only if key is provided)
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// Payment service interface
interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export const paymentService = {
  // Create a payment intent for Stripe
  async createPaymentIntent(order: Order): Promise<PaymentIntent> {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
    }
    
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.totalAmount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          orderId: order.id.toString(),
          orderNumber: order.orderNumber,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amount: order.totalAmount,
        currency: 'usd',
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  },

  // Confirm payment status
  async confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
    if (!stripe) {
      return {
        success: false,
        error: 'Stripe is not configured',
      };
    }
    
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          transactionId: paymentIntent.id,
        };
      } else {
        return {
          success: false,
          error: `Payment status: ${paymentIntent.status}`,
        };
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      return {
        success: false,
        error: 'Failed to confirm payment',
      };
    }
  },

  // Create a checkout session for full checkout flow
  async createCheckoutSession(order: Order, successUrl: string, cancelUrl: string) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
    }
    
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Tour Booking #${order.orderNumber}`,
                description: `Booking for tour on ${new Date(order.tourDate).toLocaleDateString()}`,
              },
              unit_amount: Math.round(order.totalAmount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          orderId: order.id.toString(),
          orderNumber: order.orderNumber,
        },
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  },

  // Handle webhook events from Stripe
  async handleWebhook(event: Stripe.Event): Promise<PaymentResult> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          success: true,
          transactionId: paymentIntent.id,
        };
      
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        return {
          success: false,
          error: failedPayment.last_payment_error?.message || 'Payment failed',
        };
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
        return {
          success: false,
          error: 'Unhandled webhook event',
        };
    }
  },

  // Refund a payment
  async refundPayment(paymentIntentId: string, amount?: number): Promise<PaymentResult> {
    if (!stripe) {
      return {
        success: false,
        error: 'Stripe is not configured',
      };
    }
    
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
      });

      return {
        success: true,
        transactionId: refund.id,
      };
    } catch (error) {
      console.error('Error processing refund:', error);
      return {
        success: false,
        error: 'Failed to process refund',
      };
    }
  },
};

// PayPal integration (placeholder for future implementation)
export const paypalService = {
  async createOrder(order: Order): Promise<any> {
    // PayPal integration would go here
    console.log('PayPal integration not yet implemented');
    return {
      success: false,
      error: 'PayPal integration coming soon',
    };
  },
};

// Payme integration (Uzbekistan payment system)
export const paymeService = {
  async createTransaction(order: Order): Promise<any> {
    // Payme integration would go here
    console.log('Payme integration not yet implemented');
    return {
      success: false,
      error: 'Payme integration coming soon',
    };
  },
};

// Click integration (Uzbekistan payment system)
export const clickService = {
  async createInvoice(order: Order): Promise<any> {
    // Click integration would go here
    console.log('Click integration not yet implemented');
    return {
      success: false,
      error: 'Click integration coming soon',
    };
  },
};

export default paymentService;