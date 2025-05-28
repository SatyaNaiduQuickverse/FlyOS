// services/user-management-service/src/routes/userRoutes.ts
import express from 'express';
import {
  getUsersController,
  getUserController,
  createUserController,
  updateUserController,
  deleteUserController
} from '../controllers/userController';
import { authenticate, requireMainHQ, requireRegionalHQOrHigher } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/users - List users (Regional HQ can only see their region)
router.get('/', requireRegionalHQOrHigher, getUsersController);

// GET /api/users/:id - Get single user
router.get('/:id', requireRegionalHQOrHigher, getUserController);

// POST /api/users - Create user (MAIN_HQ only)
router.post('/', requireMainHQ, createUserController);

// PUT /api/users/:id - Update user (MAIN_HQ only)
router.put('/:id', requireMainHQ, updateUserController);

// DELETE /api/users/:id - Delete user (MAIN_HQ only)
router.delete('/:id', requireMainHQ, deleteUserController);

export default router;