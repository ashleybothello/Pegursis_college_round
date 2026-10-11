import { Request, Response, NextFunction } from 'express';
import { fraudInputSchema } from '../schemas/fraudSchema.js';
import { evaluateFraudRisk } from '../services/fraudScoring.js';
import { ApiSuccessResponse, FraudRiskResult } from '../types/index.js';

export function handleFraudScore(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const validatedInput = fraudInputSchema.parse(req.body);
    const result = evaluateFraudRisk(validatedInput);

    const response: ApiSuccessResponse<FraudRiskResult> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
