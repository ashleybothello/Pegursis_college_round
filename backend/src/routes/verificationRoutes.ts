import { Router } from 'express';
import { createVerificationController } from '../controllers/verificationController.js';
import { VerificationOrchestrator } from '../services/verificationOrchestrator.js';

export function createVerificationRouter(orchestrator: VerificationOrchestrator): Router {
  const router = Router();
  const controller = createVerificationController(orchestrator);

  // Keep collection routes before /:taskId so they are not interpreted as IDs.
  router.get('/audit/events', controller.handleGetAuditEvents);

  // POST /api/verification/submit
  router.post('/submit', controller.handleSubmitVerification);

  router.get('/:taskId/dispute', controller.handleGetDispute);
  router.post('/:taskId/dispute', controller.handleRaiseDispute);
  router.post('/:taskId/dispute/resolve', controller.handleResolveDispute);
  router.get('/:taskId/integrity', controller.handleCheckIntegrity);

  // GET /api/verification/:taskId
  router.get('/:taskId', controller.handleGetVerificationStatus);

  return router;
}
