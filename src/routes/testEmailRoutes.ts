import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { emailService } from '../services/emailService';

const router = Router();

router.get('/test-email', async (req: Request, res: Response) => {
  try {
    console.log('📧 Testing email with PDF attachment...');
    
    const order = await prisma.order.findFirst({
      where: {
        status: 'paid'
      },
      include: {
        customer: true,
        tour: {
          include: {
            tourHotels: {
              include: {
                hotel: true
              }
            }
          }
        },
        hotel: true,
        guide: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'No paid orders found for testing. Please complete a payment first.'
      });
    }

    if (!order.customer) {
      return res.status(404).json({
        success: false,
        message: 'Order has no customer associated'
      });
    }

    console.log(`📧 Sending test email to: ${order.customer.email}`);
    console.log(`📦 Order: ${order.orderNumber}`);
    
    const emailSent = await emailService.sendPaymentConfirmation(order, order.customer);
    
    if (emailSent) {
      return res.json({
        success: true,
        message: `✅ Test email with PDF ticket sent successfully to ${order.customer.email}`,
        orderNumber: order.orderNumber,
        customerEmail: order.customer.email
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email. Check console logs for details.'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error sending test email:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message
    });
  }
});

export default router;
