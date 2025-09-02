// services/user-management-service/src/app.ts - SIMPLE FIXED VERSION
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { initDatabase, prisma } from "./database";
import { logger } from "./utils/logger";

import userRoutes from "./routes/users";
import regionRoutes from "./routes/regions";
import droneRoutes from "./routes/drones";

const app = express();
const PORT = process.env.PORT || 4003;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "user-management-service" });
});

app.use("/api/users", userRoutes);
app.use("/api/regions", regionRoutes);
app.use("/api/drones", droneRoutes);

const waitForDatabase = async (maxRetries = 30) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('✅ Database connection verified');
      return true;
    } catch (error) {
      logger.info(`⏳ Database not ready (attempt ${i + 1}/${maxRetries}), waiting...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Database connection failed after maximum retries');
};

const startServer = async () => {
  try {
    logger.info('🚀 Starting user management service...');
    
    // Step 1: Wait for database
    await waitForDatabase();
    
    // Step 2: Initialize database connection
    await initDatabase();
    
    // Step 3: Start server
    app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
    });
    
  } catch (error) {
    logger.error('💥 Failed to start server:', error);
    // Don't exit immediately, wait and retry
    setTimeout(() => {
      startServer();
    }, 5000);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
