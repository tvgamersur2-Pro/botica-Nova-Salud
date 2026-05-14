/**
 * Transaction Routes
 *
 * POST   /api/transactions              – Create transaction (all authenticated roles)
 * GET    /api/transactions              – List transactions
 * GET    /api/transactions/:id          – Get transaction details
 * PUT    /api/transactions/:id/void     – Void transaction (Cashier, Admin)
 * PUT    /api/transactions/:id/refund   – Refund transaction (Cashier, Admin)
 * GET    /api/transactions/:id/receipt  – Get receipt data
 *
 * Requirements: FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-2.8
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import {
  createTransaction,
  getTransactionById,
  listTransactions,
  voidTransaction,
  refundTransaction,
  generateReceipt,
  TransactionServiceError,
} from '../services/transactionService';
import { StockServiceError } from '../services/stockService';
import { logger } from '../config/logger';
import type {
  PaymentMethod,
  TransactionStatus,
  ListTransactionsOptions,
} from '../types/transaction';

const router = Router();

// All transaction routes require authentication
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
  if (err instanceof TransactionServiceError || err instanceof StockServiceError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  logger.error('Unexpected error in transaction route', {
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
// POST /api/transactions
// Create a new transaction (all authenticated roles)
// ----------------------------------------------------------------

router.post(
  '/',
  requireRole('admin', 'pharmacist', 'cashier'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;

      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'items array is required and must not be empty',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      if (!body.paymentMethod) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'paymentMethod is required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const transaction = await createTransaction(
        {
          items: (body.items as Record<string, unknown>[]).map((item) => ({
            productId: String(item.productId),
            quantity:  Number(item.quantity),
          })),
          paymentMethod: body.paymentMethod as PaymentMethod,
          taxRate:    body.taxRate !== undefined ? Number(body.taxRate) : undefined,
          customerId: body.customerId ? String(body.customerId) : undefined,
        },
        req.user!.userId,
        getClientIp(req),
      );

      res.status(201).json({ data: transaction });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/transactions
// List transactions with optional filters
// ----------------------------------------------------------------

router.get(
  '/',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { cashierId, status, startDate, endDate, page, limit } =
        req.query as Record<string, string | undefined>;

      const options: ListTransactionsOptions = {};

      // Cashiers can only see their own transactions
      if (req.user!.role === 'cashier') {
        options.cashierId = req.user!.userId;
      } else if (cashierId) {
        options.cashierId = cashierId;
      }

      if (status) options.status = status as TransactionStatus;
      if (startDate) options.startDate = startDate;
      if (endDate) options.endDate = endDate;
      if (page) options.page = parseInt(page, 10);
      if (limit) options.limit = parseInt(limit, 10);

      const result = await listTransactions(options);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/transactions/:id
// Get transaction details
// ----------------------------------------------------------------

router.get(
  '/:id',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const transaction = await getTransactionById(req.params.id);

      // Cashiers can only view their own transactions
      if (
        req.user!.role === 'cashier' &&
        transaction.cashierId !== req.user!.userId
      ) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You do not have permission to view this transaction',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      res.status(200).json({ data: transaction });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// PUT /api/transactions/:id/void
// Void a transaction (Cashier, Admin)
// ----------------------------------------------------------------

router.put(
  '/:id/void',
  requireRole('cashier', 'admin'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const transaction = await voidTransaction(
        req.params.id,
        req.user!.userId,
        getClientIp(req),
      );
      res.status(200).json({ data: transaction });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// PUT /api/transactions/:id/refund
// Refund a transaction (Cashier, Admin)
// ----------------------------------------------------------------

router.put(
  '/:id/refund',
  requireRole('cashier', 'admin'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const transaction = await refundTransaction(
        req.params.id,
        req.user!.userId,
        getClientIp(req),
      );
      res.status(200).json({ data: transaction });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ----------------------------------------------------------------
// GET /api/transactions/:id/receipt
// Get receipt data for a transaction
// ----------------------------------------------------------------

router.get(
  '/:id/receipt',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const receipt = await generateReceipt(req.params.id);
      res.status(200).json({ data: receipt });
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default router;
