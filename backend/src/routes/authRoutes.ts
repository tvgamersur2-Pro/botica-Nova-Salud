/**
 * Authentication Routes
 *
 * POST /api/auth/login                 – Authenticate user, return tokens
 * POST /api/auth/refresh               – Refresh access token
 * POST /api/auth/logout                – Invalidate session
 * POST /api/auth/password-reset        – Request password reset link
 * POST /api/auth/password-reset/confirm – Confirm password reset
 *
 * Requirements: FR-6.1, FR-6.2, FR-5.6, NFR-2.2, NFR-2.3, NFR-2.4
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  login,
  logout,
  refreshAccessToken,
  requestPasswordReset,
  confirmPasswordReset,
  AuthError,
} from '../services/authService';
import { logger } from '../config/logger';

const router = Router();

// ----------------------------------------------------------------
// Helper: extract client IP
// ----------------------------------------------------------------

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? 'unknown';
}

// ----------------------------------------------------------------
// Helper: uniform error response
// ----------------------------------------------------------------

function handleError(err: unknown, res: Response): void {
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  logger.error('Unexpected error in auth route', {
    error: err instanceof Error ? err.message : String(err),
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    },
  });
}

// ----------------------------------------------------------------
// POST /api/auth/login
// ----------------------------------------------------------------

/**
 * Authenticate a user with username and password.
 *
 * Body: { username: string, password: string }
 *
 * Returns: { accessToken, refreshToken, expiresIn, user }
 */
router.post(
  '/login',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { username, password } = req.body as { username?: unknown; password?: unknown };

    // Basic input validation
    if (typeof username !== 'string' || !username.trim()) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (typeof password !== 'string' || !password) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    try {
      const result = await login(
        { username: username.trim(), password },
        getClientIp(req),
      );

      res.status(200).json({ data: result });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// POST /api/auth/refresh
// ----------------------------------------------------------------

/**
 * Issue a new access token using a valid refresh token.
 *
 * Body: { refreshToken: string }
 *
 * Returns: { accessToken, expiresIn }
 */
router.post(
  '/refresh',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { refreshToken } = req.body as { refreshToken?: unknown };

    if (typeof refreshToken !== 'string' || !refreshToken) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'refreshToken is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    try {
      const result = await refreshAccessToken(refreshToken);
      res.status(200).json({ data: result });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// POST /api/auth/logout
// ----------------------------------------------------------------

/**
 * Invalidate the user's session.
 *
 * Body: { refreshToken: string }
 */
router.post(
  '/logout',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { refreshToken } = req.body as { refreshToken?: unknown };

    if (typeof refreshToken !== 'string' || !refreshToken) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'refreshToken is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    try {
      await logout(refreshToken, getClientIp(req));
      res.status(200).json({ data: { message: 'Logged out successfully' } });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// POST /api/auth/password-reset
// ----------------------------------------------------------------

/**
 * Request a password reset link.
 *
 * Body: { email: string }
 *
 * Always returns 200 to prevent email enumeration.
 */
router.post(
  '/password-reset',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email } = req.body as { email?: unknown };

    if (typeof email !== 'string' || !email.trim()) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    try {
      await requestPasswordReset(email.trim().toLowerCase());
      // Always return 200 – do not reveal whether the email exists
      res.status(200).json({
        data: {
          message:
            'If an account with that email exists, a password reset link has been sent.',
        },
      });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// POST /api/auth/password-reset/confirm
// ----------------------------------------------------------------

/**
 * Confirm a password reset with the token and new password.
 *
 * Body: { token: string, newPassword: string }
 */
router.post(
  '/password-reset/confirm',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { token, newPassword } = req.body as {
      token?: unknown;
      newPassword?: unknown;
    };

    if (typeof token !== 'string' || !token) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Reset token is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (typeof newPassword !== 'string' || !newPassword) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'New password is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    try {
      await confirmPasswordReset(token, newPassword);
      res.status(200).json({
        data: { message: 'Password has been reset successfully. Please log in.' },
      });
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default router;
