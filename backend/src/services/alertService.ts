/**
 * Alert Management Service
 *
 * Handles:
 *  - Listing and querying alerts (FR-3.3, FR-3.4)
 *  - Alert resolution with tracking (FR-3.5, FR-3.6, Property 11)
 *  - Alert statistics (FR-3.3)
 *  - Integration with stockService for automatic generation (FR-3.1, FR-3.2)
 *
 * Requirements: FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5, FR-3.6, FR-3.7
 */

import { query, withTransaction } from '../config/database';
import { logger } from '../config/logger';
import type { RowDataPacket } from 'mysql2';
import type {
  AlertRecord,
  AlertType,
  ListAlertsOptions,
  PaginatedAlerts,
  AlertStats,
} from '../types/alert';

// ----------------------------------------------------------------
// Custom error
// ----------------------------------------------------------------

export class AlertServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AlertServiceError';
  }
}

// ----------------------------------------------------------------
// Row mapper
// ----------------------------------------------------------------

function rowToAlertRecord(row: Record<string, unknown>): AlertRecord {
  return {
    id:                 row.id as string,
    productId:          row.product_id as string,
    alertType:          row.alert_type as AlertType,
    alertThreshold:     row.alert_threshold as number,
    currentStockLevel:  row.current_stock_level as number,
    alertTimestamp:     new Date(row.alert_timestamp as string),
    resolvedTimestamp:  row.resolved_timestamp ? new Date(row.resolved_timestamp as string) : null,
    resolvedBy:         (row.resolved_by as string | null) ?? null,
    resolutionNotes:    (row.resolution_notes as string | null) ?? null,
    supplierSuggestion: row.supplier_suggestion
      ? (row.supplier_suggestion as { supplierId: string; reason: 'best_price' | 'shortest_lead_time' })
      : null,
    productName:        (row.product_name as string | null) ?? null,
    resolvedByName:     (row.resolved_by_name as string | null) ?? null,
  };
}

// ----------------------------------------------------------------
// Audit log helper
// ----------------------------------------------------------------

async function auditLog(
  actorId: string,
  action: string,
  affectedResourceId: string | null,
  beforeState: Record<string, unknown> | null,
  afterState: Record<string, unknown> | null,
  ipAddress?: string,
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, action, affected_resource_id, before_state, after_state, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        action,
        affectedResourceId ?? null,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState  ? JSON.stringify(afterState)  : null,
        ipAddress   ?? null,
      ],
    );
  } catch (err) {
    logger.error('Failed to write audit log', {
      actorId,
      action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ----------------------------------------------------------------
// Alert queries
// ----------------------------------------------------------------

/**
 * Lists alerts with optional filters and pagination.
 * Requirements: FR-3.3, FR-3.4
 */
export async function listAlerts(
  options: ListAlertsOptions = {},
): Promise<PaginatedAlerts> {
  const { alertType, resolved, productId, page = 1, limit = 20 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (alertType) {
    conditions.push(`a.alert_type = $${paramIdx++}`);
    params.push(alertType);
  }
  if (resolved === true) {
    conditions.push(`a.resolved_timestamp IS NOT NULL`);
  } else if (resolved === false) {
    conditions.push(`a.resolved_timestamp IS NULL`);
  }
  if (productId) {
    conditions.push(`a.product_id = $${paramIdx++}`);
    params.push(productId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM alerts a ${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (page - 1) * limit;
  const dataResult = await query<Record<string, unknown>>(
    `SELECT a.*,
            p.name AS product_name,
            u.full_name AS resolved_by_name
     FROM alerts a
     LEFT JOIN products p ON p.id = a.product_id
     LEFT JOIN users u ON u.id = a.resolved_by
     ${whereClause}
     ORDER BY a.alert_timestamp DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );

  return {
    data: dataResult.rows.map(rowToAlertRecord),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Gets a single alert by ID.
 * Requirements: FR-3.3
 */
export async function getAlertById(id: string): Promise<AlertRecord> {
  const result = await query<Record<string, unknown>>(
    `SELECT a.*,
            p.name AS product_name,
            u.full_name AS resolved_by_name
     FROM alerts a
     LEFT JOIN products p ON p.id = a.product_id
     LEFT JOIN users u ON u.id = a.resolved_by
     WHERE a.id = $1`,
    [id],
  );

  if (result.rowCount === 0) {
    throw new AlertServiceError('Alert not found', 'NOT_FOUND', 404);
  }

  return rowToAlertRecord(result.rows[0]);
}

/**
 * Marks an alert as resolved, recording the resolver and notes (Property 11).
 * Requirements: FR-3.5, FR-3.6
 */
export async function resolveAlert(
  id: string,
  actorId: string,
  notes?: string,
  ipAddress?: string,
): Promise<AlertRecord> {
  const current = await getAlertById(id);

  if (current.resolvedTimestamp !== null) {
    throw new AlertServiceError('Alert is already resolved', 'INVALID_STATE', 400);
  }

  const updated = await withTransaction(async (client) => {
    await client.query(
      `UPDATE alerts
       SET resolved_timestamp = NOW(),
           resolved_by = ?,
           resolution_notes = ?
       WHERE id = ?`,
      [actorId, notes ?? null, id],
    );

    const [rows] = await client.query(
      `SELECT a.*,
              p.name AS product_name,
              u.full_name AS resolved_by_name
       FROM alerts a
       LEFT JOIN products p ON p.id = a.product_id
       LEFT JOIN users u ON u.id = a.resolved_by
       WHERE a.id = ?`,
      [id],
    );
    return rowToAlertRecord((rows as Record<string, unknown>[])[0]);
  });

  await auditLog(
    actorId,
    'ALERT_RESOLVED',
    id,
    { alertType: current.alertType, productId: current.productId },
    { resolvedTimestamp: new Date().toISOString(), resolvedBy: actorId, notes: notes ?? null },
    ipAddress,
  );

  logger.info('Alert resolved', { actorId, alertId: id, alertType: current.alertType });

  return updated;
}

/**
 * Returns aggregate statistics for alerts.
 * Requirements: FR-3.3
 */
export async function getAlertStats(): Promise<AlertStats> {
  const result = await query<{
    total: string;
    active: string;
    resolved: string;
    low_stock: string;
    expiring_soon: string;
    expired: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN resolved_timestamp IS NULL THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN resolved_timestamp IS NOT NULL THEN 1 ELSE 0 END) AS resolved,
       SUM(CASE WHEN alert_type = 'low_stock' THEN 1 ELSE 0 END) AS low_stock,
       SUM(CASE WHEN alert_type = 'expiring_soon' THEN 1 ELSE 0 END) AS expiring_soon,
       SUM(CASE WHEN alert_type = 'expired' THEN 1 ELSE 0 END) AS expired
     FROM alerts`,
  );

  const row = result.rows[0];
  return {
    total:    Number(row.total),
    active:   Number(row.active),
    resolved: Number(row.resolved),
    byType: {
      low_stock:     Number(row.low_stock),
      expiring_soon: Number(row.expiring_soon),
      expired:       Number(row.expired),
    },
  };
}
