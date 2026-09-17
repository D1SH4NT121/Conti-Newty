import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth-middleware';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, maxRequests, message = 'Too many requests. Please try again later.' } = options;
  // Map of key -> Array of timestamps
  const requestHistory: Map<string, number[]> = new Map();

  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const key = authReq.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    const windowStart = now - windowMs;

    const timestamps = requestHistory.get(key) || [];
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= maxRequests) {
      return res.status(429).json({
        error: message,
        retryAfterMs: validTimestamps[0] + windowMs - now
      });
    }

    validTimestamps.push(now);
    requestHistory.set(key, validTimestamps);
    next();
  };
}
