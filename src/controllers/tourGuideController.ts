import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { parseMultilingualField } from '../utils/multilingual';
import prisma from '../config/database';
// JWT_SECRET is validated at server startup - will never be undefined here
const JWT_SECRET = process.env.JWT_SECRET!;

// Конфигурация multer для загрузки файлов
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'guides');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Разрешенные типы файлов
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', // Для аватаров
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // Для документов
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый тип файла. Разрешены: JPG, PNG, WEBP, PDF, DOC, DOCX'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB лимит
  }
});

// Авторизация тургида
export const loginTourGuide = async (req: Request, res: Response): Promise<void> => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      res.status(400).json({ 
        success: false, 
        message: 'Логин и пароль обязательны' 
      });
      return;
    }

    // Найти тургида по логину (используем таблицу guide)
    const guide = await prisma.guide.findFirst({
      where: { login },
      select: {
        id: true,
        name: true,
        login: true,
        password: true,
        contact: true,
        isActive: true
      }
    });

    if (!guide) {
      res.status(401).json({ 
        success: false, 
        message: 'Неверный логин или пароль' 
      });
      return;
    }

    if (!guide.isActive) {
      res.status(403).json({ 
        success: false, 
        message: 'Аккаунт деактивирован' 
      });
      return;
    }

    // ✅ БЕЗОПАСНАЯ проверка пароля с поддержкой обратной совместимости
    let validPassword = false;
    
    // Проверяем, что пароль не null
    if (!guide.password) {
      res.status(401).json({ 
        success: false, 
        message: 'Неверный логин или пароль' 
      });
      return;
    }
    
    try {
      // Сначала проверяем как хешированный пароль (новый безопасный способ)
      validPassword = await bcrypt.compare(password, guide.password);
    } catch (error) {
      // Если bcrypt.compare не сработал, это может быть старый нехешированный пароль
      // ВРЕМЕННАЯ поддержка для существующих гидов (постепенная миграция)
      console.warn('⚠️ Legacy password check for guide:', guide.login);
      validPassword = password === guide.password;
      
      // Если пароль совпал и это старый формат - обновим его на хешированный
      if (validPassword) {
        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          await prisma.guide.update({
            where: { id: guide.id },
            data: { password: hashedPassword }
          });
          console.log('✅ Password migrated to hash for guide:', guide.login);
        } catch (updateError) {
          console.error('❌ Failed to migrate password to hash:', updateError);
        }
      }
    }
    
    if (!validPassword) {
      res.status(401).json({ 
        success: false, 
        message: 'Неверный логин или пароль' 
      });
      return;
    }

    // Создать JWT токен
    const token = jwt.sign(
      { 
        id: guide.id, 
        login: guide.login, 
        name: guide.name,
        type: 'tour-guide'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('🔑 Tour guide login successful:', guide.login);

    res.json({
      success: true,
      token,
      guide: {
        id: guide.id,
        name: guide.name,
        login: guide.login,
        email: guide.contact ? (typeof guide.contact === 'string' ? JSON.parse(guide.contact).email : (guide.contact as any).email) : null,
        phone: guide.contact ? (typeof guide.contact === 'string' ? JSON.parse(guide.contact).phone : (guide.contact as any).phone) : null
      },
      message: 'Авторизация успешна'
    });

  } catch (error) {
    console.error('❌ Tour guide login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера' 
    });
  }
};

