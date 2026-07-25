import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendEmail } from '../services/emailService';
import { isGuideDateSelectionEnabled } from '../utils/dateAvailabilitySettings';

// Утилитарная функция для конвертации валют
const convertCurrency = async (amount: number, fromCurrency: string, toCurrency: string): Promise<{ convertedAmount: number; rate: number; symbol: string } | null> => {
  try {
    if (fromCurrency === toCurrency) {
      const currency = await prisma.exchangeRate.findFirst({
        where: { currency: toCurrency, isActive: true }
      });
      return {
        convertedAmount: amount,
        rate: 1,
        symbol: currency?.symbol || toCurrency
      };
    }

    // Получаем курсы валют
    const [fromRate, toRate] = await Promise.all([
      prisma.exchangeRate.findFirst({ 
        where: { currency: fromCurrency, isActive: true } 
      }),
      prisma.exchangeRate.findFirst({ 
        where: { currency: toCurrency, isActive: true } 
      })
    ]);

    if (!fromRate || !toRate) {
      return null;
    }

    // Сначала конвертируем в TJS (базовую валюту), затем в целевую
    // rate = сколько TJS за 1 единицу валюты (например, USD rate = 10.6)
    const tjsAmount = fromCurrency === 'TJS' ? amount : amount * fromRate.rate;
    const convertedAmount = toCurrency === 'TJS' ? tjsAmount : tjsAmount / toRate.rate;

    return {
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      rate: toRate.rate,
      symbol: toRate.symbol
    };
  } catch (error) {
    console.error('Error in currency conversion:', error);
    return null;
  }
};

// Типы для системы найма
interface GuideAvailabilityData {
  availableDates: string[];
  pricePerDay: number;
  currency: string;
  isHireable: boolean;
}

interface GuideHireRequestData {
  guideId: number;
  touristName: string;
  touristEmail?: string;
  touristPhone?: string;
  selectedDates: string[];
  comments?: string;
}

interface DirectGuideHireData {
  guideId: number;
  touristName: string;
  touristEmail: string;
  touristPhone?: string;
  selectedDates: string[]; // Format: ["2025-11-23", "2025-11-24"]
  comments?: string;
  // currency удален - вычисляется только на сервере из guide.currency
}

// Утилита для парсинга JSON
const parseJsonField = (value: any): any => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

// Получить доступность и цены тургида
export const getGuideAvailability = async (req: Request, res: Response) => {
  try {
    const { guideId } = req.params;
    
    const guide = await prisma.guide.findUnique({
      where: { id: parseInt(guideId) },
      select: {
        id: true,
        name: true,
        photo: true,
        pricePerDay: true,
        currency: true,
        availableDates: true,
        isHireable: true,
        isActive: true
      }
    });

    if (!guide) {
      res.status(404).json({
        success: false,
        message: 'Тургид не найден'
      });
      return;
    }

    if (!guide.isActive || !guide.isHireable) {
      res.status(400).json({
        success: false,
        message: 'Тургид недоступен для найма'
      });
      return;
    }

    const availableDates = parseJsonField(guide.availableDates) || [];
    const selectionEnabled = await isGuideDateSelectionEnabled();
    
    console.log(`📅 Guide ${guideId} availability request:`);
    console.log(`   - Raw availableDates from DB:`, guide.availableDates);
    console.log(`   - Parsed availableDates:`, availableDates);
    console.log(`   - pricePerDay: ${guide.pricePerDay}, isHireable: ${guide.isHireable}`);
    console.log(`   - date selection enabled: ${selectionEnabled}`);

    res.json({
      success: true,
      data: {
        id: guide.id,
        name: guide.name,
        photo: guide.photo,
        pricePerDay: guide.pricePerDay || 0,
        currency: guide.currency || 'TJS',
        availableDates: availableDates,
        isHireable: guide.isHireable,
        // Когда выбор дат выключен — фронтенд делает все будущие даты доступными
        selectionEnabled: selectionEnabled
      }
    });
  } catch (error) {
    console.error('Error getting guide availability:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении данных о доступности тургида'
    });
  }
};

// Обновить доступность и цены тургида (для личного кабинета гида)
export const updateGuideAvailability = async (req: Request, res: Response) => {
  try {
    const { guideId } = req.params;
    const { availableDates, pricePerDay, currency, isHireable }: GuideAvailabilityData = req.body;
    const authenticatedGuideId = (req as any).user?.id;

    // Проверка безопасности: гид может обновлять только свою доступность
    if (authenticatedGuideId && parseInt(guideId) !== authenticatedGuideId) {
      res.status(403).json({
        success: false,
        message: 'Вы можете обновлять только свою доступность'
      });
      return;
    }

    // Проверяем что тургид существует
    const existingGuide = await prisma.guide.findUnique({
      where: { id: parseInt(guideId) }
    });

    if (!existingGuide) {
      res.status(404).json({
        success: false,
        message: 'Тургид не найден'
      });
      return;
    }

    // Валидация данных
    if (pricePerDay !== undefined && pricePerDay < 0) {
      res.status(400).json({
        success: false,
        message: 'Цена за день не может быть отрицательной'
      });
      return;
    }

    // Валидация дат
    if (availableDates && availableDates.some(date => !date.match(/^\d{4}-\d{2}-\d{2}$/))) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат даты. Используйте YYYY-MM-DD'
      });
      return;
    }

    // Валидация валюты
    const allowedCurrencies = ['TJS', 'USD', 'EUR', 'RUB', 'CNY'];
    if (currency && !allowedCurrencies.includes(currency)) {
      res.status(400).json({
        success: false,
        message: 'Неподдерживаемая валюта'
      });
      return;
    }

    // Подготавливаем данные для обновления (только переданные поля)
    const updateData: any = {};
    if (availableDates !== undefined) {
      updateData.availableDates = JSON.stringify(availableDates);
    }
    if (pricePerDay !== undefined) {
      updateData.pricePerDay = pricePerDay;
    }
    if (currency !== undefined) {
      updateData.currency = currency;
    }
    if (isHireable !== undefined) {
      updateData.isHireable = isHireable;
    }

    const updatedGuide = await prisma.guide.update({
      where: { id: parseInt(guideId) },
      data: updateData,
      select: {
        id: true,
        name: true,
        pricePerDay: true,
        currency: true,
        availableDates: true,
        isHireable: true
      }
    });

    res.json({
      success: true,
      message: 'Настройки доступности обновлены',
      data: {
        ...updatedGuide,
        availableDates: parseJsonField(updatedGuide.availableDates)
      }
    });
  } catch (error) {
    console.error('Error updating guide availability:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении настроек доступности'
    });
  }
};

