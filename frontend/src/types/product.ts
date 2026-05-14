/**
 * TypeScript types for Product and Supplier management in the frontend.
 * Requirements: DR-1, FR-1.1, FR-1.7
 */

// ----------------------------------------------------------------
// Enums / union types
// ----------------------------------------------------------------

export type ProductForm = 'tablet' | 'capsule' | 'liquid' | 'injection' | 'cream' | 'other';
export type ProductCategory = 'prescription' | 'otc' | 'general';
export type StockLevel = 'low_stock' | 'in_stock';

// ----------------------------------------------------------------
// Core entities
// ----------------------------------------------------------------

export interface Product {
  id: string;
  name: string;
  dosage: string | null;
  form: ProductForm;
  quantityInStock: number;
  unitPrice: number;
  supplierId: string | null;
  supplierName?: string | null;
  expirationDate: string; // ISO date string from API
  category: ProductCategory;
  minStockThreshold: number;
  reorderQuantity: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  leadTimeDays: number;
  pricing: Record<string, unknown> | null;
  createdAt: string;
}

// ----------------------------------------------------------------
// API request payloads
// ----------------------------------------------------------------

export interface CreateProductPayload {
  name: string;
  dosage?: string;
  form: ProductForm;
  quantityInStock: number;
  unitPrice: number;
  supplierId?: string;
  expirationDate: string;
  category: ProductCategory;
  minStockThreshold?: number;
  reorderQuantity?: number;
}

export interface UpdateProductPayload {
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

export interface CreateSupplierPayload {
  name: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  leadTimeDays?: number;
  pricing?: Record<string, unknown>;
}

export interface UpdateSupplierPayload {
  name?: string;
  contactEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  leadTimeDays?: number;
  pricing?: Record<string, unknown> | null;
}

// ----------------------------------------------------------------
// API response shapes
// ----------------------------------------------------------------

export interface ProductResponse {
  data: Product;
}

export interface PaginatedProductsResponse {
  data: Product[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SupplierResponse {
  data: Supplier;
}

export interface PaginatedSuppliersResponse {
  data: Supplier[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ----------------------------------------------------------------
// Filter / query options
// ----------------------------------------------------------------

export interface ProductFilters {
  search?: string;
  category?: ProductCategory | '';
  supplierId?: string;
  stockLevel?: StockLevel | '';
  page?: number;
  limit?: number;
}

export interface SupplierFilters {
  search?: string;
  page?: number;
  limit?: number;
}
