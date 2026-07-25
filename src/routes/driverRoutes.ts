import express from 'express';
import { authenticateDriver } from '../middleware/driverAuth';
import { loginLimiter, registrationLimiter } from '../middleware/rateLimiter';
import {
  loginDriver,
  getAllDrivers,
  getDriverById,
  createDriverProfile,
  updateDriverProfile,
  deleteDriver,
  getDriverOptions,
  getDriverAssignedEvents,
  startDriverEvent,
  completeDriverEvent,
  getMyTransferRequests,
  respondToTransferRequest,
  upload,
  resendDriverCredentials
} from '../controllers/driverController';
import prisma from '../config/database';

const router = express.Router();

// Авторизация водителя с защитой от brute-force
router.post('/login', loginLimiter, loginDriver);

// Создание водителя с аутентификацией (для админ панели) - с поддержкой загрузки файлов
router.post('/create-with-auth', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'documents', maxCount: 10 },
  { name: 'vehiclePhotos', maxCount: 5 }
]), createDriverProfile);

// Маршруты для управления профилем водителя (админ панель) - с поддержкой загрузки файлов
router.put('/profile/:id', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'documents', maxCount: 10 },
  { name: 'vehiclePhotos', maxCount: 5 }
]), updateDriverProfile);

// Получение всех водителей (для админ панели)
router.get('/', getAllDrivers);

// Получение опций для водителей (типы транспорта, категории прав)
router.get('/options/vehicle-types', getDriverOptions);

// Защищённые маршруты для водителей (требуют авторизации)
// Тестовый маршрут БЕЗ middleware для проверки
router.get('/test-simple', (req, res) => {
  console.log('🧪 Simple test route called');
  res.json({
    success: true,
    message: 'Простой маршрут работает',
    timestamp: new Date().toISOString()
  });
});

// Простейший рабочий API для событий водителя (без middleware)
router.get('/my-events-simple', async (req, res) => {
  console.log('🧪 Simple events route called');
  console.log('   - Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
  
  try {
    res.json({
      success: true,
      data: [
        {
          id: '9-0',
          tourId: 9,
          tourTitle: 'Тестовый тур',
          eventIndex: 0,
          time: '09:00',
          title: 'Поездка в аэропорт',
          description: 'Встреча туристов в аэропорту',
          status: 'pending'
        },
        {
          id: '9-1', 
          tourId: 9,
          tourTitle: 'Тестовый тур',
          eventIndex: 1,
          time: '14:00',
          title: 'Экскурсия по городу',
          description: 'Обзорная экскурсия',
          status: 'started'
        }
      ],
      message: 'Тестовые события загружены'
    });
  } catch (error) {
    console.error('❌ Error in simple events:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке событий'
    });
  }
});

// Тестовый маршрут для проверки middleware
router.get('/test-auth', authenticateDriver, (req, res) => {
  console.log('🧪 Test auth route called');
  console.log('  - Driver ID from req:', (req as any).driverId);
  res.json({
    success: true,
    message: 'Middleware работает',
    driverId: (req as any).driverId,
    driver: (req as any).driver?.name
  });
});

// Получение профиля текущего водителя
router.get('/me', async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      res.status(401).json({ success: false, message: 'Токен доступа отсутствует' });
      return;
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'driver-secret-key');
    const driverId = decoded.driverId;
    
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        availableDays: true,
        availableDates: true,
        isActive: true
      }
    });

    if (!driver) {
      res.status(404).json({ success: false, message: 'Водитель не найден' });
      return;
    }

    res.json({ success: true, data: driver });
  } catch (error) {
    console.error('Error getting driver profile:', error);
    res.status(500).json({ success: false, message: 'Ошибка при загрузке профиля' });
  }
});

// Обновление доступных дней водителя (legacy - дни недели)
router.put('/update-availability', async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      res.status(401).json({ success: false, message: 'Токен доступа отсутствует' });
      return;
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'driver-secret-key');
    const driverId = decoded.driverId;
    
    const { availableDays } = req.body;
    
    if (!Array.isArray(availableDays)) {
      res.status(400).json({ success: false, message: 'availableDays должен быть массивом' });
      return;
    }

    await prisma.driver.update({
      where: { id: driverId },
      data: { availableDays: JSON.stringify(availableDays) }
    });

    console.log(`✅ Driver ${driverId} updated availableDays:`, availableDays);

    res.json({ success: true, message: 'Доступные дни обновлены' });
  } catch (error) {
    console.error('Error updating driver availability:', error);
    res.status(500).json({ success: false, message: 'Ошибка при обновлении доступности' });
  }
});

