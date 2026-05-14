/**
 * Transaction Processing Service
 *
 * Handles:
 *  - Transaction creation with atomic stock decrements (FR-2.1, FR-2.3, Property 2, 5, 6)
 *  - Transaction retrieval and listing (FR-2.2)
 *  - Transaction voiding with stock restoration (FR-2.7)
 *  - Refund processing (FR-2.7)
 *  - Receipt generation (FR-2.6)
 *  - Audit logging for all mutations (FR-6.4, Property 8)
 *
 * Requirements: FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-2.8
 */

import crypto from 'crypto';
import { query, withTransaction } from '../config/database';
import { logger } from '../config/logger';
import { decrementStock, incrementStock } from './stockService';
import type { RowDataPacket } from 'mysql2';
import type {
  TransactionRecord,
  TransactionItem,
  CreateTransactionInput,
  ListTransactionsOptions,
  PaginatedTransactions,
  ReceiptData,
  PaymentMethod,
  TransactionStatus,
  RefundStatus,
} from '../types/transaction';

// ----------------------------------------------------------------
// Custom error
// ----------------------------------------------------------------

export class TransactionServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'TransactionServiceError';
  }
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const VALID_PAYMENT_METHODS: PaymentMethod[] = ['cash', 'credit', 'insurance'];

// ----------------------------------------------------------------
// Row mappers
// ----------------------------------------------------------------

function rowToTransactionRecord(row: Record<string, unknown>): TransactionRecord {
  return {
    id:            row.id as string,
    timestamp:     new Date(row.timestamp as string),
    totalAmount:   parseFloat(row.total_amount as string),
    taxAmount:     parseFloat(row.tax_amount as string),
    paymentMethod: row.payment_method as PaymentMethod,
    cashierId:     row.cashier_id as string,
    customerId:    (row.customer_id as string | null) ?? null,
    refundStatus:  row.refund_status as RefundStatus,
    status:        row.status as TransactionStatus,
    createdAt:     new Date(row.created_at as string),
    cashierName:   (row.cashier_name as string | null) ?? undefined,
  };
}

