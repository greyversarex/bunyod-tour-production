import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';
import prisma, { withRetry } from '../config/database';

// JWT_SECRET is validated at server startup - will never be undefined here
const JWT_SECRET = process.env.JWT_SECRET!;

export class AdminController {
  /**
   * Авторизация админа
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      
      console.log('🔐 Login attempt:', { 
        username, 
        passwordLength: password?.length,
        usernameType: typeof username,
        passwordType: typeof password
      });

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      // Найти администратора по имени пользователя с retry logic
      const admin = await withRetry(() => prisma.admin.findUnique({
        where: { username: username.trim() }
      }));
      
      console.log('👤 Admin found:', admin ? 'yes' : 'no', admin?.username);

      if (!admin || !admin.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Проверить пароль
      const isPasswordValid = await bcrypt.compare(password.trim(), admin.password);
      console.log('🔑 Password check:', isPasswordValid ? 'valid' : 'invalid');
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Создать токен
      const token = jwt.sign(
        {
          adminId: admin.id,
          username: admin.username,
          role: admin.role
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const response: ApiResponse = {
        success: true,
        data: {
          token,
          admin: {
            id: admin.id,
            username: admin.username,
            fullName: admin.fullName,
            role: admin.role
          }
        },
        message: 'Login successful'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Создание администратора (только для разработки)
   */
  static async createAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, email, password, fullName, role = 'admin' } = req.body;

      if (!username || !email || !password || !fullName) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: username, email, password, fullName'
        });
      }

      // Хэшировать пароль
      const hashedPassword = await bcrypt.hash(password, 10);

      const admin = await prisma.admin.create({
        data: {
          username,
          email,
          password: hashedPassword,
          fullName,
          role
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role
        },
        message: 'Admin created successfully'
      };

      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Проверка токена
   */
  static async verifyToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'No token provided'
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.adminId }
      });

      if (!admin || !admin.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }

      const response: ApiResponse = {
        success: true,
        data: {
          admin: {
            id: admin.id,
            username: admin.username,
            fullName: admin.fullName,
            role: admin.role
          }
        },
        message: 'Token is valid'
      };

      return res.status(200).json(response);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  }

  /**
   * Получение статистики для панели администратора
   */
  static async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      // Дата месяц назад
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      // Считаем только оплаченные заказы
      const [toursCount, paidOrdersCount, hotelsCount, guidesCount, reviewsCount, monthlyRevenue, activeCustomersCount] = await Promise.all([
        prisma.tour.count({ where: { isActive: true } }),
        prisma.order.count({ where: { paymentStatus: 'paid' } }),
        prisma.hotel.count({ where: { isActive: true } }),
        prisma.guide.count(),
        prisma.review.count(),
        // Доход за месяц только от оплаченных заказов
        prisma.order.aggregate({
          where: {
            paymentStatus: 'paid',
            createdAt: { gte: oneMonthAgo }
          },
          _sum: { totalAmount: true }
        }),
        // Активные клиенты - те, кто сделал хотя бы один оплаченный заказ
        prisma.customer.count({
          where: {
            orders: {
              some: { paymentStatus: 'paid' }
            }
          }
        })
      ]);

      // Последние заказы - только оплаченные
      const recentOrders = await prisma.order.findMany({
        where: { paymentStatus: 'paid' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          tour: true
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          stats: {
            tours: toursCount,
            orders: paidOrdersCount,
            hotels: hotelsCount,
            revenue: monthlyRevenue._sum.totalAmount || 0,
            activeCustomers: activeCustomersCount,
            guides: guidesCount,
            reviews: reviewsCount
          },
          recentOrders
        },
        message: 'Dashboard statistics retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получение всех туров для админ панели
   */
  static async getTours(req: Request, res: Response, next: NextFunction) {
    try {
      const tours = await prisma.tour.findMany({
        include: {
          category: true,
          tourBlockAssignments: {
            include: {
              tourBlock: true
            }
          },
          orders: true,
          reviews: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const response: ApiResponse = {
        success: true,
        data: tours,
        message: 'Tours retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получение всех заказов для админ панели
   */
  static async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const orders = await prisma.order.findMany({
        include: {
          customer: true,
          tour: true,
          hotel: true,
          guide: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const response: ApiResponse = {
        success: true,
        data: orders,
        message: 'Orders retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }
}

/**
 * Middleware для проверки аутентификации администратора
 */
export const adminAuthMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No token provided'
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId }
    });

    if (!admin || !admin.isActive) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      return;
    }

    // Добавить информацию об администраторе в запрос
    (req as any).admin = {
      id: admin.id,
      username: admin.username,
      role: admin.role
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
    return;
  }
};