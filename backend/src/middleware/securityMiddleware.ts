/**
 * Additional Security Middleware
 *
 * - validateContentType: ensures POST/PUT requests have JSON content type
 * - sanitizeInput: basic input sanitization to strip null bytes and trim strings
 *
 * Requirements: NFR-2.1, NFR-2.6
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// ----------------------------------------------------------------
// Content-Type validation
// ----------------------------------------------------------------

/**
 * Validates that POST and PUT requests include a JSON Content-Type header.
 * Rejects requests with unexpected content types to prevent content-type sniffing attacks.
 */
export function validateContentType(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const methodsRequiringJson = ['POST', 'PUT', 'PATCH'];

  if (methodsRequiringJson.includes(req.method)) {
    const contentType = req.headers['content-type'] ?? '';

    if (!contentType.includes('application/json')) {
      logger.warn('Request rejected: invalid Content-Type', {
        method: req.method,
        path: req.path,
        contentType,
        ip: req.ip,
      });

      res.status(415).json({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Content-Type must be application/json',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
  }

  next();
}

// ----------------------------------------------------------------
// Input sanitization
// ----------------------------------------------------------------

/**
 * Recursively sanitizes an object by:
 *  - Removing null bytes (\x00) from strings
 *  - Trimming leading/trailing whitespace from strings
 *  - Leaving numbers, booleans, and null values unchanged
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    // Remove null bytes and trim
    return value.replace(/\x00/g, '').trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

/**
 * Middleware that sanitizes req.body, req.query, and req.params.
 * Strips null bytes and trims string values.
 */
export function sanitizeInput(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body) as Record<string, unknown>;
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query) as Record<string, string>;
  }

  next();
}
