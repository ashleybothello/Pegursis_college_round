import { Router } from 'express';
import { handleCreditScore } from '../controllers/creditController.js';

const router = Router();

// POST /api/credit/score
router.post('/score', handleCreditScore);

export default router;
