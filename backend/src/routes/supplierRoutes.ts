/**
 * Supplier Management Routes
 *
 * GET    /api/suppliers        – List suppliers with search/pagination
 * POST   /api/suppliers        – Create supplier (Admin, Pharmacist)
 * GET    /api/suppliers/:id    – Get supplier details
 * PUT    /api/suppliers/:id    – Update supplier (Admin, Pharmacist)
 * DELETE /api/suppliers/:id    – Delete supplier (Admin only)
 *
 * Requirements: FR-1.7, FR-3.7
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  ProductServiceError,
} from '../services/productService';
import { logger } from '../config/logger';
import type { ListSuppliersOptions } from '../types/product';

const router = Router();

// All supplier routes require authentication
router.use(authenticateToken);

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
  if (err instanceof ProductServiceError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  logger.error('Unexpected error in supplier route', {
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
// GET /api/suppliers
// List suppliers with optional search and pagination
// ----------------------------------------------------------------

router.get(
  '/',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { search, page, limit } = req.query as Record<string, string | undefined>;

      const options: ListSuppliersOptions = {};

      if (search) options.search = search;

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

      const result = await listSuppliers(options);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// POST /api/suppliers
// Create a new supplier (Admin, Pharmacist)
// ----------------------------------------------------------------

router.post(
  '/',
  requireRole('admin', 'pharmacist'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;

      if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name is required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const newSupplier = await createSupplier(
        {
          name:         String(body.name).trim(),
          contactEmail: body.contactEmail ? String(body.contactEmail) : undefined,
          phone:        body.phone ? String(body.phone) : undefined,
          address:      body.address ? String(body.address) : undefined,
          leadTimeDays: body.leadTimeDays !== undefined ? Number(body.leadTimeDays) : undefined,
          pricing:      body.pricing as Record<string, unknown> | undefined,
        },
        req.user!.userId,
        getClientIp(req),
      );

      res.status(201).json({ data: newSupplier });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/suppliers/:id
// Get a single supplier by ID
// ----------------------------------------------------------------

router.get(
  '/:id',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const supplier = await getSupplierById(req.params.id);
      res.status(200).json({ data: supplier });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// PUT /api/suppliers/:id
// Update a supplier (Admin, Pharmacist)
// ----------------------------------------------------------------

router.put(
  '/:id',
  requireRole('admin', 'pharmacist'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;

      const updated = await updateSupplier(
        req.params.id,
        {
          name:         body.name !== undefined ? String(body.name) : undefined,
          contactEmail: body.contactEmail !== undefined
            ? (body.contactEmail ? String(body.contactEmail) : null)
            : undefined,
          phone:        body.phone !== undefined
            ? (body.phone ? String(body.phone) : null)
            : undefined,
          address:      body.address !== undefined
            ? (body.address ? String(body.address) : null)
            : undefined,
          leadTimeDays: body.leadTimeDays !== undefined ? Number(body.leadTimeDays) : undefined,
          pricing:      body.pricing !== undefined
            ? (body.pricing as Record<string, unknown> | null)
            : undefined,
        },
        req.user!.userId,
        getClientIp(req),
      );

      res.status(200).json({ data: updated });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// DELETE /api/suppliers/:id
// Delete a supplier (Admin only)
// ----------------------------------------------------------------

router.delete(
  '/:id',
  requireRole('admin'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      await deleteSupplier(req.params.id, req.user!.userId, getClientIp(req));
      res.status(200).json({ data: { message: 'Supplier deleted successfully' } });
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default router;
