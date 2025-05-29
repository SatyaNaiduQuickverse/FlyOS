import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'User Management Service',
    timestamp: new Date().toISOString()
  });
});

export default router;
