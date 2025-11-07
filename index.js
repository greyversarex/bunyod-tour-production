// 🔧 КРИТИЧНО: Загружаем переменные окружения ПЕРВЫМ
require('dotenv').config();

// 🔧 PRODUCTION/DEVELOPMENT MODE: Условная загрузка TypeScript
const isProduction = process.env.NODE_ENV === 'production';
const srcPath = isProduction ? './dist' : './src';

// В dev регистрируем ts-node для импорта TypeScript модулей
if (!isProduction) {
  require('ts-node/register');
  console.log('🛠️  DEV MODE: Using ts-node for TypeScript compilation');
} else {
  console.log('🏭 PRODUCTION MODE: Using pre-compiled JavaScript from dist/');
}

// 🔒 БЕЗОПАСНОСТЬ: Валидация переменных окружения ПЕРЕД запуском сервера
const { validateEnvironment } = require(`${srcPath}/config/validateEnv${isProduction ? '.js' : '.ts'}`);
validateEnvironment();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
// 🗄️ ДОБАВЛЕНО: Автоматическая инициализация базы данных для новых серверов
const { initializeDatabase } = require(`${srcPath}/utils/initializeDatabase${isProduction ? '.js' : '.ts'}`);

const app = express();
const PORT = process.env.PORT || 5000;

// 🔒 Trust proxy для корректной работы rate limiting в Replit
app.set('trust proxy', true);

// ОТКЛЮЧАЕМ глобальные парсеры body - они будут применяться на уровне роутов
// Это исправляет конфликт с multer для загрузки файлов

// 🔒 CORS: Белый список из переменной окружения CORS_ORIGINS
const corsOrigins = process.env.CORS_ORIGINS || '';
const allowlist = corsOrigins
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Разрешить запросы без origin (curl, healthcheck, same-origin)
    if (!origin) return callback(null, true);
    
    // Разрешить все если установлено *
    if (corsOrigins === '*' || allowlist.includes('*')) {
      return callback(null, true);
    }
    
    // Разрешить если в белом списке
    if (allowlist.length === 0 || allowlist.includes(origin)) {
      return callback(null, true);
    }
    
    // Заблокировать если не в списке
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  maxAge: 86400, // 24 часа
}));

// 🩺 Health check endpoint (для мониторинга и update.sh)
app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
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

// 🔌 BACKEND API ROUTES: Условная загрузка для dev/prod
try {
  // Парсеры JSON/urlencoded для обычных API запросов (НЕ для file uploads)
  const jsonParser = express.json({ limit: '50mb' });
  const urlencodedParser = express.urlencoded({ extended: true, limit: '50mb' });
  
  // Условный body parser middleware
  app.use('/api', (req, res, next) => {
    const contentType = req.get('content-type') || '';
    // Пропускаем парсеры для multipart/form-data (file uploads обрабатывает multer)
    if (contentType.includes('multipart/form-data')) {
      console.log('⏭️  Skipping body parsers for file upload:', req.path);
      return next();
    }
    // Применяем JSON парсер
    jsonParser(req, res, (err) => {
      if (err) return next(err);
      // Применяем urlencoded парсер
      urlencodedParser(req, res, next);
    });
  });
  
  const apiRoutes = require(`${srcPath}/routes/index${isProduction ? '.js' : '.ts'}`).default;
  app.use('/api', apiRoutes);
  
  // Add object storage routes directly (without /api prefix) for image serving
  const objectStorageRoutes = require(`${srcPath}/routes/objectStorageRoutes${isProduction ? '.js' : '.ts'}`).default;
  app.use('/', objectStorageRoutes);
  
  console.log(`✅ Backend API routes loaded successfully (${isProduction ? 'compiled' : 'ts-node'})`);
} catch (error) {
  console.error('❌ Error loading backend routes:', error);
  console.log('🔄 Running in frontend-only mode');
  if (!isProduction) {
    console.log('💡 Hint: Try running "npm run build" to compile TypeScript');
  }
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

// Add secure route for banner slides (only images)
app.use('/uploads/slides', (req, res, next) => {
  // Security: Only allow image files for banner slides
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const fileExtension = path.extname(req.path).toLowerCase();
  
  if (allowedExtensions.includes(fileExtension)) {
    express.static(path.join(__dirname, 'uploads/slides'))(req, res, next);
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Access denied: Only image files are allowed' 
    });
  }
});

// Add upload routes for simple image handling
const uploadRoutes = require(`${srcPath}/routes/uploadRoutes${isProduction ? '.js' : '.ts'}`).default;
app.use('/upload', uploadRoutes);

// Tour template page - explicit route BEFORE static middleware
app.get('/tour-template.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'tour-template.html'));
});

// Tour page - explicit route BEFORE static middleware
app.get('/tour.html', (req, res) => {
  console.log('🎯 Serving tour page with query:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'tour-template.html'));
});

// Guide profile page - explicit route BEFORE static middleware
app.get('/guide-profile.html', (req, res) => {
  console.log('👤 Serving guide profile page with query:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'guide-profile.html'));
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

// Admin dashboard - explicit route with no-cache headers
app.get('/admin-dashboard.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(__dirname, 'frontend', 'admin-dashboard.html'));
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
    
    // 🏗️ ОПЦИОНАЛЬНЫЕ МИГРАЦИИ И СИД НА СТАРТЕ (контроль через env переменные)
    const runMigrationsOnBoot = process.env.RUN_MIGRATIONS_ON_BOOT === 'true';
    const runSeedOnBoot = process.env.RUN_SEED_ON_BOOT === 'true';
    
    console.log('🔧 Применение схемы базы данных...');
    
    // 🔒 МИГРАЦИИ: Опционально через RUN_MIGRATIONS_ON_BOOT=true
    if (runMigrationsOnBoot) {
      if (process.env.NODE_ENV === 'production') {
        console.log('🏭 PRODUCTION: Запускаем prisma migrate deploy (RUN_MIGRATIONS_ON_BOOT=true)');
        try {
          await new Promise((resolve, reject) => {
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
        console.log('🛠️ DEVELOPMENT: Запускаем prisma db push (RUN_MIGRATIONS_ON_BOOT=true)');
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
    } else {
      console.log('🏭 PRODUCTION: Пропускаем migrate deploy на старте (RUN_MIGRATIONS_ON_BOOT!=true)');
      console.log('💡 Миграции выполняются через ./update.sh при обновлении');
    }
    
    // 🌱 СИД: Опционально через RUN_SEED_ON_BOOT=true
    if (runSeedOnBoot) {
      console.log('🔍 Проверка инициализации базы данных (RUN_SEED_ON_BOOT=true)...');
      try {
        await initializeDatabase();
        console.log('✅ База данных готова к работе!');
      } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error);
        console.log('⚠️ Сервер продолжит работу, но некоторые функции могут быть недоступны');
      }
    } else {
      console.log('🏭 PRODUCTION: Пропускаем seed на старте (RUN_SEED_ON_BOOT!=true)');
      console.log('💡 Сид выполняется через ./update.sh при обновлении');
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