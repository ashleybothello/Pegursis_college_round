import { Request, Response, NextFunction } from 'express';
import { verificationSubmissionSchema } from '../schemas/verificationSchema.js';
import { VerificationOrchestrator } from '../services/verificationOrchestrator.js';
import { z } from 'zod';
import { ApiErrorResponse, ApiSuccessResponse, VerificationSubmissionResponse } from '../types/index.js';

const tamperSchema = z.object({
  claimedScore: z.number().int().min(0).max(2000).optional(),
});

export function createVerificationController(orchestrator: VerificationOrchestrator) {
  return {
    handleSubmitVerification: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const validatedInput = verificationSubmissionSchema.parse(req.body);
        const { incomeIndex, repaymentIndex, historyIndex, salt } = validatedInput;

        const result = await orchestrator.submitVerification(
          { incomeIndex, repaymentIndex, historyIndex },
          salt
        );

        const response: ApiSuccessResponse<VerificationSubmissionResponse> = {
          success: true,
          data: result,
        };

        res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    },

    handleGetVerificationStatus: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { taskId } = req.params;
        if (!taskId) {
          const errResponse: ApiErrorResponse = {
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: 'taskId path parameter is required',
            },
          };
          res.status(400).json(errResponse);
          return;
        }

        const task = await orchestrator.getVerificationStatus(taskId);
        if (!task) {
          const errResponse: ApiErrorResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Verification task not found for taskId: ${taskId}`,
            },
          };
          res.status(404).json(errResponse);
          return;
        }

        const response: ApiSuccessResponse<typeof task> = {
          success: true,
          data: task,
        };

        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    },

    handleListVerificationStatuses: async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const rawLimit = Number(req.query.limit ?? 20);
        const limit = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 20;
        const records = await orchestrator.listVerificationStatuses(limit);
        res.status(200).json({ success: true, data: records });
      } catch (error) {
        next(error);
      }
    },

    handleOffchainVerification: async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const { taskId } = req.params;
        const input = tamperSchema.parse(req.body ?? {});
        const result = await orchestrator.verifyRecordedProof(taskId, input.claimedScore);
        res.status(200).json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  };
}
