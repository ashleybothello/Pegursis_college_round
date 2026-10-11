import { Request, Response, NextFunction } from 'express';
import { verificationSubmissionSchema } from '../schemas/verificationSchema.js';
import { VerificationOrchestrator } from '../services/verificationOrchestrator.js';
import { ApiErrorResponse, ApiSuccessResponse, VerificationSubmissionResponse } from '../types/index.js';

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

    handleGetAuditEvents: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const events = await orchestrator.getAuditEvents();
        const response: ApiSuccessResponse<typeof events> = { success: true, data: events };
        res.status(200).json(response);
      } catch (error) { next(error); }
    },

    handleGetDispute: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const dispute = await orchestrator.getDispute(req.params.taskId);
        const response: ApiSuccessResponse<typeof dispute> = { success: true, data: dispute };
        res.status(200).json(response);
      } catch (error) { next(error); }
    },

    handleRaiseDispute: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const taskId = req.params.taskId;
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        if (!reason) {
          res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'A dispute reason is required' } } satisfies ApiErrorResponse);
          return;
        }
        const result = await orchestrator.raiseDispute(taskId, reason);
        res.status(201).json({ success: true, data: result } satisfies ApiSuccessResponse<typeof result>);
      } catch (error) { next(error); }
    },

    handleResolveDispute: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await orchestrator.resolveDispute(req.params.taskId);
        res.status(200).json({ success: true, data: result } satisfies ApiSuccessResponse<typeof result>);
      } catch (error) { next(error); }
    },

    handleCheckIntegrity: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const commitment = typeof req.query.commitment === 'string' ? req.query.commitment : '';
        if (!commitment) {
          res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'commitment query parameter is required' } } satisfies ApiErrorResponse);
          return;
        }
        const result = await orchestrator.checkIntegrity(req.params.taskId, commitment);
        res.status(200).json({ success: true, data: result } satisfies ApiSuccessResponse<typeof result>);
      } catch (error) { next(error); }
    },
  };
}
