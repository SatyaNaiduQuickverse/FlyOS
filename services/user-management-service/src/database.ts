// services/user-management-service/src/database.ts
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';

// Create Prisma client instance
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Database Query:', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`
    });
  });
}

// Log database errors
prisma.$on('error', (e) => {
  logger.error('Database Error:', e);
});

// Log database info
prisma.$on('info', (e) => {
  logger.info('Database Info:', e.message);
});

// Log database warnings
prisma.$on('warn', (e) => {
  logger.warn('Database Warning:', e.message);
});

// Initialize database connection
export const initDatabase = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection test passed');
    
    return prisma;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Graceful shutdown
export const closeDatabase = async () => {
  try {
    await prisma.$disconnect();
    logger.info('✅ Database disconnected successfully');
  } catch (error) {
    logger.error('❌ Database disconnect failed:', error);
  }
};

// Handle process termination
process.on('beforeExit', async () => {
  await closeDatabase();
});

export { prisma };
export default prisma;
