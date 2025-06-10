// services/drone-db-service/src/routes/droneRoutes.ts - ENHANCED WITH MISSIONS
import express from 'express';
import { 
  getAllDronesController,
  getDroneStateController, 
  storeTelemetryController, 
  getHistoricalTelemetryController,
  sendCommandController,
  getCommandHistoryController,
  getMissionHistoryController
} from '../controllers/droneController';
import { authenticateSupabase } from '../middleware/supabase-auth';

const router = express.Router();

// Apply Supabase authentication to all routes
router.use(authenticateSupabase);

// Existing drone routes
router.get('/', getAllDronesController);
router.get('/:droneId/state', getDroneStateController);
router.post('/:droneId/telemetry', storeTelemetryController);
router.get('/:droneId/telemetry', getHistoricalTelemetryController);
router.post('/:droneId/command', sendCommandController); // This now handles mission commands too
router.get('/:droneId/commands', getCommandHistoryController);

// New mission-specific routes
router.get('/:droneId/missions', getMissionHistoryController);

export default router;