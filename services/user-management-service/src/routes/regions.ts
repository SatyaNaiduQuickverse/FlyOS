import express from 'express';
import { createRegion, updateRegion, deleteRegion, getRegions, getRegionById } from '../services/regionService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const regions = await getRegions();
    res.json({ success: true, regions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get regions', error: error.message });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const region = await getRegionById(req.params.id);
    if (!region) {
      return res.status(404).json({ success: false, message: 'Region not found' });
    }
    res.json({ success: true, region });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get region', error: error.message });
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'MAIN_HQ') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    const region = await createRegion(req.body);
    res.status(201).json({ success: true, region });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create region', error: error.message });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'MAIN_HQ') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    const region = await updateRegion(req.params.id, req.body);
    res.json({ success: true, region });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update region', error: error.message });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'MAIN_HQ') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    await deleteRegion(req.params.id);
    res.json({ success: true, message: 'Region deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete region', error: error.message });
  }
});

export default router;
