// services/drone-db-service/src/routes/droneRoutes.ts - EXTENDED WITH PRECISION LANDING
import express from 'express';
import { 
  getAllDronesController,
  getDroneStateController, 
  storeTelemetryController, 
  getHistoricalTelemetryController,
  sendCommandController,
  getCommandHistoryController,
  getMissionHistoryController,
  storePrecisionLandingController,
  getPrecisionLandingHistoryController,
  getPrecisionLandingSessionController
} from '../controllers/droneController';

// Import MAVROS controllers
import {
  storeMAVROSMessageController,
  getMAVROSLogsController,
  getMAVROSStatusController,
  getMAVROSStatisticsController,
  getMAVROSSessionController,
  searchMAVROSLogsController,
  getMAVROSBufferController,
  cleanupMAVROSDataController
} from '../controllers/mavrosController';

import { authenticateSupabase } from '../middleware/supabase-auth';

const router = express.Router();

// Apply Supabase authentication to all routes
router.use(authenticateSupabase);

// Core drone routes
router.get('/', getAllDronesController);
router.get('/:droneId/state', getDroneStateController);
router.post('/:droneId/telemetry', storeTelemetryController);
router.get('/:droneId/telemetry', getHistoricalTelemetryController);
router.post('/:droneId/command', sendCommandController);
router.get('/:droneId/commands', getCommandHistoryController);
router.get('/:droneId/missions', getMissionHistoryController);

// NEW: Precision Landing routes
router.post('/:droneId/precision-landing', storePrecisionLandingController);
router.get('/:droneId/precision-landing', getPrecisionLandingHistoryController);
router.get('/:droneId/precision-landing/session/:sessionId', getPrecisionLandingSessionController);

// MAVROS ROUTES
// Store MAVROS message (typically called by drone-connection-service)
router.post('/:droneId/mavros/message', storeMAVROSMessageController);

// Get MAVROS logs with filtering and pagination
router.get('/:droneId/mavros/logs', getMAVROSLogsController);

// Get current MAVROS status for a drone
router.get('/:droneId/mavros/status', getMAVROSStatusController);

// Get MAVROS statistics for a time period
router.get('/:droneId/mavros/statistics', getMAVROSStatisticsController);

// Get specific MAVROS session information
router.get('/:droneId/mavros/session/:sessionId', getMAVROSSessionController);

// Search MAVROS logs with full-text search
router.get('/:droneId/mavros/search', searchMAVROSLogsController);

// Get real-time MAVROS message buffer from Redis
router.get('/:droneId/mavros/buffer', getMAVROSBufferController);

// Admin-only routes for MAVROS data management
router.delete('/mavros/cleanup', cleanupMAVROSDataController);

export default router;