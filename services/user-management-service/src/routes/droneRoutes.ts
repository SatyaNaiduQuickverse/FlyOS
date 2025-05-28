// services/user-management-service/src/routes/droneRoutes.ts
import express from 'express';
import {
  getDronesController,
  getDroneController,
  createDroneController,
  updateDroneController,
  assignDroneController,
  deleteDroneController
} from '../controllers/droneController';
import { authenticate, requireMainHQ, requireRegionalHQOrHigher } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/drones - List drones (with role-based filtering)
router.get('/', getDronesController);

// GET /api/drones/:id - Get single drone
router.get('/:id', getDroneController);

// POST /api/drones - Create drone (MAIN_HQ only)
router.post('/', requireMainHQ, createDroneController);

// PUT /api/drones/:id - Update drone (Regional HQ+ can update drones in their region)
router.put('/:id', requireRegionalHQOrHigher, updateDroneController);

// PUT /api/drones/:id/assign - Assign/unassign drone (Regional HQ+ for their region)
router.put('/:id/assign', requireRegionalHQOrHigher, assignDroneController);

// DELETE /api/drones/:id - Delete drone (MAIN_HQ only)
router.delete('/:id', requireMainHQ, deleteDroneController);

export default router;