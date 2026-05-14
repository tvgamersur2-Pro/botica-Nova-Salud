/**
 * SupplierForm Component
 *
 * Formulario modal para crear o editar un proveedor.
 * Campos: nombre (requerido), email, teléfono, dirección, días de entrega.
 * Soporta modo crear y editar.
 *
 * Requirements: FR-1.7, FR-5.3
 */

import React, { useEffect, useState } from 'react';
import { suppliersApi } from '../../services/productApi';
import type {
  Supplier,
  CreateSupplierPayload,
  UpdateSupplierPayload,
} from '../../types/product';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface FormState {
  name:         string;
  contactEmail: string;
  phone:        string;
  address:      string;
  leadTimeDays: string;
}

interface FieldErrors {
  name?:         string;
  contactEmail?: string;
  phone?:        string;
  address?:      string;
  leadTimeDays?: string;
}

export interface SupplierFormProps {
  /** Si se provee, el formulario está en modo "editar"; de lo contrario "crear" */
  supplier?: Supplier | null;
  /** Llamado tras guardar exitosamente */
  onSuccess: (savedSupplier: Supplier) => void;
  /** Llamado cuando el usuario cancela */
  onCancel: () => void;
}

// ----------------------------------------------------------------
// Validation
// ----------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(state: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!state.name.trim()) {
    errors.name = 'El nombre del proveedor es requerido';
  }

  if (state.contactEmail.trim() && !EMAIL_REGEX.test(state.contactEmail.trim())) {
    errors.contactEmail = 'Ingrese un email válido';
  }

  if (state.leadTimeDays !== '') {
    const days = parseInt(state.leadTimeDays, 10);
    if (isNaN(days) || days < 0 || !Number.isInteger(days)) {
      errors.leadTimeDays = 'Los días de entrega deben ser un número entero positivo';
    }
  }

  return errors;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const isEdit = Boolean(supplier);

  const [form, setForm] = useState<FormState>({
    name:         supplier?.name         ?? '',
    contactEmail: supplier?.contactEmail ?? '',
    phone:        supplier?.phone        ?? '',
    address:      supplier?.address      ?? '',
    leadTimeDays: supplier?.leadTimeDays !== undefined ? String(supplier.leadTimeDays) : '',
  });

  const [errors, setErrors]     = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  // Resetear formulario cuando cambia el proveedor
  useEffect(() => {
    setForm({
      name:         supplier?.name         ?? '',
      contactEmail: supplier?.contactEmail ?? '',
      phone:        supplier?.phone        ?? '',
      address:      supplier?.address      ?? '',
      leadTimeDays: supplier?.leadTimeDays !== undefined ? String(supplier.leadTimeDays) : '',
    });
    setErrors({});
    setApiError(null);
  }, [supplier]);

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
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

    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      let savedSupplier: Supplier;

      if (isEdit && supplier) {
        const payload: UpdateSupplierPayload = {
          name:         form.name.trim(),
          contactEmail: form.contactEmail.trim() || null,
          phone:        form.phone.trim()        || null,
          address:      form.address.trim()      || null,
          leadTimeDays: form.leadTimeDays !== '' ? parseInt(form.leadTimeDays, 10) : undefined,
        };
        savedSupplier = await suppliersApi.update(supplier.id, payload);
      } else {
        const payload: CreateSupplierPayload = {
          name:         form.name.trim(),
          contactEmail: form.contactEmail.trim() || undefined,
          phone:        form.phone.trim()        || undefined,
          address:      form.address.trim()      || undefined,
          leadTimeDays: form.leadTimeDays !== '' ? parseInt(form.leadTimeDays, 10) : undefined,
        };
        savedSupplier = await suppliersApi.create(payload);
      }

      onSuccess(savedSupplier);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Ocurrió un error inesperado. Intente de nuevo.';
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
      aria-labelledby="supplier-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="supplier-form-title" className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Editar Proveedor' : 'Agregar Proveedor'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar formulario"
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

            {/* Nombre */}
            <div>
              <label htmlFor="supplier-name" className="block text-sm font-medium text-gray-700">
                Nombre <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <input
                id="supplier-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                aria-required="true"
                aria-invalid={Boolean(errors.name)}
                placeholder="Nombre del proveedor"
                className={`mt-1 ${inputClass(Boolean(errors.name))}`}
              />
              {fieldError('name')}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="supplier-email" className="block text-sm font-medium text-gray-700">
                Email de Contacto
              </label>
              <input
                id="supplier-email"
                name="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={handleChange}
                aria-invalid={Boolean(errors.contactEmail)}
                placeholder="contacto@proveedor.com"
                className={`mt-1 ${inputClass(Boolean(errors.contactEmail))}`}
              />
              {fieldError('contactEmail')}
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="supplier-phone" className="block text-sm font-medium text-gray-700">
                Teléfono
              </label>
              <input
                id="supplier-phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                aria-invalid={Boolean(errors.phone)}
                placeholder="+52 55 1234 5678"
                className={`mt-1 ${inputClass(Boolean(errors.phone))}`}
              />
              {fieldError('phone')}
            </div>

            {/* Dirección */}
            <div>
              <label htmlFor="supplier-address" className="block text-sm font-medium text-gray-700">
                Dirección
              </label>
              <textarea
                id="supplier-address"
                name="address"
                rows={2}
                value={form.address}
                onChange={handleChange}
                aria-invalid={Boolean(errors.address)}
                placeholder="Calle, colonia, ciudad, estado"
                className={`mt-1 resize-none ${inputClass(Boolean(errors.address))}`}
              />
              {fieldError('address')}
            </div>

            {/* Días de entrega */}
            <div>
              <label htmlFor="supplier-lead-time" className="block text-sm font-medium text-gray-700">
                Días de Entrega
              </label>
              <input
                id="supplier-lead-time"
                name="leadTimeDays"
                type="number"
                min="0"
                step="1"
                value={form.leadTimeDays}
                onChange={handleChange}
                aria-invalid={Boolean(errors.leadTimeDays)}
                placeholder="Ej. 3"
                className={`mt-1 ${inputClass(Boolean(errors.leadTimeDays))}`}
              />
              <p className="mt-1 text-xs text-gray-400">
                Tiempo promedio en días desde el pedido hasta la entrega.
              </p>
              {fieldError('leadTimeDays')}
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
              Cancelar
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
              {saving ? 'Guardando…' : isEdit ? 'Guardar Cambios' : 'Agregar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
