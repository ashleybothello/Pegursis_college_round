import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { requestLogger } from './middleware/logger.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/index.js';
import { createProofService } from './services/proofService.js';
import { createBlockchainService } from './services/blockchainService.js';
import { VerificationOrchestrator } from './services/verificationOrchestrator.js';
import { ApiErrorResponse } from './types/index.js';

export interface AppDependencies {
  orchestrator?: VerificationOrchestrator;
}

export function createApp(dependencies?: AppDependencies): Express {
  const app = express();

  // Core middleware
  app.use(cors());
  app.use(express.json());

  // Privacy-preserving request logging
  app.use(requestLogger);

  // Rate limiting
  const rateLimiter = createRateLimiter({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  });
  app.use('/api', rateLimiter);

  // Dependency injection: build or use supplied orchestrator
  let orchestrator = dependencies?.orchestrator;
  if (!orchestrator) {
    const proofService = createProofService({
      proofMode: config.PROOF_MODE,
      circuitWasmPath: config.CIRCUIT_WASM_PATH,
      circuitZkeyPath: config.CIRCUIT_ZKEY_PATH,
      verificationKeyPath: config.VERIFICATION_KEY_PATH,
    });

    const blockchainService = createBlockchainService({
      blockchainMode: config.BLOCKCHAIN_MODE,
      rpcUrl: config.RPC_URL,
      privateKey: config.PRIVATE_KEY,
      contractAddress: config.CONTRACT_ADDRESS,
      abiPath: config.CONTRACT_ABI_PATH,
    });

    orchestrator = new VerificationOrchestrator({
      proofService,
      blockchainService,
      proofMode: config.PROOF_MODE,
      blockchainMode: config.BLOCKCHAIN_MODE,
    });
  }

  // Mount API router
  app.use('/api', createApiRouter(orchestrator));

  // Catch-all 404 handler
  app.use((req: Request, res: Response) => {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      },
    };
    res.status(404).json(response);
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

export const defaultApp = createApp();
