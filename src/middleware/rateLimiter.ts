/**
 * RATE LIMITING MIDDLEWARE
 * Защита от brute-force атак и злоупотребления API
 */

import rateLimit from 'express-rate-limit';

/**
 * Строгий лимит для входа (админы, гиды, водители)
 * 5 попыток за 15 минут
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // Максимум 5 попыток
  message: {
    success: false,
    message: 'Слишком много попыток входа. Попробуйте снова через 15 минут.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'Слишком много попыток входа. Попробуйте снова через 15 минут.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Умеренный лимит для публичных API endpoints
 * 100 запросов за 15 минут
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Максимум 100 запросов
  message: {
    success: false,
    message: 'Слишком много запросов. Попробуйте позже.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Пропускаем rate limiting для статических файлов
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
 * Строгий лимит для создания заказов/бронирований
 * 10 заказов за час (защита от спама)
 */
export const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // Максимум 10 заказов
  message: {
    success: false,
    message: 'Слишком много заказов за короткое время. Попробуйте позже.'
  },
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
 * 20 загрузок за 10 минут
 */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 20, // Максимум 20 загрузок
  message: {
    success: false,
    message: 'Слишком много загрузок файлов. Попробуйте позже.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Очень строгий лимит для регистрации
 * 3 регистрации за час с одного IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // Максимум 3 регистрации
  message: {
    success: false,
    message: 'Слишком много попыток регистрации. Попробуйте позже.'
  },
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
