/**
 * Report Routes
 *
 * GET /api/reports/sales      – Sales report
 * GET /api/reports/inventory  – Inventory report
 * GET /api/reports/export     – Export report (CSV or HTML/PDF)
 *
 * Requirements: FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.6, FR-4.7
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import {
  generateSalesReport,
  generateInventoryReport,
} from '../services/reportService';
import { generateCSV, generatePDFReport } from '../utils/exportUtils';
import { logger } from '../config/logger';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('admin', 'pharmacist'));

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function handleError(err: unknown, res: Response): void {
  logger.error('Unexpected error in report route', {
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
// GET /api/reports/sales
// ----------------------------------------------------------------

router.get(
  '/sales',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { from, to } = req.query as Record<string, string | undefined>;

      if (!from || !to) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameters "from" and "to" (ISO date strings) are required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const report = await generateSalesReport(
        { from, to },
        req.user!.userId,
        getClientIp(req),
      );

      res.status(200).json({ data: report });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/reports/inventory
// ----------------------------------------------------------------

router.get(
  '/inventory',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { category, supplierId } = req.query as Record<string, string | undefined>;

      const report = await generateInventoryReport(
        { category, supplierId },
        req.user!.userId,
        getClientIp(req),
      );

      res.status(200).json({ data: report });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/reports/export
// ----------------------------------------------------------------

router.get(
  '/export',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { type, format, from, to, category, supplierId } =
        req.query as Record<string, string | undefined>;

      if (!type || !format) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameters "type" (sales|inventory) and "format" (csv|pdf) are required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      if (type === 'sales') {
        if (!from || !to) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Sales report requires "from" and "to" date parameters',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        const report = await generateSalesReport(
          { from, to },
          req.user!.userId,
          getClientIp(req),
        );

        if (format === 'csv') {
          // Top products CSV
          const csvData = report.topSellingProducts.map((p) => ({
            productId:     p.productId,
            productName:   p.productName,
            totalQuantity: p.totalQuantity,
            totalRevenue:  p.totalRevenue,
          }));
          const csv = generateCSV(csvData, [
            { key: 'productId',     label: 'Product ID' },
            { key: 'productName',   label: 'Product Name' },
            { key: 'totalQuantity', label: 'Total Quantity' },
            { key: 'totalRevenue',  label: 'Total Revenue' },
          ]);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="sales-report-${from}-${to}.csv"`,
          );
          res.status(200).send(csv);
          return;
        }

        // PDF (HTML)
        const html = generatePDFReport(
          {
            title: 'Sales Report',
            subtitle: `Period: ${from} to ${to}`,
            generatedAt: report.generatedAt,
            sections: [
              {
                heading: 'Summary',
                content: `Total Sales: $${report.totalSales.toFixed(2)} | Transactions: ${report.transactionCount}`,
              },
              {
                heading: 'Top Selling Products',
                content: {
                  type: 'table',
                  headers: ['Product', 'Qty Sold', 'Revenue'],
                  rows: report.topSellingProducts.map((p) => [
                    p.productName,
                    String(p.totalQuantity),
                    `$${p.totalRevenue.toFixed(2)}`,
                  ]),
                },
              },
              {
                heading: 'Payment Method Breakdown',
                content: {
                  type: 'table',
                  headers: ['Method', 'Transactions', 'Total'],
                  rows: report.paymentMethodBreakdown.map((p) => [
                    p.method,
                    String(p.count),
                    `$${p.total.toFixed(2)}`,
                  ]),
                },
              },
            ],
          },
          'sales',
        );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="sales-report-${from}-${to}.html"`,
        );
        res.status(200).send(html);
        return;
      }

      if (type === 'inventory') {
        const report = await generateInventoryReport(
          { category, supplierId },
          req.user!.userId,
          getClientIp(req),
        );

        if (format === 'csv') {
          const csvData = report.items.map((item) => ({
            id:                item.id,
            name:              item.name,
            dosage:            item.dosage ?? '',
            form:              item.form,
            category:          item.category,
            quantityInStock:   item.quantityInStock,
            minStockThreshold: item.minStockThreshold,
            unitPrice:         item.unitPrice,
            expirationDate:    item.expirationDate,
            supplierName:      item.supplierName ?? '',
            isLowStock:        item.isLowStock ? 'Yes' : 'No',
            isExpiringSoon:    item.isExpiringSoon ? 'Yes' : 'No',
            isExpired:         item.isExpired ? 'Yes' : 'No',
          }));
          const csv = generateCSV(csvData, [
            { key: 'id',                label: 'Product ID' },
            { key: 'name',              label: 'Name' },
            { key: 'dosage',            label: 'Dosage' },
            { key: 'form',              label: 'Form' },
            { key: 'category',          label: 'Category' },
            { key: 'quantityInStock',   label: 'Qty In Stock' },
            { key: 'minStockThreshold', label: 'Min Threshold' },
            { key: 'unitPrice',         label: 'Unit Price' },
            { key: 'expirationDate',    label: 'Expiration Date' },
            { key: 'supplierName',      label: 'Supplier' },
            { key: 'isLowStock',        label: 'Low Stock' },
            { key: 'isExpiringSoon',    label: 'Expiring Soon' },
            { key: 'isExpired',         label: 'Expired' },
          ]);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename="inventory-report.csv"',
          );
          res.status(200).send(csv);
          return;
        }

        // PDF (HTML)
        const html = generatePDFReport(
          {
            title: 'Inventory Report',
            generatedAt: report.generatedAt,
            sections: [
              {
                heading: 'Summary',
                content: `Total: ${report.totalProducts} | Low Stock: ${report.lowStockCount} | Expiring Soon: ${report.expiringSoonCount} | Expired: ${report.expiredCount}`,
              },
              {
                heading: 'Products',
                content: {
                  type: 'table',
                  headers: ['Name', 'Dosage', 'Category', 'Qty', 'Expiration', 'Status'],
                  rows: report.items.map((item) => [
                    item.name,
                    item.dosage ?? '',
                    item.category,
                    String(item.quantityInStock),
                    item.expirationDate,
                    item.isExpired
                      ? 'EXPIRED'
                      : item.isExpiringSoon
                      ? 'Expiring Soon'
                      : item.isLowStock
                      ? 'Low Stock'
                      : 'OK',
                  ]),
                },
              },
            ],
          },
          'inventory',
        );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="inventory-report.html"',
        );
        res.status(200).send(html);
        return;
      }

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'type must be "sales" or "inventory"',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default router;
