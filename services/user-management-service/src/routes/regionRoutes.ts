// services/user-management-service/src/routes/regionRoutes.ts
import express from 'express';
import {
  getRegionsController,
  getRegionController,
  createRegionController,
  updateRegionController,
  deleteRegionController
} from '../controllers/regionController';
import { authenticate, requireMainHQ, requireRegionalHQOrHigher } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/regions - List all regions (all authenticated users can see regions)
router.get('/', getRegionsController);

// GET /api/regions/:id - Get single region
router.get('/:id', getRegionController);

// POST /api/regions - Create region (MAIN_HQ only)
router.post('/', requireMainHQ, createRegionController);

// PUT /api/regions/:id - Update region (MAIN_HQ only)
router.put('/:id', requireMainHQ, updateRegionController);

// DELETE /api/regions/:id - Delete region (MAIN_HQ only)
router.delete('/:id', requireMainHQ, deleteRegionController);

export default router;