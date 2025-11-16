// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AgentJwtPayload {
  agentId: number;
  uniqueId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      agent?: {
        id: number;
        uniqueId: string;
        fullName: string;
        email: string;
      };
    }
  }
}

export const agentAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Необходима авторизация'
      });
      return;
    }
    
    const token = authHeader.substring(7);
    
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        message: 'Ошибка конфигурации сервера'
      });
      return;
    }
    
    let decoded: AgentJwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as AgentJwtPayload;
    } catch (err) {
      res.status(401).json({
        success: false,
        message: 'Недействительный токен авторизации'
      });
      return;
    }
    
    const agent = await prisma.agent_users.findUnique({
      where: { id: decoded.agentId },
      select: {
        id: true,
        uniqueId: true,
        fullName: true,
        email: true,
        isActive: true
      }
    });
    
    if (!agent) {
      res.status(401).json({
        success: false,
        message: 'Агент не найден'
      });
      return;
    }
    
    if (!agent.is_active) {
      res.status(403).json({
        success: false,
        message: 'Аккаунт деактивирован'
      });
      return;
    }
    
    req.agent = {
      id: agent.id,
      uniqueId: agent.unique_id,
      fullName: agent.full_name,
      email: agent.email
    };
    
    next();
  } catch (error) {
    console.error('Error in agent auth middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка авторизации'
    });
  }
};
