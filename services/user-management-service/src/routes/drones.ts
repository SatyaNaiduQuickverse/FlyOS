import express from 'express';
import { createDrone, updateDrone, deleteDrone, getDrones, getDroneById } from '../services/droneService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const options = {
      status: req.query.status as string,
      regionId: req.query.regionId as string,
      operatorId: req.query.operatorId as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      requestingUserRole: req.user!.role as any,
      requestingUserId: req.user!.id
    };
    const result = await getDrones(options);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get drones', error: error.message });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const drone = await getDroneById(req.params.id);
    if (!drone) {
      return res.status(404).json({ success: false, message: 'Drone not found' });
    }
    res.json({ success: true, drone });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get drone', error: error.message });
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'MAIN_HQ') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    const drone = await createDrone(req.body);
    res.status(201).json({ success: true, drone });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create drone', error: error.message });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const drone = await updateDrone(req.params.id, req.body);
    res.json({ success: true, drone });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update drone', error: error.message });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'MAIN_HQ') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    await deleteDrone(req.params.id);
    res.json({ success: true, message: 'Drone deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete drone', error: error.message });
  }
});

export default router;
