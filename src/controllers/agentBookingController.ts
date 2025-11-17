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

    // Валидация
    if (!tourName || !tourStartDate || !tourEndDate || !touristsCount || !tourists) {
      return res.status(400).json({
        success: false,
        message: 'Заполните все обязательные поля'
      });
    }

    if (touristsCount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Количество туристов должно быть больше 0'
      });
    }

    // Парсинг списка туристов если это строка
    let touristsData = tourists;
    if (typeof tourists === 'string') {
      try {
        touristsData = JSON.parse(tourists);
      } catch (e) {
        touristsData = tourists;
      }
    }

    // Генерация номера заявки
    const bookingNumber = await generateBookingNumber();

    // Создание заявки
    const booking = await prisma.agentTourBooking.create({
      data: {
        agentId,
        bookingNumber,
        tourName,
        tourStartDate: new Date(tourStartDate),
        tourEndDate: new Date(tourEndDate),
        touristsCount,
        tourists: typeof touristsData === 'string' ? touristsData : JSON.stringify(touristsData),
        totalPrice: totalPrice ? parseFloat(totalPrice) : null,
        agentCommission: agentCommission ? parseFloat(agentCommission) : null,
        notes
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Заявка успешно создана',
      data: booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
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

    // Парсинг JSON данных туристов
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
