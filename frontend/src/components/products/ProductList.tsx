/**
 * ProductList Component
 *
 * Displays a paginated, filterable list of products with:
 *  - Search by name, dosage, or product ID
 *  - Filter by category, supplier, and stock level
 *  - Color-coded stock level indicators
 *  - Expiration date warnings (within 90 days)
 *  - Role-based action buttons (edit for Admin/Pharmacist, delete for Admin)
 *
 * Requirements: FR-1.1, FR-1.5, FR-1.6, FR-2.2, FR-3.2, FR-5.1, FR-5.3
 */

import React, { useCallback, useEffect, useState } from 'react';
import { productsApi, suppliersApi } from '../../services/productApi';
import type {
  Product,
  ProductFilters,
  ProductCategory,
  StockLevel,
  Supplier,
} from '../../types/product';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Returns true if the product expires within 90 days */
function isExpiringSoon(expirationDate: string): boolean {
  const exp = new Date(expirationDate);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 90;
}

/** Returns true if the product is already expired */
function isExpired(expirationDate: string): boolean {
  return new Date(expirationDate) < new Date();
}

/** Returns true if the product is at or below its minimum stock threshold */
function isLowStock(product: Product): boolean {
  return product.quantityInStock <= product.minStockThreshold;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

interface BadgeProps {
  label: string;
  variant: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray' | 'orange';
}

function Badge({ label, variant }: BadgeProps) {
  const classes: Record<BadgeProps['variant'], string> = {
    green:  'bg-green-100 text-green-800',
    red:    'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue:   'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    gray:   'bg-gray-100 text-gray-700',
    orange: 'bg-orange-100 text-orange-800',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[variant]}`}
    >
      {label}
    </span>
  );
}

function categoryBadge(category: ProductCategory) {
  const map: Record<ProductCategory, { label: string; variant: BadgeProps['variant'] }> = {
    prescription: { label: 'Prescription', variant: 'purple' },
    otc:          { label: 'OTC',          variant: 'blue'   },
    general:      { label: 'General',      variant: 'gray'   },
  };
  const { label, variant } = map[category] ?? { label: category, variant: 'gray' };
  return <Badge label={label} variant={variant} />;
}

function stockBadge(product: Product) {
  if (product.quantityInStock === 0) {
    return <Badge label="Out of Stock" variant="red" />;
  }
  if (isLowStock(product)) {
    return <Badge label="Low Stock" variant="yellow" />;
  }
  return <Badge label="In Stock" variant="green" />;
}

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface ProductListProps {
  /** Called when the user clicks "Add Product" */
  onAddProduct: () => void;
  /** Called when the user clicks "Edit" on a row */
  onEditProduct: (product: Product) => void;
  /** Refresh trigger – increment to force a reload */
  refreshKey?: number;
  /** Current user role for permission-based UI */
  userRole?: 'admin' | 'pharmacist' | 'cashier';
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function ProductList({
  onAddProduct,
  onEditProduct,
  refreshKey = 0,
  userRole = 'cashier',
}: ProductListProps) {
  const [products, setProducts]     = useState<Product[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);

  const [filters, setFilters] = useState<ProductFilters>({
    search:     '',
    category:   '',
    supplierId: '',
    stockLevel: '',
    page:       1,
    limit:      20,
  });

  const canEdit   = userRole === 'admin' || userRole === 'pharmacist';
  const canDelete = userRole === 'admin';

  // ----------------------------------------------------------------
  // Load suppliers for filter dropdown
  // ----------------------------------------------------------------

  useEffect(() => {
    suppliersApi
      .list({ limit: 100 })
      .then((r) => setSuppliers(r.data))
      .catch(() => {
        // Non-critical – filter just won't show supplier names
      });
  }, []);

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build filters, stripping empty strings
      const activeFilters: ProductFilters = {
        page:  filters.page,
        limit: filters.limit,
      };
      if (filters.search)     activeFilters.search     = filters.search;
      if (filters.category)   activeFilters.category   = filters.category;
      if (filters.supplierId) activeFilters.supplierId = filters.supplierId;
      if (filters.stockLevel) activeFilters.stockLevel = filters.stockLevel;

      const result = await productsApi.list(activeFilters);
      setProducts(result.data);
      setTotal(result.meta.total);
      setTotalPages(result.meta.totalPages);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load products. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  // ----------------------------------------------------------------
  // Delete handler
  // ----------------------------------------------------------------

  const handleDelete = async (product: Product) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await productsApi.delete(product.id);
      void fetchProducts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete product.';
      alert(message);
    }
  };

  // ----------------------------------------------------------------
  // Filter helpers
  // ----------------------------------------------------------------

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({
      ...prev,
      category: e.target.value as ProductCategory | '',
      page: 1,
    }));
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, supplierId: e.target.value, page: 1 }));
  };

  const handleStockLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({
      ...prev,
      stockLevel: e.target.value as StockLevel | '',
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Product Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} product{total !== 1 ? 's' : ''} total
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg bg-gray-50 p-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-4 w-4 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              id="product-search"
              type="search"
              placeholder="Search by name, dosage, or ID…"
              value={filters.search ?? ''}
              onChange={handleSearchChange}
              className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            />
          </div>
        </div>

        {/* Category filter */}
        <div>
          <label htmlFor="category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="category-filter"
            value={filters.category ?? ''}
            onChange={handleCategoryChange}
            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          >
            <option value="">All categories</option>
            <option value="prescription">Prescription</option>
            <option value="otc">OTC</option>
            <option value="general">General</option>
          </select>
        </div>

        {/* Supplier filter */}
        {suppliers.length > 0 && (
          <div>
            <label htmlFor="supplier-filter" className="sr-only">
              Filter by supplier
            </label>
            <select
              id="supplier-filter"
              value={filters.supplierId ?? ''}
              onChange={handleSupplierChange}
              className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            >
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Stock level filter */}
        <div>
          <label htmlFor="stock-filter" className="sr-only">
            Filter by stock level
          </label>
          <select
            id="stock-filter"
            value={filters.stockLevel ?? ''}
            onChange={handleStockLevelChange}
            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          >
            <option value="">All stock levels</option>
            <option value="low_stock">Low Stock</option>
            <option value="in_stock">In Stock</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200"
        >
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-8" aria-label="Loading products">
          <svg
            className="h-8 w-8 animate-spin text-indigo-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Product
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Category
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Stock
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Price
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Expiration
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Supplier
                </th>
                {canEdit && (
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEdit ? 7 : 6}
                    className="px-6 py-10 text-center text-sm text-gray-500"
                  >
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const expiringSoon = isExpiringSoon(product.expirationDate);
                  const expired      = isExpired(product.expirationDate);

                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      {/* Product name + dosage + form */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          {(product.dosage || product.form) && (
                            <p className="text-xs text-gray-500">
                              {[product.dosage, product.form].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="whitespace-nowrap px-6 py-4">
                        {categoryBadge(product.category)}
                      </td>

                      {/* Stock level */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {product.quantityInStock}
                          </span>
                          {stockBadge(product)}
                          {isLowStock(product) && (
                            <span className="text-xs text-gray-400">
                              Min: {product.minStockThreshold}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unit price */}
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(product.unitPrice)}
                      </td>

                      {/* Expiration date with warning */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-sm ${
                              expired
                                ? 'font-semibold text-red-600'
                                : expiringSoon
                                ? 'font-semibold text-yellow-600'
                                : 'text-gray-900'
                            }`}
                          >
                            {formatDate(product.expirationDate)}
                          </span>
                          {expired && (
                            <Badge label="Expired" variant="red" />
                          )}
                          {!expired && expiringSoon && (
                            <Badge label="Expiring Soon" variant="orange" />
                          )}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {product.supplierName ?? '—'}
                      </td>

                      {/* Actions */}
                      {canEdit && (
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => onEditProduct(product)}
                              className="font-medium text-indigo-600 hover:text-indigo-500"
                            >
                              Edit
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => void handleDelete(product)}
                                className="font-medium text-red-600 hover:text-red-500"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-700">
            Page <span className="font-medium">{filters.page}</span> of{' '}
            <span className="font-medium">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => handlePageChange((filters.page ?? 1) - 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={(filters.page ?? 1) >= totalPages}
              onClick={() => handlePageChange((filters.page ?? 1) + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
