/**
 * ProductForm Component
 *
 * Modal form for creating or editing a product.
 * Accessible to Admin and Pharmacist roles.
 *
 * Validates:
 *  - Required fields
 *  - quantityInStock >= 0
 *  - unitPrice > 0
 *  - expirationDate must be in the future (on create)
 *
 * Requirements: FR-1.1, FR-1.3, FR-5.1, FR-5.3
 */

import React, { useEffect, useState } from 'react';
import { productsApi, suppliersApi } from '../../services/productApi';
import type {
  Product,
  Supplier,
  ProductForm as ProductFormType,
  ProductCategory,
  CreateProductPayload,
  UpdateProductPayload,
} from '../../types/product';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface FormState {
  name: string;
  dosage: string;
  form: ProductFormType;
  quantityInStock: string;
  unitPrice: string;
  supplierId: string;
  expirationDate: string;
  category: ProductCategory;
  minStockThreshold: string;
  reorderQuantity: string;
}

interface FieldErrors {
  name?: string;
  dosage?: string;
  form?: string;
  quantityInStock?: string;
  unitPrice?: string;
  supplierId?: string;
  expirationDate?: string;
  category?: string;
  minStockThreshold?: string;
  reorderQuantity?: string;
}

interface ProductFormProps {
  /** If provided, the form is in "edit" mode; otherwise "create" mode */
  product?: Product | null;
  /** Called after a successful save */
  onSuccess: (savedProduct: Product) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function toDateInputValue(dateStr: string | undefined): string {
  if (!dateStr) return '';
  // Convert ISO date string to YYYY-MM-DD for <input type="date">
  return dateStr.split('T')[0];
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// ----------------------------------------------------------------
// Validation
// ----------------------------------------------------------------

function validate(state: FormState, isEdit: boolean): FieldErrors {
  const errors: FieldErrors = {};

  if (!state.name.trim()) {
    errors.name = 'Product name is required';
  }

  if (!state.form) {
    errors.form = 'Form is required';
  }

  if (!state.category) {
    errors.category = 'Category is required';
  }

  const qty = parseFloat(state.quantityInStock);
  if (state.quantityInStock === '' || isNaN(qty)) {
    errors.quantityInStock = 'Quantity is required';
  } else if (qty < 0 || !Number.isInteger(qty)) {
    errors.quantityInStock = 'Quantity must be a non-negative integer';
  }

  const price = parseFloat(state.unitPrice);
  if (state.unitPrice === '' || isNaN(price)) {
    errors.unitPrice = 'Unit price is required';
  } else if (price <= 0) {
    errors.unitPrice = 'Unit price must be greater than 0';
  }

  if (!state.expirationDate) {
    errors.expirationDate = 'Expiration date is required';
  } else if (!isEdit) {
    // On create, expiration date must be in the future
    const today = getTodayString();
    if (state.expirationDate <= today) {
      errors.expirationDate = 'Expiration date must be in the future';
    }
  }

  if (state.minStockThreshold !== '') {
    const threshold = parseFloat(state.minStockThreshold);
    if (isNaN(threshold) || threshold < 0 || !Number.isInteger(threshold)) {
      errors.minStockThreshold = 'Min stock threshold must be a non-negative integer';
    }
  }

  if (state.reorderQuantity !== '') {
    const reorder = parseFloat(state.reorderQuantity);
    if (isNaN(reorder) || reorder < 0 || !Number.isInteger(reorder)) {
      errors.reorderQuantity = 'Reorder quantity must be a non-negative integer';
    }
  }

  return errors;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const isEdit = Boolean(product);

  const [form, setForm] = useState<FormState>({
    name:              product?.name              ?? '',
    dosage:            product?.dosage            ?? '',
    form:              product?.form              ?? 'tablet',
    quantityInStock:   product?.quantityInStock   !== undefined ? String(product.quantityInStock) : '',
    unitPrice:         product?.unitPrice         !== undefined ? String(product.unitPrice) : '',
    supplierId:        product?.supplierId        ?? '',
    expirationDate:    toDateInputValue(product?.expirationDate),
    category:          product?.category          ?? 'general',
    minStockThreshold: product?.minStockThreshold !== undefined ? String(product.minStockThreshold) : '10',
    reorderQuantity:   product?.reorderQuantity   !== undefined ? String(product.reorderQuantity) : '50',
  });

  const [errors, setErrors]     = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Load suppliers for the dropdown
  useEffect(() => {
    suppliersApi
      .list({ limit: 100 })
      .then((r) => setSuppliers(r.data))
      .catch(() => {
        // Non-critical – supplier dropdown will be empty
      });
  }, []);

  // Reset form when product prop changes
  useEffect(() => {
    setForm({
      name:              product?.name              ?? '',
      dosage:            product?.dosage            ?? '',
      form:              product?.form              ?? 'tablet',
      quantityInStock:   product?.quantityInStock   !== undefined ? String(product.quantityInStock) : '',
      unitPrice:         product?.unitPrice         !== undefined ? String(product.unitPrice) : '',
      supplierId:        product?.supplierId        ?? '',
      expirationDate:    toDateInputValue(product?.expirationDate),
      category:          product?.category          ?? 'general',
      minStockThreshold: product?.minStockThreshold !== undefined ? String(product.minStockThreshold) : '10',
      reorderQuantity:   product?.reorderQuantity   !== undefined ? String(product.reorderQuantity) : '50',
    });
    setErrors({});
    setApiError(null);
  }, [product]);

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const fieldErrors = validate(form, isEdit);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      let savedProduct: Product;

      if (isEdit && product) {
        const payload: UpdateProductPayload = {
          name:              form.name.trim(),
          dosage:            form.dosage.trim() || undefined,
          form:              form.form,
          quantityInStock:   parseInt(form.quantityInStock, 10),
          unitPrice:         parseFloat(form.unitPrice),
          supplierId:        form.supplierId || null,
          expirationDate:    form.expirationDate,
          category:          form.category,
          minStockThreshold: form.minStockThreshold ? parseInt(form.minStockThreshold, 10) : undefined,
          reorderQuantity:   form.reorderQuantity ? parseInt(form.reorderQuantity, 10) : undefined,
        };
        savedProduct = await productsApi.update(product.id, payload);
      } else {
        const payload: CreateProductPayload = {
          name:              form.name.trim(),
          dosage:            form.dosage.trim() || undefined,
          form:              form.form,
          quantityInStock:   parseInt(form.quantityInStock, 10),
          unitPrice:         parseFloat(form.unitPrice),
          supplierId:        form.supplierId || undefined,
          expirationDate:    form.expirationDate,
          category:          form.category,
          minStockThreshold: form.minStockThreshold ? parseInt(form.minStockThreshold, 10) : undefined,
          reorderQuantity:   form.reorderQuantity ? parseInt(form.reorderQuantity, 10) : undefined,
        };
        savedProduct = await productsApi.create(payload);
      }

      onSuccess(savedProduct);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setApiError(message);
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------------

  const inputClass = (hasError: boolean) =>
    [
      'block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset',
      'placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
      hasError
        ? 'ring-red-300 focus:ring-red-500'
        : 'ring-gray-300 focus:ring-indigo-600',
    ].join(' ');

  const fieldError = (field: keyof FieldErrors) =>
    errors[field] ? (
      <p role="alert" className="mt-1 text-xs text-red-600">
        {errors[field]}
      </p>
    ) : null;

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="product-form-title" className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="space-y-4 px-6 py-5">
            {/* API error */}
            {apiError && (
              <div
                role="alert"
                className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
              >
                {apiError}
              </div>
            )}

            {/* Two-column grid for most fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Name */}
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Product Name <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.name)}
                  className={`mt-1 ${inputClass(Boolean(errors.name))}`}
                />
                {fieldError('name')}
              </div>

