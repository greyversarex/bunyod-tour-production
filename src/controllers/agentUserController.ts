// @ts-nocheck
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export class AgentUserController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email и пароль обязательны'
        });
      }
      
      const agent = await prisma.agentUser.findUnique({
        where: { email: email.toLowerCase().trim() }
      });
      
      if (!agent) {
        return res.status(401).json({
          success: false,
          message: 'Неверный email или пароль'
        });
      }
      
      if (!agent.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Аккаунт деактивирован. Свяжитесь с администратором.'
        });
      }
      
      const isPasswordValid = await bcrypt.compare(password, agent.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Неверный email или пароль'
        });
      }
      
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET not configured');
        return res.status(500).json({
          success: false,
          message: 'Ошибка конфигурации сервера'
        });
      }
      
      const token = jwt.sign(
        {
          agentId: agent.id,
          uniqueId: agent.uniqueId,
          email: agent.email
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      return res.json({
        success: true,
        message: 'Вход выполнен успешно',
        token,
        agent: {
          id: agent.id,
          uniqueId: agent.uniqueId,
          fullName: agent.fullName,
          email: agent.email
        }
      });
    } catch (error) {
      console.error('Error in agent login:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при входе'
      });
    }
  }
  
  static async getProfile(req: Request, res: Response) {
    try {
      if (!req.agent) {
        return res.status(401).json({
          success: false,
          message: 'Требуется авторизация'
        });
      }
      
      const agent = await prisma.agentUser.findUnique({
        where: { id: req.agent.id },
        select: {
          id: true,
          uniqueId: true,
          fullName: true,
          email: true,
          phone: true,
          citizenship: true,
          address: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              agentTourBookings: true
            }
          }
        }
      });
      
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Агент не найден'
        });
      }
      
      return res.json({
        success: true,
        agent: {
          ...agent,
          totalBookings: agent._count.agentTourBookings
        }
      });
    } catch (error) {
      console.error('Error fetching agent profile:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении профиля'
      });
    }
  }
  
  static async createTourBooking(req: Request, res: Response) {
    try {
      if (!req.agent) {
        return res.status(401).json({
          success: false,
          message: 'Требуется авторизация'
        });
      }
      
      const {
        tourName,
        tourStartDate,
        tourEndDate,
        touristCount,
        touristsList
      } = req.body;
      
      if (!tourName || !tourStartDate || !tourEndDate || !touristCount || !touristsList) {
        return res.status(400).json({
          success: false,
          message: 'Все поля обязательны для заполнения'
        });
      }
      
      if (touristCount < 1 || touristCount > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Количество туристов должно быть от 1 до 1000'
        });
      }
      
      const lastBooking = await prisma.agentTourBooking.findFirst({
        orderBy: { id: 'desc' },
        select: { registrationNumber: true }
      });
      
      let nextNumber = 1;
      if (lastBooking && lastBooking.registrationNumber) {
        const match = lastBooking.registrationNumber.match(/BTB(\d+)/);
        if (match) {
          const parsed = parseInt(match[1]);
          nextNumber = isNaN(parsed) ? 1 : parsed + 1;
        }
      }
      
      const registrationNumber = `BTB${String(nextNumber).padStart(6, '0')}`;
      
      const booking = await prisma.agentTourBooking.create({
        data: {
          agentUserId: req.agent.id,
          registrationNumber,
          tourName: tourName.trim(),
          applicationDate: new Date(),
          tourStartDate: tourStartDate.trim(),
          tourEndDate: tourEndDate.trim(),
          touristCount: parseInt(touristCount),
          touristsList: typeof touristsList === 'string' ? touristsList.trim() : JSON.stringify(touristsList),
          status: 'pending'
        }
      });
      
      return res.status(201).json({
        success: true,
        message: 'Заявка успешно создана',
        booking: {
          id: booking.id,
          registrationNumber: booking.registrationNumber,
          tourName: booking.tourName,
          tourStartDate: booking.tourStartDate,
          tourEndDate: booking.tourEndDate,
          touristCount: booking.touristCount,
          status: booking.status,
          createdAt: booking.createdAt
        }
      });
    } catch (error: any) {
      console.error('Error creating tour booking:', error);
      
      if (error.code === 'P2002' && error.meta?.target?.includes('registrationNumber')) {
        return res.status(409).json({
          success: false,
          message: 'Ошибка генерации номера заявки. Попробуйте снова.'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Ошибка при создании заявки'
      });
    }
  }
  
  static async getTourBookings(req: Request, res: Response) {
    try {
      if (!req.agent) {
        return res.status(401).json({
          success: false,
          message: 'Требуется авторизация'
        });
      }
      
      const { status, page = '1', limit = '50' } = req.query;
      
      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;
      
      const where: any = { agentUserId: req.agent.id };
      if (status && typeof status === 'string') {
        where.status = status;
      }
      
      const [bookings, total] = await Promise.all([
        prisma.agentTourBooking.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
          select: {
            id: true,
            registrationNumber: true,
            tourName: true,
            applicationDate: true,
            tourStartDate: true,
            tourEndDate: true,
            touristCount: true,
            touristsList: true,
            status: true,
            adminNotes: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        prisma.agentTourBooking.count({ where })
      ]);
      
      return res.json({
        success: true,
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Error fetching tour bookings:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении списка заявок'
      });
    }
  }
}
