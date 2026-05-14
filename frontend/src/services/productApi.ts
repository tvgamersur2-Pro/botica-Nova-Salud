/**
 * API client for Product and Supplier management.
 *
 * Uses the shared axios instance from api.ts which handles
 * authentication tokens and token refresh automatically.
 *
 * Requirements: FR-1.1, FR-1.3, FR-1.4, FR-1.7, FR-2.2, FR-3.2
 */

import apiClient from './api';
import type {
  Product,
  Supplier,
  CreateProductPayload,
  UpdateProductPayload,
  CreateSupplierPayload,
  UpdateSupplierPayload,
  PaginatedProductsResponse,
  PaginatedSuppliersResponse,
  ProductResponse,
  SupplierResponse,
  ProductFilters,
  SupplierFilters,
} from '../types/product';

// ----------------------------------------------------------------
// Products API
// ----------------------------------------------------------------

export const productsApi = {
  /**
   * List products with optional search, filtering, and pagination.
   * Requirements: FR-1.1, FR-2.2, FR-3.2
   */
  list: (filters: ProductFilters = {}): Promise<PaginatedProductsResponse> => {
    const params: Record<string, string> = {};

    if (filters.search)                          params.search      = filters.search;
    if (filters.category)                        params.category    = filters.category;
    if (filters.supplierId)                      params.supplierId  = filters.supplierId;
    if (filters.stockLevel)                      params.stockLevel  = filters.stockLevel;
    if (filters.page !== undefined)              params.page        = String(filters.page);
    if (filters.limit !== undefined)             params.limit       = String(filters.limit);

    return apiClient
      .get<PaginatedProductsResponse>('/products', { params })
      .then((r) => r.data);
  },

  /**
   * Get a single product by ID.
   */
  getById: (id: string): Promise<Product> =>
    apiClient
      .get<ProductResponse>(`/products/${id}`)
      .then((r) => r.data.data),

  /**
   * Create a new product (Admin, Pharmacist).
   * Requirements: FR-1.1
   */
  create: (payload: CreateProductPayload): Promise<Product> =>
    apiClient
      .post<ProductResponse>('/products', payload)
      .then((r) => r.data.data),

  /**
   * Update an existing product (Admin, Pharmacist).
   * Requirements: FR-1.3
   */
  update: (id: string, payload: UpdateProductPayload): Promise<Product> =>
    apiClient
      .put<ProductResponse>(`/products/${id}`, payload)
      .then((r) => r.data.data),

  /**
   * Delete a product (Admin only).
   * Requirements: FR-1.4
   */
  delete: (id: string): Promise<void> =>
    apiClient.delete(`/products/${id}`).then(() => undefined),
};

// ----------------------------------------------------------------
// Suppliers API
// ----------------------------------------------------------------

export const suppliersApi = {
  /**
   * List suppliers with optional search and pagination.
   * Requirements: FR-1.7
   */
  list: (filters: SupplierFilters = {}): Promise<PaginatedSuppliersResponse> => {
    const params: Record<string, string> = {};

    if (filters.search)             params.search = filters.search;
    if (filters.page !== undefined) params.page   = String(filters.page);
    if (filters.limit !== undefined) params.limit  = String(filters.limit);

    return apiClient
      .get<PaginatedSuppliersResponse>('/suppliers', { params })
      .then((r) => r.data);
  },

  /**
   * Get a single supplier by ID.
   */
  getById: (id: string): Promise<Supplier> =>
    apiClient
      .get<SupplierResponse>(`/suppliers/${id}`)
      .then((r) => r.data.data),

  /**
   * Create a new supplier (Admin, Pharmacist).
   * Requirements: FR-1.7
   */
  create: (payload: CreateSupplierPayload): Promise<Supplier> =>
    apiClient
      .post<SupplierResponse>('/suppliers', payload)
      .then((r) => r.data.data),

  /**
   * Update an existing supplier (Admin, Pharmacist).
   * Requirements: FR-1.7
   */
  update: (id: string, payload: UpdateSupplierPayload): Promise<Supplier> =>
    apiClient
      .put<SupplierResponse>(`/suppliers/${id}`, payload)
      .then((r) => r.data.data),

  /**
   * Delete a supplier (Admin only).
   * Requirements: FR-1.7
   */
  delete: (id: string): Promise<void> =>
    apiClient.delete(`/suppliers/${id}`).then(() => undefined),
};
