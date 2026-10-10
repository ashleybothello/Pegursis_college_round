import { Router } from 'express';
import { createVerificationController } from '../controllers/verificationController.js';
import { VerificationOrchestrator } from '../services/verificationOrchestrator.js';

export function createVerificationRouter(orchestrator: VerificationOrchestrator): Router {
  const router = Router();
  const controller = createVerificationController(orchestrator);

  // GET /api/verification?limit=20 — in-memory audit records for this process.
  router.get('/', controller.handleListVerificationStatuses);

  // POST /api/verification/submit
  router.post('/submit', controller.handleSubmitVerification);

  // POST /api/verification/:taskId/offchain — recheck a stored proof. Passing
  // claimedScore intentionally exercises the public-signal tamper path.
  router.post('/:taskId/offchain', controller.handleOffchainVerification);

  // GET /api/verification/:taskId
  router.get('/:taskId', controller.handleGetVerificationStatus);

  return router;
}
