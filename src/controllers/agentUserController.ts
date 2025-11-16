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
      
      const agent = await prisma.agent_users.findUnique({
        where: { email: email.toLowerCase().trim() }
      });
      
      if (!agent) {
        return res.status(401).json({
          success: false,
          message: 'Неверный email или пароль'
        });
      }
      
      if (!agent.is_active) {
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
          uniqueId: agent.unique_id,
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
          uniqueId: agent.unique_id,
          fullName: agent.full_name,
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
      
      const agent = await prisma.agent_users.findUnique({
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
              agent_tour_bookings: true
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
          totalBookings: agent._count.agent_tour_bookings
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
        tour_name,
        tour_start_date,
        tour_end_date,
        tourist_count,
        tourists_list
      } = req.body;
      
      if (!tour_name || !tour_start_date || !tour_end_date || !tourist_count || !tourists_list) {
        return res.status(400).json({
          success: false,
          message: 'Все поля обязательны для заполнения'
        });
      }
      
      if (tourist_count < 1 || tourist_count > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Количество туристов должно быть от 1 до 1000'
        });
      }
      
      const lastBooking = await prisma.agent_tour_bookings.findFirst({
        orderBy: { id: 'desc' },
        select: { registration_number: true }
      });
      
      let nextNumber = 1;
      if (lastBooking && lastBooking.registration_number) {
        const match = lastBooking.registration_number.match(/BTB(\d+)/);
        if (match) {
          const parsed = parseInt(match[1]);
          nextNumber = isNaN(parsed) ? 1 : parsed + 1;
        }
      }
      
      const registration_number = `BTB${String(nextNumber).padStart(6, '0')}`;
      
      const booking = await prisma.agent_tour_bookings.create({
        data: {
          agent_user_id: req.agent.id,
          registration_number,
          tour_name: tour_name.trim(),
          application_date: new Date(),
          tour_start_date: tour_start_date.trim(),
          tour_end_date: tour_end_date.trim(),
          tourist_count: parseInt(tourist_count),
          tourists_list: typeof tourists_list === 'string' ? tourists_list.trim() : JSON.stringify(tourists_list),
          status: 'pending'
        }
      });
      
      return res.status(201).json({
        success: true,
        message: 'Заявка успешно создана',
        booking: {
          id: booking.id,
          registration_number: booking.registration_number,
          tour_name: booking.tour_name,
          tour_start_date: booking.tour_start_date,
          tour_end_date: booking.tour_end_date,
          tourist_count: booking.tourist_count,
          status: booking.status,
          createdAt: booking.createdAt
        }
      });
    } catch (error: any) {
      console.error('Error creating tour booking:', error);
      
      if (error.code === 'P2002' && error.meta?.target?.includes('registration_number')) {
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
      
      const where: any = { agent_user_id: req.agent.id };
      if (status && typeof status === 'string') {
        where.status = status;
      }
      
      const [bookings, total] = await Promise.all([
        prisma.agent_tour_bookings.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
          select: {
            id: true,
            registration_number: true,
            tour_name: true,
            application_date: true,
            tour_start_date: true,
            tour_end_date: true,
            tourist_count: true,
            tourists_list: true,
            status: true,
            admin_notes: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        prisma.agent_tour_bookings.count({ where })
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
