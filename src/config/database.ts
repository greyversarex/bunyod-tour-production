import { PrismaClient } from '@prisma/client';

// Global variable to store Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client instance with better error handling and retry logic
const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  errorFormat: 'minimal'
});

// In development, store the instance globally to prevent multiple instances
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

// Add connection retry wrapper for database operations
export async function withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a connection error that we can retry
      const isRetryable = error?.code === 'P1001' || // Connection refused
                         error?.code === 'P1017' || // Connection lost
                         error?.message?.includes('terminating connection') ||
                         error?.message?.includes('Connection refused');
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      console.log(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${attempt * 1000}ms...`);
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  
  throw lastError;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
