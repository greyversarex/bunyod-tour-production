// 🔧 КРИТИЧНО: Загружаем переменные окружения ПЕРВЫМ
require('dotenv').config();

// 🔧 КРИТИЧНО: Регистрируем ts-node ВТОРЫМ для импорта TypeScript модулей
require('ts-node/register');

// 🔒 БЕЗОПАСНОСТЬ: Валидация переменных окружения ПЕРЕД запуском сервера
const { validateEnvironment } = require('./src/config/validateEnv.ts');
validateEnvironment();

const express = require('express');
const path = require('path');
const { exec } = require('child_process');
// 🗄️ ДОБАВЛЕНО: Автоматическая инициализация базы данных для новых серверов
const { initializeDatabase } = require('./src/utils/initializeDatabase.ts');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware для парсинга JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS middleware - flexible configuration for development and production
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // For development (Replit), allow all origins since the user sees a proxy
  if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // For production, use whitelist from environment variables
    const allowedOrigins = [];
    
    // Add production domain
    if (process.env.PRODUCTION_DOMAIN) {
      allowedOrigins.push(`https://${process.env.PRODUCTION_DOMAIN}`);
      allowedOrigins.push(`https://www.${process.env.PRODUCTION_DOMAIN}`);
      allowedOrigins.push(`http://${process.env.PRODUCTION_DOMAIN}`); // Для редиректа на HTTPS
    }
    
    // Add custom allowed origins from env (comma-separated)
    if (process.env.ALLOWED_ORIGINS) {
      const customOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
      allowedOrigins.push(...customOrigins);
    }
    
    // Add Replit domain if exists (для гибридного использования)
    if (process.env.REPLIT_DEV_DOMAIN) {
      allowedOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    
    // Check if origin is allowed
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin'); // Важно для кэширования
    } else {
      // Для запросов без origin (например, curl, Postman) или с того же домена
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
    }
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 часа кэш для preflight
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// NEW Booking system - 3-step process (moved higher for priority)
app.get('/booking/step1', (req, res) => {
  console.log('📋 Serving booking step 1 with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'booking-step1.html'));
});

app.get('/booking/step2', (req, res) => {
  console.log('📋 Serving booking step 2 with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'booking-step2.html'));
});

app.get('/booking/step3', (req, res) => {
  console.log('📋 Serving booking step 3 with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'booking-step3.html'));
});

app.get('/booking-step3.html', (req, res) => {
  console.log('📋 Serving booking-step3.html with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'booking-step3.html'));
});

// Legacy booking pages - to be removed later
// app.get('/booking.html', (req, res) => {
//   res.sendFile(path.join(__dirname, 'frontend', 'booking.html'));
// });

// app.get('/booking-flow.html', (req, res) => {
//   res.sendFile(path.join(__dirname, 'frontend', 'booking-flow.html'));
// });

// React Admin Panel - explicit route BEFORE static middleware
app.get('/react-admin-panel.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'react-admin-panel.html'));
});

// Simple Admin Panel - explicit route BEFORE static middleware
app.get('/simple-admin-panel.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'simple-admin-panel.html'));
});

// Import TypeScript backend routes directly (with better error handling)
try {
  require('ts-node/register');
  const apiRoutes = require('./src/routes/index.ts').default;
  app.use('/api', apiRoutes);
  
  // Add object storage routes directly (without /api prefix) for image serving
  const objectStorageRoutes = require('./src/routes/objectStorageRoutes.ts').default;
  app.use('/', objectStorageRoutes);
  console.log('✅ Backend API routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading backend routes:', error.message);
  console.log('🔄 Running in frontend-only mode');
}

// ИСПРАВЛЕНИЕ: Обработка repl_preview параметров и всех возможных путей
app.get('/', (req, res) => {
  console.log('🏠 Serving home page with query params:', req.query);
  console.log('🏠 Request URL:', req.url);
  console.log('🏠 Request path:', req.path);
  // Игнорируем repl_preview параметры и всегда отдаем главную страницу
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Обработка закодированных repl_preview параметров
app.use((req, res, next) => {
  // Декодируем URL для проверки
  const decodedUrl = decodeURIComponent(req.url);
  console.log('🔄 Middleware check - Original URL:', req.url);
  console.log('🔄 Middleware check - Decoded URL:', decodedUrl);
  
  // Если это запрос с repl_preview параметрами (даже закодированными)
  if (decodedUrl.includes('repl_preview') && req.path === '/') {
    console.log('🏠 Serving home page for repl_preview request');
    return res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  }
  
  // Продолжаем обработку
  next();
});

// Add direct route for /api/objects/direct/* to serve uploaded images
app.use('/api/objects/direct', express.static(path.join(__dirname, 'uploads/images')));

// Add secure route for tour guide photos (only images, not documents)
app.use('/uploads/guides', (req, res, next) => {
  // Security: Only allow image files, block documents
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const fileExtension = path.extname(req.path).toLowerCase();
  
  if (allowedExtensions.includes(fileExtension)) {
    express.static(path.join(__dirname, 'uploads/guides'))(req, res, next);
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Access denied: Only image files are allowed' 
    });
  }
});

// Add upload routes for simple image handling
const uploadRoutes = require('./src/routes/uploadRoutes.ts').default;
app.use('/upload', uploadRoutes);

// Tour template page - explicit route BEFORE static middleware
app.get('/tour-template.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'tour-template.html'));
});

// Hotel template page - explicit route BEFORE static middleware
app.get('/hotel-template.html', (req, res) => {
  console.log('🏨 Serving hotel template page with query:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'hotel-template.html'));
});

// Hotels catalog page - explicit route BEFORE static middleware
app.get('/hotels-catalog.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'hotels-catalog.html'));
});

// HTML files will be served by express.static

// Обслуживать статические файлы из папки frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// SECURITY: Restrict attached_assets access - only allow safe file types
app.use('/attached_assets', (req, res, next) => {
  // Only allow safe image extensions to prevent access to sensitive documents
  const safeExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
  const fileExtension = path.extname(req.path).toLowerCase();
  
  if (safeExtensions.includes(fileExtension)) {
    express.static(path.join(__dirname, 'attached_assets'))(req, res, next);
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Access denied: Only image files are allowed' 
    });
  }
});

