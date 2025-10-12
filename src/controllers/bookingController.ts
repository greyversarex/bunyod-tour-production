import { Request, Response } from 'express';
import { emailService } from '../services/emailService';
import { parseMultilingualField, getLanguageFromRequest } from '../utils/multilingual';
import prisma from '../config/database';
import { PriceCalculatorModel } from '../models';

// Вспомогательная функция для получения цены проживания из компонентов тура
async function getAccommodationPriceFromTour(tourServices: string): Promise<number> {
  try {
    if (!tourServices) {
      return 0;
    }
    
    // Парсим услуги тура
    const services = JSON.parse(tourServices);
    
    // Ищем компонент проживания (accommodation) среди услуг тура
    const accommodationService = services.find((service: any) => {
      // Защита от null/undefined значений
      if (!service || !service.key) {
        return false;
      }
      
      // Приоритет: точное совпадение по ключу
      if (service.key === 'accommodation_std') {
        return true;
      }
      
      // Поиск по части ключа  
      if (service.key.includes('accommodation') || 
          service.key.includes('хостел') || 
          service.key.includes('гостиница')) {
        return true;
      }
      
      // Поиск по названию (с защитой от null)
      if (service.name && typeof service.name === 'string') {
        const nameLower = service.name.toLowerCase();
        if (nameLower.includes('хостел') ||
            nameLower.includes('гостиница') ||
            nameLower.includes('проживание')) {
          return true;
        }
      }
      
      return false;
    });
    
    if (accommodationService) {
      console.log(`🏨 Found accommodation in tour: ${accommodationService.name} = ${accommodationService.price} TJS`);
      return parseFloat(accommodationService.price) || 0;
    }
    
    console.log('⚠️ No accommodation component found in tour services');
    return 0;
  } catch (error) {
    console.error('Error getting accommodation price from tour:', error);
    return 0;
  }
}

/**
 * Обогащает массив services английскими названиями из таблицы PriceCalculatorComponent
 */
async function enrichServicesWithTranslations(servicesJson: string | null): Promise<any[]> {
  try {
    if (!servicesJson) {
      return [];
    }
    
    const services = JSON.parse(servicesJson);
    if (!Array.isArray(services) || services.length === 0) {
      return [];
    }
    
    // Получаем все компоненты из БД для сопоставления
    const components = await PriceCalculatorModel.findAll();
    
    // Обогащаем каждый сервис английским названием
    return services.map(service => {
      // Если уже есть nameEn, оставляем как есть
      if (service.nameEn) {
        return service;
      }
      
      // Ищем компонент по ключу или ID
      const component = components.find(c => 
        c.key === service.key || c.id === service.id
      );
      
      // Добавляем nameEn из БД или используем name как fallback
      return {
        ...service,
        nameEn: component?.nameEn || service.name
      };
    });
  } catch (error) {
    console.error('Error enriching services with translations:', error);
    return [];
  }
}

interface BookingStartData {
  tourId: number;
  hotelId?: number;
  tourDate: string;
  numberOfTourists: number;
  roomSelection?: any;
  mealSelection?: any;
}

interface BookingDetailsData {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  tourists: Array<{
    fullName: string;
    dateOfBirth?: string;
  }>;
  specialRequests?: string;
  roomSelection?: any;
  mealSelection?: any;
}

interface BookingPaymentData {
  paymentMethod: string;
}

