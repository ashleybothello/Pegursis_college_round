import { Router } from 'express';
import { handleEmiCalculate } from '../controllers/emiController.js';

const router = Router();

// POST /api/emi/calculate
router.post('/calculate', handleEmiCalculate);

export default router;