// Получить список туров для тургида
export const getGuideTours = async (req: Request, res: Response): Promise<void> => {
  try {
    const guideId = (req as any).user?.id;

    if (!guideId) {
      res.status(401).json({ 
        success: false, 
        message: 'Не авторизован' 
      });
      return;
    }

    const tours = await prisma.tour.findMany({
      where: { 
        isActive: true,
        OR: [
          { assignedGuideId: guideId },
          { 
            tourGuides: {
              some: {
                guideId: guideId
              }
            }
          }
        ]
      },
      include: {
        bookings: {
          where: { status: { in: ['paid', 'confirmed'] } }
        },
        category: true,
        tourBlockAssignments: {
          include: {
            tourBlock: true
          }
        },
        tourGuides: {
          where: { guideId: guideId },
          include: {
            guide: true
          }
        }
      },
      orderBy: {
        scheduledStartDate: 'asc'
      }
    });

    // Подсчитать количество туристов для каждого тура
    const toursWithStats = tours.map(tour => {
      const totalTourists = tour.bookings.reduce((sum, booking) => {
        return sum + booking.numberOfTourists;
      }, 0);

      return {
        id: tour.id,
        uniqueCode: tour.uniqueCode,
        title: tour.title,
        scheduledStartDate: tour.scheduledStartDate,
        scheduledEndDate: tour.scheduledEndDate,
        status: tour.status,
        currentDay: tour.currentDay,
        completedDays: tour.completedDays,
        totalDays: tour.totalDays,
        totalTourists,
        bookingsCount: tour.bookings.length,
        category: tour.category,
        tourBlock: tour.tourBlockAssignments?.[0]?.tourBlock || null
      };
    });

    console.log(`📋 Found ${tours.length} tours for guide ${guideId}`);

    res.json({
      success: true,
      data: toursWithStats
    });

  } catch (error) {
    console.error('❌ Error getting guide tours:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера' 
    });
  }
};

// Получить детали тура для тургида
export const getTourDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const guideId = (req as any).user?.id;
    const tourId = parseInt(id);

    if (!tourId) {
      res.status(400).json({ 
        success: false, 
        message: 'ID тура обязателен' 
      });
      return;
    }

    const tour = await prisma.tour.findFirst({
      where: { 
        id: tourId,
        isActive: true,
        OR: [
          { assignedGuideId: guideId },
          { 
            tourGuides: {
              some: {
                guideId: guideId
              }
            }
          }
        ]
      },
      include: {
        bookings: {
          where: { status: { in: ['paid', 'confirmed'] } },
          include: {
            tour: true,
            hotel: true
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
        },
        tourGuides: {
          include: {
            guide: true
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
    tour.bookings.forEach(booking => {
      if (booking.tourists) {
        try {
          const bookingTourists = JSON.parse(booking.tourists);
          bookingTourists.forEach((tourist: any) => {
            tourists.push({
              ...tourist,
              bookingId: booking.id,
              contactEmail: booking.contactEmail,
              contactPhone: booking.contactPhone
            });
          });
        } catch (e) {
          console.warn('Error parsing tourists data:', e);
        }
      }
    });

    const tourDetails = {
      id: tour.id,
      uniqueCode: tour.uniqueCode,
      title: tour.title,
      description: tour.description,
      itinerary: tour.itinerary,
      scheduledStartDate: tour.scheduledStartDate,
      scheduledEndDate: tour.scheduledEndDate,
      status: tour.status,
      currentDay: tour.currentDay,
      completedDays: tour.completedDays,
      totalDays: tour.totalDays,
      durationDays: tour.durationDays,
      bookings: tour.bookings,
      tourists: tourists,
      totalTourists: tourists.length,
      category: tour.category,
      tourBlock: tour.tourBlockAssignments?.[0]?.tourBlock || null,
      reviews: tour.reviews
    };

    res.json({
      success: true,
      data: tourDetails
    });

  } catch (error) {
    console.error('❌ Error getting tour details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера' 
    });
  }
};

// Начать тур
export const startTour = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const guideId = (req as any).user?.id;
    const tourId = parseInt(id);

    // Проверяем что тур назначен этому гиду (через assignedGuideId ИЛИ tourGuides)
    const tour = await prisma.tour.findFirst({
      where: { 
        id: tourId,
        isActive: true,
        OR: [
          { assignedGuideId: guideId },
          { 
            tourGuides: {
              some: {
                guideId: guideId
              }
            }
          }
        ]
      }
    });

    if (!tour) {
      res.status(404).json({ 
        success: false, 
        message: 'Тур не найден или не назначен вам' 
      });
      return;
    }

    // Проверяем что тур в статусе pending
    if (tour.status !== 'pending') {
      res.status(400).json({ 
        success: false, 
        message: `Тур уже ${tour.status === 'active' ? 'начат' : 'завершён'}` 
      });
      return;
    }

    // Определяем общее количество дней тура
    let totalDays = tour.totalDays || tour.durationDays || 1;
    
    // Если есть itinerary, пытаемся определить количество дней из него
    if (tour.itinerary && !tour.totalDays) {
      try {
        const itinerary = typeof tour.itinerary === 'string' ? JSON.parse(tour.itinerary) : tour.itinerary;
        const itineraryArray = Array.isArray(itinerary) ? itinerary : (itinerary.days || []);
        if (itineraryArray.length > 0) {
          const maxDay = Math.max(...itineraryArray.map((item: any) => item.day || 1));
          totalDays = Math.max(totalDays, maxDay);
        }
      } catch (e) {
        console.log('Could not parse itinerary for day count');
      }
    }

    const updatedTour = await prisma.tour.update({
      where: { id: tourId },
      data: { 
        status: 'active',
        currentDay: 1,
        completedDays: [],
        totalDays: totalDays
      }
    });

    console.log(`🚀 Tour ${tourId} started by guide ${guideId}, totalDays: ${totalDays}`);

    res.json({
      success: true,
      data: updatedTour,
      message: 'Тур начат'
    });

  } catch (error) {
    console.error('❌ Error starting tour:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера' 
    });
  }
};

