import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Генерация номера заявки (ID00000001, ID00000002, ...)
 */
const generateBookingNumber = async (): Promise<string> => {
  const latestBooking = await prisma.agentTourBooking.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { bookingNumber: true }
  });

  if (!latestBooking) {
    return 'ID00000001';
  }

  const lastNumber = parseInt(latestBooking.bookingNumber.replace('ID', ''));
  const nextNumber = lastNumber + 1;
  return `ID${nextNumber.toString().padStart(8, '0')}`;
};

/**
 * Создать заявку на тур (турагент)
 */
export const createBooking = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agent?.agentId;
    console.log('📝 Получена заявка от турагента:', agentId);
    console.log('📦 Данные формы:', req.body);
    
    const {
      tourId,
      tourDate,
      numberOfTourists,
      clientName,
      clientEmail,
      clientPhone,
      specialRequests
    } = req.body;

    // Парсинг и нормализация
    const parsedTourId = tourId ? Number(tourId) : null;
    const parsedTouristsCount = numberOfTourists ? Number(numberOfTourists) : null;
    const trimmedName = clientName ? clientName.trim() : '';
    const trimmedEmail = clientEmail ? clientEmail.trim() : '';
    const trimmedPhone = clientPhone ? clientPhone.trim() : '';
    const trimmedDate = tourDate ? tourDate.trim() : '';

    // Валидация обязательных полей
    if (!trimmedName || !trimmedEmail || !trimmedPhone || !trimmedDate) {
      console.log('❌ Не хватает обязательных полей');
      return res.status(400).json({
        success: false,
        message: 'Заполните все обязательные поля'
      });
    }

    // Валидация числовых полей
    if (!parsedTourId || !Number.isInteger(parsedTourId) || parsedTourId < 1) {
      console.log('❌ Неверный ID тура:', tourId);
      return res.status(400).json({
        success: false,
        message: 'Неверный ID тура'
      });
    }

    if (!parsedTouristsCount || !Number.isInteger(parsedTouristsCount) || parsedTouristsCount < 1) {
      console.log('❌ Неверное количество туристов:', numberOfTourists);
      return res.status(400).json({
        success: false,
        message: 'Количество туристов должно быть больше 0'
      });
    }

    // Валидация даты
    const parsedDate = new Date(trimmedDate);
    if (Number.isNaN(parsedDate.getTime())) {
      console.log('❌ Неверная дата:', trimmedDate);
      return res.status(400).json({
        success: false,
        message: 'Неверная дата. Используйте формат ГГГГ-ММ-ДД'
      });
    }

    // Получить данные тура из БД
    const tour = await prisma.tour.findUnique({
      where: { id: parsedTourId }
    });

    if (!tour) {
      console.log('❌ Тур не найден:', tourId);
      return res.status(404).json({
        success: false,
        message: 'Тур не найден'
      });
    }

    console.log('✅ Тур найден:', tour.title);

    // Формируем данные туриста в JSON
    const touristData = {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone
    };

    // Генерация номера заявки
    const bookingNumber = await generateBookingNumber();
    console.log('🔢 Номер заявки:', bookingNumber);

    // Создание заявки
    const booking = await prisma.agentTourBooking.create({
      data: {
        agentId,
        bookingNumber,
        tourId: parsedTourId,
        tourName: typeof tour.title === 'string' ? tour.title : JSON.stringify(tour.title),
        tourStartDate: parsedDate,
        tourEndDate: parsedDate,
        touristsCount: parsedTouristsCount,
        tourists: JSON.stringify([touristData]),
        totalPrice: tour.price ? parseFloat(tour.price.toString()) * parsedTouristsCount : null,
        agentCommission: null,
        notes: specialRequests ? specialRequests.trim() : null
      } as any
    });

    console.log('✅ Заявка создана:', booking.bookingNumber);

    return res.status(201).json({
      success: true,
      message: 'Заявка успешно создана',
      booking: {
        bookingId: booking.bookingNumber,
        tourName: booking.tourName,
        tourDate: booking.tourStartDate,
        status: booking.status
      }
    });
  } catch (error) {
    console.error('❌ Error creating booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при создании заявки'
    });
  }
};

/**
 * Получить все заявки текущего турагента
 */
export const getMyBookings = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agent?.agentId;
    const { status } = req.query;

    const where: any = { agentId };
    if (status) {
      where.status = status;
    }

    const bookings = await prisma.agentTourBooking.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Трансформируем данные под формат frontend
    const transformedBookings = bookings.map(booking => {
      // Парсим tourName если это JSON, иначе создаем структуру {ru, en}
      let tourTitle: any = { ru: booking.tourName, en: null };
      try {
        const parsed = JSON.parse(booking.tourName);
        if (typeof parsed === 'object' && parsed !== null) {
          tourTitle = parsed;
        }
      } catch (e) {
        // Оставляем структуру по умолчанию {ru: tourName, en: null}
      }

      // Парсим данные туристов
      let tourists = null;
      if (booking.tourists) {
        try {
          tourists = JSON.parse(booking.tourists);
        } catch (e) {
          tourists = booking.tourists;
        }
      }

      return {
        bookingId: booking.bookingNumber,
        tourId: (booking as any).tourId,
        tourDate: booking.tourStartDate,
        numberOfTourists: booking.touristsCount,
        status: booking.status,
        createdAt: booking.createdAt,
        tour: {
          title: tourTitle
        },
        tourists,
        totalPrice: booking.totalPrice,
        notes: booking.notes
      };
    });

    return res.json({
      success: true,
      bookings: transformedBookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении заявок'
    });
  }
};

