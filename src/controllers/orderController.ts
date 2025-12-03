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
    const { status, paymentStatus, page = 1, limit = 20 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

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
