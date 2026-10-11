import { Router } from 'express';
import creditRoutes from './creditRoutes.js';
import emiRoutes from './emiRoutes.js';
import fraudRoutes from './fraudRoutes.js';
import settlementRoutes from './settlementRoutes.js';
import { createVerificationRouter } from './verificationRoutes.js';
import healthRoutes from './healthRoutes.js';
import { VerificationOrchestrator } from '../services/verificationOrchestrator.js';
import { platformRoutes } from './platformRoutes.js';

export function createApiRouter(orchestrator: VerificationOrchestrator): Router {
  const router = Router();

  router.use('/credit', creditRoutes);
  router.use('/emi', emiRoutes);
  router.use('/fraud', fraudRoutes);
  router.use('/settlements', settlementRoutes);
  router.use('/verification', createVerificationRouter(orchestrator));
  router.use('/health', healthRoutes);
  router.use('/platform', platformRoutes);

  return router;
}
