import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiErrorResponse } from '../types/index.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    };
    res.status(400).json(response);
    return;
  }

  // Handle known application/domain errors
  const message = err.message || 'An unexpected internal error occurred';
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';

  if (
    message.includes('missing') ||
    message.includes('must be an integer') ||
    message.includes('between 0 and 100') ||
    message.includes('cannot be negative') ||
    message.includes('positive')
  ) {
    statusCode = 400;
    errorCode = 'INVALID_INPUT';
  } else if (message.includes('not found')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (message.includes('Conflict')) {
    statusCode = 409;
    errorCode = 'CONFLICT';
  } else if (message.includes('circuit artifacts') || message.includes('Missing')) {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
  }

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
  };

  res.status(statusCode).json(response);
}
