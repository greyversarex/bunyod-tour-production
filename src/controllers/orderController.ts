import { Request, Response } from 'express';
import prisma from '../config/database';
import { BookingFormData, OrderData } from '../types/booking';
import { emailService } from '../services/emailService';
import { parseMultilingualField, getLanguageFromRequest } from '../utils/multilingual';

// Generate unique order number
const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BT-${timestamp.slice(-6)}${random}`;
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const bookingData: BookingFormData = req.body;

    // Validate required fields
    if (!bookingData.customerName || !bookingData.customerEmail || !bookingData.customerPhone) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, email, and phone are required',
      });
    }

    if (!bookingData.termsAccepted || !bookingData.paymentRulesAccepted) {
      return res.status(400).json({
        success: false,
        message: 'Both terms and payment rules must be accepted',
      });
    }

    // Check if customer exists, create if not
    let customer = await prisma.customer.findUnique({
      where: { email: bookingData.customerEmail },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          fullName: bookingData.customerName,
          email: bookingData.customerEmail,
          phone: bookingData.customerPhone,
        },
      });
    }

    // Get tour information for pricing
    const tour = await prisma.tour.findUnique({
      where: { id: parseInt(req.body.tourId) },
      include: {
        category: true,
      },
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found',
      });
    }

    // Calculate total amount with proper pricing logic
    const basePrice = parseFloat(tour.price);
    const numberOfTourists = bookingData.tourists.length;
    const tourPriceType = tour.priceType;
    
    let totalAmount = 0;
    
    // Calculate tour base price
    if (tourPriceType === 'за человека') {
      totalAmount += basePrice * numberOfTourists;
    } else {
      totalAmount += basePrice; // За группу
    }
    
    // Add hotel costs if selected
    if (bookingData.selectedHotelId && (bookingData as any).roomSelection) {
      const hotel = await prisma.hotel.findUnique({
        where: { id: bookingData.selectedHotelId }
      });
      
      if (hotel) {
        const tourDuration = parseInt(tour.duration.replace(/\D/g, '')) || 1;
        const roomSelection = typeof (bookingData as any).roomSelection === 'string' 
          ? JSON.parse((bookingData as any).roomSelection) 
          : (bookingData as any).roomSelection;
          
        for (const [roomType, roomData] of Object.entries(roomSelection as any)) {
          const room = roomData as any;
          if (room.quantity > 0 && room.price) {
            totalAmount += room.price * room.quantity * tourDuration;
          }
        }
      }
    }
    
    // Add meal costs if selected
    if (bookingData.selectedHotelId && (bookingData as any).mealSelection) {
      const tourDuration = parseInt(tour.duration.replace(/\D/g, '')) || 1;
      const mealSelection = typeof (bookingData as any).mealSelection === 'string' 
        ? JSON.parse((bookingData as any).mealSelection) 
        : (bookingData as any).mealSelection;
        
      for (const [mealType, mealData] of Object.entries(mealSelection as any)) {
        const meal = mealData as any;
        if (meal.selected && meal.price) {
          totalAmount += meal.price * numberOfTourists * tourDuration;
        }
      }
    }

    // Create order
    const orderNumber = generateOrderNumber();
    const customerLanguage = req.body.language || getLanguageFromRequest(req) || 'ru';
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        tourId: parseInt(req.body.tourId),
        hotelId: bookingData.selectedHotelId || null,
        guideId: bookingData.selectedGuideId || null,
        tourDate: bookingData.tourDate,
        tourists: JSON.stringify(bookingData.tourists),
        wishes: bookingData.wishes,
        totalAmount,
        status: 'pending',
        paymentStatus: 'unpaid',
        language: customerLanguage,
      },
      include: {
        customer: true,
        tour: {
          include: {
            category: true,
          },
        },
        hotel: true,
        guide: true,
        guideHireRequest: {
          include: {
            guide: true,
          },
        },
        transferRequest: true,
      },
    });

    // Send confirmation emails (non-blocking)
    try {
      await emailService.sendBookingConfirmation(order, customer, order.tour);
      await emailService.sendAdminNotification(order, customer, order.tour);
    } catch (emailError) {
      console.error('Email sending failed (non-critical):', emailError);
    }

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const language = getLanguageFromRequest(req);

    // Определить тип заказа по префиксу orderNumber
    let formattedOrder: any = null;

    if (orderNumber.startsWith('GH-')) {
      // Guide Hire Order
      const guideHireOrder = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          customer: true,
          guideHireRequest: {
            include: {
              guide: true
            }
          }
        }
      });

      if (guideHireOrder && guideHireOrder.guideHireRequest) {
        formattedOrder = {
          ...guideHireOrder,
          orderType: 'guide-hire',
          totalAmount: guideHireOrder.totalAmount,
          currency: 'TJS'
        };
      }
    } else if (orderNumber.startsWith('TR-')) {
      // Transfer Order
      const transferOrder = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          customer: true,
          transferRequest: true
        }
      });

      if (transferOrder && transferOrder.transferRequest) {
        formattedOrder = {
          ...transferOrder,
          orderType: 'transfer',
          totalAmount: transferOrder.totalAmount,
          currency: 'TJS'
        };
      }
    } else if (orderNumber.startsWith('CT-')) {
      // Custom Tour Order
      const customTourOrder = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          customer: true,
          customTourOrder: true
        }
      });

      if (customTourOrder && customTourOrder.customTourOrder) {
        formattedOrder = {
          ...customTourOrder,
          orderType: 'custom-tour',
          totalAmount: customTourOrder.totalAmount,
          currency: 'TJS'
        };
      }
    } else {
      // Regular Tour Order (BT-* или без префикса)
      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          customer: true,
          tour: {
            include: {
              category: true,
            },
          },
          hotel: true,
          guide: true,
        },
      });

      if (order) {
        formattedOrder = {
          ...order,
          orderType: 'tour',
          tourists: order.tourists ? JSON.parse(order.tourists) : [],
          tour: order.tour ? {
            ...order.tour,
            title: parseMultilingualField(order.tour.title, language),
            description: parseMultilingualField(order.tour.description, language),
          } : null,
          hotel: order.hotel ? {
            ...order.hotel,
            name: parseMultilingualField(order.hotel.name, language),
            description: order.hotel.description ? parseMultilingualField(order.hotel.description, language) : null,
          } : null,
          guide: order.guide ? {
            ...order.guide,
            name: parseMultilingualField(order.guide.name, language),
            description: order.guide.description ? parseMultilingualField(order.guide.description, language) : null,
          } : null,
        };
      }
    }

    if (!formattedOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.json({
      success: true,
      data: formattedOrder,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const language = getLanguageFromRequest(req);

    // ✅ Validate id parameter
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        tour: {
          include: {
            category: true,
          },
        },
        hotel: true,
        guide: {
          include: {
            guideCountry: true,
            guideCity: true,
          },
        },
        // Найм гида - полные данные с гидом, страной и городом
        guideHireRequest: {
          include: {
            guide: {
              include: {
                guideCountry: true,
                guideCity: true,
              },
            },
          },
        },
        // Трансфер - полные данные с водителем
        transferRequest: {
          include: {
            assignedDriver: true,
          },
        },
        // Собственный тур
        customTourOrder: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Cast to any for flexible property access
    const orderData = order as any;

    // Process multilingual fields correctly
    const formattedOrder = {
      ...orderData,
      tourists: orderData.tourists ? JSON.parse(orderData.tourists) : [],
      tour: orderData.tour ? {
        ...orderData.tour,
        title: parseMultilingualField(orderData.tour.title, language),
        description: parseMultilingualField(orderData.tour.description, language),
      } : null,
      hotel: orderData.hotel ? {
        ...orderData.hotel,
        name: parseMultilingualField(orderData.hotel.name, language),
        description: orderData.hotel.description ? parseMultilingualField(orderData.hotel.description, language) : null,
      } : null,
      guide: orderData.guide ? {
        ...orderData.guide,
        name: parseMultilingualField(orderData.guide.name, language),
        description: orderData.guide.description ? parseMultilingualField(orderData.guide.description, language) : null,
        country: orderData.guide.guideCountry?.name ? parseMultilingualField(orderData.guide.guideCountry.name, language) : null,
        city: orderData.guide.guideCity?.name ? parseMultilingualField(orderData.guide.guideCity.name, language) : null,
      } : null,
      // Найм гида - форматируем данные гида
      guideHireRequest: orderData.guideHireRequest ? {
        ...orderData.guideHireRequest,
        selectedDates: orderData.guideHireRequest.selectedDates 
          ? (typeof orderData.guideHireRequest.selectedDates === 'string' 
              ? JSON.parse(orderData.guideHireRequest.selectedDates) 
              : orderData.guideHireRequest.selectedDates)
          : [],
        guide: orderData.guideHireRequest.guide ? {
          ...orderData.guideHireRequest.guide,
          name: parseMultilingualField(orderData.guideHireRequest.guide.name, language),
          description: orderData.guideHireRequest.guide.description 
            ? parseMultilingualField(orderData.guideHireRequest.guide.description, language) 
            : null,
          country: orderData.guideHireRequest.guide.guideCountry?.name 
            ? parseMultilingualField(orderData.guideHireRequest.guide.guideCountry.name, language) 
            : null,
          city: orderData.guideHireRequest.guide.guideCity?.name 
            ? parseMultilingualField(orderData.guideHireRequest.guide.guideCity.name, language) 
            : null,
          languages: orderData.guideHireRequest.guide.languages 
            ? (typeof orderData.guideHireRequest.guide.languages === 'string' 
                ? JSON.parse(orderData.guideHireRequest.guide.languages) 
                : orderData.guideHireRequest.guide.languages)
            : [],
        } : null,
      } : null,
      // Трансфер - форматируем данные водителя
      transferRequest: orderData.transferRequest ? {
        ...orderData.transferRequest,
        driver: orderData.transferRequest.assignedDriver ? {
          id: orderData.transferRequest.assignedDriver.id,
          name: orderData.transferRequest.assignedDriver.name,
          phone: orderData.transferRequest.assignedDriver.phone,
          vehicleBrand: orderData.transferRequest.assignedDriver.vehicleBrand,
          vehicleInfo: orderData.transferRequest.assignedDriver.vehicleInfo,
          licensePlate: orderData.transferRequest.assignedDriver.licensePlate,
        } : null,
      } : null,
      // Собственный тур
      customTourOrder: orderData.customTourOrder ? {
        ...orderData.customTourOrder,
        selectedCountries: orderData.customTourOrder.selectedCountries 
          ? (typeof orderData.customTourOrder.selectedCountries === 'string' 
              ? JSON.parse(orderData.customTourOrder.selectedCountries) 
              : orderData.customTourOrder.selectedCountries)
          : [],
        components: orderData.customTourOrder.components 
          ? (typeof orderData.customTourOrder.components === 'string' 
              ? JSON.parse(orderData.customTourOrder.components) 
              : orderData.customTourOrder.components)
          : [],
      } : null,
    };

    return res.json({
      success: true,
      order: formattedOrder,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { status, paymentStatus, paymentOption, page = 1, limit = 20 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentOption) where.paymentOption = paymentOption;

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        tour: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
        hotel: {
          select: {
            id: true,
            name: true,
          },
        },
        guide: {
          select: {
            id: true,
            name: true,
          },
        },
        // Добавлено для правильного отображения направления в админ панели
        guideHireRequest: {
          include: {
            guide: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        transferRequest: {
          select: {
            id: true,
            pickupLocation: true,
            dropoffLocation: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    const language = getLanguageFromRequest(req);

    const formattedOrders = orders.map(order => ({
      ...order,
      tourists: order.tourists ? JSON.parse(order.tourists) : [],
      tour: order.tour ? {
        ...order.tour,
        title: parseMultilingualField(order.tour.title, language),
      } : null,
      hotel: order.hotel ? {
        ...order.hotel,
        name: parseMultilingualField(order.hotel.name, language),
      } : null,
      guide: order.guide ? {
        ...order.guide,
        name: parseMultilingualField(order.guide.name, language),
      } : null,
    }));

    const totalOrders = await prisma.order.count({ where });

    return res.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalOrders,
        totalPages: Math.ceil(totalOrders / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const updateOrderStatusById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, paymentMethod, receiptData } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (receiptData) updateData.receiptData = JSON.stringify(receiptData);

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        customer: true,
        tour: true,
      },
    });

    // Send email notification if order is confirmed
    if (status === 'confirmed') {
      // Email logic will be added here
    }

    return res.json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { status, paymentStatus, paymentMethod, receiptData } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (receiptData) updateData.receiptData = JSON.stringify(receiptData);

    const order = await prisma.order.update({
      where: { orderNumber },
      data: updateData,
      include: {
        customer: true,
        tour: true,
      },
    });

    return res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { reason } = req.body;

    const order = await prisma.order.update({
      where: { orderNumber },
      data: {
        status: 'cancelled',
        wishes: reason ? `${reason} (ОТМЕНЁН)` : 'ОТМЕНЁН',
      },
    });

    return res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
// Функция удаления заказа
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    // Проверяем существование заказа
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Удаляем заказ
    await prisma.order.delete({
      where: { id: orderId },
    });

    return res.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const downloadReceipt = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    
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
        guideHireRequest: {
          include: { guide: true }
        },
        transferRequest: true,
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    
    if (order.paymentStatus !== 'paid') {
      return res.status(403).json({
        success: false,
        message: 'Receipt available only for paid orders',
      });
    }
    
    let orderType = 'Услуга';
    let serviceName = 'Туристическая услуга';
    let serviceDetails = '';
    
    if (order.orderNumber.startsWith('GH-') && order.guideHireRequest?.guide) {
      orderType = 'Найм гида';
      const guideName = typeof order.guideHireRequest.guide.name === 'object' 
        ? (order.guideHireRequest.guide.name as any).ru || (order.guideHireRequest.guide.name as any).en || 'Гид'
        : String(order.guideHireRequest.guide.name || 'Гид');
      serviceName = guideName;
      serviceDetails = `Количество дней: ${order.guideHireRequest.numberOfDays || 1}`;
    } else if (order.orderNumber.startsWith('TR-') && order.transferRequest) {
      orderType = 'Трансфер';
      serviceName = `${order.transferRequest.pickupLocation || ''} → ${order.transferRequest.dropoffLocation || ''}`;
      serviceDetails = `Дата: ${order.transferRequest.pickupDate || 'Не указана'}`;
    } else if (order.orderNumber.startsWith('CT-')) {
      orderType = 'Собственный тур';
      serviceName = 'Индивидуальный тур';
    } else if (order.tour) {
      orderType = 'Тур';
      serviceName = typeof order.tour.title === 'object' 
        ? (order.tour.title as any).ru || (order.tour.title as any).en || 'Тур'
        : String(order.tour.title || 'Тур');
    }
    
    const paymentDate = order.updatedAt ? new Date(order.updatedAt).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU');
    
    const receiptHTML = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Чек - ${order.orderNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .receipt { max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px dashed #e5e5e5; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #3E3E3E; }
        .company { font-size: 12px; color: #666; margin-top: 5px; }
        .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; display: inline-block; margin-top: 15px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 8px; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .row:last-child { border-bottom: none; }
        .label { color: #666; }
        .value { font-weight: 600; color: #333; text-align: right; max-width: 60%; }
        .total { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px; }
        .total .row { border-bottom: none; }
        .total .label { font-size: 18px; font-weight: 600; }
        .total .value { font-size: 24px; color: #10b981; }
        .footer { text-align: center; margin-top: 25px; padding-top: 20px; border-top: 2px dashed #e5e5e5; }
        .footer p { font-size: 11px; color: #999; margin: 3px 0; }
        @media print {
            body { background: white; padding: 0; }
            .receipt { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <div class="logo">Bunyod-Tour</div>
            <div class="company">Туристическое агентство</div>
            <div class="success-badge">✓ Оплачено</div>
        </div>
        
        <div class="section">
            <div class="section-title">Информация о заказе</div>
            <div class="row">
                <span class="label">Номер заказа</span>
                <span class="value">${order.orderNumber}</span>
            </div>
            <div class="row">
                <span class="label">Дата оплаты</span>
                <span class="value">${paymentDate}</span>
            </div>
            <div class="row">
                <span class="label">Тип услуги</span>
                <span class="value">${orderType}</span>
            </div>
            <div class="row">
                <span class="label">Услуга</span>
                <span class="value">${serviceName}</span>
            </div>
            ${serviceDetails ? `<div class="row"><span class="label">Детали</span><span class="value">${serviceDetails}</span></div>` : ''}
        </div>
        
        <div class="section">
            <div class="section-title">Клиент</div>
            <div class="row">
                <span class="label">Имя</span>
                <span class="value">${order.customer?.fullName || 'Не указано'}</span>
            </div>
            <div class="row">
                <span class="label">Email</span>
                <span class="value">${order.customer?.email || 'Не указано'}</span>
            </div>
        </div>
        
        <div class="total">
            <div class="row">
                <span class="label">Итого</span>
                <span class="value">${order.totalAmount} TJS</span>
            </div>
        </div>
        
        <div class="footer">
            <p>📍 Душанбе, Таджикистан</p>
            <p>📞 +992 44 625 7575</p>
            <p>✉️ booking@bunyodtour.tj</p>
            <p>🌐 bunyodtour.tj</p>
            <p style="margin-top: 10px;">Спасибо за выбор Bunyod-Tour!</p>
        </div>
    </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${order.orderNumber}.html"`);
    return res.send(receiptHTML);
    
  } catch (error) {
    console.error('Error generating receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate receipt',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
