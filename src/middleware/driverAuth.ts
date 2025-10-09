import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Расширяем интерфейс Request для типизации
interface AuthenticatedRequest extends Request {
  driverId?: number;
  driver?: any;
}

export const authenticateDriver = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

    // Верифицируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'driver-secret-key') as any;
    
    if (!decoded.driverId) {
      res.status(401).json({
        success: false,
        message: 'Неверный токен доступа'
      });
      return;
    }

    // Проверяем существование и активность водителя
    const driver = await prisma.driver.findFirst({
      where: {
        id: decoded.driverId,
        isActive: true
      }
    });

    if (!driver) {
      res.status(401).json({
        success: false,
        message: 'Водитель не найден или неактивен'
      });
      return;
    }

    // Добавляем информацию о водителе в запрос
    (req as any).driverId = driver.id;
    (req as any).driver = driver;

    console.log('✅ Driver middleware success:');
    console.log('  - Driver ID:', driver.id);
    console.log('  - Driver Name:', driver.name);
    console.log('  - Request path:', req.path);
    
    next();

  } catch (error) {
    console.error('❌ Ошибка аутентификации водителя:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Неверный токен доступа'
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Токен доступа истек'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при аутентификации'
    });
  }
};

// Middleware для проверки прав админа (для управления водителями)
export const requireAdminForDrivers = (req: Request, res: Response, next: NextFunction): void => {
  // Здесь можно добавить проверку админских прав
  // Пока пропускаем, так как управление через админ-панель
  next();
};

export default authenticateDriver;