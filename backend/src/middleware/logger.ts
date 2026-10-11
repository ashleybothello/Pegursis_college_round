import { Request, Response, NextFunction } from 'express';

const SENSITIVE_KEYS = new Set([
  'incomeindex',
  'repaymentindex',
  'historyindex',
  'salt',
  'privatekey',
  'secret',
  'proof',
  'pi_a',
  'pi_b',
  'pi_c',
  'password',
  'authorization',
]);

/**
 * Recursively redacts sensitive private parameters from objects before logging
 */
export function sanitizeForLogging(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED_CONFIDENTIAL]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    // Don't log in test environment to keep test output clean
    if (process.env.NODE_ENV !== 'test') {
      const sanitizedBody = req.body ? sanitizeForLogging(req.body) : {};
      console.log(
        `[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} - ${duration}ms | Body: ${JSON.stringify(
          sanitizedBody
        )}`
      );
    }
  });

  next();
}
