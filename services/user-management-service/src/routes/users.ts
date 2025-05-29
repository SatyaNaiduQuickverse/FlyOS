import express from 'express';
import { createUser, updateUser, deleteUser, getUsers, getUserById } from '../services/userService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const options = {
      role: req.query.role as string,
      regionId: req.query.regionId as string,
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      requestingUserRole: req.user!.role as any
    };
    const result = await getUsers(options);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get users', error: error.message });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get user', error: error.message });
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'MAIN_HQ') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    const user = await createUser(req.body);
    res.status(201).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create user', error: error.message });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'MAIN_HQ') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    const user = await updateUser(req.params.id, req.body);
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== 'MAIN_HQ') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    await deleteUser(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
});

export default router;