// Завершить тур
export const finishTour = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const guideId = (req as any).user?.id;
    const tourId = parseInt(id);

    // Проверяем что тур назначен этому гиду (через assignedGuideId ИЛИ tourGuides)
    const tour = await prisma.tour.findFirst({
      where: { 
        id: tourId,
        isActive: true,
        OR: [
          { assignedGuideId: guideId },
          { 
            tourGuides: {
              some: {
                guideId: guideId
              }
            }
          }
        ]
      }
    });

    if (!tour) {
      res.status(404).json({ 
        success: false, 
        message: 'Тур не найден или не назначен вам' 
      });
      return;
    }

    // Проверяем что тур в статусе active
    if (tour.status !== 'active') {
      res.status(400).json({ 
        success: false, 
        message: `Тур ${tour.status === 'pending' ? 'еще не начат' : 'уже завершён'}` 
      });
      return;
    }

    // Определяем логику завершения: по дням или целиком
    const totalDays = tour.totalDays || 1;
    const currentDay = tour.currentDay || 1;
    const completedDays = tour.completedDays || [];
    
    let newStatus = tour.status;
    let newCurrentDay = currentDay;
    let newCompletedDays = [...completedDays];
    let message = '';

    if (totalDays === 1) {
      // Однодневный тур - завершаем сразу
      newStatus = 'finished';
      newCompletedDays = [1];
      message = 'Тур завершён';
      console.log(`✅ Single-day tour ${tourId} finished by guide ${guideId}`);
    } else {
      // Многодневный тур - завершаем текущий день
      if (!newCompletedDays.includes(currentDay)) {
        newCompletedDays.push(currentDay);
        newCompletedDays.sort((a, b) => a - b);
      }
      
      // Проверяем, все ли дни завершены
      if (newCompletedDays.length >= totalDays) {
        newStatus = 'finished';
        message = `Тур полностью завершён (${totalDays} дней)`;
        console.log(`✅ Multi-day tour ${tourId} fully completed by guide ${guideId}`);
      } else {
        newCurrentDay = currentDay + 1;
        newStatus = 'active'; // Остаемся активными
        message = `День ${currentDay} завершён. Текущий день: ${newCurrentDay} из ${totalDays}`;
        console.log(`✅ Day ${currentDay} of tour ${tourId} finished by guide ${guideId}`);
      }
    }

    const updatedTour = await prisma.tour.update({
      where: { id: tourId },
      data: { 
        status: newStatus,
        currentDay: newCurrentDay,
        completedDays: newCompletedDays
      }
    });

    res.json({
      success: true,
      data: updatedTour,
      message: message
    });

  } catch (error) {
    console.error('❌ Error finishing tour:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера' 
    });
  }
};

