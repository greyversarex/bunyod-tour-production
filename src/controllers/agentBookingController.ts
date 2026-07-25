import { Request, Response } from 'express';
// ♻️ Единый Prisma-клиент (singleton), а не отдельный пул подключений.
import prisma from '../config/database';

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
 * Разбирает код ваучера вида BT-{orderId}{year} и возвращает orderId.
 * Формат bookingRef в email: BT-${order.id}${new Date().getFullYear()}
 * Год всегда 4 цифры (20xx), поэтому правые 4 символа после "BT-" = год, остальное = orderId.
 */
const parseVoucherCode = (code: string): { orderId: number; year: number } | null => {
  const upper = code.trim().toUpperCase();
  if (!upper.startsWith('BT-')) return null;
  const numeric = upper.slice(3); // убираем "BT-"
  if (numeric.length <= 4 || !/^\d+$/.test(numeric)) return null;
  const year = parseInt(numeric.slice(-4), 10);
  const orderId = parseInt(numeric.slice(0, -4), 10);
  if (isNaN(year) || isNaN(orderId) || orderId < 1 || year < 2020) return null;
  return { orderId, year };
};

/**
 * Поиск ваучера по коду (турагент)
 * GET /api/travel-agents/bookings/voucher-lookup/:code
 */
export const lookupVoucher = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    console.log('🔍 Поиск ваучера:', code);

    const parsed = parseVoucherCode(code);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат ваучера. Используйте формат из письма: BT-XXXXXX'
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: parsed.orderId },
      include: {
        tour: { select: { id: true, title: true, duration: true, durationType: true } }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Ваучер не найден. Проверьте код из письма клиента'
      });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Этот ваучер ещё не оплачен'
      });
    }

    if (!order.tourId || !order.tour) {
      return res.status(400).json({
        success: false,
        message: 'Ваучер относится не к туру'
      });
    }

    // Безопасные данные для агента (без личных данных клиента)
    let tourTitle: string;
    const rawTitle = order.tour.title;
    if (typeof rawTitle === 'string') {
      try {
        const parsed2 = JSON.parse(rawTitle);
        tourTitle = parsed2?.ru || parsed2?.en || rawTitle;
      } catch {
        tourTitle = rawTitle;
      }
    } else if (rawTitle && typeof rawTitle === 'object') {
      tourTitle = (rawTitle as any).ru || (rawTitle as any).en || JSON.stringify(rawTitle);
    } else {
      tourTitle = 'Тур';
    }

    let touristsCount = 1;
    try {
      const tourists = JSON.parse(order.tourists);
      if (Array.isArray(tourists)) touristsCount = tourists.length;
    } catch { /* ignore */ }

    console.log(`✅ Ваучер найден: Order #${order.id}, тур "${tourTitle}"`);

    return res.json({
      success: true,
      data: {
        voucherId: code.trim().toUpperCase(),
        orderId: order.id,
        tourId: order.tourId,
        tourName: tourTitle,
        tourDate: order.tourDate,
        touristsCount,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    console.error('❌ Error looking up voucher:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при поиске ваучера'
    });
  }
};

/**
 * Создать заявку на тур (турагент)
 * Принимает voucherId (код ваучера из письма клиента, напр. BT-52026)
 */
export const createBooking = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agent?.agentId;
    console.log('📝 Получена заявка от турагента:', agentId);
    console.log('📦 Данные формы:', req.body);
    
    const {
      voucherId,
      tourDate,
      numberOfTourists,
      clientName,
      clientEmail,
      clientPhone,
      specialRequests
    } = req.body;

    // Нормализация полей
    const trimmedVoucher = voucherId ? voucherId.trim().toUpperCase() : '';
    const parsedTouristsCount = numberOfTourists ? Number(numberOfTourists) : null;
    const trimmedName = clientName ? clientName.trim() : '';
    const trimmedEmail = clientEmail ? clientEmail.trim() : '';
    const trimmedPhone = clientPhone ? clientPhone.trim() : '';
    const trimmedDate = tourDate ? tourDate.trim() : '';

    // Валидация обязательных текстовых полей
    if (!trimmedName || !trimmedEmail || !trimmedPhone || !trimmedDate) {
      console.log('❌ Не хватает обязательных полей');
      return res.status(400).json({
        success: false,
        message: 'Заполните все обязательные поля'
      });
    }

    // Валидация ваучера
    if (!trimmedVoucher) {
      return res.status(400).json({
        success: false,
        message: 'Укажите ID Ваучера из письма клиента'
      });
    }

    const parsedVoucher = parseVoucherCode(trimmedVoucher);
    if (!parsedVoucher) {
      console.log('❌ Неверный формат ваучера:', voucherId);
      return res.status(400).json({
        success: false,
        message: 'Неверный формат ваучера. Используйте формат из письма: BT-XXXXXX'
      });
    }

    // Валидация количества туристов
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

    // Найти заказ по ваучеру
    const order = await prisma.order.findUnique({
      where: { id: parsedVoucher.orderId },
      include: {
        tour: true
      }
    });

    if (!order) {
      console.log('❌ Ваучер не найден:', trimmedVoucher);
      return res.status(404).json({
        success: false,
        message: 'Ваучер не найден. Проверьте код из письма клиента'
      });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Этот ваучер ещё не оплачен'
      });
    }

    if (!order.tourId || !order.tour) {
      return res.status(400).json({
        success: false,
        message: 'Ваучер относится не к туру'
      });
    }

    // Получить название тура
    let tourName: string;
    const rawTitle = order.tour.title;
    if (typeof rawTitle === 'string') {
      tourName = rawTitle;
    } else {
      tourName = JSON.stringify(rawTitle);
    }

    console.log('✅ Ваучер проверен, тур:', tourName);

    // Формируем данные клиента
    const touristData = {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone
    };

    // Генерация номера заявки
    const bookingNumber = await generateBookingNumber();
    console.log('🔢 Номер заявки:', bookingNumber);

    // Расчёт общей стоимости (по цене тура × кол-во туристов)
    const totalPrice = order.tour.price
      ? parseFloat(order.tour.price.toString()) * parsedTouristsCount
      : null;

    // Создание заявки
    const booking = await prisma.agentTourBooking.create({
      data: {
        agentId,
        bookingNumber,
        voucherId: trimmedVoucher,
        tourId: order.tourId,
        tourName,
        tourStartDate: parsedDate,
        tourEndDate: parsedDate,
        touristsCount: parsedTouristsCount,
        tourists: JSON.stringify([touristData]),
        totalPrice,
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
        voucherId: (booking as any).voucherId || null,
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
