import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendEmail } from '../services/emailService';

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
            const paymentUrl = `${process.env.FRONTEND_URL || 'https://bunyod-tour.replit.app'}/payment-selection.html?orderNumber=${result.orderNumber}&type=guide-hire`;
            
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
                  
                  <p>Если у вас есть вопросы, пожалуйста, свяжитесь с нами.</p>
                  
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
      comments
    }: DirectGuideHireData = req.body;

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

    if (!guide.pricePerDay || guide.pricePerDay <= 0) {
      res.status(400).json({
        success: false,
        message: 'У тургида не установлена цена'
      });
      return;
    }

    // Проверить доступность дат
    const availableDates = parseJsonField(guide.availableDates) || [];
    const unavailableDates = selectedDates.filter(date => !availableDates.includes(date));

    if (unavailableDates.length > 0) {
      res.status(400).json({
        success: false,
        message: `Следующие даты недоступны: ${unavailableDates.join(', ')}`
      });
      return;
    }

    // Рассчитать стоимость ТОЛЬКО на сервере (безопасность)
    const numberOfDays = selectedDates.length;
    const totalPrice = guide.pricePerDay * numberOfDays;
    const currency = guide.currency || 'TJS'; // ВСЕГДА используем валюту тургида

    // Создать или найти клиента
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: touristEmail },
          ...(touristPhone ? [{ phone: touristPhone }] : [])
        ]
      }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          fullName: touristName,
          email: touristEmail,
          phone: touristPhone || ''
        }
      });
    }

    // АТОМАРНАЯ ТРАНЗАКЦИЯ: Резервация дат + создание Order + создание GuideHireRequest
    const result = await prisma.$transaction(async (tx) => {
      // 1. КРИТИЧНО: Повторная проверка доступности ВНУТРИ транзакции
      const currentGuide = await tx.guide.findUnique({
        where: { id: guide.id },
        select: { availableDates: true }
      });

      if (!currentGuide) {
        throw new Error('Guide not found in transaction');
      }

      const currentAvailableDates = parseJsonField(currentGuide.availableDates) || [];
      const unavailableDatesInTransaction = selectedDates.filter(
        date => !currentAvailableDates.includes(date)
      );

      // Если даты стали недоступны между проверкой и транзакцией - откатываем
      if (unavailableDatesInTransaction.length > 0) {
        throw new Error(`Даты уже забронированы другим пользователем: ${unavailableDatesInTransaction.join(', ')}`);
      }

      // 2. Резервируем даты (убираем из availableDates)
      const newAvailableDates = currentAvailableDates.filter(
        (date: string) => !selectedDates.includes(date)
      );

      await tx.guide.update({
        where: { id: guide.id },
        data: {
          availableDates: JSON.stringify(newAvailableDates)
        }
      });

      // 3. Создаем GuideHireRequest со статусом "confirmed" (как audit log)
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

      // 4. Создаем Order для оплаты
      const orderNumber = `GH-${Date.now()}-${guide.id}`;
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
          paymentStatus: 'unpaid'
        }
      });

      return {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        currency,
        orderId: order.id,
        guideHireRequestId: guideHireRequest.id,
        guideName: guide.name,
        numberOfDays
      };
    });

    console.log(`✅ Direct guide hire order created: ${result.orderNumber}, Amount: ${result.totalAmount} ${result.currency}, Guide: ${result.guideName}, Days: ${result.numberOfDays}`);

    // Отправить email админу о новом платном найме
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@bunyod-tour.tj';
      await sendEmail({
        to: adminEmail,
        subject: `Новый платный найм тургида - ${guide.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3E3E3E;">Новый платный найм тургида</h2>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Информация о заказе</h3>
              <p><strong>Номер заказа:</strong> ${result.orderNumber}</p>
              <p><strong>Тургид:</strong> ${guide.name}</p>
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
    } catch (emailError) {
      console.error('❌ Failed to send admin notification email:', emailError);
      // Не прерываем процесс если email не отправился
    }

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

  } catch (error) {
    console.error('❌ Error creating direct guide hire order:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании заказа',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};