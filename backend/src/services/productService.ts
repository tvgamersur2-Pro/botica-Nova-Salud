/**
 * Product & Supplier Management Service
 *
 * Business logic for:
 *  - Product CRUD operations (FR-1.1, FR-1.3, FR-1.4)
 *  - Product search and filtering (FR-2.2, FR-2.8, FR-1.1, FR-3.2)
 *  - Supplier CRUD operations (FR-1.7, FR-3.7)
 *  - Audit logging for all mutations (FR-1.7, FR-6.4)
 *
 * Business rules:
 *  - Admin and Pharmacist can create and update products
 *  - Only Admin can delete products (soft delete via is_deleted flag not in schema → hard delete with confirmation)
 *  - quantity_in_stock >= 0
 *  - unit_price > 0
 *  - expiration_date must be in the future on create
 */

import crypto from 'crypto';
import { query, withTransaction } from '../config/database';
import { logger } from '../config/logger';
import type {
  ProductRecord,
  SupplierRecord,
  CreateProductInput,
  UpdateProductInput,
  CreateSupplierInput,
  UpdateSupplierInput,
  ListProductsOptions,
  ListSuppliersOptions,
  PaginatedProducts,
  PaginatedSuppliers,
  ProductForm,
  ProductCategory,
} from '../types/product';

// ----------------------------------------------------------------
// Custom error class
// ----------------------------------------------------------------

export class ProductServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ProductServiceError';
  }
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const VALID_FORMS: ProductForm[] = ['tablet', 'capsule', 'liquid', 'injection', 'cream', 'other'];
const VALID_CATEGORIES: ProductCategory[] = ['prescription', 'otc', 'general'];

// ----------------------------------------------------------------
// Row mappers
// ----------------------------------------------------------------

function rowToProductRecord(row: Record<string, unknown>): ProductRecord {
  return {
    id:                row.id as string,
    name:              row.name as string,
    dosage:            (row.dosage as string | null) ?? null,
    form:              row.form as ProductForm,
    quantityInStock:   row.quantity_in_stock as number,
    unitPrice:         parseFloat(row.unit_price as string),
    supplierId:        (row.supplier_id as string | null) ?? null,
    expirationDate:    new Date(row.expiration_date as string),
    category:          row.category as ProductCategory,
    minStockThreshold: row.min_stock_threshold as number,
    reorderQuantity:   row.reorder_quantity as number,
    createdAt:         new Date(row.created_at as string),
    updatedAt:         new Date(row.updated_at as string),
    updatedBy:         (row.updated_by as string | null) ?? null,
    supplierName:      (row.supplier_name as string | null) ?? null,
  };
}

