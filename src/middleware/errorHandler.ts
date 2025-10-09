import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error for debugging
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database operation failed';
  }

  if (error.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid data provided';
  }

  // Handle JSON parsing errors
  if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    statusCode = 400;
    message = 'Invalid JSON format';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

/**
 * 404 handler middleware
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`
  });
};
