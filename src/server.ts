import app from './app';
import prisma from './config/database';

// Port configuration for different environments
// Production: Use PORT from environment (Replit Autoscale uses port 80)
// Development: Use 3001 to match the workflow configuration
const PORT = process.env.PORT 
  ? parseInt(process.env.PORT, 10)
  : (process.env.NODE_ENV === 'production' ? 80 : 3001);
const HOST = '0.0.0.0';

async function startServer() {
  try {
    // Note: Environment validation (including JWT_SECRET) is performed in index.js
    // via validateEnvironment() before this server is started
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Start the server
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Tajik Trails API server is running on http://${HOST}:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5000'}`);
      console.log(`🔗 Health check: http://${HOST}:${PORT}/api/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(async () => {
        console.log('HTTP server closed');
        await prisma.$disconnect();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(async () => {
        console.log('HTTP server closed');
        await prisma.$disconnect();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
