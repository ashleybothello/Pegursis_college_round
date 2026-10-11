import { Request, Response } from 'express';
import { config } from '../config/index.js';
import { ApiSuccessResponse } from '../types/index.js';

export function handleHealthCheck(req: Request, res: Response): void {
  const response: ApiSuccessResponse<{
    status: string;
    version: string;
    timestamp: string;
    uptime: number;
    proofMode: 'mock' | 'real';
    blockchainMode: 'mock' | 'real';
  }> = {
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      proofMode: config.PROOF_MODE,
      blockchainMode: config.BLOCKCHAIN_MODE,
    },
  };

  res.status(200).json(response);
}
