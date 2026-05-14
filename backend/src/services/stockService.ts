/**
 * Stock Tracking Service
 *
 * Handles:
 *  - Atomic stock decrements / increments (FR-2.3, Property 2)
 *  - Stock availability validation (FR-2.8, Property 6)
 *  - Expiration date checks (FR-1.5, Property 3)
 *  - Low stock alert generation (FR-1.6, FR-3.2, Property 4)
 *  - Expiration alert generation (FR-3.1, FR-3.2)
 *  - Scheduled hourly monitoring job (FR-3.1)
 *
 * Requirements: FR-1.5, FR-1.6, FR-2.3, FR-2.8, FR-3.1, FR-3.2
 */

import { PoolConnection } from 'mysql2/promise';
import cron from 'node-cron';
import { query } from '../config/database';
import { logger } from '../config/logger';
import { suggestBestSupplier } from './productService';
import type { CreateAlertInput } from '../types/alert';

// ----------------------------------------------------------------
// Custom error
// ----------------------------------------------------------------

export class StockServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'StockServiceError';
  }
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Products expiring within this many days trigger a warning */
const EXPIRATION_WARNING_DAYS = 90;

// ----------------------------------------------------------------
// Atomic stock operations
// ----------------------------------------------------------------

/**
 * Atomically decrements stock for a product within an existing transaction.
 * Throws if the resulting stock would be negative (Property 2, FR-2.3).
 *
 * @param productId - UUID of the product
 * @param quantity  - Amount to decrement (must be > 0)
 * @param client    - Active PoolConnection (must be inside a transaction)
 */
export async function decrementStock(
  productId: string,
  quantity: number,
  client: PoolConnection,
): Promise<void> {
  if (quantity <= 0) {
    throw new StockServiceError('Quantity must be greater than zero', 'VALIDATION_ERROR', 400);
  }

  const [updateResult] = await client.query(
    `UPDATE products
     SET quantity_in_stock = quantity_in_stock - ?,
         updated_at = NOW()
     WHERE id = ?
       AND quantity_in_stock >= ?`,
    [quantity, productId, quantity],
  );

  if ((updateResult as { affectedRows: number }).affectedRows === 0) {
    // Either product not found or insufficient stock
    const [checkRows] = await client.query(
      'SELECT id, quantity_in_stock FROM products WHERE id = ?',
      [productId],
    );
    const rows = checkRows as { id: string; quantity_in_stock: number }[];
    if (rows.length === 0) {
      throw new StockServiceError('Product not found', 'NOT_FOUND', 404);
    }
    throw new StockServiceError(
      `Insufficient stock. Available: ${rows[0].quantity_in_stock}, requested: ${quantity}`,
      'INSUFFICIENT_STOCK',
      400,
    );
  }
}

/**
 * Atomically increments stock for a product within an existing transaction.
 * Used when voiding/refunding a transaction to restore stock.
 *
 * @param productId - UUID of the product
 * @param quantity  - Amount to increment (must be > 0)
 * @param client    - Active PoolConnection (must be inside a transaction)
 */
export async function incrementStock(
  productId: string,
  quantity: number,
  client: PoolConnection,
): Promise<void> {
  if (quantity <= 0) {
    throw new StockServiceError('Quantity must be greater than zero', 'VALIDATION_ERROR', 400);
  }

  await client.query(
    `UPDATE products
     SET quantity_in_stock = quantity_in_stock + ?,
         updated_at = NOW()
     WHERE id = ?`,
    [quantity, productId],
  );
}

// ----------------------------------------------------------------
// Stock availability check
// ----------------------------------------------------------------

/**
 * Checks whether a product has sufficient stock for the requested quantity.
 * Returns true if available, false otherwise (Property 6, FR-2.8).
 *
 * @param productId - UUID of the product
 * @param quantity  - Requested quantity
 */
export async function checkStockAvailability(
  productId: string,
  quantity: number,
): Promise<boolean> {
  const result = await query<{ quantity_in_stock: number }>(
    'SELECT quantity_in_stock FROM products WHERE id = $1',
    [productId],
  );

  if (result.rowCount === 0) {
    return false;
  }

  return result.rows[0].quantity_in_stock >= quantity;
}

// ----------------------------------------------------------------
// Expiration helpers
// ----------------------------------------------------------------

/**
 * Returns true if the given date is within EXPIRATION_WARNING_DAYS days from now
 * and has not yet expired (Property 3, FR-1.5).
 */