function rowToTransactionItem(row: Record<string, unknown>): TransactionItem {
  return {
    id:            row.id as string,
    transactionId: row.transaction_id as string,
    productId:     row.product_id as string,
    productName:   row.product_name as string,
    quantity:      row.quantity as number,
    unitPrice:     parseFloat(row.unit_price as string),
    totalPrice:    parseFloat(row.total_price as string),
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
// Transaction CRUD
// ----------------------------------------------------------------

/**
 * Creates a new transaction, atomically decrementing stock for each item.
 * Unit prices are fetched from the database (not client-provided).
 * Total = sum(quantity × unit_price) + taxAmount, where taxAmount = subtotal * taxRate (Property 5, FR-2.4).
 * Validates stock availability before processing (Property 6, FR-2.8).
 * All DB operations are wrapped in a single transaction for atomicity (Property 2, Property 13).
 *
 * Requirements: FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.8
 */
export async function createTransaction(
  input: CreateTransactionInput,
  actorId: string,
  ipAddress?: string,
): Promise<TransactionRecord> {
  // Validate input
  if (!input.items || input.items.length === 0) {
    throw new TransactionServiceError(
      'Transaction must have at least one item',
      'VALIDATION_ERROR',
      400,
    );
  }

  if (!VALID_PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new TransactionServiceError(
      `paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`,
      'VALIDATION_ERROR',
      400,
    );
  }

  for (const item of input.items) {
    if (!item.productId) {
      throw new TransactionServiceError('Each item must have a productId', 'VALIDATION_ERROR', 400);
    }
    if (!item.quantity || item.quantity <= 0) {
      throw new TransactionServiceError(
        'Each item quantity must be greater than zero',
        'VALIDATION_ERROR',
        400,
      );
    }
  }

  const taxRate = input.taxRate ?? 0;

  // Generate UUID before INSERT so we can SELECT after
  const newTxId = crypto.randomUUID();

  const transaction = await withTransaction(async (client) => {
    // Fetch product details and validate stock for all items (Property 6, FR-2.8)
    const productIds = input.items.map((i) => i.productId);
    const [productRows] = await client.query(
      `SELECT id, name, unit_price, quantity_in_stock, expiration_date
       FROM products
       WHERE id IN (${productIds.map(() => '?').join(',')})`,
      productIds,
    );

    const productMap = new Map(
      (productRows as Record<string, unknown>[]).map((r) => [r.id as string, r]),
    );

    // Validate all products exist and have sufficient stock
    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new TransactionServiceError(
          `Product ${item.productId} not found`,
          'NOT_FOUND',
          404,
        );
      }
      if ((product.quantity_in_stock as number) < item.quantity) {
        // Property 6: INSUFFICIENT_STOCK error prevents adding more items than available
        throw new TransactionServiceError(
          `Insufficient stock for "${product.name as string}". Available: ${product.quantity_in_stock as number}, requested: ${item.quantity}`,
          'INSUFFICIENT_STOCK',
          400,
        );
      }
      // Prevent sale of expired products
      if (new Date(product.expiration_date as string) < new Date()) {
        throw new TransactionServiceError(
          `Product "${product.name as string}" is expired and cannot be sold`,
          'PRODUCT_EXPIRED',
          400,
        );
      }
    }

    // Calculate subtotal and total (Property 5, FR-2.4)
    // taxAmount = subtotal * taxRate
    const subtotal = input.items.reduce((sum, item) => {
      const product = productMap.get(item.productId)!;
      return sum + item.quantity * parseFloat(product.unit_price as string);
    }, 0);

    const taxAmount = parseFloat((subtotal * taxRate).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

    // Create transaction record (FR-2.1) — no RETURNING, use pre-generated UUID
    await client.query(
      `INSERT INTO transactions
         (id, total_amount, tax_amount, payment_method, cashier_id, customer_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
      [
        newTxId,
        totalAmount,
        taxAmount,
        input.paymentMethod,
        actorId,
        input.customerId ?? null,
      ],
    );

    // Insert items and decrement stock atomically (Property 2, Property 13)
    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      const unitPrice = parseFloat(product.unit_price as string);
      const itemTotal = parseFloat((item.quantity * unitPrice).toFixed(2));

      await client.query(
        `INSERT INTO transaction_items
           (transaction_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newTxId,
          item.productId,
          product.name as string,
          item.quantity,
          unitPrice,
          itemTotal,
        ],
      );

      // Atomic stock decrement within the same DB transaction (Property 2)
      await decrementStock(item.productId, item.quantity, client);
    }

    // Fetch the created transaction record
    const [txRows] = await client.query(
      `SELECT t.*, u.full_name AS cashier_name
       FROM transactions t
       LEFT JOIN users u ON u.id = t.cashier_id
       WHERE t.id = ?`,
      [newTxId],
    );
    return rowToTransactionRecord((txRows as Record<string, unknown>[])[0]);
  });

  await auditLog(
    actorId,
    'TRANSACTION_CREATED',
    transaction.id,
    null,
    {
      totalAmount: transaction.totalAmount,
      paymentMethod: input.paymentMethod,
      itemCount: input.items.length,
    },
    ipAddress,
  );

  logger.info('Transaction created', {
    actorId,
    transactionId: transaction.id,
    totalAmount: transaction.totalAmount,
  });

  return transaction;
}

/**
 * Retrieves a transaction by ID, including its items and cashier name.
 * Requirements: FR-2.2
 */
export async function getTransactionById(id: string): Promise<TransactionRecord> {
  const txResult = await query<RowDataPacket & Record<string, unknown>>(
    `SELECT t.*, u.full_name AS cashier_name
     FROM transactions t
     LEFT JOIN users u ON u.id = t.cashier_id
     WHERE t.id = $1`,
    [id],
  );

  if (txResult.rowCount === 0) {
    throw new TransactionServiceError('Transaction not found', 'NOT_FOUND', 404);
  }

  const transaction = rowToTransactionRecord(txResult.rows[0]);

  // Fetch items
  const itemsResult = await query<RowDataPacket & Record<string, unknown>>(
    `SELECT * FROM transaction_items WHERE transaction_id = $1 ORDER BY id`,
    [id],
  );

  transaction.items = itemsResult.rows.map(rowToTransactionItem);

  return transaction;
}

/**
 * Lists transactions with optional filters and pagination.
 * Requirements: FR-2.2
 */
