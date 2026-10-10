import { Request, Response, NextFunction } from 'express';
import { emiInputSchema } from '../schemas/emiSchema.js';
import { calculateEmi } from '../services/emiCalculator.js';
import { ApiSuccessResponse, EmiCalculationResult } from '../types/index.js';

export function handleEmiCalculate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const validatedInput = emiInputSchema.parse(req.body);
    const result = calculateEmi(validatedInput);

    const response: ApiSuccessResponse<EmiCalculationResult> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