// SECURITY: Restrict uploads access - remove public serving of sensitive documents
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// TODO: Implement authenticated document access via API endpoints

// Обработчик корневого пути и template роутов перемещены выше (перед static middleware)

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Глобальная обработка ошибок
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Использование PostgreSQL через Prisma
async function startServer() {
  try {
    console.log('🗄️ Подключение к PostgreSQL через Prisma...');
    
    // 🏗️ БЕЗОПАСНОСТЬ: Применяем схему БД с проверкой окружения
    console.log('🔧 Применение схемы базы данных...');
    
    // 🔒 ПРОДАКШН: Используем только миграции, никаких автоматических изменений
    if (process.env.NODE_ENV === 'production') {
      console.log('🏭 PRODUCTION MODE: Используем безопасный prisma migrate deploy');
      try {
        await new Promise((resolve, reject) => {
          // БЕЗОПАСНО: Применяет только готовые миграции без изменения данных
          exec('npx prisma migrate deploy', (error, stdout, stderr) => {
            if (error) {
              console.error('❌ Migration deployment failed:', stderr);
              console.log('⚠️ Убедитесь, что все миграции находятся в prisma/migrations/');
              reject(error);
            } else {
              console.log('✅ Миграции применены успешно');
              resolve(stdout);
            }
          });
        });
      } catch (error) {
        console.error('❌ Не удалось применить миграции:', error);
        console.log('⚠️ Продолжаем работу, но БД может быть не синхронизирована');
      }
    } else {
      // 🛠️ DEVELOPMENT: Автоматическая синхронизация схемы (только для разработки)
      console.log('🛠️ DEVELOPMENT MODE: Используем prisma db push');
      try {
        await new Promise((resolve, reject) => {
          exec('npx prisma db push', (error, stdout, stderr) => {
            if (error) {
              console.log('⚠️ Prisma push failed, trying with accept-data-loss...');
              exec('npx prisma db push --accept-data-loss', (error2, stdout2, stderr2) => {
                if (error2) {
                  console.error('❌ Prisma schema deployment failed:', stderr2);
                  reject(error2);
                } else {
                  console.log('✅ Схема БД применена с предупреждениями');
                  resolve(stdout2);
                }
              });
            } else {
              console.log('✅ Схема БД применена успешно');
              resolve(stdout);
            }
          });
        });
      } catch (error) {
        console.error('❌ Не удалось применить схему БД:', error);
        console.log('⚠️ Продолжаем без обновления схемы...');
      }
    }
    
    // 🚀 Автоматическая инициализация базы данных (только для разработки)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Проверка инициализации базы данных...');
      try {
        await initializeDatabase();
        console.log('✅ База данных готова к работе!');
      } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error);
        console.log('⚠️ Сервер продолжит работу, но некоторые функции могут быть недоступны');
      }
    } else {
      console.log('🏭 PRODUCTION MODE: Пропускаем автоматическую инициализацию БД');
      console.log('✅ База данных готова к работе!');
    }
    
    // Инициализация компонентов калькулятора цен (отложено после запуска сервера)
    setTimeout(async () => {
      try {
        console.log('🧮 Инициализация компонентов калькулятора цен...');
        const response = await fetch(`http://localhost:${PORT}/api/price-calculator/initialize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) {
          console.log(`✅ ${result.message}`);
        }
      } catch (error) {
        console.log('⚠️ Компоненты калькулятора будут инициализированы при первом обращении');
      }
    }, 2000); // Ждем 2 секунды после запуска сервера
    
    console.log('Starting backend API server...');
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Unified server running on port ${PORT}`);
      console.log(`📱 Frontend: http://0.0.0.0:${PORT}`);
      console.log(`🔧 Admin: http://0.0.0.0:${PORT}/admin-dashboard.html`);
      console.log(`🌐 API: http://0.0.0.0:${PORT}/api`);
      console.log('🗄️  База данных: PostgreSQL через Prisma');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();