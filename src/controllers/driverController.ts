import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import prisma from '../config/database';
import { emailService } from '../services/emailService';
// Конфигурация Multer для загрузки файлов водителей
const storage = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    cb(null, 'uploads/drivers/');
  },
  filename: function (req: any, file: any, cb: any) {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
export const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB максимум
  },
  fileFilter: function (req, file, cb) {
    // Разрешенные типы файлов для водителей
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});
// Типы транспорта по умолчанию
const DEFAULT_VEHICLE_TYPES = [
  'sedan',      // Легковой автомобиль
  'suv',        // Внедорожник
  'minibus',    // Минивэн
  'bus',        // Автобус
  'truck',      // Грузовик
  'motorcycle', // Мотоцикл
  'taxi'        // Такси
];
// Категории водительских прав
const LICENSE_CATEGORIES = [
  'A',  // Мотоциклы
  'B',  // Легковые автомобили
  'C',  // Грузовые автомобили
  'D',  // Автобусы
  'E',  // С прицепом
  'BE', // B с прицепом
  'CE', // C с прицепом
  'DE'  // D с прицепом
];
// Безопасный парсинг JSON
function safeJsonParse(jsonString: any, defaultValue: any = null) {
  if (!jsonString) return defaultValue;
  if (typeof jsonString === 'object') return jsonString;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('JSON parsing error:', error);
    return defaultValue;
  }
}
// Получение всех водителей для админ-панели
export const getAllDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeRaw = req.query.includeRaw === 'true';
    const drivers = await prisma.driver.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tourDrivers: {
          include: {
            tour: {
              select: { id: true, title: true }
            }
          }
        }
      }
    });
    const formattedDrivers = drivers.map((driver: any) => {
      // Деструктурируем для исключения чувствительных полей из публичного API
      const { password, contact, documents, login, licenseNumber, licenseCategory, tourDrivers, ...publicFields } = driver;
      const baseDriver = {
        ...publicFields,
        assignedTours: driver.tourDrivers.map((td: any) => td.tour)
      };
      return includeRaw ? {
        ...baseDriver,
        // Чувствительные данные только для админ панели
        contact: safeJsonParse(contact, {}),
        documents: safeJsonParse(documents, []),
        login: login,
        licenseNumber: licenseNumber,
        licenseCategory: licenseCategory
      } : {
        ...baseDriver
        // Публичная версия - чувствительные поля уже исключены деструктуризацией
      };
    });
    console.log(`📋 Found ${drivers.length} drivers`);
    res.json({
      success: true,
      data: formattedDrivers,
      message: 'Drivers retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error getting drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении водителей'
    });
  }
};
// Получение водителя по ID
export const getDriverById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const includeRaw = req.query.includeRaw === 'true';
    const driverId = parseInt(id);
    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'ID водителя обязателен'
      });
      return;
    }
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        tourDrivers: {
          include: {
            tour: {
              select: { id: true, title: true, status: true, scheduledStartDate: true }
            }
          }
        }
      }
    });
    if (!driver) {
      res.status(404).json({
        success: false,
        message: 'Водитель не найден'
      });
      return;
    }
    // Деструктурируем для исключения чувствительных полей из публичного API
    const { password, contact, documents, login, licenseNumber, licenseCategory, tourDrivers, ...publicFields } = driver;
    const baseDriver = {
      ...publicFields,
      assignedTours: driver.tourDrivers.map((td: any) => td.tour)
    };
    const formattedDriver = includeRaw ? {
      ...baseDriver,
      // Чувствительные данные только для админ панели
      contact: safeJsonParse(contact, {}),
      documents: safeJsonParse(documents, []),
      login: login,
      licenseNumber: licenseNumber,
      licenseCategory: licenseCategory
    } : {
      ...baseDriver
      // Публичная версия - чувствительные поля уже исключены деструктуризацией
    };
    res.json({
      success: true,
      data: formattedDriver,
      message: 'Driver retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error getting driver:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении водителя'
    });
  }
};
// Создание нового водителя (для админ-панели)
export const createDriverProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      name, 
      description, 
      login, 
      password, 
      email, 
      phone, 
      languages, 
      experience, 
      licenseNumber,
      licenseCategory,
      workingAreas,
      countryId,
      cityId,
      isActive 
    } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    console.log('📝 Получены данные для создания водителя:', req.body);
    console.log('📁 Получены файлы:', files);
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Имя обязательно'
      });
      return;
    }
    // Хешируем пароль для безопасности
    const saltRounds = 10;
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, saltRounds);
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
        path: file.path,
        size: file.size,
        mimeType: file.mimetype
      }));
      console.log('📄 Документы сохранены:', documentsArray.length);
    }
    // Создаем водителя
    const driver = await prisma.driver.create({
      data: {
        name: name,
        description: description || null,
        languages: languages || null,
        contact: (email || phone) ? JSON.stringify({ email, phone }) : null,
        email: email || null,
        phone: phone || null,
        experience: experience ? parseInt(experience) : null,
        login: login || null,
        password: hashedPassword,
        isActive: isActive === 'true' || isActive === true || isActive === undefined,
        documents: documentsArray.length > 0 ? JSON.stringify(documentsArray) : null,
        licenseNumber: licenseNumber || null,
        licenseCategory: licenseCategory || null,
        workingAreas: workingAreas || null,
        countryId: countryId ? parseInt(countryId) : null,
        cityId: cityId ? parseInt(cityId) : null
      },
      include: {
        vehicles: {
          select: {
            id: true,
            name: true,
            type: true,
            brand: true,
            licensePlate: true
          }
        }
      }
    });
    console.log('✅ Новый водитель создан:', driver.id);
    res.status(201).json({
      success: true,
      data: {
        id: driver.id,
        name: driver.name,
        description: driver.description,
        languages: driver.languages,
        email: driver.email,
        phone: driver.phone,
        experience: driver.experience,
        isActive: driver.isActive,
        documents: driver.documents,
        licenseNumber: driver.licenseNumber,
        licenseCategory: driver.licenseCategory,
        workingAreas: driver.workingAreas,
        vehicles: driver.vehicles
      },
      message: 'Водитель успешно создан'
    });
  } catch (error) {
    console.error('❌ Ошибка создания водителя:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
};
// Обновление профиля водителя
export const updateDriverProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      email, 
      phone, 
      languages, 
      experience, 
      licenseNumber,
      licenseCategory,
      workingAreas,
      countryId,
      cityId,
      isActive 
    } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const driverId = parseInt(id);
    console.log('📝 Получены данные для обновления водителя:', req.body);
    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'ID водителя обязателен'
      });
      return;
    }
    // Найти существующего водителя
    const existingDriver = await prisma.driver.findUnique({
      where: { id: driverId }
    });
    if (!existingDriver) {
      res.status(404).json({
        success: false,
        message: 'Водитель не найден'
      });
      return;
    }
    // ✅ Извлекаем login и password из req.body
    const { login, password } = req.body;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (languages !== undefined) updateData.languages = languages || null;
    if (experience !== undefined) updateData.experience = experience ? parseInt(experience) : null;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber || null;
    if (licenseCategory !== undefined) updateData.licenseCategory = licenseCategory || null;
    if (workingAreas !== undefined) updateData.workingAreas = workingAreas || null;
    if (email !== undefined) updateData.email = email || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (countryId !== undefined) updateData.countryId = countryId ? parseInt(countryId) : null;
    if (cityId !== undefined) updateData.cityId = cityId ? parseInt(cityId) : null;
    
    // ✅ FIX: Сохраняем login и password водителя
    if (login !== undefined) {
      updateData.login = login || null;
      console.log('📝 Updating driver login:', login);
    }
    if (password && password.trim()) {
      // Хешируем новый пароль
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password.trim(), saltRounds);
      console.log('🔐 Updating driver password (hashed)');
    }
    // Обновляем контакты (для обратной совместимости)
    if (email !== undefined || phone !== undefined) {
      const currentContact = existingDriver.contact ? safeJsonParse(existingDriver.contact, {}) : {};
      updateData.contact = JSON.stringify({
        email: email !== undefined ? email : currentContact.email,
        phone: phone !== undefined ? phone : currentContact.phone
      });
    }
    // Обрабатываем загруженные документы
    if (files && files.documents && files.documents.length > 0) {
      const documentsArray = files.documents.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype
      }));
      // Объединяем с существующими документами
      const existingDocs = existingDriver.documents ? safeJsonParse(existingDriver.documents, []) : [];
      updateData.documents = JSON.stringify([...existingDocs, ...documentsArray]);
    }
    // Обновляем водителя
    const updatedDriver = await prisma.driver.update({
      where: { id: driverId },
      data: updateData,
      include: {
        vehicles: {
          select: {
            id: true,
            name: true,
            type: true,
            brand: true,
            licensePlate: true
          }
        }
      }
    });
    console.log('✅ Водитель обновлён:', updatedDriver.id);
    res.json({
      success: true,
      data: updatedDriver,
      message: 'Водитель успешно обновлён'
    });
  } catch (error) {
    console.error('❌ Ошибка обновления водителя:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
};
export const deleteDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const driverId = parseInt(id);
    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'ID водителя обязателен'
      });
      return;
    }
    // Проверяем существование водителя
    const existingDriver = await prisma.driver.findUnique({
      where: { id: driverId }
    });
    if (!existingDriver) {
      res.status(404).json({
        success: false,
        message: 'Водитель не найден'
      });
      return;
    }
    // Удаляем водителя
    await prisma.driver.delete({
      where: { id: driverId }
    });
    console.log('🗑️ Водитель удален:', driverId);
    res.json({
      success: true,
      message: 'Водитель успешно удален'
    });
  } catch (error) {
    console.error('❌ Ошибка удаления водителя:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении водителя'
    });
  }
};
// Авторизация водителя
export const loginDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { login, password } = req.body;
    
    // Trim credentials to avoid whitespace issues
    const trimmedLogin = login?.trim();
    const trimmedPassword = password?.trim();
    
    if (!trimmedLogin || !trimmedPassword) {
      res.status(400).json({
        success: false,
        message: 'Логин и пароль обязательны'
      });
      return;
    }
    
    console.log(`🔐 Попытка входа водителя: ${trimmedLogin}`);
    
    // Ищем водителя по логину
    const driver = await prisma.driver.findFirst({
      where: { 
        login: trimmedLogin,
        isActive: true
      }
    });
    if (!driver) {
      res.status(401).json({
        success: false,
        message: 'Неверный логин или пароль'
      });
      return;
    }
    // Проверяем пароль
    if (!driver.password) {
      console.log(`⚠️ Водитель ${driver.name} не имеет пароля`);
      res.status(401).json({
        success: false,
        message: 'Пароль не установлен для этого водителя'
      });
      return;
    }
    
    console.log(`🔐 Проверка пароля для водителя ${driver.name} (id: ${driver.id})`);
    const isPasswordValid = await bcrypt.compare(trimmedPassword, driver.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Неверный логин или пароль'
      });
      return;
    }
    // Генерируем JWT токен
    const token = jwt.sign(
      { driverId: driver.id, login: driver.login },
      process.env.JWT_SECRET || 'driver-secret-key',
      { expiresIn: '7d' }
    );
    console.log(`🔐 Водитель ${driver.name} авторизовался`);
    res.json({
      success: true,
      data: {
        token,
        driver: {
          id: driver.id,
          name: driver.name,
          login: driver.login,
        }
      },
      message: 'Авторизация успешна'
    });
  } catch (error) {
    console.error('❌ Ошибка авторизации водителя:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при авторизации'
    });
  }
};
// Получение информации о доступных типах транспорта и категориях прав
export const getDriverOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        licenseCategories: LICENSE_CATEGORIES
      },
      message: 'Driver options retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error getting driver options:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения опций водителя'
    });
  }
};
// Получение назначенных событий водителя
export const getDriverAssignedEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const driverId = (req as any).driverId; // Из middleware
    if (!driverId) {
      res.status(401).json({
        success: false,
        message: 'ID водителя обязателен'
      });
      return;
    }
    // Получаем все туры с событиями, где назначен данный водитель
    const tours = await prisma.tour.findMany({
      where: {
        isActive: true,
        itinerary: {
          contains: `"driverId":${driverId}`
        }
      },
      select: {
        id: true,
        title: true,
        itinerary: true,
        startDate: true,
        endDate: true,
        status: true
      }
    });
    // Парсим события и фильтруем только те, где назначен данный водитель
    const assignedEvents: any[] = [];
    tours.forEach((tour: any) => {
      if (tour.itinerary) {
        try {
          const itinerary = JSON.parse(tour.itinerary);
          itinerary.forEach((event: any, index: number) => {
            if (event.driverId && parseInt(event.driverId) === driverId) {
              assignedEvents.push({
                id: `${tour.id}-${index}`, // Уникальный ID события
                tourId: tour.id,
                tourTitle: tour.title,
                eventIndex: index,
                time: event.time,
                title: event.title,
                description: event.description,
                status: event.status || 'pending', // pending, started, completed
                tourStatus: tour.status,
                startDate: tour.startDate,
                endDate: tour.endDate
              });
            }
          });
        } catch (e) {
          console.warn('Error parsing itinerary for tour', tour.id, e);
        }
      }
    });
    res.json({
      success: true,
      data: assignedEvents,
      message: 'Назначенные события получены успешно'
    });
  } catch (error) {
    console.error('❌ Error getting driver assigned events:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении назначенных событий'
    });
  }
};
// Запуск события водителем
export const startDriverEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const driverId = (req as any).driverId;
    const { eventId } = req.params; // Формат: tourId-eventIndex
    if (!driverId || !eventId) {
      res.status(400).json({
        success: false,
        message: 'Необходимы параметры driverId и eventId'
      });
      return;
    }
    const [tourId, eventIndex] = eventId.split('-');
    const tour = await prisma.tour.findUnique({
      where: { id: parseInt(tourId) }
    });
    if (!tour || !tour.itinerary) {
      res.status(404).json({
        success: false,
        message: 'Тур или программа не найдены'
      });
      return;
    }
    const itinerary = JSON.parse(tour.itinerary);
    const eventIdx = parseInt(eventIndex);
    if (eventIdx >= itinerary.length || itinerary[eventIdx].driverId !== driverId) {
      res.status(403).json({
        success: false,
        message: 'Событие не назначено данному водителю'
      });
      return;
    }
    // Обновляем статус события
    itinerary[eventIdx].status = 'started';
    itinerary[eventIdx].startedAt = new Date().toISOString();
    await prisma.tour.update({
      where: { id: parseInt(tourId) },
      data: { itinerary: JSON.stringify(itinerary) }
    });
    res.json({
      success: true,
      message: 'Событие запущено'
    });
  } catch (error) {
    console.error('❌ Error starting driver event:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при запуске события'
    });
  }
};
// Завершение события водителем
export const completeDriverEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const driverId = (req as any).driverId;
    const { eventId } = req.params;
    if (!driverId || !eventId) {
      res.status(400).json({
        success: false,
        message: 'Необходимы параметры driverId и eventId'
      });
      return;
    }
    const [tourId, eventIndex] = eventId.split('-');
    const tour = await prisma.tour.findUnique({
      where: { id: parseInt(tourId) }
    });
    if (!tour || !tour.itinerary) {
      res.status(404).json({
        success: false,
        message: 'Тур или программа не найдены'
      });
      return;
    }
    const itinerary = JSON.parse(tour.itinerary);
    const eventIdx = parseInt(eventIndex);
    if (eventIdx >= itinerary.length || itinerary[eventIdx].driverId !== driverId) {
      res.status(403).json({
        success: false,
        message: 'Событие не назначено данному водителю'
      });
      return;
    }
    // Обновляем статус события
    itinerary[eventIdx].status = 'completed';
    itinerary[eventIdx].completedAt = new Date().toISOString();
    await prisma.tour.update({
      where: { id: parseInt(tourId) },
      data: { itinerary: JSON.stringify(itinerary) }
    });
    res.json({
      success: true,
      message: 'Событие завершено'
    });
  } catch (error) {
    console.error('❌ Error completing driver event:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при завершении события'
    });
  }
};
// ========== ПОЛУЧЕНИЕ ЗАЯВОК НА ТРАНСФЕР ДЛЯ ВОДИТЕЛЯ ==========
// Возвращает все оплаченные заявки на трансфер, где выбрана машина, привязанная к водителю
export const getMyTransferRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Токен доступа отсутствует'
      });
      return;
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'driver-secret-key') as any;
    const driverId = decoded.driverId;
    if (!driverId) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }
    console.log(`📋 [DRIVER TRANSFERS] Fetching transfer requests for driver ID: ${driverId}`);
    // Получаем все машины, привязанные к этому водителю
    const driverVehicles = await prisma.vehicle.findMany({
      where: { driverId: driverId },
      select: { id: true }
    });
    const vehicleIds = driverVehicles.map(v => v.id);
    console.log(`📋 [DRIVER TRANSFERS] Driver ${driverId} has ${vehicleIds.length} linked vehicles: ${vehicleIds.join(', ')}`);
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    // Условие для поиска заявок: 
    // 1. Машина принадлежит водителю (vehicle.driverId) ИЛИ
    // 2. Водитель назначен напрямую на заявку (assignedDriverId)
    const whereCondition: any = {
      paymentStatus: 'paid', // Только оплаченные
      OR: [
        // Заявки где водитель назначен напрямую
        { assignedDriverId: driverId }
      ]
    };
    
    // Добавляем условие по vehicleId только если у водителя есть привязанные машины
    if (vehicleIds.length > 0) {
      whereCondition.OR.push({ vehicleId: { in: vehicleIds } });
    }
    
    // Получаем все оплаченные заявки на трансфер
    const [transfers, total] = await Promise.all([
      prisma.transferRequest.findMany({
        where: whereCondition,
        include: {
          vehicle: {
            select: {
              id: true,
              name: true,
              type: true,
              licensePlate: true,
              brand: true
            }
          },
          assignedDriver: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.transferRequest.count({
        where: whereCondition
      })
    ]);
    console.log(`📋 [DRIVER TRANSFERS] Found ${transfers.length} paid transfer requests for driver ${driverId} (via vehicle OR assignedDriver)`);
    // Форматируем название машины
    const formattedTransfers = transfers.map((transfer: any) => ({
      ...transfer,
      vehicle: transfer.vehicle ? {
        ...transfer.vehicle,
        name: typeof transfer.vehicle.name === 'object' 
          ? (transfer.vehicle.name.ru || transfer.vehicle.name.en || 'Машина')
          : transfer.vehicle.name
      } : null
    }));
    res.json({
      success: true,
      data: {
        transfers: formattedTransfers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error getting driver transfer requests:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении заявок на трансфер'
    });
  }
};
// ========== ОТВЕТ ВОДИТЕЛЯ НА ЗАЯВКУ (ПРИНЯТЬ/ОТКЛОНИТЬ) ==========
export const respondToTransferRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Токен доступа отсутствует'
      });
      return;
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'driver-secret-key') as any;
    const driverId = decoded.driverId;
    const { requestId } = req.params;
    const { response, note } = req.body; // response: 'accepted' | 'rejected'
    console.log(`📋 [DRIVER RESPONSE] Driver ${driverId} responding to transfer request ${requestId}: ${response}`);
    if (!driverId) {
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
    // Получаем машины водителя
    const driverVehicles = await prisma.vehicle.findMany({
      where: { driverId: driverId },
      select: { id: true }
    });
    const vehicleIds = driverVehicles.map(v => v.id);
    
    // Условие для проверки прав: водитель имеет право отвечать если:
    // 1. Машина принадлежит водителю (vehicle.driverId) ИЛИ
    // 2. Водитель назначен напрямую на заявку (assignedDriverId)
    const whereCondition: any = {
      id: parseInt(requestId),
      OR: [
        { assignedDriverId: driverId }
      ]
    };
    
    if (vehicleIds.length > 0) {
      whereCondition.OR.push({ vehicleId: { in: vehicleIds } });
    }
    
    // Проверяем что заявка существует и водитель имеет к ней доступ
    const transferRequest = await prisma.transferRequest.findFirst({
      where: whereCondition,
      include: {
        vehicle: {
          select: {
            id: true,
            name: true,
            type: true,
            brand: true
          }
        }
      }
    });
    if (!transferRequest) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена или у вас нет прав для ответа'
      });
      return;
    }
    // Проверяем что водитель еще не ответил
    if (transferRequest.driverResponse !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Вы уже ответили на эту заявку: ${transferRequest.driverResponse === 'accepted' ? 'принято' : 'отклонено'}`
      });
      return;
    }
    // Обновляем заявку с ответом водителя
    const updatedRequest = await prisma.transferRequest.update({
      where: { id: parseInt(requestId) },
      data: {
        driverResponse: response,
        driverResponseNote: note || null,
        driverRespondedAt: new Date()
      }
    });
    console.log(`✅ Driver ${driverId} responded to transfer request ${requestId}: ${response}`);
    // Получаем данные водителя для email
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { name: true }
    });
    const driverName = driver?.name || 'Водитель';
    // Отправляем email туристу о решении водителя (в фоне)
    if (transferRequest.email) {
      setImmediate(async () => {
        try {
          const { emailService: driverEmailSvc } = require('../services/emailService');
          const vehicleName = typeof transferRequest.vehicle?.name === 'object'
            ? ((transferRequest.vehicle.name as any).ru || (transferRequest.vehicle.name as any).en || 'Транспорт')
            : (transferRequest.vehicle?.name || 'Транспорт');
          if (response === 'accepted') {
            await driverEmailSvc.sendEmail({
              to: transferRequest.email,
              subject: `Водитель принял вашу заявку на трансфер | Bunyod-Tour`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #10b981;">🎉 Отличные новости!</h2>
                  <p>Уважаемый(ая) <strong>${transferRequest.fullName}</strong>,</p>
                  <p>Водитель <strong>${driverName}</strong> принял вашу заявку на трансфер!</p>
                  <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <h3 style="margin-top: 0; color: #059669;">Детали трансфера</h3>
                    <p><strong>Дата:</strong> ${transferRequest.pickupDate}</p>
                    <p><strong>Время:</strong> ${transferRequest.pickupTime}</p>
                    <p><strong>Откуда:</strong> ${transferRequest.pickupLocation}</p>
                    <p><strong>Куда:</strong> ${transferRequest.dropoffLocation}</p>
                    <p><strong>Транспорт:</strong> ${vehicleName}</p>
                    ${note ? `<p><strong>Сообщение от водителя:</strong> ${note}</p>` : ''}
                  </div>
                  <p>Водитель свяжется с вами ближе к дате поездки.</p>
                  <p>Спасибо за использование Bunyod-Tour!</p>
                </div>
              `
            });
          } else {
            await driverEmailSvc.sendEmail({
              to: transferRequest.email,
              subject: `Ответ на заявку на трансфер | Bunyod-Tour`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #6b7280;">Ответ на вашу заявку</h2>
                  <p>Уважаемый(ая) <strong>${transferRequest.fullName}</strong>,</p>
                  <p>К сожалению, водитель <strong>${driverName}</strong> не может принять вашу заявку на указанную дату.</p>
                  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Дата:</strong> ${transferRequest.pickupDate}</p>
                    <p><strong>Маршрут:</strong> ${transferRequest.pickupLocation} → ${transferRequest.dropoffLocation}</p>
                    ${note ? `<p><strong>Причина:</strong> ${note}</p>` : ''}
                  </div>
                  <p>Наша администрация свяжется с вами для подбора альтернативного варианта.</p>
                  <p>Спасибо за использование Bunyod-Tour!</p>
                </div>
              `
            });
          }
          console.log(`✅ Tourist notification email sent for transfer request ${requestId}`);
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
        driverResponse: updatedRequest.driverResponse,
        driverRespondedAt: updatedRequest.driverRespondedAt
      }
    });
  } catch (error) {
    console.error('Error responding to transfer request:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обработке ответа'
    });
  }
};
export { DEFAULT_VEHICLE_TYPES, LICENSE_CATEGORIES };
// Функция повторной отправки учётных данных водителю

// Функция повторной отправки учётных данных водителю
export const resendDriverCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const driverId = parseInt(id);

    if (isNaN(driverId)) {
      res.status(400).json({
        success: false,
        message: 'Неверный ID водителя'
      });
      return;
    }

    // Получаем водителя
    const driver = await prisma.driver.findUnique({
      where: { id: driverId }
    });

    if (!driver) {
      res.status(404).json({
        success: false,
        message: 'Водитель не найден'
      });
      return;
    }

    // Проверяем наличие email
    let driverEmail: string | null = driver.email || null;
    if (!driverEmail && driver.contact) {
      try {
        const contactData = typeof driver.contact === 'string' 
          ? JSON.parse(driver.contact) 
          : driver.contact;
        driverEmail = (contactData as any)?.email || null;
      } catch (e) {
        console.error('Failed to parse driver contact:', e);
      }
    }
    
    if (!driverEmail) {
      res.status(400).json({
        success: false,
        message: 'У водителя не указан email'
      });
      return;
    }

    // Проверяем наличие логина
    if (!driver.login) {
      res.status(400).json({
        success: false,
        message: 'У водителя не указан логин'
      });
      return;
    }

    // Генерируем криптографически безопасный временный пароль
    const crypto = require('crypto');
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const passwordBytes = crypto.randomBytes(12);
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += charset[passwordBytes[i] % charset.length];
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Обновляем пароль в базе данных
    await prisma.driver.update({
      where: { id: driverId },
      data: { password: hashedPassword }
    });

    // Отправляем email с учётными данными
    const dashboardUrl = `${process.env.FRONTEND_URL || 'https://bunyodtour.tj'}/driver-login.html`;
    
    await emailService.sendEmail({
      to: driverEmail,
      subject: 'Bunyod-Tour - Ваши учётные данные для входа в личный кабинет водителя',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3E3E3E;">Добро пожаловать в Bunyod-Tour!</h2>
          <p>Уважаемый ${driver.name},</p>
          <p>Ваши учётные данные для входа в личный кабинет водителя:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Логин:</strong> ${driver.login}</p>
            <p><strong>Пароль:</strong> ${newPassword}</p>
          </div>
          <p>Ссылка для входа: <a href="${dashboardUrl}">Перейти в личный кабинет</a></p>
          <p style="color: #666; font-size: 12px;">Рекомендуем сменить пароль после первого входа.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #888; font-size: 11px;">С уважением, команда Bunyod-Tour</p>
        </div>
      `
    });

    console.log(`✅ Driver credentials sent to ${driverEmail} for driver ID ${driverId}`);

    res.json({
      success: true,
      message: 'Учётные данные успешно отправлены на email водителя'
    });
  } catch (error) {
    console.error('Error resending driver credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при отправке учётных данных'
    });
  }
};
