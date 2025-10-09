import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT_SECRET is validated at server startup - will never be undefined here
const JWT_SECRET = process.env.JWT_SECRET!;

export interface TourGuideAuthRequest extends Request {
  user?: {
    id: number;
    login: string;
    name: string;
    type: string;
  };
}

// Middleware для аутентификации тургидов
export const authenticateTourGuide = (req: TourGuideAuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.tourGuideToken;

    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Требуется авторизация' 
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.type !== 'tour-guide') {
      res.status(403).json({ 
        success: false, 
        message: 'Доступ запрещён' 
      });
      return;
    }

    req.user = {
      id: decoded.id,
      login: decoded.login,
      name: decoded.name,
      type: decoded.type
    };

    next();

  } catch (error) {
    console.error('❌ Tour guide auth error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Недействительный токен' 
    });
    return;
  }
};