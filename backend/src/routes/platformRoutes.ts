import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { creditInputSchema } from '../schemas/creditSchema.js';
import { requestTask, computeTask, submitTask, taskInfo, recordReceipt, verifyReceipt, publicConfig } from '../services/platformService.js';

const taskId = z.string().regex(/^\d{1,78}$/);
const receiptSchema = z.object({ module: z.enum(['loan', 'fraud', 'settlement']), inputs: z.record(z.unknown()), output: z.record(z.unknown()) });
const wrap = (handler: (req: Request) => Promise<unknown> | unknown) => async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await handler(req) }); } catch (error) { next(error); }
};
export const platformRoutes = Router();
platformRoutes.get('/config', wrap(() => publicConfig()));
platformRoutes.post('/tasks', wrap(req => {
  const input = creditInputSchema.extend({ modelId: z.union([z.literal(1), z.literal(2)]) }).parse(req.body);
  return requestTask(input, input.modelId);
}));
platformRoutes.get('/tasks/:taskId', wrap(req => taskInfo(taskId.parse(req.params.taskId))));
platformRoutes.post('/tasks/:taskId/compute', wrap(req => computeTask(taskId.parse(req.params.taskId))));
platformRoutes.post('/tasks/:taskId/submit', wrap(req => submitTask(taskId.parse(req.params.taskId))));
platformRoutes.post('/receipts', wrap(req => { const body = receiptSchema.parse(req.body); return recordReceipt(body.module, body.inputs, body.output); }));
platformRoutes.post('/receipts/:receiptId/verify', wrap(req => { const body = receiptSchema.pick({ inputs: true, output: true }).parse(req.body); return verifyReceipt(req.params.receiptId, body.inputs, body.output); }));
