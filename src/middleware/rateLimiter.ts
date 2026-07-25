/**
 * RATE LIMITING MIDDLEWARE
 * Защита от brute-force атак и злоупотребления API
 *
 * ВАЖНО: app.set('trust proxy', 1) в index.js обязателен для корректного
 * определения реального IP пользователя за Nginx. Без этого все пользователи
 * видятся системе с одним IP и блокируются вместе.
 */

import rateLimit from 'express-rate-limit';

/**
 * Лимит для входа (админы, гиды, водители)
 * 15 попыток за 15 минут — разумно для офисных сетей с NAT
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Login rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'Слишком много попыток входа. Попробуйте снова через 15 минут.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Умеренный лимит для публичных API endpoints
 * 300 запросов за 15 минут — нормально для активного пользователя
 * Пропускаем статику
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path.startsWith('/public/') ||
           req.path.startsWith('/uploads/') ||
           req.path.includes('.css') ||
           req.path.includes('.js') ||
           req.path.includes('.jpg') ||
           req.path.includes('.png') ||
           req.path.includes('.webp');
  }
});

/**
 * Лимит для создания заказов/бронирований
 * 20 заказов за час — более чем достаточно для реального пользователя
 */
export const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Order rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Слишком много заказов за короткое время. Попробуйте снова через час.',
      retryAfter: '1 hour'
    });
  }
});

/**
 * Лимит для загрузки файлов
 * 30 загрузок за 10 минут
 */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Лимит для регистрации
 * 5 регистраций за час с одного IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Registration rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Слишком много попыток регистрации с вашего IP. Попробуйте через час.',
      retryAfter: '1 hour'
    });
  }
});
