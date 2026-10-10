import { Router } from 'express';
import { handleFraudScore } from '../controllers/fraudController.js';

const router = Router();

// POST /api/fraud/score
router.post('/score', handleFraudScore);

export default router;
