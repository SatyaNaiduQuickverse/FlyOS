// services/drone-db-service/src/routes/droneRoutes.ts
import express from 'express';
import { 
  getAllDronesController,  // NEW - this was missing!
  getDroneStateController, 
  storeTelemetryController, 
  getHistoricalTelemetryController,
  sendCommandController,
  getCommandHistoryController
} from '../controllers/droneController';
import { authenticateSupabase } from '../middleware/supabase-auth';

const router = express.Router();

// Apply Supabase authentication to all routes
router.use(authenticateSupabase);

// Root route to get all drones (THIS WAS THE MISSING ROUTE!)
router.get('/', getAllDronesController);

// Drone state and telemetry routes
router.get('/:droneId/state', getDroneStateController);
router.post('/:droneId/telemetry', storeTelemetryController);
router.get('/:droneId/telemetry', getHistoricalTelemetryController);

// Command routes
router.post('/:droneId/command', sendCommandController);
router.get('/:droneId/commands', getCommandHistoryController);

export default router;