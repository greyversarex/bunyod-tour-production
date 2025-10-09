import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Получить все поездки
export const getAllTrips = async (req: Request, res: Response) => {
  try {
    const trips = await prisma.trip.findMany({
      include: {
        driver: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Форматируем данные для фронтенда
    const formattedTrips = trips.map(trip => ({
      ...trip,
      driverName: trip.driver?.name || 'Не назначен'
    }));

    res.json(formattedTrips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при получении поездок' 
    });
  }
};

// Создать новую поездку
export const createTrip = async (req: Request, res: Response) => {
  try {
    const {
      direction,
      pickupTime,
      pickupLocation,
      routeFrom,
      routeTo,
      dropoffLocation,
      dropoffTime,
      driverId
    } = req.body;

    // Валидация обязательных полей
    if (!direction || !pickupTime || !pickupLocation || !routeFrom || 
        !routeTo || !dropoffLocation || !dropoffTime || !driverId) {
      return res.status(400).json({
        success: false,
        message: 'Все поля обязательны для заполнения'
      });
    }

    // Проверяем существование водителя
    const driver = await prisma.driverProfile.findUnique({
      where: { id: parseInt(driverId) }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Водитель не найден'
      });
    }

    const trip = await prisma.trip.create({
      data: {
        direction,
        pickupTime,
        pickupLocation,
        routeFrom,
        routeTo,
        dropoffLocation,
        dropoffTime,
        driverId: parseInt(driverId),
        status: 'pending'
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        ...trip,
        driverName: trip.driver?.name || 'Не назначен'
      },
      message: 'Поездка успешно создана'
    });
  } catch (error) {
    console.error('Error creating trip:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка при создании поездки' 
    });
  }
};

// Получить поездку по ID
export const getTripById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const trip = await prisma.trip.findUnique({
      where: { id: parseInt(id) },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            vehicleBrand: true
          }
        }
      }
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Поездка не найдена'
      });
    }

    return res.json({
      success: true,
      data: {
        ...trip,
        driverName: trip.driver?.name || 'Не назначен'
      }
    });
  } catch (error) {
    console.error('Error fetching trip:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка при получении поездки' 
    });
  }
};

// Обновить поездку
export const updateTrip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Проверяем существование поездки
    const existingTrip = await prisma.trip.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingTrip) {
      return res.status(404).json({
        success: false,
        message: 'Поездка не найдена'
      });
    }

    // Если обновляется водитель, проверяем его существование
    if (updateData.driverId) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: parseInt(updateData.driverId) }
      });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Водитель не найден'
        });
      }
    }

    const trip = await prisma.trip.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        driver: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return res.json({
      success: true,
      data: {
        ...trip,
        driverName: trip.driver?.name || 'Не назначен'
      },
      message: 'Поездка успешно обновлена'
    });
  } catch (error) {
    console.error('Error updating trip:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка при обновлении поездки' 
    });
  }
};

// Удалить поездку
export const deleteTrip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Проверяем существование поездки
    const existingTrip = await prisma.trip.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingTrip) {
      return res.status(404).json({
        success: false,
        message: 'Поездка не найдена'
      });
    }

    await prisma.trip.delete({
      where: { id: parseInt(id) }
    });

    return res.json({
      success: true,
      message: 'Поездка успешно удалена'
    });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка при удалении поездки' 
    });
  }
};

// Обновить статус поездки
export const updateTripStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный статус поездки'
      });
    }

    const trip = await prisma.trip.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        driver: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return res.json({
      success: true,
      data: {
        ...trip,
        driverName: trip.driver?.name || 'Не назначен'
      },
      message: 'Статус поездки обновлен'
    });
  } catch (error) {
    console.error('Error updating trip status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка при обновлении статуса поездки' 
    });
  }
};