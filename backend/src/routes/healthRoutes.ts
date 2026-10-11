import { Router } from 'express';
import { handleHealthCheck } from '../controllers/healthController.js';

const router = Router();

// GET /api/health
router.get('/', handleHealthCheck);

export default router;