// Создать заявку на найм тургида
export const createGuideHireRequest = async (req: Request, res: Response) => {
  try {
    const { 
      guideId, 
      touristName, 
      touristEmail, 
      touristPhone, 
      selectedDates, 
      comments 
    }: GuideHireRequestData = req.body;

    // Валидация обязательных полей
    if (!guideId || !touristName || !selectedDates || selectedDates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Обязательные поля: ID тургида, имя туриста и выбранные даты'
      });
      return;
    }

    // Проверяем что тургид существует и доступен для найма
    const guide = await prisma.guide.findUnique({
      where: { id: guideId },
      select: {
        id: true,
        name: true,
        pricePerDay: true,
        currency: true,
        availableDates: true,
        isHireable: true,
        isActive: true,
        contact: true
      }
    });

    if (!guide) {
      res.status(404).json({
        success: false,
        message: 'Тургид не найден'
      });
      return;
    }

    if (!guide.isActive || !guide.isHireable) {
      res.status(400).json({
        success: false,
        message: 'Тургид недоступен для найма'
      });
      return;
    }

    if (!guide.pricePerDay) {
      res.status(400).json({
        success: false,
        message: 'У тургида не установлена цена за день'
      });
      return;
    }

    // Прошедшие даты недоступны ВСЕГДА (и при включённом, и при выключенном выборе)
    const todayStr = new Date().toISOString().split('T')[0];
    const pastDates = selectedDates.filter(date => date < todayStr);
    if (pastDates.length > 0) {
      res.status(400).json({
        success: false,
        message: `Нельзя выбрать прошедшие даты: ${pastDates.join(', ')}`
      });
      return;
    }

    // Проверяем доступность выбранных дат ТОЛЬКО когда включён выбор дат.
    // Если выбор дат выключен — все будущие даты доступны, проверку пропускаем.
    const selectionEnabled = await isGuideDateSelectionEnabled();
    if (selectionEnabled) {
      const availableDates = parseJsonField(guide.availableDates) || [];
      const unavailableDates = selectedDates.filter(date => !availableDates.includes(date));

      if (unavailableDates.length > 0) {
        res.status(400).json({
          success: false,
          message: `Следующие даты недоступны: ${unavailableDates.join(', ')}`
        });
        return;
      }
    }

    // Рассчитываем стоимость
    const numberOfDays = selectedDates.length;
    const baseTotalPrice = guide.pricePerDay * numberOfDays;
    
    // Получаем пользовательскую валюту из заголовков или query параметров
    const userCurrency = (req.query.currency as string) || (req.headers['x-currency'] as string) || guide.currency || 'TJS';
    
    // Конвертируем цену в пользовательскую валюту
    let totalPrice = baseTotalPrice;
    let currency = guide.currency || 'TJS';
    let exchangeRate = 1;
    
    if (userCurrency !== (guide.currency || 'TJS')) {
      const conversion = await convertCurrency(baseTotalPrice, guide.currency || 'TJS', userCurrency);
      if (conversion) {
        totalPrice = conversion.convertedAmount;
        currency = userCurrency;
        exchangeRate = conversion.rate;
      }
    }

    // Создаем заявку на найм
    const hireRequest = await prisma.guideHireRequest.create({
      data: {
        guideId: guideId,
        touristName: touristName,
        touristEmail: touristEmail || null,
        touristPhone: touristPhone || null,
        selectedDates: JSON.stringify(selectedDates),
        numberOfDays: numberOfDays,
        comments: comments || null,
        totalPrice: totalPrice,
        baseTotalPrice: baseTotalPrice,
        currency: currency,
        baseCurrency: guide.currency || 'TJS',
        exchangeRate: exchangeRate,
        status: 'pending',
        paymentStatus: 'unpaid'
      },
      include: {
        guide: {
          select: {
            id: true,
            name: true,
            photo: true,
            contact: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Заявка на найм тургида создана успешно',
      data: {
        ...hireRequest,
        selectedDates: parseJsonField(hireRequest.selectedDates)
      }
    });
  } catch (error) {
    console.error('Error creating guide hire request:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании заявки на найм'
    });
  }
};