              {/* Dosage */}
              <div>
                <label htmlFor="dosage" className="block text-sm font-medium text-gray-700">
                  Dosage
                </label>
                <input
                  id="dosage"
                  name="dosage"
                  type="text"
                  placeholder="e.g. 500mg"
                  value={form.dosage}
                  onChange={handleChange}
                  className={`mt-1 ${inputClass(Boolean(errors.dosage))}`}
                />
                {fieldError('dosage')}
              </div>

              {/* Form (tablet, capsule, etc.) */}
              <div>
                <label htmlFor="form" className="block text-sm font-medium text-gray-700">
                  Form <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <select
                  id="form"
                  name="form"
                  value={form.form}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.form)}
                  className={`mt-1 ${inputClass(Boolean(errors.form))}`}
                >
                  <option value="tablet">Tablet</option>
                  <option value="capsule">Capsule</option>
                  <option value="liquid">Liquid</option>
                  <option value="injection">Injection</option>
                  <option value="cream">Cream</option>
                  <option value="other">Other</option>
                </select>
                {fieldError('form')}
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Category <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.category)}
                  className={`mt-1 ${inputClass(Boolean(errors.category))}`}
                >
                  <option value="prescription">Prescription</option>
                  <option value="otc">OTC (Over the Counter)</option>
                  <option value="general">General</option>
                </select>
                {fieldError('category')}
              </div>

              {/* Supplier */}
              <div>
                <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700">
                  Supplier
                </label>
                <select
                  id="supplierId"
                  name="supplierId"
                  value={form.supplierId}
                  onChange={handleChange}
                  className={`mt-1 ${inputClass(Boolean(errors.supplierId))}`}
                >
                  <option value="">No supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {fieldError('supplierId')}
              </div>

              {/* Quantity in stock */}
              <div>
                <label htmlFor="quantityInStock" className="block text-sm font-medium text-gray-700">
                  Quantity in Stock <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="quantityInStock"
                  name="quantityInStock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantityInStock}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.quantityInStock)}
                  className={`mt-1 ${inputClass(Boolean(errors.quantityInStock))}`}
                />
                {fieldError('quantityInStock')}
              </div>

              {/* Unit price */}
              <div>
                <label htmlFor="unitPrice" className="block text-sm font-medium text-gray-700">
                  Unit Price <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-400 sm:text-sm">$</span>
                  </div>
                  <input
                    id="unitPrice"
                    name="unitPrice"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.unitPrice}
                    onChange={handleChange}
                    aria-invalid={Boolean(errors.unitPrice)}
                    className={`pl-7 ${inputClass(Boolean(errors.unitPrice))}`}
                  />
                </div>
                {fieldError('unitPrice')}
              </div>

              {/* Expiration date */}
              <div>
                <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700">
                  Expiration Date <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="expirationDate"
                  name="expirationDate"
                  type="date"
                  min={!isEdit ? getTodayString() : undefined}
                  value={form.expirationDate}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.expirationDate)}
                  className={`mt-1 ${inputClass(Boolean(errors.expirationDate))}`}
                />
                {fieldError('expirationDate')}
              </div>

              {/* Min stock threshold */}
              <div>
                <label htmlFor="minStockThreshold" className="block text-sm font-medium text-gray-700">
                  Min Stock Threshold
                </label>
                <input
                  id="minStockThreshold"
                  name="minStockThreshold"
                  type="number"
                  min="0"
                  step="1"
                  value={form.minStockThreshold}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.minStockThreshold)}
                  className={`mt-1 ${inputClass(Boolean(errors.minStockThreshold))}`}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Alert will trigger when stock falls to or below this level.
                </p>
                {fieldError('minStockThreshold')}
              </div>

              {/* Reorder quantity */}
              <div>
                <label htmlFor="reorderQuantity" className="block text-sm font-medium text-gray-700">
                  Reorder Quantity
                </label>
                <input
                  id="reorderQuantity"
                  name="reorderQuantity"
                  type="number"
                  min="0"
                  step="1"
                  value={form.reorderQuantity}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.reorderQuantity)}
                  className={`mt-1 ${inputClass(Boolean(errors.reorderQuantity))}`}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Suggested quantity to order when restocking.
                </p>
                {fieldError('reorderQuantity')}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {saving && (
                <svg
                  className="h-4 w-4 animate-spin"
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
              )}
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
