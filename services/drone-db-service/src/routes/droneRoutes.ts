import express from 'express';
import { 
  getDroneStateController, 
  storeTelemetryController, 
  getHistoricalTelemetryController,
  sendCommandController,
  getCommandHistoryController
} from '../controllers/droneController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Drone state and telemetry routes
router.get('/:droneId/state', getDroneStateController);
router.post('/:droneId/telemetry', storeTelemetryController);
router.get('/:droneId/telemetry', getHistoricalTelemetryController);

// Command routes
router.post('/:droneId/command', sendCommandController);
router.get('/:droneId/commands', getCommandHistoryController);

export default router;