// Обновление доступных дат водителя (календарь - конкретные даты)
router.put('/update-available-dates', async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      res.status(401).json({ success: false, message: 'Токен доступа отсутствует' });
      return;
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'driver-secret-key');
    const driverId = decoded.driverId;
    
    const { availableDates } = req.body;
    
    if (!Array.isArray(availableDates)) {
      res.status(400).json({ success: false, message: 'availableDates должен быть массивом дат в формате YYYY-MM-DD' });
      return;
    }

    // Валидируем формат дат
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const validDates = availableDates.filter((d: string) => dateRegex.test(d));

    await prisma.driver.update({
      where: { id: driverId },
      data: { availableDates: JSON.stringify(validDates) }
    });

    console.log(`✅ Driver ${driverId} updated availableDates: ${validDates.length} dates`);

    res.json({ success: true, message: 'Доступные даты обновлены', count: validDates.length });
  } catch (error) {
    console.error('Error updating driver available dates:', error);
    res.status(500).json({ success: false, message: 'Ошибка при обновлении доступных дат' });
  }
});

// Получение назначенных событий водителя (inline версия)
router.get('/my-events', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Токен доступа отсутствует'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'driver-secret-key');
    const driverId = decoded.driverId;
    
    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: 'Неверный токен доступа'
      });
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
                id: `${tour.id}-${index}`,
                tourId: tour.id,
                tourTitle: tour.title,
                eventIndex: index,
                time: event.time,
                title: event.title,
                description: event.description,
                status: event.status || 'pending',
                tourStatus: tour.status,
                startDate: tour.startDate,
                endDate: tour.endDate,
                startedAt: event.startedAt,
                completedAt: event.completedAt
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
    return;

  } catch (error) {
    console.error('❌ Error getting driver assigned events:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении назначенных событий'
    });
    return;
  }
});

// Запуск события (inline версия)
router.post('/events/:eventId/start', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Токен доступа отсутствует'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'driver-secret-key');
    const driverId = decoded.driverId;
    const { eventId } = req.params;
    
    if (!driverId || !eventId) {
      return res.status(400).json({
        success: false,
        message: 'Необходимы параметры driverId и eventId'
      });
    }

    const [tourId, eventIndex] = eventId.split('-');
    const tour = await prisma.tour.findUnique({
      where: { id: parseInt(tourId) }
    });

    if (!tour || !tour.itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Тур или программа не найдены'
      });
    }

    const itinerary = JSON.parse(tour.itinerary);
    const eventIdx = parseInt(eventIndex);
    
    if (eventIdx >= itinerary.length || itinerary[eventIdx].driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Событие не назначено данному водителю'
      });
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
    return;

  } catch (error) {
    console.error('❌ Error starting driver event:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при запуске события'
    });
    return;
  }
});

// Завершение события (inline версия)
router.post('/events/:eventId/complete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Токен доступа отсутствует'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'driver-secret-key');
    const driverId = decoded.driverId;
    const { eventId } = req.params;
    
    if (!driverId || !eventId) {
      return res.status(400).json({
        success: false,
        message: 'Необходимы параметры driverId и eventId'
      });
    }

    const [tourId, eventIndex] = eventId.split('-');
    const tour = await prisma.tour.findUnique({
      where: { id: parseInt(tourId) }
    });

    if (!tour || !tour.itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Тур или программа не найдены'
      });
    }

    const itinerary = JSON.parse(tour.itinerary);
    const eventIdx = parseInt(eventIndex);
    
    if (eventIdx >= itinerary.length || itinerary[eventIdx].driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Событие не назначено данному водителю'
      });
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
    return;

  } catch (error) {
    console.error('❌ Error completing driver event:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при завершении события'
    });
    return;
  }
});

// ========== МАРШРУТЫ ДЛЯ ЗАЯВОК НА ТРАНСФЕР ==========
// Получение заявок на трансфер для водителя (его машины)
router.get('/my-transfers', getMyTransferRequests);

// Ответ на заявку на трансфер (принять/отклонить)
router.put('/my-transfers/:requestId/respond', respondToTransferRequest);

// ВАЖНО: Параметрические маршруты (с :id) должны быть В КОНЦЕ
// чтобы не перехватывать специфичные маршруты
// Получение водителя по ID (админ-панель)
router.get('/:id', getDriverById);

// Удаление водителя
router.delete('/:id', deleteDriver);

// Повторная отправка учётных данных водителю
router.post('/:id/resend-credentials', resendDriverCredentials);

export default router;