/**
 * Получить заявку по ID (турагент)
 */
export const getBookingById = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agent?.agentId;
    const { id } = req.params;

    const booking = await prisma.agentTourBooking.findFirst({
      where: {
        id: parseInt(id),
        agentId
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
    }

    return res.json({
      success: true,
      data: {
        ...booking,
        tourists: booking.tourists ? (() => {
          try {
            return JSON.parse(booking.tourists);
          } catch (e) {
            return booking.tourists;
          }
        })() : null
      }
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении заявки'
    });
  }
};

/**
 * Получить все заявки от турагентов (админ)
 */
export const getAllBookings = async (req: Request, res: Response) => {
  try {
    const { status, agentId } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (agentId) {
      where.agentId = parseInt(agentId as string);
    }

    const bookings = await prisma.agentTourBooking.findMany({
      where,
      include: {
        agent: {
          select: {
            agentId: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const bookingsWithTourists = bookings.map(booking => ({
      ...booking,
      tourists: booking.tourists ? (() => {
        try {
          return JSON.parse(booking.tourists);
        } catch (e) {
          return booking.tourists;
        }
      })() : null
    }));

    return res.json({
      success: true,
      data: bookingsWithTourists
    });
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении заявок'
    });
  }
};

/**
 * Обновить статус заявки (админ)
 */
export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный статус'
      });
    }

    const updateData: any = { status };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const booking = await prisma.agentTourBooking.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return res.json({
      success: true,
      message: 'Статус заявки обновлен',
      data: booking
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении статуса заявки'
    });
  }
};

/**
 * Обновить заявку (турагент)
 */
export const updateBooking = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agent?.agentId;
    const { id } = req.params;
    const {
      tourName,
      tourStartDate,
      tourEndDate,
      touristsCount,
      tourists,
      totalPrice,
      agentCommission,
      notes
    } = req.body;

    // Проверка принадлежности заявки турагенту
    const existingBooking = await prisma.agentTourBooking.findFirst({
      where: {
        id: parseInt(id),
        agentId
      }
    });

    if (!existingBooking) {
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
    }

    // Нельзя редактировать завершенные или отмененные заявки
    if (['completed', 'cancelled'].includes(existingBooking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Нельзя редактировать завершенную или отмененную заявку'
      });
    }

    // Парсинг списка туристов если это строка
    let touristsData = tourists;
    if (tourists && typeof tourists === 'string') {
      try {
        touristsData = JSON.parse(tourists);
      } catch (e) {
        touristsData = tourists;
      }
    }

    const updateData: any = {};
    if (tourName) updateData.tourName = tourName;
    if (tourStartDate) updateData.tourStartDate = new Date(tourStartDate);
    if (tourEndDate) updateData.tourEndDate = new Date(tourEndDate);
    if (touristsCount) updateData.touristsCount = touristsCount;
    if (tourists) updateData.tourists = typeof touristsData === 'string' ? touristsData : JSON.stringify(touristsData);
    if (totalPrice !== undefined) updateData.totalPrice = totalPrice ? parseFloat(totalPrice) : null;
    if (agentCommission !== undefined) updateData.agentCommission = agentCommission ? parseFloat(agentCommission) : null;
    if (notes !== undefined) updateData.notes = notes;

    const booking = await prisma.agentTourBooking.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return res.json({
      success: true,
      message: 'Заявка обновлена',
      data: booking
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении заявки'
    });
  }
};

/**
 * Удалить заявку (турагент - только если pending)
 */
export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agent?.agentId;
    const { id } = req.params;

    const booking = await prisma.agentTourBooking.findFirst({
      where: {
        id: parseInt(id),
        agentId
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Можно удалять только заявки со статусом "В ожидании"'
      });
    }

    await prisma.agentTourBooking.delete({
      where: { id: parseInt(id) }
    });

    return res.json({
      success: true,
      message: 'Заявка удалена'
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при удалении заявки'
    });
  }
};

/**
 * Получить статистику заявок турагента
 */
export const getBookingStats = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agent?.agentId;

    const totalBookings = await prisma.agentTourBooking.count({
      where: { agentId }
    });

    const pendingBookings = await prisma.agentTourBooking.count({
      where: { agentId, status: 'pending' }
    });

    const confirmedBookings = await prisma.agentTourBooking.count({
      where: { agentId, status: 'confirmed' }
    });

    const completedBookings = await prisma.agentTourBooking.count({
      where: { agentId, status: 'completed' }
    });

    const cancelledBookings = await prisma.agentTourBooking.count({
      where: { agentId, status: 'cancelled' }
    });

    // Общая сумма комиссий
    const commissionSum = await prisma.agentTourBooking.aggregate({
      where: {
        agentId,
        status: 'completed',
        agentCommission: { not: null }
      },
      _sum: {
        agentCommission: true
      }
    });

    return res.json({
      success: true,
      data: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        totalCommission: commissionSum._sum.agentCommission || 0
      }
    });
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики'
    });
  }
};
