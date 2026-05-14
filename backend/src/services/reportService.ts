/**
 * Report Generation Service
 *
 * Handles:
 *  - Sales reports with totals, top products, payment breakdown (FR-4.1, FR-4.2, FR-4.3, Property 5)
 *  - Inventory reports with low stock and expiring products (FR-4.4, FR-4.5)
 *  - Audit logging for report generation (FR-4.7)
 *
 * Requirements: FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.7
 */

import { query } from '../config/database';
import { logger } from '../config/logger';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface DateRange {
  from: string; // ISO date string
  to: string;   // ISO date string
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  total: number;
}

export interface SalesReport {
  dateRange: DateRange;
  totalSales: number;
  transactionCount: number;
  topSellingProducts: TopProduct[];
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  generatedAt: Date;
}

export interface InventoryReportItem {
  id: string;
  name: string;
  dosage: string | null;
  form: string;
  category: string;
  quantityInStock: number;
  minStockThreshold: number;
  unitPrice: number;
  expirationDate: string;
  supplierName: string | null;
  isLowStock: boolean;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

export interface InventoryReport {
  totalProducts: number;
  lowStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  items: InventoryReportItem[];
  generatedAt: Date;
}

export interface ReportOptions {
  category?: string;
  supplierId?: string;
  includeExpired?: boolean;
}

// ----------------------------------------------------------------
// Audit log helper
// ----------------------------------------------------------------

async function auditLog(
  actorId: string,
  action: string,
  afterState: Record<string, unknown>,
  ipAddress?: string,
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, action, before_state, after_state, ip_address)
       VALUES ($1, $2, NULL, $3, $4)`,
      [actorId, action, JSON.stringify(afterState), ipAddress ?? null],
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
// Sales Report
// ----------------------------------------------------------------

/**
 * Generates a sales report for the given date range.
 * Includes total sales, transaction count, top products, and payment breakdown.
 * Requirements: FR-4.1, FR-4.2, FR-4.3, Property 5
 */
export async function generateSalesReport(
  dateRange: DateRange,
  actorId: string,
  ipAddress?: string,
): Promise<SalesReport> {
  // Total sales and transaction count
  const summaryResult = await query<{
    total_sales: string;
    transaction_count: string;
  }>(
    `SELECT
       COALESCE(SUM(total_amount), 0) AS total_sales,
       COUNT(*) AS transaction_count
     FROM transactions
     WHERE status = 'completed'
       AND timestamp >= $1
       AND timestamp <= $2`,
    [dateRange.from, dateRange.to],
  );

  const summary = summaryResult.rows[0];

  // Top selling products
  const topProductsResult = await query<{
    product_id: string;
    product_name: string;
    total_quantity: string;
    total_revenue: string;
  }>(
    `SELECT
       ti.product_id,
       ti.product_name,
       SUM(ti.quantity) AS total_quantity,
       SUM(ti.total_price) AS total_revenue
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     WHERE t.status = 'completed'
       AND t.timestamp >= $1
       AND t.timestamp <= $2
     GROUP BY ti.product_id, ti.product_name
     ORDER BY total_quantity DESC
     LIMIT 10`,
    [dateRange.from, dateRange.to],
  );

  // Payment method breakdown
  const paymentResult = await query<{
    payment_method: string;
    count: string;
    total: string;
  }>(
    `SELECT
       payment_method,
       COUNT(*) AS count,
       COALESCE(SUM(total_amount), 0) AS total
     FROM transactions
     WHERE status = 'completed'
       AND timestamp >= $1
       AND timestamp <= $2
     GROUP BY payment_method
     ORDER BY total DESC`,
    [dateRange.from, dateRange.to],
  );

  const report: SalesReport = {
    dateRange,
    totalSales:       parseFloat(summary.total_sales),
    transactionCount: parseInt(summary.transaction_count, 10),
    topSellingProducts: topProductsResult.rows.map((r) => ({
      productId:     r.product_id,
      productName:   r.product_name,
      totalQuantity: parseInt(r.total_quantity, 10),
      totalRevenue:  parseFloat(r.total_revenue),
    })),
    paymentMethodBreakdown: paymentResult.rows.map((r) => ({
      method: r.payment_method,
      count:  parseInt(r.count, 10),
      total:  parseFloat(r.total),
    })),
    generatedAt: new Date(),
  };

  await auditLog(
    actorId,
    'REPORT_SALES_GENERATED',
    { dateRange, totalSales: report.totalSales, transactionCount: report.transactionCount },
    ipAddress,
  );

  logger.info('Sales report generated', { actorId, dateRange });

  return report;
}

// ----------------------------------------------------------------
// Inventory Report
// ----------------------------------------------------------------

/**
 * Generates an inventory status report.
 * Highlights low stock and expiring products.
 * Requirements: FR-4.4, FR-4.5
 */
export async function generateInventoryReport(
  options: ReportOptions = {},
  actorId: string,
  ipAddress?: string,
): Promise<InventoryReport> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (options.category) {
    conditions.push(`p.category = $${paramIdx++}`);
    params.push(options.category);
  }
  if (options.supplierId) {
    conditions.push(`p.supplier_id = $${paramIdx++}`);
    params.push(options.supplierId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const warningCutoff = new Date();
  warningCutoff.setDate(warningCutoff.getDate() + 90);

  const result = await query<{
    id: string;
    name: string;
    dosage: string | null;
    form: string;
    category: string;
    quantity_in_stock: number;
    min_stock_threshold: number;
    unit_price: string;
    expiration_date: string;
    supplier_name: string | null;
  }>(
    `SELECT p.id, p.name, p.dosage, p.form, p.category,
            p.quantity_in_stock, p.min_stock_threshold, p.unit_price,
            p.expiration_date, s.name AS supplier_name
     FROM products p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     ${whereClause}
     ORDER BY p.name ASC`,
    params,
  );

  const now = new Date();

  const items: InventoryReportItem[] = result.rows.map((row) => {
    const expDate = new Date(row.expiration_date);
    const diffDays = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    return {
      id:                row.id,
      name:              row.name,
      dosage:            row.dosage,
      form:              row.form,
      category:          row.category,
      quantityInStock:   row.quantity_in_stock,
      minStockThreshold: row.min_stock_threshold,
      unitPrice:         parseFloat(row.unit_price),
      expirationDate:    row.expiration_date,
      supplierName:      row.supplier_name,
      isLowStock:        row.quantity_in_stock <= row.min_stock_threshold,
      isExpiringSoon:    diffDays >= 0 && diffDays <= 90,
      isExpired:         expDate < now,
    };
  });

  const report: InventoryReport = {
    totalProducts:     items.length,
    lowStockCount:     items.filter((i) => i.isLowStock).length,
    expiringSoonCount: items.filter((i) => i.isExpiringSoon && !i.isExpired).length,
    expiredCount:      items.filter((i) => i.isExpired).length,
    items,
    generatedAt: new Date(),
  };

  await auditLog(
    actorId,
    'REPORT_INVENTORY_GENERATED',
    { totalProducts: report.totalProducts, lowStockCount: report.lowStockCount },
    ipAddress,
  );

  logger.info('Inventory report generated', { actorId });

  return report;
}
