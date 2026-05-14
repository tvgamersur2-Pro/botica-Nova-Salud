/**
 * User Management Routes
 *
 * GET    /api/users        – List all users (Admin only)
 * POST   /api/users        – Create user (Admin only)
 * GET    /api/users/:id    – Get user details (Admin only)
 * PUT    /api/users/:id    – Update user (Admin only)
 * DELETE /api/users/:id    – Deactivate user (Admin only)
 *
 * Requirements: FR-1.1, FR-5.7
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  UserServiceError,
  type ListUsersOptions,
  type CreateUserInput,
  type UpdateUserInput,
} from '../services/userService';
import { logger } from '../config/logger';
import type { UserRole } from '../types/auth';

const router = Router();

// All user management routes require authentication + Admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? 'unknown';
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof UserServiceError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  logger.error('Unexpected error in user route', {
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
// GET /api/users
// List all users with optional filtering and pagination
// ----------------------------------------------------------------

router.get(
  '/',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const {
        role,
        isActive,
        search,
        page,
        limit,
      } = req.query as Record<string, string | undefined>;

      const options: ListUsersOptions = {};

      if (role !== undefined) {
        const validRoles: UserRole[] = ['admin', 'pharmacist', 'cashier'];
        if (!validRoles.includes(role as UserRole)) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: `role must be one of: ${validRoles.join(', ')}`,
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        options.role = role as UserRole;
      }

      if (isActive !== undefined) {
        if (isActive !== 'true' && isActive !== 'false') {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'isActive must be "true" or "false"',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        options.isActive = isActive === 'true';
      }

      if (search) {
        options.search = search;
      }

      if (page !== undefined) {
        const pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'page must be a positive integer',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        options.page = pageNum;
      }

      if (limit !== undefined) {
        const limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'limit must be between 1 and 100',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        options.limit = limitNum;
      }

      const result = await listUsers(options);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// POST /api/users
// Create a new user
// ----------------------------------------------------------------

router.post(
  '/',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;

      // Required field presence check
      const requiredFields = ['username', 'password', 'fullName', 'email', 'role'];
      for (const field of requiredFields) {
        if (typeof body[field] !== 'string' || !(body[field] as string).trim()) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: `${field} is required`,
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
      }

      const input: CreateUserInput = {
        username: (body.username as string).trim(),
        password: body.password as string,
        fullName: (body.fullName as string).trim(),
        email:    (body.email as string).trim(),
        role:     body.role as UserRole,
      };

      const newUser = await createUser(input, req.user!.userId, getClientIp(req));

      res.status(201).json({ data: newUser });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/users/:id
// Get a single user by ID
// ----------------------------------------------------------------

router.get(
  '/:id',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'User ID is required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const user = await getUserById(id);
      res.status(200).json({ data: user });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// PUT /api/users/:id
// Update a user
// ----------------------------------------------------------------

router.put(
  '/:id',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;

      if (!id || typeof id !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'User ID is required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Build update input from provided fields only
      const input: UpdateUserInput = {};

      if (body.fullName !== undefined) {
        if (typeof body.fullName !== 'string' || !body.fullName.trim()) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'fullName must be a non-empty string',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        input.fullName = body.fullName.trim();
      }

      if (body.email !== undefined) {
        if (typeof body.email !== 'string' || !body.email.trim()) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'email must be a non-empty string',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        input.email = body.email.trim();
      }

      if (body.role !== undefined) {
        const validRoles: UserRole[] = ['admin', 'pharmacist', 'cashier'];
        if (!validRoles.includes(body.role as UserRole)) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: `role must be one of: ${validRoles.join(', ')}`,
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        input.role = body.role as UserRole;
      }

      if (body.isActive !== undefined) {
        if (typeof body.isActive !== 'boolean') {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'isActive must be a boolean',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        input.isActive = body.isActive;
      }

      if (body.password !== undefined) {
        if (typeof body.password !== 'string' || !body.password) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'password must be a non-empty string',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        input.password = body.password;
      }

      const updated = await updateUser(id, input, req.user!.userId, getClientIp(req));
      res.status(200).json({ data: updated });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// DELETE /api/users/:id
// Deactivate a user (soft delete)
// ----------------------------------------------------------------

router.delete(
  '/:id',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'User ID is required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const deactivated = await deactivateUser(id, req.user!.userId, getClientIp(req));
      res.status(200).json({ data: deactivated });
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default router;
