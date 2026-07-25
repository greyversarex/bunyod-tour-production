import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: any;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set');
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        res.status(403).json({
          success: false,
          message: 'Invalid or expired token'
        });
        return;
      }
      
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }
};

export const generateToken = (payload: any): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

// Только для администраторов: проверяет JWT + что admin существует и активен в БД
// ♻️ Единый Prisma-клиент (singleton), а не отдельный пул подключений.
import prismaForAuth from '../config/database';

export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ success: false, message: 'Access token is required' });
      return;
    }
    const token = authHeader.replace('Bearer ', '');
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      res.status(401).json({ success: false, message: 'Invalid token' });
      return;
    }
    if (!decoded?.adminId) {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }
    const admin = await prismaForAuth.admin.findUnique({ where: { id: decoded.adminId } });
    if (!admin || !admin.isActive) {
      res.status(401).json({ success: false, message: 'Admin account inactive or not found' });
      return;
    }
    req.user = decoded;
    (req as any).admin = { id: admin.id, username: admin.username, role: admin.role };
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};