export const bookingController = {
  /**
   * Рассчитать цену бронирования без сохранения (для live-обновлений)
   */
  async calculatePrice(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { hotelId, roomSelection, mealSelection } = req.body;

      // Найти бронирование
      const existingBooking = await prisma.booking.findUnique({
        where: { id: parseInt(id) },
        include: {
          tour: true,
          hotel: true
        }
      });

      if (!existingBooking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Рассчитать общую стоимость (копия логики из updateBooking)
      let totalPrice = 0;
      
      // Базовая стоимость тура
      const tourPrice = parseFloat(existingBooking.tour.price);
      const tourPriceType = existingBooking.tour.priceType;
      
      if (tourPriceType === 'за человека') {
        totalPrice += tourPrice * existingBooking.numberOfTourists;
      } else {
        totalPrice += tourPrice; // За группу
      }

      // ЛОГИКА ЗАМЕНЫ ПРОЖИВАНИЯ: Если выбран отель, вычесть компонент проживания тура и добавить отель
      if (roomSelection && hotelId) {
        const tourDuration = parseInt(existingBooking.tour.duration.replace(/\D/g, '')) || 1;
        
        // Получаем цену проживания из компонентов тура
        const tourAccommodationPrice = await getAccommodationPriceFromTour(existingBooking.tour.services || '');
        
        console.log(`💰 Calculate - Tour base price: ${totalPrice} TJS`);
        console.log(`🏨 Calculate - Tour accommodation component: ${tourAccommodationPrice} TJS`);
        
        // Вычитаем стоимость компонента проживания из тура
        // ВАЖНО: Компонент проживания уже включен в базовую цену за весь тур, не умножаем на дни!
        if (tourAccommodationPrice > 0) {
          if (tourPriceType === 'за человека') {
            // Для цены "за человека" вычитаем проживание на всех туристов
            const accommodationDeduction = tourAccommodationPrice * existingBooking.numberOfTourists;
            totalPrice -= accommodationDeduction;
            console.log(`➖ Calculate - Subtracted accommodation (per person): ${tourAccommodationPrice} x ${existingBooking.numberOfTourists} = ${accommodationDeduction} TJS`);
          } else {
            // Для цены "за группу" вычитаем проживание один раз
            const accommodationDeduction = tourAccommodationPrice;
            totalPrice -= accommodationDeduction;
            console.log(`➖ Calculate - Subtracted accommodation (per group): ${tourAccommodationPrice} TJS`);
          }
        }
        
        console.log(`💰 Calculate - Price after accommodation subtraction: ${totalPrice} TJS`);
        
        // Добавляем стоимость выбранных номеров отеля
        let hotelRoomsCost = 0;
        for (const [roomType, roomData] of Object.entries(roomSelection as any)) {
          const room = roomData as any;
          if (room.quantity > 0) {
            const roomCost = room.price * room.quantity * tourDuration;
            totalPrice += roomCost;
            hotelRoomsCost += roomCost;
            console.log(`➕ Calculate - Added hotel room: ${room.quantity} x ${room.price} x ${tourDuration} days = ${roomCost} TJS`);
          }
        }
        
        console.log(`💰 Calculate - Final price: ${totalPrice} TJS (hotel rooms: ${hotelRoomsCost} TJS)`);
      }

      // Добавить стоимость питания (если выбрано)
      if (mealSelection && hotelId) {
        const tourDuration = parseInt(existingBooking.tour.duration.replace(/\D/g, '')) || 1;
        
        for (const [mealType, mealData] of Object.entries(mealSelection as any)) {
          const meal = mealData as any;
          if (meal.selected) {
            totalPrice += meal.price * existingBooking.numberOfTourists * tourDuration;
          }
        }
      }

      return res.json({
        success: true,
        data: {
          totalPrice: totalPrice,
          breakdown: {
            tourPrice: parseFloat(existingBooking.tour.price),
            accommodationDeduction: await getAccommodationPriceFromTour(existingBooking.tour.services || ''),
            hotelRoomsCost: 0, // Можно вычислить отдельно если нужно
            mealsCost: 0
          }
        },
        message: 'Price calculated successfully'
      });

    } catch (error) {
      console.error('Error calculating booking price:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to calculate price'
      });
    }
  },

  /**
   * Создать черновик бронирования (Шаг 1)
   * POST /api/booking/start
   */
  async startBooking(req: Request, res: Response) {
    try {
      const { tourId, hotelId, tourDate, numberOfTourists }: BookingStartData = req.body;

      console.log('📋 startBooking получил данные:', { tourId, hotelId, tourDate, numberOfTourists });
      console.log('📋 Типы данных:', { 
        tourIdType: typeof tourId, 
        tourDateType: typeof tourDate, 
        numberOfTouristsType: typeof numberOfTourists 
      });

      // Валидация обязательных полей
      if (!tourId || !tourDate || !numberOfTourists) {
        console.log('❌ Валидация не прошла:', { tourId, tourDate, numberOfTourists });
        return res.status(400).json({
          success: false,
          message: 'Tour ID, tour date, and number of tourists are required'
        });
      }

      // Проверка существования тура
      const tour = await prisma.tour.findUnique({
        where: { id: parseInt(tourId.toString()) },
        include: {
          category: true,
          tourHotels: {
            include: {
              hotel: true
            }
          }
        }
      });

      if (!tour) {
        return res.status(404).json({
          success: false,
          message: 'Tour not found'
        });
      }

      // Проверка отеля, если указан
      let hotel = null;
      if (hotelId) {
        hotel = await prisma.hotel.findUnique({
          where: { id: parseInt(hotelId.toString()) }
        });

        if (!hotel) {
          return res.status(404).json({
            success: false,
            message: 'Hotel not found'
          });
        }
      }

      const { roomSelection, mealSelection } = req.body;

      // Рассчитать базовую стоимость тура
      let totalPrice = 0;
      const tourPrice = parseFloat(tour.price);
      const tourPriceType = tour.priceType;
      
      if (tourPriceType === 'за человека') {
        totalPrice += tourPrice * parseInt(numberOfTourists.toString());
      } else {
        totalPrice += tourPrice; // За группу
      }

      // ЛОГИКА ЗАМЕНЫ ПРОЖИВАНИЯ: Если выбран отель, вычесть компонент проживания тура и добавить отель
      if (roomSelection && hotel) {
        const tourDuration = parseInt(tour.duration.replace(/\D/g, '')) || 1;
        
        // Получаем цену проживания из компонентов тура
        const tourAccommodationPrice = await getAccommodationPriceFromTour(tour.services || '');
        
        console.log(`💰 Tour base price: ${totalPrice} TJS`);
        console.log(`🏨 Tour accommodation component: ${tourAccommodationPrice} TJS`);
        
        // Вычитаем стоимость компонента проживания из тура
        if (tourAccommodationPrice > 0) {
          if (tourPriceType === 'за человека') {
            // Для цены "за человека" вычитаем проживание на всех туристов
            totalPrice -= tourAccommodationPrice * parseInt(numberOfTourists.toString());
            console.log(`➖ Subtracted accommodation (per person): ${tourAccommodationPrice} x ${numberOfTourists} = ${tourAccommodationPrice * parseInt(numberOfTourists.toString())} TJS`);
          } else {
            // Для цены "за группу" вычитаем проживание один раз
            totalPrice -= tourAccommodationPrice;
            console.log(`➖ Subtracted accommodation (per group): ${tourAccommodationPrice} TJS`);
          }
        }
        
        console.log(`💰 Price after accommodation subtraction: ${totalPrice} TJS`);
        
        // Добавляем стоимость выбранных номеров отеля
        let hotelRoomsCost = 0;
        for (const [roomType, roomData] of Object.entries(roomSelection as any)) {
          const room = roomData as any;
          if (room.quantity > 0) {
            const roomCost = room.price * room.quantity * tourDuration;
            totalPrice += roomCost;
            hotelRoomsCost += roomCost;
            console.log(`➕ Added hotel room: ${room.quantity} x ${room.price} x ${tourDuration} days = ${roomCost} TJS`);
          }
        }
        
        console.log(`💰 Final price: ${totalPrice} TJS (hotel rooms: ${hotelRoomsCost} TJS)`);
      }

      // Добавить стоимость питания (если выбрано)
      if (mealSelection && hotel) {
        const tourDuration = parseInt(tour.duration.replace(/\D/g, '')) || 1;
        
        for (const [mealType, mealData] of Object.entries(mealSelection as any)) {
          const meal = mealData as any;
          if (meal.selected) {
            totalPrice += meal.price * parseInt(numberOfTourists.toString()) * tourDuration;
          }
        }
      }

      // Создать черновик бронирования
      const booking = await prisma.booking.create({
        data: {
          tourId: parseInt(tourId.toString()),
          hotelId: hotelId ? parseInt(hotelId.toString()) : null,
          tourDate,
          numberOfTourists: parseInt(numberOfTourists.toString()),
          tourists: JSON.stringify([]), // Пустой массив для начала
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          roomSelection: roomSelection ? JSON.stringify(roomSelection) : null,
          mealSelection: mealSelection ? JSON.stringify(mealSelection) : null,
          totalPrice,
          status: 'draft'
        }
      });

      const language = getLanguageFromRequest(req);

      return res.status(201).json({
        success: true,
        data: {
          bookingId: booking.id,
          tour: {
            ...tour,
            title: parseMultilingualField(tour.title, language),
            description: parseMultilingualField(tour.description, language)
          },
          hotel: hotel ? {
            ...hotel,
            name: parseMultilingualField(hotel.name, language),
            description: hotel.description ? parseMultilingualField(hotel.description, language) : null
          } : null
        },
        message: 'Booking draft created successfully'
      });

    } catch (error) {
      console.error('Error creating booking draft:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create booking draft',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },


  /**
   * Обновить детали бронирования (Шаг 2)
   * PUT /api/booking/:id/details
   */
  async updateBookingDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { 
        contactName, 
        contactPhone, 
        contactEmail, 
        tourists, 
        specialRequests,
        roomSelection,
        mealSelection 
      }: BookingDetailsData = req.body;

      // Валидация обязательных полей
      if (!contactName || !contactPhone || !contactEmail || !tourists || tourists.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Contact details and at least one tourist are required'
        });
      }

      // Найти бронирование
      const existingBooking = await prisma.booking.findUnique({
        where: { id: parseInt(id) },
        include: {
          tour: true,
          hotel: true
        }
      });

      if (!existingBooking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Рассчитать общую стоимость
      let totalPrice = 0;
      
      // Базовая стоимость тура
      const tourPrice = parseFloat(existingBooking.tour.price);
      const tourPriceType = existingBooking.tour.priceType;
      
      if (tourPriceType === 'за человека') {
        totalPrice += tourPrice * existingBooking.numberOfTourists;
      } else {
        totalPrice += tourPrice; // За группу
      }

      // НОВАЯ ЛОГИКА: Если выбран отель, вычесть хостел и добавить отель
      if (roomSelection && existingBooking.hotel) {
        const tourDuration = parseInt(existingBooking.tour.duration.replace(/\D/g, '')) || 1;
        
        // Получаем цену проживания из компонентов тура
        const tourAccommodationPrice = await getAccommodationPriceFromTour(existingBooking.tour.services || '');
        
        console.log(`💰 Update - Tour base price: ${totalPrice} TJS`);
        console.log(`🏨 Update - Tour accommodation component: ${tourAccommodationPrice} TJS`);
        
        // Вычитаем стоимость компонента проживания из тура
        // ВАЖНО: Компонент проживания уже включен в базовую цену за весь тур, не умножаем на дни!
        if (tourAccommodationPrice > 0) {
          if (tourPriceType === 'за человека') {
            // Для цены "за человека" вычитаем проживание на всех туристов
            const accommodationDeduction = tourAccommodationPrice * existingBooking.numberOfTourists;
            totalPrice -= accommodationDeduction;
            console.log(`➖ Update - Subtracted accommodation (per person): ${tourAccommodationPrice} x ${existingBooking.numberOfTourists} = ${accommodationDeduction} TJS`);
          } else {
            // Для цены "за группу" вычитаем проживание один раз
            const accommodationDeduction = tourAccommodationPrice;
            totalPrice -= accommodationDeduction;
            console.log(`➖ Update - Subtracted accommodation (per group): ${tourAccommodationPrice} TJS`);
          }
        }
        
        console.log(`💰 Update - Price after accommodation subtraction: ${totalPrice} TJS`);
        
        // Добавляем стоимость выбранных номеров отеля
        let hotelRoomsCost = 0;
        for (const [roomType, roomData] of Object.entries(roomSelection as any)) {
          const room = roomData as any;
          if (room.quantity > 0) {
            const roomCost = room.price * room.quantity * tourDuration;
            totalPrice += roomCost;
            hotelRoomsCost += roomCost;
            console.log(`➕ Update - Added hotel room: ${room.quantity} x ${room.price} x ${tourDuration} days = ${roomCost} TJS`);
          }
        }
        
        console.log(`💰 Update - Final price: ${totalPrice} TJS (hotel rooms: ${hotelRoomsCost} TJS)`);
      }

      // Добавить стоимость питания (если выбрано)
      if (mealSelection && existingBooking.hotel) {
        const tourDuration = parseInt(existingBooking.tour.duration.replace(/\D/g, '')) || 1;
        
        for (const [mealType, mealData] of Object.entries(mealSelection as any)) {
          const meal = mealData as any;
          if (meal.selected) {
            totalPrice += meal.price * existingBooking.numberOfTourists * tourDuration;
          }
        }
      }

      // Обновить бронирование
      const updatedBooking = await prisma.booking.update({
        where: { id: parseInt(id) },
        data: {
          contactName,
          contactPhone,
          contactEmail,
          tourists: JSON.stringify(tourists),
          specialRequests,
          roomSelection: roomSelection ? JSON.stringify(roomSelection) : null,
          mealSelection: mealSelection ? JSON.stringify(mealSelection) : null,
          totalPrice,
          status: 'pending' // Переводим в состояние ожидания оплаты
        }
      });

      return res.json({
        success: true,
        data: {
          ...updatedBooking,
          totalPrice: totalPrice // 🎯 Отправляем рассчитанную цену на фронтенд
        },
        message: 'Booking details updated successfully'
      });

    } catch (error) {
      console.error('Error updating booking details:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update booking details',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  /**
   * Создать заказ из бронирования для оплаты (Шаг 3)
   * POST /api/booking/:id/create-order
   */
  async createOrderFromBooking(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Найти бронирование с полными данными
      const booking = await prisma.booking.findUnique({
        where: { id: parseInt(id) },
        include: {
          tour: {
            include: {
              category: true
            }
          },
          hotel: true
        }
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (!booking.contactEmail || !booking.contactName) {
        return res.status(400).json({
          success: false,
          message: 'Contact information is required'
        });
      }

      // Создать или найти клиента
      let customer = await prisma.customer.findUnique({
        where: { email: booking.contactEmail }
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            fullName: booking.contactName,
            email: booking.contactEmail,
            phone: booking.contactPhone || ''
          }
        });
      }

      // Генерировать номер заказа
      const generateOrderNumber = (): string => {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `BT-${timestamp.slice(-6)}${random}`;
      };

      const orderNumber = generateOrderNumber();

      // Создать заказ с правильной суммой из бронирования
      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          tourId: booking.tourId,
          hotelId: booking.hotelId,
          guideId: null, // Может быть добавлено позже
          tourDate: booking.tourDate,
          tourists: booking.tourists,
          wishes: booking.specialRequests || '',
          totalAmount: booking.totalPrice,
          status: 'pending',
          paymentStatus: 'unpaid'
        },
        include: {
          customer: true,
          tour: {
            include: {
              category: true
            }
          },
          hotel: true
        }
      });

      // Обновить статус бронирования
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'order_created'
        }
      });

      return res.json({
        success: true,
        data: {
          order: order,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount
        },
        message: 'Order created successfully from booking'
      });

    } catch (error) {
      console.error('Error creating order from booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create order from booking',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  /**
   * Процесс оплаты (Шаг 3 - mock)
   * PUT /api/booking/:id/pay
   */
  async processPayment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { paymentMethod, totalAmount }: BookingPaymentData & { totalAmount?: number } = req.body;

      console.log('💳 Processing payment for booking ID:', id);
      console.log('💰 Payment data:', { paymentMethod, totalAmount });

      // Найти бронирование с связанными данными
      const booking = await prisma.booking.findUnique({
        where: { id: parseInt(id) },
        include: {
          tour: true,
          hotel: true
        }
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Mock обработка оплаты - имитируем успех или ошибку
      const isSuccess = Math.random() > 0.1; // 90% успеха

      if (isSuccess) {
        // Успешная оплата
        const updatedBooking = await prisma.booking.update({
          where: { id: parseInt(id) },
          data: {
            status: 'paid',
            paymentMethod,
            // Обновляем totalPrice если передан в запросе
            totalPrice: totalAmount || booking.totalPrice
          }
        });

        try {
          // Отправить email уведомления
          if (booking.contactEmail && booking.tour) {
            // Create customer object for email service
            const customerData = {
              id: 0, // Mock ID for email service
              fullName: booking.contactName || 'Клиент',
              email: booking.contactEmail,
              phone: booking.contactPhone || null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            // Create order object with correct structure
            const orderData = {
              ...updatedBooking,
              orderNumber: `BT-${updatedBooking.id}`,
              totalAmount: updatedBooking.totalPrice,
              tourists: updatedBooking.tourists || '[]'
            };
            
            await emailService.sendBookingConfirmation(orderData, customerData, booking.tour);
            console.log('✅ Booking confirmation email sent successfully');
          }
        } catch (emailError) {
          console.error('⚠️ Failed to send email notifications:', emailError);
          // Не прерываем основной процесс из-за ошибки email
        }

        return res.json({
          success: true,
          data: updatedBooking,
          message: 'Payment processed successfully and confirmation emails sent'
        });
      } else {
        // Ошибка оплаты
        await prisma.booking.update({
          where: { id: parseInt(id) },
          data: {
            status: 'error'
          }
        });

        return res.status(400).json({
          success: false,
          message: 'Payment failed. Please try again.'
        });
      }

    } catch (error) {
      console.error('Error processing payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to process payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  /**
   * Получить детали бронирования
   * GET /api/booking/:id
   */
  async getBooking(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { id: parseInt(id) },
        include: {
          tour: {
            include: {
              category: true
            }
          },
          hotel: true
        }
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Парсим JSON поля для ответа
      const language = getLanguageFromRequest(req);
      
      // Обогащаем services английскими названиями из БД
      const enrichedServices = await enrichServicesWithTranslations(booking.tour.services);
      
      const formattedBooking = {
        ...booking,
        tourists: booking.tourists ? JSON.parse(booking.tourists) : [],
        roomSelection: booking.roomSelection ? JSON.parse(booking.roomSelection) : null,
        mealSelection: booking.mealSelection ? JSON.parse(booking.mealSelection) : null,
        tour: {
          ...booking.tour,
          title: parseMultilingualField(booking.tour.title, language),
          description: parseMultilingualField(booking.tour.description, language),
          services: enrichedServices, // Используем обогащенные services
          category: {
            ...booking.tour.category,
            name: booking.tour.category.name // Category.name is String, not JSON
          }
        },
        hotel: booking.hotel ? {
          ...booking.hotel,
          name: parseMultilingualField(booking.hotel.name, language),
          description: booking.hotel.description ? parseMultilingualField(booking.hotel.description, language) : null,
          amenities: booking.hotel.amenities ? JSON.parse(booking.hotel.amenities) : [],
          roomTypes: booking.hotel.roomTypes,
          mealTypes: booking.hotel.mealTypes
        } : null
      };

      return res.json({
        success: true,
        data: formattedBooking
      });

    } catch (error) {
      console.error('Error fetching booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch booking',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  /**
   * Обновить выбор отеля и номеров (Шаг 1)
   * PUT /api/booking/:id/update
   */
  async updateBookingStep1(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { 
        hotelId, 
        roomSelection, 
        mealSelection,
        totalPrice,
        status = 'draft'
      } = req.body;

      console.log('📝 Updating booking step 1:', { id, hotelId, roomSelection, mealSelection, totalPrice });

      // Validate booking exists
      const existingBooking = await prisma.booking.findUnique({
        where: { id: parseInt(id) }
      });

      if (!existingBooking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Update booking with hotel and room selection
      const updatedBooking = await prisma.booking.update({
        where: { id: parseInt(id) },
        data: {
          hotelId: hotelId ? parseInt(hotelId) : null,
          roomSelection: roomSelection ? JSON.stringify(roomSelection) : null,
          mealSelection: mealSelection ? JSON.stringify(mealSelection) : null,
          totalPrice: totalPrice ? parseFloat(totalPrice) : existingBooking.totalPrice,
          status,
          updatedAt: new Date()
        },
        include: {
          tour: true,
          hotel: true
        }
      });

      console.log('✅ Booking updated successfully:', updatedBooking.id);

      return res.json({
        success: true,
        data: updatedBooking
      });

    } catch (error) {
      console.error('Error updating booking step 1:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update booking',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  /**
   * Получить отели для тура
   * GET /api/booking/tour/:tourId/hotels
   */
  async getTourHotels(req: Request, res: Response) {
    try {
      const { tourId } = req.params;
      const language = getLanguageFromRequest(req);

      const tourHotels = await prisma.tourHotel.findMany({
        where: { tourId: parseInt(tourId) },
        include: {
          hotel: true
        }
      });

      const hotels = tourHotels.map((th: any) => ({
        ...th.hotel,
        name: parseMultilingualField(th.hotel.name, language),
        description: th.hotel.description ? parseMultilingualField(th.hotel.description, language) : null,
        amenities: th.hotel.amenities ? JSON.parse(th.hotel.amenities) : [],
        images: th.hotel.images ? JSON.parse(th.hotel.images) : []
      }));

      return res.json({
        success: true,
        data: hotels
      });

    } catch (error) {
      console.error('Error fetching tour hotels:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch tour hotels',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

