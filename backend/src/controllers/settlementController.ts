import { Request, Response, NextFunction } from 'express';
import { settlementInputSchema } from '../schemas/settlementSchema.js';
import { calculateSettlement } from '../services/settlement.js';
import { ApiSuccessResponse, SettlementResult } from '../types/index.js';

export function handleSettlementCalculate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const validatedInput = settlementInputSchema.parse(req.body);
    const result = calculateSettlement(validatedInput);

    const response: ApiSuccessResponse<SettlementResult> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
