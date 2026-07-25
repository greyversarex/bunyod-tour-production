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
const compression = require('compression');
const path = require('path');
const { exec } = require('child_process');
// 🗄️ ДОБАВЛЕНО: Автоматическая инициализация базы данных для новых серверов
const { initializeDatabase } = require(`${srcPath}/utils/initializeDatabase${isProduction ? '.js' : '.ts'}`);

const app = express();
const PORT = process.env.PORT || 5000;

// 🔒 Trust proxy: цифра 1 = доверять ровно одному прокси (Nginx)
// Это критично для корректного определения реального IP пользователя в rate limiting.
// boolean true = доверять всем прокси = все пользователи видятся как один IP!
app.set('trust proxy', 1);

// 🗜️ Gzip/Brotli сжатие ответов (HTML/CSS/JS/JSON)
// Не сжимаем уже сжатые форматы (изображения, видео) и SSE
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

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
    
    // В режиме разработки разрешить все
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
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

// 🗺️ Sitemap & robots.txt — SEO
const { default: sitemapRoutes } = require(`${srcPath}/routes/sitemapRoutes${isProduction ? '.js' : '.ts'}`);
app.use('/', sitemapRoutes);

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

// Payment selection page - explicit route BEFORE static middleware
app.get('/payment-selection.html', (req, res) => {
  console.log('💳 Serving payment-selection.html with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'payment-selection.html'));
});

// Payment success/fail pages - explicit routes BEFORE static middleware
// Support both with and without .html extension
app.get('/payment-success.html', (req, res) => {
  console.log('✅ Serving payment-success.html with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'payment-success.html'));
});

app.get('/payment-success', (req, res) => {
  console.log('✅ Serving payment-success (no .html) with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'payment-success.html'));
});

app.get('/payment-fail.html', (req, res) => {
  console.log('❌ Serving payment-fail.html with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'payment-fail.html'));
});

app.get('/payment-fail', (req, res) => {
  console.log('❌ Serving payment-fail (no .html) with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'payment-fail.html'));
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

// Leave Review page - explicit route for query params support
app.get('/leave-review.html', (req, res) => {
  console.log('⭐ Serving leave-review.html with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'leave-review.html'));
});

app.get('/leave-review', (req, res) => {
  console.log('⭐ Serving leave-review (no .html) with params:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'leave-review.html'));
});

// 🔗 TOUR PAGE WITH DYNAMIC OG TAGS FOR SOCIAL MEDIA SHARING
const fs = require('fs');
// ♻️ Используем ЕДИНЫЙ Prisma-клиент (singleton) вместо отдельного пула подключений.
// Раньше здесь был new PrismaClient() — отдельный пул, который вместе с другими
// дублирующими клиентами исчерпывал лимит подключений к БД на проде → 504.
const prismaOG = require(`${srcPath}/config/database${isProduction ? '.js' : '.ts'}`).default;
// 🚀 Общий in-memory кэш (тот же инстанс, что и в контроллерах) — для OG-тегов туров.
const { tourCache } = require(`${srcPath}/utils/cache${isProduction ? '.js' : '.ts'}`);

// Helper: safe JSON parse that never throws
function safeParseOG(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (e) { return null; }
}

// Helper: escape special HTML characters for use inside attribute values
function escapeHtmlAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper: resolve image URL to a publicly accessible absolute URL
function resolveOGImageUrl(imagePath, baseUrl) {
  if (!imagePath) return `${baseUrl}/public/images/default-slide-1.jpg`;
  // Already absolute
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  // Object storage paths served via /api/objects/direct/
  if (imagePath.startsWith('/objects/') || imagePath.startsWith('objects/')) {
    const normalized = imagePath.startsWith('/') ? imagePath : '/' + imagePath;
    return `${baseUrl}/api/objects/direct${normalized.replace(/^\/objects/, '')}`;
  }
  // Regular public path
  return `${baseUrl}${imagePath.startsWith('/') ? imagePath : '/' + imagePath}`;
}

// Helper: resolve the public base URL — never use localhost (crawlers can't reach it)
function getPublicBaseUrl(req) {
  const configured = process.env.BASE_URL || '';
  const isLocalhost = /localhost|127\.0\.0\.1/.test(configured);
  if (configured && !isLocalhost) return configured.replace(/\/$/, '');
  return `https://${req.get('host')}`;
}

// 📄 Шаблон tour-template.html читаем ОДИН раз и держим в памяти.
// Раньше тут был синхронный fs.readFileSync на КАЖДЫЙ запрос — он блокировал
// event loop и был одной из причин таймаутов (504) даже на статике.
let cachedTourTemplate = null;
function getTourTemplate() {
  if (cachedTourTemplate !== null) return cachedTourTemplate;
  try {
    cachedTourTemplate = fs.readFileSync(path.join(__dirname, 'frontend', 'tour-template.html'), 'utf8');
  } catch (readErr) {
    console.error('❌ Cannot read tour-template.html:', readErr);
    return null;
  }
  return cachedTourTemplate;
}

// Shared: inject OG tags into tour HTML and return it
async function buildTourHtmlWithOG(req, tourId) {
  const baseHtml = getTourTemplate();
  if (baseHtml === null) return null;
  if (!tourId) return baseHtml;

  const id = parseInt(tourId, 10);
  if (!Number.isFinite(id)) return baseHtml;

  const baseUrl = getPublicBaseUrl(req);
  const cacheKey = `tour_og_${id}_${baseUrl}`;

  try {
    // OG-теги кэшируем на 5 минут (ключ содержит 'tour' → clearTourCache их сбрасывает).
    let ogTags = tourCache.get(cacheKey);

    if (ogTags === undefined) {
      const tour = await prismaOG.tour.findUnique({
        where: { id },
        select: { id: true, title: true, description: true, images: true, mainImage: true }
      });

      if (!tour) {
        // Кэшируем "не найдено" коротко, чтобы не долбить БД на несуществующие id
        tourCache.set(cacheKey, '', 60 * 1000);
        return baseHtml;
      }

      const nameData = safeParseOG(tour.title);
      const descData = safeParseOG(tour.description);

      const rawNameEn = nameData?.en || nameData?.ru || 'Tour';
      const rawDesc = (descData?.en || descData?.ru || 'Discover amazing tours across Central Asia with Bunyod-Tour.').substring(0, 200);

      const tourName = escapeHtmlAttr(rawNameEn);
      const tourDesc = escapeHtmlAttr(rawDesc);

      // Resolve image URL — prefer mainImage, fall back to first image in array
      let rawImagePath = null;
      if (tour.mainImage) {
        rawImagePath = tour.mainImage;
      } else if (tour.images) {
        const imagesArr = safeParseOG(tour.images);
        if (Array.isArray(imagesArr) && imagesArr.length > 0) {
          rawImagePath = imagesArr[0];
        }
      }

      const absoluteImageUrl = resolveOGImageUrl(rawImagePath, baseUrl);
      // Canonical URL always points to /tour.html for consistency
      const pageUrl = `${baseUrl}/tour.html?id=${tour.id}`;

      ogTags = `
    <!-- Open Graph Meta Tags for Social Media Sharing -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${tourName} - Bunyod-Tour">
    <meta property="og:description" content="${tourDesc}">
    <meta property="og:image" content="${absoluteImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:site_name" content="Bunyod-Tour">
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${tourName} - Bunyod-Tour">
    <meta name="twitter:description" content="${tourDesc}">
    <meta name="twitter:image" content="${absoluteImageUrl}">
`;
      tourCache.set(cacheKey, ogTags, 5 * 60 * 1000);
    }

    if (!ogTags) return baseHtml;
    return baseHtml.replace('<head>', '<head>' + ogTags);
  } catch (dbErr) {
    console.error('❌ DB error while generating OG tags:', dbErr);
    return baseHtml;
  }
}

app.get('/tour-template.html', async (req, res) => {
  const tourId = req.query.id || req.query.tour;
  console.log('🎫 Serving tour page (tour-template.html) with OG tags, ID:', tourId);
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  const html = await buildTourHtmlWithOG(req, tourId);
  if (!html) return res.status(500).send('Internal Server Error');
  res.send(html);
});

// 🔌 BACKEND API ROUTES: Условная загрузка для dev/prod
try {
  // Парсеры JSON/urlencoded для обычных API запросов
  const jsonParser = express.json({ limit: '50mb' });
  const urlencodedParser = express.urlencoded({ extended: true, limit: '50mb' });
  
  app.use('/api', (req, res, next) => {
    // Skip JSON parsing for multipart/form-data
    const contentType = req.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      return next();
    }
    
    jsonParser(req, res, (err) => {
      if (err) return next(err);
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
  // Декодируем URL для проверки (с защитой от malformed URI)
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(req.url);
  } catch (e) {
    // Если URL содержит некорректные символы, используем оригинал
    decodedUrl = req.url;
  }
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
app.use('/api/objects/direct', express.static(path.join(__dirname, 'uploads/images'), {
  maxAge: '30d',
  immutable: true
}));

// Create static file handlers once with caching for performance
const staticOptions = { maxAge: '30d', immutable: true };
const guidesStaticHandler = express.static(path.join(__dirname, 'uploads/guides'), staticOptions);
const slidesStaticHandler = express.static(path.join(__dirname, 'uploads/slides'), staticOptions);
const imagesStaticHandler = express.static(path.join(__dirname, 'uploads/images'), staticOptions);
const vehiclesStaticHandler = express.static(path.join(__dirname, 'uploads/vehicles'), staticOptions);

// Add secure route for tour guide photos (only images, not documents)
app.use('/uploads/guides', (req, res, next) => {
  // Security: Only allow image files, block documents
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const fileExtension = path.extname(req.path).toLowerCase();
  
  if (allowedExtensions.includes(fileExtension)) {
    guidesStaticHandler(req, res, next);
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
    slidesStaticHandler(req, res, next);
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Access denied: Only image files are allowed' 
    });
  }
});

// Add secure route for general images (tours, hotels, etc.)
app.use('/uploads/images', (req, res, next) => {
  // Security: Only allow image files
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const fileExtension = path.extname(req.path).toLowerCase();
  
  if (allowedExtensions.includes(fileExtension)) {
    imagesStaticHandler(req, res, next);
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Access denied: Only image files are allowed' 
    });
  }
});

// Add secure route for vehicle photos (only images)
app.use('/uploads/vehicles', (req, res, next) => {
  // Security: Only allow image files for vehicles
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const fileExtension = path.extname(req.path).toLowerCase();
  
  if (allowedExtensions.includes(fileExtension)) {
    console.log('✅ Serving vehicle image:', req.path);
    vehiclesStaticHandler(req, res, next);
  } else {
    console.log('❌ Blocked non-image request to vehicles:', req.path);
    res.status(403).json({ 
      success: false, 
      message: 'Access denied: Only image files are allowed' 
    });
  }
});

// Add upload routes for simple image handling
const uploadRoutes = require(`${srcPath}/routes/uploadRoutes${isProduction ? '.js' : '.ts'}`).default;
app.use('/upload', uploadRoutes);

// Tour template page - handled by OG tags route above (line ~161)
// Removed duplicate route to avoid conflict with dynamic OG tags generation

// Tour page - with OG tag injection (same as /tour-template.html)
app.get('/tour.html', async (req, res) => {
  const tourId = req.query.id || req.query.tour;
  console.log('🎯 Serving tour page (tour.html) with OG tags, ID:', tourId);
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  const html = await buildTourHtmlWithOG(req, tourId);
  if (!html) return res.status(500).send('Internal Server Error');
  res.send(html);
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

// News pages - explicit routes BEFORE static middleware
app.get('/news.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'news.html'));
});

app.get('/news-detail.html', (req, res) => {
  console.log('📰 Serving news detail page with query:', req.query);
  res.sendFile(path.join(__dirname, 'frontend', 'news-detail.html'));
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

// Обслуживать статические файлы из папки frontend с кэшированием для производительности
app.use(express.static(path.join(__dirname, 'frontend'), {
  maxAge: '1d',
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
    else if (filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    // Кэшировать изображения на 30 дней
    else if (filePath.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
    // HTML файлы - не кэшировать
    else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

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