// Собрать отзывы (отправить email туристам)
export const collectReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { selectedTourists } = req.body;
    const guideId = (req as any).user?.id;
    const tourId = parseInt(id);

    if (!selectedTourists || !Array.isArray(selectedTourists)) {
      res.status(400).json({ 
        success: false, 
        message: 'Список туристов обязателен' 
      });
      return;
    }

    const tour = await prisma.tour.findFirst({
      where: { 
        id: tourId,
        assignedGuideId: guideId,
        status: 'finished'
      }
    });

    if (!tour) {
      res.status(404).json({ 
        success: false, 
        message: 'Тур не найден или не завершён' 
      });
      return;
    }

    // Настройка nodemailer (заглушка для демонстрации)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    let emailsSent = 0;

    // Отправить email каждому выбранному туристу
    for (const tourist of selectedTourists) {
      if (tourist.email) {
        try {
          const reviewLink = `${process.env.FRONTEND_URL}/review/${tourId}?tourist=${encodeURIComponent(tourist.email)}`;
          
          await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: tourist.email,
            subject: 'Оставьте отзыв о туре',
            html: `
              <h2>Здравствуйте, ${tourist.name}!</h2>
              <p>Благодарим вас за участие в туре "${parseMultilingualField(tour.title, 'ru')}".</p>
              <p>Мы будем благодарны, если вы поделитесь своими впечатлениями:</p>
              <a href="${reviewLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Оставить отзыв</a>
            `
          });
          
          emailsSent++;
        } catch (emailError) {
          console.warn('Failed to send email to:', tourist.email, emailError);
        }
      }
    }

    console.log(`📧 Sent ${emailsSent} review request emails for tour ${tourId}`);

    res.json({
      success: true,
      emailsSent,
      message: `Отправлено ${emailsSent} писем с просьбой оставить отзыв`
    });

  } catch (error) {
    console.error('❌ Error collecting reviews:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера' 
    });
  }
};


