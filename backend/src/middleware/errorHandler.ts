/**
 * Global error handling middleware for Nova Salud API.
 *
 * Catches all errors thrown (or passed via next(err)) in route handlers
 * and formats them into the standard API error response structure.
 *
 * Error categories:
 *   400 – Validation / business rule errors
 *   401 – Authentication errors (missing / invalid / expired token)
 *   403 – Authorization errors (insufficient permissions)
 *   404 – Resource not found
 *   429 – Rate limit exceeded
 *   500 – Unexpected server errors
 *
 * Requirements: FR-5.5, NFR-4.2
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { errorBody } from '../utils/response';
import type { ApiErrorDetail } from '../types/api';

// ----------------------------------------------------------------
// Custom application error class
// ----------------------------------------------------------------

/**
 * Base class for all application-level errors.
 * Throw this (or a subclass) from route handlers to produce a
 * well-formatted API error response.
 *
 * @example
 *   throw new AppError(404, 'NOT_FOUND', 'Product not found');
 *   throw new ValidationError('Invalid quantity', [{ field: 'quantity', message: 'Must be > 0' }]);
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
    // Maintain proper prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ----------------------------------------------------------------
// Convenience subclasses
// ----------------------------------------------------------------

/** 400 – Invalid input or business rule violation */
export class ValidationError extends AppError {
  constructor(message: string, details?: ApiErrorDetail[]) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

/** 401 – Missing, invalid, or expired authentication token */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', code = 'AUTHENTICATION_ERROR') {
    super(401, code, message);
    this.name = 'AuthenticationError';
  }
}

/** 403 – Authenticated but not authorized for the requested action */
export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'AUTHORIZATION_ERROR', message);
    this.name = 'AuthorizationError';
  }
}

/** 404 – Requested resource does not exist */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

/** 409 – Conflict (e.g. duplicate unique field) */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

// ----------------------------------------------------------------
// Global error handler
// ----------------------------------------------------------------

/**
 * Express error-handling middleware (4-argument signature required).
 * Must be registered AFTER all routes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.id ?? 'unknown';

  // ---- Known application errors ----
  if (err instanceof AppError) {
    // Log 5xx as errors, 4xx as warnings
    if (err.statusCode >= 500) {
      logger.error('Application error', {
        requestId,
        code: err.code,
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.userId,
      });
    } else {
      logger.warn('Client error', {
        requestId,
        code: err.code,
        message: err.message,
        path: req.path,
        method: req.method,
        userId: req.user?.userId,
      });
    }

    res
      .status(err.statusCode)
      .json(errorBody(err.code, err.message, requestId, err.details));
    return;
  }

  // ---- express-rate-limit errors (status 429) ----
  // express-rate-limit sets statusCode on the error object
  const maybeRateLimit = err as Error & { statusCode?: number; status?: number };
  const rlStatus = maybeRateLimit.statusCode ?? maybeRateLimit.status;
  if (rlStatus === 429) {
    logger.warn('Rate limit exceeded', {
      requestId,
      path: req.path,
      ip: req.ip,
    });
    res.status(429).json(
      errorBody(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests, please try again later.',
        requestId,
      ),
    );
    return;
  }

  // ---- SyntaxError from body-parser (malformed JSON) ----
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn('Malformed JSON body', {
      requestId,
      path: req.path,
      method: req.method,
    });
    res.status(400).json(
      errorBody('INVALID_JSON', 'Request body contains invalid JSON.', requestId),
    );
    return;
  }

  // ---- Unexpected / unhandled errors ----
  logger.error('Unhandled error', {
    requestId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
  });

  // Never leak internal details to the client in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message;

  res.status(500).json(
    errorBody('INTERNAL_ERROR', message, requestId),
  );
}

// ----------------------------------------------------------------
// 404 handler (for unmatched routes)
// ----------------------------------------------------------------

/**
 * Catch-all for routes that don't match any registered handler.
 * Must be registered AFTER all routes but BEFORE globalErrorHandler.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.id ?? 'unknown';
  logger.warn('Route not found', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  res.status(404).json(
    errorBody(
      'NOT_FOUND',
      `Cannot ${req.method} ${req.path}`,
      requestId,
    ),
  );
}
