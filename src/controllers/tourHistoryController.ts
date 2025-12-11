import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { sendGuideAssignmentNotification, sendGuideBookingAssignmentNotification } from '../services/emailServiceSendGrid';

// Получить активные туры для админ панели
export const getActiveTours = async (req: Request, res: Response): Promise<void> => {
  try {
    const tours = await prisma.tour.findMany({
      where: {
        status: {
          in: ['pending', 'active']
        }
      },
      include: {
        assignedGuide: {
          select: {
            id: true,
            name: true,
            login: true
          }
        },
        bookings: {
          where: {
            status: { in: ['paid', 'confirmed'] }
          }
        },
        category: true,
        tourBlockAssignments: {
          include: {
            tourBlock: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { scheduledStartDate: 'asc' }
      ]
    });

    // Подсчитать статистику для каждого тура
    const toursWithStats = tours.map(tour => {
      const totalTourists = (tour.bookings as any[]).reduce((sum, booking) => {
        return sum + booking.numberOfTourists;
      }, 0);

      return {
        id: tour.id,
        uniqueCode: tour.uniqueCode,
        title: tour.title,
        scheduledStartDate: tour.scheduledStartDate,
        scheduledEndDate: tour.scheduledEndDate,
        status: tour.status,
        assignedGuide: tour.assignedGuide,
        totalTourists,
        bookingsCount: tour.bookings.length,
        category: tour.category,
        tourBlock: tour.tourBlockAssignments?.[0]?.tourBlock || null
      };
    });

    console.log(`📋 Found ${tours.length} active tours for admin`);

    res.json({
      success: true,
      data: toursWithStats
    });

  } catch (error) {
    console.error('❌ Error getting active tours:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Получить завершённые туры для админ панели
export const getFinishedTours = async (req: Request, res: Response): Promise<void> => {
  try {
    const tours = await prisma.tour.findMany({
      where: {
        status: 'finished'
      },
      include: {
        assignedGuide: {
          select: {
            id: true,
            name: true,
            login: true
          }
        },
        bookings: {
          where: {
            status: { in: ['paid', 'confirmed'] }
          }
        },
        category: true,
        tourBlockAssignments: {
          include: {
            tourBlock: true
          }
        },
        reviews: {
          where: { isApproved: true }
        }
      },
      orderBy: {
        scheduledEndDate: 'desc'
      }
    });

    // Подсчитать статистику для каждого тура
    const toursWithStats = tours.map(tour => {
      const totalTourists = (tour.bookings as any[]).reduce((sum, booking) => {
        return sum + booking.numberOfTourists;
      }, 0);

      return {
        id: tour.id,
        uniqueCode: tour.uniqueCode,
        title: tour.title,
        scheduledStartDate: tour.scheduledStartDate,
        scheduledEndDate: tour.scheduledEndDate,
        status: tour.status,
        assignedGuide: tour.assignedGuide,
        totalTourists,
        bookingsCount: tour.bookings.length,
        category: tour.category,
        tourBlock: tour.tourBlockAssignments?.[0]?.tourBlock || null,
        customerReviews: tour.reviews
      };
    });

    console.log(`📋 Found ${tours.length} finished tours for admin`);

    res.json({
      success: true,
      data: toursWithStats
    });

  } catch (error) {
    console.error('❌ Error getting finished tours:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Получить детали тура для админ панели
export const getTourDetailsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tourId = parseInt(id);

    if (!tourId) {
      res.status(400).json({
        success: false,
        message: 'ID тура обязателен'
      });
      return;
    }

    const tour = await prisma.tour.findUnique({
      where: { id: tourId },
      include: {
        assignedGuide: {
          select: {
            id: true,
            name: true,
            login: true,
          }
        },
        bookings: {
          where: {
            status: { in: ['paid', 'confirmed'] }
          },
          include: {
            hotel: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        category: true,
        tourBlockAssignments: {
          include: {
            tourBlock: true
          }
        },
        reviews: {
          where: { isApproved: true },
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!tour) {
      res.status(404).json({
        success: false,
        message: 'Тур не найден'
      });
      return;
    }

    // Извлечь список туристов из бронирований
    const tourists: any[] = [];
    (tour.bookings || []).forEach(booking => {
      if (booking.tourists) {
        try {
          const bookingTourists = JSON.parse(booking.tourists);
          bookingTourists.forEach((tourist: any) => {
            tourists.push({
              ...tourist,
              bookingId: booking.id,
              contactEmail: booking.contactEmail,
              contactPhone: booking.contactPhone,
              hotel: booking.hotel
            });
          });
        } catch (e) {
          console.warn('Error parsing tourists data:', e);
        }
      }
    });

    const tourDetails = {
      ...tour,
      tourists: tourists,
      totalTourists: tourists.length
    };

    res.json({
      success: true,
      data: tourDetails
    });

  } catch (error) {
    console.error('❌ Error getting tour details for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Создать тургида
export const createTourGuide = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, login, password, email, phone } = req.body;

    if (!name || !login || !password) {
      res.status(400).json({
        success: false,
        message: 'Имя, логин и пароль обязательны'
      });
      return;
    }

    // Проверить уникальность логина
    const existingGuide = await prisma.tourGuideProfile.findUnique({
      where: { login }
    });

    if (existingGuide) {
      res.status(400).json({
        success: false,
        message: 'Логин уже занят'
      });
      return;
    }

    // Хэшировать пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    const guide = await prisma.tourGuideProfile.create({
      data: {
        name,
        login,
        password: hashedPassword,
        email: email || null,
        phone: phone || null
      }
    });

    console.log('✅ Tour guide created:', guide.login);

    res.json({
      success: true,
      data: {
        id: guide.id,
        name: guide.name,
        login: guide.login,
        email: guide.email,
        phone: guide.phone,
        isActive: guide.isActive,
        createdAt: guide.createdAt
      },
      message: 'Тургид создан'
    });

  } catch (error) {
    console.error('❌ Error creating tour guide:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Получить список всех тургидов (из таблицы Guide - основной каталог гидов)
export const getAllTourGuides = async (req: Request, res: Response): Promise<void> => {
  try {
    const guides = await prisma.guide.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        login: true,
        contact: true,
        languages: true,
        pricePerDay: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Преобразуем данные для совместимости с фронтендом
    const formattedGuides = guides.map(guide => ({
      id: guide.id,
      name: typeof guide.name === 'object' ? (guide.name as any).ru || (guide.name as any).en || 'Гид' : guide.name,
      login: guide.login || '',
      phone: guide.contact || '',
      isActive: true,
      createdAt: guide.createdAt
    }));

    console.log(`📋 Found ${guides.length} tour guides from Guide table`);

    res.json({
      success: true,
      data: formattedGuides
    });

  } catch (error) {
    console.error('❌ Error getting tour guides:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Обновить тургида
export const updateTourGuide = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, login, password, email, phone, isActive } = req.body;
    const guideId = parseInt(id);

    if (!guideId) {
      res.status(400).json({
        success: false,
        message: 'ID тургида обязателен'
      });
      return;
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (login !== undefined) updateData.login = login;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Хэшировать новый пароль если указан
    if (password && password.length > 0) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const guide = await prisma.tourGuideProfile.update({
      where: { id: guideId },
      data: updateData,
      select: {
        id: true,
        name: true,
        login: true,
        email: true,
        phone: true,
        isActive: true,
        updatedAt: true
      }
    });

    console.log('✅ Tour guide updated:', guide.login);

    res.json({
      success: true,
      data: guide,
      message: 'Тургид обновлён'
    });

  } catch (error) {
    console.error('❌ Error updating tour guide:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Назначить тургида на тур
export const assignGuideToTour = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tourId, guideId, scheduledStartDate, scheduledEndDate, uniqueCode } = req.body;

    if (!tourId || !guideId) {
      res.status(400).json({
        success: false,
        message: 'ID тура и тургида обязательны'
      });
      return;
    }

    // Get guide data including email
    const guide = await prisma.tourGuideProfile.findUnique({
      where: { id: parseInt(guideId) },
      select: {
        id: true,
        name: true,
        login: true,
        email: true
      }
    });

    if (!guide) {
      res.status(404).json({
        success: false,
        message: 'Тургид не найден'
      });
      return;
    }

    const updateData: any = {
      assignedGuideId: guideId
    };

    const parsedStartDate = scheduledStartDate ? new Date(scheduledStartDate) : undefined;
    const parsedEndDate = scheduledEndDate ? new Date(scheduledEndDate) : undefined;

    if (parsedStartDate) updateData.scheduledStartDate = parsedStartDate;
    if (parsedEndDate) updateData.scheduledEndDate = parsedEndDate;
    if (uniqueCode) updateData.uniqueCode = uniqueCode;

    const tour = await prisma.tour.update({
      where: { id: parseInt(tourId) },
      data: updateData,
      include: {
        assignedGuide: {
          select: {
            id: true,
            name: true,
            login: true
          }
        }
      }
    });

    console.log(`✅ Guide ${guideId} assigned to tour ${tourId}`);

    // Send email notification to guide (async, don't wait)
    if (guide.email) {
      const tourTitle = typeof tour.title === 'object' && tour.title !== null
        ? ((tour.title as any).ru || (tour.title as any).en || 'Тур')
        : String(tour.title || 'Тур');
      
      sendGuideAssignmentNotification(
        guide.email,
        guide.name,
        tourTitle,
        tour.id,
        parsedStartDate,
        parsedEndDate
      ).catch(err => console.error('Failed to send guide assignment email:', err));
      
      console.log(`📧 Sending tour assignment notification to ${guide.email}`);
    } else {
      console.log(`⚠️ Guide ${guide.name} has no email, skipping notification`);
    }

    res.json({
      success: true,
      data: tour,
      message: 'Тургид назначен на тур'
    });

  } catch (error) {
    console.error('❌ Error assigning guide to tour:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Получить оплаченные бронирования для мониторинга
export const getPaidBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, hasGuide } = req.query;
    
    const whereClause: any = {
      status: { in: ['paid', 'confirmed'] }
    };
    
    // Фильтр по наличию гида
    if (hasGuide === 'true') {
      whereClause.assignedGuideId = { not: null };
    } else if (hasGuide === 'false') {
      whereClause.assignedGuideId = null;
    }
    
    // Фильтр по статусу выполнения
    if (status && ['pending', 'in_progress', 'completed'].includes(status as string)) {
      whereClause.executionStatus = status;
    }
    
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        tour: {
          include: {
            tourMapPoints: true
          }
        },
        assignedGuide: {
          select: {
            id: true,
            name: true,
            contact: true,
            login: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            paymentStatus: true,
            paymentMethod: true,
            customer: {
              select: {
                fullName: true,
                email: true,
                phone: true
              }
            }
          }
        }
      },
      orderBy: [
        { tourDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: bookings
    });

  } catch (error) {
    console.error('❌ Error fetching paid bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Назначить гида на бронирование
export const assignGuideToBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, guideId } = req.body;

    if (!bookingId || !guideId) {
      res.status(400).json({
        success: false,
        message: 'ID бронирования и гида обязательны'
      });
      return;
    }

    // Получить данные гида из основной таблицы Guide
    const guide = await prisma.guide.findUnique({
      where: { id: parseInt(guideId) },
      select: {
        id: true,
        name: true,
        contact: true,
        login: true
      }
    });

    if (!guide) {
      res.status(404).json({
        success: false,
        message: 'Тургид не найден'
      });
      return;
    }

    // Извлечь имя и email из данных гида
    const guideName = typeof guide.name === 'object' ? (guide.name as any).ru || (guide.name as any).en || 'Гид' : String(guide.name);
    const guideEmail = guide.contact || null; // contact может содержать email или телефон

    // Получить бронирование с туром
    const existingBooking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        tour: {
          select: {
            id: true,
            title: true,
            duration: true
          }
        }
      }
    });

    if (!existingBooking) {
      res.status(404).json({
        success: false,
        message: 'Бронирование не найдено'
      });
      return;
    }

    // Обновить бронирование
    const booking = await prisma.booking.update({
      where: { id: parseInt(bookingId) },
      data: {
        assignedGuideId: parseInt(guideId),
        guideAssignedAt: new Date()
      },
      include: {
        tour: {
          select: {
            id: true,
            title: true,
            duration: true
          }
        },
        assignedGuide: {
          select: {
            id: true,
            name: true,
            contact: true,
            login: true
          }
        }
      }
    });

    console.log(`✅ Guide ${guideId} assigned to booking ${bookingId}`);

    // Отправить email гиду (если contact содержит email)
    const isEmailAddress = guideEmail && guideEmail.includes('@');
    if (isEmailAddress) {
      const tourTitle = typeof booking.tour.title === 'object' && booking.tour.title !== null
        ? ((booking.tour.title as any).ru || (booking.tour.title as any).en || 'Тур')
        : String(booking.tour.title || 'Тур');
      
      // Парсим туристов для получения количества
      let touristCount = booking.numberOfTourists;
      let touristNames: string[] = [];
      try {
        const tourists = JSON.parse(booking.tourists);
        if (Array.isArray(tourists)) {
          touristNames = tourists.map((t: any) => t.fullName || t.name || 'Турист');
        }
      } catch (e) {
        // Игнорируем ошибку парсинга
      }

      sendGuideBookingAssignmentNotification(
        guideEmail!,
        guideName,
        tourTitle,
        booking.id,
        booking.tourDate,
        touristCount,
        touristNames,
        booking.contactName || '',
        booking.contactPhone || '',
        booking.contactEmail || ''
      ).catch(err => console.error('Failed to send guide booking assignment email:', err));
      
      console.log(`📧 Sending booking assignment notification to ${guideEmail}`);
    } else {
      console.log(`⚠️ Guide ${guideName} has no email in contact field, skipping notification`);
    }

    res.json({
      success: true,
      data: booking,
      message: 'Гид назначен на бронирование'
    });

  } catch (error) {
    console.error('❌ Error assigning guide to booking:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Изменить статус выполнения бронирования
export const updateBookingExecutionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { executionStatus } = req.body;
    const bookingId = parseInt(id);

    if (!bookingId) {
      res.status(400).json({
        success: false,
        message: 'ID бронирования обязателен'
      });
      return;
    }

    const validStatuses = ['pending', 'in_progress', 'completed'];
    if (!validStatuses.includes(executionStatus)) {
      res.status(400).json({
        success: false,
        message: 'Недопустимый статус. Допустимые: pending, in_progress, completed'
      });
      return;
    }

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { executionStatus },
      include: {
        tour: {
          select: {
            id: true,
            title: true
          }
        },
        assignedGuide: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const statusLabels: Record<string, string> = {
      'pending': 'Ожидает',
      'in_progress': 'В процессе',
      'completed': 'Завершён'
    };

    console.log(`✅ Booking ${bookingId} execution status changed to: ${executionStatus}`);

    res.json({
      success: true,
      data: booking,
      message: `Статус изменён на "${statusLabels[executionStatus]}"`
    });

  } catch (error) {
    console.error('❌ Error updating booking execution status:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Собрать отзывы для бронирования (отправить email туристам)
export const collectBookingReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);

    if (!bookingId) {
      res.status(400).json({
        success: false,
        message: 'ID бронирования обязателен'
      });
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tour: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!booking) {
      res.status(404).json({
        success: false,
        message: 'Бронирование не найдено'
      });
      return;
    }

    if (booking.executionStatus !== 'completed') {
      res.status(400).json({
        success: false,
        message: 'Тур ещё не завершён'
      });
      return;
    }

    // Парсим туристов
    let tourists: any[] = [];
    try {
      tourists = JSON.parse(booking.tourists);
    } catch (e) {
      tourists = [];
    }

    const touristsWithEmail = tourists.filter((t: any) => t.email);

    if (touristsWithEmail.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Нет email адресов туристов'
      });
      return;
    }

    // Получить название тура
    const tourTitle = typeof booking.tour.title === 'object'
      ? ((booking.tour.title as any).ru || (booking.tour.title as any).en || 'Тур')
      : String(booking.tour.title || 'Тур');

    // Отправляем email каждому туристу
    let sentCount = 0;
    const domain = process.env.DOMAIN || 'bunyod-tour.tj';
    
    for (const tourist of touristsWithEmail) {
      try {
        // Формируем ссылку на форму отзыва
        const reviewLink = `https://${domain}/review-form.html?tourId=${booking.tourId}&bookingId=${booking.id}&email=${encodeURIComponent(tourist.email)}`;
        
        // Отправка email (используем sendReviewRequestEmail если есть)
        const sgMail = require('@sendgrid/mail');
        if (process.env.SENDGRID_API_KEY) {
          sgMail.setApiKey(process.env.SENDGRID_API_KEY);
          
          await sgMail.send({
            to: tourist.email,
            from: process.env.SENDGRID_FROM_EMAIL || 'info@bunyod-tour.tj',
            subject: `Поделитесь впечатлениями о туре "${tourTitle}"`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2F2F2F;">Здравствуйте, ${tourist.fullName || tourist.name || 'дорогой турист'}!</h2>
                <p>Благодарим вас за то, что выбрали Bunyod-Tour для вашего путешествия!</p>
                <p>Мы надеемся, что тур <strong>"${tourTitle}"</strong> оставил у вас приятные впечатления.</p>
                <p>Пожалуйста, поделитесь своим отзывом - это поможет нам стать лучше и поможет другим путешественникам сделать правильный выбор.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${reviewLink}" style="background-color: #3E3E3E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Оставить отзыв
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">С уважением,<br>Команда Bunyod-Tour</p>
              </div>
            `
          });
          sentCount++;
        }
      } catch (emailError) {
        console.error(`Failed to send review request to ${tourist.email}:`, emailError);
      }
    }

    console.log(`✅ Sent ${sentCount} review requests for booking ${bookingId}`);

    res.json({
      success: true,
      sentCount,
      message: `Запросы на отзыв отправлены ${sentCount} туристам`
    });

  } catch (error) {
    console.error('❌ Error collecting booking reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Получить бронирования для кабинета гида
export const getGuideBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { guideId } = req.params;
    const { status } = req.query;

    if (!guideId) {
      res.status(400).json({
        success: false,
        message: 'ID гида обязателен'
      });
      return;
    }

    const whereClause: any = {
      assignedGuideId: parseInt(guideId),
      status: { in: ['paid', 'confirmed'] }
    };

    // Фильтр по статусу выполнения
    if (status && ['pending', 'in_progress', 'completed'].includes(status as string)) {
      whereClause.executionStatus = status;
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        tour: {
          select: {
            id: true,
            title: true,
            uniqueCode: true,
            duration: true,
            description: true
          }
        }
      },
      orderBy: [
        { executionStatus: 'asc' },
        { tourDate: 'asc' }
      ]
    });

    // Группируем по дате
    const grouped: Record<string, typeof bookings> = {};
    for (const booking of bookings) {
      const date = booking.tourDate || 'Без даты';
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(booking);
    }

    res.json({
      success: true,
      data: bookings,
      grouped
    });

  } catch (error) {
    console.error('❌ Error fetching guide bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Удалить тургида
export const deleteTourGuide = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const guideId = parseInt(id);

    if (!guideId) {
      res.status(400).json({
        success: false,
        message: 'ID тургида обязателен'
      });
      return;
    }

    // Проверить, есть ли активные туры у тургида
    const activeTours = await prisma.tour.count({
      where: {
        assignedGuideId: guideId,
        status: { in: ['pending', 'active'] }
      }
    });

    if (activeTours > 0) {
      res.status(400).json({
        success: false,
        message: `Нельзя удалить тургида с ${activeTours} активными турами`
      });
      return;
    }

    await prisma.tourGuideProfile.delete({
      where: { id: guideId }
    });

    console.log(`🗑️ Tour guide ${guideId} deleted`);

    res.json({
      success: true,
      message: 'Тургид удалён'
    });

  } catch (error) {
    console.error('❌ Error deleting tour guide:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};