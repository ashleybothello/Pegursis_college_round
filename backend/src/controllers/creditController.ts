import { Request, Response, NextFunction } from 'express';
import { creditInputSchema } from '../schemas/creditSchema.js';
import { calculateCreditScore } from '../services/creditScoring.js';
import { ApiSuccessResponse, CreditScoringResult } from '../types/index.js';

export function handleCreditScore(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const validatedInput = creditInputSchema.parse(req.body);
    const result = calculateCreditScore(validatedInput);

    const response: ApiSuccessResponse<CreditScoringResult> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