export async function listTransactions(
  options: ListTransactionsOptions = {},
): Promise<PaginatedTransactions> {
  const { cashierId, status, startDate, endDate, page = 1, limit = 20 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (cashierId) {
    conditions.push(`t.cashier_id = $${paramIdx++}`);
    params.push(cashierId);
  }
  if (status) {
    conditions.push(`t.status = $${paramIdx++}`);
    params.push(status);
  }
  if (startDate) {
    conditions.push(`t.timestamp >= $${paramIdx++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`t.timestamp <= $${paramIdx++}`);
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<RowDataPacket & { count: string }>(
    `SELECT COUNT(*) AS count FROM transactions t ${whereClause}`,
    params,
  );
  const total = Number(countResult.rows[0].count);

  const offset = (page - 1) * limit;
  const dataResult = await query<Record<string, unknown>>(
    `SELECT t.*, u.full_name AS cashier_name
     FROM transactions t
     LEFT JOIN users u ON u.id = t.cashier_id
     ${whereClause}
     ORDER BY t.timestamp DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );

  return {
    data: dataResult.rows.map(rowToTransactionRecord),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Voids a transaction and restores stock for all items.
 * Only completed transactions can be voided (FR-2.7).
 * Requirements: FR-2.7
 */
export async function voidTransaction(
  id: string,
  actorId: string,
  ipAddress?: string,
): Promise<TransactionRecord> {
  const current = await getTransactionById(id);

  if (current.status !== 'completed') {
    throw new TransactionServiceError(
      `Transaction cannot be voided. Current status: ${current.status}`,
      'INVALID_STATE',
      400,
    );
  }

  const updated = await withTransaction(async (client) => {
    // Restore stock for each item
    for (const item of current.items ?? []) {
      await incrementStock(item.productId, item.quantity, client);
    }

    await client.query(
      `UPDATE transactions
       SET status = 'voided'
       WHERE id = ?`,
      [id],
    );

    const [rows] = await client.query(
      `SELECT t.*, u.full_name AS cashier_name
       FROM transactions t
       LEFT JOIN users u ON u.id = t.cashier_id
       WHERE t.id = ?`,
      [id],
    );
    return rowToTransactionRecord((rows as Record<string, unknown>[])[0]);
  });

  await auditLog(
    actorId,
    'TRANSACTION_VOIDED',
    id,
    { status: current.status, totalAmount: current.totalAmount },
    { status: 'voided' },
    ipAddress,
  );

  logger.info('Transaction voided', { actorId, transactionId: id });

  return updated;
}

/**
 * Processes a full refund for a transaction.
 * Changes refund_status to 'full' and restores stock.
 * Requirements: FR-2.7
 */
export async function refundTransaction(
  id: string,
  actorId: string,
  ipAddress?: string,
): Promise<TransactionRecord> {
  const current = await getTransactionById(id);

  if (current.status === 'voided') {
    throw new TransactionServiceError(
      'Cannot refund a voided transaction',
      'INVALID_STATE',
      400,
    );
  }
  if (current.refundStatus === 'full') {
    throw new TransactionServiceError(
      'Transaction has already been fully refunded',
      'INVALID_STATE',
      400,
    );
  }

  const updated = await withTransaction(async (client) => {
    // Restore stock for each item
    for (const item of current.items ?? []) {
      await incrementStock(item.productId, item.quantity, client);
    }

    await client.query(
      `UPDATE transactions
       SET refund_status = 'full'
       WHERE id = ?`,
      [id],
    );

    const [rows] = await client.query(
      `SELECT t.*, u.full_name AS cashier_name
       FROM transactions t
       LEFT JOIN users u ON u.id = t.cashier_id
       WHERE t.id = ?`,
      [id],
    );
    return rowToTransactionRecord((rows as Record<string, unknown>[])[0]);
  });

  await auditLog(
    actorId,
    'TRANSACTION_REFUNDED',
    id,
    { refundStatus: current.refundStatus, status: current.status },
    { refundStatus: 'full' },
    ipAddress,
  );

  logger.info('Transaction refunded', { actorId, transactionId: id });

  return updated;
}

/**
 * Generates receipt data for a transaction.
 * Requirements: FR-2.6
 */
export async function generateReceipt(transactionId: string): Promise<ReceiptData> {
  const transaction = await getTransactionById(transactionId);

  const items = (transaction.items ?? []).map((item) => ({
    productName: item.productName,
    quantity:    item.quantity,
    unitPrice:   item.unitPrice,
    totalPrice:  item.totalPrice,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return {
    transactionId: transaction.id,
    timestamp:     transaction.timestamp,
    cashierName:   transaction.cashierName ?? transaction.cashierId,
    items,
    subtotal:      parseFloat(subtotal.toFixed(2)),
    taxAmount:     transaction.taxAmount,
    totalAmount:   transaction.totalAmount,
    paymentMethod: transaction.paymentMethod,
  };
}
