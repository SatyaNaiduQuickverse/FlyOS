import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';

// PostgreSQL connection for raw queries (TimescaleDB specific operations)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Prisma client for standard database operations
const prisma = new PrismaClient();

// Initialize database connections
const initDatabase = async () => {
  try {
    // Test PostgreSQL connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info(`PostgreSQL connected: ${result.rows[0].now}`);
    client.release();
    
    // Test Prisma connection
    await prisma.$connect();
    logger.info('Prisma client connected');
    
    return { pool, prisma };
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

export { initDatabase, pool, prisma };
