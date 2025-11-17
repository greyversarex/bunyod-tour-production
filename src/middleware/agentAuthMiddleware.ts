import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware для проверки JWT токена турагента
 */
export const agentAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as any;

      // Проверка что роль - турагент
      if (decoded.role !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен'
        });
      }

      // Проверка существования турагента
      const agent = await prisma.travelAgent.findUnique({
        where: { id: decoded.agentId }
      });

      if (!agent) {
        return res.status(401).json({
          success: false,
          message: 'Турагент не найден'
        });
      }

      if (agent.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Ваш аккаунт заблокирован'
        });
      }

      // Добавляем данные турагента в request
      (req as any).agent = {
        agentId: agent.id,
        email: agent.email,
        fullName: agent.fullName,
        agentCode: agent.agentId
      };

      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Невалидный токен'
      });
    }
  } catch (error) {
    console.error('Agent auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка аутентификации'
    });
  }
};

/**
 * Middleware для проверки что пароль был изменен
 */
export const requirePasswordChange = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const agentId = (req as any).agent?.agentId;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
    }

    const agent = await prisma.travelAgent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Турагент не найден'
      });
    }

    if (agent.mustChangePassword) {
      return res.status(403).json({
        success: false,
        message: 'Необходимо сменить пароль',
        requirePasswordChange: true
      });
    }

    next();
  } catch (error) {
    console.error('Password change check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка проверки пароля'
    });
  }
};
