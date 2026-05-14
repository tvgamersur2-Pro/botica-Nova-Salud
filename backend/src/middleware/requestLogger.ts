/**
 * Request logging middleware.
 *
 * - Assigns a unique requestId (UUID v4) to every incoming request
 *   and exposes it via `req.id` and the `X-Request-Id` response header.
 * - Logs request start (method, path, IP) and completion (status, duration).
 *
 * Requirements: NFR-2.1, NFR-2.6
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../config/logger';

// Extend Express Request so TypeScript knows about req.id
declare global {
  namespace Express {
    interface Request {
      /** Unique identifier assigned to this request */
      id: string;
      /** Timestamp (ms) when the request was received */
      startTime: number;
    }
  }
}

/**
 * Attaches a unique `requestId` to every request and logs
 * the incoming request and the outgoing response.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Assign a unique request ID (reuse client-provided header if present)
  const requestId =
    (req.headers['x-request-id'] as string | undefined) ?? randomUUID();

  req.id = requestId;
  req.startTime = Date.now();

  // Expose the request ID in the response so clients can correlate logs
  res.setHeader('X-Request-Id', requestId);

  // Log the incoming request
  logger.info('Request received', {
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length ? req.query : undefined,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Log the response once it finishes
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(level, 'Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      userId: req.user?.userId,
    });
  });

  next();
}
