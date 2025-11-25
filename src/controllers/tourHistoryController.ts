import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { sendEmail } from '../services/emailService';

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

    // 📧 Отправить email гиду с учетными данными
    if (email && email.includes('@')) {
      try {
        await sendEmail({
          to: email,
          subject: '🎉 Добро пожаловать в Bunyod-Tour!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0;">🌟 Добро пожаловать в команду Bunyod-Tour!</h1>
              </div>
              
              <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px;">Здравствуйте, <strong>${name}</strong>!</p>
                <p>Вы успешно добавлены в нашу платформу в качестве тургида.</p>
                
                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #2e7d32;">🔑 Ваши данные для входа:</h3>
                  <p><strong>Логин:</strong> ${login}</p>
                  <p><strong>Временный пароль:</strong> ${password}</p>
                  <p style="font-size: 13px; color: #666; margin-top: 10px;">⚠️ Рекомендуем сменить пароль после первого входа</p>
                </div>

                <div style="text-align: center; margin: 25px 0;">
                  <a href="${process.env.FRONTEND_URL || 'https://bunyodtour.tj'}/guide-login.html" 
                     style="display: inline-block; background: #667eea; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    🔐 Войти в личный кабинет
                  </a>
                </div>

                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  Если у вас есть вопросы, свяжитесь с нами:<br>
                  📧 Email: ${process.env.ADMIN_EMAIL || 'info@bunyodtour.tj'}<br>
                  🌐 Сайт: ${process.env.FRONTEND_URL || 'https://bunyodtour.tj'}
                </p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="text-align: center; color: #999; font-size: 12px;">
                  © ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.
                </p>
              </div>
            </div>
          `
        });
        console.log(`📧 Email с учетными данными отправлен гиду: ${email}`);
      } catch (emailError) {
        console.error('⚠️ Не удалось отправить email гиду:', emailError);
      }

      // Уведомление админу
      try {
        await sendEmail({
          to: process.env.ADMIN_EMAIL || 'admin@bunyodtour.tj',
          subject: `✨ Новый тургид добавлен: ${name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #3E3E3E; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h2 style="margin: 0;">✨ Новый тургид добавлен!</h2>
              </div>
              <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
                <p><strong>Имя:</strong> ${name}</p>
                <p><strong>Логин:</strong> ${login}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Телефон:</strong> ${phone || 'Не указан'}</p>
                <p><strong>Дата создания:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                <div style="text-align: center; margin-top: 20px;">
                  <a href="${process.env.FRONTEND_URL || 'https://bunyodtour.tj'}/admin-dashboard.html" 
                     style="display: inline-block; background: #3E3E3E; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                    Открыть админ панель
                  </a>
                </div>
              </div>
            </div>
          `
        });
        console.log('📧 Уведомление админу о новом гиде отправлено');
      } catch (adminEmailError) {
        console.error('⚠️ Не удалось отправить уведомление админу:', adminEmailError);
      }
    }

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

// Получить список всех тургидов
export const getAllTourGuides = async (req: Request, res: Response): Promise<void> => {
  try {
    const guides = await prisma.tourGuideProfile.findMany({
      select: {
        id: true,
        name: true,
        login: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 Found ${guides.length} tour guides`);

    res.json({
      success: true,
      data: guides
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

    const updateData: any = {
      assignedGuideId: guideId
    };

    if (scheduledStartDate) updateData.scheduledStartDate = new Date(scheduledStartDate);
    if (scheduledEndDate) updateData.scheduledEndDate = new Date(scheduledEndDate);
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