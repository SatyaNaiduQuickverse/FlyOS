// services/drone-db-service/src/routes/droneRoutes.ts
import express from 'express';
import { 
  getAllDronesController,
  getDroneStateController, 
  storeTelemetryController, 
  getHistoricalTelemetryController,
  sendCommandController,
  getCommandHistoryController
} from '../controllers/droneController';
import { authenticateSupabase } from '../middleware/supabase-auth';

const router = express.Router();

// Apply ONLY Supabase authentication to all routes
router.use(authenticateSupabase);

// Drone routes
router.get('/', getAllDronesController);
router.get('/:droneId/state', getDroneStateController);
router.post('/:droneId/telemetry', storeTelemetryController);
router.get('/:droneId/telemetry', getHistoricalTelemetryController);
router.post('/:droneId/command', sendCommandController);
router.get('/:droneId/commands', getCommandHistoryController);

export default router;