// Получить забронированные (оплаченные) даты гида — ПУБЛИЧНЫЙ endpoint
export const getGuideBookedDates = async (req: Request, res: Response) => {
  try {
    const guideId = parseInt(req.params.guideId);
    if (!guideId || isNaN(guideId)) {
      res.status(400).json({ success: false, message: 'Invalid guide ID' });
      return;
    }

    // Если выбор дат выключен — занятых (заблокированных) дат нет:
    // все будущие даты доступны для найма, даже если уже есть бронь.
    const selectionEnabled = await isGuideDateSelectionEnabled();
    if (!selectionEnabled) {
      res.json({ success: true, data: [] });
      return;
    }

    const paidRequests = await prisma.guideHireRequest.findMany({
      where: {
        guideId,
        paymentStatus: 'paid',
        status: { notIn: ['cancelled', 'rejected'] }
      },
      select: { selectedDates: true }
    });

    const bookedDates = new Set<string>();
    paidRequests.forEach(r => {
      const dates = parseJsonField(r.selectedDates) || [];
      dates.forEach((d: string) => {
        const normalized = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)
          ? d.substring(0, 10)
          : d;
        bookedDates.add(normalized);
      });
    });

    res.json({ success: true, data: Array.from(bookedDates) });
  } catch (error) {
    console.error('Error getting guide booked dates:', error);
    res.status(500).json({ success: false, message: 'Error getting booked dates' });
  }
};

// Утилита: атомарно удалить даты из availableDates гида после оплаты
// Использует SELECT FOR UPDATE для предотвращения двойного бронирования
export const removeGuideDatesAfterPayment = async (guideHireRequestId: number): Promise<boolean> => {
  try {
    // Если выбор дат выключен — не трогаем availableDates гида.
    // Все даты остаются доступными, а сохранённый выбор гида не изменяется
    // (легко вернуть прежнее поведение, просто включив настройку).
    const selectionEnabled = await isGuideDateSelectionEnabled();
    if (!selectionEnabled) {
      console.log(`📅 [GUIDE DATES] Date selection disabled — skipping date removal for request ${guideHireRequestId}`);
      return true;
    }

    const hireRequest = await prisma.guideHireRequest.findUnique({
      where: { id: guideHireRequestId },
      select: { guideId: true, selectedDates: true }
    });
    if (!hireRequest) return false;

    const selectedDates = parseJsonField(hireRequest.selectedDates) || [];
    if (selectedDates.length === 0) return true;

    // Проверяем нет ли уже другого ОПЛАЧЕННОГО бронирования на эти же даты
    const conflictingPaid = await prisma.guideHireRequest.findMany({
      where: {
        guideId: hireRequest.guideId,
        paymentStatus: 'paid',
        id: { not: guideHireRequestId },
        status: { notIn: ['cancelled', 'rejected'] }
      },
      select: { selectedDates: true, id: true }
    });

    const alreadyPaidDates = new Set<string>();
    conflictingPaid.forEach(r => {
      const dates = parseJsonField(r.selectedDates) || [];
      dates.forEach((d: string) => alreadyPaidDates.add(d));
    });

    const conflictDates = selectedDates.filter((d: string) => alreadyPaidDates.has(d));
    if (conflictDates.length > 0) {
      console.warn(`⚠️ [GUIDE DATES] Conflict: dates ${conflictDates.join(', ')} already paid by another booking for guide ${hireRequest.guideId}`);
    }

    // Атомарная транзакция с блокировкой строки гида
    await prisma.$transaction(async (tx) => {
      const lockedGuide = await tx.$queryRaw<Array<{ id: number; available_dates: string }>>`
        SELECT id, available_dates
        FROM guides
        WHERE id = ${hireRequest.guideId}
        FOR UPDATE
      `;

      if (!lockedGuide || lockedGuide.length === 0) return;

      const currentAvailable = parseJsonField(lockedGuide[0].available_dates) || [];
      const updatedAvailable = currentAvailable.filter(
        (date: string) => !selectedDates.includes(date)
      );

      await tx.$executeRaw`
        UPDATE guides
        SET available_dates = ${JSON.stringify(updatedAvailable)}
        WHERE id = ${hireRequest.guideId}
      `;
    });

    console.log(`📅 [GUIDE DATES] Removed ${selectedDates.length} dates from guide ${hireRequest.guideId} after payment`);
    return true;
  } catch (error) {
    console.error('❌ [GUIDE DATES] Failed to remove dates after payment:', error);
    return false;
  }
};

