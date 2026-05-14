/**
 * Audit Log Routes
 *
 * GET /api/audit-logs – List audit logs (Admin only)
 *
 * Requirements: FR-6.4, FR-6.5
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { query } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('admin'));

// ----------------------------------------------------------------
// GET /api/audit-logs
// ----------------------------------------------------------------

router.get(
  '/',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { userId, action, resourceId, dateFrom, dateTo, page, limit } =
        req.query as Record<string, string | undefined>;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (userId) {
        conditions.push(`al.user_id = $${paramIdx++}`);
        params.push(userId);
      }
      if (action) {
        conditions.push(`al.action ILIKE $${paramIdx++}`);
        params.push(`%${action}%`);
      }
      if (resourceId) {
        conditions.push(`al.affected_resource_id = $${paramIdx++}`);
        params.push(resourceId);
      }
      if (dateFrom) {
        conditions.push(`al.timestamp >= $${paramIdx++}`);
        params.push(dateFrom);
      }
      if (dateTo) {
        conditions.push(`al.timestamp <= $${paramIdx++}`);
        params.push(dateTo);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const pageNum  = page  ? parseInt(page, 10)  : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;
      const offset   = (pageNum - 1) * limitNum;

      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM audit_logs al ${whereClause}`,
        params,
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const dataResult = await query<Record<string, unknown>>(
        `SELECT al.*,
                u.username,
                u.full_name AS user_full_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ${whereClause}
         ORDER BY al.timestamp DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limitNum, offset],
      );

      const logs = dataResult.rows.map((row) => ({
        id:                 row.id,
        userId:             row.user_id,
        username:           row.username,
        userFullName:       row.user_full_name,
        action:             row.action,
        timestamp:          row.timestamp,
        affectedResourceId: row.affected_resource_id,
        beforeState:        row.before_state,
        afterState:         row.after_state,
        ipAddress:          row.ip_address,
      }));

      res.status(200).json({
        data: logs,
        meta: {
          page:       pageNum,
          limit:      limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      logger.error('Unexpected error in audit log route', {
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
  },
);

export default router;
