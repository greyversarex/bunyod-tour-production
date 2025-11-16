// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../config/database';

// Утилитарная функция для конвертации валют
const convertCurrency = async (amount: number, fromCurrency: string, toCurrency: string): Promise<{ convertedAmount: number; rate: number; symbol: string } | null> => {
  try {
    if (fromCurrency === toCurrency) {
      const currency = await prisma.exchangeRate.findFirst({
        where: { currency: toCurrency, is_active: true }
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
        where: { currency: fromCurrency, is_active: true } 
      }),
      prisma.exchangeRate.findFirst({ 
        where: { currency: toCurrency, is_active: true } 
      })
    ]);

    if (!fromRate || !toRate) {
      return null;
    }

    // Сначала конвертируем в TJS (базовую валюту), затем в целевую
    const tjsAmount = fromCurrency === 'TJS' ? amount : amount / fromRate.rate;
    const convertedAmount = toCurrency === 'TJS' ? tjsAmount : tjsAmount * toRate.rate;

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
        is_active: true
      }
    });

    if (!guide) {
      res.status(404).json({
        success: false,
        message: 'Тургид не найден'
      });
      return;
    }

    if (!guide.is_active || !guide.isHireable) {
      res.status(400).json({
        success: false,
        message: 'Тургид недоступен для найма'
      });
      return;
    }

    const availableDates = parseJsonField(guide.availableDates) || [];

    res.json({
      success: true,
      data: {
        id: guide.id,
        name: guide.name,
        photo: guide.photo,
        pricePerDay: guide.pricePerDay || 0,
        currency: guide.currency || 'TJS',
        availableDates: availableDates,
        isHireable: guide.isHireable
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
        is_active: true
      }
    });

    if (!guide) {
      res.status(404).json({
        success: false,
        message: 'Тургид не найден'
      });
      return;
    }

    if (!guide.is_active || !guide.isHireable) {
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

    // Проверяем доступность выбранных дат
    const availableDates = parseJsonField(guide.availableDates) || [];
    const unavailableDates = selectedDates.filter(date => !availableDates.includes(date));
    
    if (unavailableDates.length > 0) {
      res.status(400).json({
        success: false,
        message: `Следующие даты недоступны: ${unavailableDates.join(', ')}`
      });
      return;
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

// Получить заявки на найм тургида (для админ панели)
export const getGuideHireRequests = async (req: Request, res: Response) => {
  try {
    const { guideId } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const whereClause = guideId ? { guideId: parseInt(guideId as string) } : {};

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
          
          return true;
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

    // Если заявка отклоняется или отменяется после одобрения, возвращаем даты
    if ((status === 'rejected' || status === 'cancelled') && currentRequest.status === 'approved') {
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
        is_active: true,
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

    // Фильтруем по дате если указана
    if (date) {
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