function rowToSupplierRecord(row: Record<string, unknown>): SupplierRecord {
  return {
    id:           row.id as string,
    name:         row.name as string,
    contactEmail: (row.contact_email as string | null) ?? null,
    phone:        (row.phone as string | null) ?? null,
    address:      (row.address as string | null) ?? null,
    leadTimeDays: parseFloat(row.lead_time_days as string),
    pricing:      (row.pricing as Record<string, unknown> | null) ?? null,
    createdAt:    new Date(row.created_at as string),
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
// Validation helpers
// ----------------------------------------------------------------

function validateProductInput(input: CreateProductInput | UpdateProductInput, isCreate: boolean): void {
  if (isCreate) {
    const ci = input as CreateProductInput;
    if (!ci.name?.trim()) {
      throw new ProductServiceError('Product name is required', 'VALIDATION_ERROR', 400);
    }
    if (!ci.form || !VALID_FORMS.includes(ci.form)) {
      throw new ProductServiceError(
        `form must be one of: ${VALID_FORMS.join(', ')}`,
        'VALIDATION_ERROR',
        400,
      );
    }
    if (!ci.category || !VALID_CATEGORIES.includes(ci.category)) {
      throw new ProductServiceError(
        `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
        'VALIDATION_ERROR',
        400,
      );
    }
    if (ci.quantityInStock === undefined || ci.quantityInStock === null) {
      throw new ProductServiceError('quantityInStock is required', 'VALIDATION_ERROR', 400);
    }
    if (ci.unitPrice === undefined || ci.unitPrice === null) {
      throw new ProductServiceError('unitPrice is required', 'VALIDATION_ERROR', 400);
    }
    if (!ci.expirationDate) {
      throw new ProductServiceError('expirationDate is required', 'VALIDATION_ERROR', 400);
    }
  }

  // Shared validations (apply when field is present)
  if (input.quantityInStock !== undefined && input.quantityInStock < 0) {
    throw new ProductServiceError(
      'quantityInStock must be >= 0',
      'VALIDATION_ERROR',
      400,
    );
  }
  if (input.unitPrice !== undefined && input.unitPrice <= 0) {
    throw new ProductServiceError(
      'unitPrice must be > 0',
      'VALIDATION_ERROR',
      400,
    );
  }
  if (input.expirationDate !== undefined) {
    const expDate = new Date(input.expirationDate);
    if (isNaN(expDate.getTime())) {
      throw new ProductServiceError('expirationDate is not a valid date', 'VALIDATION_ERROR', 400);
    }
    if (isCreate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expDate <= today) {
        throw new ProductServiceError(
          'expirationDate must be in the future',
          'VALIDATION_ERROR',
          400,
        );
      }
    }
  }
  if (input.form !== undefined && !VALID_FORMS.includes(input.form as ProductForm)) {
    throw new ProductServiceError(
      `form must be one of: ${VALID_FORMS.join(', ')}`,
      'VALIDATION_ERROR',
      400,
    );
  }
  if (input.category !== undefined && !VALID_CATEGORIES.includes(input.category as ProductCategory)) {
    throw new ProductServiceError(
      `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
      'VALIDATION_ERROR',
      400,
    );
  }
}

// ----------------------------------------------------------------
// Product CRUD
// ----------------------------------------------------------------

/**
 * List products with optional search, filtering, and pagination.
 * Requirements: FR-1.1, FR-2.2, FR-3.2
 */
export async function listProducts(
  options: ListProductsOptions = {},
): Promise<PaginatedProducts> {
  const { search, category, supplierId, stockLevel, page = 1, limit = 20 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push(`(p.name LIKE ? OR p.dosage LIKE ? OR p.id = ?)`);
    params.push(`%${search}%`, `%${search}%`, search);
  }

  if (category) {
    conditions.push(`p.category = ?`);
    params.push(category);
  }

  if (supplierId) {
    conditions.push(`p.supplier_id = ?`);
    params.push(supplierId);
  }

  if (stockLevel === 'low_stock') {
    conditions.push(`p.quantity_in_stock <= p.min_stock_threshold`);
  } else if (stockLevel === 'in_stock') {
    conditions.push(`p.quantity_in_stock > p.min_stock_threshold`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM products p ${whereClause}`,
    params,
  );
  const total = Number(countResult.rows[0].count);

  const offset = (page - 1) * limit;
  const dataResult = await query<Record<string, unknown>>(
    `SELECT p.*, s.name AS supplier_name
     FROM products p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     ${whereClause}
     ORDER BY p.name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    data: dataResult.rows.map(rowToProductRecord),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}


/**
 * Get a single product by ID.
 * Requirements: FR-1.1
 */
export async function getProductById(id: string): Promise<ProductRecord> {
  const result = await query<Record<string, unknown>>(
    `SELECT p.*, s.name AS supplier_name
     FROM products p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.id = $1`,
    [id],
  );

  if (result.rowCount === 0) {
    throw new ProductServiceError('Product not found', 'NOT_FOUND', 404);
  }

  return rowToProductRecord(result.rows[0]);
}

/**
 * Create a new product (Admin, Pharmacist).
 * Requirements: FR-1.1, FR-1.2
 */
export async function createProduct(
  input: CreateProductInput,
  actorId: string,
  ipAddress?: string,
): Promise<ProductRecord> {
  validateProductInput(input, true);

  // Verify supplier exists if provided
  if (input.supplierId) {
    const supplierCheck = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM suppliers WHERE id = $1',
      [input.supplierId],
    );
    if (Number(supplierCheck.rows[0].count) === 0) {
      throw new ProductServiceError('Supplier not found', 'NOT_FOUND', 404);
    }
  }

  // Generate UUID before INSERT so we can SELECT after
  const newId = crypto.randomUUID();

  const newProduct = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO products
         (id, name, dosage, form, quantity_in_stock, unit_price, supplier_id,
          expiration_date, category, min_stock_threshold, reorder_quantity, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        input.name.trim(),
        input.dosage?.trim() ?? null,
        input.form,
        input.quantityInStock,
        input.unitPrice,
        input.supplierId ?? null,
        input.expirationDate,
        input.category,
        input.minStockThreshold ?? 10,
        input.reorderQuantity ?? 50,
        actorId,
      ],
    );

    const [rows] = await client.query(
      `SELECT p.*, s.name AS supplier_name
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.id = ?`,
      [newId],
    );
    return rowToProductRecord((rows as Record<string, unknown>[])[0]);
  });

  await auditLog(
    actorId,
    'PRODUCT_CREATED',
    newProduct.id,
    null,
    {
      name: newProduct.name,
      category: newProduct.category,
      quantityInStock: newProduct.quantityInStock,
      unitPrice: newProduct.unitPrice,
    },
    ipAddress,
  );

  logger.info('Product created', { actorId, productId: newProduct.id, name: newProduct.name });

  return newProduct;
}

/**
 * Update an existing product (Admin, Pharmacist).
 * Requirements: FR-1.3
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  actorId: string,
  ipAddress?: string,
): Promise<ProductRecord> {
  const current = await getProductById(id);

  validateProductInput(input, false);

  // Verify supplier exists if changing
  if (input.supplierId !== undefined && input.supplierId !== null) {
    const supplierCheck = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM suppliers WHERE id = $1',
      [input.supplierId],
    );
    if (Number(supplierCheck.rows[0].count) === 0) {
      throw new ProductServiceError('Supplier not found', 'NOT_FOUND', 404);
    }
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    setClauses.push(`name = ?`);
    params.push(input.name.trim());
  }
  if (input.dosage !== undefined) {
    setClauses.push(`dosage = ?`);
    params.push(input.dosage.trim() || null);
  }
  if (input.form !== undefined) {
    setClauses.push(`form = ?`);
    params.push(input.form);
  }
  if (input.quantityInStock !== undefined) {
    setClauses.push(`quantity_in_stock = ?`);
    params.push(input.quantityInStock);
  }
  if (input.unitPrice !== undefined) {
    setClauses.push(`unit_price = ?`);
    params.push(input.unitPrice);
  }
  if (input.supplierId !== undefined) {
    setClauses.push(`supplier_id = ?`);
    params.push(input.supplierId);
  }
  if (input.expirationDate !== undefined) {
    setClauses.push(`expiration_date = ?`);
    params.push(input.expirationDate);
  }
  if (input.category !== undefined) {
    setClauses.push(`category = ?`);
    params.push(input.category);
  }
  if (input.minStockThreshold !== undefined) {
    setClauses.push(`min_stock_threshold = ?`);
    params.push(input.minStockThreshold);
  }
  if (input.reorderQuantity !== undefined) {
    setClauses.push(`reorder_quantity = ?`);
    params.push(input.reorderQuantity);
  }

  if (setClauses.length === 0) {
    throw new ProductServiceError('No fields to update', 'VALIDATION_ERROR', 400);
  }

  // Always update updated_at and updated_by
  setClauses.push(`updated_at = NOW()`);
  setClauses.push(`updated_by = ?`);
  params.push(actorId);

  // WHERE id = ?
  params.push(id);

  const updated = await withTransaction(async (client) => {
    const [updateResult] = await client.query(
      `UPDATE products
       SET ${setClauses.join(', ')}
       WHERE id = ?`,
      params,
    );

    if ((updateResult as { affectedRows: number }).affectedRows === 0) {
      throw new ProductServiceError('Product not found', 'NOT_FOUND', 404);
    }

    const [rows] = await client.query(
      `SELECT p.*, s.name AS supplier_name
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.id = ?`,
      [id],
    );
    return rowToProductRecord((rows as Record<string, unknown>[])[0]);
  });

  const beforeState: Record<string, unknown> = {
    name: current.name,
    category: current.category,
    quantityInStock: current.quantityInStock,
    unitPrice: current.unitPrice,
    expirationDate: current.expirationDate,
  };
  const afterState: Record<string, unknown> = {
    name: updated.name,
    category: updated.category,
    quantityInStock: updated.quantityInStock,
    unitPrice: updated.unitPrice,
    expirationDate: updated.expirationDate,
  };

  await auditLog(actorId, 'PRODUCT_UPDATED', id, beforeState, afterState, ipAddress);

  logger.info('Product updated', { actorId, productId: id });

  return updated;
}

/**
 * Delete a product (Admin only).
 * Requirements: FR-1.4
 */
export async function deleteProduct(
  id: string,
  actorId: string,
  ipAddress?: string,
): Promise<void> {
  const current = await getProductById(id);

  await withTransaction(async (client) => {
    const [result] = await client.query(
      'DELETE FROM products WHERE id = ?',
      [id],
    );

    if ((result as { affectedRows: number }).affectedRows === 0) {
      throw new ProductServiceError('Product not found', 'NOT_FOUND', 404);
    }
  });

  await auditLog(
    actorId,
    'PRODUCT_DELETED',
    id,
    { name: current.name, category: current.category, quantityInStock: current.quantityInStock },
    null,
    ipAddress,
  );

  logger.info('Product deleted', { actorId, productId: id, name: current.name });
}

// ----------------------------------------------------------------
// Supplier CRUD
// ----------------------------------------------------------------

/**
 * List suppliers with optional search and pagination.
 * Requirements: FR-1.7
 */
export async function listSuppliers(
  options: ListSuppliersOptions = {},
): Promise<PaginatedSuppliers> {
  const { search, page = 1, limit = 20 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push(`(name LIKE ? OR contact_email LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM suppliers ${whereClause}`,
    params,
  );
  const total = Number(countResult.rows[0].count);

  const offset = (page - 1) * limit;
  const dataResult = await query<Record<string, unknown>>(
    `SELECT * FROM suppliers
     ${whereClause}
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    data: dataResult.rows.map(rowToSupplierRecord),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single supplier by ID.
 * Requirements: FR-1.7
 */
export async function getSupplierById(id: string): Promise<SupplierRecord> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM suppliers WHERE id = $1',
    [id],
  );

  if (result.rowCount === 0) {
    throw new ProductServiceError('Supplier not found', 'NOT_FOUND', 404);
  }

  return rowToSupplierRecord(result.rows[0]);
}

/**
 * Create a new supplier (Admin, Pharmacist).
 * Requirements: FR-1.7
 */
export async function createSupplier(
  input: CreateSupplierInput,
  actorId: string,
  ipAddress?: string,
): Promise<SupplierRecord> {
  if (!input.name?.trim()) {
    throw new ProductServiceError('Supplier name is required', 'VALIDATION_ERROR', 400);
  }
  if (input.leadTimeDays !== undefined && input.leadTimeDays < 0) {
    throw new ProductServiceError('leadTimeDays must be >= 0', 'VALIDATION_ERROR', 400);
  }

  // Generate UUID before INSERT so we can SELECT after
  const newId = crypto.randomUUID();

  const newSupplier = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO suppliers (id, name, contact_email, phone, address, lead_time_days, pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        input.name.trim(),
        input.contactEmail?.trim() ?? null,
        input.phone?.trim() ?? null,
        input.address?.trim() ?? null,
        input.leadTimeDays ?? 7.0,
        input.pricing ? JSON.stringify(input.pricing) : null,
      ],
    );

    const [rows] = await client.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [newId],
    );
    return rowToSupplierRecord((rows as Record<string, unknown>[])[0]);
  });

  await auditLog(
    actorId,
    'SUPPLIER_CREATED',
    newSupplier.id,
    null,
    { name: newSupplier.name, contactEmail: newSupplier.contactEmail },
    ipAddress,
  );

  logger.info('Supplier created', { actorId, supplierId: newSupplier.id, name: newSupplier.name });

  return newSupplier;
}

/**
 * Update an existing supplier (Admin, Pharmacist).
 * Requirements: FR-1.7
 */
export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput,
  actorId: string,
  ipAddress?: string,
): Promise<SupplierRecord> {
  const current = await getSupplierById(id);

  if (input.leadTimeDays !== undefined && input.leadTimeDays < 0) {
    throw new ProductServiceError('leadTimeDays must be >= 0', 'VALIDATION_ERROR', 400);
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    if (!input.name.trim()) {
      throw new ProductServiceError('Supplier name cannot be empty', 'VALIDATION_ERROR', 400);
    }
    setClauses.push(`name = ?`);
    params.push(input.name.trim());
  }
  if (input.contactEmail !== undefined) {
    setClauses.push(`contact_email = ?`);
    params.push(input.contactEmail?.trim() ?? null);
  }
  if (input.phone !== undefined) {
    setClauses.push(`phone = ?`);
    params.push(input.phone?.trim() ?? null);
  }
  if (input.address !== undefined) {
    setClauses.push(`address = ?`);
    params.push(input.address?.trim() ?? null);
  }
  if (input.leadTimeDays !== undefined) {
    setClauses.push(`lead_time_days = ?`);
    params.push(input.leadTimeDays);
  }
  if (input.pricing !== undefined) {
    setClauses.push(`pricing = ?`);
    params.push(input.pricing ? JSON.stringify(input.pricing) : null);
  }

  if (setClauses.length === 0) {
    throw new ProductServiceError('No fields to update', 'VALIDATION_ERROR', 400);
  }

  // WHERE id = ?
  params.push(id);

  const updated = await withTransaction(async (client) => {
    const [updateResult] = await client.query(
      `UPDATE suppliers
       SET ${setClauses.join(', ')}
       WHERE id = ?`,
      params,
    );

    if ((updateResult as { affectedRows: number }).affectedRows === 0) {
      throw new ProductServiceError('Supplier not found', 'NOT_FOUND', 404);
    }

    const [rows] = await client.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [id],
    );
    return rowToSupplierRecord((rows as Record<string, unknown>[])[0]);
  });

  await auditLog(
    actorId,
    'SUPPLIER_UPDATED',
    id,
    { name: current.name, contactEmail: current.contactEmail, leadTimeDays: current.leadTimeDays },
    { name: updated.name, contactEmail: updated.contactEmail, leadTimeDays: updated.leadTimeDays },
    ipAddress,
  );

  logger.info('Supplier updated', { actorId, supplierId: id });

  return updated;
}

/**
 * Delete a supplier (Admin only).
 * Requirements: FR-1.7
 */
export async function deleteSupplier(
  id: string,
  actorId: string,
  ipAddress?: string,
): Promise<void> {
  const current = await getSupplierById(id);

  // Check if any products reference this supplier
  const productCheck = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM products WHERE supplier_id = $1',
    [id],
  );
  if (Number(productCheck.rows[0].count) > 0) {
    throw new ProductServiceError(
      'Cannot delete supplier: it is referenced by one or more products',
      'CONFLICT',
      409,
    );
  }

  await withTransaction(async (client) => {
    const [result] = await client.query('DELETE FROM suppliers WHERE id = ?', [id]);
    if ((result as { affectedRows: number }).affectedRows === 0) {
      throw new ProductServiceError('Supplier not found', 'NOT_FOUND', 404);
    }
  });

  await auditLog(
    actorId,
    'SUPPLIER_DELETED',
    id,
    { name: current.name },
    null,
    ipAddress,
  );

  logger.info('Supplier deleted', { actorId, supplierId: id, name: current.name });
}

/**
 * Suggest the best supplier for a product based on pricing or lead time.
 * Used in alert generation (FR-3.7).
 *
 * Returns the supplier with the shortest lead time, or null if no suppliers exist.
 */
export async function suggestBestSupplier(
  productId: string,
): Promise<{ supplierId: string; reason: 'best_price' | 'shortest_lead_time' } | null> {
  // Get the product's current supplier first
  const productResult = await query<Record<string, unknown>>(
    'SELECT supplier_id FROM products WHERE id = $1',
    [productId],
  );

  if (productResult.rowCount === 0) {
    return null;
  }

  const currentSupplierId = productResult.rows[0].supplier_id as string | null;

  if (!currentSupplierId) {
    // No supplier assigned – suggest the one with shortest lead time overall
    const supplierResult = await query<Record<string, unknown>>(
      'SELECT id FROM suppliers ORDER BY lead_time_days ASC LIMIT 1',
    );
    if (supplierResult.rowCount === 0) return null;
    return {
      supplierId: supplierResult.rows[0].id as string,
      reason: 'shortest_lead_time',
    };
  }

  // Return the current supplier as the suggestion
  return {
    supplierId: currentSupplierId,
    reason: 'shortest_lead_time',
  };
}