// Получить заявки на найм тургида (для админ панели)
export const getGuideHireRequests = async (req: Request, res: Response) => {
  try {
    const { guideId, status, paymentStatus } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    if (guideId) whereClause.guideId = parseInt(guideId as string);
    if (status) whereClause.status = status as string;
    if (paymentStatus) whereClause.paymentStatus = paymentStatus as string;

    const [requests, total] = await Promise.all([
      prisma.guideHireRequest.findMany({
        where: whereClause,
        include: {
          guide: {
            select: {
              id: true,
              name: true,
              photo: true,
              contact: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.guideHireRequest.count({ where: whereClause })
    ]);

    const formattedRequests = requests.map((request: any) => ({
      ...request,
      selectedDates: parseJsonField(request.selectedDates)
    }));

    res.json({
      success: true,
      data: {
        requests: formattedRequests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting guide hire requests:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении заявок на найм'
    });
  }
};

// Получить наймы гида для его личного кабинета (ТОЛЬКО ОПЛАЧЕННЫЕ)
export const getMyHires = async (req: Request, res: Response) => {
  try {
    // FIX: Используем req.user.id из middleware authenticateTourGuide
    const guideId = (req as any).user?.id || (req as any).guideId;
    
    console.log(`📋 [GUIDE HIRES] Fetching hire orders for guide ID: ${guideId}`);
    
    if (!guideId) {
      console.log('❌ [GUIDE HIRES] No guideId found in request. user:', (req as any).user);
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    // ВАЖНО: Гид видит только ОПЛАЧЕННЫЕ заказы
    const whereClause: any = { 
      guideId: parseInt(guideId),
      paymentStatus: 'paid' // Только оплаченные заказы
    };
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    console.log(`📋 [GUIDE HIRES] Query where clause:`, JSON.stringify(whereClause));

    const [hires, total, totalAll] = await Promise.all([
      prisma.guideHireRequest.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.guideHireRequest.count({ where: whereClause }),
      prisma.guideHireRequest.count({ where: { guideId: parseInt(guideId), paymentStatus: 'paid' } }) // Только оплаченные
    ]);

    console.log(`📋 [GUIDE HIRES] Found ${hires.length} paid hire orders for guide ${guideId}`);

    const formattedHires = hires.map((hire: any) => ({
      ...hire,
      selectedDates: parseJsonField(hire.selectedDates)
    }));

    res.json({
      success: true,
      data: {
        hires: formattedHires,
        pagination: {
          page,
          limit,
          total,
          totalAll, // Общий счётчик оплаченных заказов
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting guide hires:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении наймов'
    });
  }
};

// Обновить статус заявки на найм (для админ панели)
export const updateGuideHireRequestStatus = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { status, paymentStatus, adminNotes } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];
    const validPaymentStatuses = ['unpaid', 'paid', 'refunded'];

    if (status && !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Неверный статус заявки'
      });
      return;
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      res.status(400).json({
        success: false,
        message: 'Неверный статус оплаты'
      });
      return;
    }

    // Получаем текущую заявку
    const currentRequest = await prisma.guideHireRequest.findUnique({
      where: { id: parseInt(requestId) },
      include: {
        guide: {
          select: {
            id: true,
            availableDates: true
          }
        }
      }
    });

    if (!currentRequest) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
      return;
    }

    // Если заявка одобряется, делаем это в безопасной для конкурентности транзакции
    if (status === 'approved' && currentRequest.status !== 'approved') {
      const selectedDates = parseJsonField(currentRequest.selectedDates) || [];
      // Когда выбор дат выключен — не проверяем и не вычитаем даты из доступности гида.
      const selectionEnabled = await isGuideDateSelectionEnabled();
      
      try {
        const result = await prisma.$transaction(async (tx: any) => {
          // 1. Пытаемся одобрить заявку только если она все еще в статусе pending
          const approvedRequests = await tx.guideHireRequest.updateMany({
            where: { 
              id: parseInt(requestId),
              status: 'pending' // Условие: одобряем только если еще pending
            },
            data: {
              status: 'approved',
              paymentStatus: paymentStatus || undefined,
              adminNotes: adminNotes || undefined
            }
          });
          
          // Если ни одна заявка не была обновлена (уже не pending), возвращаем ошибку
          if (approvedRequests.count === 0) {
            throw new Error('REQUEST_ALREADY_PROCESSED');
          }

          // Когда выбор дат выключен — пропускаем проверку и вычитание дат гида.
          if (!selectionEnabled) {
            // 5. Автоматически создаем заказ для оплаты (см. ниже)
            const orderNumber = `GH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            const order = await tx.order.create({
              data: {
                orderNumber,
                customerName: currentRequest.touristName,
                customerEmail: currentRequest.touristEmail || '',
                customerPhone: currentRequest.touristPhone || '',
                totalAmount: currentRequest.totalPrice,
                currency: currentRequest.currency,
                status: 'pending',
                guideHireRequestId: currentRequest.id
              }
            });
            return { orderNumber };
          }
          
          // 2. Свежий перезапрос доступности тургида внутри транзакции
          const freshGuide = await tx.guide.findUnique({
            where: { id: currentRequest.guideId },
            select: { availableDates: true }
          });
          
          if (!freshGuide) {
            throw new Error('GUIDE_NOT_FOUND');
          }
          
          const freshAvailableDates = parseJsonField(freshGuide.availableDates) || [];
          
          // 3. Проверяем что все даты все еще доступны
          const unavailableDates = selectedDates.filter((date: string) => !freshAvailableDates.includes(date));
          if (unavailableDates.length > 0) {
            throw new Error(`DATES_UNAVAILABLE:${unavailableDates.join(',')}`);
          }
          
          // 4. Обновляем доступность тургида, удаляя забронированные даты
          const updatedAvailableDates = freshAvailableDates.filter(
            (date: string) => !selectedDates.includes(date)
          );
          
          await tx.guide.update({
            where: { id: currentRequest.guideId },
            data: {
              availableDates: JSON.stringify(updatedAvailableDates)
            }
          });
          
          // 5. Автоматически создаем заказ для оплаты
          const orderNumber = `GH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          
          const order = await tx.order.create({
            data: {
              orderNumber,
              customerName: currentRequest.touristName,
              customerEmail: currentRequest.touristEmail || '',
              customerPhone: currentRequest.touristPhone || '',
              totalAmount: currentRequest.totalPrice,
              currency: currentRequest.currency,
              status: 'pending',
              guideHireRequestId: currentRequest.id
            }
          });
          
          return { orderNumber };
        });
        
        // Получаем обновленную заявку для ответа
        const updatedRequest = await prisma.guideHireRequest.findUnique({
          where: { id: parseInt(requestId) },
          include: {
            guide: {
              select: {
                id: true,
                name: true,
                photo: true
              }
            }
          }
        });

        // Отправить email уведомление клиенту с ссылкой на оплату
        if (updatedRequest && updatedRequest.touristEmail && result.orderNumber) {
          try {
            const guideName = parseJsonField(updatedRequest.guide.name);
            const guideDisplayName = typeof guideName === 'object' ? (guideName.ru || guideName.en || 'Тургид') : guideName;
            
            // Формируем ссылку на оплату
            const paymentUrl = `${process.env.FRONTEND_URL || 'https://bunyodtour.tj'}/payment-selection.html?orderNumber=${result.orderNumber}&type=guide-hire`;
            
            await sendEmail({
              to: updatedRequest.touristEmail,
              subject: 'Ваша заявка на найм тургида одобрена - Bunyod Tour',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #3E3E3E;">Заявка на найм тургида одобрена!</h2>
                  
                  <p>Здравствуйте, ${updatedRequest.touristName}!</p>
                  
                  <p>Рады сообщить, что ваша заявка на найм тургида была одобрена нашим администратором.</p>
                  
                  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Детали заявки:</h3>
                    <p><strong>Номер заказа:</strong> ${result.orderNumber}</p>
                    <p><strong>Тургид:</strong> ${guideDisplayName}</p>
                    <p><strong>Сумма:</strong> ${updatedRequest.totalPrice} ${updatedRequest.currency}</p>
                    <p><strong>Количество дней:</strong> ${selectedDates.length}</p>
                  </div>
                  
                  <p><strong>Вы можете оплатить заказ прямо сейчас:</strong></p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${paymentUrl}" 
                       style="display: inline-block; background-color: #3E3E3E; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                      Перейти к оплате
                    </a>
                  </div>
                  
                  <p style="color: #666; font-size: 14px;">Или скопируйте эту ссылку в браузер:<br>
                  <a href="${paymentUrl}">${paymentUrl}</a></p>
                  
                  <p style="margin-top: 20px; font-size: 14px; color: #666;">
                    Если у вас есть вопросы, свяжитесь с нами:<br>
                    📧 Email: booking@bunyodtour.tj<br>
                    📞 Телефоны: +992 44 625 7575; +992 93-126-1134<br>
                    📞 +992 00-110-0087; +992 88-235-3434<br>
                    🌐 Сайт: bunyodtour.tj
                  </p>
                  
                  <p style="margin-top: 30px;">
                    С уважением,<br>
                    <strong>Команда Bunyod Tour</strong>
                  </p>
                </div>
              `
            });
            
            console.log(`✅ Approval email with payment link sent to ${updatedRequest.touristEmail} - Order: ${result.orderNumber}`);
          } catch (emailError) {
            console.error('❌ Failed to send approval email:', emailError);
            // Не прерываем процесс если email не отправился
          }
        }

        res.json({
          success: true,
          message: 'Заявка одобрена и даты зарезервированы',
          data: {
            ...updatedRequest,
            selectedDates: parseJsonField(updatedRequest!.selectedDates)
          }
        });
        return;
        
      } catch (error: any) {
        if (error.message === 'REQUEST_ALREADY_PROCESSED') {
          res.status(409).json({
            success: false,
            message: 'Заявка уже была обработана другим администратором'
          });
          return;
        } else if (error.message.startsWith('DATES_UNAVAILABLE:')) {
          const unavailableDates = error.message.split(':')[1];
          res.status(409).json({
            success: false,
            message: `Следующие даты больше не доступны: ${unavailableDates}. Заявка не может быть одобрена.`
          });
          return;
        } else if (error.message === 'GUIDE_NOT_FOUND') {
          res.status(404).json({
            success: false,
            message: 'Тургид не найден'
          });
          return;
        } else {
          throw error; // Неожиданная ошибка, передаем дальше
        }
      }
    }

    // Если заявка отклоняется/отменяется после одобрения, возвращаем даты обратно
    // в доступные — ТОЛЬКО когда выбор дат включён. При выключенном выборе даты
    // гида не трогаем (availableDates сохраняется в исходном виде).
    const rollbackSelectionEnabled = await isGuideDateSelectionEnabled();
    if (rollbackSelectionEnabled && (status === 'rejected' || status === 'cancelled') && currentRequest.status === 'approved') {
      const selectedDates = parseJsonField(currentRequest.selectedDates) || [];
      const currentAvailableDates = parseJsonField(currentRequest.guide.availableDates) || [];
      
      // Возвращаем даты обратно в доступные (если они еще не прошли)
      const today = new Date().toISOString().split('T')[0];
      const futureDates = selectedDates.filter((date: string) => date >= today);
      
      // Объединяем и удаляем дубликаты
      const combinedDates = [...currentAvailableDates, ...futureDates];
      const uniqueDates = [...new Set(combinedDates)].sort();

      await prisma.guide.update({
        where: { id: currentRequest.guideId },
        data: {
          availableDates: JSON.stringify(uniqueDates)
        }
      });
    }

    // Для всех остальных случаев (не одобрение) просто обновляем статус
    const updatedRequest = await prisma.guideHireRequest.update({
      where: { id: parseInt(requestId) },
      data: {
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        adminNotes: adminNotes || undefined
      },
      include: {
        guide: {
          select: {
            id: true,
            name: true,
            photo: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Статус заявки обновлен',
      data: {
        ...updatedRequest,
        selectedDates: parseJsonField(updatedRequest.selectedDates)
      }
    });
  } catch (error) {
    console.error('Error updating hire request status:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении статуса заявки'
    });
  }
};

// Получить все доступные тургиды для найма
export const getAvailableGuides = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;

    const guides = await prisma.guide.findMany({
      where: {
        isActive: true,
        isHireable: true,
        pricePerDay: {
          not: null,
          gt: 0
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        photo: true,
        languages: true,
        experience: true,
        rating: true,
        pricePerDay: true,
        currency: true,
        availableDates: true,
        countryId: true,
        cityId: true,
        guideCountry: {
          select: { name: true }
        },
        guideCity: {
          select: { name: true }
        }
      },
      orderBy: [
        { rating: 'desc' },
        { experience: 'desc' }
      ]
    });

    let filteredGuides = guides;

    // Фильтруем по дате только когда выбор дат включён.
    // Когда выбор выключен — гид доступен на любую дату, фильтрацию пропускаем.
    const selectionEnabled = await isGuideDateSelectionEnabled();
    if (date && selectionEnabled) {
      filteredGuides = guides.filter((guide: any) => {
        const availableDates = parseJsonField(guide.availableDates) || [];
        return availableDates.includes(date);
      });
    }

    const formattedGuides = filteredGuides.map((guide: any) => ({
      ...guide,
      availableDates: parseJsonField(guide.availableDates),
      languages: parseJsonField(guide.languages)
    }));

    res.json({
      success: true,
      data: formattedGuides
    });
  } catch (error) {
    console.error('Error getting available guides:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка доступных тургидов'
    });
  }
};

/**
 * Создать прямой заказ на найм тургида (без одобрения админа)
 * POST /api/guide-hire/orders
 * ПУБЛИЧНЫЙ endpoint - турист создает заказ и сразу переходит к оплате
 */
export const createDirectGuideHireOrder = async (req: Request, res: Response) => {
  try {
    const {
      guideId,
      touristName,
      touristEmail,
      touristPhone,
      selectedDates,
      comments,
      language
    } = req.body as DirectGuideHireData & { language?: string };

    // Валидация обязательных полей
    if (!guideId || !touristName || !touristEmail || !selectedDates || selectedDates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Не все обязательные поля заполнены'
      });
      return;
    }

    // Проверка email формата
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(touristEmail)) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат email'
      });
      return;
    }

    // Получить тургида с его ценами
    const guide = await prisma.guide.findUnique({
      where: { id: parseInt(String(guideId)) },
      select: {
        id: true,
        name: true,
        pricePerDay: true,
        currency: true,
        availableDates: true,
        isHireable: true,
        isActive: true,
        contact: true
      }
    });

    if (!guide) {
      res.status(404).json({
        success: false,
        message: 'Тургид не найден'
      });
      return;
    }

    if (!guide.isActive || !guide.isHireable) {
      res.status(400).json({
        success: false,
        message: 'Тургид недоступен для найма'
      });
      return;
    }

    if (!guide.pricePerDay || guide.pricePerDay <= 0) {
      res.status(400).json({
        success: false,
        message: 'У тургида не установлена цена'
      });
      return;
    }

    // Прошедшие даты недоступны ВСЕГДА (и при включённом, и при выключенном выборе)
    const todayStr = new Date().toISOString().split('T')[0];
    const pastDates = selectedDates.filter(date => date < todayStr);
    if (pastDates.length > 0) {
      res.status(400).json({
        success: false,
        message: `Нельзя выбрать прошедшие даты: ${pastDates.join(', ')}`
      });
      return;
    }

    // Проверяем принадлежность дат к доступным ТОЛЬКО когда выбор дат включён.
    // Когда выбор выключен — доступна любая будущая дата.
    const selectionEnabled = await isGuideDateSelectionEnabled();
    if (selectionEnabled) {
      const availableDates = parseJsonField(guide.availableDates) || [];
      const unavailableDates = selectedDates.filter(date => !availableDates.includes(date));

      if (unavailableDates.length > 0) {
        res.status(400).json({
          success: false,
          message: `Следующие даты недоступны: ${unavailableDates.join(', ')}`
        });
        return;
      }
    }

    // Рассчитать стоимость ТОЛЬКО на сервере (безопасность)
    const numberOfDays = selectedDates.length;
    const totalPrice = guide.pricePerDay * numberOfDays;
    const currency = guide.currency || 'TJS'; // ВСЕГДА используем валюту тургида

    // Создать или найти клиента СТРОГО ПО EMAIL (не по телефону!)
    // Это гарантирует что письмо уйдёт на указанный в форме email
    let customer = await prisma.customer.findFirst({
      where: { email: touristEmail }
    });

    if (!customer) {
      // Клиента с таким email нет - создаём нового
      customer = await prisma.customer.create({
        data: {
          fullName: touristName,
          email: touristEmail,
          phone: touristPhone || ''
        }
      });
    } else {
      // Клиент найден - обновляем имя и телефон если изменились
      if (customer.fullName !== touristName || customer.phone !== (touristPhone || '')) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: {
            fullName: touristName,
            phone: touristPhone || customer.phone
          }
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Создаем GuideHireRequest со статусом "confirmed"
      // Даты НЕ удаляются из availableDates — они будут удалены только после оплаты
      const guideHireRequest = await tx.guideHireRequest.create({
        data: {
          guideId: guide.id,
          touristName,
          touristEmail,
          touristPhone: touristPhone || null,
          selectedDates: JSON.stringify(selectedDates),
          numberOfDays,
          totalPrice, // Вычислено на сервере из guide.pricePerDay
          currency,
          comments: comments || null,
          status: 'confirmed', // Сразу confirmed, т.к. турист платит
          paymentStatus: 'unpaid'
        }
      });

      // 5. Создаем Order для оплаты
      const orderNumber = `GH-${Date.now()}-${guide.id}`;
      const customerLanguage = language || 'ru'; // Язык из запроса
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          guideHireRequestId: guideHireRequest.id,
          tourDate: selectedDates[0], // Первая дата найма (строка)
          tourists: JSON.stringify([{
            name: touristName,
            phone: touristPhone,
            email: touristEmail
          }]),
          wishes: comments || '',
          totalAmount: totalPrice, // Вычислено на сервере - БЕЗОПАСНО
          status: 'pending',
          paymentStatus: 'unpaid',
          language: customerLanguage
        }
      });

      // Правильное извлечение имени гида (может быть объект {ru, en} или строка)
      const guideNameStr = typeof guide.name === 'object' && guide.name !== null 
        ? ((guide.name as any).ru || (guide.name as any).en || 'Гид') 
        : String(guide.name || 'Гид');
      
      return {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        currency,
        orderId: order.id,
        guideHireRequestId: guideHireRequest.id,
        guideName: guideNameStr,
        numberOfDays
      };
    });

    console.log(`✅ Direct guide hire order created: ${result.orderNumber}, Amount: ${result.totalAmount} ${result.currency}, Guide: ${result.guideName}, Days: ${result.numberOfDays}`);

    // СНАЧАЛА отправляем ответ клиенту (не блокируем)
    res.json({
      success: true,
      data: {
        orderNumber: result.orderNumber,
        totalAmount: result.totalAmount,
        currency: result.currency,
        orderId: result.orderId,
        paymentUrl: `/payment-selection.html?orderNumber=${result.orderNumber}&type=guide-hire`
      },
      message: 'Заказ создан успешно. Переходите к оплате.'
    });

    // ПОТОМ отправляем email админу (неблокирующе, в фоне)
    // Если email зависнет - это не повлияет на пользователя
    setImmediate(async () => {
      try {
        const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
        await sendEmail({
          to: adminEmail,
          subject: `Новый платный найм тургида - ${result.guideName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3E3E3E;">Новый платный найм тургида</h2>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Информация о заказе</h3>
                <p><strong>Номер заказа:</strong> ${result.orderNumber}</p>
                <p><strong>Тургид:</strong> ${result.guideName}</p>
                <p><strong>Количество дней:</strong> ${result.numberOfDays}</p>
                <p><strong>Сумма:</strong> ${result.totalAmount} ${result.currency}</p>
                <p><strong>Даты:</strong> ${selectedDates.join(', ')}</p>
              </div>

              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Контакты туриста</h3>
                <p><strong>Имя:</strong> ${touristName}</p>
                <p><strong>Email:</strong> ${touristEmail}</p>
                <p><strong>Телефон:</strong> ${touristPhone || 'Не указан'}</p>
                ${comments ? `<p><strong>Комментарии:</strong> ${comments}</p>` : ''}
              </div>

              <p><strong>Статус оплаты:</strong> Ожидает оплаты</p>
              <p>Турист был перенаправлен на страницу оплаты.</p>
            </div>
          `
        });
        console.log('✅ Admin notification email sent successfully');

        // Отправляем email гиду о новой заявке на найм
        if (guide.contact) {
          const guideEmail = guide.contact; // В поле contact хранится email гида
          const baseUrl = process.env.BASE_URL || 'https://bunyodtour.tj';
          await sendEmail({
            to: guideEmail,
            subject: `Новая заявка на найм | Bunyod-Tour`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #3E3E3E;">🎉 У вас новая заявка на найм!</h2>
                <p>Уважаемый(ая) <strong>${result.guideName}</strong>,</p>
                <p>Турист хочет нанять вас в качестве гида.</p>
                
                <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                  <h3 style="margin-top: 0; color: #1e40af;">Детали заявки</h3>
                  <p><strong>Турист:</strong> ${touristName}</p>
                  <p><strong>Email:</strong> ${touristEmail}</p>
                  <p><strong>Телефон:</strong> ${touristPhone || 'Не указан'}</p>
                  <p><strong>Даты:</strong> ${selectedDates.join(', ')}</p>
                  <p><strong>Количество дней:</strong> ${result.numberOfDays}</p>
                  <p><strong>Сумма:</strong> ${result.totalAmount} ${result.currency}</p>
                  ${comments ? `<p><strong>Пожелания:</strong> ${comments}</p>` : ''}
                </div>

                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>⚡ Действие требуется:</strong> Пожалуйста, войдите в личный кабинет и примите или отклоните заявку.</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${baseUrl}/guide-cabinet.html" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    Открыть личный кабинет
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px;">Статус оплаты: Ожидает оплаты туристом</p>
              </div>
            `
          });
          console.log('✅ Guide notification email sent successfully');
        }
      } catch (emailError) {
        console.error('❌ Failed to send admin notification email:', emailError);
        // Email ошибка не влияет на пользователя
      }
    });

  } catch (error) {
    console.error('❌ Error creating direct guide hire order:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании заказа',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// ========== НОВОЕ: Ответ гида на заявку (принять/отклонить) ==========
export const respondToHireRequest = async (req: Request, res: Response) => {
  try {
    // FIX: Используем req.user.id из middleware authenticateTourGuide
    const guideId = (req as any).user?.id || (req as any).guideId;
    const { requestId } = req.params;
    const { response, note } = req.body; // response: 'accepted' | 'rejected'

    console.log(`📋 [GUIDE RESPONSE] Guide ${guideId} responding to hire request ${requestId}: ${response}`);

    if (!guideId) {
      console.log('❌ [GUIDE RESPONSE] No guideId found in request');
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    if (!response || !['accepted', 'rejected'].includes(response)) {
      res.status(400).json({
        success: false,
        message: 'Укажите ответ: accepted или rejected'
      });
      return;
    }

    // Проверяем что заявка существует и принадлежит этому гиду
    const hireRequest = await prisma.guideHireRequest.findFirst({
      where: {
        id: parseInt(requestId),
        guideId: parseInt(guideId)
      },
      include: {
        guide: {
          select: {
            id: true,
            name: true,
            contact: true
          }
        }
      }
    });

    if (!hireRequest) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена или не принадлежит вам'
      });
      return;
    }

    // Проверяем что гид еще не ответил
    if (hireRequest.guideResponse !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Вы уже ответили на эту заявку: ${hireRequest.guideResponse === 'accepted' ? 'принято' : 'отклонено'}`
      });
      return;
    }

    // Обновляем заявку с ответом гида
    const updatedRequest = await prisma.guideHireRequest.update({
      where: { id: parseInt(requestId) },
      data: {
        guideResponse: response,
        guideResponseNote: note || null,
        guideRespondedAt: new Date()
      }
    });

    console.log(`✅ Guide ${guideId} responded to hire request ${requestId}: ${response}`);

    // Отправляем email туристу о решении гида (в фоне)
    if (hireRequest.touristEmail) {
      setImmediate(async () => {
        try {
          const guideName = typeof hireRequest.guide.name === 'object' 
            ? ((hireRequest.guide.name as any).ru || (hireRequest.guide.name as any).en)
            : hireRequest.guide.name;

          const selectedDates = parseJsonField(hireRequest.selectedDates) || [];

          if (response === 'accepted') {
            await sendEmail({
              to: hireRequest.touristEmail!,
              subject: `Гид ${guideName} принял вашу заявку на найм | Bunyod-Tour`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #10b981;">🎉 Отличные новости!</h2>
                  <p>Уважаемый(ая) <strong>${hireRequest.touristName}</strong>,</p>
                  <p>Гид <strong>${guideName}</strong> принял вашу заявку на найм!</p>
                  
                  <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <h3 style="margin-top: 0; color: #059669;">Детали найма</h3>
                    <p><strong>Даты:</strong> ${selectedDates.join(', ')}</p>
                    <p><strong>Количество дней:</strong> ${hireRequest.numberOfDays}</p>
                    <p><strong>Стоимость:</strong> ${hireRequest.totalPrice} ${hireRequest.currency}</p>
                    ${note ? `<p><strong>Сообщение от гида:</strong> ${note}</p>` : ''}
                  </div>

                  <p>Спасибо за использование Bunyod-Tour!</p>
                </div>
              `
            });
          } else {
            await sendEmail({
              to: hireRequest.touristEmail!,
              subject: `Ответ на заявку на найм гида | Bunyod-Tour`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #6b7280;">Ответ на вашу заявку</h2>
                  <p>Уважаемый(ая) <strong>${hireRequest.touristName}</strong>,</p>
                  <p>К сожалению, гид <strong>${guideName}</strong> не может принять вашу заявку на указанные даты.</p>
                  
                  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Даты:</strong> ${selectedDates.join(', ')}</p>
                    ${note ? `<p><strong>Причина:</strong> ${note}</p>` : ''}
                  </div>

                  <p>Вы можете выбрать другого гида или другие даты на нашем сайте.</p>
                  <p>Спасибо за использование Bunyod-Tour!</p>
                </div>
              `
            });
          }
          console.log(`✅ Tourist notification email sent for hire request ${requestId}`);
        } catch (emailError) {
          console.error('❌ Failed to send tourist notification email:', emailError);
        }
      });
    }

    res.json({
      success: true,
      message: response === 'accepted' ? 'Заявка принята' : 'Заявка отклонена',
      data: {
        id: updatedRequest.id,
        guideResponse: updatedRequest.guideResponse,
        guideRespondedAt: updatedRequest.guideRespondedAt
      }
    });

  } catch (error) {
    console.error('Error responding to hire request:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обработке ответа'
    });
  }
};

// Получить одну заявку на найм по ID (для админ-панели)
export const getGuideHireRequestById = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    
    const request = await prisma.guideHireRequest.findUnique({
      where: { id: parseInt(requestId) },
      include: {
        guide: {
          select: {
            id: true,
            name: true,
            photo: true,
            contact: true,
          }
        }
      }
    });

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...request,
        selectedDates: parseJsonField(request.selectedDates)
      }
    });
  } catch (error) {
    console.error('Error getting guide hire request:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении заявки'
    });
  }
};

// Удалить заявку на найм (для админ-панели)
export const deleteGuideHireRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    
    const request = await prisma.guideHireRequest.findUnique({
      where: { id: parseInt(requestId) }
    });

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
      return;
    }

    await prisma.guideHireRequest.delete({
      where: { id: parseInt(requestId) }
    });

    console.log(`🗑️ [ADMIN] Guide hire request ${requestId} deleted`);

    res.json({
      success: true,
      message: 'Заявка удалена'
    });
  } catch (error) {
    console.error('Error deleting guide hire request:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении заявки'
    });
  }
};
