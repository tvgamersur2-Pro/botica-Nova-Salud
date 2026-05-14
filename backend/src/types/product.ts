/**
 * TypeScript types for Product and Supplier management.
 *
 * Requirements: DR-1, FR-1.1, FR-1.7
 */

// ----------------------------------------------------------------
// Enums / union types
// ----------------------------------------------------------------

export type ProductForm = 'tablet' | 'capsule' | 'liquid' | 'injection' | 'cream' | 'other';
export type ProductCategory = 'prescription' | 'otc' | 'general';

// ----------------------------------------------------------------
// Core entities
// ----------------------------------------------------------------

export interface ProductRecord {
  id: string;
  name: string;
  dosage: string | null;
  form: ProductForm;
  quantityInStock: number;
  unitPrice: number;
  supplierId: string | null;
  expirationDate: Date;
  category: ProductCategory;
  minStockThreshold: number;
  reorderQuantity: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string | null;
  /** Populated via JOIN when requested */
  supplierName?: string | null;
}

export interface SupplierRecord {
  id: string;
  name: string;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  leadTimeDays: number;
  pricing: Record<string, unknown> | null;
  createdAt: Date;
}

// ----------------------------------------------------------------
// Input types
// ----------------------------------------------------------------

export interface CreateProductInput {
  name: string;
  dosage?: string;
  form: ProductForm;
  quantityInStock: number;
  unitPrice: number;
  supplierId?: string;
  expirationDate: string; // ISO date string from request
  category: ProductCategory;
  minStockThreshold?: number;
  reorderQuantity?: number;
}

export interface UpdateProductInput {
  name?: string;
  dosage?: string;
  form?: ProductForm;
  quantityInStock?: number;
  unitPrice?: number;
  supplierId?: string | null;
  expirationDate?: string;
  category?: ProductCategory;
  minStockThreshold?: number;
  reorderQuantity?: number;
}

export interface CreateSupplierInput {
  name: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  leadTimeDays?: number;
  pricing?: Record<string, unknown>;
}

export interface UpdateSupplierInput {
  name?: string;
  contactEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  leadTimeDays?: number;
  pricing?: Record<string, unknown> | null;
}

// ----------------------------------------------------------------
// Query / filter options
// ----------------------------------------------------------------

export interface ListProductsOptions {
  /** Full-text / fuzzy search on name, dosage, or id */
  search?: string;
  category?: ProductCategory;
  supplierId?: string;
  /** 'low_stock' = quantity_in_stock <= min_stock_threshold */
  stockLevel?: 'low_stock' | 'in_stock';
  page?: number;
  limit?: number;
}

export interface ListSuppliersOptions {
  search?: string;
  page?: number;
  limit?: number;
}

// ----------------------------------------------------------------
// Paginated result
// ----------------------------------------------------------------

export interface PaginatedProducts {
  data: ProductRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedSuppliers {
  data: SupplierRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
