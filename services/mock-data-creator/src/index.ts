import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { startSimulation } from './services/simulation';
import { initDatabase } from './database/init';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Parse command line arguments
const program = new Command();

program
  .name('flyos-mock-data-creator')
  .description('Mock data creator for FlyOS drone system testing')
  .version('1.0.0');

program
  .option('-d, --drones <number>', 'Number of drones to simulate', '10')
  .option('-t, --duration <minutes>', 'Test duration in minutes (0 for continuous)', '0')
  .option('-i, --interval <ms>', 'Telemetry update interval in milliseconds', '1000')
  .option('-u, --api-url <url>', 'Drone DB service URL', 'http://localhost:4001')
  .option('-r, --realtime-url <url>', 'Realtime service URL', 'http://localhost:4002')
  .option('-j, --jwt <token>', 'JWT token for authentication')
  .option('-m, --max-drones <number>', 'Maximum number of drones during scaling', '20')
  .option('-s, --scale-interval <minutes>', 'Interval for scaling drone count', '2');

program.parse();

const options = program.opts();

// Configuration for the simulation
const config = {
  droneCount: parseInt(options.drones, 10),
  testDurationMinutes: parseInt(options.duration, 10),
  telemetryIntervalMs: parseInt(options.interval, 10),
  apiUrl: options.apiUrl,
  realtimeUrl: options.realtimeUrl,
  jwtToken: options.jwt || process.env.JWT_TOKEN,
  maxDroneCount: parseInt(options.maxDrones, 10),
  scaleIntervalMinutes: parseInt(options.scaleInterval, 10)
};

// Start the application
const main = async () => {
  try {
    logger.info('Starting FlyOS Mock Data Creator');
    logger.info(`Configuration: ${JSON.stringify(config, null, 2)}`);
    
    // Initialize database for metrics (if needed) - make this optional
    let dbInitialized = false;
    try {
      await initDatabase();
      dbInitialized = true;
      logger.info('Database initialized successfully');
    } catch (dbError) {
      logger.warn('Database initialization failed, continuing without metrics storage:', dbError);
      // Continue without database
    }
    
    // Start the simulation
    await startSimulation(config, dbInitialized);
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
};

main();