/**
 * Alert Routes
 *
 * GET  /api/alerts          – List alerts with filters
 * GET  /api/alerts/stats    – Alert statistics
 * GET  /api/alerts/:id      – Get alert details
 * PUT  /api/alerts/:id/resolve – Resolve alert (Admin, Pharmacist)
 *
 * Requirements: FR-3.3, FR-3.4, FR-3.5, FR-3.6
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import {
  listAlerts,
  getAlertById,
  resolveAlert,
  getAlertStats,
  AlertServiceError,
} from '../services/alertService';
import { logger } from '../config/logger';
import type { AlertType, ListAlertsOptions } from '../types/alert';

const router = Router();

router.use(authenticateToken);

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof AlertServiceError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  logger.error('Unexpected error in alert route', {
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
// GET /api/alerts/stats  (must be before /:id)
// ----------------------------------------------------------------

router.get(
  '/stats',
  requireRole('admin', 'pharmacist'),
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const stats = await getAlertStats();
      res.status(200).json({ data: stats });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/alerts
// ----------------------------------------------------------------

router.get(
  '/',
  requireRole('admin', 'pharmacist'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { alertType, resolved, productId, page, limit } =
        req.query as Record<string, string | undefined>;

      const options: ListAlertsOptions = {};

      if (alertType) options.alertType = alertType as AlertType;
      if (resolved !== undefined) options.resolved = resolved === 'true';
      if (productId) options.productId = productId;
      if (page) options.page = parseInt(page, 10);
      if (limit) options.limit = parseInt(limit, 10);

      const result = await listAlerts(options);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/alerts/:id
// ----------------------------------------------------------------

router.get(
  '/:id',
  requireRole('admin', 'pharmacist'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const alert = await getAlertById(req.params.id);
      res.status(200).json({ data: alert });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// PUT /api/alerts/:id/resolve
// ----------------------------------------------------------------

router.put(
  '/:id/resolve',
  requireRole('admin', 'pharmacist'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const notes = body.notes ? String(body.notes) : undefined;

      const alert = await resolveAlert(
        req.params.id,
        req.user!.userId,
        notes,
        getClientIp(req),
      );

      res.status(200).json({ data: alert });
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default router;