export function isExpiringSoon(expirationDate: Date): boolean {
  const now = new Date();
  const diffMs = expirationDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= EXPIRATION_WARNING_DAYS;
}

/**
 * Returns true if the given date is in the past (product is expired).
 */
export function isExpired(expirationDate: Date): boolean {
  return expirationDate < new Date();
}

// ----------------------------------------------------------------
// Alert generation helpers
// ----------------------------------------------------------------

/**
 * Inserts an alert record if one does not already exist for the same
 * product + alert_type combination that is still unresolved.
 */
async function upsertAlert(input: CreateAlertInput): Promise<void> {
  // Check for existing unresolved alert of the same type
  const existing = await query<{ id: string }>(
    `SELECT id FROM alerts
     WHERE product_id = $1
       AND alert_type = $2
       AND resolved_timestamp IS NULL`,
    [input.productId, input.alertType],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    // Update current stock level on existing alert
    await query(
      `UPDATE alerts
       SET current_stock_level = $1
       WHERE id = $2`,
      [input.currentStockLevel, existing.rows[0].id],
    );
    return;
  }

  await query(
    `INSERT INTO alerts
       (product_id, alert_type, alert_threshold, current_stock_level, supplier_suggestion)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.productId,
      input.alertType,
      input.alertThreshold,
      input.currentStockLevel,
      input.supplierSuggestion ? JSON.stringify(input.supplierSuggestion) : null,
    ],
  );
}

// ----------------------------------------------------------------
// Scheduled alert generation
// ----------------------------------------------------------------

/**
 * Scans all products and generates low stock alerts for those at or below
 * their configured minimum stock threshold (Property 4, FR-1.6, FR-3.2).
 */
export async function generateLowStockAlerts(): Promise<number> {
  const result = await query<{
    id: string;
    quantity_in_stock: number;
    min_stock_threshold: number;
  }>(
    `SELECT id, quantity_in_stock, min_stock_threshold
     FROM products
     WHERE quantity_in_stock <= min_stock_threshold`,
  );

  let count = 0;
  for (const row of result.rows) {
    try {
      const suggestion = await suggestBestSupplier(row.id);
      await upsertAlert({
        productId: row.id,
        alertType: 'low_stock',
        alertThreshold: row.min_stock_threshold,
        currentStockLevel: row.quantity_in_stock,
        supplierSuggestion: suggestion,
      });
      count++;
    } catch (err) {
      logger.error('Failed to generate low stock alert', {
        productId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info(`Low stock alert generation complete`, { alertsGenerated: count });
  return count;
}

/**
 * Scans all products and generates expiration alerts for those expiring
 * within 90 days or already expired (FR-1.5, FR-3.1, FR-3.2).
 */
export async function generateExpirationAlerts(): Promise<number> {
  const warningCutoff = new Date();
  warningCutoff.setDate(warningCutoff.getDate() + EXPIRATION_WARNING_DAYS);

  const result = await query<{
    id: string;
    expiration_date: string;
    quantity_in_stock: number;
    min_stock_threshold: number;
  }>(
    `SELECT id, expiration_date, quantity_in_stock, min_stock_threshold
     FROM products
     WHERE expiration_date <= $1`,
    [warningCutoff.toISOString()],
  );

  let count = 0;
  for (const row of result.rows) {
    try {
      const expDate = new Date(row.expiration_date);
      const alertType = isExpired(expDate) ? 'expired' : 'expiring_soon';

      await upsertAlert({
        productId: row.id,
        alertType,
        alertThreshold: row.min_stock_threshold,
        currentStockLevel: row.quantity_in_stock,
        supplierSuggestion: null,
      });
      count++;
    } catch (err) {
      logger.error('Failed to generate expiration alert', {
        productId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info(`Expiration alert generation complete`, { alertsGenerated: count });
  return count;
}

// ----------------------------------------------------------------
// Scheduled job – runs every hour
// ----------------------------------------------------------------

/**
 * Starts the scheduled stock and expiration monitoring job.
 * Runs every hour at minute 0.
 * Requirements: FR-3.1
 */
export function startStockMonitoringJob(): void {
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled stock monitoring job');
    try {
      await generateLowStockAlerts();
      await generateExpirationAlerts();
    } catch (err) {
      logger.error('Stock monitoring job failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info('Stock monitoring job scheduled (every hour)');
}
