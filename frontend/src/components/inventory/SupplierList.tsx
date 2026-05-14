/**
 * SupplierList Component
 *
 * Tabla de proveedores con:
 *  - Nombre, email, teléfono, tiempo de entrega
 *  - Botones Editar / Eliminar (solo Admin)
 *  - Botón "Agregar Proveedor"
 *  - Carga desde suppliersApi.list()
 *
 * Requirements: FR-1.7, FR-5.1
 */

import React, { useCallback, useEffect, useState } from 'react';
import { suppliersApi } from '../../services/productApi';
import type { Supplier } from '../../types/product';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

export interface SupplierListProps {
  /** Llamado cuando el usuario hace clic en "Agregar Proveedor" */
  onAddSupplier: () => void;
  /** Llamado cuando el usuario hace clic en "Editar" de un proveedor */
  onEditSupplier: (supplier: Supplier) => void;
  /** Rol del usuario actual para control de permisos */
  userRole?: 'admin' | 'pharmacist' | 'cashier';
  /** Incrementar para forzar recarga de la lista */
  refreshKey?: number;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function SupplierList({
  onAddSupplier,
  onEditSupplier,
  userRole = 'cashier',
  refreshKey = 0,
}: SupplierListProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await suppliersApi.list({ limit: 100 });
      setSuppliers(result.data);
      setTotal(result.meta.total);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar proveedores. Intente de nuevo.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchSuppliers();
  }, [fetchSuppliers]);

  // ----------------------------------------------------------------
  // Delete handler
  // ----------------------------------------------------------------

  const handleDelete = async (supplier: Supplier) => {
    if (
      !window.confirm(
        `¿Está seguro de eliminar al proveedor "${supplier.name}"? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    try {
      await suppliersApi.delete(supplier.id);
      void fetchSuppliers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar el proveedor.';
      alert(message);
    }
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Proveedores</h2>
          <p className="mt-1 text-sm text-gray-500">
            {total} proveedor{total !== 1 ? 'es' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddSupplier}
          aria-label="Agregar nuevo proveedor"
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
          Agregar Proveedor
        </button>
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

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8" aria-label="Cargando proveedores">
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
          <table className="min-w-full divide-y divide-gray-200" aria-label="Lista de proveedores">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Nombre
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Teléfono
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Tiempo de Entrega
                </th>
                {isAdmin && (
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {suppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="px-6 py-10 text-center text-sm text-gray-500"
                  >
                    No hay proveedores registrados.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    {/* Nombre */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">{supplier.name}</span>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {supplier.contactEmail ? (
                        <a
                          href={`mailto:${supplier.contactEmail}`}
                          className="text-indigo-600 hover:text-indigo-500 hover:underline"
                          aria-label={`Enviar email a ${supplier.name}: ${supplier.contactEmail}`}
                        >
                          {supplier.contactEmail}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Teléfono */}
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {supplier.phone ? (
                        <a
                          href={`tel:${supplier.phone}`}
                          className="text-indigo-600 hover:text-indigo-500 hover:underline"
                          aria-label={`Llamar a ${supplier.name}: ${supplier.phone}`}
                        >
                          {supplier.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Tiempo de entrega */}
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {supplier.leadTimeDays != null ? (
                        <span>
                          {supplier.leadTimeDays}{' '}
                          {supplier.leadTimeDays === 1 ? 'día' : 'días'}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Acciones (solo Admin) */}
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => onEditSupplier(supplier)}
                            aria-label={`Editar proveedor ${supplier.name}`}
                            className="font-medium text-indigo-600 hover:text-indigo-500"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(supplier)}
                            aria-label={`Eliminar proveedor ${supplier.name}`}
                            className="font-medium text-red-600 hover:text-red-500"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
