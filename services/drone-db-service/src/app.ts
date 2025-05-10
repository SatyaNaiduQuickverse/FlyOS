import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import droneRoutes from './routes/droneRoutes';
import { initDatabase } from './database';
import { initRedis } from './redis';
import { logger } from './utils/logger';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Routes
app.use('/api/drones', droneRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    // Initialize database connections
    await initDatabase();
    await initRedis();
    
    app.listen(PORT, () => {
      logger.info(`Drone data service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
