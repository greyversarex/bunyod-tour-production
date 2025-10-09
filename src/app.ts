import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

// CORS configuration - support multiple environments
const getAllowedOrigins = () => {
  const origins = [];
  
  // Add environment-specific frontend URL
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Development origins
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5000', 'http://127.0.0.1:5000', 'http://0.0.0.0:5000');
  }
  
  // Production origins (Replit deployment URLs)
  if (process.env.REPLIT_DEV_DOMAIN) {
    origins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  
  return origins.length > 0 ? origins : true; // Allow all if no specific origins
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use('/api', routes);

// Root endpoint - redirect to frontend
app.get('/', (req, res) => {
  // If request comes from browser, redirect to frontend
  const userAgent = req.get('User-Agent') || '';
  const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari');
  
  if (isBrowser) {
    // Get the current host and replace port 3001 with 5000
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host') || 'localhost:3001';
    const frontendHost = host.replace(':3001', ':5000').replace(':80', ':5000');
    const frontendUrl = `${protocol}://${frontendHost}`;
    
    res.redirect(302, frontendUrl);
  } else {
    // For API clients, return JSON
    res.json({
      success: true,
      message: 'Welcome to Tajik Trails API',
      version: '1.0.0',
      documentation: '/api/health',
      frontend: 'Redirect your browser to port 5000 for the website'
    });
  }
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
