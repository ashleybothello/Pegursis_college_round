import { Router } from 'express';
import { handleSettlementCalculate } from '../controllers/settlementController.js';

const router = Router();

// POST /api/settlements/calculate
router.post('/calculate', handleSettlementCalculate);

export default router;
