import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types/index.js';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: { windowMs: number; maxRequests: number }) {
  const store = new Map<string, RateLimitStore>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetTime) {
      store.set(ip, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      next();
      return;
    }

    if (entry.count >= options.maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please retry in ${retryAfterSec} seconds.`,
        },
      };
      res.status(429).json(response);
      return;
    }

    entry.count += 1;
    next();
  };
}
