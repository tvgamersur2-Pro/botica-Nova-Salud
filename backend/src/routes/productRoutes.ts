/**
 * Product Management Routes
 *
 * GET    /api/products        – List products with search/filter/pagination
 * POST   /api/products        – Create product (Admin, Pharmacist)
 * GET    /api/products/:id    – Get product details
 * PUT    /api/products/:id    – Update product (Admin, Pharmacist)
 * DELETE /api/products/:id    – Delete product (Admin only)
 *
 * Requirements: FR-1.1, FR-1.3, FR-1.4, FR-2.2, FR-3.2
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  ProductServiceError,
} from '../services/productService';
import { logger } from '../config/logger';
import type { ProductCategory, ProductForm, ListProductsOptions } from '../types/product';

const router = Router();

// All product routes require authentication
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

  logger.error('Unexpected error in product route', {
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
// GET /api/products
// List products with optional search, filtering, and pagination
// ----------------------------------------------------------------

router.get(
  '/',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { search, category, supplierId, stockLevel, page, limit } =
        req.query as Record<string, string | undefined>;

      const options: ListProductsOptions = {};

      if (search) options.search = search;

      if (category !== undefined) {
        const validCategories: ProductCategory[] = ['prescription', 'otc', 'general'];
        if (!validCategories.includes(category as ProductCategory)) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: `category must be one of: ${validCategories.join(', ')}`,
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        options.category = category as ProductCategory;
      }

      if (supplierId) options.supplierId = supplierId;

      if (stockLevel !== undefined) {
        if (stockLevel !== 'low_stock' && stockLevel !== 'in_stock') {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'stockLevel must be "low_stock" or "in_stock"',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        options.stockLevel = stockLevel;
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

      const result = await listProducts(options);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// POST /api/products
// Create a new product (Admin, Pharmacist)
// ----------------------------------------------------------------

router.post(
  '/',
  requireRole('admin', 'pharmacist'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;

      const requiredFields = ['name', 'form', 'quantityInStock', 'unitPrice', 'expirationDate', 'category'];
      for (const field of requiredFields) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
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

      const newProduct = await createProduct(
        {
          name:              String(body.name).trim(),
          dosage:            body.dosage ? String(body.dosage) : undefined,
          form:              body.form as ProductForm,
          quantityInStock:   Number(body.quantityInStock),
          unitPrice:         Number(body.unitPrice),
          supplierId:        body.supplierId ? String(body.supplierId) : undefined,
          expirationDate:    String(body.expirationDate),
          category:          body.category as ProductCategory,
          minStockThreshold: body.minStockThreshold !== undefined ? Number(body.minStockThreshold) : undefined,
          reorderQuantity:   body.reorderQuantity !== undefined ? Number(body.reorderQuantity) : undefined,
        },
        req.user!.userId,
        getClientIp(req),
      );

      res.status(201).json({ data: newProduct });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/products/:id
// Get a single product by ID
// ----------------------------------------------------------------

router.get(
  '/:id',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const product = await getProductById(req.params.id);
      res.status(200).json({ data: product });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// PUT /api/products/:id
// Update a product (Admin, Pharmacist)
// ----------------------------------------------------------------

router.put(
  '/:id',
  requireRole('admin', 'pharmacist'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;

      const updated = await updateProduct(
        req.params.id,
        {
          name:              body.name !== undefined ? String(body.name) : undefined,
          dosage:            body.dosage !== undefined ? String(body.dosage) : undefined,
          form:              body.form !== undefined ? (body.form as ProductForm) : undefined,
          quantityInStock:   body.quantityInStock !== undefined ? Number(body.quantityInStock) : undefined,
          unitPrice:         body.unitPrice !== undefined ? Number(body.unitPrice) : undefined,
          supplierId:        body.supplierId !== undefined ? (body.supplierId ? String(body.supplierId) : null) : undefined,
          expirationDate:    body.expirationDate !== undefined ? String(body.expirationDate) : undefined,
          category:          body.category !== undefined ? (body.category as ProductCategory) : undefined,
          minStockThreshold: body.minStockThreshold !== undefined ? Number(body.minStockThreshold) : undefined,
          reorderQuantity:   body.reorderQuantity !== undefined ? Number(body.reorderQuantity) : undefined,
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
// DELETE /api/products/:id
// Delete a product (Admin only)
// ----------------------------------------------------------------

router.delete(
  '/:id',
  requireRole('admin'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      await deleteProduct(req.params.id, req.user!.userId, getClientIp(req));
      res.status(200).json({ data: { message: 'Product deleted successfully' } });
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default router;
