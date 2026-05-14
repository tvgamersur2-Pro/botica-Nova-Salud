/**
 * Authentication & Authorization Middleware
 *
 * - authenticateToken: validates the JWT access token on every protected route
 * - requireRole:       restricts access to specific user roles
 *
 * Requirements: FR-5.7, NFR-2.1, FR-6.4, FR-6.5
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AuthError } from '../services/authService';
import { logger } from '../config/logger';
import type { UserRole } from '../types/auth';

// ----------------------------------------------------------------
// Token extraction helper
// ----------------------------------------------------------------

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7); // Remove "Bearer " prefix
}

// ----------------------------------------------------------------
// Middleware: validate JWT access token
// ----------------------------------------------------------------

/**
 * Validates the Bearer token in the Authorization header.
 * On success, attaches `req.user` with userId, username, and role.
 * On failure, returns 401 with a generic error message.
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authentication token is required',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };
    next();
  } catch (err) {
    const statusCode = err instanceof AuthError ? err.statusCode : 401;
    const code = err instanceof AuthError ? err.code : 'INVALID_TOKEN';
    const message = err instanceof AuthError ? err.message : 'Invalid or expired token';

    logger.warn('Token validation failed', {
      ip: req.ip,
      path: req.path,
      code,
    });

    res.status(statusCode).json({
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// ----------------------------------------------------------------
// Middleware: role-based access control
// ----------------------------------------------------------------

/**
 * Returns a middleware that restricts access to users with one of
 * the specified roles. Must be used AFTER `authenticateToken`.
 *
 * Usage:
 *   router.get('/admin-only', authenticateToken, requireRole('admin'), handler)
 *   router.get('/staff',      authenticateToken, requireRole('admin', 'pharmacist'), handler)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Should not happen if authenticateToken ran first, but guard anyway
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt', {
        userId: req.user.userId,
        role: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        ip: req.ip,
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to perform this action',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}