// Создание нового тургида с аутентификацией (для админ панели)
export const createTourGuideProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, login, password, email, phone, languages, experience, isActive, countryId, cityId, passportSeries, registration, residenceAddress } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    console.log('📝 Получен запрос на создание гида');
    console.log('📁 Получены файлы:', files);

    if (!name || !email || !languages) {
      res.status(400).json({ 
        success: false, 
        message: 'Имя, email и языки обязательны' 
      });
      return;
    }

    // Проверяем пароль и хешируем для безопасности
    if (!password || !password.trim()) {
      res.status(400).json({ 
        success: false, 
        message: 'Пароль обязателен для создания аккаунта гида' 
      });
      return;
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password.trim(), saltRounds);

    // Парсим languages из JSON массива
    let languagesArray: string[];
    try {
      languagesArray = typeof languages === 'string' ? JSON.parse(languages) : languages;
    } catch (error) {
      languagesArray = typeof languages === 'string' ? [languages] : [];
    }

    // Конвертируем isActive в boolean
    const isActiveBoolean = isActive === 'true' || isActive === true;

    // Обрабатываем загруженный аватар
    let photoPath = null;
    if (files && files.avatar && files.avatar[0]) {
      // Преобразуем абсолютный путь в относительный для веба
      const fullPath = files.avatar[0].path;
      photoPath = fullPath.replace('/home/runner/workspace', '');
      console.log('📷 Аватар сохранен:', photoPath);
    }

    // Обрабатываем загруженные документы
    let documentsArray: Array<{
      filename: string;
      originalName: string;
      path: string;
      size: number;
      mimeType: string;
    }> = [];
    if (files && files.documents && files.documents.length > 0) {
      documentsArray = files.documents.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path.replace('/home/runner/workspace', ''), // Преобразуем в относительный путь
        size: file.size,
        mimeType: file.mimetype
      }));
      console.log('📄 Документы сохранены:', documentsArray.length);
    }

    // ИСПРАВЛЕНО: Создаем в таблице Guide вместо TourGuideProfile
    const guide = await prisma.guide.create({
      data: {
        name: name, // Сохраняем как простую строку, а не JSON
        description: description || 'Профессиональный гид',
        languages: languagesArray.join(', '), // Используем обработанный массив языков
        contact: JSON.stringify({ email, phone }), // Контакты в JSON
        experience: experience ? parseInt(experience) : 0,
        rating: 5.0, // Начальный рейтинг
        login: login, // Добавляем логин
        password: hashedPassword, // ✅ БЕЗОПАСНО: Храним хешированный пароль
        isActive: isActiveBoolean, // Используем обработанный boolean
        photo: photoPath, // Путь к аватару
        documents: documentsArray.length > 0 ? JSON.stringify(documentsArray) : null, // Документы в JSON
        countryId: countryId ? parseInt(countryId) : null, // Добавляем страну
        cityId: cityId ? parseInt(cityId) : null, // Добавляем город
        passportSeries: passportSeries || null, // Серия паспорта
        registration: registration || null, // Гос. регистрация
        residenceAddress: residenceAddress || null // Адрес проживания
      }
    });

    console.log('✅ Новый гид создан в таблице Guide:', guide.id);

    res.status(201).json({
      success: true,
      data: {
        id: guide.id,
        name: guide.name,
        description: guide.description,
        languages: guide.languages,
        contact: guide.contact,
        experience: guide.experience,
        rating: guide.rating,
        isActive: guide.isActive,
        photo: guide.photo,
        documents: guide.documents
      },
      message: 'Гид успешно создан с загруженными файлами'
    });

  } catch (error) {
    console.error('❌ Ошибка создания гида:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
};

// Обновление профиля гида с поддержкой файлов
export const updateGuideProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, email, phone, languages, experience, isActive } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const guideId = parseInt(id);

    console.log('📝 Получены данные для обновления гида:', req.body);
    console.log('📁 Получены файлы:', files);

    if (!guideId) {
      res.status(400).json({ 
        success: false, 
        message: 'ID гида обязателен' 
      });
      return;
    }

    // Найти существующего гида
    const existingGuide = await prisma.guide.findUnique({
      where: { id: guideId }
    });

    if (!existingGuide) {
      res.status(404).json({ 
        success: false, 
        message: 'Гид не найден' 
      });
      return;
    }

    const updateData: any = {};
    
    if (name) updateData.name = name;
    if (description) {
      // Правильно обрабатываем мультиязычное описание
      if (typeof description === 'object' && description !== null) {
        // Если это объект с языками, сохраняем как JSON
        updateData.description = JSON.stringify(description);
      } else if (typeof description === 'string') {
        // Проверяем, может ли это быть JSON-строкой
        try {
          const parsedDesc = JSON.parse(description);
          if (typeof parsedDesc === 'object' && parsedDesc !== null) {
            // Это валидный JSON объект, сохраняем как есть
            updateData.description = description;
          } else {
            // Это обычная строка, сохраняем как есть
            updateData.description = description;
          }
        } catch {
          // Это не JSON, сохраняем как обычную строку
          updateData.description = description;
        }
      }
    }
    if (languages) updateData.languages = languages;
    if (experience !== undefined) updateData.experience = parseInt(experience);
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    
    // Обновляем контакты
    if (email || phone) {
      const currentContact = existingGuide.contact ? JSON.parse(existingGuide.contact) : {};
      updateData.contact = JSON.stringify({
        email: email || currentContact.email,
        phone: phone || currentContact.phone
      });
    }

    // Обрабатываем загруженный аватар
    if (files && files.avatar && files.avatar[0]) {
      // Преобразуем абсолютный путь в относительный для веба
      const fullPath = files.avatar[0].path;
      updateData.photo = fullPath.replace('/home/runner/workspace', '');
      console.log('📷 Аватар обновлен:', updateData.photo);
    }

    // Обрабатываем загруженные документы
    if (files && files.documents && files.documents.length > 0) {
      const documentsArray = files.documents.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path.replace('/home/runner/workspace', ''), // Преобразуем в относительный путь
        size: file.size,
        mimeType: file.mimetype
      }));
      
      // Сохраняем новые документы, добавляя к существующим
      let existingDocuments = [];
      try {
        existingDocuments = existingGuide.documents ? JSON.parse(existingGuide.documents) : [];
      } catch (e) {
        existingDocuments = [];
      }
      
      const allDocuments = [...existingDocuments, ...documentsArray];
      updateData.documents = JSON.stringify(allDocuments);
      console.log('📄 Документы обновлены, всего:', allDocuments.length);
    }

    const updatedGuide = await prisma.guide.update({
      where: { id: guideId },
      data: updateData
    });

    console.log('✅ Профиль гида обновлен:', guideId);

    res.json({
      success: true,
      data: {
        id: updatedGuide.id,
        name: updatedGuide.name,
        description: updatedGuide.description,
        languages: updatedGuide.languages,
        contact: updatedGuide.contact,
        experience: updatedGuide.experience,
        isActive: updatedGuide.isActive,
        photo: updatedGuide.photo,
        documents: updatedGuide.documents
      },
      message: 'Профиль гида успешно обновлен с файлами'
    });

  } catch (error) {
    console.error('❌ Ошибка обновления гида:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
};

// Загрузка аватара для гида
export const uploadGuideAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const guideId = parseInt(id);

    if (!guideId) {
      res.status(400).json({ 
        success: false, 
        message: 'ID гида обязателен' 
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ 
        success: false, 
        message: 'Файл аватара не загружен' 
      });
      return;
    }

    const avatarPath = `/uploads/guides/${req.file.filename}`;

    // Обновляем путь к аватару в базе данных
    const updatedGuide = await prisma.guide.update({
      where: { id: guideId },
      data: { avatar: avatarPath }
    });

    console.log('✅ Аватар гида обновлен:', guideId, avatarPath);

    res.json({
      success: true,
      data: {
        avatarPath,
        guide: updatedGuide
      },
      message: 'Аватар успешно загружен'
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки аватара:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка загрузки аватара: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
};

// Загрузка документов для гида
export const uploadGuideDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const guideId = parseInt(id);

    if (!guideId) {
      res.status(400).json({ 
        success: false, 
        message: 'ID гида обязателен' 
      });
      return;
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ 
        success: false, 
        message: 'Документы не загружены' 
      });
      return;
    }

    // Получаем текущие документы
    const existingGuide = await prisma.guide.findUnique({
      where: { id: guideId }
    });

    let existingDocuments = [];
    if (existingGuide?.documents) {
      try {
        existingDocuments = JSON.parse(existingGuide.documents);
      } catch (e) {
        console.warn('Error parsing existing documents:', e);
      }
    }

    // Добавляем новые документы
    const newDocuments = req.files.map((file: Express.Multer.File) => ({
      name: file.originalname,
      path: `/uploads/guides/${file.filename}`,
      type: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }));

    const allDocuments = [...existingDocuments, ...newDocuments];

    // Обновляем документы в базе данных
    const updatedGuide = await prisma.guide.update({
      where: { id: guideId },
      data: { documents: JSON.stringify(allDocuments) }
    });

    console.log('✅ Документы гида загружены:', guideId, newDocuments.length);

    res.json({
      success: true,
      data: {
        documents: allDocuments,
        newDocuments,
        guide: updatedGuide
      },
      message: `Загружено ${newDocuments.length} документов`
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки документов:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка загрузки документов: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
};

// Удаление документа гида
export const deleteGuideDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { documentPath } = req.body;
    const guideId = parseInt(id);

    if (!guideId || !documentPath) {
      res.status(400).json({ 
        success: false, 
        message: 'ID гида и путь к документу обязательны' 
      });
      return;
    }

    // Получаем текущие документы
    const existingGuide = await prisma.guide.findUnique({
      where: { id: guideId }
    });

    if (!existingGuide) {
      res.status(404).json({ 
        success: false, 
        message: 'Гид не найден' 
      });
      return;
    }

    let documents = [];
    if (existingGuide.documents) {
      try {
        documents = JSON.parse(existingGuide.documents);
      } catch (e) {
        console.warn('Error parsing documents:', e);
      }
    }

    // Удаляем документ из списка
    const updatedDocuments = documents.filter((doc: any) => doc.path !== documentPath);

    // Обновляем в базе данных
    const updatedGuide = await prisma.guide.update({
      where: { id: guideId },
      data: { documents: JSON.stringify(updatedDocuments) }
    });

    // Пытаемся удалить файл с диска
    try {
      const fullPath = path.join(process.cwd(), documentPath);
      await fs.unlink(fullPath);
      console.log('✅ Файл удален с диска:', fullPath);
    } catch (fileError) {
      console.warn('⚠️ Не удалось удалить файл с диска:', fileError);
    }

    res.json({
      success: true,
      data: {
        documents: updatedDocuments,
        guide: updatedGuide
      },
      message: 'Документ успешно удален'
    });

  } catch (error) {
    console.error('❌ Ошибка удаления документа:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка удаления документа: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
};